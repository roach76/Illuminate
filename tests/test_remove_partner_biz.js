const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for the outstanding item "No option to remove a profile (child / life partner /
// business partner)": children and additional business partners already had a Remove button; this adds
// one for the PRIMARY Life Partner and PRIMARY Business Partner too (btnRemovePartner / btnRemoveBiz),
// wired to clear the stored profile and return Home.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// Static checks.
const html = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
check(html.includes('id="btnRemovePartner"'), 'index.html has a btnRemovePartner button');
check(html.includes('id="btnRemoveBiz"'), 'index.html has a btnRemoveBiz button');
const coreSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-core.js'), 'utf8');
check(coreSrc.includes("btnRemovePartner: '移除'"), 'Chinese translation registered for btnRemovePartner');
check(coreSrc.includes("btnRemoveBiz: '移除'"), 'Chinese translation registered for btnRemoveBiz');

// Functional, DOM-driven test.
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
  navigator: { language: 'en-US' },
  setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
  URL: dom.window.URL, html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){} }} }),
  alert: () => {},
};
sandbox.global = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
function run(code) { return vm.runInContext(code, sandbox); }

let threw = null;
try {
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js'); loadFile('engine-predictions.js');
  loadFile('app.js'); loadFile('auth.js');
  run("initAuthListeners(); initListeners(); updateStaticLanguage();");

  run(`
    state.users['test@example.com'] = {
      name: 'test', email: 'test@example.com', password: 'x',
      profile: {
        englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
        birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
        birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
      },
      partner: {
        englishFirstName: 'Jane', englishLastName: 'Tan', englishName: 'Jane Tan',
        birthdate: '1978-03-03', birthtime: '11:00', gender: 'female',
        birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
      },
      businessPartner: {
        englishFirstName: 'Sam', englishLastName: 'Lee', englishName: 'Sam Lee',
        birthdate: '1980-06-06', birthtime: '08:00', gender: 'male',
        birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
      },
      additionalBizPartners: [], children: [], home: {},
    };
    state.active = 'test@example.com';
    saveState();
  `);

  run("go('partnerView');");
  check(run("document.querySelector('.view.active')?.id") === 'partnerView', 'navigated to partnerView with a partner present');
  check(run("!!document.getElementById('btnRemovePartner')") === true, 'Remove button present in partnerView');
  run("document.getElementById('btnRemovePartner').dispatchEvent(new window.Event('click', {bubbles:true}));");
  check(run("state.users['test@example.com'].partner") === null, 'BUG FIX VERIFIED: clicking Remove clears the stored Life Partner profile');
  check(run("document.querySelector('.view.active')?.id") === 'home', 'navigated back to Home after removing the Life Partner');

  run("go('bizView');");
  check(run("document.querySelector('.view.active')?.id") === 'bizView', 'navigated to bizView with a business partner present');
  check(run("!!document.getElementById('btnRemoveBiz')") === true, 'Remove button present in bizView');
  run("document.getElementById('btnRemoveBiz').dispatchEvent(new window.Event('click', {bubbles:true}));");
  check(run("state.users['test@example.com'].businessPartner") === null, 'BUG FIX VERIFIED: clicking Remove clears the stored Business Partner profile');
  check(run("document.querySelector('.view.active')?.id") === 'home', 'navigated back to Home after removing the Business Partner');

  // Regression: existing child / additional-biz-partner remove buttons still work.
  run(`
    state.users['test@example.com'].children = [{
      englishFirstName: 'Kid', englishLastName: 'Wong', englishName: 'Kid Wong',
      birthdate: '2010-01-01', birthtime: '12:00', gender: 'male',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
    }];
    saveState();
  `);
  run("go('childrenTab');");
  const hasRemoveChild = run("!!document.querySelector('.btnRemoveChild')");
  check(hasRemoveChild, 'regression: children list still shows a Remove button');
  if (hasRemoveChild) {
    run("document.querySelector('.btnRemoveChild').dispatchEvent(new window.Event('click', {bubbles:true}));");
    check(run("state.users['test@example.com'].children.length") === 0, 'regression: removing a child still works');
  }
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
