const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Dedicated test for the "app does not load / loads only after ~90 seconds" fix: the html2pdf.js and
// jszip.min.js CDN <script> tags must be `async` so a slow/hanging network request to
// cdnjs.cloudflare.com can never delay DOMContentLoaded (and therefore the app's own init/go('welcome')
// call), and app.js's own guarded usage of these libraries must still be intact so a click on Export
// before the library finishes loading fails gracefully instead of crashing.
const fs = require('fs');
const html = fs.readFileSync((__PROJECT_ROOT__ + '/index.html'), 'utf8');
const appSrc = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

check(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2pdf\.js\/[^"]+"\s+async>/.test(html), 'html2pdf.js script tag has async attribute');
check(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip\/[^"]+"\s+async>/.test(html), 'jszip.min.js script tag has async attribute');

// The app's own local scripts must NOT be async/deferred (order matters between them: engine-core.js
// before engine-metaphysics.js before engine-predictions.js before auth.js before app.js), and should
// now load before the two CDN tags in document order (belt-and-suspenders alongside `async`).
const localScriptOrder = ['engine-core.js', 'engine-metaphysics.js', 'engine-predictions.js', 'auth.js', 'app.js'];
let lastIdx = -1;
let orderOk = true;
localScriptOrder.forEach(name => {
  const idx = html.indexOf(`<script src="${name}"></script>`);
  if (idx === -1 || idx < lastIdx) orderOk = false;
  lastIdx = idx;
});
check(orderOk, 'local script tags appear in the correct dependency order, none missing');
const cdnHtml2pdfIdx = html.indexOf('html2pdf.bundle.min.js');
const appJsIdx = html.indexOf('<script src="app.js">');
check(appJsIdx !== -1 && appJsIdx < cdnHtml2pdfIdx, 'app.js appears before the CDN script tags in document order');

// The existing graceful-degradation guards in app.js must still be present and unmodified in behavior.
check(/if \(typeof html2pdf === 'undefined'\) \{/.test(appSrc), 'html2pdf undefined-guard still present in app.js');
check(/if \(typeof html2pdf === 'undefined' \|\| typeof JSZip === 'undefined'\) \{/.test(appSrc), 'combined html2pdf/JSZip undefined-guard still present in app.js (ZIP export path)');
check(/DOMContentLoaded.*=>.*\{[\s\S]{0,300}initListeners\(\)/.test(appSrc), 'DOMContentLoaded handler still wires up initListeners (init path unchanged)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
