const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for the reported bug "Feng Shui analysis not appearing after an address is added":
// switchChartTab used to overwrite the tab being switched TO with a stale cached HTML string, discarding
// any live DOM edits (Feng Shui direction picked, home address/year saved, etc.) made in the tab being
// switched AWAY FROM. The fix saves the live DOM of the tab being left back into chartTabRegistry before
// swapping, and a companion 'change' listener keeps each edited field's DOM attribute in sync with its
// live value so serialization actually captures it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
const src = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// 1. Static checks on switchChartTab's new behavior.
const fnStart = src.indexOf('function switchChartTab(prefix, tabName)');
const fnEnd = src.indexOf('\nfunction ', fnStart + 10);
const fnBody = src.slice(fnStart, fnEnd);
check(fnBody.includes('registryForPrefix[currentTab] = panel.innerHTML'), 'switchChartTab saves the tab being left back into the registry before swapping');
check(fnBody.includes("document.querySelector(`.chartTabBtn[data-prefix=\"${prefix}\"].active`)"), 'switchChartTab determines the currently-active tab from the DOM');

// 2. Static check on the companion attribute-sync listener.
const changeListenerIdx = src.indexOf("document.addEventListener('change', e => {");
check(changeListenerIdx !== -1, "delegated 'change' listener located");
const syncSnippet = src.slice(changeListenerIdx, changeListenerIdx + 1500);
check(syncSnippet.includes("e.target.closest('.chart-tab-panel')"), 'change listener syncs attributes only for fields inside a chart tab panel');
check(syncSnippet.includes("opt.toggleAttribute('selected', opt.selected)"), 'change listener syncs <select> option "selected" attributes');
check(syncSnippet.includes("el.setAttribute('value', el.value)"), 'change listener syncs <input> "value" attributes');

// 3. Functional, DOM-driven test: simulate the exact reported scenario end-to-end.
const dom = new JSDOM('<!DOCTYPE html><body></body>');
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
};
sandbox.global = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }

