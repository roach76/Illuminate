const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for "Flying Star chart rendering outside its display box": both Flying Star grids
// (the property calculator's single 3x3 grid, and the Annual/Monthly/Daily temporal overlay's 3 nested
// 3x3 grids) now use min-width:0 / minmax(0, 1fr) throughout, and the outer temporal-overlay grid uses
// a responsive auto-fit column count instead of a rigid 3-column layout - the standard CSS Grid fix for
// content forcing a column wider than its fair share and overflowing the container.
const fs = require('fs');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const rfsrStart = src.indexOf('function renderFlyingStarResult(constructionYear, facingDir');
const rfsrEnd = src.indexOf('\nfunction ', rfsrStart + 10);
const rfsrBody = src.slice(rfsrStart, rfsrEnd);
check(rfsrBody.includes('grid-template-columns:repeat(3, minmax(0, 1fr))'), 'property-calculator grid uses minmax(0, 1fr) columns instead of rigid 1fr 1fr 1fr');
check(rfsrBody.includes("min-width:0; overflow:hidden") || /min-width:0;\s*overflow:hidden/.test(rfsrBody), 'property-calculator cells have min-width:0 + overflow:hidden safety net');

const rfstoStart = src.indexOf('function renderFlyingStarTemporalOverlay(');
const rfstoEnd = src.indexOf('\n// ', rfstoStart + 10);
const rfstoBody = src.slice(rfstoStart, rfstoEnd);
check(rfstoBody.includes('grid-template-columns:repeat(auto-fit, minmax(108px, 1fr))'), 'outer Annual/Monthly/Daily grid uses responsive auto-fit columns instead of rigid 1fr 1fr 1fr');
check((rfstoBody.match(/grid-template-columns:repeat\(3, minmax\(0, 1fr\)\)/g) || []).length === 3, 'all 3 inner (Annual/Monthly/Daily) 3x3 grids use minmax(0, 1fr) columns');
check((rfstoBody.match(/min-width:0/g) || []).length >= 5, 'min-width:0 applied throughout the temporal overlay (outer grid, each group, each inner grid)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
