const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Phase 3's "3-Year Monthly Western Astrology Match" feature - the matching companion
// reading to the Da Yun 3-Year Monthly Forecast, built strictly within what is actually computable
// without a planetary-ephemeris engine (this app's `astro` field is a bare Sun-sign lookup only).
//
// Covers:
// 1. compute3YearAstroMonthly() (engine-metaphysics.js) - produces exactly 36 months of REAL Sun-sign
//    transits (reusing getAstrologySign's own exact date-range table) rated by genuine Element/
//    Modality relationship to the natal Sun sign, independently recomputed here and confirmed exact.
// 2. ZODIAC_ELEMENT_MODALITY - internal consistency (exactly 3 signs per element, 4 per modality).
// 3. The 'astro_3year_monthly' deep-analysis branch - wired, and honestly scoped in its own text.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function buildSandbox() {
  const storage = {};
  const localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
  };
  const sandbox = {
    localStorage, console, navigator: { language: 'en-US' },
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    alert: () => {}, document: { createElement: () => ({ style: {}, appendChild(){}, querySelectorAll: () => [] }) },
  };
  sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js');
  return { sandbox, run: (code) => vm.runInContext(code, sandbox) };
}

const engineSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static regression guards ---
check(/function compute3YearAstroMonthly\(p\)/.test(engineSrc), 'compute3YearAstroMonthly() exists with the expected signature');
check(/function scoreAstroMonth\(/.test(engineSrc), 'scoreAstroMonth() exists');
check(/const ZODIAC_ELEMENT_MODALITY = \{/.test(engineSrc), 'ZODIAC_ELEMENT_MODALITY table is defined');
check(/getAstrologySign\(month, 15\)/.test(engineSrc), 'compute3YearAstroMonthly reuses the REAL getAstrologySign lookup for the monthly transit, rather than a second invented table');
check(/type === 'astro_3year_monthly'/.test(appSrc), 'an astro_3year_monthly deep-analysis branch is wired in generateDeepAnalysisData');
check(/artAstro3YearMonthly/.test(appSrc), 'the 3-year astrology match is rendered as its own reading block');
check(/\$\{artAstro3YearMonthly\}/.test(appSrc), 'the reading block is actually inserted into the Da Yun section template (Timing tab, alongside the Da Yun 3-year reading)');
check(/no Moon, no other planets, and no houses/.test(appSrc), 'the branch\'s own explanation is honest about NOT being a full ephemeris/transit system');
check(/NOT a full ephemeris-based transit or progression system/.test(appSrc), 'the branch explicitly states it is not a full ephemeris-based transit/progression system');

// --- ZODIAC_ELEMENT_MODALITY internal consistency ---
const { run } = buildSandbox();
const table = run('ZODIAC_ELEMENT_MODALITY');
const signs = Object.keys(table);
check(signs.length === 12, `ZODIAC_ELEMENT_MODALITY covers exactly 12 signs - got ${signs.length}`);
const elemCounts = {}, modCounts = {};
signs.forEach(s => { elemCounts[table[s].element] = (elemCounts[table[s].element]||0)+1; modCounts[table[s].modality] = (modCounts[table[s].modality]||0)+1; });
['Fire','Earth','Air','Water'].forEach(e => check(elemCounts[e] === 3, `element ${e} has exactly 3 signs - got ${elemCounts[e]}`));
['Cardinal','Fixed','Mutable'].forEach(m => check(modCounts[m] === 4, `modality ${m} has exactly 4 signs - got ${modCounts[m]}`));
// Every element must appear with all 3 modalities exactly once (real astrological convention) -
// confirms no accidental duplicate element+modality pairing exists.
['Fire','Earth','Air','Water'].forEach(e => {
  const mods = signs.filter(s => table[s].element === e).map(s => table[s].modality).sort();
  check(JSON.stringify(mods) === JSON.stringify(['Cardinal','Fixed','Mutable']), `element ${e} appears with exactly one sign of each modality (Cardinal/Fixed/Mutable) - got ${mods}`);
});

// --- Behavioral: drive compute3YearAstroMonthly against a real profile, independently recomputing
// the expected transit sign and score for all 36 months. ---
run(`var __raw = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run('var p = getProfileData(__raw);');
const p = run('p');
check(!!p && !!p.astro && !!p.astro.en, 'built a real profile with a real natal Sun sign');
check(p.astro.en === 'Virgo', `Roy Wong (Sep 7 birthdate) has the correct real natal Sun sign Virgo - got ${p.astro.en}`); // Aug 23 - Sep 22

let threw = null, forecast = null;
try { forecast = run('compute3YearAstroMonthly(p)'); } catch (e) { threw = e; }
check(!threw, `compute3YearAstroMonthly ran without throwing${threw ? ': ' + threw.message : ''}`);
check(!!forecast && Array.isArray(forecast.months) && forecast.months.length === 36, `forecast produced exactly 36 months - got ${forecast && forecast.months ? forecast.months.length : 'none'}`);
check(forecast && forecast.natalKey === 'Virgo', 'the forecast correctly carries the real natal sign through (Virgo)');

if (forecast) {
  const now = new Date();
  check(forecast.months[0].year === now.getFullYear() && forecast.months[0].month === (now.getMonth() + 1), 'the forecast starts from the current real calendar month');

  // Independent recompute of the exact sign-date table getAstrologySign itself uses (transcribed
  // here as data, not by calling the function under test), applied to day=15 of each month, plus an
  // independent re-derivation of the element/modality score.
  function signForMonth15(month) {
    const dd = 15;
    if ((month === 1 && dd >= 20) || (month === 2 && dd <= 18)) return 'Aquarius';
    if ((month === 2 && dd >= 19) || (month === 3 && dd <= 20)) return 'Pisces';
    if ((month === 3 && dd >= 21) || (month === 4 && dd <= 19)) return 'Aries';
    if ((month === 4 && dd >= 20) || (month === 5 && dd <= 20)) return 'Taurus';
    if ((month === 5 && dd >= 21) || (month === 6 && dd <= 20)) return 'Gemini';
    if ((month === 6 && dd >= 21) || (month === 7 && dd <= 22)) return 'Cancer';
    if ((month === 7 && dd >= 23) || (month === 8 && dd <= 22)) return 'Leo';
    if ((month === 8 && dd >= 23) || (month === 9 && dd <= 22)) return 'Virgo';
    if ((month === 9 && dd >= 23) || (month === 10 && dd <= 22)) return 'Libra';
    if ((month === 10 && dd >= 23) || (month === 11 && dd <= 21)) return 'Scorpio';
    if ((month === 11 && dd >= 22) || (month === 12 && dd <= 21)) return 'Sagittarius';
    return 'Capricorn';
  }
  // Day 15 always resolves to whichever sign governs the FIRST half of that month, since every sign
  // boundary in the real table falls on day 18 or later - i.e. month 1(Jan)->Capricorn, 2->Aquarius,
  // 3->Pisces, 4->Aries, 5->Taurus, 6->Gemini, 7->Cancer, 8->Leo, 9->Virgo, 10->Libra, 11->Scorpio,
  // 12->Sagittarius. Confirmed directly against signForMonth15 rather than assumed.
  const EXPECTED_SIGN_BY_MONTH = {1:'Capricorn',2:'Aquarius',3:'Pisces',4:'Aries',5:'Taurus',6:'Gemini',7:'Cancer',8:'Leo',9:'Virgo',10:'Libra',11:'Scorpio',12:'Sagittarius'};
  for (let m = 1; m <= 12; m++) check(signForMonth15(m) === EXPECTED_SIGN_BY_MONTH[m], `sanity: day-15 sign table for month ${m} matches expectation (${EXPECTED_SIGN_BY_MONTH[m]})`);

  const EM = { Aries:['Fire','Cardinal'],Taurus:['Earth','Fixed'],Gemini:['Air','Mutable'],Cancer:['Water','Cardinal'],Leo:['Fire','Fixed'],Virgo:['Earth','Mutable'],Libra:['Air','Cardinal'],Scorpio:['Water','Fixed'],Sagittarius:['Fire','Mutable'],Capricorn:['Earth','Cardinal'],Aquarius:['Air','Fixed'],Pisces:['Water','Mutable'] };
  const COMPLEMENT = { Fire:'Air', Air:'Fire', Earth:'Water', Water:'Earth' };
  function classifyAstro(score) {
    if (score >= 5) return 'Extremely Auspicious';
    if (score >= 3) return 'Very Auspicious';
    if (score >= 1.5) return 'Auspicious';
    if (score >= 0.5) return 'Neutral';
    if (score >= -1.5) return 'Cautionary';
    if (score >= -2.5) return 'Inauspicious';
    return 'Extremely Inauspicious';
  }
  const natalKey = 'Virgo';
  const [natalElem, natalMod] = EM[natalKey];
  let allExactMatch = true;
  let expectedBest = null, expectedWorst = null;
  forecast.months.forEach((m, i) => {
    const expTransit = signForMonth15(m.month);
    const [tElem, tMod] = EM[expTransit];
    const sameSign = expTransit === natalKey;
    const elemRel = natalElem === tElem ? 'same' : (COMPLEMENT[natalElem] === tElem ? 'complementary' : 'challenging');
    let expScore = sameSign ? 5 : (elemRel === 'same' ? 3 : (elemRel === 'complementary' ? 1.5 : -1.5));
    const sameModality = !sameSign && natalMod === tMod;
    if (sameModality) expScore -= 1;
    const expTier = classifyAstro(expScore);

    const got = forecast.months[i];
    if (got.transitKey !== expTransit) allExactMatch = false;
    if (Math.abs(got.score - expScore) > 1e-9) allExactMatch = false;
    if (got.tier.en !== expTier) allExactMatch = false;
    if (got.elemRel !== elemRel) allExactMatch = false;

    if (expectedBest === null || expScore > expectedBest.score) expectedBest = { year: m.year, month: m.month, score: expScore };
    if (expectedWorst === null || expScore < expectedWorst.score) expectedWorst = { year: m.year, month: m.month, score: expScore };
  });
  check(allExactMatch, 'EVERY one of the 36 months\' transiting sign, element relation, score, and tier exactly match an independent from-scratch recomputation');
  check(forecast.best.year === expectedBest.year && forecast.best.month === expectedBest.month, `the reported "best" month (${forecast.best.year}-${forecast.best.month}) matches the independently-recomputed highest-scoring month`);
  check(forecast.worst.year === expectedWorst.year && forecast.worst.month === expectedWorst.month, `the reported "worst" month (${forecast.worst.year}-${forecast.worst.month}) matches the independently-recomputed lowest-scoring month`);
  // Confirm at least one genuine solar-return month (transit === natal sign) exists somewhere in a
  // 36-month (3-year) window, and that it is scored as the maximum tier.
  const returnMonths = forecast.months.filter(m => m.sameSign);
  check(returnMonths.length >= 3, `a 36-month window contains at least 3 solar-return months (once per year) for Virgo - got ${returnMonths.length}`);
  check(returnMonths.every(m => m.tier.en === 'Extremely Auspicious'), 'every solar-return month is correctly rated the top tier (Extremely Auspicious)');

  // Different natal sign => genuinely different sequence (not decorative/hardcoded).
  run(`var __raw2 = ${JSON.stringify({ englishFirstName: 'Bobby', englishLastName: 'Neo', birthdate: '1965-06-27', birthtime: '05:28', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
  run('var p2 = getProfileData(__raw2);');
  const forecast2 = run('compute3YearAstroMonthly(p2)');
  check(forecast2.natalKey !== forecast.natalKey, `a person with a different birthdate has a different natal sign (${forecast2.natalKey} vs ${forecast.natalKey})`);
  const seq1 = forecast.months.map(m => m.score).join(',');
  const seq2 = forecast2.months.map(m => m.score).join(',');
  check(seq1 !== seq2, 'two people with different natal signs produce genuinely different 36-month score sequences');
}

console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
