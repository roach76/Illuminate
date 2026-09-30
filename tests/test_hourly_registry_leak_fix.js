const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for the reported "ok for the first day change, every change after that lags 10+
// seconds" Hourly-tab symptom. Root cause: buildHourlyDayHTML registers each of a day's 12 per-hour
// "View Details" popups into the app-wide deepAnalysisRegistry with a brand-new random id every time,
// and renderHourlyTab resets its own day-cache (forcing a fresh 12-block build) on every tab open/
// profile switch WITHOUT ever removing the previous visit's entries - so the registry (and the sizable
// HTML strings it holds) grew without bound the longer a session went on, which is exactly the kind of
// unbounded heap growth that produces escalating GC pauses on a real device (fast at first, then
// progressively slower). Fix: track every hourly popup id in globalThis.__hourlyPopupIds and purge
// them all from deepAnalysisRegistry at the start of every renderHourlyTab call, before new ones are
// created - so the registry never carries more than one tab-visit's worth of hourly popups.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let passed = 0, failed = 0;
function check(cond, msg) { if (cond) passed++; else { failed++; console.log('FAIL: ' + msg); } }

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: dom.window.document, window: dom.window,
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL, alert: () => {}, confirm: () => true,
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
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', chineseFirstName: '伟', chineseLastName: '黄', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
};
vm.runInContext(`
  state.users['test@test.com'] = ${JSON.stringify(testUser)};
  state.active = 'test@test.com';
`, sandbox);
vm.runInContext(`go('home')`, sandbox);

function runOneHourlyVisit() {
  vm.runInContext(`renderHourlyTab()`, sandbox);
  // Drain the chunked setTimeout(0) computation synchronously enough for a test: run the event loop's
  // pending timers repeatedly until the day's HTML is cached (mirrors the real chunking, just without
  // a real browser's paint between ticks).
  return new Promise(resolve => {
    const check = () => {
      if (sandbox.__hourlyDayHTML && sandbox.__hourlyDayHTML.today) return resolve();
      setTimeout(check, 5);
    };
    check();
  });
}

function registrySize() {
  return Object.keys(vm.runInContext('deepAnalysisRegistry', sandbox)).length;
}
function hourlyPopupCount() {
  const ids = vm.runInContext('globalThis.__hourlyPopupIds', sandbox);
  return Array.isArray(ids) ? ids.length : 0;
}

(async () => {
  await runOneHourlyVisit();
  const sizeAfterFirstVisit = registrySize();
  const hourlyCountAfterFirstVisit = hourlyPopupCount();
  check(hourlyCountAfterFirstVisit === 12, `first Hourly-tab visit registers exactly 12 hourly popups (today's 12 blocks) - got ${hourlyCountAfterFirstVisit}`);
  check(sizeAfterFirstVisit >= 12, `registry holds at least the 12 hourly entries after the first visit - got ${sizeAfterFirstVisit}`);

  // Simulate the user reopening the Hourly tab (or switching profile back to it) many times in a row,
  // the exact real-world pattern the bug report described - each visit used to leave its old 12 entries
  // behind forever.
  for (let i = 0; i < 9; i++) {
    await runOneHourlyVisit();
  }
  const sizeAfterTenVisits = registrySize();
  const hourlyCountAfterTenVisits = hourlyPopupCount();

  check(hourlyCountAfterTenVisits === 12, `BUG FIX VERIFIED: after 10 Hourly-tab (re)opens, still only 12 hourly popup ids tracked (not 120) - got ${hourlyCountAfterTenVisits}`);
  check(sizeAfterTenVisits <= sizeAfterFirstVisit + 2, `BUG FIX VERIFIED: deepAnalysisRegistry size after 10 tab visits (${sizeAfterTenVisits}) stays essentially flat versus after 1 visit (${sizeAfterFirstVisit}) instead of growing ~10x - this is what prevents the escalating GC pauses reported as "ok for the first day change, every change after lags 10+ seconds"`);

  // Now also switch through the other 3 days once, to confirm normal same-visit caching (up to 4 days
  // x 12 = 48 entries) still works and isn't wrongly purged mid-visit.
  vm.runInContext(`
    const ctx = globalThis.__hourlyDayCtx;
    globalThis.__hourlyDayGen = (globalThis.__hourlyDayGen || 0) + 1;
    const g = globalThis.__hourlyDayGen;
    computeHourlyDayChunked(ctx, 1, 'tomorrow', g, null, () => {});
  `, sandbox);
  await new Promise(resolve => {
    const chk = () => { if (sandbox.__hourlyDayHTML.tomorrow) return resolve(); setTimeout(chk, 5); };
    chk();
  });
  const hourlyCountAfterSecondDay = hourlyPopupCount();
  check(hourlyCountAfterSecondDay === 24, `within ONE tab visit, switching to a second day accumulates to 24 tracked hourly popups (today + tomorrow, 12 each), not purged mid-visit - got ${hourlyCountAfterSecondDay}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
})();
