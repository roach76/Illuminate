const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Task #76 (reported: "Feng Shui address check should keep the user profile address as
// persistent and keep a separate list of checked address (limited to 6 in total with the profile
// address)") and Task #77 (reported: "address input [should] be in the form of House Number/Block,
// Street Name, Unit(if Applicable), Country, City, Postal Code, Construction Year for easier data
// management" - user confirmed "Yes, restructure now"): the free-text Home Address field is now 6
// structured fields (+ Construction Year), backed by ONE persistent profile address plus a capped
// (6 total) rolling history of additional checked addresses, with legacy u.home.address/
// constructionYear kept in sync for Flying Star and the Intake page's own prefill.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');

// --- Static: structured field helpers/model exist ---
check(/function ensureHomeAddressModel\(u\)/.test(appSrc), 'ensureHomeAddressModel is defined');
check(/function composeAddressString\(a\)/.test(appSrc), 'composeAddressString is defined');
// UPDATED (this round, item 4 - facing/shared on Check Address): signature gained an `includeFacing`
// param so "Check Another Address" can render a Home Main Door Facing selector without duplicating
// the persistent Home Address block's own separate facing selector.
check(/function renderAddressFieldsHTML\(idPrefix, a, includeYear, includeFacing\)/.test(appSrc), 'renderAddressFieldsHTML is defined');
check(/'houseNumber', 'streetName', 'unit', 'city', 'country', 'postalCode'/.test(appSrc), 'the 6 structured address fields match the requested House Number/Block, Street Name, Unit, City, Country, Postal Code set');
check(/while \(addresses\.checked\.length > maxChecked\) addresses\.checked\.shift\(\)/.test(appSrc), 'adding a checked address evicts the oldest once the cap is reached');

function buildDom() {
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
  function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js'); loadFile('engine-predictions.js'); loadFile('app.js'); loadFile('auth.js');
  return { dom, sandbox, run: (code) => vm.runInContext(code, sandbox) };
}

// --- Behavioral: migration from a legacy free-text address into the structured model ---
{
  const { run } = buildDom();
  run(`
    state = { users: {}, active: 'roy@test.com' };
    state.users['roy@test.com'] = { profile: {
      englishFirstName: 'Roy', englishLastName: 'Wong', gender: 'male', birthdate: '1976-09-07',
      birthtime: '09:33', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8
    }, home: { address: '92 Flora Road, Singapore 507005', constructionYear: 2006 } };
    initListeners();
    var __p = getProfileData(activeUser().profile);
    renderSystemChart(__p, 'i');
  `);
  const profAddr = run(`activeUser().home.addresses.profile`);
  check(profAddr && profAddr.streetName === '92 Flora Road, Singapore 507005', 'legacy u.home.address migrates into the structured profile address (streetName)');
  check(profAddr && profAddr.constructionYear === 2006, 'legacy u.home.constructionYear migrates onto the structured profile address too');
  const html = run(`chartTabRegistry['i'].environment`);
  check(/homeAddressBlock/.test(html), 'the rendered Feng Shui tab includes the homeAddressBlock container');
  check(/92 Flora Road/.test(html), 'the migrated address is visible in the rendered block');
}

