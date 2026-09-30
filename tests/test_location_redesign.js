const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's birth-location redesign: the user no longer types a city or enters
// longitude/timezone manually anywhere in the app - they select a Birth Country (and, for a handful
// of genuinely multi-timezone countries, an optional city/region refinement), and the app derives and
// stores longitude/timezone/display-location itself, via the shared autoPopulateLonTz() helper wired
// into the delegated 'change' listener in initListeners().
//
// Covers all 5 static intake forms (self/individual, Partner, Business Partner, 2nd Business Partner,
// Child), the People-screen unified Add/Edit form (renderPersonFieldsForm/readPersonFieldsFromForm),
// the profile-summary Longitude/Timezone display tile, and round-tripping an existing profile back
// through its edit form (prefillMainProfileForm/prefillPartnerForm) so re-opening without changing
// anything preserves the saved values exactly.
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
    alert: () => {}, requestAnimationFrame: (fn) => setTimeout(fn, 0),
    html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}; } }),
  };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js');
  load('app.js'); load('auth.js');
  vm.runInContext("initAuthListeners(); initListeners(); updateStaticLanguage();", sandbox);
  return sandbox;
}
function setVal(sandbox, id, val) {
  const el = sandbox.document.getElementById(id);
  if (!el) throw new Error('element not found: ' + id);
  el.value = val;
}
function fire(sandbox, id, type) {
  const el = sandbox.document.getElementById(id);
  if (!el) throw new Error('element not found: ' + id);
  el.dispatchEvent(new sandbox.window.Event(type, { bubbles: true, cancelable: true }));
}

const sandbox = buildSandbox();
vm.runInContext(`state = { users: {}, active: 'roy@test.com' }; state.users['roy@test.com'] = { profile: {} }; saveState();`, sandbox);

