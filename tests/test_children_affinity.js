const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies "I do not see children affinity in any of the summary cards. Include them for all relevant areas":
// Children Affinity is now chart-derived (traditional children stars + Hour Pillar + Zi Wei Children palace +
// Western 5th house) instead of the old `sum % 3` number, and appears on the chart overview tiles, the Details
// Summary, the landing summary card, the Ming Li section, the Detailed Reading, and every PDF.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(__PROJECT_ROOT__, 'app.js'), 'utf8');
check(!/Number of Children Affinity/.test(appSrc), 'the old "Number of Children Affinity" (sum % 3) label is gone');
check(!/\$\{p\.children\}/.test(appSrc), 'nothing renders the arithmetic p.children value any more');

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
const person = (first, last, date, time, gender) => ({ englishFirstName: first, englishLastName: last, birthdate: date, birthtime: time, gender, birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, birthLatitude: 1.35 });
const user = {
  email: 'test@test.com', password: 'x',
  profile: person('Roy', 'Wong', '1976-09-07', '09:33', 'male'),
  partner: person('Tina', 'Seah', '1976-04-15', '10:00', 'female'),
  children: [person('Amy', 'Wong', '2005-03-03', '08:15', 'female')],
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};
const sb = freshSandbox();
const run = (s) => vm.runInContext(s, sb);
run(`state.users['test@test.com'] = ${JSON.stringify(user)}; state.active = 'test@test.com'; go('chart');`);

// --- 1. The derivation, cross-checked independently for a male and a female chart ---
const calc = JSON.parse(run(`(function(){ return JSON.stringify(['i', 'p', 'c0'].map(pref => { const p = getProfileData(getProfileByPrefix(pref)); const c = computeChildrenAffinity(p);
  const tg = computeAllTenGods(p.bazi); const want = p.isMale ? ['DO', '7K'] : ['EG', 'HO'];
  let n = 0; [tg.yearStem, tg.monthStem, tg.hourStem].forEach(g => { if (want.includes(g.abbr)) n++; });
  ['yearHidden', 'monthHidden', 'dayHidden', 'hourHidden'].forEach(k => tg[k].forEach(h => { if (want.includes(h.tenGod.abbr)) n++; }));
  let hn = (want.includes(tg.hourStem.abbr) ? 1 : 0); tg.hourHidden.forEach(h => { if (want.includes(h.tenGod.abbr)) hn++; });
  return { pref, isMale: p.isMale, total: c.total, expect: n, hour: c.hourStars, expectHour: hn, tier: c.tier.key, expectTier: n >= 3 ? 'strong' : (n >= 1 ? 'moderate' : 'light'), hasZw: !!c.zwChildren, house5: Array.isArray(c.house5) }; })); })()`));
calc.forEach(c => {
  check(c.total === c.expect, `${c.pref} (${c.isMale ? 'male' : 'female'}): children-star count matches an independent count (${c.total})`);
  check(c.hour === c.expectHour, `${c.pref}: Hour Pillar star count matches (${c.hour})`);
  check(c.tier === c.expectTier, `${c.pref}: tier follows the 3+/1-2/0 thresholds (${c.tier})`);
  check(c.hasZw && c.house5, `${c.pref}: Zi Wei Children palace and 5th-house data are included`);
});
check(calc.some(c => c.isMale) && calc.some(c => !c.isMale), 'both a male and a female chart were exercised');
// the Zi Wei children palace really is 3 steps back from the Life palace
check(run(`ZWDS_PALACE_NAMES_BY_STEP_BACK[3].en`) === 'Children', 'Zi Wei step 3 is the Children palace');

// --- 2. Every summary surface shows it (EN + ZH), for every profile type ---
for (const lang of ['en', 'zh']) {
  run(`lang = '${lang}';`);
  const label = lang === 'en' ? 'Children Affinity' : '子女缘';
  const valRe = lang === 'en' ? /(Strong|Moderate|Light) \(\d+ children stars?\)/ : /(较旺|中等|偏淡)（子女星\d+颗）/;
  for (const pref of ['i', 'p', 'c0']) {
    const chart = run(`(function(){ const head = renderSystemChart(getProfileData(getProfileByPrefix('${pref}')), '${pref}', null, false, null); return head + Object.values(chartTabRegistry['${pref}']).join(''); })()`);
    const plain = chart.replace(/<span class="tip-i"[^>]*>[^<]*<\/span>/g, '').replace(/\sdata-tip="[^"]*"/g, '');
    const text = plain.replace(/<[^>]+>/g, ' ');
    check((plain.match(new RegExp(label, 'g')) || []).length >= 3, `${lang}/${pref}: Children Affinity appears in the overview tile, Details Summary and Ming Li (${(plain.match(new RegExp(label, 'g')) || []).length})`);
    check(valRe.test(text), `${lang}/${pref}: it shows a tier and star count`);
    const landing = run(`generateSummaryCardHTML(getProfileData(getProfileByPrefix('${pref}')), ${pref === 'i' ? 'null' : 'getProfileData()'}, false, false, '${pref}')`).replace(/<[^>]+>/g, ' ');
    check(landing.includes(label) && valRe.test(landing), `${lang}/${pref}: the landing summary card shows it`);
  }
}
run(`lang = 'en';`);

// --- 3. Order: the new tile sits between Ba Zhai Kua and Flying Star on both card types ---
const overview = run(`renderSystemChart(getProfileData(), 'i', null, false, null)`);
const iBz = overview.indexOf('Ba Zhai Kua'), iCh = overview.indexOf('Children Affinity'), iFs = overview.indexOf('Flying Star (');
check(iBz !== -1 && iCh > iBz && iFs > iCh, 'Children Affinity tile sits between Ba Zhai Kua and Flying Star');

// --- 4. Detailed Reading + PDFs ---
const html = run(`generateDetailedReading(getProfileData(), 'i')`);
const text = html.replace(/<[^>]+>/g, ' ');
check(/Cross-system view: Children/.test(text), 'the Detailed Reading has a Children cross-system block');
const block = text.split('Cross-system view: Children')[1].split('6) Health')[0];
check(/Children Affinity: (Strong|Moderate|Light)/.test(block) && /Hour Pillar \(the traditional children palace\)/.test(block), 'BaZi children signals (affinity tier + Hour Pillar) are in the block');
check(/Children palace:/.test(block), 'Zi Wei Children palace is in the block');
check(/House 5 \(/.test(block), 'Western 5th house is in the block');
check(/>Children<\/th>/.test(html), 'the integrated overview matrix has a Children column');
for (const pref of ['i', 'p', 'c0']) {
  const pdf = run(`buildProfilePdfHTML('${pref}')`);
  check((pdf.match(/Children Affinity/g) || []).length >= 3 && !/data-tip=/.test(pdf) && !/tip-i/.test(pdf), `${pref}: PDF carries Children Affinity (tile, summary, Ming Li) without tooltip markup`);
  check(/Cross-system view: Children/.test(pdf), `${pref}: PDF's Detailed Reading carries the Children block`);
}
// native pipeline parity (dormant, but kept in step)
check(/label: bt\('Children Affinity','子女缘'\)/.test(appSrc) && /\[bt\('Children Affinity','子女缘'\), childrenAffinityValue\(p\)\]/.test(appSrc), 'the native PDF summary tile and row also include it');
check(!/undefined|NaN|\[object/.test(text), 'no undefined/NaN/[object] in the reading');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
