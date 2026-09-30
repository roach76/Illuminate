const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's enhancement (requested directly): "go deeper for the western astrology
// section... chart out all planets into a natal chart and provide a natal reading" (characteristics,
// suitable career, suitable career industry, direct luck, indirect luck, health, relationships,
// children), plus a real "Annual Deep Reading" (current year + next 2, 5-tier scale) and a real
// "Monthly Deep Reading" (current year + next year = 24 months, same 5-tier scale), both driven by
// real planetary transits against the FULL natal chart - see engine-metaphysics.js
// (computeFullNatalChart / computeNatalAspectGrid / computeAnnualDeepReading /
// computeMonthlyDeepReading / SIGN_PROFILE_TABLE / WESTERN_5TIER_LABELS) and app.js
// (generateNatalFullChartHTML / generateAnnualDeepReadingHTML / generateMonthlyDeepReadingHTML plus
// the astro_natal_full / astro_annual_deep / astro_monthly_deep deep-analysis branches).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const sandbox = {
  console, navigator: { language: 'en-US' },
  document: dom.window.document, window: dom.window,
  alert: () => {}, requestAnimationFrame: (fn) => setTimeout(fn, 0),
};
sandbox.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
sandbox.global = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }

// --- LOAD-ORDER CHECK: engine-metaphysics.js must not throw even before app.js (and its bt()) has
// loaded - this was a real bug caught and fixed this round (SIGN_PROFILE_TABLE/luck-template tables
// originally called bt() eagerly at module-load time). ---
let loadOrderThrew = null;
try { load('engine-core.js'); load('engine-metaphysics.js'); } catch (e) { loadOrderThrew = e; }
check(!loadOrderThrew, `engine-metaphysics.js loads cleanly BEFORE app.js/bt() exist (real load order per index.html)${loadOrderThrew ? ': ' + loadOrderThrew.message : ''}`);

load('engine-predictions.js');
try { load('app.js'); } catch (e) { /* stray DOMContentLoaded wiring in a bare jsdom doc - unrelated */ }

const engineSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static regression guards ---
check(/function computeFullNatalChart\(birthMomentUTC\)/.test(engineSrc), 'computeFullNatalChart() exists');
check(/function computeNatalAspectGrid\(natalChart\)/.test(engineSrc), 'computeNatalAspectGrid() exists');
check(/function computeAnnualDeepReading\(p, yearsCount\)/.test(engineSrc), 'computeAnnualDeepReading() exists');
check(/function computeMonthlyDeepReading\(p, monthsCount\)/.test(engineSrc), 'computeMonthlyDeepReading() exists');
check(/const WESTERN_5TIER_LABELS = \[/.test(engineSrc), 'WESTERN_5TIER_LABELS (the requested Very Auspicious..Very Inauspicious scale) is defined');
check(/en: 'Very Auspicious'/.test(engineSrc) && /en: 'Auspicious'/.test(engineSrc) && /en: 'Neutral'/.test(engineSrc) && /en: 'Inauspicious'/.test(engineSrc) && /en: 'Very Inauspicious'/.test(engineSrc), 'all 5 requested tier labels are present verbatim');
check(/function EZ\(en, zh\)/.test(engineSrc), 'the load-order-safe EZ() {en,zh} pair-builder exists (SIGN_PROFILE_TABLE/luck tables must not call bt() at module-load time)');
check(!/SIGN_PROFILE_TABLE = \{[\s\S]{0,400}?\bbt\(/.test(engineSrc.slice(engineSrc.indexOf('const SIGN_PROFILE_TABLE'), engineSrc.indexOf('const SIGN_PROFILE_TABLE') + 3000)), 'SIGN_PROFILE_TABLE itself does not call bt() (would crash at load time, before app.js defines bt())');
check(/type === 'astro_natal_full'/.test(appSrc), "generateDeepAnalysisData handles type === 'astro_natal_full'");
check(/type === 'astro_annual_deep'/.test(appSrc), "generateDeepAnalysisData handles type === 'astro_annual_deep'");
check(/type === 'astro_monthly_deep'/.test(appSrc), "generateDeepAnalysisData handles type === 'astro_monthly_deep'");
check(/function generateNatalFullChartHTML\(p\)/.test(appSrc), 'generateNatalFullChartHTML() exists');
check(/function generateAnnualDeepReadingHTML\(p\)/.test(appSrc), 'generateAnnualDeepReadingHTML() exists');
check(/function generateMonthlyDeepReadingHTML\(p\)/.test(appSrc), 'generateMonthlyDeepReadingHTML() exists');
check(/Full Natal Chart Deep Reading/.test(appSrc), 'the natal chart section is wired into the Western Astrology template');
check(/Annual Deep Reading - Current Year \+ Next 2 Years/.test(appSrc), 'the annual deep reading heading is wired into the Western Astrology template');
check(/Monthly Deep Reading \(Current \+ Next Year\)/.test(appSrc), 'the monthly deep reading is wired into the Western Astrology template');
// The existing "3-Year Monthly Western Astrology Match" (Da Yun section, Sun-sign-only, 36 months)
// must remain untouched - this enhancement adds new sections, it does not remove/replace that one.
check(/3-Year Monthly Western Astrology Match/.test(appSrc), 'the PRE-EXISTING "3-Year Monthly Western Astrology Match" reading is still present (not replaced/removed by this round\'s new sections)');
check(/artAstro3YearMonthly/.test(appSrc), 'the pre-existing 3-year astro match render variable is still wired in');

// --- Behavioral: real profile, real math ---
run(`var __raw = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
function run(code) { return vm.runInContext(code, sandbox); }
run(`var __raw2 = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run('var p = getProfileData(__raw2);');
const hasBirthMoment = run('!!(p && p.bazi && p.bazi.birthMomentUTC)');
check(hasBirthMoment, 'test profile has a real birthMomentUTC (needed for every new function under test)');

// computeFullNatalChart: all 10 planets present, each with a real longitude + sign
let natalChart = null, threw = null;
try { natalChart = run('var natalChart = computeFullNatalChart(p.bazi.birthMomentUTC); natalChart'); } catch (e) { threw = e; }
check(!threw, `computeFullNatalChart ran without throwing${threw ? ': ' + threw.message : ''}`);
// UPDATED (follow-up round: "plot all [planets] and include the eclipse and the eclipse trail as 2
// separate planets") - the North/South Node (the eclipse axis) are now part of the full natal chart too,
// bringing the total from 10 classical planets to 12 natal points.
const NATAL_KEYS = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northnode','southnode'];
check(!!natalChart && NATAL_KEYS.every(k => natalChart[k] && typeof natalChart[k].lon === 'number' && natalChart[k].sign && natalChart[k].sign.en), 'natal chart has all 12 natal points (10 classical planets + North/South Node), each with a numeric longitude and a resolved sign');
check(natalChart.sun.sign.en === 'Virgo', `Roy Wong's real natal Sun sign is Virgo (Sep 7) - got ${natalChart.sun.sign.en}`);
NATAL_KEYS.forEach(k => check(natalChart[k].lon >= 0 && natalChart[k].lon < 360, `${k}'s longitude is a normalized 0-360 value - got ${natalChart[k].lon}`));

// computeNatalAspectGrid: sorted tightest-first, every entry is a genuine MAJOR_ASPECTS match
const aspects = run('computeNatalAspectGrid(natalChart)');
check(Array.isArray(aspects) && aspects.length > 0, `natal aspect grid produced at least one real aspect - got ${aspects ? aspects.length : 'none'}`);
let sortedOk = true;
for (let i = 1; i < aspects.length; i++) if (aspects[i].orbUsed < aspects[i-1].orbUsed) sortedOk = false;
check(sortedOk, 'natal aspects are sorted tightest-orb-first');
check(aspects.every(a => ['Conjunction','Sextile','Square','Trine','Opposition'].includes(a.name)), 'every natal aspect is one of the 5 standard major aspect types');

// computeAnnualDeepReading: exactly 3 years, current year first, each with a real 5-tier classification
const annual = run('computeAnnualDeepReading(p, 3)');
check(annual.years.length === 3, `computeAnnualDeepReading(p, 3) produced exactly 3 years - got ${annual.years.length}`);
const nowY = new Date().getFullYear();
check(annual.years[0].year === nowY, `first year is the current calendar year (${nowY}) - got ${annual.years[0].year}`);
check(annual.years[1].year === nowY + 1 && annual.years[2].year === nowY + 2, 'the following 2 years are consecutive');
const FIVE_TIERS = ['Very Auspicious','Auspicious','Neutral','Inauspicious','Very Inauspicious'];
check(annual.years.every(y => FIVE_TIERS.includes(y.tier.en)), 'every year classifies into one of the exact 5 requested tiers');
check(annual.years.every(y => Array.isArray(y.aspects) && y.aspects.every(a => NATAL_KEYS.includes(a.natalKey))), 'every found aspect targets one of the 12 real natal points (not just the natal Sun)');
check(annual.years.every(y => y.aspects.every(a => ['sun','jupiter','saturn','uranus','neptune','pluto','northnode','southnode'].includes(a.transitKey))), 'every found aspect comes from one of the real transiting bodies, including the North/South Node');

// computeMonthlyDeepReading: exactly 24 months (current year + next year), consecutive, real 5-tier
const monthly = run('computeMonthlyDeepReading(p, 24)');
check(monthly.months.length === 24, `computeMonthlyDeepReading(p, 24) produced exactly 24 months - got ${monthly.months.length}`);
const nowM = new Date().getMonth() + 1;
check(monthly.months[0].year === nowY && monthly.months[0].month === nowM, 'monthly reading starts from the current real calendar month');
let consecutiveOk = true;
for (let i = 1; i < monthly.months.length; i++) {
  const prev = monthly.months[i-1], cur = monthly.months[i];
  const expectedMonth = prev.month === 12 ? 1 : prev.month + 1;
  const expectedYear = prev.month === 12 ? prev.year + 1 : prev.year;
  if (cur.month !== expectedMonth || cur.year !== expectedYear) consecutiveOk = false;
}
check(consecutiveOk, 'all 24 months are consecutive calendar months with no gaps');
check(monthly.months.every(m => FIVE_TIERS.includes(m.tier.en)), 'every month classifies into one of the exact 5 requested tiers');
check(monthly.best.score >= monthly.worst.score, 'the reported best month genuinely scores at or above the worst month');
let bestIsMax = true, worstIsMin = true;
monthly.months.forEach(m => { if (m.score > monthly.best.score) bestIsMax = false; if (m.score < monthly.worst.score) worstIsMin = false; });
check(bestIsMax, 'the reported "best" month is genuinely the highest-scoring month in the window');
check(worstIsMin, 'the reported "worst" month is genuinely the lowest-scoring month in the window');

// Different natal chart => genuinely different results (not decorative/hardcoded)
run(`var __raw3 = ${JSON.stringify({ englishFirstName: 'Bobby', englishLastName: 'Neo', birthdate: '1965-06-27', birthtime: '05:28', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run('var p2 = getProfileData(__raw3);');
const natalChart2 = run('computeFullNatalChart(p2.bazi.birthMomentUTC)');
check(natalChart2.sun.sign.en !== natalChart.sun.sign.en, `a person with a different birthdate has a different natal Sun sign (${natalChart2.sun.sign.en} vs ${natalChart.sun.sign.en})`);
const annual2 = run('computeAnnualDeepReading(p2, 3)');
check(JSON.stringify(annual2.years.map(y=>y.score)) !== JSON.stringify(annual.years.map(y=>y.score)), 'two different people produce genuinely different annual scores (not a fixed template)');

// --- Rendering: the 3 new HTML-producing functions run without throwing, in both languages, and
// produce genuinely different content (not static placeholders) ---
['en', 'zh'].forEach(langVal => {
  run(`lang = ${JSON.stringify(langVal)};`);
  let natalHTML = null, annualHTML = null, monthlyHTML = null, renderThrew = null;
  try {
    natalHTML = run('generateNatalFullChartHTML(p)');
    annualHTML = run('generateAnnualDeepReadingHTML(p)');
    monthlyHTML = run('generateMonthlyDeepReadingHTML(p)');
  } catch (e) { renderThrew = e; }
  check(!renderThrew, `all 3 new render functions run without throwing in lang=${langVal}${renderThrew ? ': ' + renderThrew.stack : ''}`);
  check(typeof natalHTML === 'string' && natalHTML.length > 200, `generateNatalFullChartHTML produced substantial HTML in lang=${langVal}`);
  check(typeof annualHTML === 'string' && annualHTML.length > 200, `generateAnnualDeepReadingHTML produced substantial HTML in lang=${langVal}`);
  check(typeof monthlyHTML === 'string' && monthlyHTML.length > 200, `generateMonthlyDeepReadingHTML produced substantial HTML in lang=${langVal}`);
  // All 10 planet names (in the active language) should appear in the natal chart table.
  const expectedNames = langVal === 'zh'
    ? ['太阳','月亮','水星','金星','火星','木星','土星','天王星','海王星','冥王星']
    : ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
  check(expectedNames.every(n => natalHTML.includes(n)), `natal chart table lists all 10 planet names in lang=${langVal}`);
  // Annual reading should show all 3 years and a real 5-tier badge.
  check([nowY, nowY+1, nowY+2].every(y => annualHTML.includes(String(y))), `annual reading HTML mentions all 3 years in lang=${langVal}`);
  // Monthly reading table should have exactly 24 <tr> data rows (+ 1 header row).
  const trCount = (monthlyHTML.match(/<tr/g) || []).length;
  check(trCount === 25, `monthly reading table has exactly 24 data rows + 1 header row (25 <tr> total) - got ${trCount} in lang=${langVal}`);
});
run('lang = "en";');

// --- The natal deep-analysis branch surfaces all 8 explicitly requested life-domains ---
// generateDeepAnalysisData's normal (non-rawOnly) return is just a "View Details" toggle button -
// the real content lives in the app's deepAnalysisRegistry (revealed on click), which is the SAME
// established pattern used by every other deep-analysis call in this file, not something new to this
// round. rawOnly=true (the same escape hatch other rawOnly call sites already use) gives the raw
// {chars, exp, traits, hl, pos, neg, cau} strings directly for inspection here.
const natalDeepRaw = run(`generateDeepAnalysisData('astro_natal_full', p, {title: 'Full Natal Chart Deep Reading'}, true)`);
const natalDeepText = JSON.stringify(natalDeepRaw);
['Characteristics','Suitable Career','Suitable Industry','Direct Luck','Indirect','Health','Relationships','Children'].forEach(term => {
  check(natalDeepText.includes(term), `natal deep-analysis output mentions "${term}" (explicitly requested life-domain)`);
});

// --- FOLLOW-UP ROUND: "explain in detail what those mean to the profile" / "check calculations" /
// "plot all [planets], include the eclipse and the eclipse trail as 2 separate planets" ---

// computeLunarNodes: North/South Node must be real, normalized, and always exactly 180 degrees apart.
const nodeCheck = run('computeLunarNodes(astroDayNumber(2026, 9, 28, 0))');
check(typeof nodeCheck.northnode === 'number' && nodeCheck.northnode >= 0 && nodeCheck.northnode < 360, `North Node longitude is a normalized 0-360 value - got ${nodeCheck.northnode}`);
check(typeof nodeCheck.southnode === 'number' && nodeCheck.southnode >= 0 && nodeCheck.southnode < 360, `South Node longitude is a normalized 0-360 value - got ${nodeCheck.southnode}`);
const expectedSouth = (nodeCheck.northnode + 180) % 360;
const nodeDiff = Math.abs(nodeCheck.southnode - expectedSouth);
check(nodeDiff < 0.0001, `South Node is always exactly 180 degrees opposite the North Node - got a ${nodeDiff.toFixed(6)}-degree deviation`);
// Verified directly against a real independent ephemeris (prokerala.com, true node) for 2026-09-28: that
// source gives the TRUE North Node at Aquarius 29.4 degrees; this MEAN-node formula should land within a
// few degrees of that (the mean/true node difference has a documented maximum amplitude of ~1.5 degrees).
check(Math.abs(nodeCheck.northnode - 329.4) < 3, `North Node on 2026-09-28 lands within a few degrees of the real (true-node) ephemeris reference (Aquarius 29.4 = 329.4 absolute) - got ${nodeCheck.northnode.toFixed(2)}`);

// The full natal chart now includes both nodes, and they resolve to real, valid signs.
check(natalChart.northnode && natalChart.northnode.sign && natalChart.northnode.sign.en, `natal chart includes a resolved North Node sign - got ${natalChart.northnode?.sign?.en}`);
check(natalChart.southnode && natalChart.southnode.sign && natalChart.southnode.sign.en, `natal chart includes a resolved South Node sign - got ${natalChart.southnode?.sign?.en}`);

// PLANET_INFO_FULL (used by the chart wheels, the legend, and the natal table) now has entries for both.
check(!!run('PLANET_INFO_FULL.northnode?.glyph') && !!run('PLANET_INFO_FULL.southnode?.glyph'), 'PLANET_INFO_FULL has a glyph for both the North and South Node');

// The chart-wheel legend and the SVG wheels themselves now mention/plot the Nodes, not just the Sun +
// 5 outer planets - this is the direct fix for "why are there only 5 planets plotted in the chart".
const legendHTML2 = run('getNatalOuterPlanetsLegendHTML(p)');
['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','North Node','South Node'].forEach(name => {
  check(legendHTML2.includes(name), `the (now full-chart) legend mentions ${name}`);
});
const wheelSVG = run('getCalculatedAstrologyChartHTML(p)');
check(wheelSVG.includes('☊') && wheelSVG.includes('☋'), 'the natal chart wheel SVG plots both Node glyphs (☊ North Node, ☋ South Node)');
['☾','☿','♀','♂','♃','♄','♅','♆','♇'].forEach(glyph => {
  check(wheelSVG.includes(glyph), `the natal chart wheel SVG plots the ${glyph} glyph (all planets, not just the outer 5)`);
});

// describeTransitAspectMeaning: the core fix for "the descriptions ... only mentions the planet
// movements. Explain in detail what those mean to the profile" - the text must go beyond naming the
// aspect and actually state a concrete life-domain consequence.
const sampleAspectMeaning = run(`describeTransitAspectMeaning({ transitKey: 'jupiter', natalKey: 'venus', name: 'Trine', nameZh: '三分相' })`);
check(sampleAspectMeaning.includes('Jupiter') && sampleAspectMeaning.includes('Venus'), 'describeTransitAspectMeaning names both the transiting and natal planet');
check(/relationships|romance|finances|values/i.test(sampleAspectMeaning), `describeTransitAspectMeaning states Venus's CONCRETE life domain (relationships/finances/values), not just an abstract theme word - got: ${sampleAspectMeaning}`);
check(sampleAspectMeaning.length > 60, 'describeTransitAspectMeaning produces a genuinely detailed sentence, not a short label');

// The Annual/Monthly Deep Reading HTML (rawOnly) should now surface this same detailed, concrete
// phrasing (checked via a real profile's actual computed aspects, not the synthetic example above).
const annualDeepRaw = run(`generateDeepAnalysisData('astro_annual_deep', p, { title: 'test', yearData: ${JSON.stringify(annual.years[0])} }, true)`);
const annualDeepText = JSON.stringify(annualDeepRaw);
check(annualDeepText.length > 200, 'the annual deep-analysis raw content is substantial (detailed interpretive text, not just aspect names)');

// The natal reading's Karmic Direction (Nodes) entry is present, addressing the explicit request to
// chart "the eclipse and the eclipse trail" not just on the wheel but in the actual reading.
check(/Karmic Direction/.test(natalDeepText), 'the natal deep-analysis output includes the new "Karmic Direction" (North/South Node) reading');

// --- No profile birth data => a graceful, honest message, never a thrown error ---
let noDataThrew = null, noDataHTML = null;
try {
  noDataHTML = run(`generateNatalFullChartHTML({ bazi: {} })`);
} catch (e) { noDataThrew = e; }
check(!noDataThrew, `generateNatalFullChartHTML handles a profile with no birthMomentUTC gracefully (no throw)${noDataThrew ? ': ' + noDataThrew.message : ''}`);
check(noDataHTML === '', 'generateNatalFullChartHTML returns an empty string (not broken HTML) when birth data is missing');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
