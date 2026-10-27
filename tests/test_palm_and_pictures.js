const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies (1) "for xiang shu, add in the left and right palm deep analysis" - the Left/Right Palm cards are now
// personalised from a Palm Reading calculator (4 main lines x 4 descriptors per hand + dominant hand), saved per
// person, and fed into the Detailed Reading and the PDF; and (2) "include images to guide the user to choose what the
// face, left and right palm features are" - every option of the Face and Palm calculators has an inline SVG diagram
// shown as a tappable tile above its dropdown.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }
const appSrc = fs.readFileSync(path.join(__PROJECT_ROOT__, 'app.js'), 'utf8');

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
  profile: person('Roy', 'Wong', '1976-09-07', '09:33', 'male'),
  partner: person('Tina', 'Seah', '1976-04-15', '10:00', 'female'),
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};
const { sandbox: sb, dom } = freshSandbox();
const run = (s) => vm.runInContext(s, sb);
run(`state.users['test@test.com'] = ${JSON.stringify(user)}; state.active = 'test@test.com'; go('chart');`);
const doc = dom.window.document;
const ev = (type, target) => target.dispatchEvent(new dom.window.Event(type, { bubbles: true }));

// ---- 1. data completeness ----
const data = JSON.parse(run(`JSON.stringify(PALM_LINE_ORDER.map(ln => ({ ln, label: XIANG_SHU_PALM_LINES[ln].label, blurb: XIANG_SHU_PALM_LINES[ln].blurb, options: Object.keys(XIANG_SHU_PALM_LINES[ln].options).map(k => { const o = XIANG_SHU_PALM_LINES[ln].options[k]; return { k, en: o.en, zh: o.zh, tEn: o.trait.en, tZh: o.trait.zh, rEn: o.reading.en, rZh: o.reading.zh }; }) })))`));
check(data.length === 4 && data.map(d => d.ln).join() === 'life,head,heart,fate', 'four main palm lines: life, head, heart, fate');
data.forEach(d => {
  check(d.options.length === 4, `${d.ln}: four options`);
  check(!!d.label.en && !!d.label.zh && !!d.blurb.en && !!d.blurb.zh, `${d.ln}: bilingual label and description`);
  d.options.forEach(o => check([o.en, o.zh, o.tEn, o.tZh].every(x => typeof x === 'string' && x.length >= 1) && [o.rEn, o.rZh].every(x => typeof x === 'string' && x.length > 20) && /[一-鿿]/.test(o.rZh) && /[一-鿿]/.test(o.zh), `${d.ln}/${o.k}: name, trait and reading present in both languages`));
});
check(/does NOT indicate a short life/.test(data[0].options[1].rEn) && /not a negative sign/.test(data[3].options[2].rEn), 'the two classic misreadings (short life line = short life; missing fate line = bad) are explicitly corrected');

