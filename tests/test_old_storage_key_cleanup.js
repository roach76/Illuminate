const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies a second contributor to the reported localStorage-quota problem: loadState() has always
// migrated data from an older storage-format key (illuminate-local-v100/-v99/-v98) when the current
// key is empty, but never deleted the old key afterward. Since localStorage's quota is shared across
// every key on the same origin (not per-key), a long-time user who has been through more than one
// format bump could have several complete, stale copies of their entire account sitting in storage at
// once, all counting against the same quota as the one copy actually in use.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function buildSandbox(initialStorage) {
  const storage = Object.assign({}, initialStorage);
  const localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
  };
  const sandbox = { localStorage, console, Date, Math, JSON, Array, Object, String, Number };
  sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-core.js'), 'utf8'), sandbox, { filename: 'engine-core.js' });
  return { sandbox, storage };
}

let threw = null;
try {
  // --- Test 1 (BUG FIX VERIFIED): after loading with old-format keys present (whether or not they
  // were actually the source of migration), all of them are removed, freeing real, shared quota. ---
  {
    const oldState = JSON.stringify({ users: { 'old@example.com': { name: 'old', profile: { englishName: 'Old User' } } }, active: 'old@example.com' });
    const { storage } = buildSandbox({
      'illuminate-local-v100': oldState,
      'illuminate-local-v99': oldState,
      'illuminate-local-v98': oldState,
    });
    check(!('illuminate-local-v100' in storage), 'BUG FIX VERIFIED: the old v100 key is removed after load, freeing shared-origin quota it was needlessly occupying');
    check(!('illuminate-local-v99' in storage), 'the old v99 key is also removed');
    check(!('illuminate-local-v98' in storage), 'the old v98 key is also removed');
  }

  // --- Test 2: a genuine migration (current key empty, only an old key has data) still correctly
  // loads that data into `state` BEFORE the old key is cleaned up - the fix must not lose data. ---
  {
    const oldState = JSON.stringify({ users: { 'migrated@example.com': { name: 'm', profile: { englishName: 'Migrated User' } } }, active: 'migrated@example.com' });
    const { sandbox, storage } = buildSandbox({ 'illuminate-local-v99': oldState });
    check(sandbox.state.users['migrated@example.com'].profile.englishName === 'Migrated User', 'data is still correctly migrated into the live in-memory state from an old-format key');
    check(sandbox.state.active === 'migrated@example.com', 'the active user is correctly migrated too');
    check(!('illuminate-local-v99' in storage), 'the old key is cleaned up only AFTER its data has already been loaded into memory - nothing is lost');
  }

  // --- Test 3: normal case - no old keys present at all (a fresh install, or one already cleaned up
  // by this very fix on a previous run) - cleanup is a silent no-op, no errors. ---
  {
    const currentState = JSON.stringify({ users: { 'cur@example.com': { name: 'c', profile: { englishName: 'Current' } } }, active: 'cur@example.com' });
    const { sandbox, storage } = buildSandbox({ 'illuminate-local-v101': currentState });
    check(sandbox.state.active === 'cur@example.com', 'normal load from the current key still works exactly as before (regression)');
    check(Object.keys(storage).length === 1 && 'illuminate-local-v101' in storage, 'with no old keys present, nothing is touched beyond the current key');
  }

  // --- Test 4: the live current-format key is NEVER touched by cleanup, even when old keys also
  // happen to be present (the "already migrated a while ago, old keys just never got swept" case). ---
  {
    const currentState = JSON.stringify({ users: { 'cur2@example.com': { name: 'c2', profile: { englishName: 'Current Two' } } }, active: 'cur2@example.com' });
    const oldState = JSON.stringify({ users: { 'stale@example.com': {} }, active: 'stale@example.com' });
    const { sandbox, storage } = buildSandbox({ 'illuminate-local-v101': currentState, 'illuminate-local-v100': oldState });
    check(sandbox.state.active === 'cur2@example.com', 'the CURRENT key\'s data is what actually loads, never the stale old-key data, when both exist');
    check('illuminate-local-v101' in storage, 'the live current-format key survives cleanup untouched');
    check(!('illuminate-local-v100' in storage), 'BUG FIX VERIFIED: a stale old key sitting alongside an already-current one (the realistic "been through a version bump a while ago" case) is still swept away');
    check(JSON.parse(storage['illuminate-local-v101']).active === 'cur2@example.com', 'the current key\'s own content is completely unchanged by the cleanup pass');
  }

  // --- Test 5: cleanupOldStorageKeys() is exposed and idempotent - calling it again when there's
  // nothing left to clean does not throw. ---
  {
    const { sandbox } = buildSandbox({});
    check(typeof sandbox.cleanupOldStorageKeys === 'function', 'cleanupOldStorageKeys is defined and callable');
    let secondCallThrew = false;
    try { vm.runInContext('cleanupOldStorageKeys();', sandbox); } catch (e) { secondCallThrew = true; }
    check(!secondCallThrew, 'calling cleanup again with nothing left to remove does not throw');
  }
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
