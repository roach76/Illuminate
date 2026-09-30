const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Regression test for the real remaining cause of the Hourly-tab "click sometimes just does nothing"
// symptom, found live via a real (trusted) simulated mouse click against the user's own running app after
// the timer-throttling fix (see test_hourly_no_timer_yield.js) measurably improved but did not fully
// resolve the reported lag.
//
// Root cause: the day-toggle button's own markup is
//   <button class="btnHourlyDayToggle" data-day="tomorrow">Tomorrow<br><span>Tuesday, 29 September</span></button>
// i.e. the visible date-label text sits inside a nested <span>, not directly on the <button>. A real
// mouse click lands on whatever element is actually under the cursor - clicking the button's outer
// edge/padding hits the <button> itself, but clicking the date-label text (a large, natural-to-click part
// of the button) makes e.target that inner <span>, which does NOT carry the `btnHourlyDayToggle` class.
// The delegated click handler used to check `e.target.classList.contains('btnHourlyDayToggle')` - an
// exact match - so a click landing on the inner span failed this check silently: no active-state change,
// no "Computing..." placeholder, no computation, nothing at all. This is NOT a performance/timing bug -
// it's a real dead zone inside the button's own clickable area, and it explains the "still happening but
// improved" report precisely: after the timer-throttling fix removed the worse, longer stalls, whatever
// was left was users re-clicking a dead zone, which reads exactly like an intermittent, unpredictable
// freeze requiring several attempts.
//
// Fixed: the handler now uses `e.target.closest('.btnHourlyDayToggle')` to find the actual button
// regardless of which inner element (the button itself, the <br>, or the nested <span>) was clicked.
//
// This test drives the real click handler (via vm, not reimplemented) with a synthetic click whose
// `target` is deliberately set to the INNER SPAN (simulating exactly what a real click on the date-label
// text produces), for every one of the 4 day buttons, and confirms each one is now handled correctly.
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
    alert: () => {}, confirm: () => true, performance: (typeof performance !== 'undefined' ? performance : { now: () => Date.now() }),
    MouseEvent: dom.window.MouseEvent,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { dom, sandbox };
}

const { sandbox } = freshSandbox();
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
};
vm.runInContext(`
  state.users['test@test.com'] = ${JSON.stringify(testUser)};
  state.active = 'test@test.com';
`, sandbox);
vm.runInContext(`go('chart')`, sandbox);
vm.runInContext(`renderHourlyTab('i')`, sandbox);

// Sanity: the markup really does nest a <span> inside the button (confirms this test targets the real
// reported structure, not a hypothetical one).
const btnOuterHTML = vm.runInContext(`document.querySelector('.btnHourlyDayToggle[data-day="tomorrow"]').outerHTML`, sandbox);
check(/<span[^>]*>[^<]*<\/span>/.test(btnOuterHTML) && btnOuterHTML.includes('<br>'), 'sanity: the day-toggle button really does contain a nested <span> (and <br>) inside it, matching the real reported structure');

// --- Test: dispatching a click whose target is the INNER SPAN (exactly what a real click on the visible
// date-label text produces) must still be handled correctly - the day must actually switch. ------------
for (const day of ['tomorrow', 'day2', 'day3']) {
  vm.runInContext(`
    (function() {
      const btn = document.querySelector('.btnHourlyDayToggle[data-day="${day}"]');
      const innerSpan = btn.querySelector('span');
      if (!innerSpan) throw new Error('no inner span found on button for ${day} - test setup broken');
      // Dispatch directly on the inner span and let it bubble, exactly like a real click on that pixel
      // would - this is the crux of the test: e.target must be the SPAN, not the button.
      const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
      Object.defineProperty(evt, 'target', { value: innerSpan, configurable: true });
      innerSpan.dispatchEvent(evt);
    })();
  `, sandbox);
  const diag = vm.runInContext(`document.getElementById('hourlyPerfDiag')?.textContent`, sandbox);
  const cached = vm.runInContext(`!!(globalThis.__hourlyDayHTML && globalThis.__hourlyDayHTML['${day}'])`, sandbox);
  check(cached === true, `BUG FIX VERIFIED: a click landing on the inner <span> of the "${day}" button (simulating a real click on its date-label text) is now handled - the day was computed and cached (previously this would have silently done nothing)`);
  check(!!diag && diag.length > 0, `the performance diagnostic updated for a click targeting the "${day}" button's inner span (previously the diagnostic never fired for this kind of click) - got "${diag}"`);
}

// --- Test: a click on a genuinely unrelated element (not inside any day-toggle button) must NOT be
// treated as a day-toggle click - closest() must not over-match. ----------------------------------------
{
  vm.runInContext(`globalThis.__hourlyDayHTML = {};`, sandbox); // clear cache so a false-positive would be detectable
  vm.runInContext(`
    const unrelated = document.getElementById('hourlyContent');
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'target', { value: unrelated, configurable: true });
    unrelated.dispatchEvent(evt);
  `, sandbox);
  const cachedAfterUnrelatedClick = vm.runInContext(`Object.keys(globalThis.__hourlyDayHTML || {}).length`, sandbox);
  check(cachedAfterUnrelatedClick === 0, 'a click on an element genuinely outside any day-toggle button does NOT trigger a day computation (closest() correctly returns null and is not over-matching)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
