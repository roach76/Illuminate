const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's items 2 & 3:
// 2) "what happens if the vehicle is shared between user and life partner?" - a vehicle marked shared
//    on one profile's Checker & Generator tool must now also appear (read-only, tagged "Shared") on the
//    OTHER profile's own Personal Assets summary, not just affect that vehicle's own score.
// 3) the Personal Assets summary format: "<Asset> Compatibility: XX% (Shared)" on its own line, followed
//    by the actual value on the line(s) below, with the multi-line address format and Construction
//    Year / Home Main Door Facing lines.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

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
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { dom, sandbox };
}

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
check(/function getVehiclesForSummary/.test(appSrc), 'getVehiclesForSummary helper exists (mirrors shared vehicles onto the partner card)');
check(/r\.lines\[0\]/.test(appSrc), 'both summary card renderers now consume the new lines-based row shape');

const { dom, sandbox } = freshSandbox();
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, mobileNumber: '91234567', vehicles: [{ number: 'SBA1234A', shared: true }, { number: 'SJH5678B', shared: false }], fsDir: 'North' },
  partner: { englishFirstName: 'Tina', englishLastName: 'Seah', birthdate: '1976-04-25', birthtime: '10:21', gender: 'female', mobileNumber: '98765432', fsDir: 'South' },
  // UPDATED (this round, item 3 - shared-address checkbox): the Home Address's "shared with Life
  // Partner" status is now an explicit `shared` flag on the address entry rather than being implied
  // just by a partner existing, so the fixture must set it to exercise the (Shared) tag below.
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005', shared: true }, checked: [] } },
};
vm.runInContext(`
  state.users['test@test.com'] = ${JSON.stringify(testUser)};
  state.active = 'test@test.com';
`, sandbox);

const { rowsI, rowsP } = vm.runInContext(`
  (function(){
    const u = activeUser();
    syncLegacyHomeFields(ensureHomeAddressModel(u) && u);
    const pI = getProfileData();
    const pP = getProfileData(u.partner);
    return {
      rowsI: buildPersonalAssetsSummaryRows('i', pI, u.profile, u),
      rowsP: buildPersonalAssetsSummaryRows('p', pP, u.partner, u),
    };
  })()
`, sandbox);

// --- Item 3: format ---
const mobileRowI = rowsI.find(r => /Mobile Number Compatibility/.test(r.lines[0]));
check(!!mobileRowI, 'a "Mobile Number Compatibility: XX%" line exists for the main profile');
check(mobileRowI && /^Mobile Number Compatibility: \d+%$/.test(mobileRowI.lines[0]), `first line is exactly "Mobile Number Compatibility: XX%" - got "${mobileRowI && mobileRowI.lines[0]}"`);
check(mobileRowI && mobileRowI.lines[1] === '91234567', `second line is the bare mobile number - got "${mobileRowI && mobileRowI.lines[1]}"`);

const addrRowI = rowsI.find(r => /Address Compatibility/.test(r.lines[0]));
check(!!addrRowI, 'an Address Compatibility row exists');
check(addrRowI && /^Address Compatibility: \d+% \(Shared\)$/.test(addrRowI.lines[0]), `Address Compatibility line is tagged (Shared) since a Life Partner exists - got "${addrRowI && addrRowI.lines[0]}"`);
check(addrRowI && addrRowI.lines[1] === '92 Flora Road', `address line 1 is "House/Block Street" - got "${addrRowI && addrRowI.lines[1]}"`);
check(addrRowI && addrRowI.lines[2] === '#03-37', `address line 2 is the unit - got "${addrRowI && addrRowI.lines[2]}"`);
check(addrRowI && addrRowI.lines[3] === 'Singapore 507005', `address line 3 is "City PostalCode" - got "${addrRowI && addrRowI.lines[3]}"`);
check(addrRowI && addrRowI.lines[4] === 'Singapore', `address line 4 is the country - got "${addrRowI && addrRowI.lines[4]}"`);
check(addrRowI && addrRowI.lines[5] === 'Construction Year: 2005', `address line 5 is "Construction Year: ..." - got "${addrRowI && addrRowI.lines[5]}"`);
check(addrRowI && addrRowI.lines[6] === 'Home Main Door Facing: North', `address line 6 is "Home Main Door Facing: ..." (uses the main profile's own fsDir) - got "${addrRowI && addrRowI.lines[6]}"`);

// Address is shared, and mirrored identically onto the Life Partner's own card (same address text),
// though the Partner's own fsDir (South) is used for THEIR line, matching each profile's own facing.
const addrRowP = rowsP.find(r => /Address Compatibility/.test(r.lines[0]));
check(addrRowP && /\(Shared\)/.test(addrRowP.lines[0]), 'Address Compatibility is tagged (Shared) on the Life Partner\'s own card too');
check(addrRowP && addrRowP.lines[1] === '92 Flora Road', 'the same address text appears identically on the Life Partner\'s own card');
check(addrRowP && addrRowP.lines[6] === 'Home Main Door Facing: South', `the Life Partner's own fsDir is used on their own card - got "${addrRowP && addrRowP.lines[6]}"`);

// --- Item 2: shared vehicle mirroring ---
const vehicleRowsI = rowsI.filter(r => /Vehicle Number Compatibility/.test(r.lines[0]));
check(vehicleRowsI.length === 2, `the main profile's own card shows both of its own vehicles - got ${vehicleRowsI.length} row(s)`);
const sharedRowI = vehicleRowsI.find(r => r.lines[1] === 'SBA1234A');
check(sharedRowI && /\(Shared\)/.test(sharedRowI.lines[0]), 'the shared vehicle is tagged (Shared) on the main profile\'s own card');
const unsharedRowI = vehicleRowsI.find(r => r.lines[1] === 'SJH5678B');
check(unsharedRowI && !/\(Shared\)/.test(unsharedRowI.lines[0]), 'the NOT-shared vehicle carries no (Shared) tag');

const vehicleRowsP = rowsP.filter(r => /Vehicle Number Compatibility/.test(r.lines[0]));
check(vehicleRowsP.length === 1, `the Life Partner's own card shows exactly the ONE shared vehicle mirrored onto it (not the unshared one) - got ${vehicleRowsP.length} row(s)`);
check(vehicleRowsP[0] && vehicleRowsP[0].lines[1] === 'SBA1234A', `the mirrored vehicle on the partner's card is the shared plate - got "${vehicleRowsP[0] && vehicleRowsP[0].lines[1]}"`);
check(vehicleRowsP[0] && /\(Shared\)/.test(vehicleRowsP[0].lines[0]), 'the mirrored vehicle is tagged (Shared) identically on the partner\'s own card');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
