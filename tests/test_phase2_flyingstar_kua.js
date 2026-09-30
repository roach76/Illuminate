const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Phase 2's Kua x Flying Star cross-reference reading - closing the exact gap this app's own
// Flying Star honesty note flagged in a code comment: property Mountain/Facing charts were computed
// but "None of these charts have yet been read against any specific property's own Mountain/Facing
// chart above - that combination reading is a further step not attempted here" (re: the Kua-vs-
// property combination specifically; see app.js's flyingstar_household_kua branch's own comment for
// the precise scope this closes).
//
// Covers:
// 1. Static regression guard: the new branch and its wiring into the rendered Feng Shui section exist.
// 2. Behavioral: extracts and runs the REAL flyingstar_household_kua branch body verbatim against a
//    real computeFlyingStarChart() output and a real household roster, proving the "reinforced" vs
//    "undercut" verdict for each person is genuinely derived by looking up the ACTUAL Mountain/Facing
//    star at THEIR OWN best Ba Zhai direction (not a generic or hardcoded verdict), cross-checked
//    against the same FLYING_STAR_NATURE table the property-calculator reading already uses.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const engineSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8');

// --- Static regression guards ---
check(/type === 'flyingstar_household_kua' && extraData && extraData\.chart && extraData\.roster/.test(appSrc), 'a flyingstar_household_kua deep-analysis branch is wired in generateDeepAnalysisData');
check(/const anyUnfavourable = mNature\?\.favourable === false \|\| fNature\?\.favourable === false;/.test(appSrc), 'BUG FIX VERIFIED: the verdict is derived from the REAL FLYING_STAR_NATURE ratings of the Mountain/Facing stars at each person\'s own best direction, not a placeholder');
check(/id="fs-household-kua-analysis-\$\{prefix\}"/.test(appSrc), 'the reading is wired into the rendered Feng Shui property-calculator section');
check(/const fsHouseholdChart = computeFlyingStarChart\(u\.home\.constructionYear, DIR_FULL_TO_SHORT\[fsDirVal\]\);/.test(appSrc), 'the reading is driven by the REAL computeFlyingStarChart() output for this specific saved property, not a synthetic/example chart');
check(/const shortDir = DIR_FULL_TO_SHORT\[bestDirRaw\.direction\];/.test(appSrc), 'BUG FIX VERIFIED: the branch converts findBestBazhaiDirection\'s full-name direction ("Southeast") to the short code ("SE") that computeFlyingStarChart\'s palaces are actually keyed by, before doing any chart lookup - without this, every palace lookup would silently return undefined');

