const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Extracted-source logic test for Task 4 (Grouped PDF TOC), following this project's established
// fallback methodology when a real-browser round-trip isn't available (cdnjs.cloudflare.com is
// blocked in this sandbox's network egress, confirmed again by test_toc_grouping_probe.js - html2pdf
// never loads, so a genuine jsPDF-rendered PDF can't be produced here). Instead of pattern-matching
// source text, this pulls the ACTUAL categorization/grouping block out of app.js by source position
// and executes it for real against representative sample title data, verifying the exact behavior a
// real export would exhibit: category assignment, header-line ordering, indentation flag, entry
// count preservation, and the "only group when >1 category is non-empty" rule.
const fs = require('fs');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// Pull out the exact grouping block as written in app.js (from "const TOC_CATEGORIES" through the
// tocPageCount recomputation), and eval it inside a harness function that supplies a `bt` stub and a
// `tocEntries` array, then returns { tocLines, useGrouping } for inspection - so this test runs the
// REAL algorithm, not a re-implementation of it.
const startMarker = 'const TOC_CATEGORIES = [';
const endMarker = 'const tocPageCount = Math.max(1, Math.ceil(tocLines.length / TOC_ENTRIES_PER_PAGE));';
const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error('FAIL: could not locate the TOC grouping block in app.js by its markers - source may have moved.');
  process.exit(1);
}
const block = src.slice(startIdx, endIdx);

function runGrouping(tocEntries, btImpl) {
  const bt = btImpl || ((en) => en);
  const fn = new Function('tocEntries', 'bt', `
    ${block}
    return { tocLines, useGrouping, nonEmptyGroups: nonEmptyGroups.map(g => g.cat.key) };
  `);
  return fn(tocEntries, bt);
}

// --- Scenario A: a rich, multi-category report (mirrors a real full profile export) ---
const richEntries = [
  { title: 'Chinese Zodiac (生肖)', sourceIndex: 0 },
  { title: 'BaZi (八字) Four Pillars', sourceIndex: 1 },
  { title: 'Zi Wei Dou Shu', sourceIndex: 2 },
  { title: 'Da Yun (大运) Major Luck Cycles', sourceIndex: 3 },
  { title: '3-Year Monthly Da Yun Forecast', sourceIndex: 4 },
  { title: 'Personal Assets (个人资产)', sourceIndex: 5 },
  { title: 'Feng Shui (风水) Ba Zhai', sourceIndex: 6 },
  { title: 'Flying Star (飞星) Property', sourceIndex: 7 },
  { title: 'Life Partner Compatibility', sourceIndex: 8 },
  { title: 'Household Occupants (家庭住户)', sourceIndex: 9 },
  { title: 'Numerology', sourceIndex: 10 },
  { title: 'Western Astrology', sourceIndex: 11 },
];
const resultA = runGrouping(richEntries);
check(resultA.useGrouping === true, 'Scenario A (rich, multi-category report): grouping activates');
check(resultA.nonEmptyGroups.length >= 3, `Scenario A: at least 3 distinct categories populated (found ${resultA.nonEmptyGroups.length}: ${resultA.nonEmptyGroups.join(',')})`);
// Category order should follow TOC_CATEGORIES declaration order: compat, timing, fengshui, core
const catOrderInLines = resultA.tocLines.filter(l => l.type === 'category').map(l => l.label);
check(catOrderInLines.length === resultA.nonEmptyGroups.length, 'Scenario A: exactly one header line per non-empty category');
const totalEntryLines = resultA.tocLines.filter(l => l.type === 'entry').length;
check(totalEntryLines === richEntries.length, `Scenario A: every original entry survives grouping (expected ${richEntries.length}, got ${totalEntryLines})`);
// Every entry's sourceIndex must still be traceable (grouping never invents or drops a sourceIndex)
const survivingIndices = resultA.tocLines.filter(l => l.type === 'entry').map(l => l.sourceIndex).sort((a,b) => a-b);
check(JSON.stringify(survivingIndices) === JSON.stringify(richEntries.map(e => e.sourceIndex).sort((a,b) => a-b)), 'Scenario A: sourceIndex values preserved exactly, none dropped or duplicated');
// Compatibility entries should be grouped together, not scattered
const compatCategoryPos = resultA.tocLines.findIndex(l => l.type === 'category' && /Compatibility/.test(l.label));
if (compatCategoryPos !== -1) {
  const nextCategoryPos = resultA.tocLines.findIndex((l, i) => i > compatCategoryPos && l.type === 'category');
  const sliceEnd = nextCategoryPos === -1 ? resultA.tocLines.length : nextCategoryPos;
  const compatSlice = resultA.tocLines.slice(compatCategoryPos + 1, sliceEnd);
  const hasCompatTitle = compatSlice.some(l => /Compatibility/.test(l.title));
  const hasOccupantsTitle = compatSlice.some(l => /Household Occupants/.test(l.title));
  check(hasCompatTitle && hasOccupantsTitle, 'Scenario A: "Life Partner Compatibility" and "Household Occupants" both land under the same Compatibility category, contiguously');
}

// --- Scenario B: a minimal report where everything falls into one bucket (Core Charts only) ---
const simpleEntries = [
  { title: 'Chinese Zodiac (生肖)', sourceIndex: 0 },
  { title: 'BaZi (八字) Four Pillars', sourceIndex: 1 },
  { title: 'Zi Wei Dou Shu', sourceIndex: 2 },
];
const resultB = runGrouping(simpleEntries);
check(resultB.useGrouping === false, 'Scenario B (single-category report): grouping does NOT activate (no noise added)');
check(resultB.tocLines.every(l => l.type === 'entry'), 'Scenario B: tocLines contains ONLY entry lines, no category headers');
check(resultB.tocLines.length === simpleEntries.length, 'Scenario B: flat fallback produces exactly one line per entry (byte-for-byte equivalent to the old ungrouped behavior)');
check(resultB.tocLines.map(l => l.title).join('|') === simpleEntries.map(e => e.title).join('|'), 'Scenario B: entry order exactly preserved in the ungrouped fallback');

// --- Scenario C: empty tocEntries (degenerate edge case - should not throw) ---
let scenarioCThrew = false;
let resultC;
try { resultC = runGrouping([]); } catch (e) { scenarioCThrew = true; }
check(!scenarioCThrew, 'Scenario C: empty tocEntries array does not throw');
if (!scenarioCThrew) {
  check(resultC.useGrouping === false, 'Scenario C: empty input never activates grouping');
  check(resultC.tocLines.length === 0, 'Scenario C: empty input produces zero TOC lines');
}

// --- Scenario D: exactly two categories populated (boundary of the >1 rule) ---
const twoCatEntries = [
  { title: 'BaZi (八字) Four Pillars', sourceIndex: 0 }, // core
  { title: 'Feng Shui (风水) Ba Zhai', sourceIndex: 1 }, // fengshui
];
const resultD = runGrouping(twoCatEntries);
check(resultD.useGrouping === true, 'Scenario D: exactly 2 non-empty categories still activates grouping (boundary is ">1", i.e. >=2)');
check(resultD.tocLines.filter(l => l.type === 'category').length === 2, 'Scenario D: exactly 2 category header lines emitted');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
