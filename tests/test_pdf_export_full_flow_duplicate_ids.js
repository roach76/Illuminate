const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Re-investigation (reported via a FRESH DevTools screenshot, after the Task #79 ordering fix had
// already shipped: "load warning is gone, issues still persist when generating the PDF" - "8 Duplicate
// form field id in the same form" issues, down from the original 20 but not zero). The earlier
// dedicated test (test_pdf_duplicate_id_append_order.js) only exercised the EXTRACTED container-setup
// fragment of exportProfileToPdfInner/buildProfilePdfBlob (creation through the first appendChild) -
// it never ran the REST of the real export pipeline (captureChunksIntoPdf's PASS 1 per-section
// secContainer clone/append/measure/capture/remove loop, which runs dozens of times per export and is
// the only OTHER place this app creates and attaches a container carrying cloned ids). This test runs
// the REAL, complete exportProfileToPdfInner('i') end-to-end against a full jsdom document built from
// the actual index.html, with html2pdf/canvas mocked out (no real image rendering, no network), and
// installs a global Node.prototype.appendChild monitor that inspects the ENTIRE live document for any
// duplicate id the instant anything is appended anywhere - catching a collision no matter which one of
// the (at least 3) container-creation sites in this file it originates from.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
const win = dom.window;
const doc = win.document;

// --- Canvas + html2pdf mocking: no real rendering, just enough surface area for the real pipeline to
// run all the way through PASS 1 (the DOM-touching part we actually care about) and, ideally, all the
// way to a saved/blobbed PDF. ---
win.HTMLCanvasElement.prototype.getContext = function () {
  return { fillStyle: '#fff', fillRect() {}, drawImage() {}, clearRect() {}, save() {}, restore() {}, translate() {}, scale() {} };
};
win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/jpeg;base64,AAAA'; };

// jsdom has no real layout engine, so every element's real getBoundingClientRect().height is always 0 -
// and captureChunksIntoPdf's expandIntoCaptureUnits() deliberately (and correctly, for the real browser)
// skips any node whose natural height is <= 0 (see its own "zero-height node" bug-fix comment), which
// would make EVERY section in this test disappear before PASS 1 ever touches the DOM. A crude, stable,
// content-derived non-zero height estimate lets the real capture loop actually run dozens of times
// (exercising the real clone/append/measure/capture/remove cycle we're here to test), without needing a
// real rendering engine - the exact pixel values are irrelevant to this test's own diagnostic.
win.Element.prototype.getBoundingClientRect = function () {
  let style;
  try { style = win.getComputedStyle(this); } catch (e) { style = null; }
  if (style && style.display === 'none') return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
  // Deliberately small and bounded (not scaled by child count) - a formula that grows with nesting
  // depth/child count causes runaway over-splitting in captureChunksIntoPdf's real recursive
  // expandIntoCaptureUnits() (every container with more than ~20 children would otherwise measure as
  // "too tall", forcing recursion into its children, which are then ALSO measured as "too tall" by the
  // same rule, etc.) - producing thousands of capture units and making this test impractically slow
  // without adding any diagnostic value (the duplicate-id check below cares about the clone/append/
  // remove PATTERN, not how many times it repeats).
  const text = this.textContent || '';
  const h = Math.max(16, Math.min(140, Math.round(text.length / 6)));
  return { top: 0, left: 0, right: 400, bottom: h, width: 400, height: h, x: 0, y: 0 };
};

function makeFakePdfDoc() {
  let pageCount = 1;
  const proxy = new Proxy(function () {}, {
    get(target, prop) {
      if (prop === 'getNumberOfPages') return () => pageCount;
      if (prop === 'addPage') return () => { pageCount++; return proxy; };
      if (prop === 'output') return () => ({ __fakeBlob: true });
      if (prop === 'save') return () => {};
      if (prop === 'internal') return { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
      if (prop === 'then') return undefined; // not a thenable
      return (..._args) => proxy;
    },
  });
  return proxy;
}

let sectionCaptureCount = 0;
function html2pdfMock() {
  const chain = {
    set() { return chain; },
    from(el, type) { chain._el = el; chain._type = type; return chain; },
    toCanvas() {
      sectionCaptureCount++;
      const fakeCanvas = doc.createElement('canvas');
      fakeCanvas.width = 840;
      fakeCanvas.height = 200 + (sectionCaptureCount % 5) * 50; // varied heights, all well under one page
      chain.prop = { canvas: fakeCanvas };
      return {
        then(cb) { cb.call(chain); return { catch() { return this; } }; },
        catch() { return this; },
      };
    },
    toPdf() {
      chain.prop = { pdf: makeFakePdfDoc() };
      return {
        then(cb) { cb.call(chain); return { catch() { return this; } }; },
        catch() { return this; },
      };
    },
  };
  return chain;
}

const storage = {};
const localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};

// --- The actual diagnostic: watch EVERY appendChild anywhere in the document for the rest of this
// test, and record whether document.body ever contains two elements sharing the same id at that
// instant - exactly the live-DOM condition DevTools' "Duplicate form field id" Issue reports. ---
let duplicateIdEvents = [];
const origAppendChild = win.Node.prototype.appendChild;
win.Node.prototype.appendChild = function (node) {
  const result = origAppendChild.call(this, node);
  if (doc.body && (this === doc.body || doc.body.contains(this))) {
    const ids = [...doc.querySelectorAll('[id]')].map(el => el.id);
    const seen = new Map();
    for (const id of ids) {
      seen.set(id, (seen.get(id) || 0) + 1);
    }
    for (const [id, count] of seen) {
      if (count > 1) duplicateIdEvents.push(id);
    }
  }
  return result;
};

const sandbox = {
  console, localStorage, navigator: { language: 'en-US' },
  document: doc, window: win,
  setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp, Proxy,
  URL: win.URL, html2pdf: html2pdfMock,
  JSZip: function () { return { file() {}, generateAsync: async () => ({}) }; },
  alert: (msg) => { sandbox.__lastAlert = msg; }, confirm: () => true,
};
sandbox.global = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');

// A reasonably rich profile - main + partner + business partner + a child + household occupants +
// vehicles + a structured home address + a couple of checked addresses - to maximize the chance of
// exercising every id-bearing block this app renders (Feng Shui direction selects, occupant fields,
// address fields, vehicle fields, name-analysis inputs, etc.), all in prefix 'i' (the only prefix that
// ever gets real, non-empty ids per idAttr()).
vm.runInContext(`
  state = { users: {}, active: 'roy@test.com' };
  state.users['roy@test.com'] = {
    profile: {
      englishFirstName: 'Roy', englishLastName: 'Wong', gender: 'male',
      birthdate: '1976-09-07', birthtime: '09:33', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
      mobileNumber: '91234567', vehicles: [{ number: 'SJL1234A', shared: false }, { number: 'SKX9988B', shared: true }],
      bazhaiOccupants: [
        { name: 'Grandma Lee', birthdate: '1948-02-14', birthtime: '05:00', gender: 'female' },
        { name: 'Uncle Tan', birthdate: '1955-11-03', birthtime: '18:20', gender: 'male' },
      ],
      fsDirection: 'North',
    },
    home: {
      address: '92 Flora Road, Singapore 507005',
      addresses: {
        profile: { houseNumber: '92', streetName: 'Flora Road', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '1998' },
        checked: [
          { houseNumber: '10', streetName: 'Jalan Besar', unit: '05-12', city: 'Singapore', country: 'Singapore', postalCode: '208787', constructionYear: '2005' },
        ],
      },
    },
    partner: {
      englishFirstName: 'Amy', englishLastName: 'Lee', gender: 'female',
      birthdate: '1978-05-12', birthtime: '14:00', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
      mobileNumber: '98765432',
    },
    businessPartner: {
      englishFirstName: 'Ben', englishLastName: 'Tan', gender: 'male',
      birthdate: '1980-03-03', birthtime: '10:00', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
    },
    children: [{
      englishFirstName: 'Timmy', englishLastName: 'Wong', gender: 'male',
      birthdate: '2010-01-01', birthtime: '06:00', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
    }],
  };
  initListeners();
  go('home');
`, sandbox);

check(sectionCaptureCount === 0, 'sanity: no PDF export has run yet before we trigger it (baseline)');
duplicateIdEvents = []; // reset - the normal home render above may transiently touch ids too; we only care about what happens DURING export

// --- Run the real export end-to-end ---
let exportError = null;
try {
  vm.runInContext(`
    globalThis.__exportDone = false;
    globalThis.__exportError = null;
    exportProfileToPdfInner('i').then(() => { globalThis.__exportDone = true; }).catch(e => { globalThis.__exportError = e; globalThis.__exportDone = true; });
  `, sandbox);
} catch (e) {
  exportError = e;
}

// exportProfileToPdfInner is async but our mocks resolve synchronously-ish (via .then callbacks called
// inline) - however real Promise microtasks still need a tick. Drain the microtask/timer queue.
function drainQueue(maxIterations) {
  return new Promise((resolve) => {
    let iterations = 0;
    const tick = () => {
      iterations++;
      const done = vm.runInContext('globalThis.__exportDone', sandbox);
      if (done || iterations >= maxIterations) { resolve(); return; }
      setTimeout(tick, 5);
    };
    tick();
  });
}

drainQueue(2000).then(() => {
  const done = vm.runInContext('globalThis.__exportDone', sandbox);
  const err = vm.runInContext('globalThis.__exportError', sandbox);

  check(done === true, 'the real exportProfileToPdfInner(\'i\') call ran to completion (resolved or rejected) within the test\'s wait budget, rather than hanging');
  check(sectionCaptureCount > 0, `the real PASS 1 per-section capture loop actually ran (captured ${sectionCaptureCount} section(s)) - confirming this test exercised the real DOM-touching code path, not just a stub`);

  // THE actual diagnostic this test exists for:
  check(duplicateIdEvents.length === 0, `BUG CHECK: no live duplicate id was ever observed in document.body at any point during the real export run (found: ${JSON.stringify([...new Set(duplicateIdEvents)])})`);

  // Sanity: confirm the export container itself was cleaned up afterward (no leak into the live DOM
  // regardless of how the export ended).
  const leftoverExportNodes = doc.querySelectorAll('div[style*="width:420px"]').length;
  check(leftoverExportNodes === 0, `no export container was left behind in the live document after the run finished (found ${leftoverExportNodes})`);

  if (err) {
    // Not itself a failure of THIS test (our jsPDF mock is intentionally minimal and may not satisfy
    // every real jsPDF call the assembly step makes) - logged for visibility only, since what matters
    // here is whether a live duplicate-id window occurred, which is checked above regardless of how
    // (or whether) final PDF assembly succeeded.
    console.log('[info] exportProfileToPdfInner rejected during PDF assembly (expected, given the minimal jsPDF mock):', err && err.message);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}).catch(e => {
  console.error('FAIL: unexpected test harness error:', e);
  console.log(`\n${pass} passed, ${fail + 1} failed`);
  process.exit(1);
});
