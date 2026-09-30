const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Dedicated test for the 7 usability/design enhancements built this round:
// 1. What's New banner, 2. Personal Assets & Address summary card, 3. Persisted section
// collapse/expand state, 4. Grouped PDF Table of Contents, 5. "Calculated as of" / "Calculated on"
// timestamps, 6. "Needs setup" badges on gated pills, 7. Export Readiness checklist.
const fs = require('fs');
const appSrc = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');
const coreSrc = fs.readFileSync((__PROJECT_ROOT__ + '/engine-core.js'), 'utf8');
const predSrc = fs.readFileSync((__PROJECT_ROOT__ + '/engine-predictions.js'), 'utf8');
const htmlSrc = fs.readFileSync((__PROJECT_ROOT__ + '/index.html'), 'utf8');
const cssSrc = fs.readFileSync((__PROJECT_ROOT__ + '/styles.css'), 'utf8');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// --- Task 1: What's New banner - REMOVED this round (reported: "The what's new should be removed
// from the landing page. Document in the notes and instructions instead"). The banner feature (and
// this test's own assertions that it existed) is gone; these checks now confirm full removal instead.
check(!/const WHATS_NEW_VERSION\s*=/.test(appSrc), "WHATS_NEW_VERSION constant removed");
check(!/function maybeShowWhatsNewBanner\(\)/.test(appSrc), "maybeShowWhatsNewBanner removed");
check(!/id="whatsNewBanner"/.test(htmlSrc), "whatsNewBanner markup removed from index.html");
check(!/id="btnDismissWhatsNew"/.test(htmlSrc), "dismiss button markup removed from index.html");
check(!/e\.target\.id === 'btnDismissWhatsNew'/.test(appSrc), "dismiss click handler removed");
check(!/illuminate_whatsnew_dismissed/.test(appSrc), "sessionStorage dismissal key removed");
check(!/maybeShowWhatsNewBanner\(\);/.test(appSrc), "maybeShowWhatsNewBanner call site removed from go()");
check(!/\.whatsnew-banner\s*\{/.test(cssSrc), "whatsnew-banner CSS removed");

// --- Task 2: Personal Assets & Address summary card ---
// SUPERSEDED (reported: "remove the personal assets section from the system list on the landing
// page. No changes to personal assets on the other pages."): the standalone Home-dashboard card this
// task originally built (#personalAssetsSummaryCard / #personalAssetsSummaryRows /
// renderPersonalAssetsSummaryCard()) has since been removed - the same Mobile Number/Vehicle
// Plate(s)/Address Compatibility summary is now shown inline inside each profile's own landing
// summary card instead (see test_personal_assets_on_landing_cards.js). These checks are flipped to
// confirm the old standalone card is genuinely gone, not left dangling.
check(!/function renderPersonalAssetsSummaryCard\(\)/.test(appSrc), "renderPersonalAssetsSummaryCard removed as dead code (superseded by the inline landing-card block)");
check(!/id="personalAssetsSummaryCard"/.test(htmlSrc), "standalone summary card wrapper removed from index.html");
check(!/id="personalAssetsSummaryRows"/.test(htmlSrc), "standalone summary card rows container removed from index.html");
check(!/if \(typeof renderPersonalAssetsSummaryCard === 'function'\) renderPersonalAssetsSummaryCard\(\);/.test(appSrc), "the old call site in renderAllViews is removed too");
check(/function buildPersonalAssetsSummaryRows\(prefix, p, prof, u\)/.test(appSrc), "the underlying shared row-builder (buildPersonalAssetsSummaryRows) is still present - only the standalone Home card was removed, the scoring logic itself is untouched and still backs the chart-page card and the new inline landing block");

// --- Task 3: Persisted section collapse/expand state ---
check(/const SECTION_STATE_STORAGE_KEY = 'illuminate_section_state';/.test(appSrc), "SECTION_STATE_STORAGE_KEY constant present");
check(/function getSectionOpenState\(sectionId\)/.test(appSrc), "getSectionOpenState defined");
check(/function setSectionOpenState\(sectionId, isOpen\)/.test(appSrc), "setSectionOpenState defined");
check(/const savedOpenState = sectionId \? getSectionOpenState\(sectionId\) : null;/.test(appSrc), "wrapSectionCollapsible consults saved state");
check(/document\.addEventListener\('toggle', e => \{/.test(appSrc), "capture-phase toggle listener registered");
check(/document\.addEventListener\('toggle', e => \{[\s\S]{0,300}\}, true\);/.test(appSrc), "toggle listener registered with capture=true (required - toggle doesn't bubble)");

// --- Task 4: Grouped PDF Table of Contents ---
check(/const TOC_CATEGORIES = \[/.test(appSrc), "TOC_CATEGORIES defined");
check(/const groupedByCategory = new Map\(\);/.test(appSrc), "groupedByCategory map built");
check(/const useGrouping = nonEmptyGroups\.length > 1;/.test(appSrc), "grouping only activates with >1 non-empty category");
check(/const tocLines = \[\];/.test(appSrc), "tocLines array built");
check(/const tocPageCount = Math\.max\(1, Math\.ceil\(tocLines\.length \/ TOC_ENTRIES_PER_PAGE\)\);/.test(appSrc), "tocPageCount recomputed from tocLines, not raw tocEntries");
check(/if \(line\.type === 'category'\)/.test(appSrc), "TOC render loop branches on category vs entry lines");
check(/pdfDoc\.text\(line\.title, MARGIN_MM \+ \(useGrouping \? 4 : 0\), y\);/.test(appSrc), "grouped entries indented in TOC render");
// Ungrouped fallback: single-category case must still work (flat list, byte-identical positions)
check(/tocEntries\.forEach\(entry => tocLines\.push\(\{ type: 'entry', title: entry\.title, sourceIndex: entry\.sourceIndex \}\)\);/.test(appSrc), "flat (non-grouped) fallback path preserved");

// --- Task 5: "Calculated as of" / "Calculated on" timestamps ---
check(/function calculatedAsOfLine\(dateObj\)/.test(appSrc), "calculatedAsOfLine helper defined");
check(/calculatedAsOfLine\(\)/.test(appSrc.slice(appSrc.indexOf('function renderFlyingStarTemporalOverlay'), appSrc.indexOf('function renderFlyingStarTemporalOverlay') + 4000)), "used inside renderFlyingStarTemporalOverlay");
check((appSrc.match(/\$\{calculatedAsOfLine\(\)\}/g) || []).length >= 3, "calculatedAsOfLine used in at least 3 places (overlay + 2 forecasts)");
check(/function getPredictionGeneratedAt\(gameKey, isoDate\)/.test(predSrc), "getPredictionGeneratedAt defined in engine-predictions.js");
check((predSrc.match(/getPredictionGeneratedAt\('fourD', isoDate\)/g) || []).length === 1, "4D upcoming-draw loop looks up generatedAt");
check((predSrc.match(/getPredictionGeneratedAt\('toto', isoDate\)/g) || []).length === 1, "TOTO upcoming-draw loop looks up generatedAt");
check(/\.calculated-as-of \{/.test(cssSrc), "calculated-as-of CSS class present");

// --- Task 6: "Needs setup" badges ---
check(/function needsInputBadge\(isReady\)/.test(appSrc), "needsInputBadge helper defined");
check(/\.needs-input-badge \{/.test(cssSrc), "needs-input-badge CSS present");
check(/\$\{needsInputBadge\(!!mobileVal\)\}/.test(appSrc), "badge applied to Mobile Number pill");
check(/\$\{needsInputBadge\(prof\.vehicles\.length > 0\)\}/.test(appSrc), "badge applied to Vehicle Plate(s) pill");
// UPDATED (Task #76/#77): the address is now structured (u.home.addresses.profile), so readiness is
// computed as profReady = !isAddressEmpty(profAddr) rather than a simple !!addr on a free-text string.
check(/\$\{needsInputBadge\(profReady\)\}/.test(appSrc), "badge applied to Address Compatibility pill");
check(/\$\{needsInputBadge\(!!\(u\?\.home\?\.constructionYear && fsDirVal\)\)\}/.test(appSrc), "badge applied to Flying Star Optional Property Calculator pill");
check((appSrc.match(/needsInputBadge\(/g) || []).length === 5, "exactly 5 needsInputBadge call sites (1 definition + 4 usages)");

// --- Task 7: Export Readiness checklist ---
check(/function renderExportReadinessChecklist\(\)/.test(appSrc), "renderExportReadinessChecklist defined");
check(/id="exportReadinessChecklist"/.test(htmlSrc), "checklist container present in index.html");
check(/renderExportCenterList\(\); renderExportReadinessChecklist\(\); renderManageProfilesList\(\)/.test(appSrc), "checklist wired into go('account')");
check((appSrc.match(/renderExportReadinessChecklist\(\);/g) || []).length >= 4, "checklist re-rendered after add/edit/remove person actions too (>=4 call sites incl. go('account'))");
check(/\.export-readiness \{/.test(cssSrc), "export-readiness CSS present");
check(/\.export-readiness-allset \{/.test(cssSrc), "export-readiness-allset (all clear) CSS present");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
