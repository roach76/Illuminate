const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Regression test for a NEW root cause found this round via a full re-audit of the Hourly-tab lag
// report ("Initial change of day was unresponsive for 5-8 seconds, ok for next 2 changes and the issues
// recurs after the 3rd change of day onwards" - live-tested twice with zero jank/pre-render triggering,
// and the app's own hourlyPerfDiag timer reads genuinely fast (2-3ms) even while the felt lag persists).
//
// Root cause: renderStandardDeepAnalysis (used 30+ times per chart render, per its own long-standing
// comment) registers a BRAND NEW deepAnalysisRegistry entry - keyed by an ever-incrementing counter, so
// it always ADDS, never overwrites - on every single call. Until this round, nothing ever purged those
// entries except the Hourly tab's own separate, self-contained cleanup (__hourlyPopupIds, fixed and
// tested in test_hourly_registry_leak_fix.js). But renderAllViews() (home/chart/partnerView/bizView -
// triggered on nearly every navigation, every save, every language toggle) and renderChildrenTab() both
// fully rebuild their container's innerHTML on every call, re-registering a fresh batch of 30-150+
// entries each time, while the PREVIOUS batch - already replaced and unreachable in the live DOM - was
// left behind in deepAnalysisRegistry forever. Across a real session (repeated navigation, edits, tab
// switches - exactly what a real usage session involves before ever reaching the Hourly tab, but a short
// scripted reproduction would not), this grows into thousands of retained multi-paragraph HTML strings,
// none of it freed by a normal minor GC because it is genuinely still reachable. The Hourly tab's own
// computation is the single heaviest allocation burst anywhere in the app, so it's the burst most likely
// to finally force a major GC pause under that accumulated heap pressure - explaining why the lag is
// specific to that tab, why it "recurs" and gets worse the longer the app has been used in one session,
// and why the app's own performance.now()-based timer (measuring only its own script's execution) never
// catches it.
//
// Fix: track every id renderStandardDeepAnalysis registers in __mainDeepAnalysisIds, and purge the
// previous batch (provably orphaned the moment a new one is generated, since that batch's DOM content
// has already been overwritten by then) at the start of renderAllViews() and renderChildrenTab().
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

// Real-shaped household matching test data.xlsx (individual + Life Partner + Business Partner + a
// child), so renderAllViews/renderChildrenTab actually build out the full multi-profile chart content
// this bug depends on, not just a single bare profile.
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', chineseFirstName: '伟', chineseLastName: '黄', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  partner: { englishFirstName: 'Tina', englishLastName: 'Seah', chineseFirstName: '婷', chineseLastName: '謝', birthdate: '1980-03-15', birthtime: '14:10', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  businessPartner: { englishFirstName: 'Bobby', englishLastName: 'Neo', chineseFirstName: '博', chineseLastName: '梁', birthdate: '1975-11-02', birthtime: '06:45', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  children: [
    { englishFirstName: 'Zayn', englishLastName: 'Neo', birthdate: '2010-06-20', birthtime: '10:00', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  ],
};
vm.runInContext(`
  state.users['test@test.com'] = ${JSON.stringify(testUser)};
  state.active = 'test@test.com';
`, sandbox);

function registrySize() {
  return Object.keys(vm.runInContext('deepAnalysisRegistry', sandbox)).length;
}
function trackedIdCount() {
  const ids = vm.runInContext('typeof __mainDeepAnalysisIds !== "undefined" ? __mainDeepAnalysisIds : []', sandbox);
  return Array.isArray(ids) ? ids.length : 0;
}

// First navigation to 'home' triggers one renderAllViews() call.
vm.runInContext(`go('home')`, sandbox);
const sizeAfterFirstHome = registrySize();
const trackedAfterFirstHome = trackedIdCount();
check(sizeAfterFirstHome > 20, `first renderAllViews() call (individual + Life Partner + Business Partner + child, all with real deep-analysis sections) registers a substantial batch of entries - got ${sizeAfterFirstHome}, expected 30+`);
check(trackedAfterFirstHome === sizeAfterFirstHome, `every entry registered by the first renderAllViews() call is tracked for later purging - got ${trackedAfterFirstHome} tracked vs ${sizeAfterFirstHome} in the registry`);

// Simulate a realistic session: repeatedly re-navigating to 'home' (renderAllViews), 'childrenTab'
// (renderChildrenTab), and back - exactly the kind of ordinary browsing that happens before a user ever
// reaches the Hourly tab, and which the bug report's own symptom ("recurs after repeated use") implies
// was happening in the background the whole time.
for (let i = 0; i < 15; i++) {
  vm.runInContext(`go('home')`, sandbox);
  vm.runInContext(`go('childrenTab')`, sandbox);
}
const sizeAfterManyNavigations = registrySize();
const trackedAfterManyNavigations = trackedIdCount();

check(
  sizeAfterManyNavigations <= sizeAfterFirstHome + 20,
  `BUG FIX VERIFIED: deepAnalysisRegistry size after 30 more navigations (${sizeAfterManyNavigations}) stays essentially flat versus after 1 navigation (${sizeAfterFirstHome}) instead of growing ~30x (would be ${sizeAfterFirstHome * 30}+ under the old unbounded-growth behaviour) - this is exactly the kind of session-duration-dependent heap growth that would make an unrelated heavy computation (like the Hourly tab's 12-block burst) increasingly likely to trigger a slow major GC pause the longer a real session runs`
);
check(
  trackedAfterManyNavigations === sizeAfterManyNavigations,
  `tracked-id count still matches registry size after repeated navigation (no drift between what's tracked and what's actually stored) - got ${trackedAfterManyNavigations} tracked vs ${sizeAfterManyNavigations} in registry`
);

// Confirm this didn't break the feature itself: buttons in the CURRENTLY VISIBLE view (".view.active" -
// every other view is "display:none" per styles.css, so its buttons are unreachable by the user and are
// always freshly rebuilt the next time that view is navigated to anyway - see the comment on go() in
// app.js) must still resolve to real content in the registry.
const currentBatchIntact = vm.runInContext(`
  (() => {
    const ids = document.querySelectorAll('.view.active .btnViewDeepAnalysis[data-id]');
    if (!ids.length) return false;
    return Array.from(ids).every(el => deepAnalysisRegistry[el.dataset.id] !== undefined);
  })()
`, sandbox);
check(currentBatchIntact, 'every "View Details" button in the currently VISIBLE view still resolves to real content in deepAnalysisRegistry (the fix purges only the previous, already-replaced batch for that same render path, never the live/visible one)');

// Hourly tab's own separate cleanup (already fixed/tested elsewhere) must still be untouched by this
// more general fix - the two mechanisms are independent and must not interfere with each other.
vm.runInContext(`renderHourlyTab()`, sandbox);
const hourlyIdsExist = vm.runInContext(`Array.isArray(globalThis.__hourlyPopupIds)`, sandbox);
check(hourlyIdsExist, 'Hourly tab\'s own independent id-tracking (__hourlyPopupIds) still initializes normally alongside this more general fix');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
