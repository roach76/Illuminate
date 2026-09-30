const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for item 4 ("PDF section breaks should be flexible and not deadlocked... some
// sections have header at the bottom of the page and content on the next page") and item 3 ("issues
// happen between capturing sections 40-60"). Visual inspection of the user's own attached 58-page PDF
// export found the concrete defect: the natal QMDJ 9-palace grid (a CSS Grid kept atomic by
// isSideBySideLayoutContainer, to avoid destroying its side-by-side layout) is taller than one page for
// a typical profile, so captureChunksIntoPdf's only fallback was a row-blind raw pixel slice straight
// through the middle of a palace row - visible in the export as a row split awkwardly across a page
// break. Fix: expandIntoCaptureUnits now detects a real CSS Grid (not a flex row, which has no fixed
// column count to chunk by) that's too tall for one page and splits it BETWEEN whole grid rows via the
// new splitGridIntoRowChunks helper, each chunk re-wrapped with the same grid-template-columns so cells
// stay side by side within a row - never destroying the "side by side" layout, but finally giving the
// packer a real, content-aware break point instead of an arbitrary pixel offset.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let passed = 0, failed = 0;
function check(cond, msg) { if (cond) passed++; else { failed++; console.log('FAIL: ' + msg); } }

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only' });
const win = dom.window, doc = win.document;
win.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {}, measureText: () => ({ width: 10 }), drawImage() {} }; };
win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/jpeg;base64,AAAA'; };

const CELL_H = 40;
win.Element.prototype.getBoundingClientRect = function () {
  if (this.dataset && this.dataset.role === 'grid') {
    const cols = Number(this.dataset.cols) || 1;
    const rows = Math.ceil(this.children.length / cols);
    return { width: 400, height: rows * CELL_H, top: 0, left: 0, right: 400, bottom: rows * CELL_H, x: 0, y: 0 };
  }
  return { width: 80, height: CELL_H, top: 0, left: 0, right: 80, bottom: CELL_H, x: 0, y: 0 };
};
Object.defineProperty(win.HTMLElement.prototype, 'offsetHeight', { configurable: true, get() {
  if (this.dataset && this.dataset.role === 'grid') { const cols = Number(this.dataset.cols) || 1; return Math.ceil(this.children.length / cols) * CELL_H; }
  return CELL_H;
} });
Object.defineProperty(win.HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return 400; } });
win.getComputedStyle = function (el) {
  if (el.dataset && el.dataset.role === 'grid') {
    const cols = Number(el.dataset.cols);
    return { display: 'grid', gridTemplateColumns: Array(cols).fill('80px').join(' '), flexDirection: '' };
  }
  return { display: 'block', gridTemplateColumns: '', flexDirection: '' };
};

const storage = {};
const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
const sandbox = {
  console, document: doc, window: win, localStorage, navigator: { language: 'en-US' },
  setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
  alert: () => {}, confirm: () => true,
};
sandbox.global = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);

