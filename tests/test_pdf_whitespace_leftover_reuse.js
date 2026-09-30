const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies PDF-whitespace fix #2 (this round): the oversized-unit branch of PASS 2's page-packing
// loop (inside captureChunksIntoPdf) now reuses leftover room on the CURRENT page for the first slice
// of a big multi-page unit, instead of always force-flushing to a fresh page first - confirmed as a
// real, additional root cause via a real-browser probe (a short "3-Year Monthly Western Astrology
// Match" label+intro box, already correctly glued together by the earlier fix #1 this round, still left
// ~85% of its own page blank because the large table that followed always started completely fresh).
//
// This is NOT a jsdom/DOM test - PASS 2 is pure arithmetic over already-captured {heightMm, canvas,
// pxPerMm} unit descriptors, so this test extracts the REAL PASS-2 source text directly out of app.js
// (the same block, verbatim) and drives it with synthetic placementGroups/units - real code under test,
// fabricated geometry standing in for html2canvas output (which only a real browser can produce - see
// pdf_whitespace_probe.js for that side of verification).
const fs = require('fs');
const path = require('path');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static regression guards: the key structural pieces of the fix are present ---
// NOTE: MIN_FIRST_SLICE_MM was raised from 15mm to 70mm this round (reported directly: "page 4, ming li
// should go on next page for better read... Readability should be prioritized over blank spaces" - 15mm
// let a first slice reuse leftover room even when that room was too small to show anything genuinely
// readable). The behavioral scenarios below use leftover amounts (213mm reused, 8mm not reused) that are
// unaffected either way - they stay valid regression coverage of the mechanism itself, independent of
// exactly where the threshold sits.
check(/const MIN_FIRST_SLICE_MM = 70;/.test(appSrc), 'MIN_FIRST_SLICE_MM threshold constant exists');
check(/const leftoverRoomMm = CONTENT_H_MM - currentUsedMm;/.test(appSrc), 'leftoverRoomMm is computed from remaining page room');
check(/const useLeftoverRoom = currentUsedMm > 0 && leftoverRoomMm >= MIN_FIRST_SLICE_MM;/.test(appSrc), 'useLeftoverRoom gate exists and requires both existing content and enough room');
check(/if \(currentUsedMm > 0 && !useLeftoverRoom\) \{ pages\.push\(currentPage\); currentPage = \[\]; currentUsedMm = 0; \}/.test(appSrc), 'the force-flush before an oversized unit is now CONDITIONAL on NOT reusing leftover room (previously unconditional)');
check(/const firstSliceCapPx = useLeftoverRoom \? Math\.floor\(leftoverRoomMm \* u\.pxPerMm\) : sliceCapPx;/.test(appSrc), 'the first slice is capped to the actual leftover room when reusing it');
check(/drawYMm: currentUsedMm, heightMm: sliceHMm, pxPerMm: u\.pxPerMm, sectionIndex: u\.sectionIndex \}\);\s*\n\s*srcYPx \+= sliceHPx; remainingPx -= sliceHPx;/.test(appSrc), 'every pixel slice draws at drawYMm=currentUsedMm (not hardcoded 0), so a reused-leftover slice draws below existing page content');
check(/currentUsedMm \+= sliceHMm;/.test(appSrc), 'currentUsedMm accumulates (not overwrites) after the final slice, so a reused-leftover first-and-last slice adds onto existing content instead of discarding it');

// --- Behavioral: extract the REAL PASS-2 code verbatim and drive it with synthetic units ---
// UPDATED (Task #78): PASS 2's forEach now takes a second (groupIdx) parameter - unrelated to this
// test's own leftover-room-reuse behavior, which is untouched by that change.
const startMarker = '  const pages = [];\n  let currentPage = [], currentUsedMm = 0;\n  const sectionStartPage = [];\n  placementGroups.forEach((group, groupIdx) => {';
const endMarker = '  if (currentPage.length) pages.push(currentPage);';
const startIdx = appSrc.indexOf(startMarker);
const endIdx = appSrc.indexOf(endMarker, startIdx);
check(startIdx !== -1, 'PASS 2 start marker found in app.js (source layout unchanged)');
check(endIdx !== -1 && endIdx > startIdx, 'PASS 2 end marker found after start marker');

