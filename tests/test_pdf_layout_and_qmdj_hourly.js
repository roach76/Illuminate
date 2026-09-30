const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's fixes/enhancements, confirmed against the user's own real 84-page PDF export:
//  1) Vehicle "Shared with Life Partner" checkbox now exists on BOTH intake-level vehicle fields
//     (individual + Life Partner), matching the existing Personal Assets section's Shared checkbox.
//  2) Home Address / Construction Year now collected on the main intake page too, writing to the SAME
//     u.home record the Feng Shui section already reads/writes (single source of truth).
//  3) Household Occupants section now carries a wayfinding note pointing to the People screen.
//  4) The BaZi 4-pillar grid (and any other grid/flex-row layout) is no longer split into separate,
//     full-width capture units during PDF export - the root cause of "bazi chart too big, should be
//     4 boxes side by side" confirmed by reading captureChunksIntoPdf's own expansion logic.
//  5) The oversized-unit pixel-slice path no longer force-flushes a fresh page after its LAST slice
//     when that slice doesn't fill the page - the root cause of the near-blank PDF pages confirmed
//     directly in the user's own real export (pages 80/81/83).
//  6) The per-unit PDF capture loop now wraps its capture in try/finally, so a failed capture can no
//     longer leave a cloned secContainer (and its duplicate-prone form fields) stuck in the live DOM
//     for the rest of the session.
//  7) A per-2-hour Shi Chen breakdown now lives directly inside the Daily QMDJ Chart section (reusing
//     computeHourlyHighlights, the same engine behind the separate Hourly tab), so it's visible both
//     in-app and in the PDF export - the Hourly tab itself is a different screen the PDF never captures.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const indexHtml = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static regression guards: index.html ---
check(/id="intakeVehicleShared"/.test(indexHtml), 'intake form has a Vehicle Shared checkbox (id=intakeVehicleShared)');
check(/id="partnerVehicleShared"/.test(indexHtml), 'Life Partner form has a Vehicle Shared checkbox (id=partnerVehicleShared)');
// UPDATED (reported: "Address is not fixed. It should be split into multiple fields"): the single
// free-text intakeHomeAddress field is gone, replaced with the same 6 structured fields
// (ADDRESS_STRUCT_FIELDS) the Feng Shui/Account page's own address entry already used.
check(!/id="intakeHomeAddress"/.test(indexHtml), 'the old single free-text intakeHomeAddress field is gone');
check(/id="intakeHouseNumber"/.test(indexHtml) && /id="intakeStreetName"/.test(indexHtml) && /id="intakeUnit"/.test(indexHtml) && /id="intakeCity"/.test(indexHtml) && /id="intakeCountry"/.test(indexHtml) && /id="intakePostalCode"/.test(indexHtml), 'intake form now has the same 6 structured address fields as the Feng Shui/Account page');
check(/id="intakeHomeConstructionYear"/.test(indexHtml), 'intake form has a Construction Year field (id=intakeHomeConstructionYear)');

