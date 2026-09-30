const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the LIVE UI flow for adding a household occupant with full data (name/birthdate/birthtime/
// gender), driving real DOM events against the real app code.
// UPDATED (reported: "household occupants should not be fixed... incorporate the household occupants
// into the add person option under people instead and remove the household occupants section"): the
// dedicated Account-page Household Occupants add/edit form this test used to drive (occ-name-i,
// occ-birthdate-i, etc., via renderAccountOccupantsList()) is gone. Occupants are now added exclusively
// through the flexible "People" screen's own Add/Edit form (renderPersonFieldsForm), tagging the
// person "Household Occupant" - this rewrite drives that real form/handler instead, keeping the same
// underlying assertions (a real full birthdate is stored, approximateBirth is false, year is derived,
// time is optional) since the data model (u.profile.bazhaiOccupants, via rebuildLegacySlotsFromPeople)
// is completely unchanged - only the UI that feeds it moved.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

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
  alert: () => {},
};
sandbox.global = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
function run(code) { return vm.runInContext(code, sandbox); }

let threw = null;
try {
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js'); loadFile('engine-predictions.js');
  loadFile('app.js'); loadFile('auth.js');
  run("initAuthListeners(); initListeners(); updateStaticLanguage();");

  run(`
    state.users['test@example.com'] = {
      name: 'test', email: 'test@example.com', password: 'x',
      profile: {
        englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
        birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
        birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
      },
      additionalBizPartners: [], children: [], home: {},
    };
    state.active = 'test@example.com';
    saveState();
  `);

  run("go('account');");
  check(run("document.querySelector('.view.active')?.id") === 'account', 'navigated to the account view');
  check(!run("document.getElementById('occ-birthdate-i')"), 'the OLD dedicated occupant-form Birth Date input (occ-birthdate-i) no longer renders anywhere - occupants are added through the People screen now');

  // Open the People screen's Add Person form and tag Household Occupant.
  run(`peopleAddFormOpen = true; renderPeopleManagementList();`);
  check(!!run("document.getElementById('pnew-d')"), 'the People screen\'s Add Person form (Birth Date field) is present');
  check(!!run("document.querySelector('.personRoleCheckbox[data-personid=\"pnew\"][data-role=\"occupant\"]')"), 'the Add Person form has a Household Occupant role checkbox');

  // Fill the form (name optional - only Birth Date is required for an occupant-only person) and save.
  run(`
    document.getElementById('pnew-ef').value = 'Grandma';
    document.getElementById('pnew-d').value = '1950-03-02';
    document.getElementById('pnew-t').value = '08:15';
    document.getElementById('pnew-g').value = 'female';
    document.querySelector('.personRoleCheckbox[data-personid="pnew"][data-role="occupant"]').checked = true;
    document.getElementById('btnPeopleSaveNewPerson').dispatchEvent(new window.Event('click', {bubbles:true}));
  `);
  const occ = run("state.users['test@example.com'].profile.bazhaiOccupants");
  check(Array.isArray(occ) && occ.length === 1, 'BUG-FREE FLOW VERIFIED: adding a person via the People screen, tagged Household Occupant, actually stores a new occupant in the legacy bazhaiOccupants roster (via rebuildLegacySlotsFromPeople)');
  check(occ[0].name === 'Grandma', 'the occupant\'s name was captured from the English First Name field');
  check(occ[0].birthdate === '1950-03-02', 'the occupant is stored with a real, full birthdate (not just a bare year)');
  check(occ[0].birthtime === '08:15', 'the occupant\'s birth time was captured');
  check(occ[0].year === 1950, 'the year field is still correctly derived from the birthdate for backward-compatible Kua computation');
  check(occ[0].approximateBirth === false, 'a real date entered through the live form is correctly marked as NOT approximate');
  check(occ[0].gender === 'female', 'gender was captured correctly');

  // Adding a second occupant WITHOUT a birth time or name still works (both optional for occupant-only).
  run(`
    peopleAddFormOpen = true; renderPeopleManagementList();
  `);
  run(`
    document.getElementById('pnew-d').value = '1985-11-20';
    document.querySelector('.personRoleCheckbox[data-personid="pnew"][data-role="occupant"]').checked = true;
    document.getElementById('btnPeopleSaveNewPerson').dispatchEvent(new window.Event('click', {bubbles:true}));
  `);
  const occ2 = run("state.users['test@example.com'].profile.bazhaiOccupants");
  check(occ2.length === 2, 'a second occupant with no name or birth time is still added successfully');
  check(occ2[1].birthdate === '1985-11-20' && occ2[1].birthtime === '' && occ2[1].approximateBirth === false, 'the name/time-omitted occupant has a real date, an empty (not missing) time and name, and is still correctly NOT flagged approximate');
  check(occ2[1].gender === 'male', 'gender silently defaults to male when not selected, matching the old dedicated form\'s own default');

  // Attempting to add an occupant-only person without a birthdate at all is correctly rejected.
  run(`peopleAddFormOpen = true; renderPeopleManagementList();`);
  run(`
    document.querySelector('.personRoleCheckbox[data-personid="pnew"][data-role="occupant"]').checked = true;
    document.getElementById('btnPeopleSaveNewPerson').dispatchEvent(new window.Event('click', {bubbles:true}));
  `);
  check(run("state.users['test@example.com'].profile.bazhaiOccupants.length") === 2, 'submitting the Add Person form with the Occupant role but no Birth Date at all is correctly rejected (still only 2 occupants)');

  // The rendered People list reflects the new occupants, tagged with the Household Occupant badge.
  run(`renderPeopleManagementList();`);
  const peopleListHTML = run("document.getElementById('peopleManagementList')?.innerHTML || ''");
  check(peopleListHTML.includes('Grandma'), 'the rendered People list shows the entered occupant name');
  check((peopleListHTML.match(/Household Occupant/g) || []).length >= 2, 'both occupants show the Household Occupant role badge in the People list');
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
