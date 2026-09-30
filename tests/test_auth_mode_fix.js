const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for "unable to login when an existing account exist" and "also unable to create
// new account" - both traced to the same root cause: the `signup` boolean (which decides whether
// Submit creates a new account or validates a login) was never set explicitly by the Welcome screen's
// "Create an account" / "Sign in" buttons, so whichever mode it was last left in silently controlled
// what actually happened, regardless of which button was clicked - and the in-form toggle never
// updated any visible text, so there was no way to see which mode was active.
//
// This drives the REAL auth.js/app.js code end-to-end via jsdom: clicking the real buttons, dispatching
// real click events, and checking real state.users / real DOM text afterward.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const html = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
check(!/data-go="auth"[^>]*id="btnCreateAcc"/.test(html) && !/id="btnCreateAcc"[^>]*data-go="auth"/.test(html),
  'btnCreateAcc no longer relies on the generic data-go handler for its auth intent');
check(!/data-go="auth"[^>]*id="btnSignIn"/.test(html) && !/id="btnSignIn"[^>]*data-go="auth"/.test(html),
  'btnSignIn no longer relies on the generic data-go handler for its auth intent');

function buildSandbox() {
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
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js'); loadFile('engine-predictions.js');
  loadFile('app.js'); loadFile('auth.js');
  run("initAuthListeners(); initListeners(); updateStaticLanguage(); go('welcome');");
  return { run };
}

function click(run, id) { run(`document.getElementById(${JSON.stringify(id)}).dispatchEvent(new window.Event('click', {bubbles:true}));`); }
function type(run, id, value) { run(`document.getElementById(${JSON.stringify(id)}).value = ${JSON.stringify(value)};`); }

