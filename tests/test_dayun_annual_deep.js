const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies "for Da Yun, the annual reason for the 3 year forecast is generic. It should show full deep
// details like the annual details": computeDaYunAnnualDeepReading (engine) + the per-year Da Yun Annual
// Deep Reading cards (app) + the now person-specific Reason column in the 36-month table.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(__PROJECT_ROOT__, 'app.js'), 'utf8');
check(/function computeDaYunAnnualDeepReading\(p, yearsCount\)/.test(fs.readFileSync(path.join(__PROJECT_ROOT__, 'engine-metaphysics.js'), 'utf8')), 'engine function exists');
check(/type === 'dayun_annual_deep'/.test(appSrc), 'deep-analysis branch exists');
check(/\$\{generateDaYunAnnualDeepReadingHTML\(p\)\}\s*\n\s*\$\{artDaYun3YearMonthly\}/.test(appSrc), 'annual cards are rendered in the Da Yun section, before the monthly table');

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
  return sandbox;
}
const person = (first, last, date, time, gender) => ({ englishFirstName: first, englishLastName: last, birthdate: date, birthtime: time, gender, birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 });
const user = {
  email: 'test@test.com', password: 'x',
  profile: person('Roy', 'Wong', '1976-09-07', '09:33', 'male'),
  partner: person('Tina', 'Seah', '1976-04-15', '10:00', 'female'),
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};
const sb = freshSandbox();
vm.runInContext(`state.users['test@test.com'] = ${JSON.stringify(user)}; state.active = 'test@test.com'; go('chart');`, sb);
const run = (s) => vm.runInContext(s, sb);

// --- Engine ---
const out = JSON.parse(run(`(function(){ const p = getProfileData(); const r = computeDaYunAnnualDeepReading(p, 3);
  const ud = computeDetailedReadingAnalysis(p).usefulGod;
  return JSON.stringify({ r: { years: r.years.map(y => ({ year: y.year, ln: y.liuNian, god: y.god.abbr, expectGod: getTenGod(p.bazi.dayStemIdx, computeYearPillar(y.year).stemIdx).abbr,
      fav: y.favourable, expectFav: ud.favourable.includes(Math.floor(computeYearPillar(y.year).stemIdx/2)),
      months: y.months.map(m => ({ s: m.score, t: m.tier.en })), avg: y.avgScore, tier: y.tier.en, expectTier: classifyMonthlyTier(y.avgScore).en,
      inter: y.interactions, bazi: { y: p.bazi.yearBranchIdx, m: p.bazi.monthBranchIdx, d: p.bazi.dayBranchIdx, h: p.bazi.hourBranchIdx },
      best: y.bestMonths.map(m => m.score), worst: y.worstMonths.map(m => m.score), cycleStart: y.cycle.calendarYearStart })) },
    now: new Date().getFullYear(), clash: SIX_CLASH, harm: SIX_HARMONY }); })()`));
const yrs = out.r.years;
check(yrs.length === 3, 'three years returned');
check(yrs.map(y => y.year).join() === [out.now, out.now + 1, out.now + 2].join(), 'years are current + next 2');
yrs.forEach(y => {
  check(y.months.length === 12, `${y.year}: 12 monthly scores`);
  check(y.god === y.expectGod, `${y.year}: Ten God matches getTenGod`);
  check(y.fav === y.expectFav, `${y.year}: favourability matches the Detailed Reading's Useful God`);
  check(Math.abs(y.avg - y.months.reduce((s, m) => s + m.s, 0) / 12) < 1e-9, `${y.year}: year score is the mean of its 12 monthly scores`);
  check(y.tier === y.expectTier, `${y.year}: tier classified on the shared 7-tier scale`);
  check(Math.max(...y.months.map(m => m.s)) === y.best[0] && Math.min(...y.months.map(m => m.s)) === y.worst[0], `${y.year}: best/worst months are the true extremes`);
  const natal = [['year', y.bazi.y], ['month', y.bazi.m], ['day', y.bazi.d], ['hour', y.bazi.h]];
  natal.forEach(([k, idx]) => {
    const t = out.clash[y.ln.branchIdx] === idx ? 'clash' : (out.harm[y.ln.branchIdx] === idx ? 'harmony' : (y.ln.branchIdx === idx ? 'same' : null));
    const found = y.inter.find(i => i.palace === k);
    check((t === null && !found) || (found && found.type === t), `${y.year}: ${k} palace interaction is ${t}`);
  });
});

