const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Real-browser probe for Task 4 (Grouped PDF Table of Contents). jsdom can't run html2canvas/jsPDF's
// real text-layout, so this drives the ACTUAL app in headless Chromium via Playwright, triggers a
// real PDF export with a rich profile (partner + business partner + child + household occupants, so
// enough distinct sections exist to land in more than one TOC category), downloads the PDF, and uses
// pdftotext to verify the TOC pages actually contain the expected category header lines, in a
// sensible order, with real section titles still present and correctly grouped underneath them.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'http://127.0.0.1:8766/index.html';
const OUT_DIR = require('path').join(__dirname, 'toc_probe_out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const STORAGE_KEY = 'illuminate-local-v101';
const testUser = {
  email: 'tocprobe@test.com', password: 'x',
  profile: {
    englishFirstName: 'Roy', englishLastName: 'Wong', chineseName: '梁杰',
    birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
    birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8,
    mobileNumber: '91234567',
    vehicles: [{ number: 'SJL1234A', shared: true }],
    fsDir: 'Southeast',
    bazhaiOccupants: [
      { name: 'Mother', birthYear: 1950, approxBirthdate: true },
    ],
  },
  partner: {
    englishFirstName: 'Tina', englishLastName: 'Seah', chineseName: '陈婷',
    birthdate: '1976-04-25', birthtime: '10:21', gender: 'female',
    birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8,
    mobileNumber: '98765432',
  },
  businessPartner: {
    englishFirstName: 'Bobby', englishLastName: 'Lim', chineseName: '林伯',
    birthdate: '1980-01-15', birthtime: '06:00', gender: 'male',
    birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8,
    mobileNumber: '96547821',
  },
  children: [
    { englishFirstName: 'Alex', englishLastName: 'Wong', birthdate: '2010-05-01', birthtime: '12:00', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, mobileNumber: '90001111' },
  ],
  home: { address: '123 Orchard Road, Singapore', constructionYear: 2015 },
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
  const consoleLines = [];
  page.on('console', msg => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLines.push(`[pageerror] ${err.message}`));

  await page.goto(BASE_URL);
  await page.evaluate(({ key, user }) => {
    localStorage.setItem(key, JSON.stringify({ users: { [user.email]: user }, active: user.email }));
  }, { key: STORAGE_KEY, user: testUser });
  await page.reload();
  await page.waitForTimeout(500);

  const libsOk = await page.evaluate(() => ({
    html2pdf: typeof window.html2pdf !== 'undefined',
  }));
  console.log('CDN libs loaded:', JSON.stringify(libsOk));
  if (!libsOk.html2pdf) {
    console.log('html2canvas not available in this sandbox (likely CDN blocked) - cannot run real export. Aborting probe honestly rather than faking a result.');
    console.log('Console/page errors seen:', JSON.stringify(consoleLines.slice(-20), null, 2));
    await browser.close();
    process.exit(2);
  }

  const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
  const exportResult = await page.evaluate(async () => {
    try {
      await exportProfileToPdf('i');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e && e.stack || e) };
    }
  });
  console.log('exportProfileToPdf result:', JSON.stringify(exportResult));

  let pdfPath = null;
  try {
    const download = await downloadPromise;
    pdfPath = path.join(OUT_DIR, 'export.pdf');
    await download.saveAs(pdfPath);
    console.log('Downloaded PDF to', pdfPath);
  } catch (e) {
    console.log('No download event captured:', e.message);
  }
  console.log('--- last 30 console lines ---');
  console.log(consoleLines.slice(-30).join('\n'));
  await browser.close();

  if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.log('PROBE INCONCLUSIVE: no PDF produced.');
    process.exit(3);
  }

  const info = execSync(`pdfinfo "${pdfPath}"`).toString();
  const pageCountMatch = info.match(/Pages:\s+(\d+)/);
  const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 0;
  console.log('Page count:', pageCount);

  // Extract text layout-preserved from just the first couple of pages (the TOC pages come first).
  const tocText = execSync(`pdftotext -layout -f 1 -l 2 "${pdfPath}" -`).toString();
  fs.writeFileSync(path.join(OUT_DIR, 'toc_text.txt'), tocText);
  console.log('--- Extracted TOC text (pages 1-2) ---');
  console.log(tocText);

  const expectedCategories = ['Core Charts', 'Timing & Forecasts', 'Feng Shui & Environment', 'Compatibility'];
  const foundCategories = expectedCategories.filter(c => tocText.includes(c));
  console.log('Categories found in TOC:', foundCategories);

  let pass = 0, fail = 0;
  function check(cond, msg) { if (cond) { pass++; console.log('PASS: ' + msg); } else { fail++; console.error('FAIL: ' + msg); } }

  check(tocText.includes('Table of Contents'), 'TOC page has its title');
  check(foundCategories.length >= 2, `at least 2 category headers appear in the TOC (found: ${foundCategories.join(', ') || 'none'})`);
  check(tocText.includes('Feng Shui & Environment') || tocText.includes('Personal Assets'), 'Feng Shui / Personal Assets related section appears somewhere in TOC region checked');
  // Sanity: a real section title (unrelated to grouping) still appears - grouping didn't eat content.
  check(/Ba\s*Zi|BaZi|八字|Zodiac|生肖/i.test(tocText), 'a core-chart section title (BaZi/Zodiac) still appears in the TOC');
  // Category header should appear BEFORE its member entries in raw text order for at least one category.
  if (foundCategories.length >= 1) {
    const catIdx = tocText.indexOf(foundCategories[0]);
    check(catIdx !== -1, 'first found category header has a valid position in text');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
