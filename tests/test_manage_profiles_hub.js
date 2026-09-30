const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the "consolidate all profile-editing fields onto one page" enhancement: the Account page
// now shows a "Manage Profiles" hub listing every profile on the account, with a one-tap button
// straight to that profile's own existing edit form.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const html = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
check(html.includes('id="manageProfilesList"'), 'index.html has the manageProfilesList container');

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
      profile: { englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
        birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
        birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      partner: null, businessPartner: null, additionalBizPartners: [], children: [], home: {},
    };
    state.active = 'test@example.com';
    saveState();
  `);

  run("go('account');");
  check(run("document.querySelector('.view.active')?.id") === 'account', 'navigated to account view');
  const listHTML = run("document.getElementById('manageProfilesList').innerHTML");
  check(listHTML.includes('btnManageEditMain'), 'hub shows an entry for Your Profile');
  check(listHTML.includes('btnManageEditPartner'), 'hub shows an entry for Life Partner (no partner yet -> Add)');
  check(listHTML.includes('btnManageEditBiz'), 'hub shows an entry for Business Partner (none yet -> Add)');
  check(listHTML.includes('btnManageGoChildren'), 'hub shows an entry for Children');
  check(listHTML.includes('Not added yet'), 'hub correctly shows "Not added yet" for missing optional profiles');

  // Click "Edit Your Profile" from the hub - should prefill and land on intake.
  run("document.querySelector('.btnManageEditMain').dispatchEvent(new window.Event('click', {bubbles:true}));");
  check(run("document.querySelector('.view.active')?.id") === 'intake', 'clicking Edit on Your Profile navigates to the intake/edit form');
  check(run("document.getElementById('englishFirstName')?.value") === 'Roy', 'the intake form was correctly prefilled with the existing profile data');

  // Click "Add Life Partner" from the hub - should land on the compat (partner) form.
  run("go('account');");
  run("document.querySelector('.btnManageEditPartner').dispatchEvent(new window.Event('click', {bubbles:true}));");
  check(run("document.querySelector('.view.active')?.id") === 'compat', 'clicking Add on Life Partner navigates to the partner form');

  // Click "Add Business Partner" from the hub.
  run("go('account');");
  run("document.querySelector('.btnManageEditBiz').dispatchEvent(new window.Event('click', {bubbles:true}));");
  check(run("document.querySelector('.view.active')?.id") === 'businessTab', 'clicking Add on Business Partner navigates to the business form');

  // Click "Add Children" from the hub.
  run("go('account');");
  run("document.querySelector('.btnManageGoChildren').dispatchEvent(new window.Event('click', {bubbles:true}));");
  check(run("document.querySelector('.view.active')?.id") === 'childrenTab', 'clicking Add on Children navigates to the children tab');

  // Now with a partner added, the hub should show "Edit" (with the partner's name) instead of "Add".
  run(`
    state.users['test@example.com'].partner = {
      englishFirstName: 'Jane', englishLastName: 'Tan', englishName: 'Jane Tan',
      birthdate: '1978-03-03', birthtime: '11:00', gender: 'female',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
    };
    saveState();
  `);
  run("go('account');");
  const listHTML2 = run("document.getElementById('manageProfilesList').innerHTML");
  check(listHTML2.includes('Jane Tan'), 'hub now shows the added Life Partner\'s name instead of "Not added yet"');
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
