const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for the reported "still too much white space and truncation of content between
// pages" in real PDF exports (confirmed visually in the user's own attached 54-page export, which
// showed 35-60% blank gaps at two separate page transitions).
//
// Root-cause theory (see the new comment block in app.js just above this code): the pre-expansion
// pass in captureChunksIntoPdf used to only split a top-level section into its direct children when
// it was over 90% of a page's height, and only one level deep - so (a) medium sections (~40-89% of a
// page) stayed as one atomic, unsplittable unit, which strands large blank gaps whenever PASS 2's
// packer can't fit that whole unit in whatever space is left on the current page, and (b) a section
// whose one oversized child couldn't be split further fell through to a raw pixel-slice fallback,
// which can cut straight through the middle of a line of text - very plausibly the "truncation"
// complaint.
//
// This test extracts the REAL expandIntoCaptureUnits() pre-processing logic verbatim from app.js and
// exercises it directly against synthetic DOM-like nodes (no html2canvas/PDF rendering needed - this
// function only reads node.getBoundingClientRect().height and node.children, both trivial to fake),
// proving: the threshold is now much lower (so medium sections get split too), splitting is now
// recursive (so a still-oversized child keeps being broken down further), recursion is depth-capped
// (so it can never run away), and isFirstOfSection is still tracked correctly per section regardless
// of how deep the recursion went to reach the first real leaf unit.
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// --- Static checks: the threshold was genuinely lowered and recursion/depth-cap machinery exists. ---
check(/onePageCapacityNaturalPx \* 0\.45/.test(src),
  'BUG FIX VERIFIED: pre-expansion threshold lowered from 90% to 45% of a page, so medium-sized sections are no longer left as one unsplittable atomic block');
// Note: matches only the literal old "* 0.9" (90%) threshold, not the unrelated, later-added
// "* 0.95" table-row-chunk capacity constant (TABLE_CHUNK_CAPACITY - a different tuning value for a
// different purpose, introduced by the table-truncation-across-page-break fix).
check(!/onePageCapacityNaturalPx \* 0\.9[^5]/.test(src) && !/onePageCapacityNaturalPx \* 0\.9$/.test(src), 'the old 90% threshold is gone (not just added alongside)');
check(/const MAX_EXPAND_DEPTH = 4;/.test(src), 'a bounded recursion depth cap is present (prevents runaway recursion)');
check(/function expandIntoCaptureUnits\(node, sectionIndex, depth\)/.test(src), 'expandIntoCaptureUnits helper exists');
// BUG FIX (this round): the recursive call now advances by `depth + unwrapSteps + 1`, not a bare
// `depth + 1`, so the single-child-wrapper-unwrapping loop above it counts against MAX_EXPAND_DEPTH
// instead of bypassing it for free - the literal text this check looks for changed accordingly.
check(/expandIntoCaptureUnits\(child, sectionIndex, depth \+ unwrapSteps \+ 1\)/.test(src), 'the helper recurses into children (not just one flat level)');

// --- Behavioral checks: extract the real function and run it against synthetic nodes. ---
function makeFakeNode(height, children) {
  return { getBoundingClientRect: () => ({ height }), children: children || [] };
}

// Build a minimal sandbox exposing just what expandIntoCaptureUnits needs (Array, Math), then define
// the constants/function by extracting them verbatim from the real source, so this test always tracks
// the actual shipped logic rather than a hand-copied re-implementation that could silently drift.
const blockStart = src.indexOf('const NATURAL_HEIGHT_SAFE_THRESHOLD = Math.floor(onePageCapacityNaturalPx * 0.45)');
const blockEnd = src.indexOf('topLevelNodes.forEach((node, sectionIndex) => expandIntoCaptureUnits(node, sectionIndex, 0));', blockStart);
check(blockStart !== -1 && blockEnd !== -1 && blockEnd > blockStart, 'located the real pre-expansion code block to extract');
const extracted = src.slice(blockStart, blockEnd) + 'topLevelNodes.forEach((node, sectionIndex) => expandIntoCaptureUnits(node, sectionIndex, 0));';

function runExpansion(topLevelNodes, onePageCapacityNaturalPx) {
  const sandbox = { Array, Math, console, topLevelNodes, onePageCapacityNaturalPx, captureUnitsResult: null };
  vm.createContext(sandbox);
  vm.runInContext(extracted + '\ncaptureUnitsResult = captureUnits;', sandbox, { filename: 'extracted-expansion.js' });
  return sandbox.captureUnitsResult;
}