let threw = null;
try {
  loadFile('engine-core.js');
  loadFile('engine-metaphysics.js');
  loadFile('engine-predictions.js');
  loadFile('app.js');

  // Build a minimal test profile.
  vm.runInContext(`
    state.users['test@example.com'] = {
      name: 'test', email: 'test@example.com', password: 'x',
      profile: {
        englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
        birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
        birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
      },
      partner: null, businessPartner: null, additionalBizPartners: [], children: [], home: {},
    };
    state.active = 'test@example.com';
  `, sandbox);

  // Register the app's real delegated event listeners (fs-dir-select, homeAddressInput, the new
  // attribute-sync fix, etc. all live inside initListeners()) exactly as the live app does on load.
  vm.runInContext("initListeners();", sandbox);

  // Simulate: render the chart (captures the initial, empty-fsDir tab HTML into chartTabRegistry),
  // then build the DOM tab panel exactly as the live app does.
  vm.runInContext(`
    const p0 = getProfileData();
    const fullChartResult0 = renderSystemChart(p0, 'i');
    document.body.innerHTML = fullChartResult0;
  `, sandbox);

  check(vm.runInContext("!!chartTabRegistry['i']", sandbox), 'chartTabRegistry populated for prefix "i" after initial render');
  check(vm.runInContext("chartTabRegistry['i'].environment.includes('fs-dir-i')", sandbox), 'initial (uninteracted) environment tab HTML contains the Feng Shui direction selector');
  check(vm.runInContext("!chartTabRegistry['i'].environment.includes('Ba Zhai Compass Deep Profile')", sandbox) === true ||
        vm.runInContext("document.getElementById('fs-result-i').style.display", sandbox) !== undefined,
        'sanity: harness is reading real cached tab content');

  // Switch to the Environment tab (as the user would by clicking it) so its HTML is live in the DOM.
  vm.runInContext("switchChartTab('i', 'environment')", sandbox);
  check(vm.runInContext("document.getElementById('chartTabPanel_i').innerHTML.includes('fs-dir-i')", sandbox), 'Environment tab is now live in the DOM');

  // Simulate the user picking a Feng Shui direction: set the select's value, mark the option selected
  // (as real browser UI interaction does), and dispatch a real 'change' event exactly as the browser
  // would - driving the ACTUAL app.js delegated listener, not a re-implementation of it.
  vm.runInContext(`
    const sel = document.getElementById('fs-dir-i');
    sel.value = 'North';
    Array.from(sel.options).forEach(o => { o.selected = (o.value === 'North'); });
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
  `, sandbox);

  const resultAfterPick = vm.runInContext("document.getElementById('fs-result-i').innerHTML", sandbox);
  check(resultAfterPick.length > 0, 'Ba Zhai deep analysis HTML was live-inserted immediately after picking a direction');
  check(vm.runInContext("document.getElementById('fs-result-i').style.display", sandbox) === 'block', 'result div is shown (display:block) after picking a direction');

  // The critical regression scenario: switch away to another tab, then back to Environment.
  vm.runInContext("switchChartTab('i', 'core')", sandbox);
  check(vm.runInContext("document.getElementById('chartTabPanel_i').innerHTML.includes('fs-dir-i')", sandbox) === false, 'Core tab is now showing (Feng Shui selector no longer in DOM)');
  vm.runInContext("switchChartTab('i', 'environment')", sandbox);

  const resultAfterRoundTrip = vm.runInContext("document.getElementById('fs-result-i').innerHTML", sandbox);
  const displayAfterRoundTrip = vm.runInContext("document.getElementById('fs-result-i').style.display", sandbox);
  const selectValueAfterRoundTrip = vm.runInContext("document.getElementById('fs-dir-i').value", sandbox);

  check(resultAfterRoundTrip.length > 0, 'BUG FIX VERIFIED: Ba Zhai deep analysis still present after switching tabs away and back (previously reverted to blank)');
  check(resultAfterRoundTrip === resultAfterPick, 'the exact same analysis content survives the tab round-trip, not just non-empty content');
  check(displayAfterRoundTrip === 'block', 'result div is still shown (display:block) after the round-trip (previously reverted to display:none)');
  check(selectValueAfterRoundTrip === 'North', 'the Feng Shui direction selector still shows the previously-picked direction after the round-trip');

  // Also verify a still-live-editable field in this same Environment tab survives the same round-trip.
  // UPDATED (reported this round: "remove the home address entry from Feng Shui as it is to be managed
  // at the profile level") - the persistent Home Address's own structured fields (id="homeAddrStreetName"
  // etc.) are gone from this tab entirely (it's now read-only there, edited only on the Intake/Profile
  // page - see test_structured_address_and_history.js for that coverage). The "Check Another Address"
  // form's own street-name field (id="newAddrStreetName") is still a live-editable input in this exact
  // tab, so it now carries the same regression coverage: an uncommitted, in-progress edit must survive
  // switchChartTab's cache-and-restore round trip, not just fields that have already been saved.
  vm.runInContext(`
    document.querySelector('.btnShowAddAddressForm').dispatchEvent(new window.Event('click', { bubbles: true }));
    const addrInput = document.getElementById('newAddrStreetName');
    addrInput.value = '123 Orchard Road, Singapore';
    addrInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  `, sandbox);
  vm.runInContext("switchChartTab('i', 'more')", sandbox);
  vm.runInContext("switchChartTab('i', 'environment')", sandbox);
  const addrAfterRoundTrip = vm.runInContext("document.getElementById('newAddrStreetName').value", sandbox);
  check(addrAfterRoundTrip === '123 Orchard Road, Singapore', 'an uncommitted edit in the "Check Another Address" form also survives a tab-switch round-trip');

  // And confirm the removed persistent Home Address fields really are gone from this tab.
  check(vm.runInContext("!document.getElementById('homeAddrStreetName')", sandbox), 'the persistent Home Address\'s own structured fields no longer render in the Feng Shui tab at all');
  check(vm.runInContext("!document.getElementById('fs-dir-i-addr')", sandbox), 'the Feng Shui tab\'s own duplicate Home Facing Direction selector is gone too');
  check(vm.runInContext("!!document.querySelector('.btnEditHomeAddressOnProfile')", sandbox), 'an "Edit on Profile" shortcut is present instead');

} catch (e) {
  threw = e;
}
check(!threw, 'test harness completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
