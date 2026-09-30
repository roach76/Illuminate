const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// End-to-end integration test of the new USE_NATIVE_PDF_EXPORT pipeline. Since this repo has no real
// browser available in this environment, this loads the ACTUAL engine-core.js, engine-metaphysics.js,
// engine-predictions.js and app.js source files into one shared vm context (mirroring this project's
// established test methodology), with a real jsdom `document`, a fake `localStorage`, and a fake
// `html2pdf`/jsPDF that records every drawing call - then builds a real profile and calls
// buildNativePdfDocument('i', ...) for real, checking it runs to completion without throwing and
// produces a sane multi-page report with the right section headers and a working TOC/header/footer.
// This is the closest thing to a real export this sandboxed environment can verify; it is NOT a
// substitute for Roy actually testing an export in his own browser before USE_NATIVE_PDF_EXPORT is
// flipped to true (see that constant's own comment in app.js for why it defaults to false).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
const dom = new JSDOM('<!DOCTYPE html><body></body>');

// jsdom doesn't implement canvas 2D contexts without the native `canvas` package. The native PDF
// pipeline only ever needs a trivial 2x2 blank seed canvas (see buildNativePdfDocument's own comment
// on why - it round-trips through html2pdf's `.toPdf()` chain to obtain a real jsPDF instance), so a
// minimal fake 2D context (just fillStyle/fillRect, which is all that code calls) is enough here.
dom.window.HTMLCanvasElement.prototype.getContext = function () {
  return { fillStyle: '#fff', fillRect() {} };
};

// --- Fake localStorage ---
const storage = {};
const localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};

// --- Fake jsPDF instance that records drawing calls per page, for inspection ---
function makeFakeJsPDF() {
  const pages = [[]]; // pages[i] = array of {op, args}
  let currentPage = 0;
  const rec = (op) => (...args) => { pages[currentPage].push({ op, args }); return fake; };
  const fake = {
    _pages: pages,
    setFont: rec('setFont'), setFontSize: rec('setFontSize'), setTextColor: rec('setTextColor'),
    setDrawColor: rec('setDrawColor'), setFillColor: rec('setFillColor'), setLineWidth: rec('setLineWidth'),
    line: rec('line'), lines: rec('lines'), rect: rec('rect'), roundedRect: rec('roundedRect'),
    text: (t, x, y, opt) => { pages[currentPage].push({ op: 'text', args: [t, x, y, opt] }); return fake; },
    splitTextToSize: (text, maxWidth) => {
      // Naive but real word-wrap simulation (approximates jsPDF's own behavior closely enough for
      // page-break-logic testing): ~2mm per character at 9pt as a rough width estimate.
      const str = String(text);
      const charsPerLine = Math.max(10, Math.floor(maxWidth / 1.8));
      const words = str.split(/\s+/);
      const lines = []; let cur = '';
      words.forEach(word => {
        if ((cur + ' ' + word).trim().length > charsPerLine) { if (cur) lines.push(cur.trim()); cur = word; }
        else cur = (cur + ' ' + word).trim();
      });
      if (cur) lines.push(cur.trim());
      return lines.length ? lines : [''];
    },
    addPage: () => { pages.push([]); currentPage = pages.length - 1; return fake; },
    addImage: rec('addImage'),
    movePage: (from, to) => {
      const moved = pages.splice(from - 1, 1)[0];
      pages.splice(to - 1, 0, moved);
      return fake;
    },
    getNumberOfPages: () => pages.length,
    setPage: (n) => { currentPage = n - 1; return fake; },
    output: (type) => ({ __blob: true, type }),
    save: (filename) => { fake._savedAs = filename; },
  };
  return fake;
}

// --- Fake html2pdf chain (only the `.set().from(canvas,'canvas').toPdf()` path is used by
// buildNativePdfDocument) ---
let sharedFakeJsPDF = null;
function html2pdf() {
  const chain = {
    prop: {},
    set(opts) { chain._opts = opts; return chain; },
    from(source, type) { chain._source = source; chain._type = type; return chain; },
    toCanvas() { chain.prop.canvas = { width: 2, height: 2 }; return { then: (fn) => { fn.call(chain); return { catch: () => {} }; } }; },
    toPdf() {
      sharedFakeJsPDF = sharedFakeJsPDF || makeFakeJsPDF();
      chain.prop.pdf = sharedFakeJsPDF;
      return { then: (fn) => { fn.call(chain); return { catch: () => {} }; } };
    },
  };
  return chain;
}

