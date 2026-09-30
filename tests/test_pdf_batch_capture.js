const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the PDF capture PERFORMANCE FIX made this round (batching multiple capture units into one
// html2canvas call instead of one call per unit - the previous round's "detach siblings" fix was
// disproven by a live, controlled A/B measurement against the real running app before it shipped: one
// unit alone cost ~880-994ms whether the live DOM around it had 3,575 nodes or 9. A second live
// measurement showed 10 units captured together in ONE call cost 684ms total vs ~900ms EACH captured
// individually - confirming the fixed per-call overhead, not DOM size, was the real bottleneck).
//
// jsdom does not run a real layout engine, so offsetTop/offsetHeight/getBoundingClientRect/scrollHeight
// all read 0 by default. This test installs a small deterministic fake-layout model (each element's
// "height" derived from its own text content length, offsetTop accumulated from previous siblings) so
// the new batching/slicing code's actual math can be exercised and checked, not just syntax-checked.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static source checks: confirm the batching structure is actually in place -----------------------
check(/const BATCH_MAX_UNITS = 10;/.test(appSrc), 'BATCH_MAX_UNITS constant present');
check(/const BATCH_MAX_NATURAL_PX = onePageCapacityNaturalPx \* 2;/.test(appSrc), 'BATCH_MAX_NATURAL_PX constant present');
check(/function estimateNaturalHeightForBatching\(node\)/.test(appSrc), 'estimateNaturalHeightForBatching helper present');
check(/\.from\(batchContainer\)\.toCanvas\(\)/.test(appSrc), 'capture call now targets a shared batchContainer, not a per-unit secContainer');
// UPDATED (later round, "text truncation in the page breaks" fix): units[] entries now also carry a
// noMidSlice flag (true for a unit that is or contains a table, or an already row/grid-split chunk) so
// PASS 2 knows never to pixel-slice it - see test_pdf_nomidslice_table_protection.js for the dedicated
// coverage of that fix. The original 5 fields (sectionIndex/isFirstOfSection/canvas/pxPerMm/heightMm) are
// all still present, unchanged, alongside it.
check(/units\.push\(\{ sectionIndex: unit\.sectionIndex, isFirstOfSection: unit\.isFirstOfSection, canvas: unitCanvas, pxPerMm, heightMm: unitCanvas\.height \/ pxPerMm, noMidSlice: !!unit\.noMidSlice \}\);/.test(appSrc), 'units[] entries carry the original 5 fields (sectionIndex/isFirstOfSection/canvas/pxPerMm/heightMm) plus the newer noMidSlice flag');

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/' });
  const { window } = dom;

  // --- Fake deterministic layout model -----------------------------------------------------------
  // Every element's "natural height" is derived from its own text content length (stable, cheap, and
  // gives different-sized units different heights so batch-budget capping is actually exercised).
  // offsetTop is the cumulative sum of previous siblings' heights within the same parent (mirrors how
  // real block-stacked children with no margin/gap would lay out - exactly the case here, since
  // secContainer's own external margin is 0 by construction).
  function fakeHeight(el) {
    const text = (el.textContent || '').trim();
    return Math.max(20, text.length * 1.5);
  }
  Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', {
    get() { return fakeHeight(this); }
  });
  Object.defineProperty(window.HTMLElement.prototype, 'offsetTop', {
    get() {
      if (!this.parentElement) return 0;
      let top = 0;
      for (const sib of Array.from(this.parentElement.children)) {
        if (sib === this) break;
        top += fakeHeight(sib);
      }
      return top;
    }
  });
  Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', {
    get() {
      let total = 0;
      Array.from(this.children).forEach(c => { total += fakeHeight(c); });
      return total || fakeHeight(this);
    }
  });
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 0, left: 0, right: 420, bottom: fakeHeight(this), width: 420, height: fakeHeight(this) };
  };
  window.HTMLCanvasElement.prototype.getContext = function () {
    return { fillStyle: '#fff', fillRect() {}, drawImage() {} };
  };
  window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/jpeg;base64,AAAA'; };

  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };

  // Records every html2canvas call this test makes so batching can be verified: how many calls were
  // made, and how many original DOM elements (secContainer children) each one covered.
  const captureLog = [];
  const html2pdf = () => ({
    set() { return this; },
    from(target) { this._target = target; return this; },
    toCanvas() {
      const target = this._target;
      const totalH = Math.round(window.getComputedStyle ? target.scrollHeight : 0) || target.scrollHeight;
      const canvas = window.document.createElement('canvas');
      const SCALE = 3, WIDTH = 420;
      canvas.width = WIDTH * SCALE;
      // The batch/unit container's own rendered height (fake layout) x SCALE, matching how the real
      // html2canvas captures at scale:3 - this is what the new pxPerCssPxY slicing math divides by.
      canvas.height = Math.max(1, Math.round(totalH * SCALE));
      captureLog.push({ childCount: target.children ? target.children.length : 0, canvasHeight: canvas.height });
      const p = Promise.resolve();
      p.prop = { canvas };
      return { then(fn) { return Promise.resolve(fn.call(p)); }, catch() { return this; } };
    },
    toPdf() {
      // Minimal fake jsPDF instance - just enough surface area for PASS 3's assembly/header/footer code
      // to run without throwing, so this test can exercise the FULL captureChunksIntoPdf pipeline
      // (batched PASS 1 through to a real returned pdfDoc), not just PASS 1 in isolation.
      const pages = [1];
      const fakePdf = {
        addPage() { pages.push(pages.length + 1); },
        addImage() {}, setFont() {}, setFontSize() {}, text() {}, setFillColor() {}, setDrawColor() {},
        setLineWidth() {}, lines() {}, line() {}, setTextColor() {}, setPage() {},
        getNumberOfPages() { return pages.length; },
        movePage(from, to) {
          const idx = from - 1;
          const [moved] = pages.splice(idx, 1);
          pages.splice(to - 1, 0, moved);
        },
        output() { return 'fake-blob'; },
      };
      const p = Promise.resolve();
      p.prop = { pdf: fakePdf };
      return { then(fn) { return Promise.resolve(fn.call(p)); }, catch() { return this; } };
    },
  });

  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: window.document, window,
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: window.URL, html2pdf, alert: () => {}, confirm: () => true,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { dom, sandbox, captureLog };
}

