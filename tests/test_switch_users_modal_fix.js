const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for "buttons not responding after switching users" / "cannot log out after
// switching to a different user": the Deep Analysis modal overlay must now be force-closed by go()
// on every navigation, so it can never survive a sign-out or persist into a different user's session.
// This replays the exact repro that first surfaced the bug (repro_switch_users.js), asserting the
// overlay is properly hidden at each step instead of just printing its state for inspection.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
const html = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
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

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// Static check first.
const src = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const goFnStart = src.indexOf('function go(viewId) {');
const goFnSnippet = src.slice(goFnStart, goFnStart + 1500);
check(goFnSnippet.includes("getElementById('deepAnalysisModalOverlay')"), 'go() references the modal overlay');
check(goFnSnippet.includes("openModal.classList.add('hidden')"), 'go() force-closes the modal overlay');
// Must happen BEFORE the early-return-to-auth check, so it runs on every single call to go(), including
// the one triggered by signing out.
const modalFixIdx = goFnSnippet.indexOf("openModal.classList.add('hidden')");
const earlyReturnIdx = goFnSnippet.indexOf("return go('auth')");
check(modalFixIdx !== -1 && earlyReturnIdx !== -1 && modalFixIdx < earlyReturnIdx, 'modal is force-closed before any early return, so it always runs');

let threw = null;
try {
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js'); loadFile('engine-predictions.js');
  loadFile('app.js'); loadFile('auth.js');
  run("initAuthListeners(); initListeners(); updateStaticLanguage(); go('welcome');");

  function fillAndSubmitAuth(email, password, isSignup) {
    run(`signup = ${isSignup};`);
    run(`document.getElementById('email').value = ${JSON.stringify(email)};`);
    run(`document.getElementById('password').value = ${JSON.stringify(password)};`);
    run("document.getElementById('authSubmit').dispatchEvent(new window.Event('click', {bubbles:true}));");
  }

  // User A signs up, completes intake, opens a Deep Analysis modal WITHOUT closing it.
  fillAndSubmitAuth('usera@example.com', 'pw1', true);
  run(`
    state.users['usera@example.com'].profile = {
      englishFirstName: 'Alice', englishLastName: 'Tan', englishName: 'Alice Tan',
      birthdate: '1990-01-01', birthtime: '10:00', gender: 'female',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
    };
    saveState();
  `);
  run("go('home'); go('chart');");
  const hasDeepBtn = run("!!document.querySelector('.btnViewDeepAnalysis')");
  check(hasDeepBtn, 'sanity: chart view has at least one Deep Analysis button');
  run("document.querySelector('.btnViewDeepAnalysis').dispatchEvent(new window.MouseEvent('click', {bubbles:true, clientX:10, clientY:10}));");
  check(run("document.getElementById('deepAnalysisModalOverlay').classList.contains('hidden')") === false, 'sanity: modal is genuinely open after clicking View Details');

  // THE FIX: sign out WITHOUT closing the modal first - it must not survive navigation.
  run("document.getElementById('signOut').dispatchEvent(new window.Event('click', {bubbles:true}));");
  check(run('state.active') === null, 'sign-out succeeded (active user cleared)');
  check(run("document.querySelector('.view.active')?.id") === 'welcome', 'sign-out navigated to the welcome view');
  check(run("document.getElementById('deepAnalysisModalOverlay').classList.contains('hidden')") === true,
    'BUG FIX VERIFIED: modal overlay is closed after sign-out, even though it was never explicitly dismissed');

  // User B signs up (the "switch to a different user" moment), also opens a modal, and must still be
  // able to reach and click Sign Out afterwards.
  fillAndSubmitAuth('userb@example.com', 'pw2', true);
  run(`
    state.users['userb@example.com'].profile = {
      englishFirstName: 'Bob', englishLastName: 'Lim', englishName: 'Bob Lim',
      birthdate: '1985-05-05', birthtime: '14:00', gender: 'male',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
    };
    saveState();
  `);
  run("go('home'); go('chart');");
  run("document.querySelector('.btnViewDeepAnalysis').dispatchEvent(new window.MouseEvent('click', {bubbles:true, clientX:10, clientY:10}));");
  check(run("document.getElementById('deepAnalysisModalOverlay').classList.contains('hidden')") === false, 'sanity: User B also has the modal genuinely open');
  run("go('account');"); // simulate navigating to the settings/account screen where Sign Out lives
  check(run("document.getElementById('deepAnalysisModalOverlay').classList.contains('hidden')") === true, 'modal is already closed by the time User B reaches the account screen (would no longer block the Sign Out button)');
  run("document.getElementById('signOut').dispatchEvent(new window.Event('click', {bubbles:true}));");
  check(run('state.active') === null, 'BUG FIX VERIFIED: User B can sign out cleanly after switching users, even after having opened a modal');
  check(run("document.querySelector('.view.active')?.id") === 'welcome', 'User B sign-out navigated to the welcome view');
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