// --- Rendered output (English + Chinese), main profile and partner ---
for (const [lang, prefix] of [['en', 'i'], ['zh', 'i'], ['en', 'p']]) {
  run(`lang = '${lang}';`);
  const html = run(`generateDaYunAnnualDeepReadingHTML(getProfileData(getProfileByPrefix('${prefix}')))`);
  const text = html.replace(/<[^>]+>/g, ' ');
  check((html.match(/class="pill"/g) || []).length === 3, `${lang}/${prefix}: three annual cards`);
  check(!/undefined|NaN|\[object/.test(text), `${lang}/${prefix}: no undefined/NaN/[object] leaked into text`);
  // The 7-part deep analysis lives behind a "View Details" button (modal registry), so read it raw.
  const rawText = [0, 1, 2].map(i => run(`JSON.stringify(generateDeepAnalysisData('dayun_annual_deep', getProfileData(getProfileByPrefix('${prefix}')), { title: 't', yearData: computeDaYunAnnualDeepReading(getProfileData(getProfileByPrefix('${prefix}')), 3).years[${i}] }, true))`)).join(' ').replace(/<[^>]+>/g, ' ');
  check(!/undefined|NaN|\[object/.test(rawText), `${lang}/${prefix}: no undefined/NaN/[object] in the deep analysis`);
  check(/(Year theme|年度主题)/.test(rawText) && /(Natal chart interactions|与本命盘的互动)/.test(rawText) && /(Da Yun context|大运背景)/.test(rawText), `${lang}/${prefix}: deep-analysis carries theme, natal interactions and Da Yun context`);
  check(/(Career|事业)/.test(rawText) && /(Wealth|财运)/.test(rawText) && /(Relationships|感情)/.test(rawText) && /(Health|健康)/.test(rawText), `${lang}/${prefix}: career/wealth/relationship/health all present`);
  check(lang === 'zh' ? /[一-鿿]{10,}/.test(text) : true, `${lang}/${prefix}: Chinese text rendered in zh mode`);
}
run(`lang = 'en';`);
const hi = run(`generateDaYunAnnualDeepReadingHTML(getProfileData(getProfileByPrefix('i')))`).replace(/<[^>]+>/g, ' ');
const hp = run(`generateDaYunAnnualDeepReadingHTML(getProfileData(getProfileByPrefix('p')))`).replace(/<[^>]+>/g, ' ');
check(hi !== hp, 'partner gets their own reading, not a copy of the main profile');

// --- Table Reason column is now specific ---
const chart = run(`(function(){ const p = getProfileData(); renderSystemChart(p, 'i', null, false, null); return Object.values(chartTabRegistry['i']).join(''); })()`);
check(/Liu Yue [^\s<]+ = [A-Za-z ]+/.test(chart), 'monthly table Reason names the Liu Yue pillar and its Ten God');
check((chart.match(/Da Yun Annual Deep Reading/g) || []).length >= 3, 'chart (and so the PDF, which reuses chartTabRegistry) contains the annual cards');
const pdf = run(`buildProfilePdfHTML('i')`);
check(/Da Yun Annual Deep Reading/.test(pdf), 'main profile PDF contains the Da Yun annual deep reading');
const pdfP = run(`buildProfilePdfHTML('p')`);
check(/Da Yun Annual Deep Reading/.test(pdfP), 'partner PDF contains the Da Yun annual deep reading');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
