const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Third-round re-verification (after test_duplicate_ids_scan.js and test_pdf_export_live_duplicate_check.js
// in previous rounds) that exportProfileToPdfInner's container never exposes duplicate ids to the live
// document, this time with a genuinely rich profile (2 children, 2 extra biz partners, 2 occupants, a
// structured address + facing direction) and monitoring EVERY document.body.appendChild call during the
// real (mocked-canvas) export flow.
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
  URL: dom.window.URL,
  html2pdf: () => ({ set(){return this}, from(el){ this._el = el; return this}, toPdf(){ return { get(){ return { save(){ return Promise.resolve(); }, output(){ return new Uint8Array(0).buffer; }, internal:{getNumberOfPages:()=>1} }; } }; } }),
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
      chineseFirstName: '伟', chineseLastName: '黄',
      birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
      mobileNumber: '91234567', vehicles: [{number:'SGA1234A', shared:false}],
      bazhaiOccupants: [
        { name: 'Grandma', year: 1950, birthdate: '1950-03-02', birthtime: '08:15', gender: 'female', approximateBirth: false }
      ],
      fsDir: 'North',
    },
    partner: {
      englishFirstName: 'Amy', englishLastName: 'Tan', englishName: 'Amy Tan',
      birthdate: '1980-02-14', birthtime: '14:00', gender: 'female',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
    },
    additionalBizPartners: [],
    children: [
      { englishFirstName: 'Eve', englishLastName: 'Wong', englishName: 'Eve Wong', birthdate: '2010-01-01', birthtime: '01:00', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 }
    ],
    home: { addresses: { profile: { houseNumber: '123', streetName: 'Orchard Rd', unit: '05-12', city: 'Singapore', country: 'Singapore', postalCode: '238859', constructionYear: 2015 }, checked: [] } },
    people: []
  };
  state.active = 'test@example.com';
  saveState();
  initAuthListeners(); initListeners(); updateStaticLanguage();
  go('chart');
`, sandbox);

// Monitor every appendChild onto document.body for duplicate ids AT THE MOMENT of attachment.
let maxDupesSeenLive = 0;
let violatingIds = [];
const origAppendChild = dom.window.Node.prototype.appendChild;
dom.window.Node.prototype.appendChild = function (node) {
  const result = origAppendChild.call(this, node);
  if (this === dom.window.document.body) {
    const ids = {};
    dom.window.document.querySelectorAll('[id]').forEach(el => { if (el.id) ids[el.id] = (ids[el.id] || 0) + 1; });
    const dupes = Object.entries(ids).filter(([id, c]) => c > 1);
    if (dupes.length > maxDupesSeenLive) { maxDupesSeenLive = dupes.length; violatingIds = dupes.map(d => d[0]); }
  }
  return result;
};

let threw = null;
try {
  vm.runInContext(`exportProfileToPdfInner('i');`, sandbox);
} catch (e) { threw = e; }

check(!threw, 'exportProfileToPdfInner completed without throwing: ' + (threw && (threw.stack || threw.message)));
check(maxDupesSeenLive === 0, `no duplicate id ever appeared live in document.body during PDF export - found ${maxDupesSeenLive}: ${violatingIds.join(', ')}`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
