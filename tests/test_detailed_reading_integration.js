const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies "the detailed reading should take all calculations from the app into consideration ... every
// component of the app ... all the core, timing, environment, and more sections": the Detailed Reading now
// carries a cross-system block under every section, an integrated overview, and a coverage table, built by
// buildIntegratedSignals from what each other system already computes. This file also guards the future:
// any NEW section added to the chart's tab groups must be mapped to a system here (and therefore consumed by
// the reading) or this test fails.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(__PROJECT_ROOT__, 'app.js'), 'utf8');

// --- 1. Every chart section is mapped to the systems that feed the reading ---
const tabGroupsSrc = appSrc.match(/const tabGroups = \{([\s\S]*?)\n  \};/)[1];
const sectionsInTabs = Array.from(tabGroupsSrc.matchAll(/\b(art[A-Za-z]+)\b/g)).map(m => m[1]).filter(n => !/^artDetailsSummary/.test(n));
const SECTION_TO_SYSTEMS = {
  artMingLi: ['bazi', 'bone', 'karmic'], artZodiac: ['zodiac'], artName: ['name'], artHealthDiagnosis: ['health'], artIChing: ['iching'], artXiangShu: ['xiangshu'],
  artDaYun: ['dayun'], artSanShi: ['qmdj', 'sanshi', 'daily'], artZeRi: ['zeri'],
  artZiWei: ['ziwei'], artFengShui: ['fengshui'],
  artNumerology: ['numerology'], artWesternAstrology: ['western'], artCrossSystemSynthesis: ['ziwei', 'qmdj', 'western', 'bazi'], artPersonalAssets: ['assets']
};
check(sectionsInTabs.length >= 14, `found the chart's sections in tabGroups (${sectionsInTabs.length})`);
sectionsInTabs.forEach(n => check(!!SECTION_TO_SYSTEMS[n], `chart section ${n} is mapped to a system that feeds the Detailed Reading (add it to buildIntegratedSignals if new)`));

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(__PROJECT_ROOT__, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: dom.window.document, window: dom.window,
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL, html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}} }),
    alert: () => {}, confirm: () => true, fetch: undefined,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  const load = (f) => vm.runInContext(fs.readFileSync(path.join(__PROJECT_ROOT__, f), 'utf8'), sandbox, { filename: f });
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { sandbox, dom };
}
const person = (first, last, date, time, gender) => ({ englishFirstName: first, englishLastName: last, birthdate: date, birthtime: time, gender, birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, birthLatitude: 1.35 });
const user = {
  email: 'test@test.com', password: 'x',
  profile: Object.assign(person('Roy', 'Wong', '1976-09-07', '09:33', 'male'), { chineseLastName: '黄', chineseFirstName: '良杰', mobileNumber: '91234567', vehicles: [{ number: 'SJL1234A', shared: false }], fsDir: 'North' }),
  partner: person('Tina', 'Seah', '1976-04-15', '10:00', 'female'),
  businessPartner: person('Bobby', 'Neo', '1965-06-27', '05:28', 'male'),
  children: [person('Amy', 'Wong', '2005-03-03', '08:15', 'female')],
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};
const { sandbox: sb, dom } = freshSandbox();
const run = (s) => vm.runInContext(s, sb);
run(`state.users['test@test.com'] = ${JSON.stringify(user)}; state.active = 'test@test.com'; go('chart');`);
const doc = dom.window.document;

