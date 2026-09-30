const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the biggest architectural change of this round: replacing the fixed profile "slots" (Life
// Partner / Business Partner / Household Occupant / Child) with a single unified list, u.people, where
// ONE real person can carry MULTIPLE role tags at once.
//
// Covers:
// 1. rebuildLegacySlotsFromPeople() (engine-core.js) called directly against a hand-built u.people
//    array, including a multi-role person correctly appearing in BOTH relevant legacy slots.
// 2. migratePeopleFromLegacy() / migratePeopleForAllUsers() - several realistic pre-migration account
//    shapes, confirming u.people + regenerated legacy fields match the originals exactly, and that
//    running migration twice is a guaranteed no-op.
// 3. The "only one Life Partner" rule (block, not auto-swap) via app.js's checkOnlyOnePartnerRule.
// 4. End-to-end regression: a fully-migrated account still renders a real chart via
//    renderSystemChart/buildProfilePdfHTML for the 'p' and 'b' prefixes exactly as before.
// 5. The new People management screen (Add/Edit/Remove person, role checkboxes) via delegated
//    click/change handlers, driven through jsdom exactly like the existing UI test suite.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function buildHeadlessSandbox() {
  // Headless (no DOM) sandbox for testing the pure data functions (rebuild/migration) in isolation,
  // matching the established pattern from test_phase2_household_compat.js.
  const storage = {};
  const localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
  };
  const sandbox = {
    localStorage, console, navigator: { language: 'en-US' },
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    alert: () => {}, document: { createElement: () => ({ style: {}, appendChild(){}, querySelectorAll: () => [] }) },
    html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}; } }),
  };
  sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js'); loadFile('engine-predictions.js');
  return sandbox;
}

function buildDomSandbox() {
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
  function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js'); loadFile('engine-predictions.js');
  loadFile('app.js'); loadFile('auth.js');
  vm.runInContext("initAuthListeners(); initListeners(); updateStaticLanguage();", sandbox);
  return sandbox;
}

const PROFILE = {
  englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
  birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
  birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8
};