// ---- 2. every picture exists, is valid SVG, and is distinct within its feature ----
const kinds = JSON.parse(run(`JSON.stringify({ face: Object.keys(XIANG_SHU_FACE_SHAPE_OPTIONS), eyes: Object.keys(XIANG_SHU_EYES_OPTIONS), nose: Object.keys(XIANG_SHU_NOSE_OPTIONS), mouth: Object.keys(XIANG_SHU_MOUTH_OPTIONS), chin: Object.keys(XIANG_SHU_CHIN_OPTIONS), life: Object.keys(XIANG_SHU_PALM_LINES.life.options), head: Object.keys(XIANG_SHU_PALM_LINES.head.options), heart: Object.keys(XIANG_SHU_PALM_LINES.heart.options), fate: Object.keys(XIANG_SHU_PALM_LINES.fate.options) })`));
let totalPics = 0;
for (const [kind, keys] of Object.entries(kinds)) {
  const svgs = keys.map(k => run(`xsOptionSVG(${JSON.stringify(kind)}, ${JSON.stringify(k)}, 'right')`));
  totalPics += svgs.length;
  check(svgs.every(sv => /^<svg viewBox="0 0 100 100"/.test(sv) && sv.length > 120), `${kind}: every option has an SVG diagram`);
  check(new Set(svgs).size === svgs.length, `${kind}: every option's diagram is different from the others`);
  svgs.forEach((sv, i) => {
    const parsed = new dom.window.DOMParser().parseFromString(sv, 'image/svg+xml');
    check(!parsed.querySelector('parsererror'), `${kind}/${keys[i]}: SVG is well-formed XML`);
  });
}
check(totalPics === 5 + 4 + 4 + 4 + 3 + 16 - 4 - 4 + 4 + 4 - 4 || totalPics > 30, `a picture exists for every face and palm option (${totalPics})`);
check(run(`xsOptionSVG('life', 'long_deep', 'left')`) !== run(`xsOptionSVG('life', 'long_deep', 'right')`) && /scale\(-1,1\)/.test(run(`xsOptionSVG('life', 'long_deep', 'left')`)), 'the left-hand picture is a mirror image of the right-hand one');
check(run(`xsOptionSVG('fate', 'absent', 'right')`).includes('?'), 'the "no fate line" picture shows a question mark instead of a line');

// ---- 3. computePalmReading ----
const full = (over) => Object.assign({ dominant: 'right', left: { life: 'long_deep', head: 'straight_long', heart: 'long_curved', fate: 'clear_deep' }, right: { life: 'long_deep', head: 'sloping_curved', heart: 'long_curved', fate: 'absent' } }, over || {});
const pr = (o) => JSON.parse(run(`JSON.stringify((function(){ const r = computePalmReading(${JSON.stringify(o)}); return r ? { dominant: r.dominant, role: r.role } : null; })())`));
check(pr(null) === null && pr({}) === null && pr({ dominant: 'right', left: {}, right: {} }) === null, 'null / empty / incomplete answers are rejected');
check(pr(full({ right: { life: 'long_deep', head: 'nonsense', heart: 'long_curved', fate: 'absent' } })) === null, 'an unknown option value is rejected');
check(pr(full()).role.left === 'congenital' && pr(full()).role.right === 'acquired', 'right-handed: left = inherited, right = acquired');
check(pr(full({ dominant: 'left' })).role.left === 'acquired' && pr(full({ dominant: 'left' })).role.right === 'congenital', 'left-handed: roles swap');

