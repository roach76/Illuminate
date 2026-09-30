const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies THIS round's fix: "truncation between words" / "text truncation in the page breaks" -
// root-caused via pixel-level analysis of the user's real exported PDF (pulled directly from their
// Downloads folder): a non-table Deep Analysis card, captured as one big leaf canvas, had a text line's
// own descenders (the tails of letters like g/y/p/j/q) sliced away from the rest of that line by PASS 2's
// raw pixel-slicing loop - the line's main body rendered in full on one page, its descenders orphaned as
// a thin, isolated sliver at the top of the next page. This is the same root cause as the table-row-cut
// bug fixed a previous round (noMidSlice), but affects ANY non-table content this slicing loop must cut
// through - the fix here is a smarter CUT POINT (findSafeSliceCutPx), not a "never slice this" flag.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Extract findSafeSliceCutPx verbatim from the real source --------------------------------------
const startMarker = 'function findSafeSliceCutPx(canvas, desiredCutPx, minCutPx) {';
const fnStartIdx = appSrc.indexOf(startMarker);
if (fnStartIdx === -1) { console.error('FAIL: could not locate findSafeSliceCutPx in app.js'); process.exit(1); }
// Find the matching closing brace by simple depth counting from the function's own opening brace.
let depth = 0, i = fnStartIdx, fnEndIdx = -1;
for (; i < appSrc.length; i++) {
  if (appSrc[i] === '{') depth++;
  else if (appSrc[i] === '}') { depth--; if (depth === 0) { fnEndIdx = i + 1; break; } }
}
if (fnEndIdx === -1) { console.error('FAIL: could not find end of findSafeSliceCutPx'); process.exit(1); }
const fnSrc = appSrc.slice(fnStartIdx, fnEndIdx);