// --- Static regression guards: app.js ---
check(/intakeVehicleShared.*checked/.test(appSrc) || /prefillMainProfileForm[\s\S]{0,2000}intakeVehicleShared/.test(appSrc), 'prefillMainProfileForm prefills the intake Vehicle Shared checkbox');
check(/partnerVehicleShared[\s\S]{0,50}checked\s*=\s*!!\(prof\.vehicles/.test(appSrc), 'prefillPartnerForm prefills the partner Vehicle Shared checkbox');
check(/vehicleSharedInput\s*=\s*\$\('#intakeVehicleShared'\)/.test(appSrc), '#saveProfile reads the intake Vehicle Shared checkbox');
check(/partnerVehicleSharedInput\s*=\s*\$\('#partnerVehicleShared'\)/.test(appSrc), '#btnCalculateCompat reads the partner Vehicle Shared checkbox');
check(/homeYearInput\s*=\s*\$\('#intakeHomeConstructionYear'\)/.test(appSrc), '#saveProfile reads the intake Construction Year field');
check(/ADDRESS_STRUCT_FIELDS\.forEach\(key => \{/.test(appSrc), '#saveProfile writes each structured address field into the same u.home.addresses.profile record the Feng Shui page uses');
// UPDATED (reported: "move the add occupants to be at the account page"): the Household Occupants
// add/edit roster relocated from this Feng Shui tab to its own section on the Account page. This
// check now verifies the Feng Shui tab carries a wayfinding note/link pointing to the Account page
// instead of the old People-screen note (the actual roster UI lived inline here before that round).
check(/managed on the Account page/.test(appSrc) || /於「账户」页面管理|于「账户」页面管理/.test(appSrc), 'Household Occupants section has a wayfinding note pointing to the Account page');
check(/btnGoAccountOccupants/.test(appSrc), 'Household Occupants section has a link/button to jump to the Account page');

check(/isSideBySideLayoutContainer/.test(appSrc), 'PDF export defines isSideBySideLayoutContainer');
// UPDATED (this round, single-child-wrapper-unwrap fix): the split decision now runs against
// `effectiveNode` (node, or whatever it unwraps to through a chain of single-child wrappers), not
// always the literal `node` - so the grid/flex-row guard now reads `!isSideBySideLayoutContainer(effectiveNode)`.
// Behaviourally unchanged (a plain node with no single-child wrapper chain has effectiveNode === node),
// see test_pdf_single_child_wrapper_unwrap.js for the actual behavioural coverage of the new unwrap step.
check(/!isSideBySideLayoutContainer\(effectiveNode\)/.test(appSrc), 'expandIntoCaptureUnits refuses to split a grid/flex-row container');
check(/currentUsedMm\s*\+=\s*sliceHMm;/.test(appSrc), 'the oversized-unit pixel-slice path now tracks leftover page space after its last slice instead of always force-flushing (accumulated, so a leading reused-leftover slice adds onto existing page content instead of overwriting it)');
// NOTE: this round's PERFORMANCE FIX batches several capture units into one shared batchContainer per
// html2canvas call (instead of one secContainer per call) - the finally-block cleanup guarantee itself
// (never leaving a capture clone stuck in the live DOM, even if that batch's own capture throws) is
// unchanged, just applied to batchContainer instead of an individual secContainer.
check(/document\.body\.contains\(batchContainer\)\) document\.body\.removeChild\(batchContainer\)/.test(appSrc), 'PDF batch capture loop cleans up batchContainer in a finally block');
check(/Today\\'s Hourly \(Shi Chen\) Breakdown/.test(appSrc), 'Daily QMDJ Chart section now includes a per-Shi-Chen hourly breakdown table');
check(/computeHourlyHighlights\(p, 0\)/.test(appSrc), 'the new hourly breakdown reuses the real computeHourlyHighlights engine (not a separate re-implementation)');

// --- Behavioral: drive the real engine via JSDOM, exercising the intake save handler end to end. ---
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = require('jsdom').JSDOM; }

function buildDom() {
  const html = `<!DOCTYPE html><html><body>
    <nav class="nav hidden" id="nav"></nav>
    <section class="view" id="intake">
      <input id="englishLastName" value="Tan"><input id="englishFirstName" value="Ah Ming">
      <input id="chineseLastName" value=""><input id="chineseFirstName" value="">
      <select id="gender"><option value="male" selected>Male</option></select>
      <input id="birthdate" value="1990-01-01"><input id="birthtime" value="10:00">
      <input id="birthLocation" value="Singapore"><input id="birthLongitude" value="103.8198"><input id="birthTimezone" value="8">
      <input id="intakeMobileNumber" value=""><input id="intakeVehicleNumber" value="">
      <input type="checkbox" id="intakeVehicleShared">
      <input id="intakeHouseNumber" value=""><input id="intakeStreetName" value="">
      <input id="intakeUnit" value=""><input id="intakeCity" value="">
      <input id="intakeCountry" value=""><input id="intakePostalCode" value="">
      <input id="intakeHomeConstructionYear" value="">
      <div id="profileError"></div><button id="saveProfile">Save</button>
    </section>
    <section class="view" id="partnerView"></section>
  </body></html>`;
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
    navigator: { language: 'en-US' }, setTimeout, clearTimeout, Date, Math, JSON,
    Array, Object, String, Number, Map, Set, Promise, RegExp, URL: dom.window.URL,
    html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}} }),
    alert: () => {}, confirm: () => true,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js'); loadFile('engine-predictions.js'); loadFile('app.js'); loadFile('auth.js');
  return { dom, sandbox, run: (code) => vm.runInContext(code, sandbox) };
}

