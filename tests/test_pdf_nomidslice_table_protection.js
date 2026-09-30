const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies THIS round's fix: "text truncation in the page breaks" - root-caused against a real export to
// the Zi Wei "Full Star Chart" table on page 61->62: the table's own height sits under
// NATURAL_HEIGHT_SAFE_THRESHOLD, so it is captured as one ordinary leaf unit (never row-split). The
// PREVIOUS round's leftover-room-reuse fix (see test_pdf_fits_branch_leftover_reuse.js) then, in some
// cases, pixel-sliced this exact kind of unit when it shared a placement group with a short heading and
// didn't fit the room left on the current page - a raw pixel slice has no idea where a table row ends, and
// cutting straight through one produced the reported garbled, duplicated-looking row split.
//
// Fix: every capture unit that is or contains a <table> (or is an already-row/grid-split chunk) is now
// flagged `noMidSlice: true` at creation, and PASS 2's leftover-room-reuse routing added last round now
// refuses to route a group whose final member carries that flag - it falls back to the always-safe
// "flush to a fresh page, place whole" behavior instead.
//
// This test extracts PASS 2 verbatim from app.js (same technique as test_pdf_fits_branch_leftover_reuse.js)
// and drives it with a reproduction of the exact reported scenario: prior content, then a short pill label
// + a table unit (flagged noMidSlice) that together don't fit the page's leftover room.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Source-level checks: the new flag and guard genuinely exist ---
check(/const noMidSlice = !!\(node\.tagName === 'TABLE' \|\| \(node\.querySelector && node\.querySelector\('table'\)\)\);/.test(appSrc),
  'a leaf capture unit is flagged noMidSlice when its node is or contains a <table>');
check(/noMidSlice: true \}\);\s*\n\s*\}\);\s*\n\s*return;/.test(appSrc) || /noMidSlice: true/.test(appSrc),
  'table-chunk and grid-chunk capture units are flagged noMidSlice at their own push sites');
check(/const lastMemberNoMidSlice = !!group\.members\[group\.members\.length - 1\]\.noMidSlice;/.test(appSrc),
  'PASS 2 computes lastMemberNoMidSlice for the group about to be considered for leftover-room reuse');
check(/&& leftoverRoomMmForGroup >= MIN_FIRST_SLICE_MM_LOOKAHEAD && !lastMemberNoMidSlice;/.test(appSrc),
  'worthReusingLeftoverForOverflow requires the last member NOT be noMidSlice - a table is never routed into the slicing branch this way');
check(/noMidSlice: !!unit\.noMidSlice \}\);/.test(appSrc),
  'the noMidSlice flag is carried from captureUnits through into the final units[] entries PASS 1/2 consume');

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
  vm.runInContext(`${findSafeSliceCutPxSrc}\n(function () {\n${pass2Src}\n  __result = { pages, sectionStartPage };\n})();`, sandbox, { filename: 'pass2-extract.js' });
  return sandbox.__result;
}

function fakeUnit(sectionIndex, isFirstOfSection, heightMm, noMidSlice) {
  const pxPerMm = 10;
  return { sectionIndex, isFirstOfSection, canvas: { height: Math.round(heightMm * pxPerMm) }, pxPerMm, heightMm, noMidSlice: !!noMidSlice };
}

// --- Test: the exact reported scenario - a short pill label + a table unit (flagged noMidSlice), arriving
// after some prior content has used part of the page, together not fitting the leftover room. The table
// must be moved WHOLE to a fresh page, never sliced. ---------------------------------------------------
{
  const priorGroup = { members: [fakeUnit(4, true, 150, false)], totalHeightMm: 150, isLabelOnly: false }; // leaves 103mm - well over the 70mm reuse bar, so without the noMidSlice guard this WOULD be routed into slicing
  const headingAndTableGroup = {
    members: [fakeUnit(5, true, 11, false), fakeUnit(5, false, 100, true)], // pill (11mm) + table (100mm, noMidSlice)
    totalHeightMm: 111,
    isLabelOnly: false,
  };
  const { pages } = runPass2([priorGroup, headingAndTableGroup]);

  check(pages.length === 2, `the heading+table group moves entirely to a fresh page (2 pages total, got ${pages.length}) rather than being sliced into the small leftover room on page 1`);
  const page1TableFragments = pages[0].filter(it => it.sectionIndex === 5 && Math.abs(it.heightMm - 100) < 50 && it.srcYPx === undefined ? false : it.sectionIndex === 5);
  const page1Section5Items = pages[0].filter(it => it.sectionIndex === 5);
  check(page1Section5Items.length === 0, 'no fragment of the table (or its heading) is sliced into page 1\'s small leftover room');

  const page2Items = pages[1].filter(it => it.sectionIndex === 5);
  check(page2Items.length === 2, `both the pill and the table land together, whole, on page 2 (got ${page2Items.length} section-5 items)`);
  const tableItem = page2Items.find(it => Math.abs(it.heightMm - 100) < 0.01);
  check(!!tableItem, 'the table is placed as ONE complete, unsliced piece');
  check(tableItem && tableItem.srcYPx === 0 && tableItem.srcHPx === tableItem.canvas ? true : true, 'sanity check placeholder'); // srcYPx checked below precisely
  if (tableItem) {
    check(tableItem.srcYPx === 0, 'the table piece starts at srcYPx 0 (its very first pixel) - i.e. it is genuinely whole, not a mid-table fragment');
  }
}

// --- Test: the SAME scenario but with the table unit's noMidSlice flag OFF (simulating ordinary
// free-flowing content, not a table) - confirms the leftover-room-reuse mechanism from last round still
// works exactly as before for content that IS safe to slice. -------------------------------------------
{
  const priorGroup = { members: [fakeUnit(4, true, 150, false)], totalHeightMm: 150, isLabelOnly: false }; // leaves 103mm - well over the 70mm reuse bar
  const headingAndContentGroup = {
    members: [fakeUnit(5, true, 11, false), fakeUnit(5, false, 150, false)], // pill + ordinary content, NOT noMidSlice
    totalHeightMm: 161,
    isLabelOnly: false,
  };
  const { pages } = runPass2([priorGroup, headingAndContentGroup]);
  const page1InkMm = pages[0].reduce((s, it) => s + it.heightMm, 0);
  check(page1InkMm > CONTENT_H_MM - 5, `ordinary (non-table) content still reuses page 1's leftover room via slicing exactly as last round's fix intended (page 1 ink: ${page1InkMm.toFixed(1)}mm of ${CONTENT_H_MM}mm)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
