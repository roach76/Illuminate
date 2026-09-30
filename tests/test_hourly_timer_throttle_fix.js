const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for the repeatedly-reported "hourly tab intermittently takes 5-25+ seconds to change
// day" lag. Root cause, finally confirmed via direct measurement on the user's own live, running app in
// a real Chrome browser (not a synthetic/always-focused test harness): computeHourlyDayChunked used to
// chunk by a measured real time budget (40ms) and fall back to a deferred setTimeout(0) hop whenever a
// chunk ran long - and setTimeout(0) on this app/device was independently proven capable of sitting
// unscheduled in the OS/browser's deprioritized timer queue for ~1s to over a minute, regardless of how
// much real work was left. That "safety net" was assumed to be a rare edge case (each block measured
// under 5ms in testing, ~60ms for a full day) - but on real hardware (antivirus scanning, background
// load, heavier real profile data) a chunk crossing the 40ms budget turned out to be common enough to
// reproduce the exact random 5-20+ second stalls being reported, every time it fired.
//
// UPDATE (this round): there is no way to keep "yield via setTimeout when a chunk runs long" without
// keeping that exact exposure - so the fallback has been removed entirely. computeHourlyDayChunked now
// ALWAYS runs all 12 blocks in a single uninterrupted synchronous pass, on every device, regardless of
// how long any individual block takes. The proven real cost (tens of ms even on a slow/cache-cold day)
// stays imperceptible either way, and the function can no longer be handed off to a timer the OS/browser
// might refuse to run promptly.
//
// This test verifies that guarantee directly against the real computeHourlyDayChunked function (loaded
// via vm, not reimplemented): both a normal-speed pass AND a deliberately slow one (simulating real
// hardware conditions well past the old 40ms budget) must complete synchronously with zero setTimeout
// calls of any kind.
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
  const timeoutCalls = []; // records every setTimeout the app schedules while our probe runs
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: dom.window.document, window: dom.window,
    setTimeout: (fn, delay, ...rest) => {
      if (sandbox.__recordTimeouts) timeoutCalls.push(delay || 0);
      return setTimeout(fn, delay, ...rest);
    },
    clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL, html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}} }),
    alert: () => {}, confirm: () => true, performance: (typeof performance !== 'undefined' ? performance : { now: () => Date.now() }),
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { dom, sandbox, timeoutCalls };
}

const { sandbox, timeoutCalls } = freshSandbox();
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
};
vm.runInContext(`
  state.users['test@test.com'] = ${JSON.stringify(testUser)};
  state.active = 'test@test.com';
`, sandbox);
vm.runInContext(`go('chart')`, sandbox);
// renderHourlyTab sets up globalThis.__hourlyDayCtx as a side effect - easiest reliable way to get a
// real ctx object without duplicating its construction logic here.
vm.runInContext(`renderHourlyTab('i')`, sandbox);
check(!!vm.runInContext(`globalThis.__hourlyDayCtx`, sandbox), 'globalThis.__hourlyDayCtx is populated by renderHourlyTab (sanity check before using it below)');

// --- Test 1: normal-speed path (real per-block cost, exactly as measured live) needs zero setTimeout hops
sandbox.__recordTimeouts = true;
timeoutCalls.length = 0;
vm.runInContext(`globalThis.__hourlyDayGen = (globalThis.__hourlyDayGen || 0) + 1;`, sandbox);
const gen1 = vm.runInContext(`globalThis.__hourlyDayGen`, sandbox);
vm.runInContext(`
  computeHourlyDayChunked(globalThis.__hourlyDayCtx, 1, '__test_fast__', ${gen1}, null, () => { globalThis.__testFastDone = true; });
`, sandbox);
const fastDone = vm.runInContext(`!!globalThis.__testFastDone`, sandbox);
check(fastDone === true, 'normal-speed path completes synchronously - onDone already fired before computeHourlyDayChunked returns');
check(timeoutCalls.length === 0, `normal-speed path schedules ZERO setTimeout calls of any kind - got ${timeoutCalls.length}`);

// --- Test 2 (UPDATED this round): even a deliberately slow device (simulating real hardware conditions -
// antivirus scanning, background load, heavier real data - well past the OLD 40ms-per-chunk budget) must
// STILL complete in one synchronous pass with zero setTimeout calls. This is the crux of the fix: the
// previous version correctly chunked here and fell back to setTimeout(0) - which is exactly the "safety
// net" this round proved was itself the cause of the random 5-20+ second stalls being reported. There is
// now no code path in computeHourlyDayChunked that can reach a timer, no matter how slow a single block
// computation is.
vm.runInContext(`
  globalThis.__origComputeHourlySingleBlock = computeHourlySingleBlock;
  computeHourlySingleBlock = function(...args) {
    // simulate a slow device: burn ~15ms of real CPU time per block (12 blocks ~= 180ms total, well past
    // the old 40ms-per-chunk budget that used to force a setTimeout(0) hop partway through a single day).
    const start = Date.now(); while (Date.now() - start < 15) {}
    return globalThis.__origComputeHourlySingleBlock.apply(this, args);
  };
`, sandbox);
timeoutCalls.length = 0;
vm.runInContext(`globalThis.__hourlyDayGen = (globalThis.__hourlyDayGen || 0) + 1;`, sandbox);
const gen2 = vm.runInContext(`globalThis.__hourlyDayGen`, sandbox);
vm.runInContext(`globalThis.__testSlowDone = false;`, sandbox);
const slowStart = Date.now();
vm.runInContext(`
  computeHourlyDayChunked(globalThis.__hourlyDayCtx, 2, '__test_slow__', ${gen2}, null, () => { globalThis.__testSlowDone = true; });
`, sandbox);
const slowElapsedMs = Date.now() - slowStart;
const slowDoneImmediately = vm.runInContext(`!!globalThis.__testSlowDone`, sandbox);
check(slowDoneImmediately === true, 'BUG FIX VERIFIED: the simulated slow-device path (~180ms of real work) STILL completes synchronously in one pass - it no longer falls back to chunking');
check(timeoutCalls.length === 0, `BUG FIX VERIFIED: the simulated slow-device path schedules ZERO setTimeout calls of any kind (the old fallback that was itself causing the random 5-20+ second stalls has been removed entirely) - got ${timeoutCalls.length}`);
check(slowElapsedMs < 2000, `the slow-simulated computation still finished in well under 2s wall-clock (got ${slowElapsedMs}ms), confirming it ran straight through rather than hanging`);
vm.runInContext(`computeHourlySingleBlock = globalThis.__origComputeHourlySingleBlock;`, sandbox); // restore

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
