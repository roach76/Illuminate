const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the app-wide tooltip system ("there should be a tooltip to show the details of the years when
// hovered over them in the Da Yun. Look at the whole app and implement tooltips where relevant information
// can be shown"): the shared hover/focus/tap mechanism, the Da Yun year-by-year tooltip (and its visible PDF
// equivalent), and the tooltips added across the overview tiles, BaZi pillars, monthly tables and more.
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
  return { sandbox, dom };
}
const person = (first, last, date, time, gender) => ({ englishFirstName: first, englishLastName: last, birthdate: date, birthtime: time, gender, birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 });
const user = {
  email: 'test@test.com', password: 'x',
  profile: person('Roy', 'Wong', '1976-09-07', '09:33', 'male'),
  partner: person('Tina', 'Seah', '1976-04-15', '10:00', 'female'),
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};
const { sandbox: sb, dom } = freshSandbox();
const run = (s) => vm.runInContext(s, sb);
run(`state.users['test@test.com'] = ${JSON.stringify(user)}; state.active = 'test@test.com'; go('chart');`);
const doc = dom.window.document;
const ev = (type, target, init) => target.dispatchEvent(new dom.window.Event(type, Object.assign({ bubbles: true }, init || {})));

// --- tipAttr ---
const attr = run(`tipAttr('He said "hi" <b>x</b> & more\\nline2')`);
check(/^ data-tip="[^"]*" tabindex="0"$/.test(attr), 'tipAttr yields a single well-formed attribute pair (quotes escaped)');
check(!/<b>/.test(attr) && /&lt;b&gt;/.test(attr) && /&#10;/.test(attr), 'tipAttr escapes HTML and encodes newlines');
check(run(`tipAttr('')`) === '' && run(`tipAttr(null)`) === '', 'tipAttr is empty for empty input');

// --- Runtime: hover, focus, escape, single instance ---
check(doc.querySelectorAll('#appTooltip').length === 1, 'exactly one floating #appTooltip exists');
run(`initTooltips()`);
check(doc.querySelectorAll('#appTooltip').length === 1, 'initTooltips is idempotent');
const probe = doc.createElement('span'); probe.id = 'probeTip'; probe.innerHTML = '<b id="probeChild">child</b>';
probe.setAttribute('data-tip', 'Line one\nLine two'); doc.body.appendChild(probe);
const other = doc.createElement('span'); other.id = 'probeNoTip'; other.textContent = 'plain'; doc.body.appendChild(other);
const tip = doc.getElementById('appTooltip');
ev('mouseover', doc.getElementById('probeChild'));
check(tip.classList.contains('show') && tip.textContent === 'Line one\nLine two', 'hovering a child of a [data-tip] element shows the tip text (newlines kept)');
ev('mouseover', other);
check(!tip.classList.contains('show'), 'moving to an element without a tip hides it');
ev('focusin', probe);
check(tip.classList.contains('show'), 'keyboard focus shows the tip');
doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
check(!tip.classList.contains('show'), 'Escape hides the tip');

// --- Da Yun table ---
const view = JSON.parse(run(`(function(){ const p = getProfileData(); renderSystemChart(p, 'i', null, false, null);
  const cycles = p.daYunPillars.filter(dy => (dy.age + 9) >= computeCurrentAge(p.birthdate));
  const dy = cycles[0]; const ug = computeDetailedReadingAnalysis(p).usefulGod;
  const y = dy.calendarYearStart + 3, ln = computeYearPillar(y);
  return JSON.stringify({ cycleCount: cycles.length, y, pillar: stemCN[ln.stemIdx] + branchCN[ln.branchIdx], god: getTenGod(p.bazi.dayStemIdx, ln.stemIdx).en,
    fav: ug.favourable.includes(Math.floor(ln.stemIdx / 2)), dyPillar: stemCN[dy.stemIdx] + branchCN[dy.branchIdx] }); })()`));
const scratch = doc.createElement('div'); scratch.id = 'scratch';
scratch.innerHTML = run(`Object.values(chartTabRegistry['i']).join('')`);
doc.body.appendChild(scratch);
const cycleRows = Array.from(scratch.querySelectorAll('tr[data-tip]')).filter(tr => /Each year:/.test(tr.getAttribute('data-tip')));
check(cycleRows.length === view.cycleCount && view.cycleCount > 0, `one tooltip row per displayed Da Yun cycle (${cycleRows.length}/${view.cycleCount})`);
const firstTip = cycleRows[0].getAttribute('data-tip');
check(firstTip.split('\n').length === 3 + 10, 'cycle tooltip = 3 header lines + 10 year lines');
check(firstTip.includes(view.dyPillar), 'cycle tooltip names the cycle pillar');
const yearLine = firstTip.split('\n').find(l => l.startsWith(String(view.y)));
check(yearLine && yearLine.includes(view.pillar) && yearLine.includes(view.god) && yearLine.includes(view.fav ? '✓' : '✗'), `year line for ${view.y} matches computeYearPillar/getTenGod/Useful God (${yearLine})`);
ev('mouseover', cycleRows[0].querySelector('td span.tip-u'));
check(tip.classList.contains('show') && tip.textContent === firstTip, 'hovering the Years/Ages text of a Da Yun row shows its year-by-year tooltip');
ev('mouseover', other);
check(scratch.querySelectorAll('tr[data-tip] span[data-tip]').length > 0, 'rating badges inside the Da Yun table carry their own (full tier name) tip');

// --- Other tooltips in the chart ---
const tipsOf = (sel) => Array.from(scratch.querySelectorAll(sel)).map(e => e.getAttribute('data-tip'));
const allTips = tipsOf('[data-tip]');
check(allTips.some(t => /Heavenly Stem of your Day Pillar/.test(t)), 'Day Master tile/row has a glossary tip');
check(allTips.some(t => /Cheng Gu/.test(t)), 'Bone Weight has a glossary tip');
check(allTips.some(t => /\((P|RW|EG|HO|IW|DW|7K|DO|IR|DR|DM)\): /.test(t)), 'BaZi pillar stems/hidden stems carry Ten God tips');
check(allTips.some(t => /Year Pillar \(ancestry/.test(t)) && allTips.some(t => /Hour Pillar \(children/.test(t)), 'BaZi pillar headers carry palace meaning tips');
check(allTips.some(t => /Stage scores: Day Master vs Da Yun/.test(t)), '36-month Da Yun table rows carry the stage-score breakdown');
check(allTips.some(t => /Sun-sign Element\/Modality match only/.test(t)), '36-month astrology rows carry a tip');
check(allTips.some(t => /Extremely|Very|Auspicious|Inauspicious|Cautionary|Neutral/.test(t) && t.length < 40), 'tier chips carry the tier name');
const stripChip = Array.from(scratch.querySelectorAll('span[data-tip]')).find(e => /^\d+<br>/.test(e.innerHTML));
check(!!stripChip && /Liu Yue/.test(stripChip.getAttribute('data-tip')), '12-month strip chips carry the month detail');
check(!/title="/.test(scratch.innerHTML), 'no leftover native title= tooltips (replaced by the shared tooltip)');
// Every tip is non-empty and has no leaked placeholders
check(allTips.every(t => t && !/undefined|NaN|\[object/.test(t)), `all ${allTips.length} tips are clean (no undefined/NaN/[object])`);

// --- Chinese ---
run(`lang = 'zh'; renderSystemChart(getProfileData(), 'i', null, false, null);`);
const zhHtml = run(`Object.values(chartTabRegistry['i']).join('')`);
const zhScratch = doc.createElement('div'); zhScratch.innerHTML = zhHtml;
const zhTips = Array.from(zhScratch.querySelectorAll('[data-tip]')).map(e => e.getAttribute('data-tip'));
check(zhTips.length === allTips.length, 'same number of tips in Chinese');
check(zhTips.some(t => /日柱的天干/.test(t)) && zhTips.some(t => /逐年：流年干支/.test(t)), 'tips are translated in Chinese mode');
check(zhTips.every(t => !/undefined|NaN|\[object/.test(t)), 'Chinese tips are clean');
run(`updateStaticLanguage();`);
check(/PDF/.test(doc.querySelector('.btnExportPdf').getAttribute('data-tip')) && /导出/.test(doc.querySelector('.btnExportPdf').getAttribute('data-tip')), 'static icon-button tips follow the language toggle');
run(`lang = 'en'; updateStaticLanguage();`);
check(/Export/.test(doc.querySelector('.btnExportPdf').getAttribute('data-tip')), 'static icon-button tips switch back to English');

// --- PDF: tooltips are stripped, but the year-by-year Da Yun detail is written visibly ---
const pdf = run(`buildProfilePdfHTML('i')`);
check(!/data-tip=/.test(pdf) && !/tip-i/.test(pdf) && !/class="tip-u"/.test(pdf), 'PDF HTML contains no tooltip attributes or (i) markers');
const plain = pdf.replace(/<[^>]+>/g, ' ');
check(plain.includes(`${view.y}`) && plain.includes('Each year: Liu Nian pillar') && plain.includes(view.pillar), 'PDF carries the visible year-by-year detail for the Da Yun cycles');
check((pdf.match(/Each year: Liu Nian pillar/g) || []).length === view.cycleCount, 'PDF has one year-by-year detail block per Da Yun cycle');
const pdfP = run(`buildProfilePdfHTML('p')`);
check(/Each year: Liu Nian pillar/.test(pdfP) && !/data-tip=/.test(pdfP), 'partner PDF has the year-by-year detail and no tooltip attributes');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
