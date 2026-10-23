const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies "there are still large blank spaces in the pdf" + "charts should always be on the same page and not
// truncated". Found by running the real export in a real browser and reading its page layout (127 pages, 59 with
// >=25% blank before; 109 pages, 27 after the fixes below):
//  1. TABLE SPLITTING NEVER RAN. A table parsed from HTML always has one implicit <tbody> child, so (a) the
//     single-child unwrapping walked past the <table> into the <tbody>, and (b) splitTableIntoRowChunks read
//     `tableNode.children` for <tr>s and found none. Every tall table was therefore cut mid-row by the pixel-slice
//     fallback. Now unwrapping stops at the table and rows come from `table.rows`.
//  2. The "heading would be stranded" look-ahead in PASS 2 fired for ANY group, bumping a lone content block that
//     fit the page to a fresh page (e.g. 51mm used + 165mm block -> block moved, 80% blank). It now applies only to
//     small groups that actually contain a heading.
//  3. Charts (svg/canvas/img/table/grid/flex layouts) are flagged noMidSlice, and an oversized unit's slices are
//     steered away from cutting through a chart (no-cut zones).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }
const appSrc = fs.readFileSync(path.join(__PROJECT_ROOT__, 'app.js'), 'utf8');

// ---- static checks ----
check(/while \(unwrapSteps < 10 && effectiveNode\.tagName !== 'TABLE' &&/.test(appSrc), 'single-child unwrapping stops at a <table> (never walks into its implicit <tbody>)');
check(/const rows = Array\.from\(tableNode\.rows \|\| \[\]\);/.test(appSrc), 'splitTableIntoRowChunks reads rows via table.rows (works with an implicit <tbody>)');
check(/const isTablePart = \/\^\(TABLE\|TBODY\|THEAD\|TFOOT\|TR\|TD\|TH\)\$\//.test(appSrc) && /&& !isTablePart;/.test(appSrc), 'expansion never descends into a table\'s own parts');
check(/const noMidSlice = isChartLikeNode\(node\);/.test(appSrc), 'leaf units use isChartLikeNode for the never-mid-slice flag');
check(/node\.querySelector\('table, svg, canvas, img'\)/.test(appSrc) && /isSideBySideLayoutContainer\(all\[i\]\)/.test(appSrc), 'isChartLikeNode covers tables, svg/canvas/img and grid/flex layouts');
check(/const MAX_EXPAND_DEPTH = 4;/.test(appSrc), 'expansion depth cap stays at 4 (6-8 was measured to fragment the export and worsen page fill)');
check(/function measureNoCutZones\(wrapper\)/.test(appSrc) && /zones: measureNoCutZones\(w\)/.test(appSrc), 'no-cut zones are measured per capture unit');

// ---- 1. splitTableIntoRowChunks on a REAL parsed table (implicit tbody) ----
{
  const dom = new JSDOM('<!doctype html><body></body>');
  const doc = dom.window.document;
  const s = appSrc.indexOf('function splitTableIntoRowChunks(tableNode, capacityNaturalPx) {');
  const e = appSrc.indexOf('function expandIntoCaptureUnits(', s);
  const fnSrc = appSrc.slice(s, e);
  const split = new Function(fnSrc + '\nreturn splitTableIntoRowChunks;')();
  const wrap = doc.createElement('div');
  let rowsHtml = '<tr><th>H</th></tr>';
  for (let i = 0; i < 37; i++) rowsHtml += `<tr><td>r${i}</td></tr>`;
  wrap.innerHTML = `<table>${rowsHtml}</table>`;
  const table = wrap.querySelector('table');
  check(table.children.length === 1 && table.children[0].tagName === 'TBODY', 'precondition: a parsed table really has ONE child, the implicit <tbody>');
  Array.from(table.rows).forEach((r, i) => { r.getBoundingClientRect = () => ({ height: i === 0 ? 20 : 60 }); });
  const chunks = split(table, 500);
  check(chunks.length > 1, `a 37-row table is now split into several chunks (${chunks.length})`);
  const bodyRowsOut = chunks.reduce((n, c) => n + c.rows.length - 1, 0);
  check(bodyRowsOut === 37, 'every body row appears exactly once across the chunks');
  check(chunks.every(c => c.rows[0].textContent === 'H'), 'the header row is repeated at the top of every chunk');
  check(chunks.every(c => 20 + (c.rows.length - 1) * 60 <= 500), 'each chunk stays within the capacity it was given');
  const order = chunks.flatMap(c => Array.from(c.rows).slice(1).map(r => r.textContent)).join(',');
  check(order === Array.from({ length: 37 }, (_, i) => 'r' + i).join(','), 'rows keep their original order');
}

// ---- PASS 2 harness (extracted verbatim, as the other pagination tests do) ----
const CONTENT_H_MM = 253;
const startIdx = appSrc.indexOf('const pages = [];');
const endMarker = 'if (currentPage.length) pages.push(currentPage);';
const endIdx = appSrc.indexOf(endMarker, startIdx);
const pass2Src = appSrc.slice(startIdx, endIdx + endMarker.length);
const fsStart = appSrc.indexOf('function findSafeSliceCutPx(canvas, desiredCutPx, minCutPx) {');
let depth = 0, k = fsStart, fsEnd = -1;
for (; k < appSrc.length; k++) { if (appSrc[k] === '{') depth++; else if (appSrc[k] === '}') { depth--; if (depth === 0) { fsEnd = k + 1; break; } } }
const findSafeSrc = appSrc.slice(fsStart, fsEnd);
function runPass2(placementGroups) {
  const sandbox = { console, CONTENT_H_MM, placementGroups, __result: null };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${findSafeSrc}\n(function () {\n${pass2Src}\n  __result = { pages, sectionStartPage };\n})();`, sandbox, { filename: 'pass2-extract.js' });
  return sandbox.__result;
}
const PX = 10;
const fakeUnit = (sec, first, h, extra) => Object.assign({ sectionIndex: sec, isFirstOfSection: first, canvas: { height: Math.round(h * PX) }, pxPerMm: PX, heightMm: h }, extra || {});
const group = (members) => ({ members, totalHeightMm: members.reduce((s, m) => s + m.heightMm, 0), isLabelOnly: members.every(m => m.heightMm <= 18) });

// ---- 2. look-ahead applies only to small groups with a heading ----
{
  // 51mm of earlier content, then a lone 165mm block (51+165 = 216, leaving 37mm) followed by more of the same section.
  const r = runPass2([group([fakeUnit(5, true, 51)]), group([fakeUnit(5, false, 165)]), group([fakeUnit(5, false, 30)])]);
  check(r.pages[0].some(it => it.heightMm === 165), 'a lone 165mm block that fits the page stays on it (was bumped to a fresh page, ~80% blank)');
  check(r.pages.length === 1, 'everything fits on one page (51 + 165 + 30 = 246mm)');
}
{
  // A heading + short box (47mm) arriving with 150mm used would leave 56mm (<70) with the section's big content next:
  // the original look-ahead still defers it so the heading is not stranded at the page foot.
  const r = runPass2([group([fakeUnit(5, true, 150)]), group([fakeUnit(6, true, 7), fakeUnit(6, false, 40)]), group([fakeUnit(6, false, 200)])]);
  check(r.pages[0].every(it => it.sectionIndex !== 6), 'a heading + short box that would be stranded is still deferred to the next page (original rule kept)');
}
{
  // A heading attached to its OWN big content (7mm + 181mm = 188mm, i.e. over 90mm) is never "stranded": it just goes where it fits.
  const r = runPass2([group([fakeUnit(5, true, 12)]), group([fakeUnit(5, false, 7), fakeUnit(5, false, 181)]), group([fakeUnit(5, false, 20)])]);
  check(r.pages[0].some(it => it.heightMm === 181), 'a heading + its 181mm content shares the page with a 12mm tail instead of starting a new page');
}

// ---- 3. an oversized unit is never cut through a chart ----
{
  // 600mm unit (3 slices). A 100mm chart occupies 200..300mm, i.e. it straddles the natural first cut at 253mm.
  const zones = [[200 * PX, 300 * PX]];
  const r = runPass2([group([fakeUnit(1, true, 600, { zonesPx: zones })])]);
  const cuts = [];
  r.pages.forEach(pg => pg.forEach(it => { cuts.push(it.srcYPx); cuts.push(it.srcYPx + it.srcHPx); }));
  const inside = cuts.filter(c => c > zones[0][0] && c < zones[0][1]);
  check(inside.length === 0, 'no slice boundary falls inside the chart region');
  const total = r.pages.reduce((n, pg) => n + pg.reduce((m, it) => m + it.srcHPx, 0), 0);
  check(total === 600 * PX, 'every pixel of the unit is still placed exactly once (nothing lost or duplicated)');
  check(r.pages[0].reduce((m, it) => m + it.srcHPx, 0) <= 200 * PX + 1, 'the first page ends just above the chart, and the chart starts the next page');
}
{
  // Same, but the page already has 100mm used, so the first slice reuses 153mm of leftover room and the chart starts
  // right at the top of that slice window: the chart moves to a FRESH page rather than leaving a sliver.
  const zones = [[10 * PX, 140 * PX]]; // chart 10..140mm of the unit; the leftover window (153mm) cuts inside nothing, so use a straddling one
  const zones2 = [[140 * PX, 260 * PX]]; // straddles the 153mm cut, starts 140mm in (> 10% of the window)
  const r = runPass2([group([fakeUnit(1, true, 100)]), group([fakeUnit(2, true, 500, { zonesPx: zones2 })])]);
  const cuts = [];
  r.pages.forEach(pg => pg.filter(it => it.sectionIndex === 2).forEach(it => { cuts.push(it.srcYPx); cuts.push(it.srcYPx + it.srcHPx); }));
  check(cuts.filter(c => c > zones2[0][0] && c < zones2[0][1]).length === 0, 'leftover-room slice also avoids cutting through a chart');
  const tot = r.pages.reduce((n, pg) => n + pg.filter(it => it.sectionIndex === 2).reduce((m, it) => m + it.srcHPx, 0), 0);
  check(tot === 500 * PX, 'unit fully placed (leftover-room case)');
  void zones;
}
{
  // Chart taller than a page cannot be kept whole - it must still be sliced (never loop or drop content).
  const zones = [[10 * PX, 400 * PX]];
  const r = runPass2([group([fakeUnit(1, true, 500, { zonesPx: zones })])]);
  const tot = r.pages.reduce((n, pg) => n + pg.reduce((m, it) => m + it.srcHPx, 0), 0);
  check(tot === 500 * PX && r.pages.length >= 2, 'a chart taller than a page is still sliced safely and fully placed');
}

const mk = (sec, first, h, noMid) => fakeUnit(sec, first, h, noMid ? { noMidSlice: true } : {});
// ---- 4. titles travel with their chart (reported: "Ming Li title on page 6, chart on page 7 with no title") ----
{
  // earlier section (110mm), then Ming Li: heading 7 + pill 11 + intro box 52 (= 70mm), then the 163mm chart that cannot fit.
  const r = runPass2([
    group([mk(3, true, 110)]),
    group([mk(4, true, 7), mk(4, false, 11), mk(4, false, 52)]),
    group([mk(4, false, 163, true)])
  ]);
  check(r.pages.length === 2, 'two pages (chart moved)');
  check(r.pages[0].every(it => it.sectionIndex === 3), 'page 1 keeps only the earlier section - the Ming Li heading, pill and intro box moved WITH the chart');
  check(r.pages[1].length === 4 && r.pages[1][0].heightMm === 7 && r.pages[1][3].heightMm === 163, 'page 2 starts with the heading, pill and intro box, then the chart');
  check(Math.abs(r.pages[1][1].drawYMm - 7) < 1e-9 && Math.abs(r.pages[1][3].drawYMm - 70) < 1e-9, 'carried items are re-positioned from the top of the new page');
  check(r.sectionStartPage[4] === 1, 'the Table of Contents entry for the section points at the page the heading now sits on');
}
{
  // heading is out of reach (a 140mm text block sits between heading and pill): only the label directly above the chart follows.
  const r = runPass2([
    group([mk(4, true, 7)]),
    group([mk(4, false, 140)]),
    group([mk(4, false, 11)]),
    group([mk(4, false, 163, true)])
  ]);
  check(r.pages[0].map(it => it.heightMm).join(',') === '7,140', 'page 1 keeps the heading and the long text block');
  check(r.pages[1].map(it => it.heightMm).join(',') === '11,163', 'the pill label directly above the chart follows it to the next page');
  check(r.sectionStartPage[4] === 0, 'section still starts on page 1');
}
{
  // the whole page is the lead-in: no empty page may be produced
  const r = runPass2([group([mk(4, true, 7), mk(4, false, 11), mk(4, false, 52)]), group([mk(4, false, 200, true)])]);
  check(r.pages.length === 1 || r.pages.every(pg => pg.length > 0), 'no empty page is created when the entire page was the lead-in');
  check(r.pages.flat().length === 4, 'all four items are placed exactly once');
}
{
  // a non-chart group is unaffected (ordinary flow, no carrying)
  const r = runPass2([group([mk(3, true, 110)]), group([mk(4, true, 7), mk(4, false, 11), mk(4, false, 52)]), group([mk(4, false, 163)])]);
  const placedMm = r.pages.flat().reduce((m, it) => m + it.heightMm, 0);
  check(r.pages[0].some(it => it.sectionIndex === 4 && it.heightMm === 7) && Math.abs(placedMm - (110 + 70 + 163)) < 1, 'ordinary (non-chart) content keeps the existing behaviour: nothing is carried, all content placed');
}
{
  // carried lead-in + chart must fit one page; otherwise nothing is carried
  const r = runPass2([group([mk(3, true, 100)]), group([mk(4, true, 7), mk(4, false, 11), mk(4, false, 52)]), group([mk(4, false, 200, true)])]);
  check(r.pages.flat().length === 5, 'nothing lost when the lead-in plus chart would exceed a page');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
