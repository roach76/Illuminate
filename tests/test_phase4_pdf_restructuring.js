const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Phase 4 of the large combined list's plan (PDF export restructuring): both bullets were
// found, by direct investigation, to already be fully built in earlier rounds - this file exists to
// prove that claim with a real, scripted check rather than leaving it as an unverified assertion.
//
// 1. "A profile-picker on export: choose one profile, or export all profiles (as a ZIP of separate
//    PDFs)" - the Export Center (getAllExistingProfiles/renderExportCenterList) already lists every
//    real profile on the account with its own Export button, and a real "Export All Profiles (ZIP)"
//    button (exportAllProfilesAsZip, wired to btnExportAllZip) already builds every profile's PDF as a
//    Blob (buildProfilePdfHTML -> captureChunksIntoPdf, the SAME pipeline as a single export - not a
//    second, drift-prone implementation) and bundles them with JSZip (already loaded in index.html).
// 2. "Every new reading/table added in Phases 0-3 gets included in the live (screenshot) PDF export" -
//    this test builds the REAL PDF HTML for a real profile with a partner, a child, a household
//    occupant, and a saved property (construction year + facing direction), via the real
//    buildProfilePdfHTML function, and confirms every Phase 2/3 reading's own real heading text is
//    present in the output: Household Compatibility, the Kua x Flying Star cross-reference, the
//    3-Year Monthly Da Yun Forecast, the 3-Year Monthly Western Astrology Match, and the two new Zi
//    Wei Dou Shu minor stars (Di Kong / Di Jie). A genuine miss on the first attempt (see below) is
//    exactly why this is scripted rather than assumed.
process.on('unhandledRejection', () => {}); // a stray DOMContentLoaded listener fires asynchronously after this script's own synchronous checks complete, in this bare jsdom doc with no real page chrome - harmless, unrelated to what this file verifies
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { JSDOM } = require('jsdom');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');

// --- Static regression guards: the profile-picker + ZIP-all machinery genuinely exists and is wired. ---
check(/function getAllExistingProfiles/.test(appSrc), 'getAllExistingProfiles (profile-picker data source) exists');
check(/function renderExportCenterList/.test(appSrc), 'renderExportCenterList (profile-picker UI) exists');
check(/function exportAllProfilesAsZip/.test(appSrc), 'exportAllProfilesAsZip exists');
check(/function buildProfilePdfBlob/.test(appSrc), 'buildProfilePdfBlob exists (blob variant reused for zipping, not a second PDF implementation)');
// Window widened from 1200 to 2000 chars: a later round wrapped this whole block in a documented
// try/finally (a bug-fix comment plus the try/finally itself) to close a container-leak gap, which
// pushed the real captureChunksIntoPdf call further from this anchor without changing the underlying
// reuse this check verifies.
check(/const html = buildProfilePdfHTML\(prefix\);[\s\S]{0,2000}captureChunksIntoPdf\(topLevelNodes, wrapperStyle\)/.test(appSrc), 'buildProfilePdfBlob reuses the exact same buildProfilePdfHTML + captureChunksIntoPdf pipeline as a single export, not a parallel implementation');
check(/new JSZip\(\)/.test(appSrc), 'exportAllProfilesAsZip genuinely bundles with JSZip');
check(/\$\('#btnExportAllZip'\)\.addEventListener\('click', exportAllProfilesAsZip\)/.test(appSrc), 'the Export-All-ZIP button is genuinely wired to a click handler, not dead code');
check(/id="btnExportAllZip"/.test(indexSrc), 'the Export-All-ZIP button exists in the real page markup');
check(/jszip[^"']*\.min\.js/i.test(indexSrc), 'JSZip is genuinely loaded as a script in index.html');
check(/id="exportCenterList"/.test(indexSrc), 'the Export Center profile-picker list container exists in the real page markup');

// --- Behavioral: build the REAL PDF HTML for a real, fully-populated profile and confirm every ---
// --- Phase 2/3 reading's own heading text survives into it. ---
let threw = null;
try {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  const STORAGE_KEY = 'illuminate-local-v101';
  const testUser = {
    email: 'test@test.com', password: 'x',
    profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', fsDir: 'South', bazhaiOccupants: [{ name: 'Occ1', birthdate: '1980-01-01', birthtime: '12:00', gender: 'female' }] },
    home: { constructionYear: 2015 },
    partner: { englishFirstName: 'Tina', englishLastName: 'Seah', birthdate: '1976-04-25', birthtime: '10:21', gender: 'female' },
    children: [{ englishFirstName: 'Zayn', englishLastName: 'Neo', birthdate: '2024-08-15', birthtime: '12:27', gender: 'male' }],
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
  try { load('app.js'); } catch (e) { /* top-level DOMContentLoaded wiring in a bare jsdom doc is expected to be noisy - buildProfilePdfHTML itself is a plain function call below, independent of that */ }

  const html = vm.runInContext(`buildProfilePdfHTML('i')`, sandbox);
  check(!!html && html.length > 1000, 'buildProfilePdfHTML produced real, substantial HTML for a fully-populated profile');

  const mustContain = [
    ['Household Compatibility', /Household Compatibility/],
    ['Kua x Flying Star cross-reference', /Household Kua Cross-Reference/],
    ['3-Year Monthly Da Yun Forecast', /3-Year Monthly Da Yun Forecast/],
    ['3-Year Monthly Western Astrology Match', /3-Year Monthly Western Astrology Match/],
    ['Zi Wei Di Kong minor star', /Di Kong/],
    ['Zi Wei Di Jie minor star', /Di Jie/],
  ];
  mustContain.forEach(([label, re]) => check(re.test(html || ''), `the real PDF HTML includes the "${label}" reading (Phase 2/3 content is genuinely captured, not just present in the live UI)`));
} catch (e) { threw = e; }
check(!threw, 'behavioral PDF-capture section completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
