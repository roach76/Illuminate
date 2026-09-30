const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's enhancement (requested directly): a photo of a physical whiteboard 12-house
// wheel + "There should be 12 houses to plot out", followed by the user explicitly choosing "Real
// Ascendant-based houses (Placidus/Equal from true Ascendant)" when asked how to proceed given this app
// only collected birth longitude (not latitude) up to that point. See engine-metaphysics.js
// (computeRealBirthUTCMoment / computeAscendant / computeEqualHouseCusps / assignHouseNumber /
// computeNatalHouses / computeNatalPointHouses / HOUSE_LIFE_AREAS) and app.js (the new birthLatitude
// field end-to-end: index.html hidden fields, autoPopulateLonTz, readLatitude, the 5 profile-save
// handlers, renderPersonFieldsForm/readPersonFieldsFromForm, prefillCountryCityFields, and the
// astro_natal_full deep-analysis branch + generateNatalFullChartHTML + the wheel HTML functions).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const sandbox = {
  console, navigator: { language: 'en-US' },
  document: dom.window.document, window: dom.window,
  alert: () => {}, requestAnimationFrame: (fn) => setTimeout(fn, 0),
};
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
const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8');
const coreSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-core.js'), 'utf8');

// --- Static regression guards ---
check(/function computeRealBirthUTCMoment\(/.test(engineSrc), 'computeRealBirthUTCMoment() exists');
check(/function computeAscendant\(/.test(engineSrc), 'computeAscendant() exists');
check(/function computeEqualHouseCusps\(/.test(engineSrc), 'computeEqualHouseCusps() exists');
check(/function assignHouseNumber\(/.test(engineSrc), 'assignHouseNumber() exists');
check(/function computeNatalHouses\(/.test(engineSrc), 'computeNatalHouses() exists');
check(/function computeNatalPointHouses\(/.test(engineSrc), 'computeNatalPointHouses() exists');
check(/const HOUSE_LIFE_AREAS = \{/.test(engineSrc), 'HOUSE_LIFE_AREAS reference table exists');
check(/realBirthMomentUTC/.test(engineSrc), 'getBaZiPillars computes/returns a separate realBirthMomentUTC (not reusing the true-solar-time birthMomentUTC for the Ascendant)');
check(/function readLatitude\(/.test(appSrc), 'readLatitude() lenient-parse helper exists in app.js');
check(/birthLatitude: readLatitude/.test(appSrc), 'at least one profile-save handler persists birthLatitude via readLatitude()');
check((appSrc.match(/birthLatitude: readLatitude/g) || []).length >= 5, 'all 5 profile-save handlers (birth/partner/biz/biz2/child) persist birthLatitude');
check(/id="birthLatitude"/.test(indexSrc) && /id="partnerLatitude"/.test(indexSrc) && /id="bizLatitude"/.test(indexSrc) && /id="biz2Latitude"/.test(indexSrc) && /id="childLatitude"/.test(indexSrc), 'all 5 hidden latitude fields exist in index.html');
check(/lat: [\d.]+/.test(coreSrc), 'COUNTRY_LONGITUDE_TIMEZONE/MULTI_TIMEZONE_COUNTRY_CITIES entries carry a lat value');

// --- Behavioral: a profile WITHOUT birth latitude -> houses honestly unavailable, no throw ---
run(`var __rawNoLat = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run('var pNoLat = getProfileData(__rawNoLat);');
check(run('pNoLat.houses === null'), 'a profile with no birthLatitude field gets houses === null (honest, not a throw or a guess)');
let noLatThrew = null;
try { run(`generateDeepAnalysisData('astro_natal_full', pNoLat, { title: 'test' }, true)`); } catch (e) { noLatThrew = e; }
check(!noLatThrew, `astro_natal_full reading renders without throwing when houses are unavailable${noLatThrew ? ': ' + noLatThrew.message : ''}`);
// rawOnly returns a plain {title,chars,exp,traits,hl,pos,neg,cau,opts} data object (not HTML) - stringify
// it so a single regex can search every field's text at once.
const noLatRaw = JSON.stringify(run(`generateDeepAnalysisData('astro_natal_full', pNoLat, { title: 'test' }, true)`));
check(/not currently on file/.test(noLatRaw), 'the no-latitude reading honestly says the Ascendant/houses are not currently on file, rather than fabricating a value');
let noLatTableThrew = null;
try { run('generateNatalFullChartHTML(pNoLat)'); } catch (e) { noLatTableThrew = e; }
check(!noLatTableThrew, `generateNatalFullChartHTML renders without throwing when houses are unavailable${noLatTableThrew ? ': ' + noLatTableThrew.message : ''}`);
let noLatWheelThrew = null;
try { run('getCalculatedAstrologyChartHTML(pNoLat); getNatalChartDiagramHTML(pNoLat); getNatalOuterPlanetsLegendHTML(pNoLat)'); } catch (e) { noLatWheelThrew = e; }
check(!noLatWheelThrew, `wheel/legend HTML functions render without throwing when houses are unavailable${noLatWheelThrew ? ': ' + noLatWheelThrew.message : ''}`);
const noLatWheel = run('getCalculatedAstrologyChartHTML(pNoLat)');
check(!/>ASC</.test(noLatWheel), 'no ASC marker is drawn on the wheel when this profile has no houses');

// --- Behavioral: a profile WITH birth latitude -> real Ascendant/houses computed ---
run(`var __rawLat = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8, birthLatitude: 1.35 })};`);
run('var pLat = getProfileData(__rawLat);');
const houses = run('pLat.houses');
check(!!houses, 'a profile with a numeric birthLatitude gets a real, non-null houses object');
check(typeof houses.ascendant === 'number' && houses.ascendant >= 0 && houses.ascendant < 360, `ascendant is a normalized 0-360 longitude - got ${houses.ascendant}`);
check(!!houses.ascendantSign && !!houses.ascendantSign.en, 'ascendantSign resolves to a real zodiac sign');
check(Array.isArray(houses.cusps) && houses.cusps.length === 12, 'computeEqualHouseCusps produced exactly 12 cusps');
check(houses.cusps[0] === houses.ascendant, 'house 1 cusp is exactly the Ascendant');
let equalSpacingOk = true;
for (let i = 1; i < 12; i++) {
  const diff = run(`astroRev(${houses.cusps[i]} - ${houses.cusps[i-1]})`);
  if (Math.abs(diff - 30) > 1e-6) equalSpacingOk = false;
}
check(equalSpacingOk, 'every Equal House cusp is exactly 30 degrees from the previous one');

// assignHouseNumber direct math checks
check(run(`assignHouseNumber(${houses.ascendant}, ${houses.ascendant})`) === 1, 'a point exactly at the Ascendant is assigned House 1');
check(run(`assignHouseNumber(astroRev(${houses.ascendant} + 29), ${houses.ascendant})`) === 1, 'a point 29 degrees past the Ascendant is still House 1');
check(run(`assignHouseNumber(astroRev(${houses.ascendant} + 30), ${houses.ascendant})`) === 2, 'a point exactly 30 degrees past the Ascendant is House 2');
check(run(`assignHouseNumber(astroRev(${houses.ascendant} - 1), ${houses.ascendant})`) === 12, 'a point 1 degree BEFORE the Ascendant falls in House 12 (wraps correctly)');

// computeNatalPointHouses: all 12 natal points get a house 1-12
run('var natalChartLat = computeFullNatalChart(pLat.bazi.birthMomentUTC);');
const pointHouses = run('computeNatalPointHouses(natalChartLat, pLat.houses)');
const NATAL_KEYS = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northnode','southnode'];
check(NATAL_KEYS.every(k => Number.isInteger(pointHouses[k]) && pointHouses[k] >= 1 && pointHouses[k] <= 12), 'every one of the 12 natal points is assigned an integer house number 1-12');

// realBirthMomentUTC must NOT equal the true-solar-time birthMomentUTC (the critical correctness
// requirement identified before writing any of this code)
const realVsTrueSolar = run('pLat.bazi.realBirthMomentUTC.getTime() !== pLat.bazi.birthMomentUTC.getTime()');
check(realVsTrueSolar, 'realBirthMomentUTC is a genuinely different instant from the true-solar-time birthMomentUTC (Ascendant must not reuse true solar time)');
// NOTE: 1976 Singapore resolves to the historical GMT+7:30 offset (resolveHistoricalTz), not +8, so
// the expected real UTC below is 09:33 minus 7h30m, not minus 8h - this is genuinely correct behavior
// (computeRealBirthUTCMoment correctly receives the ALREADY historical-tz-resolved offset), not a bug.
check(run(`pLat.bazi.realBirthMomentUTC.toISOString()`) === '1976-09-07T02:03:00.000Z', `realBirthMomentUTC is real UTC = local clock (09:33) minus the resolved timezone offset (+7:30 for 1976 Singapore) with no longitude/Equation-of-Time correction - got ${run('pLat.bazi.realBirthMomentUTC.toISOString()')}`);
// A post-1982 date (no historical tz quirk) as a simpler, direct cross-check of the same formula.
run(`var __rawLatModern = ${JSON.stringify({ englishFirstName: 'Test', englishLastName: 'Modern', birthdate: '2000-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8, birthLatitude: 1.35 })};`);
run('var pLatModern = getProfileData(__rawLatModern);');
check(run(`pLatModern.bazi.realBirthMomentUTC.toISOString()`) === '2000-09-07T01:33:00.000Z', `for a modern (non-historical-tz) date, realBirthMomentUTC = local clock minus the plain +8 timezone exactly - got ${run('pLatModern.bazi.realBirthMomentUTC.toISOString()')}`);

// Ascendant sensitivity: real astrological fact - the Ascendant moves ~1 degree every 4 minutes of birth
// time (it completes 360 degrees in ~23h56m). A 4-minute-later birth time should shift the Ascendant by
// approximately 1 degree - this is a strong regression guard against silently reusing a stale/frozen time.
run(`var __rawLat4 = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:37', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8, birthLatitude: 1.35 })};`);
run('var pLat4 = getProfileData(__rawLat4);');
const ascShift = run(`Math.abs(astroRev(pLat4.houses.ascendant - ${houses.ascendant} + 180) - 180)`);
check(ascShift > 0.5 && ascShift < 2, `a birth time 4 minutes later shifts the Ascendant by ~1 degree (the well-known real rate) - got ${ascShift.toFixed(3)}`);

// Latitude sensitivity: a different birth latitude (same date/time/longitude) must produce a different
// Ascendant - proves latitude is genuinely used, not silently ignored/defaulted.
run(`var __rawLatDiff = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8, birthLatitude: 45 })};`);
run('var pLatDiff = getProfileData(__rawLatDiff);');
check(Math.abs(run('pLatDiff.houses.ascendant') - houses.ascendant) > 0.01, 'a genuinely different birth latitude (same date/time/longitude) produces a genuinely different Ascendant');

// Latitude = 0 (equator) must be treated as a real, present value - not mistaken for "missing" by a
// falsy-value check (0 is falsy in JS, a classic footgun this app must avoid for this field).
run(`var __rawLat0 = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8, birthLatitude: 0 })};`);
run('var pLat0 = getProfileData(__rawLat0);');
check(run('pLat0.houses !== null'), 'birthLatitude: 0 (the equator) is correctly treated as a present, real latitude, not as "missing" (0 is falsy in JS)');

// readLatitude() lenient parsing: valid/blank/out-of-range/garbage inputs. readLatitude is a
// closure-scoped helper (not attached to the sandbox global), so its exact source is extracted from
// app.js and evaluated standalone here to test its real behavior directly (rather than a duplicated
// reimplementation that could silently drift from the real function).
const readLatitudeMatch = appSrc.match(/function readLatitude\(latVal\) \{[\s\S]*?\n  \}/);
check(!!readLatitudeMatch, 'readLatitude() source was extracted from app.js for direct testing');
if (readLatitudeMatch) {
  const readLatitude = new Function('latVal', readLatitudeMatch[0].replace(/^function readLatitude\(latVal\) \{/, '').replace(/\}$/, ''));
  check(readLatitude('1.35') === 1.35, 'readLatitude parses a valid numeric string');
  check(readLatitude('0') === 0, 'readLatitude correctly returns 0 for the string "0" (not treated as missing)');
  check(readLatitude('') === undefined, 'readLatitude returns undefined for a blank value (lenient - never blocks saving)');
  check(readLatitude(undefined) === undefined, 'readLatitude returns undefined when the field is absent entirely');
  check(readLatitude('91') === undefined, 'readLatitude rejects an out-of-range value (>90) by returning undefined, not throwing');
  check(readLatitude('not-a-number') === undefined, 'readLatitude rejects garbage input by returning undefined, not throwing');
}

// Rendering with houses present: no throw, in both languages, and the new content actually appears
let latThrew = null;
try {
  run(`lang = 'en'; generateDeepAnalysisData('astro_natal_full', pLat, { title: 'test' }, true); generateNatalFullChartHTML(pLat); getCalculatedAstrologyChartHTML(pLat); getNatalChartDiagramHTML(pLat); getNatalOuterPlanetsLegendHTML(pLat);`);
  run(`lang = 'zh'; generateDeepAnalysisData('astro_natal_full', pLat, { title: 'test' }, true); generateNatalFullChartHTML(pLat); getCalculatedAstrologyChartHTML(pLat); getNatalChartDiagramHTML(pLat); getNatalOuterPlanetsLegendHTML(pLat);`);
  run(`lang = 'en';`);
} catch (e) { latThrew = e; }
check(!latThrew, `all natal-chart rendering functions run without throwing (EN + ZH) when houses ARE available${latThrew ? ': ' + latThrew.message : ''}`);

const latRaw = JSON.stringify(run(`generateDeepAnalysisData('astro_natal_full', pLat, { title: 'test' }, true)`));
check(/Ascendant/.test(latRaw) && /Equal House/.test(latRaw), 'the natal reading names the Ascendant and the Equal House convention explicitly when houses are available');
check(/House \d/.test(latRaw), 'the natal reading includes at least one concrete "(House N)" reference');

const latTable = run('generateNatalFullChartHTML(pLat)');
check(/House/.test(latTable), 'the Full Natal Chart table includes a House column when houses are available');
check(/Ascendant \(Rising Sign\)/.test(latTable), 'the table shows the Ascendant/Rising Sign line when houses are available');

const latWheel = run('getCalculatedAstrologyChartHTML(pLat)');
check(/>ASC</.test(latWheel), 'the wheel draws an ASC marker when this profile has houses');

const legendHtml = run('getNatalOuterPlanetsLegendHTML(pLat)');
check(/House \d/.test(legendHtml), 'the legend shows each point\'s house number when houses are available');
check(/Ascendant/.test(legendHtml), 'the legend includes the Ascendant/Rising Sign row when houses are available');

// HOUSE_LIFE_AREAS: all 12 houses present with bilingual life-area text
const houseAreaKeys = run('Object.keys(HOUSE_LIFE_AREAS).map(Number).sort((a,b)=>a-b)');
check(JSON.stringify(houseAreaKeys) === JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12]), 'HOUSE_LIFE_AREAS defines exactly houses 1 through 12');
check(run('Object.values(HOUSE_LIFE_AREAS).every(a => a.en && a.zh)'), 'every house has both an English and Chinese life-area description');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
