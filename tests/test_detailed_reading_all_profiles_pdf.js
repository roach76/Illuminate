const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies "include a reading for all profiles following the reading format from the reading tab":
// the Detailed Reading section (generateDetailedReading, the same content the Reading tab renders) used
// to be appended only inside buildProfilePdfHTML's prefix === 'i' branch, so Life Partner, Business
// Partner (core + additional) and Child PDFs omitted it. It must now appear in every profile's PDF,
// built from THAT profile's own data, and still appear exactly once in the main profile's PDF.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(__PROJECT_ROOT__, 'app.js'), 'utf8');
check(/function detailedReadingSectionHTML\(p\)/.test(appSrc), 'shared detailedReadingSectionHTML helper exists');
check((appSrc.match(/bodyHTML \+= detailedReadingSectionHTML\(p\);/g) || []).length === 2, 'helper is appended in both the main-profile and the other-profiles branch');

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(__PROJECT_ROOT__, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: dom.window.document, window: dom.window,
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL, html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}} }),
    alert: () => {}, confirm: () => true, fetch: undefined,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  const load = (f) => vm.runInContext(fs.readFileSync(path.join(__PROJECT_ROOT__, f), 'utf8'), sandbox, { filename: f });
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return sandbox;
}
const person = (first, last, date, time, gender) => ({ englishFirstName: first, englishLastName: last, birthdate: date, birthtime: time, gender, birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 });
const user = {
  email: 'test@test.com', password: 'x',
  profile: person('Roy', 'Wong', '1976-09-07', '09:33', 'male'),
  partner: person('Tina', 'Seah', '1976-04-15', '10:00', 'female'),
  businessPartner: person('Bobby', 'Neo', '1965-06-27', '05:28', 'male'),
  additionalBizPartners: [person('Carl', 'Lim', '1980-02-11', '14:00', 'male')],
  children: [person('Amy', 'Wong', '2005-03-03', '08:15', 'female')],
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};

const sandbox = freshSandbox();
vm.runInContext(`state.users['test@test.com'] = ${JSON.stringify(user)}; state.active = 'test@test.com'; go('chart');`, sandbox);

const prefixes = [['i', 'main'], ['p', 'Life Partner'], ['b', 'Business Partner'], ['b2_0', 'additional Business Partner'], ['c0', 'Child']];
for (const [prefix, label] of prefixes) {
  const html = vm.runInContext(`buildProfilePdfHTML(${JSON.stringify(prefix)})`, sandbox);
  check(typeof html === 'string' && html.length > 1000, `${label}: PDF HTML builds`);
  const count = (html.match(/Detailed Reading/g) || []).length;
  check(count >= 1, `${label}: PDF contains the Detailed Reading section`);
  const expected = vm.runInContext(`generateDetailedReading(getProfileData(getProfileByPrefix(${JSON.stringify(prefix)})))`, sandbox);
  const probe = expected.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  check(probe.length > 20 && plain.includes(probe), `${label}: PDF carries that profile's own Detailed Reading text ("${probe.slice(0, 30)}...")`);
  check((html.match(/<span>Detailed Reading<\/span>/g) || []).length === 1, `${label}: Detailed Reading heading appears exactly once`);
}

// Distinct profiles must get distinct readings (not the main profile's text copied everywhere).
const a = vm.runInContext(`generateDetailedReading(getProfileData(getProfileByPrefix('p')))`, sandbox);
const b = vm.runInContext(`generateDetailedReading(getProfileData(getProfileByPrefix('i')))`, sandbox);
check(a !== b, 'partner reading differs from main profile reading');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
