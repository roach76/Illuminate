const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's enhancement (one of the 3 follow-on items scoped after the astro_compat % fix,
// completed per "proceed to complete all pending items"): calculateTrueCompatibility's Western-astrology
// component (engine-metaphysics.js) now reuses the real synastry engine (computeSynastryScore) whenever
// both people have a full birth date+time on file, instead of remaining Sun-Sign-only forever - while
// still falling back honestly to the original Sun-Sign-only categorical when a full birth time is
// missing for either person.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const sandbox = { console, navigator: { language: 'en-US' }, document: dom.window.document, window: dom.window, alert: () => {}, requestAnimationFrame: (fn) => setTimeout(fn, 0) };
sandbox.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
sandbox.global = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
function run(code) { return vm.runInContext(code, sandbox); }

let loadThrew = null;
try { load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('auth.js'); load('app.js'); }
catch (e) { loadThrew = e; }
check(!loadThrew, `all 5 app files load cleanly together${loadThrew ? ': ' + loadThrew.message : ''}`);

const engineSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8');
check(/full synastry/.test(engineSrc), 'calculateTrueCompatibility references the new full-synastry Western astrology upgrade');

run(`var __rawA = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run(`var __rawB = ${JSON.stringify({ englishFirstName: 'Jane', englishLastName: 'Tan', birthdate: '1980-03-15', birthtime: '14:20', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run('var pA = getProfileData(__rawA); var pB = getProfileData(__rawB);');

let compatThrew = null, result = null;
try { result = run('calculateTrueCompatibility(pA, pB, false)'); } catch (e) { compatThrew = e; }
check(!compatThrew, `calculateTrueCompatibility runs without throwing for two full-birth-data profiles${compatThrew ? ': ' + compatThrew.message : ''}`);
check(!!result && typeof result.score === 'number', 'calculateTrueCompatibility returns a numeric score');
check(result.score >= 55 && result.score <= 98, `score is within the app-wide clamp range - got ${result.score}`);
check(Array.isArray(result.breakdown) && result.breakdown.some(b => /full synastry/i.test(b)), 'the breakdown includes a "full synastry" line when both profiles have full birth data');
check(!result.breakdown.some(b => /undefined/i.test(b)), 'no breakdown line contains the literal text "undefined" (bilingual pair-object bug check)');

// Bilingual: also check the Chinese breakdown line renders without "undefined" and doesn't leak English
// sun-sign-note text into it (the exact bug class fixed in describeMonthlyHighlightMeaning this round).
let resultZh = null, zhThrew = null;
try { run(`lang = 'zh';`); resultZh = run('calculateTrueCompatibility(pA, pB, false)'); run(`lang = 'en';`); } catch (e) { zhThrew = e; }
check(!zhThrew, `calculateTrueCompatibility runs in Chinese without throwing${zhThrew ? ': ' + zhThrew.message : ''}`);
check(!resultZh.breakdown.some(b => /undefined/i.test(b)), 'no Chinese breakdown line contains the literal text "undefined"');
check(resultZh.breakdown.some(b => /完整合盘/.test(b)), 'the Chinese breakdown includes the full-synastry line (完整合盘)');
check(!resultZh.breakdown.some(b => /classically (compatible|challenging)|neutral\b/i.test(b)), 'the Chinese breakdown does not leak raw English sun-sign-note text');

// Honest fallback: strip just .bazi.birthMomentUTC from one profile (simulating a full natal chart
// genuinely not being computable, while keeping the rest of .bazi intact - calculateTrueCompatibility
// itself requires p.bazi.dayStemIdx unconditionally for its Day-Master comparison, so a real profile
// missing birth data entirely never reaches this function; this specific field is what the new
// hasFullCharts check inside the Western-astrology block actually gates on) - the Sun-Sign-only
// categorical should still be used, no synastry line, no throw.
run(`var pBNoTime = JSON.parse(JSON.stringify(pB)); delete pBNoTime.bazi.birthMomentUTC;`);
let fallbackThrew = null, fallbackResult = null;
try { fallbackResult = run('calculateTrueCompatibility(pA, pBNoTime, false)'); } catch (e) { fallbackThrew = e; }
check(!fallbackThrew, `calculateTrueCompatibility falls back cleanly when one profile lacks .bazi${fallbackThrew ? ': ' + fallbackThrew.message : ''}`);
check(!!fallbackResult && !fallbackResult.breakdown.some(b => /full synastry/i.test(b)), 'no "full synastry" line appears when one profile lacks full birth data (honest fallback)');
// (No categorical line is pushed at all when the Sun-Sign relationship happens to be neutral for this
// specific pairing - that's the original, pre-existing behavior, unrelated to this round's change.)

// Different pairings still produce genuinely different scores (not a fixed template)
run(`var __rawC = ${JSON.stringify({ englishFirstName: 'Bobby', englishLastName: 'Neo', birthdate: '1965-06-27', birthtime: '05:28', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run('var pC = getProfileData(__rawC);');
const resultAC = run('calculateTrueCompatibility(pA, pC, false)');
check(resultAC.score !== result.score, `a different pairing (A+C vs A+B) produces a genuinely different overall score - got ${resultAC.score} vs ${result.score}`);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
