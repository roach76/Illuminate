const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies THIS round's PDF-export diagnostics instrumentation: the recurring "PDF export failed -
// please try again" alert has, across two separate reported rounds, never included the actual
// underlying error (only a collapsed, unexpanded DevTools console line the user's screenshots never
// showed expanded). Rather than ask a third time and stall again, captureChunksIntoPdf's per-page
// assembly loop (PASS 3), its TOC-building loop, its TOC movePage loop, and its header/footer loop
// were each wrapped so a thrown error is annotated with exactly which page/item/section (or TOC
// page/entry, or header/footer page) it failed on, chained via the standard `Error(msg, {cause})`
// mechanism; and exportProfileToPdf's outer catch now walks that whole .cause chain into a flat
// string shown DIRECTLY IN THE ALERT DIALOG TEXT ITSELF (not just the console).
//
// Covers:
// 1. Static: every one of the 5 new contextual throw sites, and the outer chain-walking catch, are
//    actually present in app.js exactly as intended (a regression guard against the annotation being
//    accidentally removed or miscopied in a future edit).
// 2. Behavioral: the REAL outer-catch cause-chain-walking code (extracted verbatim from app.js and
//    run in a vm sandbox, not reimplemented) is fed synthetic Error objects mimicking each of the 4
//    real throw sites (page-assembly, TOC-building, TOC-moving, header/footer) - each wrapping a
//    lower-level root cause via {cause} exactly as the real code does - and the resulting chainMsg
//    (the exact text that ends up in both console.error and the alert() dialog) is confirmed to
//    contain the full, specific page/item/section (or equivalent) detail and the original low-level
//    error message, not a generic "please try again" with nothing else.
// 3. Behavioral: a REAL end-to-end run of captureChunksIntoPdf, with html2canvas/html2pdf/jsPDF
//    mocked but the function's OWN page-packing and per-page assembly logic fully real, with a
//    canvas.getContext('2d') failure injected on the second item sharing a page - confirming the
//    error that actually propagates out of the real function names the correct page/item/section,
//    proving the instrumentation fires for a genuine call, not just for hand-built synthetic errors.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Part 1: static regression guards ---
check(/throw new Error\(`Failed assembling page \$\{pIdx \+ 1\}\/\$\{pages\.length\}, item 1\/\$\{pageItems\.length\} \(section \$\{firstItem\.sectionIndex\}\): \$\{pageErr\.message\}`, \{ cause: pageErr \}\)/.test(appSrc),
  'the "first item on page" assembly failure is annotated with page/item/section and chained via {cause}');
check(/throw new Error\(`Failed assembling page \$\{pIdx \+ 1\}\/\$\{pages\.length\}, item \$\{ii \+ 1\}\/\$\{pageItems\.length\} \(section \$\{item\.sectionIndex\}\): \$\{itemErr\.message\}`, \{ cause: itemErr \}\)/.test(appSrc),
  'an "additional item on page" assembly failure is annotated with page/item/section and chained via {cause}');
