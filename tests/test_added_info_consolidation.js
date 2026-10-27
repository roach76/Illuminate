const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies "with the inclusion of the xiang shu info, the reading should include these information as a consolidated
// reading ... taken into consideration for all aspects when additional information is provided": the Detailed Reading
// now has a "Consolidated Reading of Your Added Information" section (face + palm themes, area-by-area comparison with
// the calculated charts), every cross-system block carries a "Consolidated with your added information" line, the
// Full Total Summary has an "Added information" bullet, and Xiang Shu signals carry polarity only where an option's own
// reading is explicitly favourable / challenging.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

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
};
const sb = freshSandbox();
const run = (s) => vm.runInContext(s, sb);
run(`state.users['test@test.com'] = ${JSON.stringify(user)}; state.active = 'test@test.com'; go('chart');`);
const text = (h) => h.replace(/<[^>]+>/g, ' ');

// --- 1. Nothing saved: the section still renders, says what is missing, and nothing is invented ---
const none = text(run(`generateDetailedReading(getProfileData(), 'i')`));
check(/11\) Consolidated Reading of Your Added Information/.test(none), 'section 11 is present even with no Xiang Shu saved');
check(/Xiang Shu - face features - not on file yet/.test(none) && /Xiang Shu - left & right palm - not on file yet/.test(none), 'it lists face and palm as not on file');
check(!/What your face and palm say together/.test(none), 'no face/palm themes are invented when nothing is saved');
check(/12\) Full Total Summary/.test(none) && /13\) Integrated Cross-System Overview/.test(none) && /14\) Systems Consulted/.test(none), 'later sections are renumbered 12-14');

// --- 2. Polarity only where an option's own reading is explicit ---
const pol = JSON.parse(run(`(function(){
  const out = {};
  const probe = (nose, chin, life, fate) => {
    const key = xiangShuPersonKey(getProfileByPrefix('i'));
    const u = activeUser();
    u.xiangShuByPerson = { [key]: { face: 'round', eyes: 'bright', nose, mouth: 'large_thick', chin } };
    const mk = (h, l, d, hr, f) => ({ life: l, head: d, heart: hr, fate: f });
    u.palmByPerson = { [key]: { dominant: 'right', left: mk('l', 'short_faint', 'short', 'straight', 'absent'), right: mk('r', life, 'straight_long', 'long_curved', fate) } };
    const i = buildIntegratedSignals(getProfileData(), 'i');
    const xs = i.signals.filter(s => s.sys === 'xiangshu');
    return { wealth: xs.filter(s => s.doms.includes('wealth')).map(s => s.pol), career: xs.filter(s => s.doms.includes('career')).map(s => s.pol), life: xs.filter(s => s.doms.includes('life')).map(s => s.pol), n: xs.length, themes: i.themes, hasFace: i.hasFace, hasPalm: i.hasPalm };
  };
  out.fav = probe('straight_full', 'round_full', 'long_deep', 'clear_deep');
  out.chal = probe('low_pointed', 'pointed_narrow', 'short_faint', 'absent');
  out.neutral = probe('low_full', 'square_strong', 'broken_chained', 'shifting');
  return JSON.stringify(out);
})()`));
check(pol.fav.hasFace && pol.fav.hasPalm, 'both face and palm are detected as on file');
check(pol.fav.wealth.includes(1) && pol.fav.career.includes(1), 'straight bridge + full tip: Wealth Palace is supportive for wealth AND career');
check(pol.chal.wealth.includes(-1) && pol.chal.career.includes(-1), 'low bridge + pointed tip: cautionary for wealth AND career (its own reading calls it the challenging combination)');
check(pol.fav.life.includes(1) && pol.chal.life.includes(-1), 'chin and (developed) life line polarity follow the explicit readings');
check(pol.chal.life.filter(x => x < 0).length === 1, 'a short/faint life line is NOT counted as negative (only the pointed chin is)');
check(pol.neutral.wealth.every(x => x === 0) && pol.neutral.career.every(x => x === 0), 'descriptive options (slow-but-steady nose, shifting fate line) stay neutral');
check(pol.fav.n === 5 + 4 && pol.fav.themes.featureCount === 9, 'five face features + four dominant-hand lines are counted (9)');