let threw = null;
try {
  const PAGE_CAPACITY = 1000; // arbitrary natural-px "one page" for this test; threshold = 450

  // Test A: a medium section (60% of a page - would have been LEFT ATOMIC under the old 90% gate,
  // exactly the size range visually confirmed to cause the reported blank-space gaps) with 3 children
  // each safely under threshold: must now be split into 3 separate, finer-grained units.
  {
    const medium = makeFakeNode(600, [makeFakeNode(200), makeFakeNode(200), makeFakeNode(200)]);
    const units = runExpansion([medium], PAGE_CAPACITY);
    check(units.length === 3, `BUG FIX VERIFIED: a 60%-of-a-page section with multiple children is now split into its 3 children (got ${units.length} unit(s)) - under the old 90% gate this would have stayed one atomic 600-tall unit`);
    check(units[0].isFirstOfSection === true && units[1].isFirstOfSection === false && units[2].isFirstOfSection === false,
      'only the first emitted unit for the section is flagged isFirstOfSection');
    check(units.every(u => u.sectionIndex === 0), 'all 3 units correctly attributed to section 0');
  }

  // Test B: a small section (30% of a page, under the new 45% threshold) with multiple children: must
  // stay atomic (not over-fragmented needlessly).
  {
    const small = makeFakeNode(300, [makeFakeNode(150), makeFakeNode(150)]);
    const units = runExpansion([small], PAGE_CAPACITY);
    check(units.length === 1, 'a section already under the (lowered) threshold is left as a single atomic unit, not over-split');
  }

  // Test C: a tall section (150% of a page) whose one splittable child is ITSELF still oversized
  // (120% of a page) with its own children - must recurse a SECOND level rather than falling straight
  // through to the pixel-slice fallback (the likely source of "truncation of content between pages").
  {
    const grandchildren = [makeFakeNode(400), makeFakeNode(400), makeFakeNode(400)];
    const oversizedChild = makeFakeNode(1200, grandchildren);
    const otherChild = makeFakeNode(300);
    const tallSection = makeFakeNode(1500, [oversizedChild, otherChild]);
    const units = runExpansion([tallSection], PAGE_CAPACITY);
    check(units.length === 4, `BUG FIX VERIFIED: recursion descends a second level into a still-oversized child (3 grandchildren + 1 sibling = 4 leaf units, got ${units.length}) - previously this would have stopped after one level and left a 1200-tall atomic unit that PASS 2 could only handle via a mid-content pixel slice`);
    check(units.filter(u => u.isFirstOfSection).length === 1, 'exactly one unit is flagged as first-of-section, even though it came from 2 levels of recursion deep');
    check(units[0].isFirstOfSection === true, 'the FIRST unit in document order is the one flagged, not an arbitrary one');
  }

  // Test D: MAX_EXPAND_DEPTH must actually bound the recursion - a chain nested deeper than the cap
  // must stop splitting once the cap is hit, rather than recursing forever or erroring.
  {
    // Build a chain 6 levels deep, each still "oversized" and with 2 children, so it would keep
    // wanting to split past the depth-4 cap if the cap didn't apply.
    function buildChain(levelsLeft) {
      if (levelsLeft === 0) return makeFakeNode(900); // leaf: still "oversized" but no children to split into
      return makeFakeNode(900, [buildChain(levelsLeft - 1), makeFakeNode(100)]);
    }
    const deepSection = buildChain(6);
    const units = runExpansion([deepSection], PAGE_CAPACITY);
    check(units.length >= 1 && units.length <= 32, `depth-capped recursion terminates and produces a bounded, sane number of units (got ${units.length}), not a runaway explosion or an infinite loop`);
  }

  // Test E: a single-child section (nothing to split into) stays atomic even if it's oversized -
  // recursion must never invent children that don't exist.
  {
    const oneChild = makeFakeNode(900, [makeFakeNode(900)]);
    const units = runExpansion([oneChild], PAGE_CAPACITY);
    check(units.length === 1, 'a section with only one child (nothing to split into) correctly stays a single atomic unit');
  }

  // Test F: multiple top-level sections each track isFirstOfSection independently.
  {
    const sectionA = makeFakeNode(600, [makeFakeNode(200), makeFakeNode(200), makeFakeNode(200)]);
    const sectionB = makeFakeNode(100); // small, single unit
    const units = runExpansion([sectionA, sectionB], PAGE_CAPACITY);
    check(units.length === 4, 'two top-level sections (one split into 3, one atomic) produce 4 total units');
    const sectionAUnits = units.filter(u => u.sectionIndex === 0);
    const sectionBUnits = units.filter(u => u.sectionIndex === 1);
    check(sectionAUnits.filter(u => u.isFirstOfSection).length === 1, 'section A has exactly one first-of-section unit');
    check(sectionBUnits.length === 1 && sectionBUnits[0].isFirstOfSection === true, 'section B (a single atomic unit) is correctly flagged as its own first-of-section');
  }
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