// ----------------------------------------------------------------------------
// 1. rebuildLegacySlotsFromPeople() direct unit tests
// ----------------------------------------------------------------------------
(function testRebuildBasic() {
  const sb = buildHeadlessSandbox();
  const u = { profile: Object.assign({}, PROFILE), people: [
    { id: 'p1', roles: ['partner'], englishFirstName: 'Amy', englishLastName: 'Tan', gender: 'female', birthdate: '1980-01-01', birthtime: '10:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8, vehicles: [{number:'SBA123',shared:false}] },
    { id: 'p2', roles: ['businessPartner'], englishFirstName: 'Ben', englishLastName: 'Lee', gender: 'male', birthdate: '1982-02-02', birthtime: '11:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
    { id: 'p3', roles: ['businessPartner'], englishFirstName: 'Cara', englishLastName: 'Ng', gender: 'female', birthdate: '1983-03-03', birthtime: '12:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
    { id: 'p4', roles: ['child'], englishFirstName: 'Danny', englishLastName: 'Wong', gender: 'male', birthdate: '2010-04-04', birthtime: '13:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
    { id: 'p5', roles: ['occupant'], name: 'Grandma', year: 1950, birthdate: '1950-05-05', birthtime: '', gender: 'female', approximateBirth: false },
  ] };
  vm.runInContext('rebuildLegacySlotsFromPeople', sb); // just confirms function exists (throws ReferenceError otherwise)
  sb.__u = u;
  vm.runInContext('rebuildLegacySlotsFromPeople(__u);', sb);

  check(u.partner && u.partner.englishFirstName === 'Amy', 'u.partner regenerated from the partner-tagged person');
  check(Array.isArray(u.partner.vehicles) && u.partner.vehicles.length === 1 && u.partner.vehicles[0].number === 'SBA123', 'u.partner keeps its vehicles field');
  check(u.businessPartner && u.businessPartner.englishFirstName === 'Ben', 'u.businessPartner is the FIRST businessPartner-tagged person (in u.people order)');
  check(Array.isArray(u.additionalBizPartners) && u.additionalBizPartners.length === 1 && u.additionalBizPartners[0].englishFirstName === 'Cara', 'u.additionalBizPartners holds every OTHER businessPartner-tagged person');
  check(Array.isArray(u.children) && u.children.length === 1 && u.children[0].englishFirstName === 'Danny', 'u.children regenerated correctly');
  check(Array.isArray(u.profile.bazhaiOccupants) && u.profile.bazhaiOccupants.length === 1 && u.profile.bazhaiOccupants[0].name === 'Grandma', 'u.profile.bazhaiOccupants regenerated correctly, in the old {name,birthdate,birthtime,gender,approximateBirth} shape');
  check(u.businessPartner.vehicles === undefined, 'businessPartner legacy record does NOT get a vehicles field (scoping preserved: only profile + partner)');
})();

(function testRebuildMultiRolePerson() {
  const sb = buildHeadlessSandbox();
  const u = { profile: Object.assign({}, PROFILE), people: [
    { id: 'p1', roles: ['partner', 'businessPartner'], englishFirstName: 'Amy', englishLastName: 'Tan', gender: 'female', birthdate: '1980-01-01', birthtime: '10:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8, vehicles: [] },
  ] };
  sb.__u = u;
  vm.runInContext('rebuildLegacySlotsFromPeople(__u);', sb);
  check(u.partner && u.partner.englishFirstName === 'Amy', 'multi-role person appears as u.partner');
  check(u.businessPartner && u.businessPartner.englishFirstName === 'Amy', 'the SAME multi-role person also appears as u.businessPartner (independent copy)');
  check(u.partner !== u.businessPartner, 'the two legacy copies are independent objects, not the same reference');
  u.partner.englishFirstName = 'MUTATED';
  check(u.businessPartner.englishFirstName === 'Amy', 'mutating one regenerated copy does not affect the other');
})();

(function testRebuildIdempotent() {
  const sb = buildHeadlessSandbox();
  const u = { profile: Object.assign({}, PROFILE), people: [
    { id: 'p1', roles: ['partner'], englishFirstName: 'Amy', englishLastName: 'Tan', gender: 'female', birthdate: '1980-01-01', birthtime: '10:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
  ] };
  sb.__u = u;
  vm.runInContext('rebuildLegacySlotsFromPeople(__u); const first = JSON.stringify(__u.partner); rebuildLegacySlotsFromPeople(__u); const second = JSON.stringify(__u.partner); __result = (first === second);', sb);
  check(sb.__result === true, 'rebuildLegacySlotsFromPeople is idempotent - calling it repeatedly produces the same output');
})();

// ----------------------------------------------------------------------------
// 2. migratePeopleFromLegacy() - several realistic pre-migration shapes
// ----------------------------------------------------------------------------
(function testMigrationFullAccount() {
  const sb = buildHeadlessSandbox();
  const original = {
    profile: Object.assign({}, PROFILE, { bazhaiOccupants: [
      { name: 'Grandma', year: 1950, birthdate: '1950-05-05', birthtime: '', gender: 'female', approximateBirth: false },
      { name: '', year: 1945, birthdate: '1945-01-01', birthtime: '', gender: 'male', approximateBirth: true },
    ] }),
    partner: { englishFirstName: 'Amy', englishLastName: 'Tan', chineseFirstName: '', chineseLastName: '', gender: 'female', birthdate: '1980-01-01', birthtime: '10:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8, mobileNumber: '91234567', vehicles: [{ number: 'SBA123', shared: false }] },
    businessPartner: { englishFirstName: 'Ben', englishLastName: 'Lee', gender: 'male', birthdate: '1982-02-02', birthtime: '11:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
    additionalBizPartners: [
      { englishFirstName: 'Cara', englishLastName: 'Ng', gender: 'female', birthdate: '1983-03-03', birthtime: '12:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
    ],
    children: [
      { englishFirstName: 'Danny', englishLastName: 'Wong', gender: 'male', birthdate: '2010-04-04', birthtime: '13:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
    ],
    home: { address: '1 Test Ave', constructionYear: 2000 },
  };
  const preMigrationSnapshot = JSON.parse(JSON.stringify(original));
  const u = JSON.parse(JSON.stringify(original));
  sb.__u = u;
  vm.runInContext('__migrated1 = migratePeopleFromLegacy(__u);', sb);
  check(sb.__migrated1 === true, 'migratePeopleFromLegacy() reports it migrated a legacy account');
  check(Array.isArray(u.people) && u.people.length === 6, 'u.people has one entry per legacy person (partner + core biz + 1 additional biz + 1 child + 2 occupants)');

  // Byte-for-byte equivalence: regenerated legacy fields must match the pre-migration originals exactly.
  check(JSON.stringify(u.partner) === JSON.stringify(preMigrationSnapshot.partner), 'regenerated u.partner is byte-for-byte identical to the pre-migration original');
  check(JSON.stringify(u.businessPartner) === JSON.stringify(preMigrationSnapshot.businessPartner), 'regenerated u.businessPartner is byte-for-byte identical to the pre-migration original');
  check(JSON.stringify(u.additionalBizPartners) === JSON.stringify(preMigrationSnapshot.additionalBizPartners), 'regenerated u.additionalBizPartners is byte-for-byte identical to the pre-migration original');
  check(JSON.stringify(u.children) === JSON.stringify(preMigrationSnapshot.children), 'regenerated u.children is byte-for-byte identical to the pre-migration original');
  check(JSON.stringify(u.profile.bazhaiOccupants) === JSON.stringify(preMigrationSnapshot.profile.bazhaiOccupants), 'regenerated u.profile.bazhaiOccupants is byte-for-byte identical to the pre-migration original');
  check(JSON.stringify(u.home) === JSON.stringify(preMigrationSnapshot.home), 'u.home is left completely untouched by migration');

  // Idempotent: running migration again must be a no-op.
  const afterFirstMigration = JSON.parse(JSON.stringify(u));
  sb.__u = u;
  vm.runInContext('__migrated2 = migratePeopleFromLegacy(__u);', sb);
  check(sb.__migrated2 === false, 'running migration a second time is a no-op (returns false)');
  check(JSON.stringify(u) === JSON.stringify(afterFirstMigration), 'running migration a second time changes nothing at all');
})();

(function testMigrationPartnerOnly() {
  const sb = buildHeadlessSandbox();
  const u = { profile: Object.assign({}, PROFILE), partner: { englishFirstName: 'Amy', englishLastName: 'Tan', gender: 'female', birthdate: '1980-01-01', birthtime: '10:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 } };
  sb.__u = u;
  vm.runInContext('migratePeopleFromLegacy(__u);', sb);
  check(u.people.length === 1 && u.people[0].roles.length === 1 && u.people[0].roles[0] === 'partner', 'partner-only account migrates to a single partner-tagged person');
  check(u.businessPartner === null, 'no businessPartner conjured out of nothing');
  check(Array.isArray(u.children) && u.children.length === 0, 'no children conjured out of nothing');
})();

(function testMigrationNoLegacyData() {
  const sb = buildHeadlessSandbox();
  const u = { profile: Object.assign({}, PROFILE) }; // brand-new account, nothing added yet
  sb.__u = u;
  vm.runInContext('__migrated = migratePeopleFromLegacy(__u);', sb);
  check(sb.__migrated === false, 'an account with no legacy data at all is not migrated (nothing to do)');
  check(u.people === undefined, 'u.people is left unset until the first person is actually added');
})();

(function testMigrationAlreadyHasPeople() {
  const sb = buildHeadlessSandbox();
  const u = { profile: Object.assign({}, PROFILE), people: [{ id: 'x', roles: ['child'], englishFirstName: 'Already', englishLastName: 'Migrated', gender: 'male', birthdate: '2015-01-01' }], partner: { englishFirstName: 'ShouldBeIgnored' } };
  sb.__u = u;
  vm.runInContext('__migrated = migratePeopleFromLegacy(__u);', sb);
  check(sb.__migrated === false, 'an account that already has u.people is skipped entirely, even if stray legacy fields are also present');
  check(u.people.length === 1 && u.people[0].englishFirstName === 'Already', 'existing u.people is left completely untouched');
})();

// ----------------------------------------------------------------------------
// 3. checkOnlyOnePartnerRule (app.js) - the "only one Life Partner" BLOCK rule
// ----------------------------------------------------------------------------
(function testOnlyOnePartnerRuleBlocks() {
  const sb = buildDomSandbox();
  sb.__u = { people: [
    { id: 'p1', roles: ['partner'], englishFirstName: 'Amy', englishLastName: 'Tan' },
    { id: 'p2', roles: ['businessPartner'], englishFirstName: 'Ben', englishLastName: 'Lee' },
  ] };
  vm.runInContext("__msg = checkOnlyOnePartnerRule(__u, ['partner'], 'p2');", sb);
  check(typeof sb.__msg === 'string' && sb.__msg.includes('Amy'), 'tagging a second person partner while one is already tagged is BLOCKED, naming the existing person');
  vm.runInContext("__msg2 = checkOnlyOnePartnerRule(__u, ['partner'], 'p1');", sb);
  check(sb.__msg2 === null, 're-saving the SAME person who already holds the partner tag is not blocked');
  vm.runInContext("__msg3 = checkOnlyOnePartnerRule(__u, ['businessPartner'], 'p2');", sb);
  check(sb.__msg3 === null, 'tagging someone with a non-partner role is never blocked by this rule');
})();

// ----------------------------------------------------------------------------
// 4. End-to-end regression: fully-migrated account still renders real charts via the untouched
//    prefix-based engine (renderSystemChart / buildProfilePdfHTML) for 'p' and 'b'.
// ----------------------------------------------------------------------------
(function testEndToEndChartsStillWork() {
  const sb = buildDomSandbox();
  vm.runInContext(`
    state.users['e2e@example.com'] = {
      name: 'e2e', email: 'e2e@example.com', password: 'x',
      profile: { englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
        birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
        birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      partner: { englishFirstName: 'Amy', englishLastName: 'Tan', gender: 'female', birthdate: '1980-01-01', birthtime: '10:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      businessPartner: { englishFirstName: 'Ben', englishLastName: 'Lee', gender: 'male', birthdate: '1982-02-02', birthtime: '11:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      additionalBizPartners: [], children: [], home: {},
    };
    state.active = 'e2e@example.com';
    saveState();
    __migrated = migratePeopleFromLegacy(state.users['e2e@example.com']);
  `, sb);
  check(sb.__migrated === true, 'the fresh account above (with legacy fields, no u.people yet) gets migrated');
  vm.runInContext(`
    const u = state.users['e2e@example.com'];
    const p = getProfileData();
    const partnerP = getProfileData(getProfileByPrefix('p'));
    const bizP = getProfileData(getProfileByPrefix('b'));
    __crP = calculateTrueCompatibility(p, partnerP, false);
    __crB = calculateTrueCompatibility(p, bizP, true);
    __chartP = renderSystemChart(partnerP, 'p', __crP, false, p);
    __chartB = renderSystemChart(bizP, 'b', __crB, true, p);
    __pdfP = buildProfilePdfHTML('p');
    __pdfB = buildProfilePdfHTML('b');
  `, sb);
  check(typeof sb.__chartP === 'string' && sb.__chartP.length > 500, "renderSystemChart('p') produces a real, substantial chart from the migrated/derived u.partner");
  check(typeof sb.__chartB === 'string' && sb.__chartB.length > 500, "renderSystemChart('b') produces a real, substantial chart from the migrated/derived u.businessPartner");
  check(sb.__chartP.includes('Amy'), "the 'p' chart genuinely reflects Amy's data (not a placeholder)");
  check(sb.__chartB.includes('Ben'), "the 'b' chart genuinely reflects Ben's data (not a placeholder)");
  check(typeof sb.__pdfP === 'string' && sb.__pdfP.length > 500, "buildProfilePdfHTML('p') still produces real PDF content for the migrated partner");
  check(typeof sb.__pdfB === 'string' && sb.__pdfB.length > 500, "buildProfilePdfHTML('b') still produces real PDF content for the migrated business partner");
})();

// ----------------------------------------------------------------------------
// 5. New People management screen UI (add / edit / role checkboxes / remove) via jsdom
// ----------------------------------------------------------------------------
(function testPeopleScreenUI() {
  const sb = buildDomSandbox();
  vm.runInContext(`
    state.users['ui@example.com'] = {
      name: 'ui', email: 'ui@example.com', password: 'x',
      profile: { englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
        birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
        birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      partner: null, businessPartner: null, additionalBizPartners: [], children: [], home: {},
    };
    state.active = 'ui@example.com';
    saveState();
    go('account');
  `, sb);
  let listHTML = vm.runInContext("document.getElementById('peopleManagementList').innerHTML", sb);
  check(listHTML.includes('No additional people added yet') || listHTML.includes('尚未添加'), 'People screen shows the empty state before anyone is added');
  check(listHTML.includes('btnPeopleAddPersonToggle'), 'People screen shows the Add Person button');

  // Open the Add form and fill it in as a multi-role person (Life Partner AND Business Partner).
  vm.runInContext("document.getElementById('btnPeopleAddPersonToggle').dispatchEvent(new window.Event('click', {bubbles:true}));", sb);
  vm.runInContext(`
    document.getElementById('pnew-ef').value = 'Amy';
    document.getElementById('pnew-el').value = 'Tan';
    document.getElementById('pnew-g').value = 'female';
    document.getElementById('pnew-d').value = '1980-01-01';
    document.getElementById('pnewCountrySelect').value = 'Singapore';
    document.getElementById('pnewCountrySelect').dispatchEvent(new window.Event('change', {bubbles:true}));
    document.querySelector('.personRoleCheckbox[data-personid="pnew"][data-role="partner"]').checked = true;
    document.querySelector('.personRoleCheckbox[data-personid="pnew"][data-role="businessPartner"]').checked = true;
    document.getElementById('btnPeopleSaveNewPerson').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sb);
  const u1 = vm.runInContext("state.users['ui@example.com']", sb);
  check(Array.isArray(u1.people) && u1.people.length === 1, 'a new multi-role person was added to u.people');
  check(u1.people[0].roles.includes('partner') && u1.people[0].roles.includes('businessPartner'), 'the new person carries BOTH role tags at once');
  check(u1.partner && u1.partner.englishFirstName === 'Amy', 'u.partner was correctly regenerated after the Add');
  check(u1.businessPartner && u1.businessPartner.englishFirstName === 'Amy', 'u.businessPartner was ALSO correctly regenerated (same person, both slots)');

  listHTML = vm.runInContext("document.getElementById('peopleManagementList').innerHTML", sb);
  check(listHTML.includes('Amy') && listHTML.includes('Life Partner') && listHTML.includes('Business Partner'), 'the list row shows the person\'s name with BOTH role badges');

  // Try to add a SECOND person also tagged partner - must be blocked.
  vm.runInContext("document.getElementById('btnPeopleAddPersonToggle').dispatchEvent(new window.Event('click', {bubbles:true}));", sb);
  vm.runInContext(`
    document.getElementById('pnew-ef').value = 'Zara';
    document.getElementById('pnew-el').value = 'Lim';
    document.getElementById('pnew-g').value = 'female';
    document.getElementById('pnew-d').value = '1990-01-01';
    document.getElementById('pnewCountrySelect').value = 'Singapore';
    document.getElementById('pnewCountrySelect').dispatchEvent(new window.Event('change', {bubbles:true}));
    document.querySelector('.personRoleCheckbox[data-personid="pnew"][data-role="partner"]').checked = true;
    document.getElementById('btnPeopleSaveNewPerson').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sb);
  const u2 = vm.runInContext("state.users['ui@example.com']", sb);
  check(u2.people.length === 1, 'the second Life-Partner-tagged person was BLOCKED from being added - still only 1 person total');
  check(u2.partner.englishFirstName === 'Amy', 'the original Life Partner (Amy) is untouched by the blocked attempt');
  const errText = vm.runInContext("document.getElementById('pnew-error').textContent", sb);
  check(typeof errText === 'string' && errText.length > 0, 'a clear error message is shown explaining the block');

  // Edit the existing person - untag businessPartner, keep partner - via the Edit form.
  vm.runInContext("document.querySelector('.btnPeopleEditPerson').dispatchEvent(new window.Event('click', {bubbles:true}));", sb);
  const personId = u2.people[0].id;
  vm.runInContext(`
    document.querySelector('.personRoleCheckbox[data-personid="pedit-${personId}"][data-role="businessPartner"]').checked = false;
    document.querySelector('.btnPeopleSavePersonEdit').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sb);
  const u3 = vm.runInContext("state.users['ui@example.com']", sb);
  check(u3.people[0].roles.includes('partner') && !u3.people[0].roles.includes('businessPartner'), 'editing role checkboxes correctly untags businessPartner while keeping partner');
  check(u3.businessPartner === null, 'u.businessPartner is correctly regenerated to null after the tag was removed');
  check(u3.partner && u3.partner.englishFirstName === 'Amy', 'u.partner is unaffected by removing a DIFFERENT role tag from the same person');

  // Remove the person entirely.
  vm.runInContext("document.querySelector('.btnPeopleRemovePerson').dispatchEvent(new window.Event('click', {bubbles:true}));", sb);
  const u4 = vm.runInContext("state.users['ui@example.com']", sb);
  check(u4.people.length === 0, 'Remove deletes the whole person from u.people');
  check(u4.partner === null, 'u.partner correctly regenerated to null after the person was removed');
})();

// ----------------------------------------------------------------------------
// 6. Existing legacy mutation points (Add Child, Add additional Business Partner, Remove Partner,
//    vehicles) still work AND correctly keep u.people in sync (so a later People-screen edit doesn't
//    silently discard data entered through the old forms).
// ----------------------------------------------------------------------------
(function testLegacyPathsSyncIntoPeople() {
  const sb = buildDomSandbox();
  vm.runInContext(`
    state.users['legacy@example.com'] = {
      name: 'legacy', email: 'legacy@example.com', password: 'x',
      profile: { englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
        birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
        birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      partner: null, businessPartner: null, additionalBizPartners: [], children: [], home: {},
    };
    state.active = 'legacy@example.com';
    saveState();
    go('account');
  `, sb);

  // Add a Life Partner through the OLD compat form / btnCalculateCompat handler.
  vm.runInContext(`
    go('home');
    document.querySelector('[data-go="compat"]')?.dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sb);
  vm.runInContext(`
    document.getElementById('partnerEnglishFirstName').value = 'Amy';
    document.getElementById('partnerEnglishLastName').value = 'Tan';
    document.getElementById('partnerGender').value = 'female';
    document.getElementById('partnerDate').value = '1980-01-01';
    document.getElementById('partnerTime').value = '10:00';
    document.getElementById('partnerLongitude').value = '103.82';
    document.getElementById('partnerTimezone').value = '8';
    document.getElementById('btnCalculateCompat').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sb);
  let u = vm.runInContext("state.users['legacy@example.com']", sb);
  check(Array.isArray(u.people) && u.people.length === 1 && u.people[0].roles.includes('partner'), 'adding a Life Partner via the OLD form correctly creates a partner-tagged u.people entry');
  check(u.partner && u.partner.englishFirstName === 'Amy', 'u.partner still comes out correctly via the old form');

  // Add a vehicle to the partner via the OLD Personal Assets vehicle form (prefix 'p').
  vm.runInContext(`
    go('account');
    const u2 = state.users['legacy@example.com'];
  `, sb);
  vm.runInContext(`
    const person = findPersonByRole(state.users['legacy@example.com'], 'partner', 0);
    person.vehicles = person.vehicles || [];
    rebuildLegacySlotsFromPeople(state.users['legacy@example.com']);
  `, sb);
  // Simulate the vehicle-add click handler path directly (constructing the minimal DOM it reads).
  vm.runInContext(`
    const input = document.createElement('input'); input.id = 'newVehicleInput_p'; input.value = 'SBA123';
    document.body.appendChild(input);
    const btn = document.createElement('button'); btn.className = 'btnAddVehicle'; btn.dataset.prefix = 'p';
    document.body.appendChild(btn);
    btn.dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sb);
  u = vm.runInContext("state.users['legacy@example.com']", sb);
  const personAfterVehicle = u.people.find(p => p.roles.includes('partner'));
  check(personAfterVehicle && Array.isArray(personAfterVehicle.vehicles) && personAfterVehicle.vehicles.some(v => v.number === 'SBA123'), 'adding a vehicle via the OLD vehicle-add handler is written into the underlying u.people entry, not just the soon-to-be-overwritten derived u.partner');
  check(u.partner.vehicles.some(v => v.number === 'SBA123'), 'u.partner still reflects the added vehicle after regeneration');

  // Now edit this same person through the NEW People screen - the vehicle must survive, since it's
  // stored on the underlying u.people entry, not lost by the regeneration.
  vm.runInContext(`
    document.querySelector('.btnPeopleEditPerson').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sb);
  const pid = u.people[0].id;
  vm.runInContext(`
    document.getElementById('pedit-${pid}-mobile').value = '98765432';
    document.querySelector('.btnPeopleSavePersonEdit').dispatchEvent(new window.Event('click', {bubbles:true}));
  `, sb);
  u = vm.runInContext("state.users['legacy@example.com']", sb);
  check(u.partner.mobileNumber === '98765432', 'editing via the NEW People screen after an OLD-form vehicle add applies the new edit');
  check(u.partner.vehicles.some(v => v.number === 'SBA123'), 'the vehicle added earlier through the OLD handler SURVIVES a subsequent edit via the NEW People screen (proves u.people, not the derived copy, is the true source of truth)');

  // Removing the primary partner via the OLD "btnRemovePartner" button wires directly to
  // syncLegacyRemoveByRole (see app.js) - invoked here directly rather than re-running initListeners
  // a second time (not safe to call twice - it would double-bind every delegated handler).
  vm.runInContext(`
    syncLegacyRemoveByRole(state.users['legacy@example.com'], 'partner', 0);
  `, sb);
  u = vm.runInContext("state.users['legacy@example.com']", sb);
  check(u.partner === null, 'removing the primary partner role via syncLegacyRemoveByRole correctly nulls out u.partner');
  check(u.people.length === 0, 'the person (who only had the partner role) is fully removed from u.people once their only role is stripped');
})();

console.log(`\ntest_multirole_people_model.js: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
