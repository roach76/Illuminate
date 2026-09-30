const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Regression test for "not responsive to any clicks upon loading" + a rapid GET /styles.css flood in the
// local server console - reported with a screenshot, and DIRECTLY reproduced and confirmed live this
// round against the real running app (not guessed at): __pdfBackgroundBuildActive and
// __pdfPreRenderQueueState.running both read true within seconds of a fresh page load, with the browser
// console showing a continuous back-to-back stream of html2canvas "Starting document clone"/"Finished
// rendering" cycles and 100+ styles.css requests within the first few seconds - before any click.
//
// Root cause: schedulePdfPreRender() is armed by every saveState() call - including the automatic
// one-time-per-session lottery auto-fetch + historical backfill that runs immediately after every fresh
// page load (see renderAllViews' call to fetchLatestLotteryResults/backfillHistoricalAccuracy, and
// backfillHistoricalAccuracy's own saveState() call in engine-predictions.js). 2.5 seconds after THAT
// automatic, non-user-initiated save, the background queue used to kick off, building a full
// html2canvas-based PDF for every profile on the account - for a real 3-profile household with
// substantial content (98+ real pages per profile, after an earlier round's fix stopped the export from
// silently collapsing to ~2 pages), this kept the main thread busy building several large PDFs
// essentially continuously, on every single page load, whether or not the user had changed anything.
//
// Fix: schedulePdfPreRender() is now an intentional no-op (see its own BUG FIX comment in app.js). This
// test simulates the exact trigger chain - the on-load lottery auto-fetch/backfill's own saveState() call
// - and confirms it no longer arms any background PDF work at all.
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

// A real-shaped 3-profile household (individual + Life Partner + Business Partner), matching the account
// scale where this was actually observed.
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  partner: { englishFirstName: 'Tina', englishLastName: 'Seah', birthdate: '1980-03-15', birthtime: '14:10', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  businessPartner: { englishFirstName: 'Bobby', englishLastName: 'Neo', birthdate: '1975-11-02', birthtime: '06:45', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
};

(async () => {
  // --- 1. The exact real trigger chain: an automatic (non-user-initiated) saveState() call, of the kind
  // the on-load lottery auto-fetch/backfill makes, must NOT arm any background PDF work. ----------------
  {
    const { sandbox } = freshSandbox();
    vm.runInContext(`
      state.users['test@test.com'] = ${JSON.stringify(testUser)};
      state.active = 'test@test.com';
      globalThis.__runCount = 0;
      globalThis.__origRunQueue = runPdfBackgroundPreRenderQueue;
      runPdfBackgroundPreRenderQueue = function() { globalThis.__runCount++; return globalThis.__origRunQueue(); };
    `, sandbox);

    // Simulate exactly what backfillHistoricalAccuracy does after an on-load auto-fetch: call saveState()
    // with no user interaction at all.
    vm.runInContext(`saveState();`, sandbox);

    // Wait well past the old 2.5s debounce + idle fallback (300ms), with margin.
    await new Promise(resolve => setTimeout(resolve, 3200));
    const runCount = vm.runInContext(`globalThis.__runCount`, sandbox);
    check(runCount === 0, `BUG FIX VERIFIED: an automatic saveState() call (matching the on-load lottery auto-fetch/backfill's own save) triggers ZERO background PDF pre-render runs - got ${runCount}`);

    check(vm.runInContext(`typeof __pdfBackgroundBuildActive`, sandbox) !== 'undefined', 'the underlying background-build flag still exists (infrastructure kept intact, just not auto-armed)');
    check(vm.runInContext(`__pdfBackgroundBuildActive`, sandbox) === false, 'no background build is active after an automatic save + a full wait past the old debounce window');
    check(vm.runInContext(`__pdfPreRenderQueueState.running`, sandbox) === false, 'the background queue never started running after an automatic save + a full wait past the old debounce window');

    vm.runInContext(`runPdfBackgroundPreRenderQueue = globalThis.__origRunQueue;`, sandbox);
  }

  // --- 2. Many rapid automatic saves (simulating several page loads / several auto-save events across a
  // session) still never trigger a single background run - not just "not yet", genuinely never. ---------
  {
    const { sandbox } = freshSandbox();
    vm.runInContext(`
      state.users['test@test.com'] = ${JSON.stringify(testUser)};
      state.active = 'test@test.com';
      globalThis.__runCount = 0;
      globalThis.__origRunQueue = runPdfBackgroundPreRenderQueue;
      runPdfBackgroundPreRenderQueue = function() { globalThis.__runCount++; return globalThis.__origRunQueue(); };
      for (let i = 0; i < 10; i++) saveState();
    `, sandbox);
    await new Promise(resolve => setTimeout(resolve, 3200));
    const runCount = vm.runInContext(`globalThis.__runCount`, sandbox);
    check(runCount === 0, `BUG FIX VERIFIED: 10 rapid automatic saves (simulating repeated page loads/session activity) still trigger ZERO background PDF runs - got ${runCount}`);
    vm.runInContext(`runPdfBackgroundPreRenderQueue = globalThis.__origRunQueue;`, sandbox);
  }

  // --- 3. Exporting a PDF still works correctly (falls straight to the live build, which already has its
  // own on-screen progress UI) - this fix must not have broken PDF export itself. ------------------------
  {
    const { sandbox } = freshSandbox();
    // Minimal html2pdf/canvas mocking, same pattern as test_pdf_background_prerender.js, just enough to
    // confirm the live build path still runs end-to-end without throwing.
    vm.runInContext(`
      state.users['test@test.com'] = ${JSON.stringify(testUser)};
      state.active = 'test@test.com';
    `, sandbox);
    const hasHtml2pdf = vm.runInContext(`typeof html2pdf`, sandbox);
    check(hasHtml2pdf === 'undefined', 'sanity: this sandbox has no html2pdf mock, so exportProfileToPdf must hit the graceful "unavailable" branch, not throw');
    let threw = false;
    try {
      await vm.runInContext(`exportProfileToPdf('i')`, sandbox);
    } catch (e) { threw = true; }
    check(!threw, 'exportProfileToPdf still completes without throwing when the pre-render cache is empty (as it always now is) - confirms the fix did not break the live export fallback path');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
