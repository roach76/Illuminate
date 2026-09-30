const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's items 3 & 5:
// 3) "For address details, house number/block, city, country, postal code should be mandatory"
// 5) "Address input missing home facing direction"
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
const htmlSrc = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');

// --- Static checks ---
check(/const ADDRESS_MANDATORY_FIELDS = \['houseNumber', 'city', 'country', 'postalCode'\];/.test(appSrc), 'ADDRESS_MANDATORY_FIELDS is defined with the 4 requested fields');
check(/function isAddressComplete\(a\)/.test(appSrc), 'isAddressComplete helper exists');
check(/House Number \/ Block \*/.test(htmlSrc), 'Intake House Number is marked required with *');
check(/City \*/.test(htmlSrc) && /Country \*/.test(htmlSrc) && /Postal Code \*/.test(htmlSrc), 'Intake City/Country/Postal Code are marked required with *');
check(/Street Name \(Optional\)/.test(htmlSrc), 'Intake Street Name stays optional');
check(/id="intakeFsDir"/.test(htmlSrc), 'Intake page now has a Home Facing Direction select');
check(/id="fs-dir-i-addr"/.test(appSrc), 'the persistent Home Address block now has its own Home Facing Direction select');

// --- Behavioral: Intake Save is blocked without the 4 mandatory address fields ---
{
  const { dom, sandbox } = freshSandbox();
  vm.runInContext(`
    state.users['newuser@test.com'] = {};
    state.active = 'newuser@test.com';
    go('intake');
  `, sandbox);
  vm.runInContext(`
    document.getElementById('englishLastName').value = 'Wong';
    document.getElementById('englishFirstName').value = 'Roy';
    document.getElementById('gender').value = 'male';
    document.getElementById('birthdate').value = '1976-09-07';
    document.getElementById('birthtime').value = '09:33';
    document.getElementById('birthLongitude').value = '103.8198';
    document.getElementById('birthTimezone').value = '8';
    // Deliberately leave all address fields blank.
    document.getElementById('saveProfile').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sandbox);
  const profileExists = vm.runInContext(`!!(activeUser() && activeUser().profile)`, sandbox);
  check(!profileExists, 'saving Intake with the 4 mandatory address fields blank is blocked - no profile is created');
  const errText = dom.window.document.getElementById('profileError').textContent;
  check(errText.includes('House Number') && errText.includes('City') && errText.includes('Country') && errText.includes('Postal Code'), 'a clear error message names all 4 missing mandatory address fields: "' + errText + '"');
}

// --- Behavioral: Intake Save succeeds once the 4 mandatory fields (+ optional facing direction) are filled ---
{
  const { dom, sandbox } = freshSandbox();
  vm.runInContext(`
    state.users['newuser2@test.com'] = {};
    state.active = 'newuser2@test.com';
    go('intake');
  `, sandbox);
  vm.runInContext(`
    document.getElementById('englishLastName').value = 'Wong';
    document.getElementById('englishFirstName').value = 'Roy';
    document.getElementById('gender').value = 'male';
    document.getElementById('birthdate').value = '1976-09-07';
    document.getElementById('birthtime').value = '09:33';
    document.getElementById('birthLongitude').value = '103.8198';
    document.getElementById('birthTimezone').value = '8';
    document.getElementById('intakeHouseNumber').value = '123';
    document.getElementById('intakeCity').value = 'Singapore';
    document.getElementById('intakeCountry').value = 'Singapore';
    document.getElementById('intakePostalCode').value = '238859';
    document.getElementById('intakeFsDir').value = 'Southeast';
    document.getElementById('saveProfile').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sandbox);
  const prof = vm.runInContext(`activeUser() && activeUser().profile`, sandbox);
  check(!!prof, 'saving Intake with all 4 mandatory address fields filled succeeds - profile is created');
  check(prof && prof.fsDir === 'Southeast', 'the optional Home Facing Direction picked on Intake is saved onto profile.fsDir');
  const addr = vm.runInContext(`activeUser().home.addresses.profile`, sandbox);
  check(addr && addr.houseNumber === '123' && addr.city === 'Singapore' && addr.country === 'Singapore' && addr.postalCode === '238859', 'the structured address was saved correctly');

  // Re-opening Intake to edit prefills the facing direction too.
  vm.runInContext(`prefillMainProfileForm();`, sandbox);
  check(dom.window.document.getElementById('intakeFsDir').value === 'Southeast', 'prefillMainProfileForm restores the previously-saved Home Facing Direction into intakeFsDir on re-edit');
}