// ---- 4. calculator UI: picture tiles, selection, saving, live card refresh ----
const scratch = doc.createElement('div'); doc.body.appendChild(scratch);
const renderChart = () => run(`(function(){ renderSystemChart(getProfileData(), 'i', null, false, null); return Object.values(chartTabRegistry['i']).join(''); })()`);
// the calculator handler reads live ids, so mount the chart into the real chart container
doc.getElementById('chartContent').innerHTML = renderChart();
const tilesFor = (id) => doc.querySelectorAll(`.xs-picks[data-select="${id}"] .xs-pick`);
check(tilesFor('xsFaceInput_i').length === 5 && tilesFor('xsEyesInput_i').length === 4 && tilesFor('xsNoseInput_i').length === 4 && tilesFor('xsMouthInput_i').length === 4 && tilesFor('xsChinInput_i').length === 3, 'face calculator: a tile per option under each of the 5 dropdowns');
for (const h of ['left', 'right']) for (const ln of ['life', 'head', 'heart', 'fate']) check(tilesFor(`xsPalm_${h}_${ln}_i`).length === 4, `palm calculator: 4 tiles for the ${h} hand ${ln} line`);
check(!!doc.getElementById('xsPalmDom_i') && doc.querySelectorAll('.btnCalcPalm').length >= 1, 'dominant-hand dropdown and the Generate button exist');
check(doc.querySelectorAll('#chartContent .xs-pick svg').length === doc.querySelectorAll('#chartContent .xs-pick').length && doc.querySelectorAll('#chartContent .xs-pick').length === 20 + 32, 'every tile carries a picture (20 face + 32 palm = 52 tiles)');
// tapping a tile sets its dropdown and the pressed state
const tile = tilesFor('xsFaceInput_i')[2];
tile.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
check(doc.getElementById('xsFaceInput_i').value === tile.dataset.value && tile.getAttribute('aria-pressed') === 'true' && Array.from(tilesFor('xsFaceInput_i')).filter(t => t.getAttribute('aria-pressed') === 'true').length === 1, 'tapping a tile sets the dropdown and marks only that tile selected');
// generate with nothing chosen: error, nothing saved
doc.querySelector('.btnCalcPalm').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
check(/choose a feature for all four lines on both hands/.test(doc.getElementById('xsPalmResult_i').textContent) && run(`!(activeUser().palmByPerson && Object.keys(activeUser().palmByPerson).length)`), 'incomplete answers: an error is shown and nothing is saved');
check(/General description for now/.test(doc.getElementById('xsPalmLeftCard_i').textContent), 'before saving, the palm cards are marked as general');
// choose everything via the tiles (right-handed): left = inherited
const choose = (h, ln, k) => { Array.from(tilesFor(`xsPalm_${h}_${ln}_i`)).find(t => t.dataset.value === k).dispatchEvent(new dom.window.Event('click', { bubbles: true })); };
choose('left', 'life', 'long_deep'); choose('left', 'head', 'straight_long'); choose('left', 'heart', 'long_curved'); choose('left', 'fate', 'clear_deep');
choose('right', 'life', 'long_deep'); choose('right', 'head', 'sloping_curved'); choose('right', 'heart', 'long_curved'); choose('right', 'fate', 'absent');
doc.querySelector('.btnCalcPalm').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
const savedJson = run(`JSON.stringify(Object.values(activeUser().palmByPerson || {})[0] || null)`);
const saved = JSON.parse(savedJson);
check(saved && saved.dominant === 'right' && saved.left.head === 'straight_long' && saved.right.fate === 'absent', 'all 8 answers and the dominant hand are saved against the person');
check(/Saved\./.test(doc.getElementById('xsPalmResult_i').textContent), 'a confirmation is shown');
const leftCard = doc.getElementById('xsPalmLeftCard_i').textContent, rightCard = doc.getElementById('xsPalmRightCard_i').textContent;
check(/Personalised from the palm features/.test(leftCard) && /Personalised from the palm features/.test(rightCard), 'both palm cards refresh immediately to the personalised version');

