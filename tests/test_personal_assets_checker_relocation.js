const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's items 1 & 2:
// 1) "personal assets to show the numbers and address in the summary pages"
// 2) "Move the mobile number and vehicle plate checker into the personal assets section. They should
//    not reside in the landing page"
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

// --- Static: the checker/generator tool is gone from the Home page HTML ---
check(!/id="currentVehicleInput"/.test(htmlSrc), 'the old fixed-id #currentVehicleInput is gone from index.html');
check(!/id="currentMobileInput"/.test(htmlSrc), 'the old fixed-id #currentMobileInput is gone from index.html');
check(!/id="regenVehicleBtn"/.test(htmlSrc), 'the old fixed-id #regenVehicleBtn is gone from index.html');
check(!/id="regenMobileBtn"/.test(htmlSrc), 'the old fixed-id #regenMobileBtn is gone from index.html');
check(/Metaphysical Suggestions/.test(htmlSrc) && /fourDContainer/.test(htmlSrc), 'the Metaphysical Suggestions header and 4D/TOTO sections remain on the Home page');
check(/function renderNumberCheckerGeneratorBlock/.test(appSrc), 'renderNumberCheckerGeneratorBlock exists in app.js');
check(/\$\{renderNumberCheckerGeneratorBlock\(prefix, p, prof\)\}/.test(appSrc), 'the Checker & Generator block is wired into artPersonalAssets');

// --- Behavioral: the checker/generator now renders inside a profile's own Personal Assets section,
// with prefix-scoped element ids, and the Home page HTML has none of the old ids at all ---
{
  const { dom, sandbox } = freshSandbox();
  const testUser = {
    email: 'test@test.com', password: 'x',
    profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, mobileNumber: '91234567' },
    partner: { englishFirstName: 'Tina', englishLastName: 'Seah', birthdate: '1976-04-25', birthtime: '10:21', gender: 'female' },
    home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
  };
  vm.runInContext(`
    state.users['test@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test@test.com';
  `, sandbox);
  vm.runInContext(`go('chart')`, sandbox);
  const doc = dom.window.document;
  // Personal Assets lives in the "More" tab, which (per this app's lazy tab-content architecture) is
  // only swapped into the DOM once its tab button is actually clicked.
  doc.querySelector('.chartTabBtn[data-prefix="i"][data-tab="more"]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  check(!!doc.getElementById('currentVehicleInput_i'), 'the main profile chart has a prefix-scoped currentVehicleInput_i field');
  check(!!doc.getElementById('currentMobileInput_i'), 'the main profile chart has a prefix-scoped currentMobileInput_i field');
  check(!!doc.querySelector('.btnRegenVehicle[data-prefix="i"]'), 'the main profile chart has a prefix-scoped Regenerate Vehicle button');
  check(!!doc.querySelector('.btnRegenMobile[data-prefix="i"]'), 'the main profile chart has a prefix-scoped Regenerate Mobile button');

  // Check This Plate, scoped to the main profile
  doc.getElementById('currentVehicleInput_i').value = 'SBA1234A';
  doc.querySelector('.btnCheckVehicle[data-prefix="i"]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  const vBox = doc.getElementById('currentVehicleAuditResult_i');
  check(vBox && vBox.style.display === 'block' && /SBA1234A/.test(vBox.innerHTML), 'clicking Check This Plate for prefix i scores and displays a result in the prefix-scoped result box');

  // Regenerate, scoped to the main profile
  doc.querySelector('.btnRegenVehicle[data-prefix="i"]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  check(doc.getElementById('vehicleNumberDisplay_i').textContent !== '---', 'clicking Regenerate for prefix i fills in a generated plate number');

  // Life Partner view: scoring should use the PARTNER's own Day Master, not silently the main profile's
  vm.runInContext(`go('partnerView')`, sandbox);
  doc.querySelector('.chartTabBtn[data-prefix="p"][data-tab="more"]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  check(!!doc.getElementById('currentMobileInput_p'), "the Life Partner chart has its own prefix-scoped currentMobileInput_p field, independent of the main profile's");
  doc.getElementById('currentMobileInput_p').value = '98765432';
  doc.querySelector('.btnCheckMobile[data-prefix="p"]').dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  const mBoxP = doc.getElementById('currentMobileAuditResult_p');
  check(mBoxP && mBoxP.style.display === 'block' && /98765432/.test(mBoxP.innerHTML), "checking a mobile number on the Life Partner's own Personal Assets section scores correctly and independently of the main profile");
}

// --- Behavioral: buildPersonalAssetsSummaryRows now includes the actual saved value, not just the score ---
{
  const { dom, sandbox } = freshSandbox();
  const testUser = {
    email: 'test2@test.com', password: 'x',
    profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, mobileNumber: '91234567', vehicles: [{ number: 'SBA1234A', shared: false }] },
    home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
  };
  vm.runInContext(`
    state.users['test2@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test2@test.com';
  `, sandbox);
  const rows = vm.runInContext(`
    (function(){
      const u = activeUser();
      syncLegacyHomeFields(ensureHomeAddressModel(u) && u);
      const p = getProfileData();
      return buildPersonalAssetsSummaryRows('i', p, u.profile, u);
    })()
  `, sandbox);
  // NOTE: rows are now { ok, lines: [percentLine, ...valueLines] } (see
  // test_assets_summary_reformat_and_shared_vehicle.js for the full format spec) - this block just
  // re-confirms the values these rows carry are still the real saved ones after that reformat.
  const mobileRow = rows.find(r => /Mobile Number Compatibility/.test(r.lines[0]));
  const vehicleRow = rows.find(r => /Vehicle Number Compatibility/.test(r.lines[0]));
  const addrRow = rows.find(r => /Address Compatibility/.test(r.lines[0]));
  check(mobileRow && mobileRow.lines[1] === '91234567', `Mobile Number summary row includes the actual saved number - got "${mobileRow && mobileRow.lines[1]}"`);
  check(mobileRow && /\d+%/.test(mobileRow.lines[0]), 'Mobile Number summary row still includes the score');
  check(vehicleRow && vehicleRow.lines[1] === 'SBA1234A', `Vehicle Number summary row includes the actual saved plate - got "${vehicleRow && vehicleRow.lines[1]}"`);
  check(addrRow && addrRow.lines[1] === '92 Flora Road', `Address Compatibility summary row includes the actual saved address - got "${addrRow && addrRow.lines[1]}"`);
  check(addrRow && /\d+%/.test(addrRow.lines[0]), 'Address Compatibility summary row still includes the score');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
