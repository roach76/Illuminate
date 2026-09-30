const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for the reported "sign out link is not working" / "links work intermittently"
// bug, confirmed via the user's own Console tab: an uncaught QuotaExceededError thrown from
// saveState() (engine-core.js) was silently aborting whatever function called it partway through -
// e.g. auth.js's Sign Out handler does `state.active = null; saveState(); go('welcome');`, so a
// thrown error on the saveState() line meant go('welcome') never ran.
//
// This test drives the REAL saveState()/pruneOldestResolvedLotteryEntries()/showStorageWarning()
// functions from engine-core.js against a fake localStorage that deterministically throws
// QuotaExceededError, and the REAL auth.js #signOut click handler, to prove:
//  1. saveState() never throws, even when the underlying localStorage.setItem does.
//  2. A quota failure no longer aborts the calling function - Sign Out still navigates to 'welcome'.
//  3. Old, already-RESOLVED lottery log entries are pruned first in an attempt to recover, while
//     unresolved/upcoming predictions and profile data are left untouched.
//  4. If pruning isn't enough to recover, the save is skipped gracefully (no throw) and a one-time,
//     dismissible on-screen warning banner is shown instead of failing silently.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const html = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
check(html.includes('id="storageWarningBanner"'), 'index.html has the storageWarningBanner container');
check(html.includes('id="storageWarningText"'), 'index.html has the storageWarningText span');
check(html.includes('id="btnDismissStorageWarning"'), 'index.html has the dismiss button');

function buildSandbox({ quotaAlwaysThrows = false, quotaCeiling = 500 } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/' });
  dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
  const storage = {};
  let setItemCallCount = 0;
  const localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => {
      setItemCallCount++;
      const str = String(v);
      // Simulate a quota that's exceeded whenever the serialized state is "too big" (over
      // quotaCeiling chars) - or always, when quotaAlwaysThrows is set, to test the "even pruning
      // isn't enough" path.
      if (quotaAlwaysThrows || str.length > quotaCeiling) {
        const err = new Error("Failed to execute 'setItem' on 'Storage': Setting the value of 'illuminate-local-v101' exceeded the quota.");
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      }
      storage[k] = str;
    },
    removeItem: (k) => { delete storage[k]; },
  };
  const sandbox = {
    document: dom.window.document, window: dom.window, localStorage, console,
    navigator: { language: 'en-US' },
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL, html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){} }} }),
    alert: () => {},
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
  function run(code) { return vm.runInContext(code, sandbox); }
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js'); loadFile('engine-predictions.js');
  loadFile('app.js'); loadFile('auth.js');
  run("initAuthListeners(); initListeners(); updateStaticLanguage();");
  return { sandbox, run, storage, getSetItemCalls: () => setItemCallCount };
}

