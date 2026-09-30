const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');

const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
const win = dom.window;
win.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
// jsdom has no real layout - patch getBoundingClientRect with a bounded, depth-independent synthetic height
win.Element.prototype.getBoundingClientRect = function () {
  const text = this.textContent || '';
  const childCount = this.children ? this.children.length : 0;
  const h = Math.max(16, Math.min(140, Math.round(text.length / 6) + childCount * 2));
  return { top: 0, left: 0, right: 400, bottom: h, width: 400, height: h, x: 0, y: 0 };
};

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

// Mock html2canvas: returns a fake canvas-like object
function mockHtml2Canvas() {
  return Promise.resolve({ width: 400, height: 100, toDataURL: () => 'data:image/png;base64,AAAA', getContext: () => ({ drawImage(){} }) });
}
// Mock jsPDF-like object returned by html2pdf().set().from().toPdf() chain isn't used directly;
// captureChunksIntoPdf likely uses window.html2canvas directly and jsPDF via window.jspdf or html2pdf's internal.
// Let's check what globals captureChunksIntoPdf actually references by grepping is out of scope here;
// instead provide a broad set of plausible globals.
function FakeJsPDF() {
  return {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addImage() {}, addPage() {}, save() {}, output() { return new Blob(); }, setFontSize(){}, text(){},
  };
}

const sandbox = {
  console, localStorage, navigator: { language: 'en-US' },
  document: win.document, window: win,
  setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
  URL: win.URL,
  html2canvas: mockHtml2Canvas,
  jspdf: { jsPDF: FakeJsPDF },
  html2pdf: () => ({ set(){return this;}, from(){return this;}, toPdf(){return {get: () => ({then: (cb) => { cb(FakeJsPDF()); return {save(){}}; }})};}, toCanvas(){return {then(cb){cb({width:1,height:1,toDataURL:()=>'data:x'});return this;}};} }),
  alert: () => {}, confirm: () => true, Blob: dom.window.Blob || class Blob {},
};
sandbox.global = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');

vm.runInContext(`
  if(typeof initAuthListeners === 'function') initAuthListeners();
  initListeners(); updateStaticLanguage();
  go('home'); go('chart'); go('account'); go('home');
`, sandbox);

// Monitor: patch appendChild on document.body to scan for duplicates every time something is attached
let maxDupeSeen = 0;
let dupeDetails = [];
const origAppendChild = win.Node.prototype.appendChild;
win.Node.prototype.appendChild = function (child) {
  const result = origAppendChild.call(this, child);
  if (this === win.document.body) {
    const all = win.document.querySelectorAll('[id]');
    const seen = {};
    all.forEach(el => { if (el.id) seen[el.id] = (seen[el.id] || 0) + 1; });
    const dupes = Object.entries(seen).filter(([id, c]) => c > 1);
    if (dupes.length > maxDupeSeen) {
      maxDupeSeen = dupes.length;
      dupeDetails = dupes;
    }
  }
  return result;
};

(async () => {
  try {
    await vm.runInContext(`exportProfileToPdfInner('i')`, sandbox);
    console.log('exportProfileToPdfInner completed');
  } catch (e) {
    console.log('exportProfileToPdfInner threw (expected in mock env, checking dupe tracking anyway):', e.message);
  }
  console.log('\nMax duplicate id count observed during live document.body appends:', maxDupeSeen);
  dupeDetails.forEach(([id, count]) => console.log(`  id="${id}" appeared ${count} times`));
  if (maxDupeSeen === 0) console.log('No duplicate ids ever observed live in document.body during PDF export.');
})();
