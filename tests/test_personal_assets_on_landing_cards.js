const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the latest request ("move the personal assets compatibility info into the landing page
// summary cards for each profile as each profile has their own personal assets") - resolved via
// AskUserQuestion as "Add" (keep both): the Personal Assets & Address summary (Mobile Number /
// Vehicle Number / Address Compatibility) now ALSO appears inline inside each profile's landing-page
// summary card (generateSummaryCardHTML), in addition to staying on that profile's own chart page
// (buildPersonalAssetsSummaryCardHTML / artAssetsSummary in renderSystemChart, untouched).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
const storage = {};
const localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};
const sandbox = {
  console, localStorage, navigator: { language: 'en-US' },
  document: dom.window.document, window: dom.window,
  setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
  URL: dom.window.URL, html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}} }),
  alert: () => {}, confirm: () => true,
};
sandbox.global = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static: the function signature and call sites carry the new prefix, and the chart-page card
// (artAssetsSummary in renderSystemChart) is untouched - confirming this is an ADD, not a replace. ---
check(/function generateSummaryCardHTML\(focusP, compareP, isBusiness, isZh, prefix = 'i'\)/.test(appSrc), "generateSummaryCardHTML gained a prefix parameter (default 'i')");
check(/generateSummaryCardHTML\(p, null, false, isZh, 'i'\)/.test(appSrc), "main profile's landing call passes prefix 'i'");
check(/generateSummaryCardHTML\(partnerP, p, false, isZh, 'p'\)/.test(appSrc), "partner's landing call passes prefix 'p'");
check(/generateSummaryCardHTML\(bizP, p, true, isZh, 'b'\)/.test(appSrc), "business partner's landing call passes prefix 'b'");
check(/const artAssetsSummary = buildPersonalAssetsSummaryCardHTML\(prefix, p, prof, u\);/.test(appSrc), 'the chart-page Personal Assets card (renderSystemChart) is still present, unchanged - this is an addition, not a relocation');
check(/artProfileOverview \+ artAssetsSummary/.test(appSrc), 'the chart-page card still sits right after the profile overview, exactly as before');

vm.runInContext(`
  state = { users: {}, active: 'roy@test.com' };
  state.users['roy@test.com'] = {
    profile: {
      englishFirstName: 'Roy', englishLastName: 'Wong', gender: 'male',
      birthdate: '1976-09-07', birthtime: '09:33', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
      mobileNumber: '91234567', vehicles: [{ number: 'SJL1234A', shared: false }],
    },
    home: { address: '92 Flora Road, Singapore 507005' },
    partner: {
      englishFirstName: 'Amy', englishLastName: 'Lee', gender: 'female',
      birthdate: '1978-05-12', birthtime: '14:00', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
      mobileNumber: '98765432',
    },
    businessPartner: {
      englishFirstName: 'Ben', englishLastName: 'Tan', gender: 'male',
      birthdate: '1980-03-03', birthtime: '10:00', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
    },
  };
  initListeners();
  var __p = getProfileData(activeUser().profile);
  var __pp = getProfileData(activeUser().partner);
  var __bp = getProfileData(activeUser().businessPartner);
  var __landingMain = generateSummaryCardHTML(__p, null, false, false, 'i');
  var __landingPartner = generateSummaryCardHTML(__pp, __p, false, false, 'p');
  var __landingBiz = generateSummaryCardHTML(__bp, __p, true, false, 'b');
  var __landingDefaultPrefix = generateSummaryCardHTML(__p, null, false, false);
`, sandbox);

const landingMain = vm.runInContext(`__landingMain`, sandbox);
const landingPartner = vm.runInContext(`__landingPartner`, sandbox);
const landingBiz = vm.runInContext(`__landingBiz`, sandbox);
const landingDefaultPrefix = vm.runInContext(`__landingDefaultPrefix`, sandbox);

// Main profile landing card: mobile + vehicle + address all set - real scores expected.
check(/Personal Assets/.test(landingMain), "the main profile's landing-page summary card now includes the Personal Assets & Address block");
check(/Mobile Number/.test(landingMain) && /Vehicle Number/.test(landingMain) && /Address Compatibility/.test(landingMain), 'the main profile landing card includes Mobile Number, Vehicle Number, and Address Compatibility rows');
check(!/Not set yet/.test(landingMain.slice(landingMain.indexOf('Personal Assets'), landingMain.indexOf('Personal Assets') + 700)), "the main profile's landing card shows real scores (all fields on file), not \"Not set\"");

// Partner landing card: has mobile + shared address, vehicle in scope (individual + partner only).
check(/Personal Assets/.test(landingPartner), "the Life Partner's landing-page summary card also includes the Personal Assets & Address block");
check(/Mobile Number/.test(landingPartner) && /Address Compatibility/.test(landingPartner), "the partner's landing card includes Mobile Number and Address Compatibility rows");
check(/Vehicle Number/.test(landingPartner), "the partner's landing card still includes a Vehicle Number row (partner is in scope for vehicle ownership)");

// Business partner landing card: UPDATED this round (reported: business partner should have vehicle
// compatibility too) - Vehicle Number is now in scope for the Business Partner as well.
check(/Personal Assets/.test(landingBiz), "the Business Partner's landing-page summary card also includes the Personal Assets & Address block");
check(/Address Compatibility/.test(landingBiz), "the business partner's landing card includes the Address Compatibility row");
check(/Vehicle Number/.test(landingBiz.slice(landingBiz.indexOf('Personal Assets'), landingBiz.indexOf('Personal Assets') + 700)), "the business partner's landing card now also includes a Vehicle Number row (scope widened this round)");

// Backward compatibility: omitting prefix defaults to 'i' and still works without throwing.
check(/Personal Assets/.test(landingDefaultPrefix), 'calling generateSummaryCardHTML without an explicit prefix still defaults to the main profile and renders the assets block without error');

// Placement: UPDATED (reported: "for the landing page summary cards, the personal assets to be
// displayed below the Zi Wei Life Palace and Ba Zhai Kua summary cards") - the assets block now
// appears AFTER the key-facts grid (which ends with Ba Zhai Kua then Flying Star - see
// test_landing_card_parity_and_details_summary_expand.js for the full key-facts reordering), not
// before it as in the previous round.
const factsIdx = landingMain.indexOf('grid-template-columns:1fr 1fr');
const assetsIdx = landingMain.indexOf('Personal Assets');
check(assetsIdx !== -1 && factsIdx !== -1 && assetsIdx > factsIdx, 'the Personal Assets & Address block is now placed AFTER the key-facts grid on the landing card (below Zi Wei Life Palace/Ba Zhai Kua), not before it');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
