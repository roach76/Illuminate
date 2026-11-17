const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies "redesign this site to be viewable on any type of browsers on both mobile and desktop": the responsive shell
// (phone / tablet / desktop-with-sidebar), the cross-browser fallbacks, and the three things that must NOT change - the PDF
// export's isolated 420px container, the script load order, and the app's behaviour in a browser too old to run it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }
const read = (f) => fs.readFileSync(path.join(__PROJECT_ROOT__, f), 'utf8');
const css = read('styles.css'), html = read('index.html'), app = read('app.js');

// ---- 1. the stylesheet ----
const MARK = 'RESPONSIVE SHELL';
const idx = css.indexOf(MARK);
check(idx > 0, 'the responsive-shell block exists in styles.css');
const block = css.slice(css.lastIndexOf('/*', idx));
check((css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length, 'styles.css has balanced braces');
check(/@media \(min-width: 640px\)/.test(block) && /@media \(min-width: 1024px\)/.test(block) && /@media \(min-width: 1600px\)/.test(block), 'three width breakpoints: tablet 640, desktop 1024, wide 1600');
check(/\.app, \.top-bar, \.nav \{ width: 100%; \}/.test(block), 'phones use the full width (the old 430px cap is overridden)');
check(/body\.has-nav \.app \{ padding-left: var\(--nav-w\); \}/.test(block) && /\.nav \{ top: 66px[^}]*flex-direction: column/.test(block), 'desktop: a left sidebar navigation with the content offset beside it');
check(/body:not\(\.has-nav\) \.view \{ max-width: 680px; \}/.test(block), 'desktop: sign-in / intake forms stay at a readable width');
check(/env\(safe-area-inset-bottom/.test(block) && /env\(safe-area-inset-top/.test(block), 'notch / home-indicator safe areas are respected');
check(/100dvh/.test(block) && /text-size-adjust/.test(block) && /:focus-visible/.test(block) && /prefers-reduced-motion/.test(block) && /hover: hover/.test(block), 'dynamic viewport height, text-size-adjust, focus ring, reduced motion and hover-only affordances');
check(/top: 0; right: 0; bottom: 0; left: 0/.test(block), 'a fallback exists for browsers without the `inset` shorthand');
check(/"PingFang SC"/.test(block) && /"Microsoft YaHei"/.test(block) && /"Segoe UI"/.test(block) && /Roboto/.test(block), 'system font fallbacks cover Windows, Android, Apple and Chinese text');

// PDF safety: every selector in the block starts with an app-shell prefix, never a bare content class
const allowed = [':root', 'html', 'body', '.app', '.top-bar', '.nav', '.view', '.modal-overlay', '.modal-box', ':focus-visible', 'img', '@supports', '@media'];
const stripped = block.replace(/\/\*[\s\S]*?\*\//g, '');
const selectors = [];
(function walk(src) {
  let depth = 0, cur = '', open = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') { const head = cur.trim(); cur = ''; if (/^@(media|supports)/.test(head)) { open.push('at'); } else { open.push('rule'); head.split(',').forEach(s => selectors.push(s.trim())); } depth++; }
    else if (c === '}') { open.pop(); depth--; cur = ''; }
    else if (c === ';' && open[open.length - 1] === 'rule') { cur = ''; }
    else if (open[open.length - 1] === 'rule') { /* declaration text */ }
    else cur += c;
  }
})(stripped);
const bad = selectors.filter(s => s && !allowed.some(p => s.startsWith(p)) && !/^(video|svg)$/.test(s));
check(selectors.length > 40 && bad.length === 0, `all ${selectors.length} responsive selectors are scoped to the app shell (offenders: ${bad.join(' | ') || 'none'})`);
check(/\.view\s*\{/.test(block) && !/(^|[\s,])\.(reading|calc-box|pill|section-header|chart-tab-panel)\b/m.test(stripped), 'no report-content class is restyled by the responsive block');

// ---- 2. index.html ----
const head = html.slice(0, html.indexOf('<body>'));
check(/name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/.test(head), 'viewport meta uses device width and viewport-fit=cover');
check(!/user-scalable\s*=\s*no|maximum-scale/.test(head), 'zooming is NOT disabled (accessibility)');
check(/name="color-scheme" content="light"/.test(head), 'color-scheme is declared so forced dark modes do not invert the page');
check(/<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/.test(html), 'a <noscript> message exists');
const srcOrder = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
check(srcOrder.join(',') === 'engine-core.js,engine-metaphysics.js,engine-predictions.js,auth.js,app.js', 'the app script load order is unchanged');
check(/class="nav hidden" id="nav"/.test(html), 'the navigation element and its hidden toggle are unchanged');

const inline = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
check(inline.length === 2, 'exactly two small inline scripts (support check, nav mirror)');
inline.forEach((code, i) => {
  const noStrings = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
  check(!/=>|\blet\b|\bconst\b|`|\?\.|\?\?|\bclass\s+\w|\.\.\./.test(noStrings), `inline script ${i + 1} is ES5-only (it must run in browsers too old for the app)`);
  try { new vm.Script(code); check(true, ''); } catch (e) { check(false, `inline script ${i + 1} parses: ${e.message}`); }
});

// support check: modern engine -> no flag; an engine without optional chaining -> flag + visible notice
function runSupportCheck(breakFunction) {
  const dom = new JSDOM('<!doctype html><body><main class="app"></main></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  if (breakFunction) w.Function = function () { throw new SyntaxError('Unexpected token .'); };
  w.eval(inline[0]);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return { flag: !!w.__illuminateUnsupportedBrowser, banner: w.document.querySelector('[role="alert"]') };
}
const okRun = runSupportCheck(false), oldRun = runSupportCheck(true);
check(!okRun.flag && !okRun.banner, 'a current browser sees no unsupported-browser notice');
check(oldRun.flag && oldRun.banner && /too old/.test(oldRun.banner.textContent) && /浏览器/.test(oldRun.banner.textContent), 'a browser that cannot parse the app\'s syntax sees a plain bilingual notice instead of a blank page');

// nav mirror: has-nav follows the nav's hidden class
(async () => {
  const dom = new JSDOM('<!doctype html><body><main class="app"><nav class="nav hidden" id="nav"></nav></main></body>', { runScripts: 'outside-only' });
  const w = dom.window; w.eval(inline[1]);
  const tick = () => new Promise(r => setTimeout(r, 30));
  check(!w.document.body.classList.contains('has-nav'), 'nav hidden -> no has-nav class');
  w.document.getElementById('nav').classList.remove('hidden'); await tick();
  check(w.document.body.classList.contains('has-nav'), 'nav shown -> body gets has-nav');
  w.document.getElementById('nav').classList.add('hidden'); await tick();
  check(!w.document.body.classList.contains('has-nav'), 'nav hidden again -> has-nav removed');

  // ---- 3. the PDF export stays isolated from the responsive shell ----
  check(/batchContainer\.style\.cssText = `position:relative; width:\$\{EXPORT_CAPTURE_WIDTH\}px; background:#fff;`/.test(app) && /document\.body\.appendChild\(batchContainer\)/.test(app), 'the PDF capture container is a fixed-width element appended to <body>, outside .app');
  check(/const EXPORT_CAPTURE_WIDTH = 420;/.test(app), 'the PDF capture width is unchanged (420px)');

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
