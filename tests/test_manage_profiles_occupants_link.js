const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// UPDATED (reported: "household occupants should not be fixed. it should be flexible and framed as
// add profile... incorporate the household occupants into the add person option under people instead
// and remove the household occupants section"): the standalone, fixed "Household Occupants" settings
// block this test used to verify (accountOccupantsSection / accountOccupantsList /
// renderAccountOccupantsList()) is gone. Adding/editing/removing a Household Occupant is now done
// exclusively through the flexible "People" screen (tag a person "Household Occupant"), which already
// wrote to the exact same underlying data (u.profile.bazhaiOccupants, via rebuildLegacySlotsFromPeople)
// before this round. This rewrite verifies: the old section/function are genuinely gone (not just
// unreferenced), the People screen's occupant role produces the same data, and the relaxed validation
// (only Birth Date required for an occupant-only person) works end-to-end.
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
const htmlSrc = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');

// --- Static: the standalone Account-page Household Occupants section is gone ---
check(!/function renderAccountOccupantsList\(\)/.test(appSrc), 'renderAccountOccupantsList() is removed');
check(!/<div class="settings" id="accountOccupantsSection">/.test(htmlSrc), 'index.html no longer has the accountOccupantsSection settings block (the id may still be mentioned in an explanatory HTML comment)');
check(!/id="accountOccupantsList"/.test(htmlSrc), 'index.html no longer has the accountOccupantsList container');
check(!/renderAccountOccupantsList\(\);/.test(appSrc), 'the old call site in go(\'account\') is removed too');
check(/id="peopleManagementSection"/.test(htmlSrc), 'the People settings block now has an id (peopleManagementSection) so links can jump straight to it');

// --- Static: the People screen already models Household Occupant as a role tag ---
check(/\{ role: 'occupant', en: 'Household Occupant', zh: '住户' \}/.test(appSrc), 'PEOPLE_ROLE_DEFS includes a Household Occupant role');

// --- Static: the Feng Shui tab's "Manage" button now jumps to the People section, pre-opens the Add
// form, and pre-checks the Occupant role, instead of scrolling to the removed section ---
const handlerStart = appSrc.indexOf("e.target.classList.contains('btnGoAccountOccupants')");
const handlerSlice = appSrc.slice(handlerStart, handlerStart + 800);
check(/peopleAddFormOpen = true/.test(handlerSlice), 'clicking the Feng Shui tab\'s Manage button opens the People "Add Person" form');
check(/pnew-role-occupant/.test(handlerSlice), 'clicking Manage pre-checks the Household Occupant role on the new-person form');
check(/peopleManagementSection/.test(handlerSlice), 'clicking Manage scrolls to the People section, not the removed Account-page section');

// --- Static: validatePersonFields relaxes requirements for an occupant-only person ---
check(/isOccupantOnly = Array\.isArray\(roles\) && roles\.length === 1 && roles\[0\] === 'occupant'/.test(appSrc), 'validatePersonFields computes an occupant-only flag');
check(/if \(!fields\.birthdate\) \{/.test(appSrc), 'Birth Date is checked first/unconditionally (the one thing still required for everyone, including occupant-only)');

// --- Behavioral: adding a person tagged ONLY "Household Occupant", with just a Birth Date and
// nothing else, succeeds and correctly ends up in u.profile.bazhaiOccupants via the People model. ---
vm.runInContext(`
  state = { users: {}, active: 'roy@test.com' };
  state.users['roy@test.com'] = {
    profile: {
      englishFirstName: 'Roy', englishLastName: 'Wong', gender: 'male',
      birthdate: '1976-09-07', birthtime: '09:33', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
    },
  };
  initListeners();
  go('account');
  peopleAddFormOpen = true; renderPeopleManagementList();
`, sandbox);

check(!!dom.window.document.getElementById('pnew-d'), 'the Add Person birth-date field is present');
vm.runInContext(`
  document.getElementById('pnew-d').value = '1950-01-01';
  document.querySelector('.personRoleCheckbox[data-personid="pnew"][data-role="occupant"]').checked = true;
  document.getElementById('btnPeopleSaveNewPerson').dispatchEvent(new window.Event('click', { bubbles: true }));
`, sandbox);

const occupants = vm.runInContext(`activeUser().profile.bazhaiOccupants`, sandbox);
check(Array.isArray(occupants) && occupants.length === 1, 'BUG-FREE FLOW VERIFIED: a person added via the People screen with ONLY the Household Occupant role, and no name/gender/country filled in, is accepted and appears in bazhaiOccupants');
check(occupants && occupants[0].birthdate === '1950-01-01', 'the occupant\'s birthdate was correctly captured');
check(occupants && occupants[0].gender === 'male', 'gender silently defaults (the People form\'s own default) rather than blocking submission');
const errText = dom.window.document.getElementById('pnew-error')?.textContent || '';
check(errText === '', 'no validation error was shown for the occupant-only submission missing name/country');

// --- Behavioral: submitting an occupant-only person with NO birthdate at all is still rejected ---
vm.runInContext(`peopleAddFormOpen = true; renderPeopleManagementList();`, sandbox);
vm.runInContext(`
  document.querySelector('.personRoleCheckbox[data-personid="pnew"][data-role="occupant"]').checked = true;
  document.getElementById('btnPeopleSaveNewPerson').dispatchEvent(new window.Event('click', { bubbles: true }));
`, sandbox);
const occupantsAfterBadSubmit = vm.runInContext(`activeUser().profile.bazhaiOccupants`, sandbox);
check(occupantsAfterBadSubmit.length === 1, 'submitting an occupant-only person with no Birth Date at all is correctly rejected (still only 1 occupant)');

// --- Behavioral: a person tagged an ADDITIONAL role alongside Occupant still needs the full fields ---
vm.runInContext(`peopleAddFormOpen = true; renderPeopleManagementList();`, sandbox);
vm.runInContext(`
  document.getElementById('pnew-d').value = '1990-01-01';
  document.querySelector('.personRoleCheckbox[data-personid="pnew"][data-role="occupant"]').checked = true;
  document.querySelector('.personRoleCheckbox[data-personid="pnew"][data-role="child"]').checked = true;
  document.getElementById('btnPeopleSaveNewPerson').dispatchEvent(new window.Event('click', { bubbles: true }));
`, sandbox);
const occupantsAfterMultiRole = vm.runInContext(`activeUser().profile.bazhaiOccupants`, sandbox);
check(occupantsAfterMultiRole.length === 1, 'a person tagged Occupant PLUS another role is still held to the full (strict) validation - name/gender/country required - so no new person/occupant was added with only a birthdate');

// --- Behavioral: renderManageProfilesList no longer includes a Household Occupants row ---
vm.runInContext(`renderManageProfilesList()`, sandbox);
const manageHtml = dom.window.document.getElementById('manageProfilesList').innerHTML;
check(!manageHtml.includes('Household Occupants'), 'the Manage Profiles hub has no separate Household Occupants row (occupants are managed entirely via the People screen)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
