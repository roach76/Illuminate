const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the native PDF writer's section order/set now exactly matches the 18-item sequence Roy
// specified, and that Da Yun is no longer duplicated inside Ming Li (it's its own section, #11).
const fs = require('fs');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const fnStart = src.indexOf('function buildNativeProfileSections(prefix)');
const fnEnd = src.indexOf('\nasync function exportProfileToPdf', fnStart);
const fnBody = src.slice(fnStart, fnEnd);
check(fnStart !== -1 && fnEnd > fnStart, 'buildNativeProfileSections located');

// Extract every `title: bt('...'` in push order.
// Only match the section-level `sections.push({ title: bt('...') ...` calls - NOT the many nested
// `generateDeepAnalysisData(..., { title: bt('...') }, true)` calls inside each section's own render
// body, which share the same `title: bt('...'` text shape.
const titleMatches = [...fnBody.matchAll(/sections\.push\(\{\s*title: bt\('([^']+)'/g)].map(m => m[1]);
const expectedOrder = [
  'Summary Information',
  'Comparison Details',
  'Detailed Reading',
  'Ming Li (Destiny Analysis)',
  'Personal Assets',
  'Zodiac',
  'Name Analysis',
  'Health Diagnosis',
  'I Ching',
  'Xiang Shu',
  'Da Yun',
  'San Shi',
  'Ze Ri',
  'Zi Wei Dou Shu',
  'Hourly Highlights',
  'Feng Shui',
  'Numerology',
  'Western Astrology',
];
check(titleMatches.length === expectedOrder.length, `expected ${expectedOrder.length} sections, found ${titleMatches.length}: ${titleMatches.join(' | ')}`);
expectedOrder.forEach((t, i) => check(titleMatches[i] === t, `section #${i+1} should be "${t}", found "${titleMatches[i]}"`));

// Comparison Details must be gated on prefix === 'i'.
check(/if \(prefix === 'i'\) \{\s*sections\.push\(\{\s*title: bt\('Comparison Details'/.test(fnBody), 'Comparison Details gated on prefix === \'i\'');

// Da Yun must NOT still be nested inside the Ming Li section's render function (no duplication) -
// check that the Ming Li section's own render body (between its push and the very next section push)
// contains no addTable call for Da Yun / dayun_ deep analysis.
const mingLiStart = fnBody.indexOf("title: bt('Ming Li (Destiny Analysis)'");
const personalAssetsStart = fnBody.indexOf("title: bt('Personal Assets'");
const mingLiBody = fnBody.slice(mingLiStart, personalAssetsStart);
check(!mingLiBody.includes('dayun_'), 'Ming Li section no longer builds per-cycle Da Yun deep analysis blocks (moved to its own section)');
check(!/Da Yun \(Major Luck Cycles\)/.test(mingLiBody), 'Ming Li section no longer has its own "Da Yun (Major Luck Cycles)" sub-header');

// Da Yun standalone section must contain the cycle table + per-cycle deep analysis (the logic that
// used to live inside Ming Li).
const dayunStart = fnBody.indexOf("title: bt('Da Yun'");
const sanShiStart = fnBody.indexOf("title: bt('San Shi'");
const dayunBody = fnBody.slice(dayunStart, sanShiStart);
check(dayunBody.includes('cyclesFromNow'), 'standalone Da Yun section computes cyclesFromNow');
check(dayunBody.includes("dayun_${dy.age}"), 'standalone Da Yun section builds per-cycle deep analysis blocks');

// Sections using the generic chart-HTML-extraction adapter (no dedicated rawOnly data path yet).
['Personal Assets', 'Health Diagnosis', 'Xiang Shu', 'San Shi', 'Ze Ri', 'Zi Wei Dou Shu', 'Feng Shui'].forEach(name => {
  const idx = fnBody.indexOf(`title: bt('${name}'`);
  check(idx !== -1, `${name} section present`);
  const nextPushIdx = fnBody.indexOf('sections.push', idx + 10);
  const body = fnBody.slice(idx, nextPushIdx === -1 ? fnBody.length : nextPushIdx);
  check(body.includes('addChartSection(w,'), `${name} section uses addChartSection (reuses live chart HTML)`);
});

// Hourly Highlights must NOT use the chart-HTML adapter (it's built natively from pure data instead).
const hourlyStart = fnBody.indexOf("title: bt('Hourly Highlights'");
const fengShuiStart = fnBody.indexOf("title: bt('Feng Shui'");
const hourlyBody = fnBody.slice(hourlyStart, fengShuiStart);
check(hourlyBody.includes('computeHourlyHighlights(p, 0)'), 'Hourly Highlights built from computeHourlyHighlights pure-data function');
check(!hourlyBody.includes('addChartSection'), 'Hourly Highlights does NOT use the HTML-scraping adapter (avoids the interactive Today/Tomorrow toggle)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
