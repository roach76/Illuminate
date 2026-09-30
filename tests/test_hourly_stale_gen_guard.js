const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the generation-guard added this round alongside the item-3 fix (hourly tab lag): the
// initial "today" computation and day-switch computation now share one computeHourlyDayChunked helper,
// guarded by globalThis.__hourlyDayGen. If renderHourlyTab is called again (e.g. a rapid profile
// switch) while a previous chunked computation is still mid-flight, that stale, in-progress computation
// must be discarded rather than landing on top of the newer render's content once it finally finishes.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: dom.window.document, window: dom.window,
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL, html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}} }),
    alert: () => {}, confirm: () => true,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { dom, sandbox };
}

const { dom, sandbox } = freshSandbox();
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};
vm.runInContext(`
  state.users['test@test.com'] = ${JSON.stringify(testUser)};
  state.active = 'test@test.com';
`, sandbox);
vm.runInContext(`go('chart')`, sandbox);

// Kick off the first "today" load, then IMMEDIATELY re-render (simulating a rapid profile switch)
// before the first chunked computation has had any chance to finish. The generation counter should
// have advanced, so when the first (now-stale) computation's chunks eventually run to completion in
// the background, they must not overwrite globalThis.__hourlyDayHTML.today or the live DOM.
vm.runInContext(`renderHourlyTab('i')`, sandbox);
const genAfterFirst = vm.runInContext(`globalThis.__hourlyDayGen`, sandbox);
vm.runInContext(`renderHourlyTab('i')`, sandbox);
const genAfterSecond = vm.runInContext(`globalThis.__hourlyDayGen`, sandbox);

check(genAfterSecond > genAfterFirst, 'a second renderHourlyTab call (simulating a rapid profile switch) bumps the generation counter past the first, in-flight render');

const doc = dom.window.document;

new Promise(resolve => {
  let ticks = 0;
  const poll = () => {
    ticks++;
    const anyBtn = doc.querySelector('.btnHourlyDayToggle');
    if ((anyBtn && !anyBtn.disabled) || ticks > 80) { resolve(); return; }
    setTimeout(poll, 5);
  };
  setTimeout(poll, 5);
}).then(() => {
  // By the time the SECOND (current) render's chunked computation finishes, the buttons re-enable and
  // real content is shown - the stale first computation's onDone callback (if it ever fires) must have
  // been a no-op thanks to the gen guard, so nothing here should look inconsistent or throw.
  check([...doc.querySelectorAll('.btnHourlyDayToggle')].every(b => !b.disabled), 'buttons end up enabled once the current (second) render\'s chunked computation completes, despite an earlier in-flight computation also existing');
  const contentHTML = doc.getElementById('hourlyDayContent').innerHTML;
  check(contentHTML.includes('Hourly Summary') || contentHTML.includes('时辰总览'), 'the real computed hourly table for the CURRENT render is shown, not stuck on a stale "Computing…" placeholder from the superseded render');
  check(vm.runInContext(`globalThis.__hourlyDayGen`, sandbox) === genAfterSecond, 'the generation counter is not incremented further merely by the stale computation finishing in the background');

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
});
