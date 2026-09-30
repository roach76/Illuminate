const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the follow-up fix to saveState()'s pruning: a real Console screenshot taken AFTER the
// first version of this fix was installed showed pruning to a flat 30-entries-per-game cap recovering
// SOME saves ("succeeded after pruning") but not others ("still over quota after pruning", from
// backfillHistoricalAccuracy/reconcilePredictions) - a single fixed cut wasn't always enough headroom.
// Pruning now escalates through progressively more aggressive caps (30 -> 10 -> 0) and retries after
// each, and logs a size-diagnostic if even removing everything prunable still isn't enough.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function buildSandbox({ quotaCeiling }) {
  const storage = {};
  const localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => {
      const str = String(v);
      if (str.length > quotaCeiling) {
        const err = new Error("Failed to execute 'setItem' on 'Storage': Setting the value of 'illuminate-local-v101' exceeded the quota.");
        err.name = 'QuotaExceededError'; err.code = 22;
        throw err;
      }
      storage[k] = str;
    },
    removeItem: (k) => { delete storage[k]; },
  };
  const warnLogs = [];
  const warnCalls = [];
  const sandbox = {
    localStorage, console: Object.assign({}, console, { warn: (...a) => { warnLogs.push(a.join(' ')); warnCalls.push(a); }, error: () => {} }),
    Date, Math, JSON, Array, Object, String, Number,
  };
  sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-core.js'), 'utf8'), sandbox, { filename: 'engine-core.js' });
  return { sandbox, storage, warnLogs, warnCalls, run: (code) => vm.runInContext(code, sandbox) };
}

function entry(i, checked) {
  return {
    isoDate: '2020-01-' + String((i % 28) + 1).padStart(2, '0'),
    sets: ['1234', '5678'], generatedAt: 'x', checked, actual: checked ? { winning: ['1234'] } : null, hitSummary: checked ? {} : null,
  };
}

let threw = null;
try {
  // --- Test 1: a quota so tight that the FIRST prune step (cap 30) isn't enough, but the SECOND
  // (cap 10) is - proves escalation actually happens and recovers a save the old single-cap version
  // would have given up on. ---
  {
    // Build a fixture where 30 entries still don't fit under quota, but 10 do.
    const fourD = Array.from({ length: 60 }, (_, i) => entry(i, true));
    const size30 = JSON.stringify({ users: { x: { profile: {}, lotteryLog: { fourD: fourD.slice(0, 30), toto: [] } } }, active: 'x' }).length;
    const size10 = JSON.stringify({ users: { x: { profile: {}, lotteryLog: { fourD: fourD.slice(0, 10), toto: [] } } }, active: 'x' }).length;
    const quotaCeiling = Math.floor((size30 + size10) / 2); // strictly between the two sizes
    const { run, storage, warnLogs } = buildSandbox({ quotaCeiling });
    run(`
      state.users['x'] = { name: 'x', email: 'x', password: 'p', profile: { englishName: 'X' }, lotteryLog: { fourD: ${JSON.stringify(fourD)}, toto: [] } };
      state.active = 'x';
    `);
    const result = run('saveState()');
    check(result === true, 'BUG FIX VERIFIED: escalating past the first (30-cap) prune step recovers a save that a single fixed cap could not');
    check('illuminate-local-v101' in storage, 'the escalated, smaller state was actually persisted');
    const finalLen = run("state.users['x'].lotteryLog.fourD.length");
    check(finalLen <= 10, `pruning escalated down to the 10-entry cap (or fewer), got ${finalLen}`);
    check(warnLogs.some(l => l.includes('succeeded after pruning old prediction history down to 10 entries per game')), 'a warning correctly reports which cap level succeeded');
  }

  // --- Test 2: even the most aggressive step (cap 0 - drop every resolved entry) still isn't enough,
  // because the bloat is genuinely NOT in the lottery log at all (e.g. a huge profile). Must not throw,
  // must correctly report failure, and must log a size diagnostic rather than just giving up silently. ---
  {
    const { run, warnLogs, warnCalls } = buildSandbox({ quotaCeiling: 50 }); // so tight nothing realistic fits
    run(`
      state.users['y'] = { name: 'y', email: 'y', password: 'p', profile: { englishName: 'Y', bigField: 'z'.repeat(500) }, lotteryLog: { fourD: [${JSON.stringify(entry(0, true))}], toto: [] } };
      state.active = 'y';
    `);
    let threwInline = false;
    let result;
    try { result = run('saveState()'); } catch (e) { threwInline = true; }
    check(!threwInline, 'BUG FIX VERIFIED: saveState() still never throws even when every pruning step is exhausted and it is still over quota');
    check(result === false, 'saveState() correctly reports failure when nothing prunable is enough');
    check(warnLogs.some(l => l.includes('Could not free enough space by pruning lottery history alone')), 'BUG FIX VERIFIED: a size diagnostic is logged when pruning alone cannot recover, to help pinpoint bloat that lives outside the lottery log');
    const diagCall = warnCalls.find(a => typeof a[0] === 'string' && a[0].includes('Could not free enough space'));
    check(!!diagCall && Array.isArray(diagCall[1]) && diagCall[1].some(row => row.email === 'y'), 'the diagnostic includes a per-account breakdown naming the actual account');
  }

  // --- Test 3: regression - a save that fits without any pruning at all still just succeeds on the
  // first try, with no escalation warnings. ---
  {
    const { run, warnLogs } = buildSandbox({ quotaCeiling: 100000 });
    run(`
      state.users['z'] = { name: 'z', email: 'z', password: 'p', profile: { englishName: 'Z' } };
      state.active = 'z';
    `);
    const result = run('saveState()');
    check(result === true, 'a normal, well-under-quota save still succeeds immediately (regression)');
    check(warnLogs.length === 0, 'no pruning/escalation warnings are logged when nothing needed pruning');
  }

  // --- Test 4: pruneOldestResolvedLotteryEntries(0) actually removes ALL resolved entries but leaves
  // unresolved ones untouched, confirming the cap=0 step behaves as documented. ---
  {
    const { run } = buildSandbox({ quotaCeiling: 100000 });
    run(`
      state.users['w'] = { name: 'w', email: 'w', profile: {}, lotteryLog: { fourD: [
        ${JSON.stringify(entry(0, true))}, ${JSON.stringify(entry(1, true))},
        { isoDate: '2099-01-01', sets: ['1111'], generatedAt: 'x', checked: false, actual: null, hitSummary: null }
      ], toto: [] } };
    `);
    run('pruneOldestResolvedLotteryEntries(0);');
    const remaining = run("state.users['w'].lotteryLog.fourD");
    check(remaining.length === 1 && remaining[0].checked === false, 'cap=0 removes every resolved entry while leaving the one unresolved/upcoming entry untouched');
  }
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