// --- HTML structure regression: no city text input, no manual lon/tz number input remain on any of ---
// --- the 5 static forms; the old "Use" button is gone entirely. ---
const indexSrc = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
check(!/btnUseCountry/.test(indexSrc), 'the old "Use" button markup is fully removed from index.html');
['birth', 'partner', 'biz', 'biz2', 'child'].forEach(p => {
  check(new RegExp(`<select id="${p}CountrySelect"`).test(indexSrc), `${p}: Birth Country select exists`);
  check(new RegExp(`<input type="hidden" id="${p}Longitude"`).test(indexSrc), `${p}: Longitude is now a hidden field, not manually entered`);
  check(new RegExp(`<input type="hidden" id="${p}Timezone"`).test(indexSrc), `${p}: Timezone is now a hidden field, not manually entered`);
});
check(!/app\.js/.test('') && !fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8').includes("classList.contains('btnUseCountry')"), 'the old btnUseCountry click handler is fully removed from app.js (dead code cleaned up, not just unreachable)');

// --- Behavioral: selecting a plain single-timezone country (Singapore) on the main intake form ---
// --- auto-populates hidden lon/tz/location and does NOT show the city refinement row. ---
setVal(sandbox, 'englishFirstName', 'Roy'); setVal(sandbox, 'englishLastName', 'Wong');
setVal(sandbox, 'gender', 'male'); setVal(sandbox, 'birthdate', '1976-09-07'); setVal(sandbox, 'birthtime', '09:33');
sandbox.document.getElementById('birthCountrySelect').value = 'Singapore';
fire(sandbox, 'birthCountrySelect', 'change');
check(sandbox.document.getElementById('birthLongitude').value === '103.82', 'selecting Singapore auto-populates the hidden Longitude field correctly');
check(sandbox.document.getElementById('birthTimezone').value === '8', 'selecting Singapore auto-populates the hidden Timezone field correctly');
check(sandbox.document.getElementById('birthLocation').value === 'Singapore', 'selecting Singapore auto-populates the hidden Location field correctly');
check(sandbox.document.getElementById('birthCityWrap').style.display === 'none', 'Singapore (single time zone) does NOT show the city/region refinement row');

// UPDATED (reported this round: "house number/block, street name, city, country, postal code should
// be mandatory" - street name added in the latest round): #saveProfile now blocks the save entirely
// unless those 5 structured address fields are filled in (see ADDRESS_MANDATORY_FIELDS in app.js) -
// filling them in here so this test's Save click still succeeds, exactly as it always did before that
// requirement existed.
setVal(sandbox, 'intakeHouseNumber', '1'); setVal(sandbox, 'intakeStreetName', 'Orchard Road'); setVal(sandbox, 'intakeCity', 'Singapore');
setVal(sandbox, 'intakeCountry', 'Singapore'); setVal(sandbox, 'intakePostalCode', '238859');
fire(sandbox, 'saveProfile', 'click');
let u = vm.runInContext('activeUser()', sandbox);
check(u.profile.birthLongitude === 103.82 && u.profile.birthTimezone === 8, 'the saved profile carries the auto-derived longitude/timezone');

// --- Behavioral: selecting a genuinely multi-timezone country (United States) on the Partner form ---
// --- shows the city dropdown, and picking a specific city overrides the country default. ---
setVal(sandbox, 'partnerEnglishFirstName', 'Tina'); setVal(sandbox, 'partnerEnglishLastName', 'Seah');
setVal(sandbox, 'partnerGender', 'female'); setVal(sandbox, 'partnerDate', '1976-04-25'); setVal(sandbox, 'partnerTime', '10:21');
sandbox.document.getElementById('partnerCountrySelect').value = 'United States';
fire(sandbox, 'partnerCountrySelect', 'change');
check(sandbox.document.getElementById('partnerCityWrap').style.display === 'block', 'a genuinely multi-timezone country (United States) DOES show the city/region refinement row');
const usCityOptions = Array.from(sandbox.document.getElementById('partnerCitySelect').options).filter(o => o.value !== '');
check(usCityOptions.length > 0, 'the city dropdown is populated with real city/region options for the United States');
sandbox.document.getElementById('partnerCitySelect').value = usCityOptions[usCityOptions.length - 1].value;
fire(sandbox, 'partnerCitySelect', 'change');
const cityDerivedLon = sandbox.document.getElementById('partnerLongitude').value;
sandbox.document.getElementById('partnerCitySelect').value = '';
fire(sandbox, 'partnerCitySelect', 'change');
const countryDerivedLon = sandbox.document.getElementById('partnerLongitude').value;
check(cityDerivedLon !== countryDerivedLon, 'choosing a specific city yields a different (more precise) longitude than the country default, and clearing the city reverts to the country default');
// Re-select the city before saving, so the compat calculation below gets the more precise values.
sandbox.document.getElementById('partnerCitySelect').value = usCityOptions[usCityOptions.length - 1].value;
fire(sandbox, 'partnerCitySelect', 'change');
fire(sandbox, 'btnCalculateCompat', 'click');
u = vm.runInContext('activeUser()', sandbox);
check(u.partner && u.partner.englishFirstName === 'Tina' && typeof u.partner.birthLongitude === 'number', 'the partner profile was saved with a real, auto-derived longitude (city-level precision)');

// --- Behavioral: the profile-summary overview tile displays the auto-derived Longitude/Timezone ---
// --- (this is the new read-only display the redesign asked for). ---
// UPDATED (this round, reported: "Summary cards has an empty spot beside the longitude/timezone. Move
// this information to be part of the gregorian birth summary card"): Longitude/Timezone is no longer
// its own standalone overview tile (which left an empty grid slot beside it) - it's now folded into the
// Gregorian Birth tile as a 3rd line, so this test now checks for the value there instead of a separate
// "Longitude / Timezone" labelled tile.
vm.runInContext("go('chart'); switchChartTab('i','core'); renderAllViews();", sandbox);
const overviewHTML = vm.runInContext("document.getElementById('chart').innerHTML", sandbox);
check(new RegExp(`103\\.82`).test(overviewHTML), 'the profile summary\'s Gregorian Birth tile shows the correct auto-derived longitude value');
check(/Gregorian Birth[\s\S]{0,200}103\.82/.test(overviewHTML) || /阳历出生[\s\S]{0,200}103\.82/.test(overviewHTML),
  'the longitude/timezone value is folded into the Gregorian Birth tile itself, not a separate tile');

// --- Round-trip: re-opening the main profile edit form after saving preselects the same country and ---
// --- keeps the same hidden values, so re-saving without changing anything is a no-op. ---
vm.runInContext('prefillMainProfileForm()', sandbox);
check(sandbox.document.getElementById('birthCountrySelect').value === 'Singapore', 'prefillMainProfileForm() correctly reselects the Birth Country dropdown from the saved profile');
check(sandbox.document.getElementById('birthLongitude').value === '103.82', 'prefillMainProfileForm() correctly restores the hidden Longitude value');
fire(sandbox, 'saveProfile', 'click');
u = vm.runInContext('activeUser()', sandbox);
check(u.profile.birthLongitude === 103.82 && u.profile.birthTimezone === 8, 're-saving the intake form after a plain re-open (no changes) round-trips the same longitude/timezone exactly');

// --- People-screen unified form: same auto-populate behavior, via renderPersonFieldsForm's country ---
// --- select (a differently-prefixed id, proving the shared helper generalizes beyond the 5 fixed ids). ---
vm.runInContext(`peopleAddFormOpen = true; renderPeopleManagementList();`, sandbox);
check(!!sandbox.document.getElementById('pnewCountrySelect'), 'the People-screen Add form has a Birth Country select (not a free-text city input)');
check(!sandbox.document.getElementById('pnew-loc') && !sandbox.document.getElementById('pnew-lon') && !sandbox.document.getElementById('pnew-tz'), 'the People-screen Add form no longer has the old free-text city / manual longitude / manual timezone inputs');
setVal(sandbox, 'pnew-ef', 'Zoe'); setVal(sandbox, 'pnew-el', 'Ong'); setVal(sandbox, 'pnew-g', 'female'); setVal(sandbox, 'pnew-d', '1995-02-02');
sandbox.document.getElementById('pnewCountrySelect').value = 'Malaysia';
fire(sandbox, 'pnewCountrySelect', 'change');
check(sandbox.document.getElementById('pnewLongitude').value !== '' && sandbox.document.getElementById('pnewLongitude').value !== '103.82', 'selecting a different country (Malaysia) on the People-screen form auto-populates a distinct longitude');
const occCheckbox = sandbox.document.querySelector(`.personRoleCheckbox[data-personid="pnew"][data-role="occupant"]`);
occCheckbox.checked = true;
fire(sandbox, 'btnPeopleSaveNewPerson', 'click');
u = vm.runInContext('activeUser()', sandbox);
const zoe = u.people.find(p => p.englishFirstName === 'Zoe');
check(!!zoe && typeof zoe.birthLongitude === 'number' && zoe.birthLocation === 'Malaysia', 'Zoe was saved via the People screen with her country-derived location/longitude');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