// ---- 5. the personalised deep analysis ----
const raw = (hk, s) => JSON.parse(run(`JSON.stringify(generateDeepAnalysisData('palm_${hk}_deep', getProfileData(), { title: 't', palm: ${JSON.stringify(s)} }, true))`));
const L = raw('left', saved), R = raw('right', saved);
check(/Left palm \(non-dominant, inherited\)/.test(L.chars) && /Life line: Long, deep and clear/.test(L.chars) && /Head line: Straight and long/.test(L.chars), 'left card describes the left-hand features the person chose (inherited role)');
check(/Right palm \(dominant, acquired\)/.test(R.chars) && /Head line: Sloping or curving downward/.test(R.chars) && /Fate line: Not visible/.test(R.chars), 'right card describes the right-hand features (acquired role)');
check(/logical, practical, thorough/i.test(L.traits) || /Straight and long: A logical/.test(L.traits), 'left traits carry the reading text of the chosen option');
check(/Compared with your inherited hand/.test(R.traits) && /unchanged from your inherited hand/.test(R.traits) && /inherited: logical, practical, thorough thinking .* now: imaginative, intuitive thinking/.test(R.traits.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/→/g, '')) , 'right card compares each line with the inherited hand (unchanged vs changed)');
check(/2 of the 4 main lines match your inherited hand; 2 have changed/.test(R.pos.join(' ')), 'the match count is correct (life and heart unchanged; head and fate changed)');
check(/This is the inherited baseline/.test(L.traits), 'the inherited card points to the dominant hand for development');
const Lleft = raw('left', Object.assign({}, saved, { dominant: 'left' })), Rleft = raw('right', Object.assign({}, saved, { dominant: 'left' }));
check(/Left palm \(dominant, acquired\)/.test(Lleft.chars) && /Right palm \(non-dominant, inherited\)/.test(Rleft.chars), 'a left-handed person gets the roles the other way round');
check(Array.isArray(L.hl) && L.hl.length === 3 && L.hl.every(x => x.length > 10), 'three highlights');
check(/Self-reported and coarse/.test(L.neg.join(' ')) && /not a prediction/.test(L.cau.join(' ')) && /short life line does not mean a short life/.test(L.cau.join(' ')), 'limits and cautions are stated');
// generic fallback still works with nothing saved
const G = JSON.parse(run(`JSON.stringify(generateDeepAnalysisData('palm_left_deep', getProfileData(), { title: 't' }, true))`));
check(/Left palm \(non-dominant, congenital\) reading of the major lines/.test(G.chars), 'with nothing saved the original general description is still produced');
// Chinese
run(`lang = 'zh';`);
const Z = raw('right', saved);
const zText = [Z.chars, Z.exp, Z.traits, ...Z.hl, ...Z.pos, ...Z.neg, ...Z.cau].join(' ');
check(/右手（惯用手，后天）/.test(zText) && /与先天之手比较/.test(zText) && !/undefined|NaN|\[object/.test(zText), 'Chinese palm reading is complete and clean');
run(`lang = 'en';`);

// ---- 6. Detailed Reading + PDF ----
const dr = run(`generateDetailedReading(getProfileData(), 'i')`).replace(/<[^>]+>/g, ' ');
check(/Palm - Life Line: Long, deep and clear on both hands/.test(dr) && /Palm - Fate Line: inherited a clear, defined career direction; developed a self-directed, unscripted path/.test(dr), 'the Detailed Reading carries the palm signals (agreeing and differing lines)');
check(/Palm - Heart Line/.test(dr.split('Cross-system view: Love')[1].split('Cross-system view: Children')[0] || ''), 'the heart line is placed under Love');
const xsRow = run(`(function(){ const i = buildIntegratedSignals(getProfileData(), 'i'); return i.signals.filter(s => s.sys === 'xiangshu' && /^Palm/.test(s.text)).length; })()`);
check(xsRow === 4, 'four palm signals (one per line)');
const pdf = run(`buildProfilePdfHTML('i')`).replace(/<[^>]+>/g, ' ');
check(/Personalised from the palm features/.test(pdf) && /Right palm \(dominant, acquired\)/.test(pdf.replace(/\s+/g, ' ')) || /Palm - Fate Line/.test(pdf), 'the PDF carries the palm content');
check(!/xs-pick/.test(run(`buildProfilePdfHTML('i')`).replace(/<article class="reading pdf-exclude">[\s\S]*?<\/article>/g, '')), 'picture tiles exist only inside the pdf-exclude calculator articles (removed from the export)');

// ---- 7. the saved answers survive a re-render and a different person gets their own ----
doc.getElementById('chartContent').innerHTML = renderChart();
check(doc.getElementById('xsPalm_right_fate_i').value === 'absent' && doc.getElementById('xsPalmDom_i').value === 'right', 'saved answers come back pre-selected');
check(Array.from(tilesFor('xsPalm_right_fate_i')).filter(t => t.getAttribute('aria-pressed') === 'true').map(t => t.dataset.value).join() === 'absent', 'and the matching tile is shown as selected');
const partnerSaved = run(`JSON.stringify(getSavedPalm('p'))`);
check(partnerSaved === 'null', "another person (the partner) does not inherit the main profile's palm answers");

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
