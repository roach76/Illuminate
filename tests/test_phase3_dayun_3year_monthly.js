const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Phase 3's "3-Year Monthly Da Yun Forecast" feature - a genuinely new computation (the
// existing Da Yun content only ever showed the 10-year PILLARS themselves, with no monthly
// forward-looking auspiciousness scoring at all - confirmed by source search before starting).
//
// Covers:
// 1. compute3YearDaYunMonthly() (engine-metaphysics.js) - produces exactly 36 months starting from
//    the current real calendar month, each with a genuine cascading Wu Xing score (Day Master -> Da
//    Yun -> Liu Nian -> Liu Yue), independently recomputed here (not trusting the function's own
//    arithmetic) and confirmed to match exactly.
// 2. The 'dayun_3year_monthly' deep-analysis branch - confirms it is wired and produces real,
//    non-generic content driven by the actual forecast data.
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
check(/function compute3YearDaYunMonthly\(p\)/.test(engineSrc), 'compute3YearDaYunMonthly() exists with the expected signature');
check(/function scoreDaYunMonth\(/.test(engineSrc), 'scoreDaYunMonth() (the cascading scorer) exists');
check(/function computeLiuYuePillar\(/.test(engineSrc), 'computeLiuYuePillar() exists');
check(/const MONTHLY_TIER_LABELS = \[/.test(engineSrc), 'MONTHLY_TIER_LABELS 7-tier scale is defined');
check(/type === 'dayun_3year_monthly'/.test(appSrc), 'a dayun_3year_monthly deep-analysis branch is wired in generateDeepAnalysisData');
check(/artDaYun3YearMonthly/.test(appSrc), 'the 3-year monthly forecast is rendered as its own reading block');
check(/\$\{artDaYun3YearMonthly\}/.test(appSrc), 'the reading block is actually inserted into the Da Yun section template (Timing tab)');
// Exact 7-tier wording, in order, per the brief.
['Extremely Auspicious','Very Auspicious','Auspicious','Neutral','Cautionary','Inauspicious','Extremely Inauspicious'].forEach(label => {
  check(new RegExp(`en: '${label}'`).test(engineSrc), `MONTHLY_TIER_LABELS includes the exact required tier label "${label}"`);
});

const { run } = buildSandbox();

// A real profile (Roy Wong, from the project's test data) with a real BaZi Day Master and real
// daYunPillars to drive the forecast against.
run(`var __raw = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run('var p = getProfileData(__raw);');
const p = run('p');
check(!!p && !!p.bazi && Array.isArray(p.daYunPillars) && p.daYunPillars.length > 0, 'built a real profile with a real BaZi Day Master and real Da Yun pillars');

let threw = null;
let forecast = null;
try { forecast = run('compute3YearDaYunMonthly(p)'); } catch (e) { threw = e; }
check(!threw, `compute3YearDaYunMonthly ran without throwing${threw ? ': ' + threw.message : ''}`);
check(!!forecast && Array.isArray(forecast.months) && forecast.months.length === 36, `forecast produced exactly 36 months - got ${forecast && forecast.months ? forecast.months.length : 'none'}`);

if (forecast) {
  const now = new Date();
  check(forecast.months[0].year === now.getFullYear() && forecast.months[0].month === (now.getMonth() + 1), 'the forecast starts from the current real calendar month, not an arbitrary fixed date');

  // Every month must be exactly one calendar month after the previous one (no gaps/duplicates/jumps).
  let sequenceOk = true;
  for (let i = 1; i < 36; i++) {
    const prev = forecast.months[i - 1], cur = forecast.months[i];
    const prevIdx = prev.year * 12 + prev.month, curIdx = cur.year * 12 + cur.month;
    if (curIdx !== prevIdx + 1) sequenceOk = false;
  }
  check(sequenceOk, 'the 36 months form an unbroken, correctly-ordered sequence with no gaps or duplicates');

  // --- Independent recompute: re-derive Liu Nian, Liu Yue, the governing Da Yun pillar, and the
  // cascading score for EVERY one of the 36 months from scratch (plain arithmetic, not calling the
  // function under test's own internals), and confirm an EXACT match against its real output. ---
  function computeYearPillarIndependently(year) { return { stemIdx: ((year - 4) % 10 + 10) % 10, branchIdx: ((year - 4) % 12 + 12) % 12 }; }
  function computeLiuYueIndependently(liuNianStemIdx, month) {
    const branchIdx = ((month % 12) + 12) % 12;
    const solarMonthNumber = (((branchIdx - 2) % 12 + 12) % 12) + 1;
    const month1Stem = (2 * (((liuNianStemIdx % 5) + 5) % 5 + 1)) % 10;
    const stemIdx = (month1Stem + (solarMonthNumber - 1)) % 10;
    return { stemIdx, branchIdx };
  }
  const ELEM = (stemIdx) => Math.floor(stemIdx / 2);
  const BRANCH_ELEM_IDX = [4,2,0,0,2,1,1,2,3,3,2,4];
  const SIX_CLASH = {0:6,1:7,2:8,3:9,4:10,5:11,6:0,7:1,8:2,9:3,10:4,11:5};
  const SIX_HARMONY = {0:1,1:0,2:11,11:2,3:10,10:3,4:9,9:4,5:8,8:5,6:7,7:6};
  function relScore(ref, target) {
    if (target === ref) return 2;
    if ((target + 1) % 5 === ref) return 3;
    if ((ref + 1) % 5 === target) return 0;
    if ((ref + 2) % 5 === target) return 1;
    return -1;
  }
  function classifyTier(score) {
    if (score >= 6) return 'Extremely Auspicious';
    if (score >= 3.5) return 'Very Auspicious';
    if (score >= 1.5) return 'Auspicious';
    if (score >= -1.5) return 'Neutral';
    if (score >= -3.5) return 'Cautionary';
    if (score >= -5.5) return 'Inauspicious';
    return 'Extremely Inauspicious';
  }

  const dmStemIdx = p.bazi.dayStemIdx, dmBranchIdx = p.bazi.dayBranchIdx;
  const dmElem = ELEM(dmStemIdx);
  let expectedBest = null, expectedWorst = null;
  let allExactMatch = true;
  forecast.months.forEach((m, i) => {
    const expLiuNian = computeYearPillarIndependently(m.year);
    const expLiuYue = computeLiuYueIndependently(expLiuNian.stemIdx, m.month);
    let cycle = p.daYunPillars.find(dy => m.year >= dy.calendarYearStart && m.year < dy.calendarYearStart + 10);
    if (!cycle) cycle = p.daYunPillars[p.daYunPillars.length - 1];

    const dyElem = ELEM(cycle.stemIdx), lnElem = ELEM(expLiuNian.stemIdx), lyElem = ELEM(expLiuYue.stemIdx);
    const dyBranchElem = BRANCH_ELEM_IDX[cycle.branchIdx], lnBranchElem = BRANCH_ELEM_IDX[expLiuNian.branchIdx], lyBranchElem = BRANCH_ELEM_IDX[expLiuYue.branchIdx];

    let s1 = relScore(dmElem, dyElem) + Math.round(relScore(dmElem, dyBranchElem) / 2);
    if (SIX_CLASH[dmBranchIdx] === cycle.branchIdx) s1 -= 3; else if (SIX_HARMONY[dmBranchIdx] === cycle.branchIdx) s1 += 2;
    let s2 = relScore(dyElem, lnElem) + Math.round(relScore(dyElem, lnBranchElem) / 2);
    if (SIX_CLASH[cycle.branchIdx] === expLiuNian.branchIdx) s2 -= 2; else if (SIX_HARMONY[cycle.branchIdx] === expLiuNian.branchIdx) s2 += 1;
    let s3 = relScore(lnElem, lyElem) + Math.round(relScore(lnElem, lyBranchElem) / 2);
    if (SIX_CLASH[expLiuNian.branchIdx] === expLiuYue.branchIdx) s3 -= 1; else if (SIX_HARMONY[expLiuNian.branchIdx] === expLiuYue.branchIdx) s3 += 1;
    const expTotal = s1 * 1.0 + s2 * 0.6 + s3 * 0.4;
    const expTier = classifyTier(expTotal);

    const got = forecast.months[i];
    if (got.liuNianStemIdx !== expLiuNian.stemIdx || got.liuNianBranchIdx !== expLiuNian.branchIdx) allExactMatch = false;
    if (got.liuYueStemIdx !== expLiuYue.stemIdx || got.liuYueBranchIdx !== expLiuYue.branchIdx) allExactMatch = false;
    if (got.dayunStemIdx !== cycle.stemIdx || got.dayunBranchIdx !== cycle.branchIdx) allExactMatch = false;
    if (Math.abs(got.score - expTotal) > 1e-9) allExactMatch = false;
    if (got.tier.en !== expTier) allExactMatch = false;

    if (expectedBest === null || expTotal > expectedBest.score) expectedBest = { ...m, score: expTotal };
    if (expectedWorst === null || expTotal < expectedWorst.score) expectedWorst = { ...m, score: expTotal };
  });
  check(allExactMatch, 'EVERY one of the 36 months\' Liu Nian, Liu Yue, Da Yun pillar, cascading score, and tier exactly match an independent from-scratch recomputation');
  check(forecast.best.year === expectedBest.year && forecast.best.month === expectedBest.month, `the reported "best" month (${forecast.best.year}-${forecast.best.month}) matches the independently-recomputed highest-scoring month (${expectedBest.year}-${expectedBest.month})`);
  check(forecast.worst.year === expectedWorst.year && forecast.worst.month === expectedWorst.month, `the reported "worst" month (${forecast.worst.year}-${forecast.worst.month}) matches the independently-recomputed lowest-scoring month (${expectedWorst.year}-${expectedWorst.month})`);

  // Genuine per-person variation: run against a second, very different real person and confirm the
  // 36-month score sequence is NOT identical (i.e. genuinely driven by that person's own chart, not
  // decorative/hardcoded).
  run(`var __raw2 = ${JSON.stringify({ englishFirstName: 'Nur', englishLastName: 'Afiqah', birthdate: '1994-08-08', birthtime: '09:30', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
  run('var p2 = getProfileData(__raw2);');
  const forecast2 = run('compute3YearDaYunMonthly(p2)');
  const seq1 = forecast.months.map(m => m.score).join(',');
  const seq2 = forecast2.months.map(m => m.score).join(',');
  check(seq1 !== seq2, 'two different real people (Roy Wong vs Nur Afiqah) produce genuinely DIFFERENT 36-month score sequences, confirming this is computed per-person, not decorative');
}

// --- Behavioral: the dayun_3year_monthly branch itself, driven directly against real forecast data ---
try {
  const branchStart = appSrc.indexOf("} else if (type === 'dayun_3year_monthly'");
  const branchEnd = appSrc.indexOf("} else if (type === 'astro_3year_monthly'", branchStart);
  check(branchStart !== -1 && branchEnd !== -1, 'located the real dayun_3year_monthly branch body');
  const branchBody = appSrc.slice(branchStart, branchEnd).replace(/^\} else if/, 'if') + '\n}';

  const { run: run2 } = buildSandbox();
  run2(`
    lang = 'en';
    function bt(en, zh) { return (lang === 'zh' && zh) ? zh : en; }
    function trPill(t) { return t; }
    function getElementIdx(stemIdx) { return Math.floor(stemIdx / 2); }
    var __raw3 = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};
    var p = getProfileData(__raw3);
    var fc3 = compute3YearDaYunMonthly(p);
    var type = 'dayun_3year_monthly';
    var extraData = { forecast: fc3 };
    var chars, exp, traits, hl, pos, neg, cau, opts;
    ${branchBody}
  `);
  const result = { chars: run2('chars'), hl: run2('hl') };
  const fc3 = run2('fc3');
  check(!!result.chars && result.chars.length > 20, 'the branch produces real, non-empty "chars" content');
  check(result.chars.includes(String(fc3.months[0].year)), 'the branch\'s narrative genuinely references the real computed forecast data (start year), not generic filler');
  check(Array.isArray(result.hl) && result.hl.length >= 2, 'the branch produces at least 2 highlight lines (best/worst month)');
  const bestLabel = `${fc3.best.year}-${String(fc3.best.month).padStart(2,'0')}`;
  check(result.hl.some(h => h.includes(bestLabel)), 'the highlights genuinely name the real computed best month, not a placeholder');
} catch (e) {
  check(false, 'dayun_3year_monthly branch ran without throwing: ' + e.message);
}

console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
