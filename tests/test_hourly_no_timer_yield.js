const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Regression test for the fix to the recurring "random 5-20+ second lag on the Hourly tab" report.
// Root cause (this round): computeHourlyDayChunked kept a 40ms time-budget "safety net" that fell back
// to setTimeout(stepOne, 0) whenever a chunk of block computations ran long. A prior round had already
// directly measured, on the user's own device, that setTimeout(0) here could sit unscheduled in the
// OS/browser's deprioritized timer queue for ~1s to over a minute - completely independent of how much
// real work was left. Because the "rare" 40ms-overrun case turned out to be common enough on real
// hardware (antivirus scanning, real multi-profile data, background load), the fallback was still being
// taken often enough to reproduce the exact random multi-second stalls being reported. The fix removes
// the timer-based yield entirely - all 12 blocks now always run in one uninterrupted synchronous pass.
//
// This test proves that guarantee holds structurally, not just "usually": it monkey-patches setTimeout
// to fail loudly if computeHourlyDayChunked ever calls it, then exercises the initial load AND several
// day-switches, including a deliberately slow-instrumented computeHourlySingleBlock (spinning past what
// used to be the 40ms budget) to confirm even a slow calculation no longer reaches for a timer.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  let timeoutCalls = 0;
  const guardedSetTimeout = (fn, ms, ...args) => { timeoutCalls++; return setTimeout(fn, ms, ...args); };
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: dom.window.document, window: dom.window,
    setTimeout: guardedSetTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL, alert: () => {}, confirm: () => true, performance: (typeof performance !== 'undefined' ? performance : { now: () => Date.now() }),
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { dom, sandbox, getTimeoutCalls: () => timeoutCalls };
}

const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
};

// --- 1. Normal-speed blocks: computeHourlyDayChunked must never call setTimeout, for the initial
// "today" load or for several subsequent day-switches. -------------------------------------------------
{
  const { sandbox, getTimeoutCalls } = freshSandbox();
  vm.runInContext(`
    state.users['test@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test@test.com';
  `, sandbox);
  const ctx = vm.runInContext(`
    (function() {
      const p = getProfileData(state.users['test@test.com'].profile);
      return { p, nameCompat: null, elemNames: ['Wood','Fire','Earth','Metal','Water'], elemNamesZH: ['木','火','土','金','水'] };
    })()
  `, sandbox);
  sandbox.__testCtx = ctx;
  sandbox.__hourlyDayGen = 1;
  let doneCount = 0;
  sandbox.__onDone = () => { doneCount++; };
  for (const [offset, key] of [[0, 'today'], [1, 'tomorrow'], [2, 'day2'], [3, 'day3']]) {
    vm.runInContext(`computeHourlyDayChunked(__testCtx, ${offset}, '${key}', 1, null, __onDone);`, sandbox);
  }
  check(doneCount === 4, `all 4 day computations completed synchronously and called onDone - got ${doneCount}/4`);
  check(getTimeoutCalls() === 0, `BUG FIX VERIFIED: computeHourlyDayChunked never called setTimeout across the initial load + 3 day-switches (the exact scenario that used to risk the OS timer-throttling trap) - got ${getTimeoutCalls()} calls`);
  const cachedDays = vm.runInContext(`Object.keys(globalThis.__hourlyDayHTML || {})`, sandbox);
  check(cachedDays.length === 4, `all 4 days got cached - got ${cachedDays.join(',')}`);
}

// --- 2. Even an artificially slow computeHourlySingleBlock (simulating heavier real-world data or a
// cache-cold day, well past the old 40ms-per-chunk budget) must still never touch a timer - proving the
// fix removed the exposure structurally, not just "in the common case". ---------------------------------
{
  const { sandbox, getTimeoutCalls } = freshSandbox();
  vm.runInContext(`
    state.users['test@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test@test.com';
    globalThis.__origComputeBlock = computeHourlySingleBlock;
    // Simulate each block taking ~15ms of real CPU time (busy-wait) - 12 blocks is ~180ms, well past the
    // old 40ms-per-chunk budget that used to force a setTimeout hop partway through a single day.
    computeHourlySingleBlock = function(...args) {
      const start = performance.now();
      while (performance.now() - start < 15) { /* simulate real work */ }
      return globalThis.__origComputeBlock(...args);
    };
  `, sandbox);
  const ctx = vm.runInContext(`
    (function() {
      const p = getProfileData(state.users['test@test.com'].profile);
      return { p, nameCompat: null, elemNames: ['Wood','Fire','Earth','Metal','Water'], elemNamesZH: ['木','火','土','金','水'] };
    })()
  `, sandbox);
  sandbox.__testCtx = ctx;
  sandbox.__hourlyDayGen = 1;
  let done = false;
  sandbox.__onDone = () => { done = true; };
  const startedAt = Date.now();
  vm.runInContext(`computeHourlyDayChunked(__testCtx, 0, 'today', 1, null, __onDone);`, sandbox);
  const elapsedMs = Date.now() - startedAt;
  check(done === true, 'the artificially slow (~180ms total) day computation still completed and called onDone synchronously');
  check(getTimeoutCalls() === 0, `BUG FIX VERIFIED (structural, not just common-case): even a day computation running well past the old 40ms-per-chunk budget (~180ms simulated) never calls setTimeout - got ${getTimeoutCalls()} calls`);
  check(elapsedMs < 2000, `the slow-simulated computation still finished in well under 2s wall-clock (got ${elapsedMs}ms) - confirms it ran synchronously to completion rather than silently hanging`);
}

// --- 3. The stale-generation guard (superseded render/profile-switch) still works correctly with the
// synchronous rewrite - a newer generation must still discard an older, already-finished computation's
// result. -------------------------------------------------------------------------------------------
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`
    state.users['test@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test@test.com';
  `, sandbox);
  const ctx = vm.runInContext(`
    (function() {
      const p = getProfileData(state.users['test@test.com'].profile);
      return { p, nameCompat: null, elemNames: ['Wood','Fire','Earth','Metal','Water'], elemNamesZH: ['木','火','土','金','水'] };
    })()
  `, sandbox);
  sandbox.__testCtx = ctx;
  sandbox.__hourlyDayGen = 5; // current generation is 5
  let onDoneCalledWithStaleGen = false;
  sandbox.__onDoneStale = () => { onDoneCalledWithStaleGen = true; };
  // Call with an OLD generation number (3) - should be discarded, onDone never called, nothing cached.
  vm.runInContext(`computeHourlyDayChunked(__testCtx, 0, 'staleDay', 3, null, __onDoneStale);`, sandbox);
  check(onDoneCalledWithStaleGen === false, 'a computation carrying a stale (superseded) generation number does not call onDone');
  const cached = vm.runInContext(`(globalThis.__hourlyDayHTML || {}).staleDay`, sandbox);
  check(cached === undefined, 'a stale-generation computation does not pollute the day-HTML cache either');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
