const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies THIS round's fix: "blank space issues back.. page 11 as an example" - directly confirmed via
// visual inspection of the user's real exported PDF (Cheng Gu Suan Ming heading + its small calc-box
// alone atop an otherwise ~85%-blank page, with the section's real content - info rows, Fate Tier, Bone
// Weight Deep Analysis - pushed entirely to the next page).
//
// Root cause: PASS 2's "fits" branch (a placement group whose OWN total height fits within one whole
// page) only ever asked "does this group fit inside a page at all?" - if it didn't fit in whatever room
// was left on the CURRENT page (because a short heading group placed just before it had already used
// some of that room), the old code discarded the entire leftover room and started the group fresh on the
// next page, even when a large, genuinely reusable amount of room (>= MIN_FIRST_SLICE_MM = 70mm) was
// sitting unused. The "oversized" branch already had a leftover-room-reusing pixel-slice mechanism for
// exactly this situation; the "fits" branch simply never used it.
//
// Fix: a "fits" group that does not fit the CURRENT leftover room, but the leftover room is worth reusing
// (>= 70mm), is now routed into that same slicing branch instead of being flushed wholesale - see the new
// `worthReusingLeftoverForOverflow` check directly above the PASS 2 forEach's fits/oversized dispatch.
//
// This test extracts PASS 2 verbatim from the real app.js source (byte range between the literal markers
// `const pages = [];` and `if (currentPage.length) pages.push(currentPage);`) and runs it against a
// synthetic placementGroups array built from the REAL measured heights of the reported section (pill
// label ~11.1mm, calc-box ~52.5mm - both live-measured against the user's real running app at the export's
// actual 420px capture width - and a ~190mm real-content group representing the info-rows/Fate-Tier/Bone
// Weight Deep Analysis block that was reported pushed entirely to the next page), so this proves the
// ACTUAL shipped pagination code now does the right thing, not a hand-reimplemented approximation of it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Source-level checks: the new dispatch logic genuinely exists ---
check(/const worthReusingLeftoverForOverflow = !fitsCurrentRoomMm && group\.totalHeightMm <= CONTENT_H_MM &&/.test(appSrc),
  'the new worthReusingLeftoverForOverflow check exists in captureChunksIntoPdf');
