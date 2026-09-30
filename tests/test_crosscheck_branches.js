const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
process.on('unhandledRejection', () => {});
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { JSDOM } = require('jsdom');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');

function buildSandboxWithUser(profile) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  const STORAGE_KEY = 'illuminate-local-v101';
  const testUser = { email: 'test@test.com', password: 'x', profile };
  const storageBacking = { [STORAGE_KEY]: JSON.stringify({ users: { 'test@test.com': testUser }, active: 'test@test.com' }) };
  const localStorage = { getItem: (k) => (k in storageBacking ? storageBacking[k] : null), setItem: (k, v) => { storageBacking[k] = String(v); }, removeItem: (k) => { delete storageBacking[k]; } };
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: dom.window.document, window: dom.window,
    alert: () => {}, requestAnimationFrame: (fn) => setTimeout(fn, 0),
  };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js');
  try { load('app.js'); } catch (e) { }
  return sandbox;
}

const people = {
  Roy: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male' },
  Tina: { englishFirstName: 'Tina', englishLastName: 'Seah', birthdate: '1976-04-25', birthtime: '10:21', gender: 'female' },
  Bobby: { englishFirstName: 'Bobby', englishLastName: 'Neo', birthdate: '1965-06-27', birthtime: '05:28', gender: 'male' },
  Deana: { englishFirstName: 'Deana', englishLastName: 'Ling', birthdate: '1972-07-09', birthtime: '10:00', gender: 'female' },
};

const branchesToTest = ['ziwei', 'tai_yi', 'da_liu_ren', 'dayMaster', 'bazi_macro', 'qmdj', 'boneWeight', 'numerology', 'name', 'iching', 'zodiac', 'astro'];

for (const branch of branchesToTest) {
  const outputs = {};
  for (const [name, prof] of Object.entries(people)) {
    const sandbox = buildSandboxWithUser(prof);
    const p = vm.runInContext(`getProfileData()`, sandbox);
    sandbox.__p = p;
    const raw = vm.runInContext(`generateDeepAnalysisData(${JSON.stringify(branch)}, __p, null, true)`, sandbox);
    outputs[name] = raw ? raw.chars : '(no output)';
  }
  console.log(`\n=== ${branch} ===`);
  for (const [name, txt] of Object.entries(outputs)) {
    console.log(`${name}: ${txt}`);
  }
  const vals = Object.values(outputs);
  const allSame = vals.every(v => v === vals[0]);
  console.log(allSame ? '*** WARNING: all identical ***' : 'OK: varies across people');
}