// --- 2. Xiang Shu: pressing Generate saves the features, the dropdowns come back pre-selected, and the reading uses them ---
const scratch = doc.createElement('div'); doc.body.appendChild(scratch);
scratch.innerHTML = run(`(function(){ renderSystemChart(getProfileData(), 'i', null, false, null); return Object.values(chartTabRegistry['i']).join(''); })()`);
// the handler reads the live page's own elements (by id), so drive those rather than a detached copy
const sel = (id) => doc.getElementById(id + '_i');
check(!!sel('xsFaceInput') && !!sel('xsChinInput'), 'Xiang Shu calculator renders its dropdowns');
sel('xsFaceInput').value = 'round'; sel('xsEyesInput').value = 'bright'; sel('xsNoseInput').value = 'straight_full'; sel('xsMouthInput').value = 'large_thick'; sel('xsChinInput').value = 'round_full';
const resBox = doc.getElementById('xsResult_i');
check(!!resBox, 'Xiang Shu result box exists');
doc.querySelector('.btnCalcXiangShu[data-prefix="i"]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
const saved = run(`JSON.stringify(activeUser().xiangShuByPerson || {})`);
check(/"face":"round"/.test(saved) && /"chin":"round_full"/.test(saved), 'pressing Generate saves the 5 features against the person');
const scratch2 = doc.createElement('div'); doc.body.appendChild(scratch2);
scratch2.innerHTML = run(`(function(){ renderSystemChart(getProfileData(), 'i', null, false, null); return Object.values(chartTabRegistry['i']).join(''); })()`);
check(/<option value="round" selected(="")?>/.test(scratch2.innerHTML) && /<option value="round_full" selected(="")?>/.test(scratch2.innerHTML), 'saved features come back pre-selected in the dropdowns');

// --- 3. Main profile: every system contributes, every section carries a cross-system block ---
const integ = JSON.parse(run(`(function(){ const i = buildIntegratedSignals(getProfileData(), 'i'); return JSON.stringify({ n: i.signals.length, bySys: i.signals.reduce((o, s) => { o[s.sys] = (o[s.sys] || 0) + 1; return o; }, {}), unavailable: i.unavailable }); })()`));
const SYSTEM_KEYS = JSON.parse(run(`JSON.stringify(INTEG_SYSTEMS.map(s => s.key))`));
check(SYSTEM_KEYS.length === 19, `19 systems are tracked (${SYSTEM_KEYS.length})`);
SYSTEM_KEYS.forEach(k => check((integ.bySys[k] || 0) >= 1, `system ${k} contributes at least one signal for a fully populated main profile (${integ.bySys[k] || 0})`));
check(integ.unavailable.length === 0, 'no system failed to compute');
const html = run(`generateDetailedReading(getProfileData(), 'i')`);
const text = html.replace(/<[^>]+>/g, ' ');
['Life', 'Career', 'Wealth', 'Luck', 'Love', 'Health', 'This year', 'Next year', 'This cycle', 'Next cycle', 'Right now'].forEach(d =>
  check(new RegExp('Cross-system view: ' + d).test(text), `a cross-system block follows the ${d} section`));
check(/11\) Consolidated Reading of Your Added Information/.test(text) && /13\) Integrated Cross-System Overview/.test(text) && /14\) Systems Consulted for This Reading/.test(text), 'sections 11 (added information), 13 (overview) and 14 (coverage) are present');
check(/Face shape - Round/.test(text) && /Nose \(Wealth Palace/.test(text), 'saved Xiang Shu features appear in the reading (life + wealth palace)');
check(/Chinese name \(黄良杰\)/.test(text) && /English name: Five Grids/.test(text), 'both name systems appear');
check(/Business Partner Bobby: \d+% strategic alignment/.test(text) && /Life Partner Tina: \d+% overall compatibility/.test(text), 'partner and business-partner compatibility appear on the main profile');
check(/Mobile Number Compatibility: \d+%/.test(text) && /Vehicle Number Compatibility: \d+%/.test(text) && /Address Compatibility: \d+%/.test(text), 'personal assets (mobile, vehicle, address) appear');

// --- 4. Signals trace back to the system's own numbers ---
const x = JSON.parse(run(`(function(){ const p = getProfileData(); const S = buildIntegratedSignals(p, 'i').signals; const pick = (sys, dom) => S.filter(s => s.sys === sys && s.doms.includes(dom));
  const nowY = new Date().getFullYear(); const ann = computeAnnualDeepReading(p, 2).years; const dyAnn = computeDaYunAnnualDeepReading(p, 2).years;
  const bone = pick('bone', 'life')[0]; const qm = pick('qmdj', 'life')[0];
  const k = computeKarmicDebtAnalysis(p);
  const zr = pick('zeri', 'now')[0];
  let clash = 0, harm = 0; const c = new Date(); for (let i = 0; i < 60; i++) { const b = getDayBranchForDate(c); if (SIX_CLASH[p.bazi.dayBranchIdx] === b) clash++; else if (SIX_HARMONY[p.bazi.dayBranchIdx] === b) harm++; c.setDate(c.getDate() + 1); }
  return JSON.stringify({ bonePol: bone.pol, boneTotal: p.boneWeight.total, qmPol: qm.pol, qmRating: QMDJ_DOOR_RATING[p.qmdj.lifeDoor],
    westPol: pick('western', 'thisYear')[0].pol, westTier: ann[0].tier.en, westPolNext: pick('western', 'nextYear')[0].pol, westTierNext: ann[1].tier.en,
    dyPol: pick('dayun', 'thisYear')[0].pol, dyAvg: dyAnn[0].avgScore,
    karmicLifeDown: pick('karmic', 'life').filter(s => s.pol < 0).length, karmicExpected: (k.sevenKillingsOverwhelming ? 1 : 0) + (k.dayYearClash ? 1 : 0) + k.voidPillars.filter(v => v.key !== 'month' && v.key !== 'day').length,
    zeriText: zr.text, clash, harm,
    zodiacClashYear: [nowY, nowY + 1].map(y => SIX_CLASH[computeYearPillar(y).branchIdx] === p.bazi.yearBranchIdx),
    zodiacPols: [pick('zodiac', 'thisYear')[0].pol, pick('zodiac', 'nextYear')[0].pol],
    ziweiHuaJi: pick('ziwei', 'life').concat(pick('ziwei', 'career'), pick('ziwei', 'wealth'), pick('ziwei', 'love'), pick('ziwei', 'health'), pick('ziwei', 'luck')).filter(s => /Hua Ji/.test(s.text)).length });})()`));
check(x.bonePol === (x.boneTotal >= 5.0 ? 1 : (x.boneTotal < 3.6 ? -1 : 0)), 'Bone Weight polarity follows the total weight thresholds');
check(x.qmPol === ({ Auspicious: 1, Caution: -1, Neutral: 0 }[x.qmRating]), "Qi Men life-door polarity follows the door's own rating");
const w5 = (t) => (t === 'Very Auspicious' || t === 'Auspicious') ? 1 : (t === 'Neutral' ? 0 : -1);
check(x.westPol === w5(x.westTier) && x.westPolNext === w5(x.westTierNext), "Western annual polarity follows computeAnnualDeepReading's tier");
check(x.dyPol === (x.dyAvg >= 1.5 ? 1 : (x.dyAvg < -1.5 ? -1 : 0)), "Da Yun annual polarity follows computeDaYunAnnualDeepReading's mean score");
check(x.karmicLifeDown === x.karmicExpected, 'Karmic life-area cautions match computeKarmicDebtAnalysis flags');
check(new RegExp(`${x.clash} day\\(s\\) clash your Day Branch`).test(x.zeriText) && new RegExp(`${x.harm} day\\(s\\) combine`).test(x.zeriText), 'Ze Ri counts equal an independent count of Six Clash/Harmony days over the next 60 days');
check(x.zodiacPols.every((pol, i) => !x.zodiacClashYear[i] || pol === -1), 'a year that clashes the natal zodiac is marked cautionary');
check(x.ziweiHuaJi >= 1, 'natal Hua Ji is placed in a palace and surfaced as a cautionary signal');

// Tally on screen == number of glyphs in the block
const lifeBlockHtml = html.split('Cross-system view: Life')[1].split('2) Career')[0];
const lifeUp = (lifeBlockHtml.match(/>▲<\/span>/g) || []).length, lifeDown = (lifeBlockHtml.match(/>▼<\/span>/g) || []).length;
const m = lifeBlockHtml.replace(/<[^>]+>/g, ' ').match(/(\d+) supportive[^·]*·\s*(\d+) neutral\/informational[^·]*·\s*(\d+) cautionary/);
check(m && Number(m[1]) === lifeUp && Number(m[3]) === lifeDown, `Life tally line (${m && m[1]}▲/${m && m[3]}▼) equals the glyphs actually listed (${lifeUp}▲/${lifeDown}▼)`);

// --- 5. Honesty: the not-derived values are not used; tally disclaimer present ---
check(/not a probability or a weighted score/.test(text), 'overview states the tally is a count, not a probability');
check(!/Life Expectancy|life expectancy/.test(text.replace(/Not used on purpose[^.]*\./, '')), 'Life Expectancy is not used anywhere in the reading');
check(/date-arithmetic pattern/.test(text), 'Ze Ri limitation is disclosed in the coverage table');

// --- 6. Other profile types, languages, robustness, PDF, performance ---
const pHtml = run(`generateDetailedReading(getProfileData(getProfileByPrefix('p')), 'p')`);
check(pHtml !== html && /Cross-system view: Life/.test(pHtml), 'Life Partner gets their own cross-system reading');
check(!/Business Partner Bobby/.test(pHtml.replace(/<[^>]+>/g, ' ')), 'partner-compatibility lines are main-profile only');
const cHtml = run(`generateDetailedReading(getProfileData(getProfileByPrefix('c0')), 'c0')`);
check(/Cross-system view: Life/.test(cHtml), 'a Child profile renders without errors');
const noPrefix = run(`generateDetailedReading(getProfileData())`);
check(/Cross-system view: Life/.test(noPrefix), 'calling without a prefix still works (assets/compat simply omitted)');
run(`lang = 'zh';`);
const zh = run(`generateDetailedReading(getProfileData(), 'i')`).replace(/<[^>]+>/g, ' ');
check(/跨体系视角：人生/.test(zh) && /跨体系综合总览/.test(zh) && /本解读所参考的体系/.test(zh), 'Chinese headings for the new blocks');
check(!/undefined|NaN|\[object/.test(zh), 'Chinese reading has no undefined/NaN/[object]');
run(`lang = 'en';`);
check(!/undefined|NaN|\[object/.test(text), 'English reading has no undefined/NaN/[object]');
// one failing system must not take the whole reading down
run(`globalThis.__origKarmic = computeKarmicDebtAnalysis; computeKarmicDebtAnalysis = function () { throw new Error('boom'); };`);
const broken = run(`generateDetailedReading(getProfileData(), 'i')`).replace(/<[^>]+>/g, ' ');
check(/Cross-system view: Life/.test(broken) && /could not be computed/.test(broken), 'a failing system is reported as "could not be computed" while the rest of the reading renders');
run(`computeKarmicDebtAnalysis = globalThis.__origKarmic;`);
const t0 = Date.now(); run(`generateDetailedReading(getProfileData(), 'i')`); const ms = Date.now() - t0;
check(ms < 1500, `reading builds quickly (${ms}ms)`);
const pdf = run(`buildProfilePdfHTML('i')`), pdfP = run(`buildProfilePdfHTML('p')`), pdfC = run(`buildProfilePdfHTML('c0')`);
[['main', pdf], ['partner', pdfP], ['child', pdfC]].forEach(([l, h]) => check(/Cross-system view: Life/.test(h) && /Integrated Cross-System Overview/.test(h), `${l} PDF carries the cross-system blocks and overview`));
check(!/data-tip=/.test(pdf), 'PDF still has no tooltip attributes');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
