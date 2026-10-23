const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies "truncation of words in page 18 ... check all for such scenarios and ensure no truncations".
// Page 18 of a real export ended with the I Ching hexagram's caption ("Gold line marks the moving line") cut in half.
// Root cause: that caption is a capture unit whose OWN root has `margin:-8px 0 8px`; captured inside a flow-root
// wrapper, part of the text sat outside the wrapper's measured box and was clipped when the unit was sliced out of
// the batch canvas. (An audit of every element in a full export found this was the only negative-margin element.)
// Fixes: negative margins on a unit's own root are zeroed on the clone; a `.chart-caption` unit is kept with the
// graphic above it; and the pixel-slice step now refuses to cut through ink - it searches wider for a blank row and,
// failing that, starts a unit that fits one page on a fresh page instead of tearing a line of text.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }
const appSrc = fs.readFileSync(path.join(__PROJECT_ROOT__, 'app.js'), 'utf8');

// ---- static ----
check(/class="chart-caption" style="font-size:10px;color:var\(--muted\);margin:-8px 0 8px"/.test(appSrc), 'the hexagram caption carries the chart-caption class');
check(/if \(parseFloat\(ucs\.marginTop\) < 0\) clonedNode\.style\.marginTop = '0px';/.test(appSrc) && /marginBottom\) < 0/.test(appSrc), 'negative margins on a unit root are zeroed on the clone');
check(/isCaption: !!\(node\.classList && node\.classList\.contains\('chart-caption'\)\)/.test(appSrc) && /isCaption: !!unit\.isCaption/.test(appSrc), 'the caption flag is carried from capture units into units[]');
check(/function canvasRowIsBlank\(canvas, y\)/.test(appSrc) && /NO WORD IS EVER CUT/.test(appSrc), 'the no-word-cut guard exists in the slicing loop');
check(/__pdfAuditOverflow/.test(appSrc), 'the overflow audit hook exists');

// ---- 1. no element in a real, fully-rendered profile PDF overflows a would-be unit via a negative margin ----
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
  children: [person('Amy', 'Wong', '2005-03-03', '08:15', 'female')],
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};
const { sandbox: sb, dom } = freshSandbox();
const run = (s) => vm.runInContext(s, sb);
run(`state.users['test@test.com'] = ${JSON.stringify(user)}; state.active = 'test@test.com'; go('chart');`);
const doc = dom.window.document;