function loadIfExists(f) {
  const p = path.join(PROJECT_DIR, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
}
loadIfExists('engine-core.js'); loadIfExists('engine-metaphysics.js'); loadIfExists('engine-predictions.js'); loadIfExists('app.js'); loadIfExists('auth.js');

function buildGrid(cols, rows, roleSuffix) {
  const grid = doc.createElement('div');
  grid.className = 'qimen-grid-v2-test';
  grid.dataset.role = 'grid';
  grid.dataset.cols = String(cols);
  for (let i = 0; i < cols * rows; i++) {
    const cell = doc.createElement('div');
    cell.textContent = `cell-${roleSuffix}-${i}`;
    grid.appendChild(cell);
  }
  return grid;
}

async function captureAndCountUnits(node) {
  let fromCallCount = 0;
  const childCounts = [];
  const fakeCanvas = { width: 1260, height: 120, toDataURL: () => 'data:image/png;base64,AAAA', getContext: () => ({ drawImage(){} }) };
  function JsPdfMock() {
    return {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      addImage() {}, addPage() {}, setFont(){}, setFontSize(){}, setTextColor(){}, setDrawColor(){}, setFillColor(){}, setLineWidth(){}, line(){}, lines(){}, text(){}, save(){}, splitTextToSize: (t) => [t],
      getNumberOfPages: () => 1, setPage(){}, link(){}, movePage(){}, deletePage(){}, output: () => new Uint8Array([1,2,3]),
    };
  }
  sandbox.html2pdf = function () {
    const worker = { prop: {} };
    worker.set = function () { return worker; };
    worker.from = function (el) {
      fromCallCount++;
      // This round's PERFORMANCE FIX batches several capture units into one shared batchContainer per
      // html2canvas call (instead of one secContainer per call) - see app.js's own comment above the
      // batching loop. `el` is now that batchContainer; each of its children is one member's own
      // secContainer, and EACH secContainer's one child is the cloned node actually captured for that
      // unit. Push one count per member so this test still verifies every individual capture unit's
      // cell count, exactly as it did before batching existed.
      Array.from(el.children).forEach(secContainer => {
        const cloned = secContainer.children[0];
        childCounts.push(cloned ? cloned.children.length : 0);
      });
      worker.prop.canvas = fakeCanvas;
      worker.prop.pdf = JsPdfMock();
      return worker;
    };
    worker.toCanvas = function () { return { then: function (fn) { fn.call(worker); return this; }, catch: function () { return this; } }; };
    worker.toPdf = function () { return { then: function (fn) { fn.call(worker); return this; }, catch: function () { return this; } }; };
    return worker;
  };
  sandbox.jspdf = { jsPDF: JsPdfMock };

  await sandbox.captureChunksIntoPdf([node], 'padding:0', null);
  // Some export machinery unrelated to this grid (e.g. a TOC page image) may also route through the
  // same html2pdf().from() mock with an empty/foreign container - filter those out so only calls that
  // actually captured a piece of OUR grid (non-zero children) are counted.
  const gridChildCounts = childCounts.filter(c => c > 0);
  return { fromCallCount: gridChildCounts.length, childCounts: gridChildCounts };
}

async function run() {
  check(typeof vm.runInContext('typeof captureChunksIntoPdf', sandbox) === 'string' && vm.runInContext('typeof captureChunksIntoPdf', sandbox) === 'function', 'captureChunksIntoPdf is defined and reachable from the loaded app.js');
  sandbox.captureChunksIntoPdf = vm.runInContext('captureChunksIntoPdf', sandbox);

  // A tall 5-col x 30-row grid (150 cells, 1200px at 40px/row) - well over both this app's real
  // per-page content capacity AND its "safe to leave atomic" threshold at its real capture geometry
  // (EXPORT_CAPTURE_WIDTH/SCALE-derived, roughly 250-550px depending on page-content height), so a
  // split is unambiguously required regardless of the exact real-world constants.
  const tallGrid = buildGrid(5, 30, 'tall');
  doc.body.appendChild(tallGrid);
  const tallResult = await captureAndCountUnits(tallGrid);
  doc.body.removeChild(tallGrid);

  check(tallResult.fromCallCount > 1, `BUG FIX VERIFIED: a tall multi-row QMDJ-style grid is now captured as MORE THAN ONE unit (row-chunked) instead of one atomic pixel-sliced block - got ${tallResult.fromCallCount} capture(s)`);
  const TALL_GRID_TOTAL_CELLS = 5 * 30;
  check(tallResult.childCounts.every(c => c > 0 && c < TALL_GRID_TOTAL_CELLS), `BUG FIX VERIFIED: each captured chunk of the tall grid holds a real SUBSET of its ${TALL_GRID_TOTAL_CELLS} cells (a whole row or a few rows), not the entire un-split grid - child counts: ${JSON.stringify(tallResult.childCounts)}`);
  check(tallResult.childCounts.every(c => c % 5 === 0), `every chunk holds a whole number of complete rows (multiple of 5 columns), never a row cut mid-way - child counts: ${JSON.stringify(tallResult.childCounts)}`);

  // A single-row grid (5 cells, one row, 40px) must stay exactly ONE atomic capture unit - there is
  // nothing to split between, and this must not regress into needlessly fragmenting small grids too.
  const singleRowGrid = buildGrid(5, 1, 'single');
  doc.body.appendChild(singleRowGrid);
  const singleResult = await captureAndCountUnits(singleRowGrid);
  doc.body.removeChild(singleRowGrid);
  check(singleResult.fromCallCount === 1, `a single-row grid (nothing to split between) still stays exactly one atomic capture unit - got ${singleResult.fromCallCount}`);
  check(singleResult.childCounts[0] === 5, `the single-row grid's one capture unit still holds all 5 of its cells intact - got ${singleResult.childCounts[0]}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
run().catch(e => { console.log('FAIL: threw -', e.message); console.log(`\n${passed} passed, ${failed + 1} failed`); process.exitCode = 1; });