// --- Behavioral: extract and run the REAL branch body verbatim ---
let threw = null;
try {
  const branchStart = appSrc.indexOf("} else if (type === 'flyingstar_household_kua'");
  const branchEnd = appSrc.indexOf("} else if (type === 'flyingstar_temporal'", branchStart);
  check(branchStart !== -1 && branchEnd !== -1, 'located the real flyingstar_household_kua branch body');
  const branchBody = appSrc.slice(branchStart, branchEnd).replace(/^\} else if/, 'if') + '\n}';

  // Pull in the exact real supporting tables/functions this branch depends on, verbatim.
  const natureStart = appSrc.indexOf('const FLYING_STAR_NATURE = {');
  const natureEnd = appSrc.indexOf('\n}\n', appSrc.indexOf('function findBestBazhaiDirection')) + 3;
  const supportSrc = appSrc.slice(natureStart, natureEnd);
  check(supportSrc.includes('function findBestBazhaiDirection'), 'extracted the real FLYING_STAR_NATURE table + findBestBazhaiDirection() verbatim');

  const dirLabelsStart = appSrc.indexOf('const FLYING_STAR_DIR_LABEL_EN');
  const dirLabelsSrc = appSrc.slice(dirLabelsStart, appSrc.indexOf('\n', appSrc.indexOf('const FLYING_STAR_DIR_LABEL_ZH')) + 1);
  const dirFullToShortLine = appSrc.slice(appSrc.indexOf('const DIR_FULL_TO_SHORT'), appSrc.indexOf('\n', appSrc.indexOf('const DIR_FULL_TO_SHORT')) + 1);
  check(dirFullToShortLine.includes('Southeast:\'SE\''), 'extracted the real DIR_FULL_TO_SHORT conversion table verbatim');

  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  const sandbox = { console, localStorage, navigator: { language: 'en-US' } };
  sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-core.js'), 'utf8'), sandbox, { filename: 'engine-core.js' });
  vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8'), sandbox, { filename: 'engine-metaphysics.js' });
  vm.runInContext(`
    lang = 'en';
    function bt(en, zh) { return (lang === 'zh' && zh) ? zh : en; }
    ${dirLabelsSrc}
    ${dirFullToShortLine}
    ${supportSrc}
  `, sandbox);
  function run(code) { return vm.runInContext(code, sandbox); }

  // A real property chart, computed by the REAL engine function (not hand-built).
  run(`var chart = computeFlyingStarChart(2015, 'S');`);
  check(!!run('chart.palaces') && typeof run('chart.period') === 'number', 'computed a real Flying Star chart via the real computeFlyingStarChart() function');

  // A real roster with a spread of Kua numbers (East and West group), using the REAL getKua-derived
  // Kua group assignment (via findBestBazhaiDirection, which reads the real BAZHAI_STARS table).
  run(`
    var roster = [
      { label: 'You', kuaNum: 1, kuaGroup: 'East (东四命)' },
      { label: 'Partner', kuaNum: 2, kuaGroup: 'West (西四命)' },
      { label: 'Child', kuaNum: 8, kuaGroup: 'West (西四命)' },
    ];
  `);

  function runBranch(rosterVarExpr) {
    vm.runInContext(`
      var type = 'flyingstar_household_kua';
      var extraData = { chart: chart, roster: ${rosterVarExpr} };
      var chars, exp, traits, hl, pos, neg, cau, opts;
      ${branchBody}
      globalThis.__result = { chars, exp, traits, hl, pos, neg, cau, opts };
    `, sandbox);
    return sandbox.__result;
  }

  const result = runBranch('roster');
  check(!!result.chars, 'the branch produced a real reading (not empty) for a populated roster + real chart');
  check(/of 3 have the property's own energy reinforcing/.test(result.chars), 'the reading correctly reports against all 3 roster members');

  // Independently recompute, in this SAME test (not trusting the branch's own arithmetic), each
  // person's verdict by directly looking up their own best Ba Zhai direction and the real chart's
  // Mountain/Facing numbers there - then confirm the branch's own highlights agree exactly.
  const expected = run(`
    roster.map(function(person) {
      const bestDirFull = findBestBazhaiDirection(person.kuaNum);
      const shortDir = DIR_FULL_TO_SHORT[bestDirFull.direction];
      const palace = chart.palaces[shortDir];
      const mNature = FLYING_STAR_NATURE[palace.mountain], fNature = FLYING_STAR_NATURE[palace.facing];
      const anyUnfavourable = (mNature && mNature.favourable === false) || (fNature && fNature.favourable === false);
      const anyFavourable = (mNature && mNature.favourable === true) || (fNature && fNature.favourable === true);
      return { label: person.label, dir: shortDir, mountain: palace.mountain, facing: palace.facing, verdict: anyUnfavourable ? 'undercut' : (anyFavourable ? 'reinforced' : 'neutral') };
    });
  `);
  check(Array.isArray(expected) && expected.length === 3, 'independently recomputed a verdict for all 3 roster members using the real chart/table data');
  expected.forEach(exp0 => {
    const hlLine = result.hl.find(h => h.startsWith(exp0.label + ':'));
    check(!!hlLine, `BUG FIX VERIFIED: the branch's own highlight for ${exp0.label} exists`);
    if (hlLine) {
      check(hlLine.includes(`Mountain ${exp0.mountain}/Facing ${exp0.facing}`), `${exp0.label}'s highlight cites the REAL Mountain/Facing star numbers (${exp0.mountain}/${exp0.facing}) at their own best direction - independently recomputed and matched exactly, not a placeholder`);
      check(hlLine.includes(`(${exp0.verdict})`), `${exp0.label}'s highlight carries the correct, independently-recomputed verdict (${exp0.verdict})`);
    }
  });

  // Regression: an empty roster (no household members with valid Kua data) degrades gracefully.
  const emptyResult = runBranch('[]');
  check(/Add household members/.test(emptyResult.chars), 'an empty roster produces a helpful "add household members" message rather than throwing or showing blank content');
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