if (startIdx !== -1 && endIdx !== -1) {
  const pass2Code = appSrc.slice(startIdx, endIdx + endMarker.length);
  // UPDATED (later round, "truncation between words" fix): PASS 2 now calls findSafeSliceCutPx before
  // committing to a computed slice height (see test_pdf_safe_slice_cut.js for its own dedicated
  // coverage). Extracted verbatim and passed in as a parameter - every fake unit in this file uses a
  // plain { height: N } canvas with no getContext, so findSafeSliceCutPx's own guard clause
  // (`typeof canvas.getContext !== 'function'`) makes it a no-op here, preserving every assertion below.
  const findSafeSliceCutPxStart = appSrc.indexOf('function findSafeSliceCutPx(canvas, desiredCutPx, minCutPx) {');
  let findSafeSliceCutPxSrc = '';
  if (findSafeSliceCutPxStart !== -1) {
    let depth = 0, idx2 = findSafeSliceCutPxStart, endIdx2 = -1;
    for (; idx2 < appSrc.length; idx2++) {
      if (appSrc[idx2] === '{') depth++;
      else if (appSrc[idx2] === '}') { depth--; if (depth === 0) { endIdx2 = idx2 + 1; break; } }
    }
    if (endIdx2 !== -1) findSafeSliceCutPxSrc = appSrc.slice(findSafeSliceCutPxStart, endIdx2);
  }
  check(!!findSafeSliceCutPxSrc, 'findSafeSliceCutPx source located and extracted for use by PASS 2 below');
  const findSafeSliceCutPx = new Function('canvas', 'desiredCutPx', 'minCutPx', findSafeSliceCutPxSrc + '\nreturn findSafeSliceCutPx(canvas, desiredCutPx, minCutPx);');
  const runPass2 = new Function('placementGroups', 'CONTENT_H_MM', 'findSafeSliceCutPx', pass2Code + '\nreturn { pages, sectionStartPage };');
  const runPass2Wrapped = (pg, chm) => runPass2(pg, chm, findSafeSliceCutPx);

  // Scenario: a small "fits" group (40mm) is placed first, leaving 213mm of leftover room on a 253mm
  // page. It's immediately followed by one oversized unit whose real height (400mm) needs slicing.
  // Old behavior (pre-fix): would force-flush the 213mm leftover immediately, then slice the 400mm unit
  // into a 253mm page + a 147mm page (2 slices, first slice wasting nothing of ITS OWN page, but
  // stranding the prior 213mm as pure blank space - the exact bug reported and confirmed via the real
  // export). New (fixed) behavior: the first slice should be capped to the 213mm leftover exactly,
  // filling page 1 to precisely 253mm (40 + 213) with zero waste, then a second, final slice carries the
  // remaining 187mm onto a fresh page.
  const CONTENT_H_MM = 253;
  const PX_PER_MM = 10; // simple round-number scale so heights translate cleanly for the assertions below
  const smallUnit = { canvas: { height: 400 }, pxPerMm: PX_PER_MM, heightMm: 40, isFirstOfSection: true, sectionIndex: 0 };
  const oversizedUnit = { canvas: { height: 4000 }, pxPerMm: PX_PER_MM, heightMm: 400, isFirstOfSection: true, sectionIndex: 1 };
  const placementGroups = [
    { members: [smallUnit], totalHeightMm: 40 },
    { members: [oversizedUnit], totalHeightMm: 400 },
  ];

  const { pages } = runPass2Wrapped(placementGroups, CONTENT_H_MM);

  check(pages.length === 2, `exactly 2 pages produced for a 40mm + 400mm sequence on a 253mm page (got ${pages.length})`);
  if (pages.length === 2) {
    const [page1, page2] = pages;
    check(page1.length === 2, `page 1 holds both the small unit AND the oversized unit's first slice, packed together (got ${page1.length} item(s))`);
    if (page1.length === 2) {
      const [item1, item2] = page1;
      check(item1.drawYMm === 0 && item1.heightMm === 40, `page 1's first item (the small unit) draws at y=0, height=40mm (got y=${item1.drawYMm}, h=${item1.heightMm})`);
      check(item2.drawYMm === 40, `page 1's second item (the oversized unit's first slice) draws starting at y=40mm - i.e. BELOW the small unit, reusing the leftover room instead of overlapping or restarting at y=0 (got y=${item2.drawYMm})`);
      check(Math.abs(item2.heightMm - 213) < 0.01, `the first slice is capped to exactly the 213mm of leftover room, not a full 253mm page (got ${item2.heightMm}mm)`);
      const page1TotalMm = item1.heightMm + item2.heightMm;
      check(Math.abs(page1TotalMm - 253) < 0.01, `page 1 is packed to exactly 253mm (the full page) with zero wasted leftover space (got ${page1TotalMm}mm)`);
    }
    check(page2.length === 1, `page 2 holds only the oversized unit's final slice (got ${page2.length} item(s))`);
    if (page2.length === 1) {
      const finalItem = page2[0];
      check(finalItem.drawYMm === 0, `page 2's slice draws at y=0 on its own fresh page (got y=${finalItem.drawYMm})`);
      check(Math.abs(finalItem.heightMm - 187) < 0.01, `page 2's slice carries the remaining 187mm (400 - 213) of the oversized unit (got ${finalItem.heightMm}mm)`);
    }
  }

  // Negative-control scenario: when the current page is EMPTY (currentUsedMm === 0, e.g. the very first
  // group in the document is itself oversized), there's no leftover room to reuse - the first slice
  // should behave exactly as before: a full 253mm slice starting at y=0. This confirms the fix only ever
  // helps a genuinely non-empty page, and never changes behavior for the ordinary "no leftover" case.
  const { pages: pagesNoLeftover } = runPass2Wrapped([{ members: [oversizedUnit], totalHeightMm: 400 }], CONTENT_H_MM);
  check(pagesNoLeftover.length === 2, `no-leftover control: still exactly 2 pages for a lone 400mm unit on a 253mm page (got ${pagesNoLeftover.length})`);
  if (pagesNoLeftover.length === 2) {
    check(pagesNoLeftover[0].length === 1 && pagesNoLeftover[0][0].drawYMm === 0 && Math.abs(pagesNoLeftover[0][0].heightMm - 253) < 0.01,
      `no-leftover control: first slice fills a full fresh 253mm page starting at y=0 when there was nothing to reuse (got ${JSON.stringify(pagesNoLeftover[0])})`);
    check(pagesNoLeftover[1].length === 1 && Math.abs(pagesNoLeftover[1][0].heightMm - 147) < 0.01,
      `no-leftover control: second slice carries the remaining 147mm (400 - 253) (got ${pagesNoLeftover[1][0].heightMm}mm)`);
  }

  // Sliver control: when leftover room is real but below MIN_FIRST_SLICE_MM (15mm), the fix should NOT
  // try to squeeze in a sliver - it should force-flush exactly like the old behavior, since a one-line
  // fragment above a page break reads worse than a clean break (this is the guard the code comments
  // describe; confirms the threshold is actually wired in, not just present as an unused constant).
  const tinyLeftoverUnit = { canvas: { height: 4000 }, pxPerMm: PX_PER_MM, heightMm: 400, isFirstOfSection: true, sectionIndex: 1 };
  const almostFullUnit = { canvas: { height: 2450 }, pxPerMm: PX_PER_MM, heightMm: 245, isFirstOfSection: true, sectionIndex: 0 }; // leaves 253-245=8mm leftover (< 15mm)
  const { pages: pagesSliver } = runPass2Wrapped([
    { members: [almostFullUnit], totalHeightMm: 245 },
    { members: [tinyLeftoverUnit], totalHeightMm: 400 },
  ], CONTENT_H_MM);
  // 3 pages expected: page 1 = the almost-full unit alone (245mm); page 2 = the oversized unit's first,
  // full-page slice (253mm, force-flushed rather than squeezed into the 8mm sliver); page 3 = its final,
  // remaining slice (400 - 253 = 147mm).
  check(pagesSliver.length === 3, `sliver control: exactly 3 pages - the almost-full page, then a fresh full-page first slice, then the remainder (got ${pagesSliver.length})`);
  if (pagesSliver.length === 3) {
    check(pagesSliver[0].length === 1 && Math.abs(pagesSliver[0][0].heightMm - 245) < 0.01,
      `sliver control: page 1 holds only the almost-full unit, NOT a squeezed-in sliver of the next oversized unit (got ${pagesSliver[0].length} item(s))`);
    check(pagesSliver[1].length === 1 && pagesSliver[1][0].drawYMm === 0 && Math.abs(pagesSliver[1][0].heightMm - 253) < 0.01,
      `sliver control: the oversized unit's first slice force-flushes to a fresh, full 253mm page rather than reusing an 8mm sliver (got ${JSON.stringify(pagesSliver[1] && pagesSliver[1][0])})`);
    check(pagesSliver[2].length === 1 && Math.abs(pagesSliver[2][0].heightMm - 147) < 0.01,
      `sliver control: page 3 carries the remaining 147mm (400 - 253) (got ${pagesSliver[2] && pagesSliver[2][0] && pagesSliver[2][0].heightMm}mm)`);
  }

  // NEW: mid-range control - 40mm leftover is real and would have cleared the OLD 15mm bar, but should
  // now be rejected by the raised 70mm bar (reported directly: a first slice squeezed into a small
  // leftover room read as an unreadable sliver with the rest pushed to the next page anyway - exactly
  // this size of gap). Confirms the fix actually changes behavior for the reported case, not just the
  // constant's literal value.
  const midUnit = { canvas: { height: 4000 }, pxPerMm: PX_PER_MM, heightMm: 400, isFirstOfSection: true, sectionIndex: 1 };
  const leaves40mmUnit = { canvas: { height: 2130 }, pxPerMm: PX_PER_MM, heightMm: 213, isFirstOfSection: true, sectionIndex: 0 }; // leaves 253-213=40mm (>15mm old bar, <70mm new bar)
  const { pages: pagesMidGap } = runPass2Wrapped([
    { members: [leaves40mmUnit], totalHeightMm: 213 },
    { members: [midUnit], totalHeightMm: 400 },
  ], CONTENT_H_MM);
  check(pagesMidGap.length === 3, `mid-range control: a 40mm leftover (below the new 70mm bar) now force-flushes to a fresh page instead of squeezing in a thin first slice - expected 3 pages (got ${pagesMidGap.length})`);
  if (pagesMidGap.length === 3) {
    check(pagesMidGap[0].length === 1 && Math.abs(pagesMidGap[0][0].heightMm - 213) < 0.01,
      `mid-range control: page 1 holds only the 213mm unit, no squeezed-in sliver of the next oversized unit`);
    check(pagesMidGap[1].length === 1 && pagesMidGap[1][0].drawYMm === 0 && Math.abs(pagesMidGap[1][0].heightMm - 253) < 0.01,
      `mid-range control: the oversized unit's first slice force-flushes to a fresh, full page rather than reusing the 40mm sliver (got ${JSON.stringify(pagesMidGap[1] && pagesMidGap[1][0])})`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