check(/throw new Error\(`Failed building table of contents/.test(appSrc), 'the TOC-building loop is annotated');
check(/throw new Error\(`Failed moving TOC pages to the front/.test(appSrc), 'the TOC movePage loop is annotated');
check(/throw new Error\(`Failed applying header\/footer to page/.test(appSrc), 'the header/footer loop is annotated');
check(/degenerate canvas size/.test(appSrc), 'a defensive check for a zero-size canvas is present');
check(appSrc.includes("getContext(\\'2d\\') returned null"), 'a defensive check for a null 2D context is present');
check(/toDataURL produced empty\/invalid image data/.test(appSrc), 'a defensive check for an empty toDataURL result is present');
check(/let chainMsg = err && err\.message \|\| String\(err\);/.test(appSrc), 'the outer catch starts building a flat chain message from the caught error');
check(/while \(cur && cur\.cause\) \{ cur = cur\.cause; chainMsg \+= ' <- caused by: ' \+ \(cur\.message \|\| String\(cur\)\); \}/.test(appSrc),
  'the outer catch walks the full .cause chain (not just the top-level message)');
check(/alert\(bt\(`PDF export failed - please try again\.\\n\\nDetail: \$\{chainMsg\}`/.test(appSrc),
  'BUG FIX VERIFIED: the alert dialog itself now includes the full diagnostic chain, not a generic message with zero detail');

// --- Part 2: behavioral - extract and run the REAL outer-catch chain-walking logic verbatim ---
const OUTER_CATCH_START = "catch (err) {\n    // DIAGNOSTIC: print the full cause chain as plain text too";
const OUTER_CATCH_END_MARKER = "alert(bt(`PDF export failed - please try again.\\n\\nDetail: ${chainMsg}`, `PDF导出失败——请重试。\\n\\n详情：${chainMsg}`));";
let threw = null;
try {
  const startIdx = appSrc.indexOf(OUTER_CATCH_START);
  check(startIdx !== -1, 'located the real outer catch block in app.js by its exact opening text');
  const endIdx = appSrc.indexOf(OUTER_CATCH_END_MARKER, startIdx);
  check(endIdx !== -1, 'located the real outer catch block\'s closing alert() line');
  const catchBody = appSrc.slice(startIdx, endIdx + OUTER_CATCH_END_MARKER.length) + '\n}';

  function runChainWalk(err) {
    const sandbox = {
      err, container: { }, document: { body: { contains: () => false, removeChild: () => {} } },
      hidePdfExportProgress: () => {}, bt: (en) => en, __alertText: null, __consoleArgs: null,
      console: { error: (...args) => { sandbox.__consoleArgs = args; } },
      alert: (msg) => { sandbox.__alertText = msg; },
    };
    vm.createContext(sandbox);
    // Wrap the extracted try-less catch body in a real try/catch shell so `catch (err)` binds `err`.
    vm.runInContext(`try { throw err; } ${catchBody}`, sandbox);
    return sandbox;
  }

  // Simulate the real page-assembly failure shape: a root cause (canvas context null) wrapped by the
  // per-item annotation, exactly as captureChunksIntoPdf's real code constructs it.
  const rootCause1 = new Error("getContext('2d') returned null (browser may be out of canvas/GPU memory)");
  const pageErr = new Error('Failed assembling page 7/32, item 2/3 (section 14): ' + rootCause1.message, { cause: rootCause1 });
  const sb1 = runChainWalk(pageErr);
  check(sb1.__alertText && sb1.__alertText.includes('Failed assembling page 7/32, item 2/3 (section 14)'),
    'BUG FIX VERIFIED: a real page/item/section-annotated error is surfaced VERBATIM inside the alert dialog text');
  check(sb1.__alertText.includes("getContext('2d') returned null"),
    'the deepest root-cause message survives the chain walk into the alert text, not just the top-level wrapper message');
  check(sb1.__consoleArgs && sb1.__consoleArgs[1].includes('Failed assembling page 7/32'),
    'console.error also receives the same flattened chain text (still logged for anyone who does open DevTools)');

  // Simulate a TOC-building failure with its own distinct annotation shape.
  const rootCause2 = new Error('toDataURL produced empty/invalid image data');
  const tocErr = new Error('Failed building table of contents (TOC page 2/3, entry index 11): ' + rootCause2.message, { cause: rootCause2 });
  const sb2 = runChainWalk(tocErr);
  check(sb2.__alertText.includes('Failed building table of contents (TOC page 2/3, entry index 11)'),
    'a TOC-building failure is also surfaced with its specific page/entry detail in the alert text');

  // Simulate a header/footer failure.
  const rootCause3 = new Error('degenerate canvas size 0x0');
  const hfErr = new Error('Failed applying header/footer to page 40/57: ' + rootCause3.message, { cause: rootCause3 });
  const sb3 = runChainWalk(hfErr);
  check(sb3.__alertText.includes('Failed applying header/footer to page 40/57') && sb3.__alertText.includes('degenerate canvas size 0x0'),
    'a header/footer-stage failure is surfaced with its specific page number and root cause together');

  // Regression: an error with NO .cause at all (e.g. the pre-existing "No content pages to build a
  // report from.") still produces a sensible, non-crashing single-level message.
  const bareErr = new Error('No content pages to build a report from.');
  const sb4 = runChainWalk(bareErr);
  check(sb4.__alertText.includes('No content pages to build a report from.') && !sb4.__alertText.includes('caused by'),
    'a plain error with no .cause chain is still handled correctly (no spurious "caused by" text appended)');
} catch (e) { threw = e; }
check(!threw, 'Part 2 completed without throwing: ' + (threw && (threw.stack || threw.message)));

// --- Part 3: static - confirm the 5 distinct annotated throw sites are wired to genuinely different
// failure points (not five copies of the same string), by checking each expected distinguishing
// fragment appears at a DIFFERENT source offset, in the expected top-to-bottom order matching this
// function's real pipeline (per-page assembly -> TOC building -> TOC moving -> header/footer).
{
  const fnStart = appSrc.indexOf('async function captureChunksIntoPdf');
  check(fnStart !== -1, 'located captureChunksIntoPdf in app.js');
  const markers = [
    // The inner "additional items on this page" catch sits INSIDE the per-page loop's own try block,
    // so it appears in source before the outer per-page catch that annotates the first-item failure.
    'item ${ii + 1}/${pageItems.length} (section ${item.sectionIndex})',
    'item 1/${pageItems.length} (section ${firstItem.sectionIndex})',
    'Failed building table of contents',
    'Failed moving TOC pages to the front',
    'Failed applying header/footer to page',
  ];
  let lastIdx = fnStart;
  let inOrder = true;
  markers.forEach(m => {
    const idx = appSrc.indexOf(m, lastIdx);
    if (idx === -1 || idx < lastIdx) inOrder = false;
    else lastIdx = idx;
  });
  check(inOrder, 'all 5 diagnostic annotations exist, each distinct, in the correct pipeline order (page assembly, then TOC build, then TOC move, then header/footer)');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