const sandbox = { console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(fnSrc, sandbox, { filename: 'findSafeSliceCutPx-extract.js' });
const findSafeSliceCutPx = sandbox.findSafeSliceCutPx;
check(typeof findSafeSliceCutPx === 'function', 'findSafeSliceCutPx extracted successfully from app.js');

// --- Fake canvas builder: rows is an array of booleans, true = this row has ink (dark pixel) somewhere.
function fakeCanvas(rows, width = 10) {
  return {
    width,
    height: rows.length,
    getContext() {
      return {
        getImageData(x, y, w, h) {
          const data = new Uint8ClampedArray(w * h * 4);
          for (let ry = 0; ry < h; ry++) {
            const hasInk = !!rows[y + ry];
            for (let rx = 0; rx < w; rx++) {
              const idx = (ry * w + rx) * 4;
              // Ink rows: a single dark pixel roughly in the middle of the row (mimicking a real glyph
              // stroke) - blank rows: pure white/background everywhere.
              const isInkPixel = hasInk && rx === Math.floor(w / 2);
              const v = isInkPixel ? 20 : 250;
              data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
            }
          }
          return { data };
        },
      };
    },
  };
}

// --- Test 1: a blank row exists a few rows above the desired cut - the cut snaps exactly to it -----
{
  // rows 0-9 ink, row 10 blank (the gap between two lines), rows 11-19 ink again (next line), row 20
  // blank again. desiredCutPx=15 (mid-way through the second ink band) should snap back to row 10.
  const rows = [true,true,true,true,true,true,true,true,true,true, false, true,true,true,true,true,true,true,true,true, false];
  const canvas = fakeCanvas(rows);
  const result = findSafeSliceCutPx(canvas, 15, 0);
  check(result === 10, `cut point snaps back to the nearest blank row (10) above a mid-line cut (got ${result})`);
}

// --- Test 2: no blank row exists within the search window - falls back to the original cut ----------
{
  const rows = new Array(30).fill(true); // solid ink throughout - no safe row anywhere
  const canvas = fakeCanvas(rows);
  const result = findSafeSliceCutPx(canvas, 20, 5);
  check(result === 20, `with no blank row in range, the original computed cut point (20) is used unchanged (got ${result})`);
}

// --- Test 3: the blank row closest to the desired cut is chosen when multiple exist -----------------
{
  // Two candidate blank rows: row 5 and row 12. desiredCutPx=15 should prefer row 12 (closer, shrinks
  // the slice less) over row 5.
  const rows = [true,true,true,true,true, false, true,true,true,true,true,true, false, true,true,true];
  const canvas = fakeCanvas(rows);
  const result = findSafeSliceCutPx(canvas, 15, 0);
  check(result === 12, `the blank row closest to the desired cut (12, not the farther row 5) is chosen (got ${result})`);
}

// --- Test 4: desiredCutPx <= minCutPx is a no-op (degenerate/zero-size search window) ----------------
{
  const rows = [false, false, false];
  const canvas = fakeCanvas(rows);
  const result = findSafeSliceCutPx(canvas, 5, 5);
  check(result === 5, `desiredCutPx === minCutPx returns the desired cut unchanged (got ${result})`);
}

// --- Test 5: a getImageData throw (defensive) falls back to the original cut, never throws itself ---
{
  const canvas = { width: 10, getContext() { return { getImageData() { throw new Error('tainted canvas'); } }; } };
  let threw = false, result = null;
  try { result = findSafeSliceCutPx(canvas, 20, 0); } catch (e) { threw = true; }
  check(!threw, 'a getImageData failure is caught, not propagated');
  check(result === 20, `a getImageData failure falls back to the original computed cut point (got ${result})`);
}

// --- Source-level checks: the PASS-2 loop actually wires this in -------------------------------------
check(/const safeCutPx = findSafeSliceCutPx\(u\.canvas, desiredCutPx, minCutPx\);/.test(appSrc),
  'PASS 2\'s slicing loop calls findSafeSliceCutPx before committing to a computed slice height');
check(/if \(sliceHPx < remainingPx\) \{/.test(appSrc),
  'the safe-cut snap only runs when a real cut is happening (more content remains after this slice)');
check(/const minCutPx = srcYPx \+ Math\.floor\(sliceHPx \* 0\.6\);/.test(appSrc),
  'the safe-cut search window is capped (slice can shrink by at most 40%), so it can never produce a degenerate slice');

// --- Integration check: extract PASS 2 verbatim (same technique as other PDF pagination tests) and
// confirm a mid-line cut is genuinely avoided end-to-end when a safe row is available nearby ----------
const startMarker2 = 'const pages = [];';
const endMarker2 = 'if (currentPage.length) pages.push(currentPage);';
const startIdx2 = appSrc.indexOf(startMarker2);
const endIdx2 = appSrc.indexOf(endMarker2, startIdx2);
if (startIdx2 === -1 || endIdx2 === -1) {
  console.error('FAIL: could not locate PASS 2 markers in app.js - extraction boundaries may have moved');
} else {
  const pass2Src = appSrc.slice(startIdx2, endIdx2 + endMarker2.length);
  const CONTENT_H_MM = 253;

  function runPass2(placementGroups) {
    const sandbox2 = { console, CONTENT_H_MM, placementGroups, findSafeSliceCutPx, __result: null };
    sandbox2.global = sandbox2;
    vm.createContext(sandbox2);
    vm.runInContext(`(function () {\n${pass2Src}\n  __result = { pages, sectionStartPage };\n})();`, sandbox2, { filename: 'pass2-safeslice-extract.js' });
    return sandbox2.__result;
  }

  // Build a canvas tall enough to force a slice, with a deliberate blank row placed exactly where a
  // "line gap" would realistically sit relative to the raw computed cut point.
  const pxPerMm = 10;
  const oversizedHeightMm = 300; // taller than CONTENT_H_MM (253mm) - forces the oversized/slice branch
  const canvasH = Math.round(oversizedHeightMm * pxPerMm);
  // The raw computed first-slice cut (with no prior content, firstSliceCapPx === sliceCapPx === one
  // full page's worth of px) will land at Math.floor(CONTENT_H_MM * pxPerMm). Place a blank row a few
  // pixels above that raw cut point, inside ink everywhere else, so the fix has something real to snap to.
  const rawCutPx = Math.floor(CONTENT_H_MM * pxPerMm);
  const blankRow = rawCutPx - 6;
  const rows = new Array(canvasH).fill(true);
  rows[blankRow] = false;
  const fakeU = {
    node: null, sectionIndex: 7, isFirstOfSection: true,
    canvas: fakeCanvas(rows, 10), pxPerMm, heightMm: oversizedHeightMm, noMidSlice: false,
  };
  const group = { members: [fakeU], totalHeightMm: oversizedHeightMm, isLabelOnly: false };
  const { pages } = runPass2([group]);
  const firstPageItem = pages[0] && pages[0][0];
  check(!!firstPageItem, 'the oversized unit produces at least one page item');
  if (firstPageItem) {
    check(firstPageItem.srcHPx === blankRow, `the first slice's height snaps to the safe blank row (${blankRow}) instead of the raw mid-content cut (${rawCutPx}) (got ${firstPageItem.srcHPx})`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
