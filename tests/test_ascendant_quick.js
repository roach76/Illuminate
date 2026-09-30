const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const sandbox = { console, navigator: { language: 'en-US' }, document: dom.window.document, window: dom.window, alert: () => {}, requestAnimationFrame: (fn) => setTimeout(fn, 0) };
sandbox.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
sandbox.global = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
load('engine-core.js'); load('engine-metaphysics.js');

// Singapore, 28 Sep 2026, 14:30 local time (UTC+8), lon=103.82, lat=1.35
const out = vm.runInContext(`
  var realUTC = computeRealBirthUTCMoment(2026, 9, 28, 14, 30, 8);
  var asc = computeAscendant(realUTC, 103.82, 1.35);
  var cusps = computeEqualHouseCusps(asc.ascendant);
  JSON.stringify({ realUTC: realUTC.toISOString(), asc, cusps, house1: assignHouseNumber(asc.ascendant, asc.ascendant), house_180: assignHouseNumber(astroRev(asc.ascendant+179), asc.ascendant) });
`, sandbox);
console.log(out);
