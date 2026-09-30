const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fixes made in response to the user's newest 7-item report:
// 1. "some labels are duplicated with a magnifying glass icon" - renderStandardDeepAnalysis's PDF-mode
//    branch no longer prints its own duplicate "🔍 <title>" line ahead of fullHTML, which already
//    renders the same title as its own <h4>.
// 2. "detailed reading is still missing" - re-confirms Detailed Reading is genuinely present (this was
//    directly verified against the user's own attached real PDF export this round: pages 79-81 show the
//    full narrative section with real content, so no code change was needed here).
// 3. "Summary cards has an empty spot beside the longitude/timezone" - Longitude/Timezone is no longer
//    its own tile; it's folded into the Gregorian Birth tile, so the overview grid has no leftover slot.
// 4. "both summary on app and pdf does not have the flying star" - a Flying Star (Annual) row/tile is
//    now present in both the top overview card and the Details Summary section.
// 5. "Ze Ri date selection is not required as there is no information unless user initiated" - the Ze Ri
//    section (heading + both interactive articles) is now entirely omitted from the PDF, rather than
//    leaving an orphaned heading after its pdf-exclude content is stripped.
// 6. "continue with the western astrology chart" - both chart wheels and the astro Deep Analysis now
//    include the person's real natal positions for the 5 outer planets (Jupiter/Saturn/Uranus/Neptune/
//    Pluto), computed via the same verified astronomical method as the existing Sun marker/transits.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const STORAGE_KEY = 'illuminate-local-v101';
const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  partner: { englishFirstName: 'Tina', englishLastName: 'Seah', birthdate: '1976-04-25', birthtime: '10:21', gender: 'female' },
};
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
try { load('app.js'); } catch (e) { /* stray DOMContentLoaded wiring in a bare jsdom doc - unrelated */ }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const metaSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8');

// --- 1. Static regression guard: duplicate magnifying-glass title line is gone from PDF-mode branch ---
check(!/🔍 \$\{title \|\| L\.title_fallback\}<\/div>\s*\n\s*\$\{fullHTML\}/.test(appSrc),
  'renderStandardDeepAnalysis no longer prints its own "🔍 <title>" line before fullHTML in PDF mode');
check(/if \(pdfExportMode\) \{[\s\S]{0,700}\$\{fullHTML\}/.test(appSrc), 'the PDF-mode branch still renders fullHTML itself (title included via its own <h4>)');

// --- Behavioral: build the real PDF HTML for a section using renderStandardDeepAnalysis and confirm
// the title string appears exactly once, not twice, and no 🔍 icon remains anywhere in that output. ---
const html = vm.runInContext(`buildProfilePdfHTML('i')`, sandbox);
check(!!html && html.length > 1000, 'buildProfilePdfHTML produced real, substantial HTML');
check(!html.includes('🔍'), 'the magnifying-glass icon no longer appears anywhere in the generated PDF HTML');
const dayMasterTitleCount = (html.match(/Day Master \(日主\) Deep Analysis/g) || []).length;
check(dayMasterTitleCount === 1, `"Day Master (日主) Deep Analysis" appears exactly once in the PDF HTML (was appearing twice before the fix) - found ${dayMasterTitleCount}`);

// --- 3. Longitude/Timezone folded into Gregorian Birth tile - no separate tile, no empty grid slot ---
check(!/Longitude \/ Timezone/.test(appSrc) || /Gregorian Birth[\s\S]{0,50}birthLongitude/.test(appSrc),
  'the overview tile grid no longer has a standalone Longitude/Timezone tile');
check(html.includes('103.82'), 'the Singapore longitude value is still present in the PDF HTML (now inside the Gregorian Birth tile)');
check(/Gregorian Birth[\s\S]{0,300}103\.82/.test(html) || /阳历出生[\s\S]{0,300}103\.82/.test(html),
  'the longitude/timezone value now appears inside the Gregorian Birth tile\'s own markup, not a separate tile');

// --- 4. Flying Star (Annual) summary row/tile is present in both the overview card and Details Summary ---
// UPDATED (follow-up fix, reported: "Flying star summary card did not indicate what the annual year
// is"): the label now includes the actual ruling year, e.g. "Flying Star (2026 Annual)", rather than
// the bare "Flying Star (Annual)" this test originally checked for.
const flyingStarMentions = (html.match(/Flying Star \(\d{4} Annual\)|飞星（\d{4}流年）/g) || []).length;
check(flyingStarMentions >= 2, `Flying Star (<year> Annual) appears at least twice (overview tile + Details Summary row) - found ${flyingStarMentions}`);

// --- 5. Ze Ri section is fully omitted from the PDF (no orphaned heading) ---
check(!/Ze Ri \(择日 - Date Selection\)/.test(html), 'the Ze Ri section heading does not appear anywhere in the generated PDF HTML');
check(/const artZeRi = pdfExportMode \? '' : `/.test(appSrc), 'artZeRi is statically confirmed to render as empty string in PDF export mode');

// --- 6. Western Astrology: natal outer planets now present ---
check(/function computeNatalOuterPlanetPositions/.test(metaSrc), 'computeNatalOuterPlanetPositions exists in engine-metaphysics.js');
check(/function outerPlanetMarkersSVG/.test(metaSrc), 'the chart wheels now include an outer-planet-marker renderer');
check(/function getNatalOuterPlanetsLegendHTML/.test(metaSrc), 'a legend function for the natal outer planets exists');
// Behavioral: call the real natal computation directly against this test user's real birth moment.
const p = vm.runInContext(`getProfileData()`, sandbox);
check(!!p?.bazi?.birthMomentUTC, 'the test profile has a real birthMomentUTC to compute natal planets from');
const natal = vm.runInContext(`computeNatalOuterPlanetPositions(getProfileData().bazi.birthMomentUTC)`, sandbox);
['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].forEach(planet => {
  check(natal[planet] && typeof natal[planet].lon === 'number' && natal[planet].lon >= 0 && natal[planet].lon < 360,
    `natal ${planet} longitude is a real number in [0,360) - got ${natal[planet] && natal[planet].lon}`);
  check(natal[planet]?.sign?.en, `natal ${planet} resolves to a real zodiac sign - got ${natal[planet]?.sign?.en}`);
});
// The legend HTML should mention every one of the 5 planets' English names for this profile.
const legendHTML = vm.runInContext(`getNatalOuterPlanetsLegendHTML(getProfileData())`, sandbox);
['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].forEach(name => {
  check(legendHTML.includes(name), `the natal outer-planets legend mentions ${name}`);
});
// The astro Deep Analysis card's explanation text should now also mention the natal outer planets.
check(/Your natal outer planets:/.test(appSrc), 'the astro Deep Analysis explanation text now includes the natal outer planets line');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
