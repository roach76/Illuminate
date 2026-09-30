const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Task #75 (reported: "Personal Assets compatibility should be part of the summary cards
// in landing page and charts for all profiles"): the Mobile Number / Vehicle Number / Address
// Compatibility scoring card, previously only on the Home dashboard for the main profile, is now
// also embedded directly at the top of EVERY profile's own chart (Life Partner, Business Partner,
// Children) via the shared buildPersonalAssetsSummaryRows/buildPersonalAssetsSummaryCardHTML helpers.
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
check(/function buildPersonalAssetsSummaryRows\(prefix, p, prof, u\)/.test(appSrc), 'buildPersonalAssetsSummaryRows is a shared, prefix-aware helper');
check(/function buildPersonalAssetsSummaryCardHTML\(prefix, p, prof, u\)/.test(appSrc), 'buildPersonalAssetsSummaryCardHTML is defined');
check(/const artAssetsSummary = buildPersonalAssetsSummaryCardHTML\(prefix, p, prof, u\);/.test(appSrc), 'renderSystemChart builds the card for whichever profile it is rendering (via prefix)');
check(/artProfileOverview \+ artAssetsSummary/.test(appSrc), 'the assets summary card is inserted right after the profile overview card in every render path');

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
    children: [{
      englishFirstName: 'Timmy', englishLastName: 'Wong', gender: 'male',
      birthdate: '2010-01-01', birthtime: '06:00', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
    }],
  };
  initListeners();
  var __p = getProfileData(activeUser().profile);
  var __chartI = renderSystemChart(__p, 'i');
  var __pp = getProfileData(activeUser().partner);
  var __chartP = renderSystemChart(__pp, 'p');
  var __cp = getProfileData(activeUser().children[0]);
  var __chartC = renderSystemChart(__cp, 'c0');
`, sandbox);

// The assets summary card is prepended to renderSystemChart's own return value (right after the
// profile overview, before the tab bar) - NOT inside chartTabRegistry's per-tab HTML - since it must
// be visible immediately, above the tabs, on every profile's chart.
const chartI = vm.runInContext(`__chartI`, sandbox);
const chartP = vm.runInContext(`__chartP`, sandbox);
const chartC = vm.runInContext(`__chartC`, sandbox);

// Main profile: has mobile, vehicle, and address all set - card should show real scores, not "Not set".
check(/Personal Assets/.test(chartI), "the main profile's chart includes the Personal Assets & Address card");
check(/Mobile Number/.test(chartI) && /Vehicle Number/.test(chartI) && /Address Compatibility/.test(chartI), 'the main profile card includes Mobile Number, Vehicle Number, and Address Compatibility rows');
check(!/Not set yet/.test(chartI.slice(chartI.indexOf('Personal Assets'), chartI.indexOf('Personal Assets') + 900)), "the main profile's card shows real scores (mobile/vehicle/address are all on file), not \"Not set\"");

// Partner profile: has mobile but no own vehicles/address entries directly - the card should still
// render (household address is shared) without throwing, scoped correctly to the partner's own Day Master.
check(/Personal Assets/.test(chartP), "the Life Partner profile's chart also includes the Personal Assets & Address card");
check(/Mobile Number/.test(chartP) && /Address Compatibility/.test(chartP), "the Life Partner's card includes Mobile Number and Address Compatibility rows");
check(/Vehicle Number/.test(chartP), "the Life Partner's card still includes a Vehicle Number row (partner is in scope for vehicle ownership)");

// Child profile: per the app's established scope, vehicle ownership is only tracked for the individual
// and Life Partner - a child's card should have Mobile Number and Address rows but no Vehicle row.
// UPDATED (this round, item 6 - "Children should not inherit the address unless option is selected"):
// the Address Compatibility row still always APPEARS, but is only scored when that child's own
// includeHomeAddress flag is set - this test's fixture child has it unset, so the row now shows as
// excluded rather than a real score. See test_address_inheritance_redesign.js for the full scoring
// behavior in both states.
check(/Personal Assets/.test(chartC), "a child profile's chart also includes the Personal Assets & Address card");
check(/Address Compatibility/.test(chartC), "a child's card includes an Address Compatibility row");
check(/Not included/.test(chartC.slice(chartC.indexOf('Personal Assets'), chartC.indexOf('Personal Assets') + 900)), "BUG FIX VERIFIED: a child without 'Include Home Address' ticked shows the address as excluded, not silently scored against the shared household address");
check(!/Vehicle Number/.test(chartC.slice(chartC.indexOf('Personal Assets'), chartC.indexOf('Personal Assets') + 900)), "a child's card correctly omits the Vehicle Number row (out of scope for children, matching the standalone Personal Assets section)");

// Behavioral: the shared row-builder itself returns well-formed rows directly (not just via HTML).
// UPDATED (item 6): the main profile ('i') now also gets a separate Work Address Compatibility row
// alongside Mobile/Vehicle/(Home) Address, so this went from 3 rows to 4.
const rowsDirect = vm.runInContext(`buildPersonalAssetsSummaryRows('i', __p, activeUser().profile, activeUser())`, sandbox);
check(Array.isArray(rowsDirect) && rowsDirect.length === 4, 'buildPersonalAssetsSummaryRows returns 4 rows for the main profile (mobile, vehicle, home address, work address)');
check(rowsDirect.every(r => Array.isArray(r.lines) && r.lines.every(l => typeof l === 'string') && typeof r.ok === 'boolean'), 'every row has a lines[]/ok shape');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
