const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the NEW background PDF pre-rendering feature (requested directly, twice: "Is there a way to
// have the PDF generation render in the background when information is updated so when the export pdf
// button is clicked, the pdf can be almost immediately presented?").
//
// UPDATE (a later round): schedulePdfPreRender() itself was made an intentional no-op after being
// directly confirmed, live, as the root cause of a full-app freeze + styles.css request flood on every
// page load for a real multi-profile household - see its own BUG FIX comment in app.js and test 8 below.
// saveState() still calls it (unchanged, still tested by test 9 below); it just no longer does anything.
// The rest of this feature's machinery (runPdfBackgroundPreRenderQueue, the cache, exportProfileToPdfInner's
// cache-check) is untouched and still directly tested below, in case it's ever re-armed more safely.
//
// Design under test:
// - computeActiveUserPdfFingerprint(): a cheap, stable, change-detecting hash of the active user's data.
// - schedulePdfPreRender(): now an intentional no-op (see UPDATE above) - previously: debounced (2.5s) +
//   idle-gated kickoff, called from saveState() in engine-core.js after every successful save.
// - runPdfBackgroundPreRenderQueue(): builds a Blob per existing profile (via the pre-existing
//   buildProfilePdfBlob), sequentially, yielding between each; guards against re-entrancy, a live export
//   in flight, missing html2pdf, no active profile; prunes cache entries for removed profiles.
// - exportProfileToPdfInner(): on a fresh cache hit (fingerprint match), downloads the cached Blob
//   directly via downloadPdfBlob and SKIPS the entire html2canvas/jsPDF pipeline; on a miss/stale entry,
//   falls through to the unchanged live build, which then warms the cache with its own result.
//
// Uses the same real-pipeline mocking pattern as test_pdf_export_full_flow_duplicate_ids.js (a fake
// html2pdf that counts real per-section captures, and a synthetic non-zero getBoundingClientRect, since
// jsdom has no layout engine) so buildProfilePdfBlob genuinely runs captureChunksIntoPdf rather than being
// stubbed out - letting this test tell a real cache-hit short-circuit apart from a real cache-miss build.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-core.js'), 'utf8');

// --- Static source checks -------------------------------------------------
check(/function computeActiveUserPdfFingerprint/.test(appSrc), 'computeActiveUserPdfFingerprint exists');
check(/function schedulePdfPreRender/.test(appSrc), 'schedulePdfPreRender exists');
check(/async function runPdfBackgroundPreRenderQueue/.test(appSrc), 'runPdfBackgroundPreRenderQueue exists');
check(/function downloadPdfBlob/.test(appSrc), 'downloadPdfBlob exists');
check(/const __pdfPreRenderCache = \{\};/.test(appSrc), '__pdfPreRenderCache store exists');
check(/if \(typeof schedulePdfPreRender === 'function'\) schedulePdfPreRender\(\);/.test(coreSrc), 'saveState() in engine-core.js calls schedulePdfPreRender() (forward-reference, guarded)');
check((coreSrc.match(/if \(typeof schedulePdfPreRender === 'function'\) schedulePdfPreRender\(\);/g) || []).length === 2, 'schedulePdfPreRender() is called from BOTH the primary save path and the quota-exceeded recovery path');
check(/const MAX_PROFILES_PER_RUN = 6;/.test(appSrc), 'background queue caps profiles per run');

function makeFakePdfDoc() {
  let pageCount = 1;
  const proxy = new Proxy(function () {}, {
    get(target, prop) {
      if (prop === 'getNumberOfPages') return () => pageCount;
      if (prop === 'addPage') return () => { pageCount++; return proxy; };
      if (prop === 'output') return () => ({ __fakeBlob: true, id: Math.random() });
      if (prop === 'save') return () => {};
      if (prop === 'internal') return { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
      if (prop === 'then') return undefined;
      return (..._args) => proxy;
    },
  });
  return proxy;
}

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  const win = dom.window;
  const doc = win.document;
  win.HTMLCanvasElement.prototype.getContext = function () {
    return { fillStyle: '#fff', fillRect() {}, drawImage() {}, clearRect() {}, save() {}, restore() {}, translate() {}, scale() {} };
  };
  win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/jpeg;base64,AAAA'; };
  // jsdom has no layout engine (every getBoundingClientRect().height is 0), which would make every PDF
  // section vanish before capture even starts - see the identical fix/comment in
  // test_pdf_export_full_flow_duplicate_ids.js for why this synthetic, bounded height is needed.
  win.Element.prototype.getBoundingClientRect = function () {
    let style;
    try { style = win.getComputedStyle(this); } catch (e) { style = null; }
    if (style && style.display === 'none') return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
    const text = this.textContent || '';
    const h = Math.max(16, Math.min(140, Math.round(text.length / 6)));
    return { top: 0, left: 0, right: 400, bottom: h, width: 400, height: h, x: 0, y: 0 };
  };

  let sectionCaptureCount = 0;
  function html2pdfMock() {
    const chain = {
      set() { return chain; },
      from(el, type) { chain._el = el; chain._type = type; return chain; },
      toCanvas() {
        sectionCaptureCount++;
        const fakeCanvas = doc.createElement('canvas');
        fakeCanvas.width = 840;
        fakeCanvas.height = 200 + (sectionCaptureCount % 5) * 50;
        chain.prop = { canvas: fakeCanvas };
        return { then(cb) { cb.call(chain); return { catch() { return this; } }; }, catch() { return this; } };
      },
      toPdf() {
        chain.prop = { pdf: makeFakePdfDoc() };
        return { then(cb) { cb.call(chain); return { catch() { return this; } }; }, catch() { return this; } };
      },
    };
    return chain;
  }

  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  const downloadedUrls = [];
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: doc, window: win,
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp, Proxy,
    Blob: function Blob() {},
    URL: { createObjectURL: (b) => { const u = `blob:fake-${downloadedUrls.length}`; downloadedUrls.push(u); return u; }, revokeObjectURL: () => {} },
    html2pdf: html2pdfMock,
    JSZip: function () { return { file() {}, generateAsync: async () => ({}) }; },
    alert: () => {}, confirm: () => true,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { dom, sandbox, downloadedUrls, getSectionCaptureCount: () => sectionCaptureCount };
}

const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};

