const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Personal Assets (Mobile Number, Vehicle Number) can now be entered directly on the
// data-collection (intake) forms - the user's own request - rather than only later, in the separate
// Personal Assets section of each profile's dashboard. Drives the REAL DOM event handlers end-to-end
// via jsdom, for: the main individual intake form, the Life Partner form, the core Business Partner
// form, the additional Business Partner form, the Child form, and the newer unified People screen.
//
// Also covers 3 specific risks introduced by this change:
//  1. Editing an existing profile via the intake form must not silently blank out Mobile Number/Vehicle
//     already on file (the form replaces the whole profile object) - prefill + merge-not-overwrite.
//  2. The SAME bug pattern, coincidentally found and fixed in the SAME line of code: editing the main
//     intake form was dropping `profile.bazhaiOccupants` (household occupants) entirely.
//  3. Vehicle Number scope (individual + Life Partner only) must still be respected everywhere,
//     including the new People screen's unified Add/Edit form.
process.on('unhandledRejection', () => {});
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function buildSandbox() {
  const html = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/' });
  dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
  const storage = {};
  const localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
  };
  const sandbox = {
    document: dom.window.document, window: dom.window, localStorage, console,
    navigator: { language: 'en-US' },
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL, html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){} }} }),
    alert: () => {}, confirm: () => true,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function load(file) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, file), 'utf8'), sandbox, { filename: file }); }
  load('engine-core.js');
  load('engine-metaphysics.js');
  load('engine-predictions.js');
  load('app.js');
  load('auth.js');
  vm.runInContext("initAuthListeners(); initListeners(); updateStaticLanguage();", sandbox);
  return { dom, sandbox };
}