// --- Behavioral: entering the structured fields on the PROFILE/INTAKE page, saving, and legacy sync ---
// UPDATED (reported this round: "remove the home address entry from Feng Shui as it is to be managed
// at the profile level"): the persistent Home Address is no longer editable inside the Feng Shui
// section at all (no more homeAddr* input fields there) - it is entered and edited exclusively on the
// Intake/Profile page now, then shown READ-ONLY on the Feng Shui page. This test now exercises that
// real entry point (Intake's Save Profile button) instead of the removed inline fields.
{
  const { run } = buildDom();
  run(`
    state = { users: {}, active: 'roy@test.com' };
    state.users['roy@test.com'] = { profile: {
      englishFirstName: 'Roy', englishLastName: 'Wong', gender: 'male', birthdate: '1976-09-07',
      birthtime: '09:33', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8
    }, home: {} };
    initListeners();
    go('intake');
  `);
  run(`
    document.getElementById('intakeHouseNumber').value = '123';
    document.getElementById('intakeStreetName').value = 'Orchard Road';
    document.getElementById('intakeUnit').value = '05-01';
    document.getElementById('intakeCity').value = 'Singapore';
    document.getElementById('intakeCountry').value = 'Singapore';
    document.getElementById('intakePostalCode').value = '238888';
    document.getElementById('intakeHomeConstructionYear').value = '2018';
    document.getElementById('englishLastName').value = 'Wong';
    document.getElementById('englishFirstName').value = 'Roy';
    document.getElementById('gender').value = 'male';
    document.getElementById('birthdate').value = '1976-09-07';
    document.getElementById('birthtime').value = '09:33';
    document.getElementById('saveProfile').dispatchEvent(new window.Event('click', {bubbles:true}));
  `);
  const profAddr = run(`activeUser().home.addresses.profile`);
  check(profAddr.houseNumber === '123' && profAddr.streetName === 'Orchard Road' && profAddr.unit === '05-01', 'structured field edits made on the Intake/Profile page are saved onto u.home.addresses.profile');
  check(profAddr.city === 'Singapore' && profAddr.country === 'Singapore' && profAddr.postalCode === '238888', 'city/country/postal code are saved');
  check(profAddr.constructionYear === 2018, 'construction year is saved and validated');
  const legacyAddr = run(`activeUser().home.address`);
  check(legacyAddr.includes('123') && legacyAddr.includes('Orchard Road') && legacyAddr.includes('238888'), 'the legacy u.home.address string is kept in sync (composed) so Personal Assets scoring and Intake prefill keep working');
  check(run(`activeUser().home.constructionYear`) === 2018, 'the legacy u.home.constructionYear is kept in sync so Flying Star (unchanged code) keeps working');

  // Now visit the Feng Shui section and confirm it shows the saved address READ-ONLY, with no editable
  // homeAddr* fields at all, plus a live Address Compatibility Deep Analysis and an "Edit on Profile"
  // shortcut back to the Intake page.
  run(`go('chart'); switchChartTab('i', 'environment');`);
  const fsHTML = run(`document.getElementById('homeAddressBlock').outerHTML`);
  check(/123 Orchard Road/.test(fsHTML), 'the Feng Shui section shows the saved address (entered on the Profile page) read-only');
  check(!/id="homeAddrHouseNumber"/.test(fsHTML) && !/id="homeAddrStreetName"/.test(fsHTML), 'no editable homeAddr* input fields render in the Feng Shui section any more');
  check(!/id="fs-dir-i-addr"/.test(fsHTML), "the Feng Shui section's own duplicate Home Facing Direction selector is gone (Ba Zhai Compass School below keeps the one remaining selector)");
  check(/btnEditHomeAddressOnProfile/.test(fsHTML), 'an "Edit on Profile" shortcut is offered instead of inline editing');
  const resultHTML = run(`document.getElementById('homeAddressResult').innerHTML`);
  check(resultHTML.length > 0, 'the address compatibility deep analysis is computed and shown for the address entered on the Profile page');

  // The "Edit on Profile" shortcut actually navigates to the Intake page.
  run(`document.querySelector('.btnEditHomeAddressOnProfile').dispatchEvent(new window.Event('click', {bubbles:true}))`);
  check(run(`document.getElementById('intake').classList.contains('active')`), 'clicking "Edit on Profile" navigates to the Intake/Profile page');
}

