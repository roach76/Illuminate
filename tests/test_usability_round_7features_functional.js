const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Functional (not just static-regex) test for the round's 7 usability enhancements: actually
// executes the relevant helper functions inside a vm/jsdom sandbox against app.js, rather than just
// pattern-matching source text.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
const src = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const dom = new JSDOM('<!DOCTYPE html><body></body>');
const storage = {};
const localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};
const sandbox = {
  window: dom.window,
  document: dom.window.document,
  localStorage,
  sessionStorage: { _s: {}, getItem(k){ return this._s[k] ?? null; }, setItem(k,v){ this._s[k]=String(v); } },
  console,
  bt: (en, zh) => en, // force English for deterministic assertions
  lang: 'en',
};
sandbox.global = sandbox;
vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox, { filename: 'app.js' });
} catch (e) {
  // app.js top-level likely calls init()/DOM-dependent code that throws in this minimal sandbox -
  // that's expected and fine; the specific functions we need are still defined on the context by the
  // time the throw happens (they're declared/hoisted long before any init() call at the bottom).
}

// --- Task 3: persisted section collapse/expand state ---
check(typeof sandbox.getSectionOpenState === 'function', 'getSectionOpenState is callable');
check(typeof sandbox.setSectionOpenState === 'function', 'setSectionOpenState is callable');
check(typeof sandbox.wrapSectionCollapsible === 'function', 'wrapSectionCollapsible is callable');

check(sandbox.getSectionOpenState('nonexistent') === null, 'getSectionOpenState returns null when nothing saved yet');
sandbox.setSectionOpenState('mySection', true);
check(sandbox.getSectionOpenState('mySection') === true, 'setSectionOpenState/getSectionOpenState round-trip (true)');
sandbox.setSectionOpenState('mySection', false);
check(sandbox.getSectionOpenState('mySection') === false, 'setSectionOpenState/getSectionOpenState round-trip (false, not just truthy)');
check(sandbox.getSectionOpenState('otherSection') === null, 'unrelated section id unaffected by another section\'s saved state');

// wrapSectionCollapsible: openByDefault=true, no saved state yet -> should open
const htmlNoId = '<h2 class="section-header">Title A</h2><p>body</p>';
const wrappedNoId = sandbox.wrapSectionCollapsible(htmlNoId, true);
check(wrappedNoId.includes('open'), 'section with no id attribute falls back to openByDefault=true');
const wrappedNoIdClosed = sandbox.wrapSectionCollapsible(htmlNoId, false);
check(!/<details class="section-details"\s+open/.test(wrappedNoIdClosed), 'section with no id attribute falls back to openByDefault=false');

// wrapSectionCollapsible: with id + saved state overriding openByDefault
sandbox.setSectionOpenState('sectX', false);
const htmlWithId = '<h2 class="section-header" id="sectX">Title B</h2><p>body</p>';
const wrappedSaved = sandbox.wrapSectionCollapsible(htmlWithId, true); // openByDefault=true, but saved state says closed
check(!/<details class="section-details" id="sectX"\s+open/.test(wrappedSaved), 'saved CLOSED state overrides openByDefault=true');
sandbox.setSectionOpenState('sectX', true);
const wrappedSaved2 = sandbox.wrapSectionCollapsible(htmlWithId, false); // openByDefault=false, but saved state says open
check(/<details class="section-details" id="sectX"\s+open/.test(wrappedSaved2), 'saved OPEN state overrides openByDefault=false');

// --- Task 6: needsInputBadge ---
check(typeof sandbox.needsInputBadge === 'function', 'needsInputBadge is callable');
check(sandbox.needsInputBadge(true) === '', 'needsInputBadge returns empty string when ready/isReady=true');
check(sandbox.needsInputBadge(false).includes('needs-input-badge'), 'needsInputBadge returns a badge span when isReady=false');
check(sandbox.needsInputBadge(false).includes('Needs setup'), 'needsInputBadge badge text reads "Needs setup" (English)');

// --- Task 5: calculatedAsOfLine ---
check(typeof sandbox.calculatedAsOfLine === 'function', 'calculatedAsOfLine is callable');
const fixedDate = new Date('2026-09-22T12:00:00Z');
const line = sandbox.calculatedAsOfLine(fixedDate);
check(line.includes('calculated-as-of'), 'calculatedAsOfLine wraps output in .calculated-as-of div');
check(line.includes('2026-09-22'), 'calculatedAsOfLine formats the date as YYYY-MM-DD');
const lineDefault = sandbox.calculatedAsOfLine(); // no arg -> defaults to "now"
check(lineDefault.includes(new Date().toISOString().slice(0,10)), 'calculatedAsOfLine defaults to today when called with no argument');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