// --- 1. Fingerprint stability / change-detection --------------------------
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`
    state.users['test@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test@test.com';
  `, sandbox);
  const fp1 = vm.runInContext(`computeActiveUserPdfFingerprint()`, sandbox);
  const fp2 = vm.runInContext(`computeActiveUserPdfFingerprint()`, sandbox);
  check(typeof fp1 === 'string' && fp1.length > 0, 'fingerprint is a non-empty string');
  check(fp1 === fp2, 'fingerprint is stable across repeated calls with no data change');
  vm.runInContext(`state.users['test@test.com'].profile.englishFirstName = 'Royston';`, sandbox);
  const fp3 = vm.runInContext(`computeActiveUserPdfFingerprint()`, sandbox);
  check(fp3 !== fp1, 'fingerprint changes when the active user data changes');
}

// --- 2. runPdfBackgroundPreRenderQueue: guards --------------------------------
{
  const { sandbox } = freshSandbox();
  let threw = false;
  vm.runInContext(`state.active = null;`, sandbox);
  try { vm.runInContext(`runPdfBackgroundPreRenderQueue()`, sandbox); } catch (e) { threw = true; }
  check(!threw, 'runPdfBackgroundPreRenderQueue does not throw when there is no active user');

  vm.runInContext(`
    state.users['test@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test@test.com';
    globalThis.__savedHtml2pdf = html2pdf;
    html2pdf = undefined;
  `, sandbox);
  vm.runInContext(`runPdfBackgroundPreRenderQueue()`, sandbox);
  const cacheAfterNoHtml2pdf = vm.runInContext(`__pdfPreRenderCache['test@test.com']`, sandbox);
  check(!cacheAfterNoHtml2pdf || Object.keys(cacheAfterNoHtml2pdf).length === 0, 'no pre-render happens while html2pdf is undefined (CDN not loaded)');
  vm.runInContext(`html2pdf = globalThis.__savedHtml2pdf;`, sandbox);
}

