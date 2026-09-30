const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Task #78 (reported directly against a real export: "for example, Ming Li on page 7 should
// go to next page, Cheng Gu Suan Ming on page 9 should go on the next page, etc. All these are to
// improve readability and section breaks. In such scenarios, white space is ok"): a short
// heading/intro group whose real content (same section) is too tall to ever share a page with it must
// still be kept directly attached to that content - PASS 1 now absorbs the real content into the
// label's group regardless of combined height, and PASS 2's oversized/slice branch now renders any
// label members first (in full) before pixel-slicing the final (real content) member, so the label
// always sits immediately above the start of its content's first slice instead of being stranded on
// an earlier, unrelated page.
//
// This test extracts the REAL PASS 1 (placementGroups construction) and PASS 2 (both the "fits" and
// the oversized/slice branches) source directly out of app.js and runs it against hand-built synthetic
// units - so it exercises the actual shipped algorithm, not a reimplementation of it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static: the relaxed PASS 1 absorption and the multi-member oversized branch genuinely exist ---
check(/while \(members\[members\.length - 1\]\.heightMm <= LABEL_ORPHAN_MAX_MM\) \{/.test(appSrc), 'PASS 1 chain-building loop exists');
check(/members\.push\(next\);\s*\n\s*totalHeightMm = combined;\s*\n\s*idx \+= 1;\s*\n\s*\/\/ FOLLOW-UP FIX \(Task #78/.test(appSrc), 'PASS 1 now pushes `next` into the group BEFORE checking whether combined height exceeds a page (absorbs real content regardless)');
check(/const labelMembers = group\.members\.slice\(0, -1\);/.test(appSrc), 'the oversized branch now separates label members from the final (sliceable) member');
check(/const u = group\.members\[group\.members\.length - 1\];/.test(appSrc), 'the oversized branch slices the LAST member, not always members[0]');
check(/const wouldStrandLabels = currentUsedMm > 0 && roomAfterLabelsMm >= 0 && roomAfterLabelsMm < MIN_FIRST_SLICE_MM;/.test(appSrc), 'the label chain is deferred to a fresh page not just when it doesn\'t fit, but also when placing it would leave too little room for its content\'s first slice (the actual orphaning case)');
check(/if \(labelsDontFitAtAll \|\| wouldStrandLabels\)/.test(appSrc), 'both flush conditions (labels don\'t fit at all, or would strand themselves) are checked before placing the label chain');

// --- Extract the real PASS 1 + PASS 2 (both branches) source verbatim ---
const pass1Start = appSrc.indexOf('const LABEL_ORPHAN_MAX_MM = 18;');
const pass1End = appSrc.indexOf('\n\n  // PASS 2:', pass1Start);
const pass1Src = appSrc.slice(pass1Start, pass1End);
if (!pass1Src || pass1End === -1) { console.error('FAIL: could not locate PASS 1 source block'); process.exit(1); }

const pass2Start = appSrc.indexOf('placementGroups.forEach((group, groupIdx) => {');
const pass2End = appSrc.indexOf('\n  if (currentPage.length) pages.push(currentPage);', pass2Start);
const pass2Src = appSrc.slice(pass2Start, pass2End);
if (pass2Start === -1 || pass2End === -1) { console.error('FAIL: could not locate PASS 2 source block'); process.exit(1); }

// UPDATED (later round, "truncation between words" fix): PASS 2 now calls findSafeSliceCutPx before
// committing to a computed slice height (see test_pdf_safe_slice_cut.js for its own dedicated
// coverage). Extracted verbatim here too so PASS 2 has it available in scope - the fake units below use
// plain { height: N } canvases with no getContext, so findSafeSliceCutPx's own guard clause
// (`typeof canvas.getContext !== 'function'`) makes it a no-op here, preserving every existing
// assertion in this file unchanged.
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

function runScenario(unitsIn, contentHMm) {
  const units = unitsIn.map(u => ({ ...u, canvas: { height: Math.round(u.heightMm * 10) }, pxPerMm: 10 }));
  const sandbox = { console };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`
    ${findSafeSliceCutPxSrc}
    const units = ${JSON.stringify(units)};
    const CONTENT_H_MM = ${contentHMm};
    ${pass1Src}
    const pages = [];
    let currentPage = [], currentUsedMm = 0;
    const sectionStartPage = [];
    ${pass2Src}
    if (currentPage.length) pages.push(currentPage);
    ({ placementGroups, pages });
  `, sandbox, { filename: 'pdf-pagination-extract.js' });
  return vm.runInContext('({ placementGroups, pages })', sandbox);
}

// --- Scenario matching the reported bug: Section A fills most of a page, then Section B's heading
// (short) plus a tiny intro box (also short) are immediately followed by real content (e.g. the BaZi
// 4-pillar grid) so tall that heading+tinybox+content together exceed a full page.
{
  const CONTENT_H_MM = 267;
  const units = [
    { sectionIndex: 0, isFirstOfSection: true, heightMm: 240 },  // Section A - almost fills a page
    { sectionIndex: 1, isFirstOfSection: true, heightMm: 10 },   // "Ming Li" heading - short
    { sectionIndex: 1, isFirstOfSection: false, heightMm: 6 },   // a tiny intro box - also short
    { sectionIndex: 1, isFirstOfSection: false, heightMm: 260 }, // the real BaZi 4-pillar content - so tall that heading+tinybox+content (276mm) exceeds CONTENT_H_MM (267mm)
  ];
  const { placementGroups, pages } = runScenario(units, CONTENT_H_MM);

  check(placementGroups.length === 2, `PASS 1 produces 2 groups: Section A, and ONE group carrying the heading+tinybox+content together (not split into 3) - got ${placementGroups.length}`);
  check(placementGroups[1].members.length === 3, 'the heading, tinybox, AND real content all belong to the same placement group');
  check(placementGroups[1].totalHeightMm === 276, 'the group\'s total height is the sum of all 3 members, even though it exceeds one page');

  // The heading and the FIRST slice of its content must land on the SAME page, directly adjacent -
  // never with a blank gap followed by the content starting on a later page.
  const headingPageIdx = pages.findIndex(p => p.some(item => item.sectionIndex === 1 && item.heightMm === 10));
  const firstContentSliceIdx = pages.findIndex(p => p.some(item => item.sectionIndex === 1 && item.srcYPx === 0 && item.heightMm !== 10 && item.heightMm !== 6));
  check(headingPageIdx !== -1, 'the heading was placed on some page');
  check(firstContentSliceIdx !== -1, 'the content\'s first slice was placed on some page');
  check(headingPageIdx === firstContentSliceIdx, `BUG FIX VERIFIED: the "Ming Li" heading and the FIRST slice of its BaZi content land on the SAME page (heading page ${headingPageIdx}, content's first slice page ${firstContentSliceIdx}) - previously the heading was stranded alone with a large blank gap while the content started fresh on a later page`);
  check(headingPageIdx === 1, 'the heading+content are deferred together onto the second page (not sharing Section A\'s page), leaving Section A\'s own page with a blank tail instead - exactly what was asked for ("white space is ok")');

  // The content, being taller than one page even after the label, must continue via additional slices
  // on subsequent pages (never truncated or silently dropped).
  const totalSlicedContentMm = pages.flat().filter(item => item.sectionIndex === 1 && item.heightMm !== 10 && item.heightMm !== 6).reduce((s, item) => s + item.heightMm, 0);
  check(Math.abs(totalSlicedContentMm - 260) < 0.5, `the real content's full height (260mm) is preserved in full across its slices, nothing dropped - got ${totalSlicedContentMm.toFixed(2)}mm`);
}

// --- Scenario confirming NO regression: a lone oversized unit with NO preceding label (the original,
// pre-Task-#78 case) is still sliced exactly as before. ---
{
  const CONTENT_H_MM = 267;
  const units = [
    { sectionIndex: 0, isFirstOfSection: true, heightMm: 500 }, // one big unit alone, no label before it
  ];
  const { placementGroups, pages } = runScenario(units, CONTENT_H_MM);
  check(placementGroups.length === 1 && placementGroups[0].members.length === 1, 'a lone oversized unit with no label still forms its own single-member group');
  const totalMm = pages.flat().reduce((s, item) => s + item.heightMm, 0);
  check(Math.abs(totalMm - 500) < 0.5, `no regression: a lone oversized unit's full height is still preserved across its slices - got ${totalMm.toFixed(2)}mm`);
}

// --- Scenario confirming NO regression: an ordinary short label group whose content DOES fit
// together on one page is still placed as a single atomic "fits" group, unsliced. ---
{
  const CONTENT_H_MM = 267;
  const units = [
    { sectionIndex: 0, isFirstOfSection: true, heightMm: 100 },
    { sectionIndex: 1, isFirstOfSection: true, heightMm: 10 },
    { sectionIndex: 1, isFirstOfSection: false, heightMm: 100 }, // comfortably fits with the heading on one page
  ];
  const { placementGroups, pages } = runScenario(units, CONTENT_H_MM);
  check(placementGroups.length === 2 && placementGroups[1].members.length === 2 && placementGroups[1].totalHeightMm === 110, 'no regression: an ordinary label+content pair that fits one page together is still merged into one atomic (unsliced) group');
  const slicedAny = pages.flat().some(item => item.sectionIndex === 1 && item.srcYPx > 0);
  check(!slicedAny, 'no regression: content that fits on one page with its label is never sliced');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