// --- Behavioral: the persistent Home Address block (Account/Feng Shui page) gates analysis on
// completeness, shows a reminder while incomplete, and the two Home Facing Direction selects
// (Ba Zhai Compass School's original one, and the new one in the address block) stay in sync. ---
{
  const { dom, sandbox } = freshSandbox();
  vm.runInContext(`
    state.users['roy@test.com'] = {
      profile: {
        englishFirstName: 'Roy', englishLastName: 'Wong', gender: 'male',
        birthdate: '1976-09-07', birthtime: '09:33', birthLocation: 'Singapore',
        birthLongitude: 103.8198, birthTimezone: 8,
      },
      home: {},
    };
    state.active = 'roy@test.com';
    go('chart');
    // Feng Shui/the Home Address block lives on the Environment tab, which is lazily swapped into
    // #chartTabPanel_i only once clicked (only the Core tab is pre-rendered) - click it first.
    document.querySelector('.chartTabBtn[data-prefix="i"][data-tab="environment"]').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sandbox);

  // Fill only 2 of the 4 mandatory address fields via the live homeAddr inputs.
  vm.runInContext(`
    document.getElementById('homeAddrHouseNumber').value = '123';
    document.getElementById('homeAddrHouseNumber').dispatchEvent(new window.Event('change', {bubbles:true}));
    document.getElementById('homeAddrCity').value = 'Singapore';
    document.getElementById('homeAddrCity').dispatchEvent(new window.Event('change', {bubbles:true}));
  `, sandbox);
  let reminderHTML = dom.window.document.getElementById('homeAddressMandatoryReminder').innerHTML;
  check(reminderHTML.includes('Country') && reminderHTML.includes('Postal Code'), 'an incomplete address (2 of 4 mandatory fields filled) shows a live reminder naming the still-missing fields: ' + reminderHTML);
  let resultHTML = dom.window.document.getElementById('homeAddressResult').innerHTML;
  check(resultHTML.trim() === '', 'Address Compatibility analysis does NOT run yet while the address is incomplete');

  // Fill the remaining 2 mandatory fields.
  vm.runInContext(`
    document.getElementById('homeAddrCountry').value = 'Singapore';
    document.getElementById('homeAddrCountry').dispatchEvent(new window.Event('change', {bubbles:true}));
    document.getElementById('homeAddrPostalCode').value = '238859';
    document.getElementById('homeAddrPostalCode').dispatchEvent(new window.Event('change', {bubbles:true}));
  `, sandbox);
  reminderHTML = dom.window.document.getElementById('homeAddressMandatoryReminder').innerHTML;
  check(reminderHTML.trim() === '', 'once all 4 mandatory fields are filled, the reminder clears');
  resultHTML = dom.window.document.getElementById('homeAddressResult').innerHTML;
  check(resultHTML.trim() !== '', 'Address Compatibility analysis now runs once the address is complete');

  // The two Home Facing Direction selects (Ba Zhai's original, and the new one in the address block)
  // both exist and changing either one updates prof.fsDir and keeps the OTHER select's displayed value
  // in sync immediately (not just on next full render).
  check(!!dom.window.document.getElementById('fs-dir-i'), 'the original Ba Zhai Compass School facing-direction select still exists');
  check(!!dom.window.document.getElementById('fs-dir-i-addr'), 'the new address-block facing-direction select exists');
  vm.runInContext(`
    const sel = document.getElementById('fs-dir-i-addr');
    sel.value = 'West';
    sel.dispatchEvent(new window.Event('change', {bubbles:true}));
  `, sandbox);
  check(vm.runInContext(`activeUser().profile.fsDir`, sandbox) === 'West', 'changing the NEW address-block select updates profile.fsDir');
  check(dom.window.document.getElementById('fs-dir-i').value === 'West', 'the ORIGINAL Ba Zhai select is immediately kept in sync after changing the new one');

  vm.runInContext(`
    const sel2 = document.getElementById('fs-dir-i');
    sel2.value = 'East';
    sel2.dispatchEvent(new window.Event('change', {bubbles:true}));
  `, sandbox);
  check(vm.runInContext(`activeUser().profile.fsDir`, sandbox) === 'East', 'changing the ORIGINAL Ba Zhai select updates profile.fsDir');
  check(dom.window.document.getElementById('fs-dir-i-addr').value === 'East', 'the NEW address-block select is immediately kept in sync after changing the original one');
}

// --- Behavioral: "Check Another Address" is blocked when incomplete, accepted when complete ---
{
  const { dom, sandbox } = freshSandbox();
  vm.runInContext(`
    state.users['roy2@test.com'] = {
      profile: {
        englishFirstName: 'Roy', englishLastName: 'Wong', gender: 'male',
        birthdate: '1976-09-07', birthtime: '09:33', birthLocation: 'Singapore',
        birthLongitude: 103.8198, birthTimezone: 8,
      },
      home: { addresses: { profile: { houseNumber: '1', streetName: '', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '111111', constructionYear: '' }, checked: [] } },
    };
    state.active = 'roy2@test.com';
    go('chart');
    document.querySelector('.chartTabBtn[data-prefix="i"][data-tab="environment"]').dispatchEvent(new window.Event('click', {bubbles:true}));
    const formDiv = document.getElementById('addAddressForm');
    if (formDiv) formDiv.classList.remove('hidden');
  `, sandbox);
  vm.runInContext(`
    document.getElementById('newAddrHouseNumber').value = '456';
    // Deliberately leave City/Country/Postal Code blank.
    document.querySelector('.btnConfirmAddAddress').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sandbox);
  let checkedCount = vm.runInContext(`activeUser().home.addresses.checked.length`, sandbox);
  check(checkedCount === 0, 'submitting "Check Another Address" with mandatory fields missing is blocked - not added to the checked list');
  let newAddrErr = dom.window.document.getElementById('newAddrError').textContent;
  check(newAddrErr.length > 0, 'an error message is shown for the incomplete "Check Another Address" submission: "' + newAddrErr + '"');

  vm.runInContext(`
    document.getElementById('newAddrCity').value = 'Singapore';
    document.getElementById('newAddrCountry').value = 'Singapore';
    document.getElementById('newAddrPostalCode').value = '654321';
    document.querySelector('.btnConfirmAddAddress').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sandbox);
  checkedCount = vm.runInContext(`activeUser().home.addresses.checked.length`, sandbox);
  check(checkedCount === 1, 'submitting "Check Another Address" once all 4 mandatory fields are filled succeeds');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