const { dom, run } = buildDom();
run(`
  state = { users: {}, active: 'roy@test.com' };
  state.users['roy@test.com'] = { profile: {
    englishFirstName: 'Ah Ming', englishLastName: 'Tan', chineseFirstName: '', chineseLastName: '',
    gender: 'male', birthdate: '1990-01-01', birthtime: '10:00', birthLocation: 'Singapore',
    birthLongitude: 103.8198, birthTimezone: 8
  }};
  initListeners();
`);

// Fill the intake form including the new structured address fields, then fire the save handler.
run(`
  $('#intakeMobileNumber').value = '91234567';
  $('#intakeVehicleNumber').value = 'SJL1234A';
  $('#intakeVehicleShared').checked = true;
  $('#intakeHouseNumber').value = '92';
  $('#intakeStreetName').value = 'Flora Road';
  $('#intakeUnit').value = '03-37';
  $('#intakeCity').value = 'Singapore';
  $('#intakeCountry').value = 'Singapore';
  $('#intakePostalCode').value = '507005';
  $('#intakeHomeConstructionYear').value = '2006';
  $('#saveProfile').click();
`);

const savedProfile = run('activeUser().profile');
const savedHome = run('activeUser().home');
check(savedProfile.mobileNumber === '91234567', 'intake save persisted the mobile number');
check(Array.isArray(savedProfile.vehicles) && savedProfile.vehicles.length === 1 && savedProfile.vehicles[0].number === 'SJL1234A', 'intake save persisted the vehicle plate');
check(savedProfile.vehicles[0].shared === true, 'intake save persisted the Vehicle Shared checkbox as true');
// composeAddressString(profAddr) with houseNumber+streetName / #unit / city+postalCode / country -
// syncLegacyHomeFields keeps u.home.address in sync with this composed string on every save.
// UPDATED (reported this round: "house number/block, city, country, postal code should be
// mandatory"): Country is now filled in too (it has to be, to pass the new mandatory-field gate - see
// the intakeCountry fill added above), so composeAddressString's trailing ", <country>" now appears.
check(savedHome && savedHome.address === '92 Flora Road, #03-37, Singapore 507005, Singapore', 'intake save composed the 6 structured fields into the legacy u.home.address string (kept in sync for Flying Star/PDF readers)');
check(savedHome && savedHome.constructionYear === 2006, 'intake save persisted Construction Year into u.home');
const savedProfAddr = run('activeUser().home.addresses.profile');
check(savedProfAddr && savedProfAddr.houseNumber === '92' && savedProfAddr.streetName === 'Flora Road' && savedProfAddr.unit === '03-37' && savedProfAddr.city === 'Singapore' && savedProfAddr.postalCode === '507005', 'intake save wrote each structured field into u.home.addresses.profile (the same record the Feng Shui/Account page fields read and write)');

