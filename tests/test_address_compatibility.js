const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the new "Check Address Compatibility" feature (reported: "missing personal assets and
// address compatibility scores and deep analysis on the app and PDF" / "Feng Shui need not have home
// address there for input. change it to a check address compatibility instead. include the
// compatibility score and deep analysis for the address to be checked.")
//
// Design: reuses the exact same verified digit/elemental-audit engine already built for Mobile Number
// and Vehicle Plate (parseToDigits + analyzeNumbersDynamic) rather than attempting real geocoding,
// which this app deliberately does not do. Construction Year remains untouched, still feeding the
// separate Flying Star property chart further down the page.
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
  home: {},
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

const predSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-predictions.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static ---
check(/function auditAddressScore\(inputVal, p, partnerP\)/.test(predSrc), 'auditAddressScore exists in engine-predictions.js');
check(/\} else if \(type === 'address'\) \{/.test(appSrc), "generateDeepAnalysisData handles type === 'address'");
// UPDATED (this round, item 3 - shared-address checkbox): signature gained a `shared` param so the
// deep-analysis only cross-references the Life Partner's chart when the address is actually marked shared.
// UPDATED AGAIN (reported: "the addressed should take into consideration the ba zhai and flying star
// for compatibility calculation and deep analysis"): signature gained optional facing/constructionYear
// params so the score can also blend in Ba Zhai + Flying Star when that data is on file - see
// test_address_bazhai_flyingstar.js for full coverage of that behavior.
check(/function computeAddressDeepAnalysisHTML\(addrVal, shared = true, facing = null, constructionYear = null\)/.test(appSrc), 'computeAddressDeepAnalysisHTML exists');
check(/Check Address Compatibility \(for Feng Shui Analysis\)/.test(appSrc), 'the section pill is renamed to Check Address Compatibility');
check(!/Home Address \(reference only\)/.test(appSrc), 'the old "reference only" framing is gone from the input label');

// --- Behavioral: auditAddressScore produces a real, deterministic score ---
const p = vm.runInContext(`getProfileData()`, sandbox);
const res1 = vm.runInContext(`auditAddressScore('123 Orchard Road, Singapore', getProfileData(), null)`, sandbox);
check(typeof res1.score === 'number' && res1.score >= 40 && res1.score <= 99, `auditAddressScore returns a real score in [40,99] - got ${res1.score}`);
check(typeof res1.explanation === 'string' && res1.explanation.length > 0, 'auditAddressScore returns a real explanation string');
const res2 = vm.runInContext(`auditAddressScore('123 Orchard Road, Singapore', getProfileData(), null)`, sandbox);
check(res1.score === res2.score, 'auditAddressScore is deterministic for the same input (same score both times)');
const res3 = vm.runInContext(`auditAddressScore('456 Toa Payoh Lorong 8, Singapore', getProfileData(), null)`, sandbox);
check(res3.score !== undefined, 'a different address computes a real score too');

// --- Behavioral: computeAddressDeepAnalysisHTML renders real, fully-expanded content in PDF-export
// mode (the same pdfExportMode flag buildProfilePdfHTML itself sets), tied to the account's actual
// address value once saved, and reflects a household partner when one exists. (In the LIVE app view,
// pdfExportMode is false and this correctly renders a collapsed "View Details" button instead - the
// exact same interactive-disclosure pattern Mobile Number and Vehicle Plate already use; that live-view
// behavior is intentional and not what this section is checking.) ---
const html1 = vm.runInContext(`(function(){ pdfExportMode = true; try { return computeAddressDeepAnalysisHTML('123 Orchard Road, Singapore'); } finally { pdfExportMode = false; } })()`, sandbox);
check(html1.includes('123 Orchard Road, Singapore'), 'the rendered HTML includes the checked address text');
check(/Address Compatibility Deep Analysis|Elemental Compatibility Score/.test(html1), 'the rendered HTML includes a real deep-analysis title/score line');
check(html1.includes('Tina'), 'the rendered HTML reflects the household partner (Tina) since one is on file');
check(/does not perform geocoding/.test(html1), 'the rendered HTML is honest that no geocoding is performed');

// --- Behavioral: renderHomeDetailsBlock auto-computes the result once an address is on file, and the
// PDF export (buildProfilePdfHTML) carries it through (it is NOT inside the pdf-exclude wrapper) ---
// UPDATED (reported this round: "house number/block, city, country, postal code should be
// mandatory"): renderHomeDetailsBlock now only auto-computes the Address Compatibility analysis once
// those 4 fields are filled in (isAddressComplete), not merely once ANY field has something in it
// (isAddressEmpty, the old, looser gate) - see ADDRESS_MANDATORY_FIELDS/isAddressComplete in app.js.
// Setting only the legacy u.home.address string (which migrates into just the streetName field) is no
// longer enough to trigger the analysis; the structured record needs all 4 mandatory fields set directly.
const u = vm.runInContext(`activeUser()`, sandbox);
u.home.addresses = { profile: { houseNumber: '123', streetName: 'Orchard Road', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '238859', constructionYear: '' }, checked: [] };
const blockHTML = vm.runInContext(`(function(){ pdfExportMode = true; try { return renderHomeDetailsBlock(activeUser()); } finally { pdfExportMode = false; } })()`, sandbox);
check(blockHTML.includes('id="homeAddressResult"'), 'renderHomeDetailsBlock includes the homeAddressResult container');
check(/Compatibility Score: \d+%/.test(blockHTML), 'renderHomeDetailsBlock pre-renders a real compatibility score once an address is saved (PDF-export mode)');

const pdfHTML = vm.runInContext(`buildProfilePdfHTML('i')`, sandbox);
check(pdfHTML.includes('123 Orchard Road, Singapore'), 'the PDF export includes the checked address');
check(/Compatibility Score \d+%/.test(pdfHTML), 'the PDF export includes the real computed compatibility score (not just the raw address text)');
// The result must appear in the PDF at all (buildProfilePdfHTML internally sets pdfExportMode=true and
// resets it after, so it is NOT sensitive to the pdf-exclude stripping that only applies to nodes
// literally wrapped in a pdf-exclude div - the homeAddressResult div sits as its own sibling, outside
// that wrapper, in renderHomeDetailsBlock's own markup) - confirmed structurally by requiring the
// homeAddressResult container id to appear in the exported HTML at all.
check(pdfHTML.includes('id="homeAddressResult"'), 'the homeAddressResult container survives into the PDF export HTML');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