let threw = null;
try {
  // --- Test 1: signing up a genuinely new account still works (regression) via the real button. ---
  {
    const { run } = buildSandbox();
    click(run, 'btnCreateAcc');
    check(run("document.querySelector('.view.active')?.id") === 'auth', 'Create an account navigates to the auth screen');
    check(run('signup') === true, 'clicking "Create an account" sets signup = true');
    check(run("document.getElementById('authSubmit').textContent") === 'Create account', 'the Submit button reads "Create account" in create mode');
    check(run("document.getElementById('authTitle').textContent") === 'Welcome', 'the title reflects create mode');
    type(run, 'email', 'newuser@example.com'); type(run, 'password', 'pw123456');
    click(run, 'authSubmit');
    check(run("state.users['newuser@example.com']") !== undefined, 'a brand-new account is actually created');
    check(run("state.active") === 'newuser@example.com', 'the new account becomes the active session');
  }

  // --- Test 2 (BUG FIX VERIFIED - the exact reported "unable to login" symptom): an EXISTING account
  // with a real profile must NOT be wiped out when the user clicks "Sign in" and enters correct
  // credentials, even though `signup` defaults to true and was never touched in this fresh session. ---
  {
    const { run } = buildSandbox();
    run(`
      state.users['existing@example.com'] = {
        name: 'existing', email: 'existing@example.com', password: 'correcthorse',
        profile: { englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
          birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
          birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
        partner: null, businessPartner: null, children: [],
      };
      saveState();
    `);
    check(run('signup') === true, "sanity: signup still defaults to true in a fresh session, before any button is clicked");
    click(run, 'btnSignIn');
    check(run('signup') === false, 'BUG FIX VERIFIED: clicking "Sign in" explicitly sets signup = false, regardless of its previous/default value');
    check(run("document.getElementById('authSubmit').textContent") === 'Sign in', 'the Submit button now reads "Sign in", not "Create account"');
    check(run("document.getElementById('authTitle').textContent") === 'Welcome back', 'the title now reflects sign-in mode');
    type(run, 'email', 'existing@example.com'); type(run, 'password', 'correcthorse');
    click(run, 'authSubmit');
    check(run("document.querySelector('.view.active')?.id") === 'home', 'BUG FIX VERIFIED: signing in with correct credentials for an existing profile lands on home, not a wiped-out intake form');
    check(run("state.users['existing@example.com'].profile.englishName") === 'Roy Wong',
      'BUG FIX VERIFIED: the existing account\'s real profile survives login intact - it is no longer silently overwritten by the create-account branch');
    check(run("state.active") === 'existing@example.com', 'the existing account is now the active session');
  }

  // --- Test 3: wrong password on Sign In is still correctly rejected (regression - the fix must not
  // make login bypass credential checking). ---
  {
    const { run } = buildSandbox();
    run(`
      state.users['existing2@example.com'] = { name: 'e2', email: 'existing2@example.com', password: 'realpassword', profile: { englishName: 'E2' } };
      saveState();
    `);
    click(run, 'btnSignIn');
    type(run, 'email', 'existing2@example.com'); type(run, 'password', 'WRONGpassword');
    click(run, 'authSubmit');
    check(run("document.getElementById('authError').textContent") === 'Invalid credentials.', 'a wrong password on Sign In is still correctly rejected');
    check(run('state.active') !== 'existing2@example.com', 'a rejected login does not set an active session');
  }

  // --- Test 4 (BUG FIX VERIFIED - the exact reported "unable to create new account" symptom): after
  // using the in-form "I already have an account" toggle (which leaves `signup` at false), clicking
  // "Create an account" again from the Welcome screen for a genuinely NEW account must actually create
  // it, not silently run the login branch and report "Invalid credentials". ---
  {
    const { run } = buildSandbox();
    // Simulate having toggled to sign-in mode at some point in this session.
    click(run, 'btnSignIn');
    check(run('signup') === false, 'sanity: signup is now false after using Sign In once');
    // Go back to Welcome and click "Create an account" for a second, brand-new account.
    run("go('welcome');");
    click(run, 'btnCreateAcc');
    check(run('signup') === true, 'BUG FIX VERIFIED: clicking "Create an account" again resets signup = true, regardless of it having been left false by a prior Sign In');
    check(run("document.getElementById('authSubmit').textContent") === 'Create account', 'the Submit button correctly reads "Create account" again');
    type(run, 'email', 'brandnew@example.com'); type(run, 'password', 'freshpw1');
    click(run, 'authSubmit');
    check(run("document.getElementById('authError').textContent") !== 'Invalid credentials.', 'BUG FIX VERIFIED: creating a genuinely new account no longer gets rejected as "Invalid credentials"');
    check(run("state.users['brandnew@example.com']") !== undefined, 'the new account is actually created this time');
    check(run("state.active") === 'brandnew@example.com', 'the newly created account becomes active');
  }

  // --- Test 5: the in-form toggle itself flips both signup and the visible text (regression + the
  // "no visible indication of mode" half of the bug). ---
  {
    const { run } = buildSandbox();
    click(run, 'btnCreateAcc');
    check(run("document.getElementById('modeToggle').textContent") === 'I already have an account', 'toggle button label matches create mode');
    click(run, 'modeToggle');
    check(run('signup') === false, 'the in-form toggle still flips signup as before');
    check(run("document.getElementById('modeToggle').textContent") === "I don't have an account yet",
      'BUG FIX VERIFIED: the toggle button\'s own label now visibly changes to reflect the new mode (previously it never changed)');
    check(run("document.getElementById('authSubmit').textContent") === 'Sign in', 'Submit button text updates immediately when toggling, without needing to leave and re-enter the screen');
  }

  // --- Test 6: navigating to auth some OTHER way (the unauthenticated-access early return in go())
  // still shows text matching whatever signup currently is - the safety net in go() itself. ---
  {
    const { run } = buildSandbox();
    run('signup = false;'); // simulate having been left in sign-in mode
    run("go('home');"); // no active user -> go() internally redirects to 'auth'
    check(run("document.querySelector('.view.active')?.id") === 'auth', 'an unauthenticated attempt to reach a protected view redirects to auth');
    check(run("document.getElementById('authSubmit').textContent") === 'Sign in', 'BUG FIX VERIFIED: go()\'s own safety net keeps the auth screen text in sync with signup even when reached by a path other than the two Welcome buttons');
  }
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