(async () => {
  // --- 3. End-to-end: background queue populates the cache, then export hits it instantly -----------
  {
    const { sandbox, downloadedUrls, getSectionCaptureCount } = freshSandbox();
    vm.runInContext(`
      state.users['test@test.com'] = ${JSON.stringify(testUser)};
      state.active = 'test@test.com';
    `, sandbox);

    await vm.runInContext(`runPdfBackgroundPreRenderQueue()`, sandbox);
    const cacheEntry = vm.runInContext(`__pdfPreRenderCache['test@test.com'] && __pdfPreRenderCache['test@test.com']['i']`, sandbox);
    check(!!cacheEntry, 'background queue populates a cache entry for the "self" profile');
    check(cacheEntry && !!cacheEntry.blob, 'the cached entry carries a built Blob-like result');
    check(cacheEntry && cacheEntry.fingerprint === vm.runInContext(`computeActiveUserPdfFingerprint()`, sandbox), "the cached entry's fingerprint matches the current data");
    const captureCountAfterBackground = getSectionCaptureCount();
    check(captureCountAfterBackground > 0, `sanity: the background pre-render actually ran the real capture pipeline (captured ${captureCountAfterBackground} section(s)), not a stub`);

    // A real export now: should hit the cache and download instantly WITHOUT running any further
    // captures (sectionCaptureCount must not increase beyond what the background run already did).
    let exportThrew = null;
    try {
      await vm.runInContext(`exportProfileToPdf('i')`, sandbox);
    } catch (e) { exportThrew = e; }
    check(!exportThrew, 'exportProfileToPdf completes without throwing on a cache hit');
    check(getSectionCaptureCount() === captureCountAfterBackground, 'a fresh cache hit SKIPS the live html2canvas/jsPDF pipeline entirely (no new section captures)');
    check(downloadedUrls.length === 1, 'a cache-hit export triggers exactly one Blob download');
  }

  // --- 4. Cache invalidation: a data change makes the existing entry stale ---------------------------
  {
    const { sandbox } = freshSandbox();
    vm.runInContext(`
      state.users['test@test.com'] = ${JSON.stringify(testUser)};
      state.active = 'test@test.com';
    `, sandbox);
    await vm.runInContext(`runPdfBackgroundPreRenderQueue()`, sandbox);
    const cacheEntry = vm.runInContext(`__pdfPreRenderCache['test@test.com']['i']`, sandbox);
    vm.runInContext(`state.users['test@test.com'].profile.englishFirstName = 'Changed';`, sandbox);
    const newFingerprint = vm.runInContext(`computeActiveUserPdfFingerprint()`, sandbox);
    check(newFingerprint !== cacheEntry.fingerprint, "after a data change, the existing cache entry's fingerprint is now stale (would not be served)");
  }

  // --- 5. Cache miss falls through to the live build AND warms the cache afterward -------------------
  {
    const { sandbox, getSectionCaptureCount } = freshSandbox();
    vm.runInContext(`
      state.users['test@test.com'] = ${JSON.stringify(testUser)};
      state.active = 'test@test.com';
    `, sandbox);
    // No pre-render has run yet - cache is empty, so this export must fall through to the live path.
    await vm.runInContext(`exportProfileToPdf('i')`, sandbox);
    check(getSectionCaptureCount() > 0, 'a cache MISS falls through to the live build pipeline as before (real sections were captured)');
    const warmedCache = vm.runInContext(`__pdfPreRenderCache['test@test.com'] && __pdfPreRenderCache['test@test.com']['i']`, sandbox);
    check(!!warmedCache && !!warmedCache.blob, 'a successful live build warms the pre-render cache with its own result');
    check(warmedCache.fingerprint === vm.runInContext(`computeActiveUserPdfFingerprint()`, sandbox), "the newly-warmed cache entry's fingerprint matches current data");
  }

  // --- 6. Cache pruning: a profile that no longer exists is dropped from the cache -------------------
  {
    const { sandbox } = freshSandbox();
    const userWithPartner = JSON.parse(JSON.stringify(testUser));
    userWithPartner.partner = { englishFirstName: 'Jane', englishLastName: 'Wong', birthdate: '1980-01-01', birthtime: '10:00', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 };
    vm.runInContext(`
      state.users['test@test.com'] = ${JSON.stringify(userWithPartner)};
      state.active = 'test@test.com';
    `, sandbox);
    await vm.runInContext(`runPdfBackgroundPreRenderQueue()`, sandbox);
    const prefixesBefore = vm.runInContext(`Object.keys(__pdfPreRenderCache['test@test.com'] || {})`, sandbox);
    check(prefixesBefore.includes('i') && prefixesBefore.includes('p'), 'background queue pre-renders both existing profiles ("i" and "p")');
    vm.runInContext(`delete state.users['test@test.com'].partner;`, sandbox);
    await vm.runInContext(`runPdfBackgroundPreRenderQueue()`, sandbox);
    const prefixesAfter = vm.runInContext(`Object.keys(__pdfPreRenderCache['test@test.com'] || {})`, sandbox);
    check(!prefixesAfter.includes('p'), "a removed profile's stale cache entry is pruned on the next background run");
    check(prefixesAfter.includes('i'), 'the still-existing profile\'s cache entry is retained');
  }

  // --- 7. Guard: does not build while a live export is in flight -------------------------------------
  {
    const { sandbox } = freshSandbox();
    vm.runInContext(`
      state.users['test@test.com'] = ${JSON.stringify(testUser)};
      state.active = 'test@test.com';
      __pdfExportInFlight = true;
    `, sandbox);
    await vm.runInContext(`runPdfBackgroundPreRenderQueue()`, sandbox);
    const cacheWhileInFlight = vm.runInContext(`__pdfPreRenderCache['test@test.com']`, sandbox);
    check(!cacheWhileInFlight || Object.keys(cacheWhileInFlight).length === 0, 'background queue does not build anything while a live export is in flight (defers instead)');
  }

  // --- 8. schedulePdfPreRender is now an intentional no-op (see its own BUG FIX comment in app.js) ------
  // BUG FIX (root cause of "not responsive to any clicks upon loading", live-reproduced and confirmed
  // this round): schedulePdfPreRender used to debounce-then-kick-off runPdfBackgroundPreRenderQueue,
  // which builds a full html2canvas-based PDF for EVERY profile on the account. It was armed by every
  // saveState() call, including the automatic one-time-per-session lottery auto-fetch/backfill that runs
  // on every fresh page load - so for a real multi-profile household with substantial content, this
  // fired on every single load and kept the main thread busy building several large PDFs in the
  // background, which is exactly what was reported as full-app unresponsiveness plus a styles.css
  // request flood (html2canvas re-fetches the page's stylesheet on every one of its internal capture
  // passes). schedulePdfPreRender is now a deliberate no-op - this test updates to assert exactly that:
  // no number of calls ever triggers a background run, rather than asserting the old debounced-to-one
  // behavior this round intentionally removed.
  {
    const { sandbox } = freshSandbox();
    vm.runInContext(`
      state.users['test@test.com'] = ${JSON.stringify(testUser)};
      state.active = 'test@test.com';
      globalThis.__preRenderRunCount = 0;
      globalThis.__origRunQueue = runPdfBackgroundPreRenderQueue;
      runPdfBackgroundPreRenderQueue = function() { globalThis.__preRenderRunCount++; return globalThis.__origRunQueue(); };
    `, sandbox);
    // Fire schedulePdfPreRender 5 times in quick succession (simulating 5 keystroke-triggered saves, or
    // 5 page loads each running the on-load lottery auto-fetch/backfill).
    vm.runInContext(`
      for (let i = 0; i < 5; i++) schedulePdfPreRender();
    `, sandbox);
    // Wait well past the OLD 2.5s debounce + idle fallback (300ms), with margin - confirming no run ever
    // fires, not just that it hasn't fired YET.
    await new Promise(resolve => setTimeout(resolve, 3200));
    const runCount = vm.runInContext(`globalThis.__preRenderRunCount`, sandbox);
    check(runCount === 0, `BUG FIX VERIFIED: schedulePdfPreRender() is now a no-op - 5 rapid calls (simulating repeated saves/page loads) result in ZERO background runs, not 1 (the old debounced-to-one behavior) - got ${runCount}`);
    vm.runInContext(`runPdfBackgroundPreRenderQueue = globalThis.__origRunQueue;`, sandbox);
  }

  // --- 9. saveState() actually schedules a pre-render (integration with engine-core.js) --------------
  {
    const { sandbox } = freshSandbox();
    vm.runInContext(`
      state.users['test@test.com'] = ${JSON.stringify(testUser)};
      state.active = 'test@test.com';
      globalThis.__scheduleCalls = 0;
      globalThis.__origSchedule = schedulePdfPreRender;
      schedulePdfPreRender = function() { globalThis.__scheduleCalls++; };
    `, sandbox);
    vm.runInContext(`saveState();`, sandbox);
    const scheduleCalls = vm.runInContext(`globalThis.__scheduleCalls`, sandbox);
    check(scheduleCalls === 1, 'a real saveState() call schedules exactly one background pre-render');
    vm.runInContext(`schedulePdfPreRender = globalThis.__origSchedule;`, sandbox);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  // Several fresh JSDOM windows are created across this file's test blocks and never explicitly closed,
  // which can otherwise leave the process alive on lingering internal handles even after every check has
  // finished - force a clean, unambiguous exit either way, exactly as this file's own reported outcome.
  process.exit(fail > 0 ? 1 : 0);
})();
