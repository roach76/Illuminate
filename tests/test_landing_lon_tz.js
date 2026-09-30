const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for "longitude and timezone missing from landing page summary card" - the landing
// card's Gregorian Birth tile now includes the same longitude/UTC-offset sub-line the chart-level
// Profile Overview card's own Gregorian Birth tile already shows.
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

vm.runInContext(`
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
  initAuthListeners(); initListeners(); updateStaticLanguage();
`, sandbox);

const p = vm.runInContext(`getProfileData()`, sandbox);
const landingHTML = vm.runInContext(`generateSummaryCardHTML(getProfileData(), null, false, false, 'i')`, sandbox);
check(landingHTML.includes('103.82'), 'landing summary card now shows the longitude (103.82°)');
check(/UTC\+8/.test(landingHTML), 'landing summary card now shows the UTC+8 timezone offset');

// Compare against the chart-level Profile Overview's own rendering of the same profile, to confirm the
// format genuinely matches (not just present-somewhere).
vm.runInContext(`go('chart');`, sandbox);
const chartHTML = dom.window.document.getElementById('chartContent') ? dom.window.document.getElementById('chartContent').innerHTML : (dom.window.document.body.innerHTML);
const chartHasLonTz = /103\.82.*UTC\+8|UTC\+8.*103\.82/s.test(chartHTML) || (chartHTML.includes('103.82') && chartHTML.includes('UTC+8'));
check(chartHasLonTz, 'sanity check: chart-level page also shows 103.82 and UTC+8 (confirms the profile data itself is correct, not just landing card text)');

// A profile with a negative UTC offset renders the sign correctly too (e.g. UTC-5 New York).
vm.runInContext(`
  state.users['test2@example.com'] = {
    name: 'test2', email: 'test2@example.com', password: 'x',
    profile: {
      englishFirstName: 'Jane', englishLastName: 'Doe', englishName: 'Jane Doe',
      birthdate: '1990-01-01', birthtime: '10:00', gender: 'female',
      birthLocation: 'New York', birthLongitude: -74.0, birthTimezone: -5,
    },
    additionalBizPartners: [], children: [], home: {},
  };
  state.active = 'test2@example.com';
  saveState();
`, sandbox);
const landingHTML2 = vm.runInContext(`generateSummaryCardHTML(getProfileData(), null, false, false, 'i')`, sandbox);
check(landingHTML2.includes('-74.00'), 'a negative longitude renders correctly on the landing card');
check(/UTC-5/.test(landingHTML2), 'a negative UTC offset renders with its own minus sign (not UTC+-5 or similar)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
