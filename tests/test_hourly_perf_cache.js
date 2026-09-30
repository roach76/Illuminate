const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies item 6 (hourly tab lag) root-cause fix: engine-metaphysics.js's jieMoment() and
// findQmdjTerm() previously rebuilt their astronomical root-finding results (50-iteration bisections)
// on EVERY call, with near-total redundancy across the 12 hour-blocks of a single day-switch (same
// year -> same spans). Two caches (__jieMomentCache, __qmdjTermSpansCache) were added.
//
// This test verifies:
//  (a) CORRECTNESS is unchanged: computing the same 12 hour-blocks twice (cache cold vs warm)
//      produces byte-identical JSON output.
//  (b) The caches actually get populated/hit (cache-size checks), confirming the fix engages.
//  (c) A full 12-block day computation completes comfortably fast (regression guard).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function freshSandbox() {
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js');
  return sandbox;
}

const sandbox = freshSandbox();

// Build a minimal profile 'p' with a BaZi chart, mirroring what app.js's getProfileData() produces.
vm.runInContext(`
  var __testP = (function() {
    var bazi = getBaZiPillars(1976, 9, 7, 9, 33, 103.82, 8);
    return { bazi: bazi };
  })();
`, sandbox);

// --- Sanity: confirm both caches exist ---
check(typeof vm.runInContext('__jieMomentCache', sandbox) === 'object', '__jieMomentCache exists');
check(typeof vm.runInContext('__qmdjTermSpansCache', sandbox) === 'object', '__qmdjTermSpansCache exists');
// Module load itself (BaZi computation for __testP) may already prime a few cache entries - that's
// fine, so this just confirms the caches are Maps we can measure growth on, not that they're empty.
check(vm.runInContext('__qmdjTermSpansCache.size', sandbox) === 0, '__qmdjTermSpansCache starts empty (nothing touches QMDJ term spans until an hourly block is computed)');

// --- Timed run 1: cold caches, compute all 12 blocks for "today" (dayOffset 0) ---
const now = new Date('2026-09-23T04:00:00Z').getTime();
vm.runInContext(`var __now = new Date(${now});`, sandbox);

const t0 = Date.now();
vm.runInContext(`
  var __blocksRun1 = [];
  for (var shi = 0; shi < 12; shi++) {
    __blocksRun1.push(computeHourlySingleBlock(__testP, 0, shi, __now));
  }
`, sandbox);
const t1 = Date.now();
const coldMs = t1 - t0;

const jieCacheSizeAfterRun1 = vm.runInContext('__jieMomentCache.size', sandbox);
const qmdjCacheSizeAfterRun1 = vm.runInContext('__qmdjTermSpansCache.size', sandbox);
check(jieCacheSizeAfterRun1 > 0, `jieMomentCache populated after run 1 (size=${jieCacheSizeAfterRun1})`);
check(qmdjCacheSizeAfterRun1 > 0, `qmdjTermSpansCache populated after run 1 (size=${qmdjCacheSizeAfterRun1})`);
// All 12 blocks share the same target year, so the QMDJ span cache should have exactly 1 entry
// (one cache key per year), not 12 - proving de-duplication is actually happening.
check(qmdjCacheSizeAfterRun1 <= 2, `qmdjTermSpansCache has very few entries (<=2) for a single day's 12 blocks, proving redundant rebuilds were eliminated (size=${qmdjCacheSizeAfterRun1})`);

// --- Timed run 2: warm caches, same day, different dayOffset (still same year) ---
const t2 = Date.now();
vm.runInContext(`
  var __blocksRun2 = [];
  for (var shi = 0; shi < 12; shi++) {
    __blocksRun2.push(computeHourlySingleBlock(__testP, 1, shi, __now));
  }
`, sandbox);
const t3 = Date.now();
const warmMs = t3 - t2;

check(warmMs <= coldMs + 5, `warm-cache run (dayOffset=1, ${warmMs}ms) is not slower than the cold-cache run (dayOffset=0, ${coldMs}ms)`);

// --- Correctness: re-run dayOffset=0 again now that caches are warm; results must match run 1 exactly ---
vm.runInContext(`
  var __blocksRun1Repeat = [];
  for (var shi = 0; shi < 12; shi++) {
    __blocksRun1Repeat.push(computeHourlySingleBlock(__testP, 0, shi, __now));
  }
`, sandbox);
const run1Json = vm.runInContext('JSON.stringify(__blocksRun1)', sandbox);
const run1RepeatJson = vm.runInContext('JSON.stringify(__blocksRun1Repeat)', sandbox);
check(run1Json === run1RepeatJson, 'cold-cache and warm-cache computations for the SAME day produce byte-identical output (cache does not change correctness)');
check(run1Json.length > 100, 'sanity: computed block output is non-trivial JSON');

// --- jieMoment: confirm defensive copy - mutating a returned Date must not corrupt the cache ---
vm.runInContext(`
  var __d1 = jieMoment(2026, 3);
  var __originalTime = __d1.getTime();
  __d1.setFullYear(1900); // mutate the returned Date
  var __d2 = jieMoment(2026, 3); // fetch again - should be unaffected by the mutation above
`, sandbox);
const originalTime = vm.runInContext('__originalTime', sandbox);
const d2Time = vm.runInContext('__d2.getTime()', sandbox);
check(originalTime === d2Time, 'jieMoment returns a defensive copy - mutating a previously-returned Date does not corrupt the cached value');

// --- Overall timing regression guard: 12-block computation should be well under a second in Node ---
check(coldMs < 2000, `cold 12-block computation completes in well under 2000ms in Node (actual: ${coldMs}ms)`);
check(warmMs < 500, `warm 12-block computation completes in well under 500ms in Node (actual: ${warmMs}ms)`);

console.log(`Timing: cold=${coldMs}ms warm=${warmMs}ms  (jieCache=${jieCacheSizeAfterRun1} qmdjCache=${qmdjCacheSizeAfterRun1})`);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
