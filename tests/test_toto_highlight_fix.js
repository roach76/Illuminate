const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for "TOTO number highlights should appear on the suggested numbers rather than on
// past results" (and the identical pattern in 4D, fixed the same way): actual-result numbers no longer
// get a "hl-act-direct"/"hl-act-box" hit-highlight just because they coincide with a suggestion; that
// highlighting now lives only on the Suggested Numbers grid, which already worked correctly and is
// unchanged. Favourite-number highlighting (a distinct feature) is preserved on actual results.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
const sandbox = { console, Math, Date, JSON, Array, Object, String, Number };
sandbox.global = sandbox;
vm.createContext(sandbox);
function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
function run(code) { return vm.runInContext(code, sandbox); }

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

let threw = null;
try {
  // engine-predictions.js references some engine-core globals (bt, etc.) only inside functions not
  // exercised here, and the two functions under test are pure - load it standalone.
  loadFile('engine-predictions.js');

  // --- TOTO ---
  // A number that IS one of the suggested numbers, present in an actual past draw, with NO favourite
  // numbers on file: should render as a PLAIN number now (no hit span), since hit highlighting belongs
  // on the suggested-numbers grid, not on the actual-result list.
  const suggestedSets = [[1,2,3,4,5,6,7]];
  const plainHit = run(`highlightWithFavouritesTOTO(3, ${JSON.stringify(suggestedSets)}, [], false)`);
  check(String(plainHit) === '3', `BUG FIX VERIFIED: an actual-result TOTO number matching a suggestion is no longer highlighted (got: ${plainHit})`);
  check(!String(plainHit).includes('hl-act-direct'), 'no hl-act-direct span present');

  // A number that is NOT a favourite and NOT a suggestion: still plain.
  const plainMiss = run(`highlightWithFavouritesTOTO(42, ${JSON.stringify(suggestedSets)}, [], false)`);
  check(String(plainMiss) === '42', 'a non-matching, non-favourite actual-result number renders plain');

  // Favourite-number highlighting must still work (distinct feature, not touched by this fix).
  const favMain = run(`highlightWithFavouritesTOTO(9, ${JSON.stringify(suggestedSets)}, [9], false)`);
  check(favMain.includes('hl-fav-exact') && favMain.includes('9'), 'favourite-number highlighting on the main numbers still works (hl-fav-exact)');
  const favAdd = run(`highlightWithFavouritesTOTO(9, ${JSON.stringify(suggestedSets)}, [9], true)`);
  check(favAdd.includes('hl-fav-perm') && favAdd.includes('9'), 'favourite-number highlighting on the additional-number slot still works (hl-fav-perm)');

  // The Suggested Numbers grid's own highlighting mechanism (checkTOTOHit, used directly in
  // renderLotteryPredictions) must be completely untouched by this fix.
  const hitCheck = run(`checkTOTOHit(3, {winning:[1,2,3,4,5,6], additional:7})`);
  check(hitCheck === true, 'regression: checkTOTOHit (used for the Suggested Numbers grid highlighting) still works correctly');

  // --- 4D (same pattern, fixed the same way) ---
  const suggested4D = ['1234', '5678'];
  const plain4D = run(`highlightWithFavourites4D('1234', ${JSON.stringify(suggested4D)}, [])`);
  check(plain4D === '1234', `BUG FIX VERIFIED (4D, same pattern): an actual-result 4D number matching a suggestion is no longer highlighted (got: ${plain4D})`);
  const fav4D = run(`highlightWithFavourites4D('1234', ${JSON.stringify(suggested4D)}, ['1234'])`);
  check(fav4D.includes('hl-fav-exact'), 'favourite-number highlighting for 4D actual results still works');
  const hitCheck4D = run(`check4DHit('1234', ${JSON.stringify(suggested4D)})`);
  check(hitCheck4D === 'direct', 'regression: check4DHit (used for the 4D Suggested Numbers grid highlighting) still works correctly');
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
