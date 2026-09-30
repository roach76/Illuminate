const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Task #79 (reported via DevTools screenshot: "20 issues: Duplicate form field id in the
// same form" surfacing right as PDF generation starts). Root cause found by re-reading the PDF export
// container setup in both exportProfileToPdfInner (single-profile export) and buildProfilePdfBlob
// (per-profile export inside the "export all as ZIP" flow): both built a full copy of the profile's
// HTML - carrying the SAME ids as the live, currently-rendered app page (Feng Shui direction
// selectors, household occupant fields, name-analysis inputs, etc.) - and called
// document.body.appendChild(container) BEFORE reassigning those ids to guaranteed-unique
// pdf-export-main-N values. For the (brief but real) window between that appendChild and the
// reassignment loop running, every one of those ids was genuinely duplicated in the live document,
// which is exactly what DevTools' Issues tab (and any panel watching the live DOM, such as the
// "AI assistance" panel visible in the reported screenshot) would catch. Fixed by doing all
// id/attribute/class cleanup on the container while it is still DETACHED, and only appending it to
// document.body once every id on it is already unique - none of that cleanup (plain attribute/class
// querySelectorAll calls) requires the element to be attached.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static: appendChild(container) now comes AFTER the id/cleanup calls, not before, at both call
// sites (exportProfileToPdfInner and buildProfilePdfBlob). ---
function checkOrdering(fnName, srcSlice) {
  const idIdx = srcSlice.indexOf("container.querySelectorAll('[id]')");
  const appendIdx = srcSlice.indexOf('document.body.appendChild(container);');
  check(idIdx !== -1, `${fnName}: id-reassignment call found`);
  check(appendIdx !== -1, `${fnName}: document.body.appendChild(container) found`);
  check(idIdx !== -1 && appendIdx !== -1 && idIdx < appendIdx, `BUG FIX VERIFIED (${fnName}): id-reassignment now runs BEFORE the container is appended to document.body (previously the container was live with duplicated ids for a window before this ran)`);
}

const fn1Start = appSrc.indexOf('async function exportProfileToPdfInner(prefix) {');
const fn1End = appSrc.indexOf('\nasync function ', fn1Start + 10);
checkOrdering('exportProfileToPdfInner', appSrc.slice(fn1Start, fn1End));

const fn2Start = appSrc.indexOf('async function buildProfilePdfBlob(prefix) {');
const fn2End = appSrc.indexOf('\nasync function ', fn2Start + 10);
checkOrdering('buildProfilePdfBlob', appSrc.slice(fn2Start, fn2End));

// --- Behavioral: extract the real container-setup code (from `container = document.createElement`
// through the appendChild line) out of each function and run it against a live DOM that already has
// an element sharing an id with the exported HTML - proving no duplicate-id window exists at any
// point, by recording every id present in document.body immediately after container is appended. ---
function extractContainerSetup(fnSrc) {
  const start = fnSrc.indexOf('container = document.createElement');
  const end = fnSrc.indexOf('document.body.appendChild(container);', start) + 'document.body.appendChild(container);'.length;
  return fnSrc.slice(start, end);
}
const setup1 = extractContainerSetup(appSrc.slice(fn1Start, fn1End));
const setup2 = extractContainerSetup(appSrc.slice(fn2Start, fn2End));
check(setup1.length > 50, 'extracted exportProfileToPdfInner container-setup code');
check(setup2.length > 50, 'extracted buildProfilePdfBlob container-setup code');

function runSetup(setupSrc, label) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.com/' });
  const doc = dom.window.document;
  // Simulate the live app page already having a real, visible element with the SAME id that the
  // exported HTML will also contain - exactly the collision scenario reported.
  const liveClash = doc.createElement('input');
  liveClash.id = 'fs-dir-i';
  doc.body.appendChild(liveClash);

  let sawDuplicateWhileAttached = false;
  const origAppendChild = dom.window.Node.prototype.appendChild;
  dom.window.Node.prototype.appendChild = function (node) {
    const result = origAppendChild.call(this, node);
    // After EVERY appendChild anywhere in this run (including nested ones inside container.innerHTML
    // parsing, which jsdom performs via appendChild internally), check whether document.body now
    // contains two elements sharing the same id - the exact condition DevTools' Issues tab flags.
    if (this === doc.body || doc.body.contains(this)) {
      const ids = [...doc.querySelectorAll('[id]')].map(el => el.id);
      const seen = new Set();
      for (const id of ids) {
        if (seen.has(id)) { sawDuplicateWhileAttached = true; break; }
        seen.add(id);
      }
    }
    return result;
  };

  const sandbox = {
    document: doc, window: dom.window, console,
    html: '<div class="reading"><select id="fs-dir-i"><option>North</option></select><input id="occ-name-i"></div>',
    __pdfExportUidCounter: 0,
  };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(setupSrc, sandbox, { filename: `${label}-extract.js` });

  dom.window.Node.prototype.appendChild = origAppendChild;
  return sawDuplicateWhileAttached;
}

check(!runSetup(setup1, 'exportProfileToPdfInner'), 'BUG FIX VERIFIED: exportProfileToPdfInner\'s container never creates a live duplicate-id window when appended, even though its HTML shares an id (fs-dir-i) with an element already on the page');
check(!runSetup(setup2, 'buildProfilePdfBlob'), 'BUG FIX VERIFIED: buildProfilePdfBlob\'s container never creates a live duplicate-id window when appended, even though its HTML shares an id (fs-dir-i) with an element already on the page');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