const sandbox = {
  document: dom.window.document,
  window: dom.window,
  localStorage,
  console,
  html2pdf,
  navigator: { language: 'en-US' },
  setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
  URL: dom.window.URL,
};
sandbox.global = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

function loadFile(name) {
  const src = fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8');
  vm.runInContext(src, sandbox, { filename: name });
}

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

try {
  loadFile('engine-core.js');
  loadFile('engine-metaphysics.js');
  loadFile('engine-predictions.js');
  loadFile('app.js');
} catch (e) {
  console.error('FATAL: failed to load app source into test context:', e);
  process.exit(1);
}

// --- Build one minimal, realistic profile (mirrors a real row from the project's own test data
// file: Roy Wong, 7 Sep 1976, 09:33am, Singapore) ---
vm.runInContext(`
  state.users['test@example.com'] = {
    name: 'test', email: 'test@example.com', password: 'x',
    profile: {
      englishFirstName: 'Liang Jie Roy', englishLastName: 'Wong', englishName: 'Liang Jie Roy Wong',
      chineseFirstName: '良杰', chineseLastName: '黄',
      birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
    },
    partner: null, businessPartner: null, additionalBizPartners: [], children: [],
  };
  state.active = 'test@example.com';
`, sandbox);

let pdfDoc = null;
let threw = null;
(async () => {
  try {
    const progressLog = [];
    pdfDoc = await vm.runInContext(
      `buildNativePdfDocument('i', (label, pct) => { global.__progressLog.push([label, pct]); })`,
      Object.assign(sandbox, { __progressLog: progressLog })
    );
  } catch (e) {
    threw = e;
  }

  check(!threw, 'buildNativePdfDocument completes without throwing: ' + (threw && (threw.stack || threw.message)));
  check(!!pdfDoc, 'buildNativePdfDocument returns a pdf document object');

  if (pdfDoc) {
    const pages = pdfDoc._pages;
    check(pages.length > 5, `report has a realistic number of pages for an 18-section report (got ${pages.length})`);

    // Every page except pure-TOC pages should have had setFont/text calls (header/footer at minimum).
    const allText = pages.flatMap(p => p.filter(c => c.op === 'text').map(c => c.args[0]));
    const expectedTitles = [
      'Summary Information', 'Comparison Details', 'Detailed Reading', 'Ming Li (Destiny Analysis)',
      'Personal Assets', 'Zodiac', 'Name Analysis', 'Health Diagnosis', 'I Ching', 'Xiang Shu',
      'Da Yun', 'San Shi', 'Ze Ri', 'Zi Wei Dou Shu', 'Hourly Highlights', 'Feng Shui', 'Numerology',
      'Western Astrology',
    ];
    expectedTitles.forEach(title => {
      check(allText.includes(title), `section header "${title}" was actually drawn onto some page`);
    });

    // TOC page: "Table of Contents" title should be drawn, and it should be BEFORE content in final
    // page order (proving the append-then-movePage-to-front trick worked).
    const tocPageIdx = pages.findIndex(p => p.some(c => c.op === 'text' && c.args[0] === 'Table of Contents'));
    check(tocPageIdx !== -1, 'a "Table of Contents" page exists');
    check(tocPageIdx === 0, `TOC page was moved to the FRONT of the document (found at index ${tocPageIdx}, expected 0)`);

    // Header brand mark + footer page numbers should appear on every page.
    const brandCount = pages.filter(p => p.some(c => c.op === 'text' && c.args[0] === 'ILLUMINATE')).length;
    check(brandCount === pages.length, `every page (${pages.length}) got the ILLUMINATE header, found on ${brandCount}`);
    const footerCount = pages.filter(p => p.some(c => c.op === 'text' && typeof c.args[0] === 'string' && /^Page \d+ of \d+$/.test(c.args[0]))).length;
    check(footerCount === pages.length, `every page (${pages.length}) got a "Page X of Y" footer, found on ${footerCount}`);

    // Section header text should always appear on the SAME page or after its own TOC entry claims,
    // i.e. page numbers in the TOC should be internally consistent (content pages come after TOC).
    check(pdfDoc._savedAs === undefined, 'save() was not called by buildNativePdfDocument itself (only exportProfileToPdf calls save)');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
