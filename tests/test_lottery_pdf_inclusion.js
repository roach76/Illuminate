const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for "statistic missing for predicted numbers for toto and 4d" (clarified by the user
// as: the historical hit-rate/accuracy tracking). Investigation found the underlying accuracy computation
// (computeHistoricalAccuracy) was already working correctly and showing real numbers live in the app -
// the actual bug was one level up: the WHOLE 4D/TOTO Predictions section (verified results, upcoming
// predictions, and the historical-accuracy stats bundled inside it) lives in its own dedicated
// #fourDContainer/#totoContainer elements in index.html, outside the per-profile chart-tab system
// buildProfilePdfHTML pulls a PDF's body from - so none of it was ever included in any profile's PDF
// export. Fixed by having renderLotteryPredictions return its two built HTML strings (in addition to
// still writing them into the DOM containers, unchanged, for the live on-screen view) and having
// buildProfilePdfHTML include them for the main profile.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const predSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-predictions.js'), 'utf8');

// --- Static source checks -------------------------------------------------
check(/return \{ html4D, htmlToto \};/.test(predSrc), 'renderLotteryPredictions now returns its built HTML strings');
check(/const lotteryHtml = \(typeof renderLotteryPredictions === 'function'\) \? renderLotteryPredictions\(p\) : null;/.test(appSrc), 'buildProfilePdfHTML calls renderLotteryPredictions and captures its return value');
check(/bodyHTML \+= wrapSectionCollapsible\(`<h2 class="section-header">\$\{bt\('Singapore Pools 4D Results and Predictions'/.test(appSrc), '4D section is appended to the PDF body, wrapped like every other added section');
check(/bodyHTML \+= wrapSectionCollapsible\(`<h2 class="section-header">\$\{bt\('Singapore Pools TOTO Results and Predictions'/.test(appSrc), 'TOTO section is appended to the PDF body, wrapped like every other added section');

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
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
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { dom, sandbox };
}

const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};

// --- 1. renderLotteryPredictions returns real HTML strings, and DOM behavior is unchanged -----------
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`
    state.users['test@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test@test.com';
    go('chart');
    document.body.insertAdjacentHTML('beforeend', '<div id="fourDContainer"></div><div id="totoContainer"></div>');
  `, sandbox);
  const p = vm.runInContext(`getProfileData()`, sandbox);
  vm.runInContext(`window.__testP = getProfileData();`, sandbox);
  const result = vm.runInContext(`renderLotteryPredictions(window.__testP)`, sandbox);
  check(result && typeof result.html4D === 'string' && result.html4D.length > 100, 'renderLotteryPredictions returns a real, non-trivial html4D string');
  check(result && typeof result.htmlToto === 'string' && result.htmlToto.length > 100, 'renderLotteryPredictions returns a real, non-trivial htmlToto string');
  const domFourD = vm.runInContext(`document.getElementById('fourDContainer').innerHTML`, sandbox);
  const domToto = vm.runInContext(`document.getElementById('totoContainer').innerHTML`, sandbox);
  check(domFourD.length > 100, 'the live #fourDContainer DOM write still happens exactly as before (unchanged for the on-screen Lottery view)');
  check(domToto.length > 100, 'the live #totoContainer DOM write still happens exactly as before (unchanged for the on-screen Lottery view)');
  check(domFourD === result.html4D, 'the returned html4D string is exactly what got written into the DOM container (no divergence between the two)');
}

// --- 2. buildProfilePdfHTML('i') now includes the lottery section, including the accuracy stats ------
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`
    state.users['test@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test@test.com';
    go('chart');
  `, sandbox);
  // Seed enough checked lottery history so computeHistoricalAccuracy returns ready:true (needs >= 10
  // checked draws) - mirrors the real account state this bug was reported against (51 checked draws).
  vm.runInContext(`
    const mkHit = () => ({ bestHitType: 'none', anyExact: false, anyPermOnly: false, hitByTier: { first:false, second:false, third:false, starter:false, consolation:false } });
    const log = [];
    for (let i = 0; i < 12; i++) {
      log.push({ isoDate: '2026-08-' + String(i+1).padStart(2,'0'), sets: ['1234'], generatedAt: new Date().toISOString(), checked: true, actual: { winning: ['9999'] }, hitSummary: mkHit() });
    }
    state.users['test@test.com'].lotteryLog = { fourD: log, toto: log.map(e => ({...e, hitSummary: { bestMainMatches: 1, anyAdditionalMatch: false, bestGroup: 7 }})) };
  `, sandbox);
  const pdfHtml = vm.runInContext(`buildProfilePdfHTML('i')`, sandbox);
  check(typeof pdfHtml === 'string' && pdfHtml.length > 1000, 'buildProfilePdfHTML(\'i\') returns real HTML');
  check(pdfHtml.includes('Historical Accuracy'), 'the PDF export now includes the "Historical Accuracy" hit-rate stats block (previously entirely absent)');
  check(pdfHtml.includes('Singapore Pools 4D'), 'the PDF export includes the 4D predictions section');
  check(pdfHtml.includes('Singapore Pools TOTO') || pdfHtml.includes('TOTO Results'), 'the PDF export includes the TOTO predictions section');
  check(pdfHtml.includes('12 draws verified') || /\(\d+ draws verified\)/.test(pdfHtml), 'the accuracy block shows a real checked-draw count, not a placeholder');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
