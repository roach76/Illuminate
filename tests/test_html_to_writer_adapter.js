const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Functional test (via jsdom, a real DOM) of the two new adapter functions this session added:
// extractChartSectionHtml() and renderHtmlFragmentIntoWriter(). Extracts the ACTUAL shipped function
// bodies from app.js and runs them against a realistic multi-section chart HTML fragment, mirroring
// the real structure this app's renderSystemChart produces (h2.section-header siblings, each followed
// by one or more <article class="reading"> blocks containing <h3>, <p>, .calc-box, .pill, <ul><li>).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');

function must(re, label) { const m = src.match(re); if (!m) throw new Error('Could not locate: ' + label); return m; }

const extractFnSrc = must(/function extractChartSectionHtml\(containerEl, matchFn\) \{[\s\S]*?\n\}/, 'extractChartSectionHtml')[0];
const renderFnSrc = must(/function renderHtmlFragmentIntoWriter\(w, html\) \{[\s\S]*?\n\}/, 'renderHtmlFragmentIntoWriter')[0];

const dom = new JSDOM('<!DOCTYPE html><body></body>');
global.document = dom.window.document;

// Load the two ACTUAL functions into this test's scope via eval (direct eval of function
// declarations creates real, callable bindings, unlike const/let - no var-replacement hack needed).
eval(extractFnSrc);
eval(renderFnSrc);

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// --- Build a realistic multi-section chart HTML fragment ---
const chartHtml = `
  <h2 class="section-header" id="mingli">Ming Li (命理 - Destiny Analysis)</h2>
  <article class="reading">
    <span class="pill">BaZi Natal Chart</span>
    <div class="calc-box">Lucky Colors: Green &amp; Gold</div>
    <p>Your Day Master is well-resourced.</p>
    <ul><li>Point one</li><li>Point two</li></ul>
  </article>
  <h2 class="section-header" id="healthdiagnosis">Health Diagnosis (健康分析)</h2>
  <article class="reading">
    <h3>Wu Xing Balance</h3>
    <p>Your elemental balance leans toward Water.</p>
    <button class="btnViewDeepAnalysis">View</button>
    <input type="text" value="should be skipped">
  </article>
  <h2 class="section-header" id="fengshui">Feng Shui (风水)</h2>
  <article class="reading"><p>Feng Shui content here.</p></article>
`;

const container = document.createElement('div');
container.innerHTML = chartHtml;

// 1. extractChartSectionHtml: find Health Diagnosis by TEXT match (not id) - proving the fix works
//    even when idAttr() would have omitted the id (non-main-profile exports).
const extracted = extractChartSectionHtml(container, t => t.includes('Health Diagnosis') || t.includes('健康分析'));
check(extracted.includes('Wu Xing Balance'), 'extracted Health Diagnosis content includes its own text');
check(extracted.includes('Your elemental balance leans toward Water'), 'extracted content includes the paragraph text');
check(!extracted.includes('Feng Shui content here'), 'extraction stops before the NEXT h2.section-header (does not bleed into Feng Shui)');
check(!extracted.includes('Lucky Colors'), 'extraction does not include the PREVIOUS section (Ming Li)');

// Also prove it works with NO id present at all (simulating a partner/business/child profile export,
// where idAttr() omits ids entirely).
const containerNoIds = document.createElement('div');
containerNoIds.innerHTML = chartHtml.replace(/ id="[a-z]+"/g, '');
const extractedNoId = extractChartSectionHtml(containerNoIds, t => t.includes('Health Diagnosis'));
check(extractedNoId.includes('Wu Xing Balance'), 'extraction still works with NO id attributes present (text-based match, not id-based)');

// 2. renderHtmlFragmentIntoWriter: verify it calls the right writer primitives for the right elements.
const calls = [];
const fakeWriter = {
  addSubHeader: (t) => calls.push(['addSubHeader', t]),
  addParagraph: (t, opt) => calls.push(['addParagraph', t, opt]),
  addCalcBox: (t, opt) => calls.push(['addCalcBox', t, opt]),
  addBulletList: (items, opt) => calls.push(['addBulletList', items, opt]),
  addDivider: () => calls.push(['addDivider']),
};
const PDF_COLOR_GOLD = [184, 134, 53]; // referenced by the extracted function for .pill styling
renderHtmlFragmentIntoWriter(fakeWriter, extracted);

check(calls.some(c => c[0] === 'addSubHeader' && c[1] === 'Wu Xing Balance'), 'h3 heading converted to addSubHeader');
check(calls.some(c => c[0] === 'addParagraph' && c[1].includes('elemental balance')), 'p text converted to addParagraph');
check(!calls.some(c => c[1] && String(c[1]).includes('should be skipped')), 'input field content is skipped entirely (not leaked into any writer call)');
check(!calls.some(c => c[1] === 'View'), 'btnViewDeepAnalysis button is skipped (interactive element, no place in a PDF)');

// Re-run against the Ming Li section's HTML to check pill/calc-box/list handling too.
const mingLiHtml = extractChartSectionHtml(container, t => t.includes('Ming Li'));
const calls2 = [];
const fakeWriter2 = {
  addSubHeader: (t) => calls2.push(['addSubHeader', t]),
  addParagraph: (t, opt) => calls2.push(['addParagraph', t, opt]),
  addCalcBox: (t, opt) => calls2.push(['addCalcBox', t, opt]),
  addBulletList: (items, opt) => calls2.push(['addBulletList', items, opt]),
  addDivider: () => calls2.push(['addDivider']),
};
renderHtmlFragmentIntoWriter(fakeWriter2, mingLiHtml);
check(calls2.some(c => c[0] === 'addParagraph' && c[1] === 'BaZi Natal Chart' && c[2].bold === true), 'pill label converted to a bold addParagraph');
check(calls2.some(c => c[0] === 'addCalcBox' && c[1].includes('Lucky Colors')), 'calc-box div converted to addCalcBox');
check(calls2.some(c => c[0] === 'addBulletList' && Array.isArray(c[1]) && c[1].includes('Point one') && c[1].includes('Point two')), 'ul/li converted to addBulletList with both items');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
