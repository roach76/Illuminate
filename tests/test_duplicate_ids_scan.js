const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');

const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };

const storage = {};
const realState = {
  users: {
    'roy@test.com': {
      profile: {
        englishFirstName: 'Roy', englishLastName: 'Wong', gender: 'male',
        birthdate: '1976-09-07', birthtime: '09:33', birthLocation: 'Singapore',
        birthLongitude: 103.8198, birthTimezone: 8,
        mobileNumber: '91234567', vehicles: [{ number: 'SJL1234A', shared: false }],
        bazhaiOccupants: [{ name: 'Grandma', birthdate: '1950-01-01', birthtime: '08:00', gender: 'female', approximateBirth: false }],
      },
      home: { address: '92 Flora Road, Singapore 507005', constructionYear: 2010 },
      partner: {
        englishFirstName: 'Amy', englishLastName: 'Lee', gender: 'female',
        birthdate: '1978-05-12', birthtime: '14:00', birthLocation: 'Singapore',
        birthLongitude: 103.8198, birthTimezone: 8,
        mobileNumber: '98765432',
      },
      businessPartner: {
        englishFirstName: 'Ben', englishLastName: 'Tan', gender: 'male',
        birthdate: '1980-03-03', birthtime: '10:00', birthLocation: 'Singapore',
        birthLongitude: 103.8198, birthTimezone: 8,
      },
      children: [{
        englishFirstName: 'Timmy', englishLastName: 'Wong', gender: 'male',
        birthdate: '2010-06-01', birthtime: '10:00', birthLocation: 'Singapore',
        birthLongitude: 103.8198, birthTimezone: 8,
      }],
    }
  },
  active: 'roy@test.com'
};
storage['illuminate_state'] = JSON.stringify(realState);

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
  if(typeof initAuthListeners === 'function') initAuthListeners();
  initListeners(); updateStaticLanguage();
  go('home');
  go('chart');
  go('compat');
  go('businessTab');
  go('childrenTab');
  go('account');
  go('hourlyTab');
  go('detailedReadingTab');
  go('home');
`, sandbox);

function scanDuplicates() {
  const all = dom.window.document.querySelectorAll('[id]');
  const seen = {};
  all.forEach(el => {
    const id = el.id;
    if (!id) return;
    seen[id] = (seen[id] || 0) + 1;
  });
  const dupes = Object.entries(seen).filter(([id, count]) => count > 1);
  return dupes;
}

const dupes = scanDuplicates();
console.log('Total elements with id:', dom.window.document.querySelectorAll('[id]').length);
console.log('Duplicate ids found:', dupes.length);
dupes.forEach(([id, count]) => console.log(`  id="${id}" appears ${count} times`));

// Also specifically check form fields (input/select/textarea) since that's what the DevTools issue names
const formEls = dom.window.document.querySelectorAll('input[id], select[id], textarea[id]');
const seenForm = {};
formEls.forEach(el => { seenForm[el.id] = (seenForm[el.id] || 0) + 1; });
const dupeForm = Object.entries(seenForm).filter(([id, count]) => count > 1);
console.log('\nDuplicate FORM FIELD ids found:', dupeForm.length);
dupeForm.forEach(([id, count]) => console.log(`  id="${id}" appears ${count} times (form field)`));