// Re-open the intake form (simulating "Edit birth details") and confirm every new field round-trips.
run(`
  $('#intakeMobileNumber').value = ''; $('#intakeVehicleNumber').value = '';
  $('#intakeVehicleShared').checked = false;
  $('#intakeHouseNumber').value = ''; $('#intakeStreetName').value = ''; $('#intakeUnit').value = '';
  $('#intakeCity').value = ''; $('#intakeCountry').value = ''; $('#intakePostalCode').value = '';
  $('#intakeHomeConstructionYear').value = '';
  prefillMainProfileForm();
`);
check(run("$('#intakeMobileNumber').value") === '91234567', 'prefillMainProfileForm restores the mobile number');
check(run("$('#intakeVehicleNumber').value") === 'SJL1234A', 'prefillMainProfileForm restores the vehicle plate');
check(run("$('#intakeVehicleShared').checked") === true, 'prefillMainProfileForm restores the Vehicle Shared checkbox as checked');
check(run("$('#intakeHouseNumber').value") === '92' && run("$('#intakeStreetName').value") === 'Flora Road' && run("$('#intakeUnit').value") === '03-37' && run("$('#intakeCity').value") === 'Singapore' && run("$('#intakePostalCode').value") === '507005', 'prefillMainProfileForm restores every structured address field from the saved record');
check(run("$('#intakeHomeConstructionYear').value") === '2006', 'prefillMainProfileForm restores Construction Year');

// Re-saving with the Shared checkbox toggled OFF must update the existing vehicle's flag, not add a duplicate.
run(`
  $('#intakeVehicleNumber').value = 'SJL1234A';
  $('#intakeVehicleShared').checked = false;
  $('#saveProfile').click();
`);
const reSaved = run('activeUser().profile');
check(reSaved.vehicles.length === 1, 'toggling Shared off on re-save does not duplicate the vehicle entry');
check(reSaved.vehicles[0].shared === false, 'toggling Shared off on re-save correctly updates the existing vehicle\'s shared flag');

// --- Behavioral: computeHourlyHighlights (the engine the new table is built from) returns 12 real,
// well-formed blocks with every field the new table reads (label, hour pillar, palace, door, rating).
run(`var __p = getProfileData(activeUser().profile);`);
const hourlyBlocks = run(`computeHourlyHighlights(__p, 0)`);
check(Array.isArray(hourlyBlocks) && hourlyBlocks.length === 12, `computeHourlyHighlights returns all 12 Shi Chen blocks (got ${hourlyBlocks && hourlyBlocks.length})`);
const allBlocksWellFormed = hourlyBlocks.every(b => b && b.label && b.stemCN && b.branchCN && b.palace && b.cell && b.cell.door && b.rating && b.rating.tierColor);
check(allBlocksWellFormed, 'every block has every field the new hourly table reads (label, hour pillar, palace, door, rating)');
const exactlyOneIsNow = hourlyBlocks.filter(b => b.isNow).length;
check(exactlyOneIsNow === 1, `exactly one of today's 12 blocks is flagged as the current hour (got ${exactlyOneIsNow})`);

// --- Behavioral: the Daily QMDJ Chart section (which the new table lives inside) is in the "timing"
// tab group, not the initially-active "core" tab - renderSystemChart() only returns the core tab's
// HTML directly, stashing every other tab's HTML in the module-level chartTabRegistry (this is how
// buildProfilePdfHTML itself assembles the full, all-tabs report - see its own use of
// chartTabRegistry). So the new table is verified here the same way the real PDF export reads it.
run(`renderSystemChart(__p, 'i')`); // populates chartTabRegistry['i'] as a side effect
const timingTabHTML = run(`chartTabRegistry['i'].timing`);
check(typeof timingTabHTML === 'string' && timingTabHTML.includes('Daily QMDJ Chart'), 'the Timing tab (read via chartTabRegistry, exactly as buildProfilePdfHTML does) contains the Daily QMDJ Chart section');
check(timingTabHTML.includes("Today's Hourly (Shi Chen) Breakdown"), 'the Timing tab contains the new hourly breakdown heading');
const hourlySectionStart = timingTabHTML.indexOf("Today's Hourly (Shi Chen) Breakdown");
const hourlySectionHTML = timingTabHTML.slice(hourlySectionStart, hourlySectionStart + 8000);
const tableRowCount = (hourlySectionHTML.match(/<tr style="[^"]*">/g) || []).length;
check(tableRowCount === 12, `the hourly breakdown table renders all 12 Shi Chen rows (got ${tableRowCount})`);

console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