check(/if \(group\.totalHeightMm <= CONTENT_H_MM && !worthReusingLeftoverForOverflow\) \{/.test(appSrc),
  'the "fits" branch dispatch now excludes groups worth reusing leftover room for (routing them into the slicing branch instead)');

// --- Extract PASS 2 verbatim from the real source ---
const startMarker = 'const pages = [];';
const endMarker = 'if (currentPage.length) pages.push(currentPage);';
const startIdx = appSrc.indexOf(startMarker);
const endIdx = appSrc.indexOf(endMarker, startIdx);
if (startIdx === -1 || endIdx === -1) {
  console.error('FAIL: could not locate PASS 2 markers in app.js - extraction boundaries may have moved');
  process.exit(1);
}
const pass2Src = appSrc.slice(startIdx, endIdx + endMarker.length);

// Real measured constants from the function (kept in sync with the live values documented in app.js).
const CONTENT_W_MM = 190;
const CONTENT_H_MM = 253;

// UPDATED (later round, "truncation between words" fix): PASS 2 now calls findSafeSliceCutPx before
// committing to a computed slice height (see test_pdf_safe_slice_cut.js for its own dedicated
// coverage). Extracted verbatim so it's available wherever PASS 2 runs below - the fake units in this
// file use plain { height: N } canvases with no getContext, so findSafeSliceCutPx's own guard clause
// (`typeof canvas.getContext !== 'function'`) makes it a no-op here, preserving every assertion below.
const findSafeSliceCutPxStart = appSrc.indexOf('function findSafeSliceCutPx(canvas, desiredCutPx, minCutPx) {');
let findSafeSliceCutPxSrc = '';
if (findSafeSliceCutPxStart !== -1) {
  let depth = 0, idx = findSafeSliceCutPxStart, endIdx = -1;
  for (; idx < appSrc.length; idx++) {
    if (appSrc[idx] === '{') depth++;
    else if (appSrc[idx] === '}') { depth--; if (depth === 0) { endIdx = idx + 1; break; } }
  }
  if (endIdx !== -1) findSafeSliceCutPxSrc = appSrc.slice(findSafeSliceCutPxStart, endIdx);
}
check(!!findSafeSliceCutPxSrc, 'findSafeSliceCutPx source located and extracted for use by PASS 2 below');

function runPass2(placementGroups) {
  const sandbox = { console, CONTENT_H_MM, placementGroups, __result: null };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  // Top-level `const`/`let` in a vm context script don't attach to the context object, so wrap the
  // verbatim-extracted PASS 2 source in an IIFE and stash its locals onto __result before returning.
  vm.runInContext(`${findSafeSliceCutPxSrc}\n(function () {\n${pass2Src}\n  __result = { pages, sectionStartPage };\n})();`, sandbox, { filename: 'pass2-extract.js' });
  return sandbox.__result;
}

// Build a fake "unit" the way the real function does: canvas.height (px) + pxPerMm, such that
// canvas.height / pxPerMm === heightMm exactly, matching the real invariant PASS 2 relies on for slicing.
function fakeUnit(sectionIndex, isFirstOfSection, heightMm) {
  const pxPerMm = 10; // arbitrary fixed scale - only the ratio matters for slicing math
  return { sectionIndex, isFirstOfSection, canvas: { height: Math.round(heightMm * pxPerMm) }, pxPerMm, heightMm };
}

// --- Test: the exact reported scenario - a short heading+calc-box group, immediately followed by the
// section's real (tall) content, arriving right after some other content has already used part of the
// current page (so the heading group does NOT start at the very top of a fresh page, matching the real
// export where preceding sections fill most of page 11 before Cheng Gu Suan Ming even starts). -----------
{
  // Section 5 (Cheng Gu Suan Ming): pill (11.1mm) + calc-box (52.5mm) chain-absorbed into one group by
  // PASS 1 (calc-box > LABEL_ORPHAN_MAX_MM so the chain stops growing there), matching the real structure.
  const headingGroup = {
    members: [fakeUnit(5, true, 11.1), fakeUnit(5, false, 52.5)],
    totalHeightMm: 11.1 + 52.5,
    isLabelOnly: false,
  };
  // The section's real content (info rows + Fate Tier + Bone Weight Deep Analysis), a single unit per
  // PASS 1 (too tall itself to chain-absorb further) - sized so it fits a full page (253mm) but does NOT
  // fit in the ~189mm of leftover room the heading group leaves behind on a page that already has some
  // prior content on it.
  const contentGroup = {
    members: [fakeUnit(5, false, 190)],
    totalHeightMm: 190,
    isLabelOnly: false,
  };
  // A prior, unrelated section already occupies some of the current page - e.g. 50mm - so the heading
  // group does not start at currentUsedMm === 0 (matching the real export, where Cheng Gu Suan Ming is one
  // of several sections sharing page 11, not the first thing on it).
  const priorGroup = { members: [fakeUnit(4, true, 50)], totalHeightMm: 50, isLabelOnly: false };

  const { pages } = runPass2([priorGroup, headingGroup, contentGroup]);

  // Compute how much of "page 1" (pages[0]) is actual ink versus how much room is left unused on it.
  const page1InkMm = pages[0].reduce((s, item) => s + item.heightMm, 0);
  const page1WastedMm = CONTENT_H_MM - page1InkMm;

  check(pages.length >= 2, `content spans at least 2 pages (got ${pages.length}) - the section's content is too tall to fit entirely on one page alongside the prior section`);
  // BUG (old behavior, for reference/documentation only - NOT asserted, since the fix changes this):
  // priorGroup(50) + headingGroup(63.6) = 113.6mm used, then contentGroup(190) doesn't fit in the
  // remaining 139.4mm OR even a check against 253mm total room (113.6+190=303.6 > 253) - old code would
  // flush ALL of that 139.4mm as wasted blank space and place the full 190mm group on a fresh page 2.
  check(page1WastedMm < 60, `BUG FIX VERIFIED: page 1's leftover room is now substantially reused (only ${page1WastedMm.toFixed(1)}mm left unused, well under the old ~139mm that would have been wasted) - the section's real content now starts filling in right where its heading left off, instead of the whole leftover room being discarded and the content starting fresh on page 2`);
  check(page1InkMm > CONTENT_H_MM - 5, `page 1 is packed close to full (${page1InkMm.toFixed(1)}mm of ${CONTENT_H_MM}mm used) rather than being abandoned after just the heading (113.6mm)`);

  // Confirm the heading (pill + calc-box) is still placed IN FULL on page 1, never sliced (it's small and
  // should render as a whole, unbroken unit - only the tall content group should ever be sliced).
  const page1Items = pages[0];
  const headingItemsOnPage1 = page1Items.filter(it => it.sectionIndex === 5 && (Math.abs(it.heightMm - 11.1) < 0.01 || Math.abs(it.heightMm - 52.5) < 0.01));
  check(headingItemsOnPage1.length === 2, `both heading members (pill + calc-box) are placed whole on page 1, never fragmented (got ${headingItemsOnPage1.length} matching section-5 item(s) on page 1)`);
  check(headingItemsOnPage1.every(it => it.srcYPx === 0), 'the heading members are placed as complete, unsliced pieces (srcYPx === 0 for each)');

  // Confirm the content group's first slice begins immediately after the heading on page 1 (drawYMm ===
  // priorGroup + heading's combined height), i.e. it truly continues right where the heading left off
  // rather than a fresh page being inserted in between.
  const firstContentSliceOnPage1 = page1Items.find(it => it.sectionIndex === 5 && it.srcYPx === 0 && it.heightMm !== 11.1 && it.heightMm !== 52.5);
  check(!!firstContentSliceOnPage1, 'the content group\'s first slice appears on page 1, directly continuing from the heading (not deferred whole to page 2)');
  if (firstContentSliceOnPage1) {
    check(Math.abs(firstContentSliceOnPage1.drawYMm - (50 + 11.1 + 52.5)) < 0.01, `the content's first slice starts exactly where the heading left off (drawYMm ${firstContentSliceOnPage1.drawYMm} should equal 113.6)`);
  }

  // Confirm no content was lost: total ink height across all pages for section 5 equals the full 190mm
  // content group plus the 63.6mm heading (254.6mm total), regardless of how many slices it was split into.
  const totalSection5Ink = pages.flat().filter(it => it.sectionIndex === 5).reduce((s, it) => s + it.heightMm, 0);
  check(Math.abs(totalSection5Ink - (11.1 + 52.5 + 190)) < 0.01, `no content is lost or duplicated by the new slicing - section 5's total rendered height (${totalSection5Ink.toFixed(2)}mm) equals its full original height (253.6mm)`);
}

// --- Test: a group that fits in the leftover room as-is must still be placed atomically, unsliced
// (confirms the fix does not change behavior for the common, already-correct case). ----------------------
{
  const priorGroup = { members: [fakeUnit(0, true, 50)], totalHeightMm: 50, isLabelOnly: false };
  const smallGroup = { members: [fakeUnit(1, true, 60)], totalHeightMm: 60, isLabelOnly: false };
  const { pages } = runPass2([priorGroup, smallGroup]);
  check(pages.length === 1, 'a group that fits comfortably in the current leftover room stays on the same single page (no unnecessary page break introduced)');
  const items = pages[0].filter(it => it.sectionIndex === 1);
  check(items.length === 1 && items[0].srcYPx === 0 && Math.abs(items[0].heightMm - 60) < 0.01, 'the small group is placed whole, unsliced, exactly as before');
}

// --- Test: a group whose leftover room is only a sliver (< 70mm) still flushes wholesale to a fresh page
// rather than being sliced into an unreadable fragment (confirms the "not worth it" threshold still holds). ---
{
  const priorGroup = { members: [fakeUnit(0, true, 200)], totalHeightMm: 200, isLabelOnly: false }; // leaves only 53mm
  const contentGroup = { members: [fakeUnit(1, true, 100)], totalHeightMm: 100, isLabelOnly: false };
  const { pages } = runPass2([priorGroup, contentGroup]);
  check(pages.length === 2, 'with only a small (53mm) sliver of leftover room, the next group still moves to a fresh page wholesale rather than being sliced into a near-unreadable fragment');
  const page1Section1Items = pages[0].filter(it => it.sectionIndex === 1);
  check(page1Section1Items.length === 0, 'no fragment of the next group is sliced into the small leftover sliver on page 1');
  const page2Items = pages[1];
  check(page2Items.length === 1 && Math.abs(page2Items[0].heightMm - 100) < 0.01 && page2Items[0].srcYPx === 0, 'the group is placed whole, unsliced, at the top of the fresh page');
}

// --- Test: a truly oversized group (own total > one page) is completely unaffected by this change - it
// still always routes into the slicing branch exactly as before, regardless of leftover room. -------------
{
  const priorGroup = { members: [fakeUnit(0, true, 10)], totalHeightMm: 10, isLabelOnly: false };
  const oversizedGroup = { members: [fakeUnit(1, true, 400)], totalHeightMm: 400, isLabelOnly: false }; // > CONTENT_H_MM alone
  const { pages } = runPass2([priorGroup, oversizedGroup]);
  const totalInk = pages.flat().filter(it => it.sectionIndex === 1).reduce((s, it) => s + it.heightMm, 0);
  check(Math.abs(totalInk - 400) < 0.01, `an oversized group's content is fully preserved across however many pages it needs to span (got ${totalInk.toFixed(2)}mm of 400mm)`);
  check(pages.length >= 2, 'an oversized group still spans multiple pages as before');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
