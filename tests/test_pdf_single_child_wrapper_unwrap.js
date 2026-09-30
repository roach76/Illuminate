const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for the re-reported item 4 ("Look at logical section breaks like Page 2 (business
// partner alignment title is at the bottom and the full details are in page 3), truncation or contents
// across words at page breaks are back (Page 3)"). Root cause, confirmed via a real headless-Chromium
// reproduction of the exact "Business Partner Alignment" section from the user's own PDF export (not
// just jsdom theory): wrapSectionCollapsible's own body wrapper (`.section-details-body`) always has
// EXACTLY ONE child - the section's single `<article class="reading">...</article>` - since virtually
// every section in this app wraps its whole content in one such article. expandIntoCaptureUnits's
// `canSplitFurther` required `node.children.length > 1`, so that single-child body wrapper could never
// be split further: its entire subtree (a short "...Reading" pill label, a summary box, AND the full
// multi-part deep analysis) became ONE un-splittable leaf, forcing PASS 2's raw, content-blind pixel
// slice straight through it wherever the page ran out of room - landing just below the pill label in
// the real export (stranding it) and, since a pixel slice has no idea where a word/sentence ends
// either, very likely also the cause of the separately re-reported mid-word truncation.
// FIX: expandIntoCaptureUnits now transparently unwraps through a chain of single-child wrapper nodes
// before deciding whether/how to split - so the split decision and recursion operate on the real,
// multi-child content node underneath (here: buildDeepAnalysisContentHTML's own container, which has
// 8+ children, one per numbered item) instead of stopping one level too early at the wrapper.
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

// Every leaf content row is 40px tall; a "grid" role node (used for the grid-still-atomic check) reports
// its height as rows*40 based on its own column count, exactly like the existing grid-split test.
const CELL_H = 40;
win.Element.prototype.getBoundingClientRect = function () {
  if (this.dataset && this.dataset.role === 'grid') {
    const cols = Number(this.dataset.cols) || 1;
    const rows = Math.ceil(this.children.length / cols);
    return { width: 400, height: rows * CELL_H, top: 0, left: 0, right: 400, bottom: rows * CELL_H, x: 0, y: 0 };
  }
  // A generic wrapper/container's height is the sum of its children's heights (so a chain of
  // single-child wrappers around N leaf rows reports the same total height at every level, matching
  // real DOM layout - a wrapper div doesn't add its own height beyond its content).
  if (this.children && this.children.length > 0) {
    let h = 0;
    for (const c of this.children) h += c.getBoundingClientRect().height;
    return { width: 400, height: h, top: 0, left: 0, right: 400, bottom: h, x: 0, y: 0 };
  }
  return { width: 400, height: CELL_H, top: 0, left: 0, right: 400, bottom: CELL_H, x: 0, y: 0 };
};
Object.defineProperty(win.HTMLElement.prototype, 'offsetHeight', { configurable: true, get() {
  return this.getBoundingClientRect().height;
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

async function captureAndCollect(node) {
  const childCounts = []; // per html2pdf().from() call, how many DIRECT children the captured clone has
  const textSnippets = []; // the captured clone's own textContent, to check WHICH content landed together
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
      // This round's PERFORMANCE FIX batches several capture units into one shared batchContainer per
      // html2canvas call (instead of one secContainer per call) - `el` is now that batchContainer; each
      // of its children is one member's own secContainer, and each secContainer's one child is the
      // cloned node actually captured for that unit. Push one entry per member, exactly as this test
      // did per-call before batching existed.
      Array.from(el.children).forEach(secContainer => {
        const cloned = secContainer.children[0];
        childCounts.push(cloned ? cloned.children.length : 0);
        textSnippets.push(cloned ? (cloned.textContent || '') : '');
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
  return { childCounts, textSnippets };
}

function leafRow(text) {
  const d = doc.createElement('div');
  d.textContent = text;
  return d;
}

async function run() {
  check(vm.runInContext('typeof captureChunksIntoPdf', sandbox) === 'function', 'captureChunksIntoPdf is defined and reachable from the loaded app.js');
  sandbox.captureChunksIntoPdf = vm.runInContext('captureChunksIntoPdf', sandbox);

  // Case 1 (the actual bug): a <details>-turned-<div> section exactly like wrapSectionCollapsible's own
  // output - an outer div with 2 children (a short "summary" label, and a "body" wrapper with EXACTLY
  // ONE child, a big "article" holding 9 real content rows, each tall enough on its own to force a
  // multi-page section overall). Before the fix, the single-child body wrapper could never be split, so
  // the label + all 9 rows were captured as ONE atomic blob and pixel-sliced arbitrarily. After the fix,
  // each row should be its own leaf capture unit (or at least the label must NOT be glued into the same
  // atomic blob as all 9 rows - it should be possible to see the label and rows as separate pieces).
  const outer = doc.createElement('div');
  const summary = doc.createElement('div');
  summary.appendChild(leafRow('Business Partner Alignment')); // the short label, single child
  const body = doc.createElement('div'); // .section-details-body - EXACTLY ONE child, the article
  const article = doc.createElement('div'); // stand-in for <article class="reading">
  const rowTexts = ['Pill: Business Partner Alignment Reading', 'Compatibility Score box', '1. Characteristics', '2. Explanation', '3. Traits', '4. Highlights', '5. Positives', '6. Negatives', '7. Cautions'];
  rowTexts.forEach((t, i) => { const r = leafRow(t); r.getBoundingClientRect = () => ({ width: 400, height: 40, top: 0, left: 0, right: 400, bottom: 40, x: 0, y: 0 }); article.appendChild(r); });
  body.appendChild(article);
  outer.appendChild(summary);
  outer.appendChild(body);
  doc.body.appendChild(outer);

  const { childCounts, textSnippets } = await captureAndCollect(outer);
  doc.body.removeChild(outer);

  check(childCounts.length > 2, `BUG FIX VERIFIED: the section (label + 9 real content rows, all single-child-wrapped down to the label and to the article) is now captured as MORE THAN 2 pieces (real per-row granularity) instead of being glued into one atomic blob - got ${childCounts.length} piece(s)`);
  // The label itself must appear ALONE (or with very little else) in its own captured piece - never
  // fused together with unrelated rows several items deep into the section (which is what an atomic,
  // un-splittable blob would have produced).
  const labelPieceIdx = textSnippets.findIndex(t => t.includes('Business Partner Alignment') && !t.includes('Pill:'));
  check(labelPieceIdx !== -1, 'the section label ("Business Partner Alignment") is captured as its own identifiable piece');
  if (labelPieceIdx !== -1) {
    check(!textSnippets[labelPieceIdx].includes('7. Cautions'), 'BUG FIX VERIFIED: the label piece does NOT also drag in unrelated far-away content (e.g. item 7) the way one giant atomic blob would have');
  }

  // Case 2 (must NOT regress): a single-child wrapper sitting ABOVE an oversized CSS Grid (e.g. if some
  // future markup ever wraps the QMDJ natal grid in one extra div) must still hand the grid to the
  // existing grid-row-split path - or leave it atomic if that split doesn't help - never explode it into
  // one capture unit per individual cell (which would destroy the side-by-side layout, the original
  // "4 BaZi pillars stacked" bug this whole area of code exists to prevent).
  const gridWrapper = doc.createElement('div'); // single-child wrapper around the grid
  const grid = doc.createElement('div');
  grid.dataset.role = 'grid';
  grid.dataset.cols = '5';
  for (let i = 0; i < 5 * 30; i++) { const cell = doc.createElement('div'); cell.textContent = 'cell-' + i; grid.appendChild(cell); }
  gridWrapper.appendChild(grid);
  doc.body.appendChild(gridWrapper);
  const gridResult = await captureAndCollect(gridWrapper);
  doc.body.removeChild(gridWrapper);
  const TOTAL_CELLS = 5 * 30;
  check(gridResult.childCounts.every(c => c === 0 || (c > 0 && c < TOTAL_CELLS && c % 5 === 0)), `a single-child wrapper around an oversized grid still yields whole-row chunks (multiple of 5), never one piece per individual cell - child counts: ${JSON.stringify(gridResult.childCounts)}`);
  check(gridResult.childCounts.filter(c => c > 0).length > 1, 'the wrapped grid is still split into multiple row-chunks rather than becoming one un-splittable atomic blob because of the extra wrapper');

  // Case 3 (must NOT regress): a normal multi-child node with NO single-child wrapper chain behaves
  // exactly as before - each of its own children becomes its own leaf when it's oversized.
  const normal = doc.createElement('div');
  ['A', 'B', 'C'].forEach(t => { const r = leafRow(t); r.getBoundingClientRect = () => ({ width: 400, height: 40, top: 0, left: 0, right: 400, bottom: 40, x: 0, y: 0 }); normal.appendChild(r); });
  doc.body.appendChild(normal);
  const normalResult = await captureAndCollect(normal);
  doc.body.removeChild(normal);
  check(normalResult.childCounts.filter(c => c > 0).length >= 1, 'a normal, already-multi-child node with no wrapper chain still captures correctly (no regression for the common case)');

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
run().catch(e => { console.log('FAIL: threw -', e.message, e.stack); console.log(`\n${passed} passed, ${failed + 1} failed`); process.exitCode = 1; });
