const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Task #74 (reported: "on the detailed chart for all profiles, there is a details summary
// for core, there should be the same for Timing, Environment and More as well"): the single
// "Details Summary" card that used to sit only at the top of the Core tab has been split into 4
// separate cards - one per tab group (Core/Timing/Environment/More), reusing the app's own
// pre-existing tabGroups taxonomy, each card living inside its own tab so a person browsing any tab
// sees an at-a-glance summary relevant to what's actually on that tab.
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

vm.runInContext(`
  state = { users: {}, active: 'roy@test.com' };
  state.users['roy@test.com'] = { profile: {
    englishFirstName: 'Roy', englishLastName: 'Wong', chineseFirstName: '', chineseLastName: '',
    gender: 'male', birthdate: '1976-09-07', birthtime: '09:33', birthLocation: 'Singapore',
    birthLongitude: 103.8198, birthTimezone: 8
  }};
  initListeners();
  var __p = getProfileData(activeUser().profile);
  renderSystemChart(__p, 'i');
`, sandbox);

const registry = vm.runInContext(`chartTabRegistry['i']`, sandbox);
check(!!registry, 'chartTabRegistry populated for the main profile after renderSystemChart');

// Static source checks: the 4 distinct cards exist, one per tab group, each with its own id.
const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
check(/const artDetailsSummaryCore\s*=/.test(appSrc), 'artDetailsSummaryCore is defined');
check(/const artDetailsSummaryTiming\s*=/.test(appSrc), 'artDetailsSummaryTiming is defined');
check(/const artDetailsSummaryEnvironment\s*=/.test(appSrc), 'artDetailsSummaryEnvironment is defined');
check(/const artDetailsSummaryMore\s*=/.test(appSrc), 'artDetailsSummaryMore is defined');
check(/core:\s*\[artDetailsSummaryCore/.test(appSrc), 'the Core tab group leads with artDetailsSummaryCore');
check(/timing:\s*\[artDetailsSummaryTiming/.test(appSrc), 'the Timing tab group leads with artDetailsSummaryTiming');
check(/environment:\s*\[artDetailsSummaryEnvironment/.test(appSrc), 'the Environment tab group leads with artDetailsSummaryEnvironment');
check(/more:\s*\[artDetailsSummaryMore/.test(appSrc), 'the More tab group leads with artDetailsSummaryMore');

// Behavioral: each of the 4 rendered tabs actually contains its own "Details Summary" heading and
// tab-appropriate content (not just the Core tab, and not 4 copies of the same content).
const coreHTML = registry.core, timingHTML = registry.timing, envHTML = registry.environment, moreHTML = registry.more;
[['core', coreHTML], ['timing', timingHTML], ['environment', envHTML], ['more', moreHTML]].forEach(([name, html]) => {
  check(typeof html === 'string' && /Details Summary/.test(html), `the ${name} tab contains a "Details Summary" card`);
});

check(/Zodiac/.test(coreHTML) && /BaZi Day Master/.test(coreHTML) && /Bone Weight/.test(coreHTML), 'Core details summary shows Zodiac, BaZi Day Master and Bone Weight rows');
check(/Da Yun/.test(timingHTML) && /QMDJ Life Palace/.test(timingHTML), 'Timing details summary shows Da Yun and QMDJ Life Palace rows');
check(/Zi Wei Life Palace/.test(envHTML) && /Ba Zhai Kua/.test(envHTML), 'Environment details summary shows Zi Wei Life Palace and Ba Zhai Kua rows');
check(/Numerology Life Path/.test(moreHTML) && /Sun Sign/.test(moreHTML), 'More details summary shows Numerology Life Path and Sun Sign rows');

// Cross-check: content unique to one tab group must NOT leak into another's Details Summary card
// (each card should only summarize what's actually on that tab).
check(!/Da Yun/.test(coreHTML.slice(0, coreHTML.indexOf('Details Summary') + 2000)), 'Core details summary does not duplicate the Timing tab\'s Da Yun row');
check(!/Zodiac/.test(timingHTML.slice(0, timingHTML.indexOf('Details Summary') + 2000)), 'Timing details summary does not duplicate the Core tab\'s Zodiac row');

// Also verify for a secondary profile type (Life Partner, prefix 'p') that the same 4-way split holds,
// confirming this isn't main-profile-only.
vm.runInContext(`
  activeUser().partner = { englishFirstName: 'Amy', englishLastName: 'Lee', gender: 'female',
    birthdate: '1978-05-12', birthtime: '14:00', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 };
  var __pp = getProfileData(activeUser().partner);
  renderSystemChart(__pp, 'p');
`, sandbox);
const registryP = vm.runInContext(`chartTabRegistry['p']`, sandbox);
check(!!registryP && /Details Summary/.test(registryP.core) && /Details Summary/.test(registryP.timing) && /Details Summary/.test(registryP.environment) && /Details Summary/.test(registryP.more), 'the Life Partner profile (prefix p) also gets all 4 categorized Details Summary cards, not just the main profile');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