// --- 3. With face + palm saved: consolidated section, themes, area lines, block lines, summary bullet ---
run(`(function(){
  const key = xiangShuPersonKey(getProfileByPrefix('i')); const u = activeUser();
  u.xiangShuByPerson = { [key]: { face: 'square', eyes: 'calm', nose: 'straight_full', mouth: 'small_thin', chin: 'square_strong' } };
  u.palmByPerson = { [key]: { dominant: 'right',
    left: { life: 'short_faint', head: 'short', heart: 'straight', fate: 'absent' },
    right: { life: 'long_deep', head: 'straight_long', heart: 'ends_middle', fate: 'clear_deep' } } };
})()`);
const html = run(`generateDetailedReading(getProfileData(), 'i')`);
const t = text(html);
check(/Xiang Shu - face features - on file and used below/.test(t) && /Xiang Shu - left & right palm - on file and used below/.test(t), 'status list shows face and palm on file');
check(/Name analysis - (on file|not on file)/.test(t), 'name analysis status is listed');
check(/What your face and palm say together/.test(t), 'the face + palm themes block is rendered');
check(/steady, patient and methodical\s*- shows up in/.test(t), 'a steady theme recurs (calm eyes, square chin, straight-long head line, clear fate line, long life line)');
check(!/decisive and quick to conclude\s*- shows up in/.test(t), 'a theme carried by only ONE feature (decisive: just the square face) is NOT called recurring');
check(/reserved, private and careful\s*- shows up in/.test(t), 'a reserved theme recurs (small thin mouth, ends-middle heart line)');
check(/Area by area/.test(t) && /Wealth:\s*Xiang Shu/.test(t.replace(/\s+/g, ' ')), 'area-by-area lines are present and name Xiang Shu for Wealth');
const blocks = (html.match(/Consolidated with your added information/g) || []).length;
check(blocks >= 5, `cross-system blocks carry a consolidated line (${blocks} found)`);
check(/Added information:/.test(t) && /weighed against the charts in \d+ life area/.test(t), 'Full Total Summary has the Added information bullet');
check(/Recurring themes? across your face and palm/.test(t), 'the summary bullet names the recurring themes');
check(!/undefined|NaN|\[object/.test(t), 'no "undefined", NaN or [object] in the English reading');

// --- 4. The verdict logic itself ---
const v = JSON.parse(run(`(function(){
  const sig = (sys, pol, doms) => ({ sys, pol, doms: doms || ['wealth'], text: 'x' });
  const mk = (arr) => ({ signals: arr });
  const k = (arr) => { const r = integAddedVerdict(mk(arr), 'wealth'); return r ? r.kind : null; };
  return JSON.stringify({
    agreeUp: k([sig('xiangshu', 1), sig('bazi', 1), sig('qmdj', 1)]),
    agreeDown: k([sig('xiangshu', -1), sig('bazi', -1)]),
    differ: k([sig('xiangshu', 1), sig('bazi', -1), sig('qmdj', -1)]),
    addedOnly: k([sig('xiangshu', 1), sig('bazi', 0), sig('qmdj', 1), sig('zodiac', -1)]),
    descriptive: k([sig('xiangshu', 0), sig('bazi', 1)]),
    none: k([sig('bazi', 1)]),
    nameCounts: k([sig('name', -1), sig('bazi', -1)]),
    assetsCounts: k([sig('assets', 1), sig('bazi', 1)]),
    compatCounts: k([sig('compat', 1), sig('bazi', -1)])
  });
})()`));
check(v.agreeUp === 'agree' && v.agreeDown === 'agree', 'same lean => agree');
check(v.differ === 'differ', 'opposite lean => differ');
check(v.addedOnly === 'added-only', 'charts evenly split + added info leaning => added-only');
check(v.descriptive === 'descriptive', 'added info with no rating => descriptive');
check(v.none === null, 'no added-information system => no verdict');
check(v.nameCounts === 'agree' && v.assetsCounts === 'agree' && v.compatCounts === 'differ', 'name, assets and partner compatibility are treated as added information too');

// --- 5. Chinese rendering is clean and uses the real Chinese labels ---
run(`lang = 'zh';`);
const zh = text(run(`generateDetailedReading(getProfileData(), 'i')`));
run(`lang = 'en';`);
check(/您所补充资料的综合解读/.test(zh) && /与您所提供资料的综合/.test(zh) && /您的面相与手相综合所示/.test(zh) && /补充资料：/.test(zh), 'Chinese section, block line, themes heading and summary bullet are present');
check(!/undefined|NaN|\[object/.test(zh), 'no "undefined", NaN or [object] in the Chinese reading');

// --- 6. PDF: the Detailed Reading used by the PDF carries the new section for every profile type ---
const pdfHtml = text(run(`generateDetailedReading(getProfileData(getProfileByPrefix('p')), 'p')`));
check(/Consolidated Reading of Your Added Information/.test(pdfHtml), 'the partner profile reading (as used in the PDF) carries the section too');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
