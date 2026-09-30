const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for garbled/nonsensical Table-of-Contents line items, reported directly against a
// real generated PDF's own Table of Contents page:
//   "LW Liang Jie Roy Wong Male Age 50..."
//   "This is a rule-based reading generated from your own chart's computed..."
//   "Life Partner Deep Compatibility Profile Life Part..."
//   "Business Partner Strategic Alignment Profile Busi..."
//   "For reflection and entertainment; not scientific, financial, or medica..."
//
// Root cause: the TOC is built with one row per top-level DOM child of the PDF's content wrapper.
// Most of the ~15 main tab sections are wrapped by wrapSectionCollapsible() into one
// `.section-details`/`.section-summary` element, which extractSectionTitle() (used to build the TOC)
// correctly finds. But several sections appended directly in buildProfilePdfHTML - the profile overview
// banner, Detailed Reading, and the Life/Business Partner compatibility sections - were emitted as loose,
// un-wrapped `<h2>` + `<article>` sibling pairs. The `<article>` half of each pair had no heading element
// of its own (h1/h2/.section-header/.pill/.section-summary), so extractSectionTitle fell back to using
// the WHOLE section's raw text content (truncated to 70 chars) as its "title" - producing the garbled
// lines above.
//
// Fix: (1) extractSectionTitle now returns null (not a raw-text fallback) when no real heading is found,
// and the TOC-building loop simply skips those - so purely decorative nodes (the banner, the closing
// disclaimer) get no TOC row at all, instead of a nonsensical one; (2) the sections that DO deserve a
// real TOC entry (Detailed Reading, Life/Business Partner Compatibility, Family Summary, Household
// Occupants) are now run through wrapSectionCollapsible() just like the main tab sections, so they get
// their own clean, correct entry instead of either a garbled one or none at all.
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
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  partner: { englishFirstName: 'Tina', englishLastName: 'Seah', birthdate: '1976-04-25', birthtime: '10:21', gender: 'female' },
  businessPartner: { englishFirstName: 'Bobby', englishLastName: 'Lim', birthdate: '1980-01-15', birthtime: '06:00', gender: 'male' },
  children: [{ englishFirstName: 'Alex', englishLastName: 'Wong', birthdate: '2010-05-01', birthtime: '12:00', gender: 'male' }],
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
try { load('app.js'); } catch (e) { /* stray DOMContentLoaded wiring in a bare jsdom doc - unrelated */ }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static: extractSectionTitle no longer has a raw-textContent fallback ---
check(/function extractSectionTitle\(node, index\) \{\s*\n\s*if \(!node \|\| !node\.querySelector\) return null;/.test(appSrc),
  'extractSectionTitle returns null (not "Section N") for a non-element node');
check(/if \(!heading\) return null;/.test(appSrc), 'extractSectionTitle returns null when no heading element is found, instead of falling back to raw text content');
check(!/const text = heading \? \(heading\.textContent \|\| ''\)\.trim\(\) : \(node\.textContent/.test(appSrc), 'the old heading-or-whole-node-text fallback line is gone');

// --- Static: the trailing sections are now wrapped with wrapSectionCollapsible ---
check(/compatSections \+= wrapSectionCollapsible\(`<h2 class="section-header">\$\{bt\('Life Partner Compatibility'/.test(appSrc),
  'the Life Partner Compatibility section is now wrapped with wrapSectionCollapsible');
check(/compatSections \+= wrapSectionCollapsible\(`<h2 class="section-header">\$\{bt\('Business Partner Compatibility'/.test(appSrc),
  'the Business Partner Compatibility section is now wrapped with wrapSectionCollapsible');
check(/bodyHTML \+= wrapSectionCollapsible\(familyHTML\);/.test(appSrc), 'the Family Summary section is now wrapped with wrapSectionCollapsible');
check(/bodyHTML \+= wrapSectionCollapsible\(occHTML\);/.test(appSrc), 'the Household Occupants section is now wrapped with wrapSectionCollapsible');
check(/bodyHTML \+= wrapSectionCollapsible\(`<h2 class="section-header">\$\{bt\('Detailed Reading'/.test(appSrc), 'the Detailed Reading section is now wrapped with wrapSectionCollapsible');

// --- Behavioral: build the real PDF HTML for a profile with a partner, business partner, and a child,
// and confirm none of the previously-reported garbled snippets appear anywhere in it, while every real
// section title still does. ---
const html = vm.runInContext(`buildProfilePdfHTML('i')`, sandbox);
check(!!html && html.length > 1000, 'buildProfilePdfHTML produced real, substantial HTML');

const bogusSnippets = [
  'Male · Age',           // from the profile banner card's own raw text ("... Male · Age 50 · Dragon...")
  "This is a rule-based reading generated from your own chart's computed",
  'Life Partner Deep Compatibility Profile Life Part',
  'Business Partner Strategic Alignment Profile Busi',
];
// These snippets are expected to still exist SOMEWHERE in the real content (the banner still shows the
// age, the disclaimer box still exists) - what must NOT happen is them being used as a title inside a
// jsPDF .text() TOC-drawing call. Simulate that exact call by extracting the real function and driving
// it against the real generated HTML's DOM structure, the same way the app itself does.
const container = dom.window.document.createElement('div');
container.innerHTML = html;
const innerWrapper = container.firstElementChild;
const topLevelNodes = Array.from(innerWrapper.children);
check(topLevelNodes.length > 5, `real content has multiple top-level sections to check (found ${topLevelNodes.length})`);

const extractSectionTitleFn = vm.runInContext('extractSectionTitle', sandbox);
const resolvedTitles = topLevelNodes.map((node, idx) => extractSectionTitleFn(node, idx)).filter(Boolean);
check(resolvedTitles.length > 0, 'at least some top-level sections resolve to a real TOC title');

bogusSnippets.forEach(snippet => {
  const matched = resolvedTitles.some(t => t.includes(snippet));
  check(!matched, `no resolved TOC title contains the previously-reported garbled snippet "${snippet}"`);
});

// The real, correct headings for the fixed sections must still resolve properly.
['Detailed Reading', 'Life Partner Compatibility - Tina', 'Business Partner Compatibility - Bobby', 'Family Summary - Children'].forEach(title => {
  const matched = resolvedTitles.some(t => t.includes(title.split(' - ')[0]));
  check(matched, `a resolved TOC title exists for "${title}"`);
});

// The purely-decorative nodes (profile banner/overview card, closing disclaimer) should resolve to null
// and be excluded, not produce a row of their own.
const bannerNode = topLevelNodes.find(n => n.tagName === 'ARTICLE' && /Male · Age/.test(n.textContent || ''));
check(!!bannerNode, 'the profile overview banner/tiles article is present in the real content');
check(extractSectionTitleFn(bannerNode, 0) === null, 'the profile overview banner article correctly resolves to null (no heading of its own) and is excluded from the TOC');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
