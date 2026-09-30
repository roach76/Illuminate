const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's enhancement (the user's own explicitly-stated first-priority follow-on item,
// chosen via AskUserQuestion: "Houses into Annual/Monthly astrology first"): computeAnnualDeepReading
// and computeMonthlyDeepReading (engine-metaphysics.js) now factor in real natal house placement
// (houseAngularityMultiplier: angular houses 1/4/7/10 weighted higher, succedent 2/5/8/11 baseline,
// cadent 3/6/9/12 slightly lower) whenever a profile has real house data on file (p.houses - requires a
// birth latitude, see computeNatalHouses), and each transiting aspect/highlight now names which house it
// activates (describeTransitAspectMeaning / describeMonthlyHighlightMeaning). Profiles with NO house
// data on file must fall back honestly - identical behavior/scores to before this enhancement, no
// fabricated house data.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const sandbox = { console, navigator: { language: 'en-US' }, document: dom.window.document, window: dom.window, alert: () => {}, requestAnimationFrame: (fn) => setTimeout(fn, 0) };
sandbox.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
sandbox.global = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
function run(code) { return vm.runInContext(code, sandbox); }

let loadThrew = null;
try { load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('auth.js'); load('app.js'); }
catch (e) { loadThrew = e; }
check(!loadThrew, `all 5 app files load cleanly together${loadThrew ? ': ' + loadThrew.message : ''}`);

const engineSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static regression guards ---
check(/function houseAngularityMultiplier\(/.test(engineSrc), 'houseAngularityMultiplier() exists');
check(/natalPointHouses/.test(engineSrc), 'computeAnnualDeepReading/computeMonthlyDeepReading reference natalPointHouses');
check(/hasHouses/.test(appSrc), 'app.js branches reference hasHouses honesty flag');

// --- Profile WITH a birth latitude on file (Singapore) -> real house data ---
run(`var __rawWithLat = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthLatitude: 1.3521, birthTimezone: 8 })};`);
run(`var __rawNoLat = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run('var pWith = getProfileData(__rawWithLat); var pNo = getProfileData(__rawNoLat);');

check(run('!!pWith.houses'), 'a profile with a birth latitude on file gets real house data (p.houses)');
check(run('pNo.houses === null || pNo.houses === undefined'), 'a profile with NO birth latitude on file has no house data (honest, not defaulted)');

// --- computeAnnualDeepReading ---
let annualThrew = null;
let annualWith = null, annualNo = null;
try {
  annualWith = run('var annualWith = computeAnnualDeepReading(pWith, 3); annualWith');
  annualNo = run('var annualNo = computeAnnualDeepReading(pNo, 3); annualNo');
} catch (e) { annualThrew = e; }
check(!annualThrew, `computeAnnualDeepReading runs for both with/without houses${annualThrew ? ': ' + annualThrew.message : ''}`);
check(annualWith.houses !== null && annualWith.houses !== undefined, 'computeAnnualDeepReading returns houses when the profile has them');
check(annualNo.houses === null || annualNo.houses === undefined, 'computeAnnualDeepReading returns no houses when the profile lacks them (honest fallback)');
check(annualWith.years.every(y => y.hasHouses === true), 'every year in the with-houses reading is flagged hasHouses:true');
check(annualNo.years.every(y => y.hasHouses === false), 'every year in the no-houses reading is flagged hasHouses:false');

// Every found aspect in the with-houses reading carries a natalHouse in [1,12]; the no-houses reading has none.
const anyMissingHouse = annualWith.years.some(y => y.aspects.some(a => !(a.natalHouse >= 1 && a.natalHouse <= 12)));
check(!anyMissingHouse, 'every aspect in the with-houses annual reading has a valid natalHouse (1-12)');
const anyHasHouseInNoLat = annualNo.years.some(y => y.aspects.some(a => a.natalHouse));
check(!anyHasHouseInNoLat, 'no aspect in the no-houses annual reading has a natalHouse (honest - no fabricated data)');

// House angularity actually changes weighted scores vs the raw (unweighted) scoreTransitAspect - i.e. the
// multiplier is genuinely applied, not a no-op.
const multiplierCheck = run(`
  (function(){
    var y = annualWith.years[0];
    var mismatches = 0, total = 0;
    y.aspects.forEach(function(a){
      total++;
      var raw = scoreTransitAspect(a);
      var expected = a.natalHouse ? raw * houseAngularityMultiplier(a.natalHouse) : raw;
      if (Math.abs(expected - a.weightedScore) > 1e-9) mismatches++;
    });
    return { mismatches: mismatches, total: total };
  })()
`);
check(multiplierCheck.total > 0, 'the with-houses year has at least one real aspect to check the multiplier against');
check(multiplierCheck.mismatches === 0, `every weightedScore in the with-houses reading exactly matches raw*houseAngularityMultiplier - got ${multiplierCheck.mismatches}/${multiplierCheck.total} mismatches`);

// houseAngularityMultiplier itself: angular > succedent > cadent, as documented
check(run('houseAngularityMultiplier(1)') > run('houseAngularityMultiplier(2)'), 'angular house (1) weighted higher than succedent (2)');
check(run('houseAngularityMultiplier(2)') > run('houseAngularityMultiplier(3)'), 'succedent house (2) weighted higher than cadent (3)');
check(run('houseAngularityMultiplier(10)') === run('houseAngularityMultiplier(1)'), 'all 4 angular houses (1/4/7/10) share the same multiplier');

// --- computeMonthlyDeepReading ---
let monthlyThrew = null;
let monthlyWith = null, monthlyNo = null;
try {
  monthlyWith = run('var monthlyWith = computeMonthlyDeepReading(pWith, 12); monthlyWith');
  monthlyNo = run('var monthlyNo = computeMonthlyDeepReading(pNo, 12); monthlyNo');
} catch (e) { monthlyThrew = e; }
check(!monthlyThrew, `computeMonthlyDeepReading runs for both with/without houses${monthlyThrew ? ': ' + monthlyThrew.message : ''}`);
check(monthlyWith.houses !== null && monthlyWith.houses !== undefined, 'computeMonthlyDeepReading returns houses when the profile has them');
check(monthlyNo.houses === null || monthlyNo.houses === undefined, 'computeMonthlyDeepReading returns no houses when the profile lacks them');
check(monthlyWith.months.every(m => m.hasHouses === true), 'every month in the with-houses forecast is flagged hasHouses:true');
check(monthlyNo.months.every(m => m.hasHouses === false), 'every month in the no-houses forecast is flagged hasHouses:false');
const anyHighlightMissingHouse = monthlyWith.months.some(m => m.highlights.some(h => !(h.natalHouse >= 1 && h.natalHouse <= 12)));
check(!anyHighlightMissingHouse, 'every highlight in the with-houses monthly forecast has a valid natalHouse (1-12)');
const anyNoLatHighlightHasHouse = monthlyNo.months.some(m => m.highlights.some(h => h.natalHouse));
check(!anyNoLatHighlightHasHouse, 'no highlight in the no-houses monthly forecast has a natalHouse (honest fallback)');

// --- Text-generation: describeTransitAspectMeaning / describeMonthlyHighlightMeaning mention the house
// when present, and say nothing house-related when absent ---
const withAspect = annualWith.years[0].aspects.find(a => a.natalHouse);
const noAspect = annualNo.years[0].aspects[0];
check(!!withAspect, 'found at least one with-houses aspect to test describeTransitAspectMeaning against');
if (withAspect) {
  const desc = run(`describeTransitAspectMeaning(${JSON.stringify(withAspect)})`);
  check(new RegExp(`House ${withAspect.natalHouse}\\b`).test(desc), `describeTransitAspectMeaning names House ${withAspect.natalHouse} when natalHouse is present`);
}
if (noAspect) {
  const desc2 = run(`describeTransitAspectMeaning(${JSON.stringify(noAspect)})`);
  check(!/activates your House/.test(desc2), 'describeTransitAspectMeaning adds no house note when natalHouse is absent');
}

// --- Rendering: generateAnnualDeepReadingHTML / generateMonthlyDeepReadingHTML run cleanly and disclose
// house status honestly in both directions ---
let renderThrew = null;
let annualHtmlWith = null, annualHtmlNo = null, monthlyHtmlWith = null, monthlyHtmlNo = null;
try {
  annualHtmlWith = run('generateAnnualDeepReadingHTML(pWith)');
  annualHtmlNo = run('generateAnnualDeepReadingHTML(pNo)');
  monthlyHtmlWith = run('generateMonthlyDeepReadingHTML(pWith)');
  monthlyHtmlNo = run('generateMonthlyDeepReadingHTML(pNo)');
} catch (e) { renderThrew = e; }
check(!renderThrew, `all 4 HTML renders run without throwing${renderThrew ? ': ' + renderThrew.message : ''}`);
check(/activates|House/i.test(annualHtmlWith), 'the with-houses Annual Deep Reading HTML mentions house activation');
check(/latitude/i.test(annualHtmlNo), 'the no-houses Annual Deep Reading HTML honestly asks for a birth latitude');
check(/House/i.test(monthlyHtmlWith), 'the with-houses Monthly Deep Reading HTML mentions houses');
check(/latitude/i.test(monthlyHtmlNo), 'the no-houses Monthly Deep Reading HTML honestly asks for a birth latitude');

// Both languages render without throwing
let bilingualThrew = null;
try {
  run(`lang = 'zh'; generateAnnualDeepReadingHTML(pWith); generateMonthlyDeepReadingHTML(pWith); generateAnnualDeepReadingHTML(pNo); generateMonthlyDeepReadingHTML(pNo); lang = 'en';`);
} catch (e) { bilingualThrew = e; }
check(!bilingualThrew, `all 4 renders work in Chinese too${bilingualThrew ? ': ' + bilingualThrew.message : ''}`);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
