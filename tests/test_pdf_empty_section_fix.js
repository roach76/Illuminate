const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the REAL root cause found via direct evidence from the previous round's PDF-diagnostics
// instrumentation: Roy's actual retry produced the alert text "Failed assembling page 36/78, item 7/7
// (section 11): degenerate canvas size 1260x0 <- caused by: degenerate canvas size 1260x0" - a capture
// unit with a real, live height of 0 (an empty wrapper <div> some section's data conditionally leaves
// with nothing inside) was still pushed into captureUnits and handed to html2canvas, which dutifully
// captured it at 0px tall, producing the degenerate canvas that then crashed the whole export.
//
// Fix: expandIntoCaptureUnits (in captureChunksIntoPdf) now returns immediately for any node whose
// live getBoundingClientRect().height is 0, before either the split-further or leaf-push path, so an
// empty node never becomes a capture unit at all.
//
// This test extracts the REAL expandIntoCaptureUnits function body (and its real supporting consts)
// verbatim from app.js via string-boundary extraction, and drives it directly against synthetic DOM
// nodes with a stubbed getBoundingClientRect - some normal (real height), one genuinely empty (real
// height 0) - proving the empty one no longer becomes a capture unit, while its non-empty siblings
// still do, and section/first-of-section bookkeeping still comes out correct around the gap.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static regression guard: the defensive early-return is present, before the split/leaf logic. ---
check(/const naturalHeight = node\.getBoundingClientRect\(\)\.height;\s*\n(\s*\/\/[^\n]*\n)*\s*if \(naturalHeight <= 0\) return;/.test(appSrc),
  'BUG FIX VERIFIED: expandIntoCaptureUnits now returns immediately for a node with zero live height, before deciding whether to split further or push it as a leaf');

// --- Behavioral: extract the real function body + its real supporting consts, and drive it. ---
let threw = null;
try {
  const START_MARKER = 'const NATURAL_HEIGHT_SAFE_THRESHOLD =';
  const END_MARKER = 'topLevelNodes.forEach((node, sectionIndex) => expandIntoCaptureUnits(node, sectionIndex, 0));';
  const startIdx = appSrc.indexOf(START_MARKER);
  check(startIdx !== -1, 'located the real NATURAL_HEIGHT_SAFE_THRESHOLD/expandIntoCaptureUnits block in app.js');
  const endIdx = appSrc.indexOf(END_MARKER, startIdx);
  check(endIdx !== -1, 'located the real block\'s closing topLevelNodes.forEach call');
  // onePageCapacityNaturalPx is referenced by NATURAL_HEIGHT_SAFE_THRESHOLD's real computation -
  // supply a real, representative value (matching this function's own real EXPORT_CAPTURE_WIDTH/
  // SCALE/CONTENT_H_MM defaults) rather than inventing an unrelated one.
  const block = appSrc.slice(startIdx, endIdx + END_MARKER.length);

  function run(topLevelNodesJs, extraSetup) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const sandbox = { document: dom.window.document, console };
    vm.createContext(sandbox);
    vm.runInContext(`
      const onePageCapacityNaturalPx = 900; // representative real-world value for this app's own capture geometry
      ${extraSetup || ''}
      ${block}
      globalThis.__captureUnits = captureUnits;
    `, sandbox);
    return sandbox.__captureUnits;
  }

  // Build one top-level "section" (index 0) with 3 children: a normal one, a genuinely EMPTY one
  // (real height 0 - simulating a conditionally-empty sub-block some profile's data leaves blank),
  // and another normal one. None are individually oversized, so none split further - each should
  // become (or fail to become) exactly one leaf capture unit.
  const setup = `
    function makeNode(h) {
      const el = document.createElement('div');
      el.getBoundingClientRect = function () { return { height: h, width: 420, top: 0, left: 0, bottom: h, right: 420 }; };
      return el;
    }
    const sectionNode = makeNode(500); // over the 45%-of-900=405px threshold, so it recurses into its children
    const childA = makeNode(100); const childB = makeNode(0); const childC = makeNode(120);
    sectionNode.appendChild(childA); sectionNode.appendChild(childB); sectionNode.appendChild(childC);
    var topLevelNodes = [sectionNode];
  `;
  const units = run(null, setup);
  check(Array.isArray(units), 'the real expandIntoCaptureUnits code ran and produced a captureUnits array');
  if (Array.isArray(units)) {
    check(units.length === 2, `BUG FIX VERIFIED: exactly 2 capture units were produced (the empty middle child was skipped entirely) - got ${units.length}`);
    check(units.every(u => u.node.getBoundingClientRect().height > 0), 'no capture unit with a zero-height node was produced');
    if (units.length === 2) {
      check(units[0].node.getBoundingClientRect().height === 100, 'the first surviving unit is childA (height 100), correctly skipping the empty childB');
      check(units[1].node.getBoundingClientRect().height === 120, 'the second surviving unit is childC (height 120), the empty childB left no trace between them');
      check(units[0].isFirstOfSection === true, 'the first surviving (non-empty) unit is still correctly marked as the first-of-section');
      check(units[1].isFirstOfSection === false, 'the second surviving unit is correctly NOT marked as first-of-section (the real first one already claimed it)');
    }
  }

  // Regression: a section that is ENTIRELY empty (every child, and the section itself if it were a
  // leaf, has zero height) produces NO capture units at all, without throwing - proving the fix
  // degrades gracefully rather than merely moving the crash somewhere else.
  const emptySetup = `
    function makeNode(h) {
      const el = document.createElement('div');
      el.getBoundingClientRect = function () { return { height: h, width: 420, top: 0, left: 0, bottom: h, right: 420 }; };
      return el;
    }
    var topLevelNodes = [makeNode(0)];
  `;
  const emptyUnits = run(null, emptySetup);
  check(Array.isArray(emptyUnits) && emptyUnits.length === 0, 'a wholly empty top-level section produces zero capture units, without throwing (graceful, not just relocating the crash)');

  // Regression: an oversized section that recurses into children still works correctly when NONE of
  // its children are empty (proving the fix didn't disturb the pre-existing, real splitting logic).
  const splitSetup = `
    function makeNode(h, childCount) {
      const el = document.createElement('div');
      el.getBoundingClientRect = function () { return { height: h, width: 420, top: 0, left: 0, bottom: h, right: 420 }; };
      for (let i = 0; i < childCount; i++) el.appendChild(makeNode(50, 0));
      return el;
    }
    var topLevelNodes = [makeNode(2000, 3)]; // 2000px, well over the 45%-of-900=405px threshold -> must split
  `;
  const splitUnits = run(null, splitSetup);
  check(Array.isArray(splitUnits) && splitUnits.length === 3, `regression: a genuinely oversized section with 3 normal (non-empty) children still splits into exactly 3 units - got ${Array.isArray(splitUnits) ? splitUnits.length : 'not an array'}`);
} catch (e) { threw = e; }
check(!threw, 'behavioral section completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
