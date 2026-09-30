const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Phase 1's household-occupant full data collection (from the large combined list:
// "household occupants need full data collection for household deep analysis" - previously occupants
// only ever collected a bare birth YEAR, enough for a Kua number but not a real BaZi chart).
//
// Covers:
// 1. migrateOccupantBirthData() - a real, already-saved account with old {year, gender}-only
//    occupants gets a placeholder birthdate backfilled, clearly marked approximateBirth: true, without
//    losing or corrupting anything else in that account.
// 2. The migration is idempotent and safe for a mixed account (some old occupants, some already
//    migrated/new-format) and for occupants nested under different profile slots (individual, partner,
//    business partner, children) - not just the individual's own profile.
// 3. Regression: an account with NO occupants at all is untouched, and saveState() is not called
//    (verified via localStorage.setItem count) when nothing needed migrating.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function buildSandbox(initialUsers) {
  const storage = {};
  let setItemCalls = 0;
  const localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { setItemCalls++; storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
  };
  storage['illuminate-local-v101'] = JSON.stringify({ users: initialUsers, active: Object.keys(initialUsers)[0] || null });
  const sandbox = { localStorage, console: Object.assign({}, console, { warn: () => {}, error: () => {} }), Date, Math, JSON, Array, Object, String, Number };
  sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-core.js'), 'utf8'), sandbox, { filename: 'engine-core.js' });
  return { sandbox, storage, getSetItemCalls: () => setItemCalls, run: (code) => vm.runInContext(code, sandbox) };
}

let threw = null;
try {
  // --- Test 1: a real account with old-format occupants gets migrated correctly. ---
  {
    const { run } = buildSandbox({
      roy: {
        profile: { englishName: 'Roy', bazhaiOccupants: [
          { year: 1988, gender: 'male' },
          { year: 1955, gender: 'female' },
        ] },
      },
    });
    const occ = run("state.users['roy'].profile.bazhaiOccupants");
    check(occ[0].birthdate === '1988-06-15', 'BUG FIX VERIFIED: old year-only occupant #1 backfilled with a June 15th placeholder birthdate matching its original year');
    check(occ[0].approximateBirth === true, 'old occupant #1 is explicitly marked approximateBirth: true, never silently presented as a precise date');
    check(occ[0].year === 1988, 'the original year field is preserved (not overwritten) for backward compatibility with getOccupantKua');
    check(occ[1].birthdate === '1955-06-15' && occ[1].approximateBirth === true, 'old occupant #2 (a different year/gender) is also correctly migrated');
    check(occ[0].birthtime === '' && occ[1].birthtime === '', 'migrated occupants get an empty (not undefined) birthtime, matching the shape new occupants use');
  }

  // --- Test 2: migration reaches occupants nested under partner/business-partner/child profiles too,
  // not just the individual's own profile - even though today's UI only ever ADDS them to the
  // individual, the migration itself should not assume that will always remain true. ---
  {
    const { run } = buildSandbox({
      roy: {
        profile: { englishName: 'Roy' },
        partner: { englishName: 'Partner', bazhaiOccupants: [{ year: 1990, gender: 'female' }] },
        businessPartner: { englishName: 'Biz', bazhaiOccupants: [{ year: 1980, gender: 'male' }] },
        additionalBizPartners: [{ englishName: 'Biz2', bazhaiOccupants: [{ year: 1975, gender: 'male' }] }],
        children: [{ englishName: 'Kid', bazhaiOccupants: [{ year: 2010, gender: 'female' }] }],
      },
    });
    check(run("state.users['roy'].partner.bazhaiOccupants[0].birthdate") === '1990-06-15', 'migration reaches occupants under the partner profile');
    check(run("state.users['roy'].businessPartner.bazhaiOccupants[0].birthdate") === '1980-06-15', 'migration reaches occupants under the business partner profile');
    check(run("state.users['roy'].additionalBizPartners[0].bazhaiOccupants[0].birthdate") === '1975-06-15', 'migration reaches occupants under an additional business partner profile');
    check(run("state.users['roy'].children[0].bazhaiOccupants[0].birthdate") === '2010-06-15', 'migration reaches occupants under a child profile');
  }

  // --- Test 3: a mixed account (one old occupant needing migration, one already in the new format) -
  // the already-migrated one is left completely untouched. ---
  {
    const { run } = buildSandbox({
      roy: { profile: { englishName: 'Roy', bazhaiOccupants: [
        { year: 1988, gender: 'male' },
        { name: 'Grandma', year: 1950, birthdate: '1950-03-02', birthtime: '08:15', gender: 'female', approximateBirth: false },
      ] } },
    });
    const occ = run("state.users['roy'].profile.bazhaiOccupants");
    check(occ[0].approximateBirth === true && occ[0].birthdate === '1988-06-15', 'the old-format occupant in a mixed account is still migrated correctly');
    check(occ[1].birthdate === '1950-03-02' && occ[1].birthtime === '08:15' && occ[1].approximateBirth === false && occ[1].name === 'Grandma', 'the already-real-data occupant in the SAME account is left completely untouched by the migration (not overwritten with a placeholder)');
  }

  // --- Test 4: regression - an account with no occupants at all (or no bazhaiOccupants field) is
  // untouched, and the migration correctly detects nothing to do (no wasted save). ---
  {
    const { run, getSetItemCalls } = buildSandbox({ roy: { profile: { englishName: 'Roy' } } });
    check(run("state.users['roy'].profile.bazhaiOccupants") === undefined, 'an account with no occupants field at all is left exactly as-is (no empty array invented)');
    check(getSetItemCalls() === 0, 'no wasted save occurs when there is nothing to migrate (setItem was never called beyond the initial fixture write, which happens outside the sandboxed engine-core.js load)');
  }

  // --- Test 5: idempotency - running the migration logic twice on the same already-migrated data
  // produces no further changes (simulates the app reloading after a migration already ran once). ---
  {
    const { run } = buildSandbox({ roy: { profile: { englishName: 'Roy', bazhaiOccupants: [{ year: 1988, gender: 'male' }] } } });
    const before = JSON.stringify(run("state.users['roy'].profile.bazhaiOccupants"));
    run('migrateOccupantBirthData();'); // call it again, simulating a second load
    const after = JSON.stringify(run("state.users['roy'].profile.bazhaiOccupants"));
    check(before === after, 'BUG FIX VERIFIED: running the migration a second time on already-migrated data is a no-op (idempotent) - it never re-stamps a fresh placeholder over a real or already-migrated date');
  }
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