function fire(sandbox, id, type) {
  const el = sandbox.document.getElementById(id);
  if (!el) throw new Error('element not found: ' + id);
  const ev = new sandbox.window.Event(type, { bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
}
function setVal(sandbox, id, val) {
  const el = sandbox.document.getElementById(id);
  if (!el) throw new Error('element not found: ' + id);
  el.value = val;
}

// --- Set up a signed-in account with an existing profile (so we can test the edit/prefill path) ---
const { sandbox } = buildSandbox();
vm.runInContext(`
  state = { users: {}, active: 'roy@test.com' };
  state.users['roy@test.com'] = { profile: {
    englishFirstName: 'Roy', englishLastName: 'Wong', chineseFirstName: '', chineseLastName: '',
    gender: 'male', birthdate: '1976-09-07', birthtime: '09:33', birthLocation: 'Singapore',
    birthLongitude: 103.8198, birthTimezone: 8,
    mobileNumber: '91234567', vehicles: [{ number: 'SJL1234A', shared: false }],
    bazhaiOccupants: [{ name: 'Grandma', year: 1945, birthdate: '1945-06-15', birthtime: '', gender: 'female', approximateBirth: true }]
  },
  // UPDATED (reported this round: "house number/block, city, country, postal code should be
  // mandatory"): #saveProfile now blocks the save entirely unless those 4 fields are filled - giving
  // this test profile a complete address up front so prefillMainProfileForm() populates the intake
  // address fields and every re-save below (which never touches them) keeps passing that gate, exactly
  // as it always did before that requirement existed.
  home: { addresses: { profile: { houseNumber: '1', streetName: 'Test Ave', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '111111', constructionYear: '' }, checked: [] } }
  };
`, sandbox);

// --- Test 1: prefillMainProfileForm populates the new Mobile/Vehicle fields from the existing profile ---
vm.runInContext(`prefillMainProfileForm()`, sandbox);
const prefilledMobile = sandbox.document.getElementById('intakeMobileNumber').value;
const prefilledVehicle = sandbox.document.getElementById('intakeVehicleNumber').value;
check(prefilledMobile === '91234567', 'prefillMainProfileForm() correctly prefills the new intake Mobile Number field from the existing profile, so re-saving does not blank it');
check(prefilledVehicle === 'SJL1234A', 'prefillMainProfileForm() correctly prefills the new intake Vehicle field when there is exactly one existing vehicle');

// --- Test 2: re-saving the intake form WITHOUT touching Mobile/Vehicle preserves both, AND preserves
// bazhaiOccupants (the incidental bug fix) ---
fire(sandbox, 'saveProfile', 'click');
let u = vm.runInContext(`activeUser()`, sandbox);
check(u.profile.mobileNumber === '91234567', 'Mobile Number survives an intake re-save when the prefilled field is left untouched');
check(Array.isArray(u.profile.vehicles) && u.profile.vehicles.length === 1 && u.profile.vehicles[0].number === 'SJL1234A', 'Existing Vehicle survives an intake re-save when the prefilled field is left untouched (not duplicated either)');
check(Array.isArray(u.profile.bazhaiOccupants) && u.profile.bazhaiOccupants.length === 1 && u.profile.bazhaiOccupants[0].name === 'Grandma', 'BUG FIX VERIFIED: household occupants (profile.bazhaiOccupants) survive an intake re-save - previously silently dropped by this same handler');

// --- Test 3: entering a genuinely NEW mobile number and vehicle plate on intake updates/appends
// correctly, without duplicating the existing vehicle ---
setVal(sandbox, 'intakeMobileNumber', '98765432');
setVal(sandbox, 'intakeVehicleNumber', 'SBA999Z');
fire(sandbox, 'saveProfile', 'click');
u = vm.runInContext(`activeUser()`, sandbox);
check(u.profile.mobileNumber === '98765432', 'A newly-entered Mobile Number on intake is correctly saved');
check(u.profile.vehicles.length === 2 && u.profile.vehicles.some(v => v.number === 'SBA999Z') && u.profile.vehicles.some(v => v.number === 'SJL1234A'), 'A newly-entered Vehicle plate on intake is APPENDED (not replacing) the existing one');
setVal(sandbox, 'intakeVehicleNumber', 'SBA999Z'); // re-enter the SAME plate just added
fire(sandbox, 'saveProfile', 'click');
u = vm.runInContext(`activeUser()`, sandbox);
check(u.profile.vehicles.length === 2, 'Re-entering an already-saved plate does not create a duplicate');

// --- Test 4: Life Partner form (#compat) - Mobile + Vehicle collected, with the same prefill/merge
// safety, going through the multi-role People bridge (syncLegacyPrimaryToPeople) ---
setVal(sandbox, 'partnerEnglishFirstName', 'Tina');
setVal(sandbox, 'partnerEnglishLastName', 'Seah');
setVal(sandbox, 'partnerGender', 'female');
setVal(sandbox, 'partnerDate', '1976-04-25');
setVal(sandbox, 'partnerTime', '10:21');
setVal(sandbox, 'partnerMobileNumber', '81112222');
setVal(sandbox, 'partnerVehicleNumber', 'SGX4321B');
fire(sandbox, 'btnCalculateCompat', 'click');
u = vm.runInContext(`activeUser()`, sandbox);
check(u.partner && u.partner.mobileNumber === '81112222', 'Life Partner Mobile Number is saved through the intake-style form, regenerated correctly into the legacy u.partner view');
check(u.partner && Array.isArray(u.partner.vehicles) && u.partner.vehicles.length === 1 && u.partner.vehicles[0].number === 'SGX4321B', 'Life Partner Vehicle Number is saved and appears on u.partner');
check(vm.runInContext(`activeUser().people.find(p => p.roles.includes('partner')).vehicles.length`, sandbox) === 1, 'the underlying u.people entry (true source of truth) also has the vehicle, not just the regenerated legacy view');
// Re-open the edit form (prefill) and re-save without changes - must not duplicate or blank anything
vm.runInContext(`prefillPartnerForm('p')`, sandbox);
check(sandbox.document.getElementById('partnerMobileNumber').value === '81112222', 'Re-opening the Life Partner edit form correctly prefills Mobile Number from what was just saved');
check(sandbox.document.getElementById('partnerVehicleNumber').value === 'SGX4321B', 'Re-opening the Life Partner edit form correctly prefills the Vehicle field');
fire(sandbox, 'btnCalculateCompat', 'click');
u = vm.runInContext(`activeUser()`, sandbox);
check(u.partner.vehicles.length === 1, 'Re-saving the Life Partner form unchanged does not duplicate the vehicle');

// --- Test 5: Business Partner form (#businessTab) - Mobile collected, but NO vehicle field exists
// at all (scope: individual + Life Partner only) ---
check(!sandbox.document.getElementById('bizVehicleNumber'), 'the core Business Partner form correctly has NO vehicle field (out of scope)');
setVal(sandbox, 'bizEnglishFirstName', 'Ben');
setVal(sandbox, 'bizEnglishLastName', 'Neo');
setVal(sandbox, 'bizGender', 'male');
setVal(sandbox, 'bizDate', '1980-01-01');
setVal(sandbox, 'bizTime', '08:00');
setVal(sandbox, 'bizMobileNumber', '82223333');
fire(sandbox, 'btnCalculateBiz', 'click');
u = vm.runInContext(`activeUser()`, sandbox);
check(u.businessPartner && u.businessPartner.mobileNumber === '82223333', 'Business Partner Mobile Number is saved correctly');
check(u.businessPartner.vehicles === undefined || u.businessPartner.vehicles.length === 0, 'Business Partner never gets a vehicle, even though the shared applyVehiclePlateIfPartner-style scoping logic exists elsewhere');

// --- Test 6: Child form - Mobile collected, no vehicle field ---
check(!sandbox.document.getElementById('childVehicleNumber'), 'the Child form correctly has NO vehicle field (out of scope)');
setVal(sandbox, 'childEnglishFirstName', 'Danny');
setVal(sandbox, 'childEnglishLastName', 'Wong');
setVal(sandbox, 'childGender', 'male');
setVal(sandbox, 'childDate', '2010-05-05');
setVal(sandbox, 'childTime', '12:00');
setVal(sandbox, 'childMobileNumber', '83334444');
fire(sandbox, 'btnAddChild', 'click');
u = vm.runInContext(`activeUser()`, sandbox);
check(Array.isArray(u.children) && u.children.length === 1 && u.children[0].mobileNumber === '83334444', 'Child Mobile Number is saved correctly via the Child form');

// --- Test 7: additional (2nd) Business Partner form - Mobile collected ---
setVal(sandbox, 'biz2EnglishFirstName', 'Cara');
setVal(sandbox, 'biz2EnglishLastName', 'Lim');
setVal(sandbox, 'biz2Gender', 'female');
setVal(sandbox, 'biz2Date', '1985-03-03');
setVal(sandbox, 'biz2Time', '09:00');
setVal(sandbox, 'biz2MobileNumber', '84445555');
fire(sandbox, 'btnAddBizPartner2', 'click');
u = vm.runInContext(`activeUser()`, sandbox);
check(Array.isArray(u.additionalBizPartners) && u.additionalBizPartners.length === 1 && u.additionalBizPartners[0].mobileNumber === '84445555', 'Additional (2nd) Business Partner Mobile Number is saved correctly');

// --- Test 8: the newer unified People screen's Add form also has a scoped Vehicle field, gated by
// the 'partner' role checkbox at save time (applyVehiclePlateIfPartner) ---
vm.runInContext(`peopleAddFormOpen = true; renderPeopleManagementList();`, sandbox);
setVal(sandbox, 'pnew-ef', 'Amy');
setVal(sandbox, 'pnew-el', 'Tan');
setVal(sandbox, 'pnew-g', 'female');
setVal(sandbox, 'pnew-d', '1990-01-01');
setVal(sandbox, 'pnew-mobile', '85556666');
setVal(sandbox, 'pnew-vehicle', 'SMK7777C');
// REDESIGN (this round): birth location is now a required Birth Country selection (auto-deriving
// longitude/timezone) rather than free-text/manual entry - select one so validatePersonFields' new
// "was a country actually chosen" check passes.
sandbox.document.getElementById('pnewCountrySelect').value = 'Singapore';
fire(sandbox, 'pnewCountrySelect', 'change');
// Tag her Business Partner ONLY (not partner) - vehicle SHOULD now be applied (UPDATED this round,
// reported: "why does the profile data entry for business partner have vehicle plate number for life
// partner only? business partner should have compatibility score and deep analysis for their own
// mobile number and vehicle number" - Vehicle Number scope widened to include Business Partner).
const bizCheckbox = sandbox.document.querySelector(`.personRoleCheckbox[data-personid="pnew"][data-role="businessPartner"]`);
bizCheckbox.checked = true;
fire(sandbox, 'btnPeopleSaveNewPerson', 'click');
u = vm.runInContext(`activeUser()`, sandbox);
let amy = u.people.find(p => p.englishFirstName === 'Amy');
check(!!amy, 'Amy was added to u.people via the People screen');
check(amy.mobileNumber === '85556666', "Amy's Mobile Number is saved regardless of role (mobile applies to every profile type)");
check(!!amy.vehicles && amy.vehicles.length === 1 && amy.vehicles[0].number === 'SMK7777C', "Amy's Vehicle plate IS now applied because Business Partner is in scope for Vehicle Number (widened this round)");

// Now edit Amy to ALSO tag her partner, keeping the same vehicle field value - vehicle SHOULD now apply.
// Tina (added in Test 4) currently holds the Life Partner tag, so free it first - otherwise the
// block-not-swap rule correctly refuses to also tag Amy, which would be a false failure of THIS test,
// not a bug (that rule is exactly what test_multirole_people_model.js verifies in isolation).
vm.runInContext(`syncLegacyRemoveByRole(activeUser(), 'partner', 0)`, sandbox);
vm.runInContext(`peopleEditingId = ${JSON.stringify(amy.id)}; renderPeopleManagementList();`, sandbox);
const formPrefix = `pedit-${amy.id}`;
setVal(sandbox, `${formPrefix}-vehicle`, 'SMK7777C');
const partnerCheckbox = sandbox.document.querySelector(`.personRoleCheckbox[data-personid="${formPrefix}"][data-role="partner"]`);
partnerCheckbox.checked = true;
const editBtn = sandbox.document.querySelector(`.btnPeopleSavePersonEdit[data-personid="${amy.id}"]`);
editBtn.dispatchEvent(new sandbox.window.Event('click', { bubbles: true }));
u = vm.runInContext(`activeUser()`, sandbox);
amy = u.people.find(p => p.id === amy.id);
check(amy.roles.includes('partner') && amy.roles.includes('businessPartner'), 'Amy now correctly carries BOTH role tags (true multi-tagging, confirmed still working alongside this change)');
check(Array.isArray(amy.vehicles) && amy.vehicles.length === 1 && amy.vehicles[0].number === 'SMK7777C', 'Once Amy is tagged partner, her Vehicle plate from the form IS now applied');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