// --- Behavioral: adding checked addresses, the 6-total cap with eviction, and promoting one to Home ---
{
  const { run } = buildDom();
  run(`
    state = { users: {}, active: 'roy@test.com' };
    state.users['roy@test.com'] = { profile: {
      englishFirstName: 'Roy', englishLastName: 'Wong', gender: 'male', birthdate: '1976-09-07',
      birthtime: '09:33', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8
    }, home: { addresses: { profile: { houseNumber: '1', streetName: 'Home St', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '111111', constructionYear: 2000 }, checked: [] } } };
    initListeners();
    go('chart'); switchChartTab('i', 'environment');
  `);
  function addChecked(house, street, postal) {
    run(`
      document.getElementById('newAddrHouseNumber').value = '${house}';
      document.getElementById('newAddrStreetName').value = '${street}';
      document.getElementById('newAddrCity').value = 'Singapore';
      document.getElementById('newAddrCountry').value = 'Singapore';
      document.getElementById('newAddrPostalCode').value = '${postal}';
      document.querySelector('.btnConfirmAddAddress').dispatchEvent(new window.Event('click', {bubbles:true}));
    `);
  }
  addChecked('2', 'Second St', '222222');
  addChecked('3', 'Third St', '333333');
  addChecked('4', 'Fourth St', '444444');
  addChecked('5', 'Fifth St', '555555');
  addChecked('6', 'Sixth St', '666666'); // profile(1) + 5 checked = 6 total, at cap
  let checked = run(`activeUser().home.addresses.checked`);
  check(checked.length === 5, `adding 5 checked addresses on top of a set profile address caps at 5 (6 total) - got ${checked.length}`);
  check(checked[0].streetName === 'Second St', 'the oldest checked address (Second St) is still present at the cap');

  // At the 6-total cap, the "+ Check Another Address" control is no longer rendered - explicit removal
  // is required to free a slot, rather than silently evicting someone's saved history.
  const atCapHTML = run(`document.getElementById('homeAddressBlock').outerHTML`);
  check(!/btnShowAddAddressForm/.test(atCapHTML), 'the "+ Check Another Address" button is hidden once the 6-total cap is reached');
  check(/Maximum of 6 addresses reached/.test(atCapHTML) || /已达最多6个地址上限/.test(atCapHTML), 'a message explains the cap is reached and a slot must be freed first');

  // Remove one checked address directly - this frees a slot, so the add control reappears.
  const beforeRemoveCount = run(`activeUser().home.addresses.checked.length`);
  run(`document.querySelector('.btnRemoveCheckedAddress[data-idx="0"]').dispatchEvent(new window.Event('click', {bubbles:true}))`);
  check(run(`activeUser().home.addresses.checked.length`) === beforeRemoveCount - 1, 'removing a checked address reduces the list by exactly one');
  const afterRemoveHTML = run(`document.getElementById('homeAddressBlock').outerHTML`);
  check(/btnShowAddAddressForm/.test(afterRemoveHTML), 'removing an address below the cap makes the "+ Check Another Address" control reappear');

  // Now a new address can be added again, and it lands at the end of the list.
  addChecked('7', 'Seventh St', '777777');
  checked = run(`activeUser().home.addresses.checked`);
  check(checked.length === 5, `after freeing a slot and adding one more, the list is back at the 5-checked cap - got ${checked.length}`);
  check(checked[checked.length - 1].streetName === 'Seventh St', 'the newly added address is appended to the end of the list');

  // Promote the first checked address to become the Home Address - the previous Home Address (Home
  // St) should be pushed back into the checked list, not lost.
  const firstCheckedStreet = checked[0].streetName;
  run(`document.querySelector('.btnUseCheckedAsHome[data-idx="0"]').dispatchEvent(new window.Event('click', {bubbles:true}))`);
  const profAfterSwap = run(`activeUser().home.addresses.profile`);
  check(profAfterSwap.streetName === firstCheckedStreet, 'promoting a checked address makes it the new persistent Home Address');
  const checkedAfterSwap = run(`activeUser().home.addresses.checked`);
  check(checkedAfterSwap.some(a => a.streetName === 'Home St'), 'the previous Home Address is preserved by being pushed into the checked list, not discarded');
  check(checkedAfterSwap.length + 1 <= 6, `total addresses (profile + checked) never exceed 6 after a swap - got ${checkedAfterSwap.length + 1}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