// --- 1. Many small units batch together into far fewer html2canvas calls -----------------------------
(async () => {
  const { sandbox, captureLog } = freshSandbox();
  // Build 40 small "sections", each a short paragraph - simulates the common case (lots of short
  // label/pill/summary units) that the PERFORMANCE FIX is specifically meant to help most.
  const topLevelNodes = [];
  vm.runInContext(`window.__topLevelHTML = [];`, sandbox);
  for (let i = 0; i < 40; i++) {
    vm.runInContext(`
      (function(){
        const d = document.createElement('div');
        d.innerHTML = '<h3>Section ${i}</h3><p>Short sample text for section ${i}.</p>';
        window.__topLevelHTML.push(d);
      })();
    `, sandbox);
  }
  const result = await vm.runInContext(`
    (async () => {
      const nodes = window.__topLevelHTML;
      const pdfDoc = await captureChunksIntoPdf(nodes, 'padding:20px;', null);
      return { totalPages: pdfDoc.getNumberOfPages ? pdfDoc.getNumberOfPages() : null };
    })()
  `, sandbox);

  check(captureLog.length > 0, 'at least one html2canvas call was made');
  check(captureLog.length < 40, `far fewer html2canvas calls than capture units were made (${captureLog.length} calls for 40 sections) - this is the actual performance fix`);
  check(captureLog.some(c => c.childCount > 1), 'at least one call batched more than one unit together in a single call');
  const totalUnitsAcrossCalls = captureLog.reduce((s, c) => s + c.childCount, 0);
  check(totalUnitsAcrossCalls === 40, `every one of the 40 original sections was still captured exactly once across all batches (found ${totalUnitsAcrossCalls})`);
  check(result && typeof result.totalPages === 'number' && result.totalPages > 0, 'a real pdfDoc with at least one page was produced end-to-end');

  console.log(`Batch test: ${captureLog.length} html2canvas call(s) for 40 sections (avg ${(40/captureLog.length).toFixed(1)} sections/call)`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('UNCAUGHT: ' + e.stack); process.exit(1); });