let threw = null;
try {
  // --- Test 1: saveState() never throws, even on a genuine QuotaExceededError. ---
  {
    const { run } = buildSandbox({ quotaAlwaysThrows: true });
    run(`
      state.users['a@example.com'] = { name: 'a', email: 'a@example.com', password: 'x', profile: { englishName: 'A' } };
      state.active = 'a@example.com';
    `);
    const result = run(`(function(){ try { saveState(); return 'no-throw'; } catch (e) { return 'threw: ' + e.message; } })()`);
    check(result === 'no-throw', `BUG FIX VERIFIED: saveState() does not throw even when localStorage.setItem always throws QuotaExceededError (got: ${result})`);
  }

  // --- Test 2: the exact reported symptom - Sign Out still navigates away even when saveState()
  // hits the quota, because saveState() itself never propagates the error to its caller. ---
  {
    const { run } = buildSandbox({ quotaAlwaysThrows: true });
    run(`
      state.users['b@example.com'] = {
        name: 'b', email: 'b@example.com', password: 'x',
        profile: { englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
          birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
          birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      };
      state.active = 'b@example.com';
      go('home');
    `);
    check(run("document.querySelector('.view.active')?.id") === 'home', 'signed-in user starts on the home view');
    run("document.getElementById('signOut').dispatchEvent(new window.Event('click', {bubbles:true}));");
    check(run("state.active") === null, 'Sign Out still clears the active user even when saveState hits quota');
    check(run("document.querySelector('.view.active')?.id") === 'welcome',
      'BUG FIX VERIFIED (matches reported symptom "nothing happens when sign out is clicked"): Sign Out still navigates to the welcome view even when saveState() throws a QuotaExceededError internally');
  }

  // --- Test 3: pruning recovers old, RESOLVED lottery log entries first, and a save that fits after
  // pruning actually succeeds and is persisted. ---
  {
    const { run, storage } = buildSandbox({ quotaCeiling: 6500 });
    run(`
      state.users['c@example.com'] = { name: 'c', email: 'c@example.com', password: 'x', profile: { englishName: 'C' }, lotteryLog: { fourD: [], toto: [] } };
      state.active = 'c@example.com';
      // 40 old, already-resolved entries (padded so the serialized state exceeds this test's 500-char
      // quota ceiling) plus 2 unresolved (upcoming) ones that must survive pruning.
      for (let i = 0; i < 40; i++) {
        state.users['c@example.com'].lotteryLog.fourD.push({
          isoDate: '2020-01-' + String((i % 28) + 1).padStart(2,'0'),
          sets: ['1234','5678'], generatedAt: 'x', checked: true, actual: { winning: ['1234'] }, hitSummary: {},
          pad: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        });
      }
      state.users['c@example.com'].lotteryLog.fourD.push({ isoDate: '2099-01-01', sets: ['1111'], generatedAt: 'x', checked: false, actual: null, hitSummary: null });
      state.users['c@example.com'].lotteryLog.fourD.push({ isoDate: '2099-01-02', sets: ['2222'], generatedAt: 'x', checked: false, actual: null, hitSummary: null });
    `);
    const beforeLen = run("state.users['c@example.com'].lotteryLog.fourD.length");
    check(beforeLen === 42, 'test fixture set up with 42 lottery log entries (40 resolved + 2 unresolved)');
    const saveResult = run("saveState()");
    check(saveResult === true, 'saveState() recovers and succeeds after pruning old resolved entries to fit under quota');
    check('illuminate-local-v101' in storage, 'the pruned, smaller state was actually persisted to localStorage');
    const afterLen = run("state.users['c@example.com'].lotteryLog.fourD.length");
    check(afterLen < beforeLen, `pruning actually reduced the lottery log size (before: ${beforeLen}, after: ${afterLen})`);
    const unresolvedSurvived = run("state.users['c@example.com'].lotteryLog.fourD.filter(e => !e.checked).length");
    check(unresolvedSurvived === 2, 'BUG FIX VERIFIED: pruning never removes unresolved/upcoming predictions - only old, already-checked entries');
    const profileIntact = run("state.users['c@example.com'].profile.englishName");
    check(profileIntact === 'C', 'pruning never touches profile data - only the lottery log');
  }

  // --- Test 4: when even pruning cannot recover enough space, saveState() still doesn't throw, skips
  // the save gracefully, and shows the one-time on-screen warning banner instead of failing silently. ---
  {
    const { run } = buildSandbox({ quotaAlwaysThrows: true });
    run(`
      state.users['d@example.com'] = { name: 'd', email: 'd@example.com', password: 'x', profile: { englishName: 'D' }, lotteryLog: { fourD: [], toto: [] } };
      state.active = 'd@example.com';
      for (let i = 0; i < 40; i++) state.users['d@example.com'].lotteryLog.fourD.push({ isoDate: '2020-01-' + String((i%28)+1).padStart(2,'0'), sets: ['1234'], generatedAt: 'x', checked: true, actual: {winning:['1234']}, hitSummary: {} });
      updateStaticLanguage();
    `);
    check(run("document.getElementById('storageWarningBanner').style.display") !== 'block', 'warning banner starts hidden');
    const saveResult = run("saveState()");
    check(saveResult === false, 'saveState() reports failure (false) when even pruning cannot fit under quota, but still does not throw');
    check(run("document.getElementById('storageWarningBanner').style.display") === 'block', 'BUG FIX VERIFIED: an unrecoverable quota failure surfaces a visible on-screen warning instead of failing silently');
    check(run("document.getElementById('storageWarningText').textContent").length > 0, 'the warning banner has explanatory text');
    // Second failure should not need to show it again (already visible) but must still not throw.
    const secondResult = run("(function(){ try { saveState(); return 'no-throw'; } catch(e) { return 'threw'; } })()");
    check(secondResult === 'no-throw', 'a repeated quota failure in the same session still never throws');
    // Dismiss button hides it.
    run("document.getElementById('btnDismissStorageWarning').dispatchEvent(new window.Event('click', {bubbles:true}));");
    check(run("document.getElementById('storageWarningBanner').style.display") === 'none', 'the Dismiss button hides the warning banner');
  }

  // --- Test 5: regression - a normal save (well under quota) still works exactly as before. ---
  {
    const { run, storage } = buildSandbox();
    run(`
      state.users['e@example.com'] = { name: 'e', email: 'e@example.com', password: 'x', profile: { englishName: 'E' } };
      state.active = 'e@example.com';
    `);
    const result = run("saveState()");
    check(result === true, 'a normal, well-under-quota save still returns true (regression)');
    check(JSON.parse(storage['illuminate-local-v101']).active === 'e@example.com', 'a normal save is still correctly persisted (regression)');
  }
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
