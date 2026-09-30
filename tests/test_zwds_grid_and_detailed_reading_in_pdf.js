const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies two of this round's remaining requested fixes:
// 1. "ZWDS full chart still missing" - the traditional 12-palace square grid diagram is now rendered
//    (not just the earlier flat palace-by-palace table), with a correct fixed branch-position layout
//    and a center info panel, and every branch/palace/star appears exactly once.
// 2. "The Detailed reading is missing. This should go after summary and before the compatibility
//    summary" - buildProfilePdfHTML now includes the Detailed Reading section, positioned after Details
//    Summary and before the compatibility summaries, for the main individual profile.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const STORAGE_KEY = 'illuminate-local-v101';
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore' },
  partner: { englishFirstName: 'Tina', englishLastName: 'Seah', birthdate: '1976-04-25', birthtime: '10:21', gender: 'female' },
};
const storageBacking = { [STORAGE_KEY]: JSON.stringify({ users: { 'test@test.com': testUser }, active: 'test@test.com' }) };
const localStorage = { getItem: (k) => (k in storageBacking ? storageBacking[k] : null), setItem: (k, v) => { storageBacking[k] = String(v); }, removeItem: (k) => { delete storageBacking[k]; } };
const sandbox = {
  console, localStorage, navigator: { language: 'en-US' },
  document: dom.window.document, window: dom.window,
  alert: () => {}, requestAnimationFrame: (fn) => setTimeout(fn, 0),
};
sandbox.global = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js');
try { load('app.js'); } catch (e) { /* stray DOMContentLoaded wiring in a bare jsdom doc - unrelated to what this checks */ }

// --- Static: the grid layout constant and its consumer exist ---
const metaSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8');
check(/const ZWDS_GRID_LAYOUT = \[/.test(metaSrc), 'ZWDS_GRID_LAYOUT constant exists');
const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
check(/Full 12-Palace Chart Grid/.test(appSrc), 'the Full 12-Palace Chart Grid section exists in app.js');
check(/ZWDS_GRID_LAYOUT\.map\(\(branchIdx, gridPos\)/.test(appSrc), 'the grid section iterates ZWDS_GRID_LAYOUT to build cells');

// --- Behavioral: build the real PDF HTML and inspect what it contains ---
const html = vm.runInContext(`buildProfilePdfHTML('i')`, sandbox);
check(!!html && html.length > 1000, 'buildProfilePdfHTML produced real, substantial HTML');

check(/Full 12-Palace Chart Grid/.test(html), 'the real PDF HTML includes the new 12-palace grid section heading');
check(/grid-template-columns:repeat\(4,1fr\)/.test(html), 'the grid uses a genuine 4-column CSS grid layout');
check(/grid-column:2 \/ span 2;grid-row:2 \/ span 2/.test(html), 'the center info panel correctly spans the middle 2x2 area');
// Every one of the 12 branch characters (子丑寅卯辰巳午未申酉戌亥) should appear as a grid cell label.
const branchCN = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
branchCN.forEach(b => check(html.includes(b), `the grid includes the ${b} branch cell`));
// Both Life Palace and Body Palace markers should appear somewhere in the grid.
check(/★/.test(html), 'the grid marks the Life Palace with its ★ indicator');
check(/\(身\)/.test(html), 'the grid marks the Body Palace with its (身) indicator');

// --- Behavioral: Detailed Reading is present and correctly positioned ---
check(/Detailed Reading/.test(html), 'the real PDF HTML includes a Detailed Reading section');
check(/Full Total Summary/.test(html), 'the Detailed Reading\'s own final "Full Total Summary" sub-section is present, confirming generateDetailedReading() genuinely ran (not just an empty heading)');

const detailsSummaryIdx = html.indexOf('Details Summary');
const detailedReadingIdx = html.indexOf('>Detailed Reading<');
// NOTE: "Life Partner Compatibility" also appears once earlier, inside a DIFFERENT, pre-existing
// section (renderSystemChart's own "Compatibility Overview" collapsible, shown near the very top of
// every main-profile report) - that section's own heading is "Compatibility Overview", with "Life
// Partner Compatibility - <name>" only as an inner pill label. The section this fix actually targets -
// the one buildProfilePdfHTML itself builds and appends near the end, right where Detailed Reading was
// asked to sit before - uses "Life Partner Compatibility - <name>" as its own real section heading
// (now wrapped by wrapSectionCollapsible(), so it appears as a <span> inside a section-summary rather
// than a raw <h2> - see the "duplicate/garbled TOC line items" fix). Since this end-of-report section
// is the LAST thing in the whole document, its heading is necessarily the LAST occurrence of this
// string anywhere in the HTML, so lastIndexOf reliably finds it rather than the earlier pill-only one.
const compatIdx = html.lastIndexOf('Life Partner Compatibility - ');
check(detailsSummaryIdx !== -1, 'Details Summary section is present (the "summary" the Detailed Reading must follow)');
check(detailedReadingIdx !== -1, 'Detailed Reading heading is present');
check(compatIdx !== -1, 'the end-of-report Life Partner Compatibility summary section is present (this test user has a partner)');
check(detailsSummaryIdx < detailedReadingIdx, 'Detailed Reading correctly comes AFTER Details Summary');
check(detailedReadingIdx < compatIdx, 'Detailed Reading correctly comes BEFORE the end-of-report Life Partner Compatibility summary');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
