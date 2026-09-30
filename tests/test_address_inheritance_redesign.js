const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies item 6 of the reported round: "profile address should only apply to user, life partner,
// house occupants. Children should not inherit the address unless option is selected. business
// partners should not inherit the address, unless it is a work address. There should an option to add
// work address to check for compatibility and deep analysis for user and business partners."
//
// REDESIGN implemented in buildPersonalAssetsSummaryRows (app.js):
//   - 'i' (Individual) and 'p' (Life Partner): Home Address (u.home.addresses.profile) always applies,
//     unchanged from before.
//   - 'i' ALSO gets a second, separate Work Address Compatibility row (u.home.addresses.work) when one
//     is on file.
//   - 'b'/'b2_N' (Business Partner(s)): Home Address no longer applies AT ALL - only Work Address does.
//   - 'cN' (Children): Home Address only applies when that child's own `includeHomeAddress` flag is
//     set (via the People Management screen's new checkbox) - off by default.
//   - Household Occupants have no profile-page prefix at all, so are unaffected (already implicitly
//     home-address-based via the Ba Zhai household roster).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');

// --- Static checks ---
check(/u\.home\.addresses \= \{ profile: null, checked: \[\], work: null \};/.test(appSrc), 'ensureHomeAddressModel now initializes a third, independent work address slot');
check(/id="intakeWorkHouseNumber"/.test(htmlSrc) && /id="intakeWorkStreetName"/.test(htmlSrc) && /id="intakeWorkCity"/.test(htmlSrc) && /id="intakeWorkCountry"/.test(htmlSrc) && /id="intakeWorkPostalCode"/.test(htmlSrc), 'the Intake/Profile page has a full set of Work Address fields');
check(/id="\$\{formIdPrefix\}-includeHomeAddr"/.test(appSrc), 'the People Management person form has an "Include Home Address" checkbox');
check(/includeHomeAddress: g\('includeHomeAddr'\) \? !!g\('includeHomeAddr'\)\.checked : false,/.test(appSrc), 'readPersonFieldsFromForm reads the new includeHomeAddress checkbox');

// --- Functional checks: drive buildPersonalAssetsSummaryRows directly for each prefix ---
function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
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
  return { dom, sandbox };
}

const { sandbox } = freshSandbox();
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  partner: { englishFirstName: 'Amy', englishLastName: 'Lee', birthdate: '1978-05-12', birthtime: '14:00', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  businessPartner: { englishFirstName: 'Ben', englishLastName: 'Tan', birthdate: '1980-03-03', birthtime: '10:00', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  children: [
    { englishFirstName: 'Cara', englishLastName: 'Wong', birthdate: '2010-01-01', birthtime: '08:00', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, includeHomeAddress: false },
    { englishFirstName: 'Cody', englishLastName: 'Wong', birthdate: '2012-01-01', birthtime: '08:00', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, includeHomeAddress: true },
  ],
  additionalBizPartners: [],
  home: {
    addresses: {
      profile: { houseNumber: '92', streetName: 'Flora Road', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005', facing: '', shared: false },
      checked: [],
      work: { houseNumber: '1', streetName: 'Raffles Place', unit: '#12-01', city: 'Singapore', country: 'Singapore', postalCode: '048616', constructionYear: '', facing: '', shared: false },
    },
  },
};
vm.runInContext(`
  state = { users: {}, active: 'test@test.com' };
  state.users['test@test.com'] = ${JSON.stringify(testUser)};
  var __u = activeUser();
  ensurePeopleArray(__u);
`, sandbox);

function rowsFor(prefix) {
  return vm.runInContext(`
    (function() {
      var u = activeUser();
      var prof = getProfileByPrefix('${prefix}');
      var p = getProfileData(prof);
      return buildPersonalAssetsSummaryRows('${prefix}', p, prof, u);
    })()
  `, sandbox);
}

// Individual: Home Address row (always) + a separate Work Address row.
const rowsI = rowsFor('i');
const homeRowI = rowsI.find(r => r.lines[0].includes('Address Compatibility') && !r.lines[0].includes('Work'));
const workRowI = rowsI.find(r => r.lines[0].includes('Work Address Compatibility'));
check(!!homeRowI && homeRowI.ok, "Individual's landing/chart card shows a scored Home Address Compatibility row (unchanged scope)");
check(!!workRowI && workRowI.ok, "Individual's landing/chart card ALSO shows a scored Work Address Compatibility row now that a work address is on file");

// Life Partner: Home Address row (always), NO separate Work Address row.
const rowsP = rowsFor('p');
const homeRowP = rowsP.find(r => r.lines[0].includes('Address Compatibility') && !r.lines[0].includes('Work'));
const workRowP = rowsP.find(r => r.lines[0].includes('Work Address Compatibility'));
check(!!homeRowP && homeRowP.ok, "Life Partner's card shows a scored Home Address Compatibility row (unchanged scope - still inherits the household address)");
check(!workRowP, "Life Partner's card does NOT get a Work Address row (work address never applies to the Life Partner)");

// Business Partner: NO Home Address row at all - only Work Address.
const rowsB = rowsFor('b');
const homeRowB = rowsB.find(r => r.lines[0].includes('Address Compatibility') && !r.lines[0].includes('Work'));
const workRowB = rowsB.find(r => r.lines[0].includes('Work Address Compatibility'));
check(!homeRowB, 'BUG FIX VERIFIED: Business Partner no longer inherits the household Home Address at all');
check(!!workRowB && workRowB.ok, "Business Partner's card shows a scored Work Address Compatibility row instead");

// Child WITHOUT includeHomeAddress: address is explicitly excluded, not silently scored.
const rowsC0 = rowsFor('c0');
const addrRowC0 = rowsC0.find(r => r.lines[0].includes('Address Compatibility'));
check(!!addrRowC0 && !addrRowC0.ok, 'BUG FIX VERIFIED: a child without "Include Home Address" ticked shows the address as excluded, not silently scored');
check(addrRowC0.lines[0].includes('Not included'), 'the excluded-child row explains it can be enabled in People Management');

// Child WITH includeHomeAddress: home address is scored normally.
const rowsC1 = rowsFor('c1');
const addrRowC1 = rowsC1.find(r => r.lines[0].includes('Address Compatibility'));
check(!!addrRowC1 && addrRowC1.ok, 'a child WITH "Include Home Address" ticked gets a real scored Address Compatibility row');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
