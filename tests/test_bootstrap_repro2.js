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
      },
      home: { address: '92 Flora Road, Singapore 507005' },
      partner: {
        englishFirstName: 'Amy', englishLastName: 'Lee', gender: 'female',
        birthdate: '1978-05-12', birthtime: '14:00', birthLocation: 'Singapore',
        birthLongitude: 103.8198, birthTimezone: 8,
        mobileNumber: '98765432',
      },
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
function load(f) {
  try {
    vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f });
  } catch (e) {
    console.error(`ERROR loading ${f}:`, e && e.stack ? e.stack : e);
    process.exit(1);
  }
}
load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');

try {
  vm.runInContext(`
    if(typeof initAuthListeners === 'function') initAuthListeners();
    initListeners(); updateStaticLanguage();
    if (activeUser()) go(activeUser().profile ? 'home' : 'intake'); else go('welcome');
  `, sandbox);
  console.log('Bootstrap completed with no thrown error (realistic loadState() path).');
} catch (e) {
  console.error('BOOTSTRAP THREW:', e && e.stack ? e.stack : e);
  process.exit(1);
}