// jsdom has no layout, so computed-style negative margins are read from the inline style attributes
for (const pref of ['i', 'p', 'c0']) {
  const html = run(`buildProfilePdfHTML('${pref}')`);
  const c = doc.createElement('div'); c.innerHTML = html;
  const negative = Array.from(c.querySelectorAll('[style]')).filter(e => /margin(-top|-bottom|-left|-right)?\s*:\s*[^;"]*(^|[\s:])-\d/.test(e.getAttribute('style')));
  const captions = negative.filter(e => e.classList.contains('chart-caption'));
  check(negative.every(e => e.classList.contains('chart-caption')), `${pref}: every inline negative-margin element in the PDF HTML is a .chart-caption (no other element can be clipped this way) [${negative.length} found]`);
  check(captions.length === negative.length, `${pref}: the captions are tagged so they stay with their graphic`);
}

// ---- 2. PASS 1 grouping: a caption stays with the graphic above it (extracted verbatim) ----
{
  const s = appSrc.indexOf('const placementGroups = [];');
  const e = appSrc.indexOf('// PASS 2: lay placement groups onto pages.', s);
  const grouping = appSrc.slice(s, e);
  const fn = new Function('units', 'CONTENT_H_MM', 'LABEL_ORPHAN_MAX_MM', grouping + '\nreturn placementGroups;');
  const u = (sec, h, extra) => Object.assign({ sectionIndex: sec, heightMm: h, canvas: { height: h * 10 } }, extra || {});
  const units = [u(5, 7), u(5, 12), u(5, 60, { noMidSlice: true }), u(5, 6, { isCaption: true }), u(5, 90)];
  const groups = fn(units, 253, 18);
  const withCaption = groups.find(g => g.members.some(m => m.isCaption));
  check(withCaption && withCaption.members[withCaption.members.length - 2].noMidSlice === true, 'the caption is in the SAME placement group as the chart directly above it');
  check(groups.reduce((n, g) => n + g.members.length, 0) === units.length, 'no unit is lost or duplicated by the grouping');
  const capGroupH = withCaption.totalHeightMm;
  check(Math.abs(capGroupH - withCaption.members.reduce((m, x) => m + x.heightMm, 0)) < 1e-9, "the group's total height includes the caption");
}

// ---- 3. PASS 2: never cut through ink ----
{
  const CONTENT_H_MM = 253;
  const s = appSrc.indexOf('const pages = [];');
  const endMarker = 'if (currentPage.length) pages.push(currentPage);';
  const eIdx = appSrc.indexOf(endMarker, s);
  const pass2Src = appSrc.slice(s, eIdx + endMarker.length);
  const grab = (name) => { const st = appSrc.indexOf('function ' + name + '('); let d = 0, i = st, en = -1; for (; i < appSrc.length; i++) { if (appSrc[i] === '{') d++; else if (appSrc[i] === '}') { d--; if (d === 0) { en = i + 1; break; } } } return appSrc.slice(st, en); };
  const lib = grab('findSafeSliceCutPx') + '\n' + grab('canvasRowIsBlank');
  const run2 = (placementGroups) => { const sandbox = { console, CONTENT_H_MM, placementGroups, __result: null }; sandbox.global = sandbox; vm.createContext(sandbox); vm.runInContext(`${lib}\n(function () {\n${pass2Src}\n  __result = { pages, sectionStartPage };\n})();`, sandbox); return sandbox.__result; };
  // A fake canvas that has INK on every row except a few, so a "clean" cut is only possible at the listed rows.
  const mkCanvas = (hPx, blankRows) => ({ width: 4, height: hPx, getContext() { return { getImageData(x, y, w, h) { const data = new Uint8ClampedArray(w * h * 4); for (let r = 0; r < h; r++) { const blank = blankRows.has(y + r); for (let c = 0; c < w; c++) { const i = (r * w + c) * 4; const v = blank ? 255 : 0; data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255; } } return { data }; } }; } });
  const PX = 10;
  const unit = (sec, first, hMm, blank) => ({ sectionIndex: sec, isFirstOfSection: first, canvas: mkCanvas(hMm * PX, blank), pxPerMm: PX, heightMm: hMm });
  // (a) a 200mm unit that fits a page, with 100mm already used and NO blank row anywhere: it must start a fresh page whole.
  {
    const r = run2([{ members: [unit(1, true, 100, new Set([0]))], totalHeightMm: 100 }, { members: [unit(2, true, 200, new Set())], totalHeightMm: 200 }]);
    const secTwo = r.pages.map((pg, i) => ({ i, items: pg.filter(it => it.sectionIndex === 2) })).filter(x => x.items.length);
    check(secTwo.length === 1 && secTwo[0].items.length === 1 && secTwo[0].items[0].srcHPx === 200 * PX, 'a one-page unit with no clean cut row is placed WHOLE on a fresh page (not torn across pages)');
  }
  // (b) same, but a blank row exists well inside the window: it is cut there (and nowhere inked).
  {
    const blankRow = 1500; // 150mm into the unit; the natural cut is 153mm, so this is inside the search window
    const r = run2([{ members: [unit(1, true, 100, new Set([0]))], totalHeightMm: 100 }, { members: [unit(2, true, 200, new Set([blankRow]))], totalHeightMm: 200 }]);
    const cuts = r.pages.flatMap(pg => pg.filter(it => it.sectionIndex === 2).map(it => it.srcYPx + it.srcHPx)).filter(c => c < 200 * PX);
    check(cuts.every(c => c === blankRow), 'when a blank row exists the unit is cut exactly there');
  }
  // (c) a unit taller than a page with no clean row anywhere is still placed completely (nothing dropped, no endless loop).
  {
    const r = run2([{ members: [unit(1, true, 600, new Set())], totalHeightMm: 600 }]);
    const tot = r.pages.reduce((n, pg) => n + pg.reduce((m, it) => m + it.srcHPx, 0), 0);
    check(tot === 600 * PX && r.pages.length >= 3, 'a unit taller than a page is still fully placed even when no blank row exists');
  }
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
