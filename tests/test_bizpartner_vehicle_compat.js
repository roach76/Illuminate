const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies item 8: "why does the profile data entry for business partner have vehicle plate number
// for life partner only? business partner should have compatibility score and deep analysis for their
// own mobile number and vehicle number". Business Partner ('b') now gets its own Vehicle Number Plate(s)
// section (scored against their own Day Master, no "shared" concept), and adding/removing a vehicle for
// 'b' persists correctly across a rebuildLegacySlotsFromPeople() call (u.businessPartner is a DERIVED
// copy - a real bug this round caught: mutating it directly without going through u.people would
// silently lose the vehicle on the next rebuild).
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
check(/if \(prefix !== 'i' && prefix !== 'p' && prefix !== 'b'\) return '';/.test(appSrc), 'renderVehiclesBlock now includes prefix \'b\' (Business Partner) in its scope');
check(/if \(prefix === 'p' \|\| prefix === 'b'\) \{\s*\n\s*ensurePeopleArray\(u\);\s*\n\s*const role = prefix === 'p' \? 'partner' : 'businessPartner';/.test(appSrc), 'btnAddVehicle routes both \'p\' and \'b\' through the safe u.people write-then-rebuild path');

const { dom, sandbox } = freshSandbox();
const STORAGE_KEY = 'illuminate-local-v101';
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  people: [
    { id: 'biz1', roles: ['businessPartner'], englishFirstName: 'Alex', englishLastName: 'Tan', birthdate: '1980-05-05', birthtime: '10:00', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, mobileNumber: '81234567' },
  ],
};
vm.runInContext(`
  state.users['test@test.com'] = ${JSON.stringify(testUser)};
  state.active = 'test@test.com';
  rebuildLegacySlotsFromPeople(activeUser());
`, sandbox);

const doc = dom.window.document;
vm.runInContext(`go('chart')`, sandbox);
const u1 = vm.runInContext('activeUser()', sandbox);
check(!!u1.businessPartner, 'business partner legacy slot exists after rebuild');

// Render the business partner's own chart page and confirm a Vehicle Number Plate(s) section appears.
vm.runInContext(`
  var __bp = getProfileByPrefix('b');
  var __bpP = getProfileData(__bp);
  var __vehHTML = renderVehiclesBlock('b', __bpP, __bp);
`, sandbox);
const vehHTML = vm.runInContext('__vehHTML', sandbox);
check(/Vehicle Number Plate/.test(vehHTML), 'Business Partner now gets a Vehicle Number Plate(s) section');
check(!/Shared address with Life Partner|Shared\b.*Life Partner/.test(vehHTML) || !/checkbox.*[Ss]hared/.test(vehHTML), 'no "Shared with Life Partner" checkbox is offered on the Business Partner\'s own vehicle row');

// Simulate adding a vehicle via the btnAddVehicle click handler, then force a rebuild (as would happen
// from an unrelated action elsewhere) to prove the write survives it.
const container = doc.createElement('div');
container.innerHTML = `<article class="reading">${vehHTML}</article>`;
doc.body.appendChild(container);
const input = container.querySelector('[id^="newVehicleInput_b"]');
input.value = 'SBA1234X';
const addBtn = container.querySelector('.btnAddVehicle[data-prefix="b"]');
addBtn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

vm.runInContext(`rebuildLegacySlotsFromPeople(activeUser());`, sandbox); // simulate an unrelated action elsewhere
const bp2 = vm.runInContext(`getProfileByPrefix('b')`, sandbox);
check(!!bp2.vehicles && bp2.vehicles.length === 1 && bp2.vehicles[0].number === 'SBA1234X', `the added vehicle survives an unrelated rebuildLegacySlotsFromPeople() call (real bug this round caught and fixed) - got ${JSON.stringify(bp2.vehicles)}`);

// Confirm the vehicle now gets its own compatibility score / deep analysis.
const dvHTML = vm.runInContext(`computeVehicleDeepAnalysisHTML('b', 0)`, sandbox);
check(/Vehicle Plate Deep Analysis/.test(dvHTML) && /SBA1234X/.test(dvHTML), 'the Business Partner\'s vehicle gets its own Deep Analysis, scored against their own Day Master');

// Confirm the Personal Assets summary row also now includes Vehicle Number Compatibility for 'b'.
const rowsB = vm.runInContext(`buildPersonalAssetsSummaryRows('b', __bpP, getProfileByPrefix('b'), activeUser())`, sandbox);
const vehRow = rowsB.find(r => /Vehicle Number Compatibility/.test(r.lines[0]));
check(!!vehRow && vehRow.ok, 'buildPersonalAssetsSummaryRows now includes a Vehicle Number Compatibility row for the Business Partner');
check(!!vehRow && vehRow.lines[1] === 'SBA1234X', 'that row shows the actual saved plate number');

// Confirm Mobile Number was already working for 'b' (sanity check, not a regression).
const mobRow = rowsB.find(r => /Mobile Number Compatibility/.test(r.lines[0]));
check(!!mobRow && mobRow.ok, 'Mobile Number Compatibility already worked correctly for Business Partner (sanity check)');

// Test btnRemoveVehicle survives a rebuild too.
const removeBtn = () => {
  const freshHTML = vm.runInContext(`renderVehiclesBlock('b', getProfileData(getProfileByPrefix('b')), getProfileByPrefix('b'))`, sandbox);
  container.innerHTML = freshHTML;
  return container.querySelector('.btnRemoveVehicle[data-prefix="b"]');
};
const rmBtn = removeBtn();
rmBtn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
vm.runInContext(`rebuildLegacySlotsFromPeople(activeUser());`, sandbox);
const bp3 = vm.runInContext(`getProfileByPrefix('b')`, sandbox);
check(!!bp3.vehicles && bp3.vehicles.length === 0, `removing the Business Partner's vehicle also survives a rebuild - got ${JSON.stringify(bp3.vehicles)}`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
