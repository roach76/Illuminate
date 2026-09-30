const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Re-investigation of the still-recurring "Duplicate form field id" DevTools report, now with a MUCH
// richer test profile than the previous two rounds' scans used (2 children, 2 additional business
// partners, 2 household occupants via the People screen, 2 checked addresses, the People "Add Person"
// form left open, the "Check Another Address" form left open) - specifically targeting the classic bug
// pattern the previous scans might not have exercised: an id built inside a .map()/forEach loop that
// doesn't actually vary per item (so every item in a 2+ item list gets the exact same id).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
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
      chineseFirstName: '伟', chineseLastName: '黄',
      birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
      mobileNumber: '91234567', vehicles: [{number:'SGA1234A', shared:false}],
      bazhaiOccupants: [
        { name: 'Grandma', year: 1950, birthdate: '1950-03-02', birthtime: '08:15', gender: 'female', approximateBirth: false },
        { name: 'Grandpa', year: 1948, birthdate: '1948-05-11', birthtime: '', gender: 'male', approximateBirth: false }
      ],
      fsDir: 'North',
    },
    partner: {
      englishFirstName: 'Amy', englishLastName: 'Tan', englishName: 'Amy Tan',
      birthdate: '1980-02-14', birthtime: '14:00', gender: 'female',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
    },
    businessPartner: {
      englishFirstName: 'Ben', englishLastName: 'Lee', englishName: 'Ben Lee',
      birthdate: '1978-06-01', birthtime: '11:00', gender: 'male',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
    },
    additionalBizPartners: [
      { englishFirstName: 'Carl', englishLastName: 'Ng', englishName: 'Carl Ng', birthdate: '1982-03-03', birthtime: '05:00', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      { englishFirstName: 'Dana', englishLastName: 'Koh', englishName: 'Dana Koh', birthdate: '1983-04-04', birthtime: '06:00', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 }
    ],
    children: [
      { englishFirstName: 'Eve', englishLastName: 'Wong', englishName: 'Eve Wong', birthdate: '2010-01-01', birthtime: '01:00', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      { englishFirstName: 'Finn', englishLastName: 'Wong', englishName: 'Finn Wong', birthdate: '2012-02-02', birthtime: '02:00', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 }
    ],
    home: {
      addresses: {
        profile: { houseNumber: '123', streetName: 'Orchard Rd', unit: '05-12', city: 'Singapore', country: 'Singapore', postalCode: '238859', constructionYear: 2015 },
        checked: [
          { houseNumber: '456', streetName: 'River Valley Rd', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '238001', constructionYear: 2010 },
          { houseNumber: '789', streetName: 'Tanjong Pagar Rd', unit: '10-01', city: 'Singapore', country: 'Singapore', postalCode: '088001', constructionYear: 2018 }
        ]
      }
    },
    people: []
  };
  state.active = 'test@example.com';
  saveState();
  initAuthListeners(); initListeners(); updateStaticLanguage();
`, sandbox);

// Visit every view, and for the account page leave the People "Add Person" form AND the "Check
// Another Address" form both open at once, since a real user could easily have both open.
const views = ['home', 'chart', 'partnerView', 'bizView', 'account', 'hourlyTab', 'childrenView', 'detailedReadingTab'];
let threw = null;
try {
  views.forEach(v => { vm.runInContext(`go('${v}');`, sandbox); });
  vm.runInContext(`
    peopleAddFormOpen = true; renderPeopleManagementList();
    const formDiv = document.getElementById('addAddressForm');
    if (formDiv) formDiv.classList.remove('hidden');
  `, sandbox);
} catch (e) { threw = e; }

if (threw) {
  console.error('FAIL: navigating the app with a rich profile threw: ' + (threw.stack || threw.message));
  process.exit(1);
}

// Scan the WHOLE live document for duplicate ids.
const ids = {};
const allIdEls = dom.window.document.querySelectorAll('[id]');
allIdEls.forEach(el => {
  const id = el.id;
  if (!id) return;
  ids[id] = (ids[id] || 0) + 1;
});
const dupes = Object.entries(ids).filter(([id, count]) => count > 1);

console.log(`Total elements with an id: ${allIdEls.length}`);
console.log(`Total DISTINCT id values: ${Object.keys(ids).length}`);
if (dupes.length) {
  console.log(`\nFOUND ${dupes.length} DUPLICATE id(s):`);
  dupes.forEach(([id, count]) => console.log(`  id="${id}" appears ${count} times`));
  process.exit(1);
} else {
  console.log('\nNo duplicate ids found in the live DOM across every view, with 2 children, 2 additional business partners, 2 household occupants, 2 checked addresses, and both the "Add Person" and "Check Another Address" forms open simultaneously.');
}
