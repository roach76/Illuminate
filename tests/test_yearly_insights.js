const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies "attached sample reading from another provider ... look at the details and incorporate the missing items into the
// app by reading the profile and not making things up": the Yearly Insights engine (twelve growth phases, clash / bond /
// punishment / harm / break / combination interactions, ten-god patterns, symbolic stars, Tai Sui / Sui Po / San Sha, exact
// Jiao Yun moment) and its three displays (Timing: Yearly Insights; Core: Natal Chart Notes; Environment: Annual Sector Guide),
// plus the Detailed Reading integration.
//
// HOW THE SAMPLE WAS USED: it was never read by the app. Its two yearly books (2026, 2027) for the same birth data were used
// afterwards, here, as an independent cross-check: where this engine's classical rules and the sample's printed facts overlap
// (month boundaries, month pillars, which interactions each month makes with the four natal pillars, the ten-god counts, the
// natal stars, the growth phase of each year, the Tai Sui / Sui Po / San Sha directions and the nine-sector star charts) they
// must agree. Where the engine deliberately differs (labels, stars it chooses not to compute, the decade assignment for months
// after the cycle change) the test says so rather than forcing a match.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(__PROJECT_ROOT__, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' }, document: dom.window.document, window: dom.window,
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL, html2pdf: () => ({ set() { return this; }, from() { return this; }, toPdf() { return { then() {} }; } }),
    alert: () => {}, confirm: () => true, fetch: undefined,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  const load = (f) => vm.runInContext(fs.readFileSync(path.join(__PROJECT_ROOT__, f), 'utf8'), sandbox, { filename: f });
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return sandbox;
}
const person = (first, last, date, time, gender) => ({ englishFirstName: first, englishLastName: last, birthdate: date, birthtime: time, gender, birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8, birthLatitude: 1.35 });
const roy = person('Liang Jie Roy', 'Wong', '1976-09-07', '09:33', 'male');
const user = { email: 'test@test.com', password: 'x', profile: roy, partner: person('Tina', 'Seah', '1976-04-15', '10:00', 'female') };
const sb = freshSandbox();
const run = (s) => vm.runInContext(s, sb);
run(`state.users['test@test.com'] = ${JSON.stringify(user)}; state.active = 'test@test.com'; go('chart');`);
const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ---------------------------------------------------------------------------------------------------------------------
// 1. Classical tables - checked against their own definitions, independent of any sample
// ---------------------------------------------------------------------------------------------------------------------
const tbl = JSON.parse(run(`(function(){
  const out = {};
  // growth phases: every stem passes through 12 distinct phases; 临官 sits on the stem's 禄 branch; 帝旺 on the known branch
  out.perm = stemCN.map((_, s) => new Set(branchCN.map((_, b) => computeGrowthPhase(s, b).index)).size);
  out.guan = stemCN.map((_, s) => branchCN.map((_, b) => computeGrowthPhase(s, b).index).indexOf(3) === SS_LU[s]);
  out.wang = stemCN.map((_, s) => branchCN[branchCN.map((_, b) => computeGrowthPhase(s, b).index).indexOf(4)]).join('');
  out.chang = stemCN.map((_, s) => branchCN[branchCN.map((_, b) => computeGrowthPhase(s, b).index).indexOf(0)]).join('');
  out.ren = branchCN.map((_, b) => computeGrowthPhase(8, b).zh).join('');
  out.yi = branchCN.map((_, b) => computeGrowthPhase(1, b).zh).join('');
  // symmetric relation tables
  const sym = (t) => Object.keys(t).every(k => t[t[k]] === Number(k));
  out.sym = [STEM_BOND, STEM_CLASH_PAIR, BRANCH_HARM, BRANCH_BREAK, SIX_CLASH].map(sym);
  out.sizes = [Object.keys(STEM_BOND).length, Object.keys(STEM_CLASH_PAIR).length, Object.keys(BRANCH_HARM).length, Object.keys(BRANCH_BREAK).length];
  out.trineCover = TRINE_GROUPS.map(g => g.slice(0, 3)).flat().sort((a, b) => a - b).join(',');
  out.seasonCover = SEASON_GROUPS.map(g => g.slice(0, 3)).flat().sort((a, b) => a - b).join(',');
  // punishments
  out.pun = { yinsi: branchPunishKind(2, 5), sishen: branchPunishKind(5, 8), chouxu: branchPunishKind(1, 10), xuwei: branchPunishKind(10, 7), zimao: branchPunishKind(0, 3), yinshen: branchPunishKind(2, 8), chouwei: branchPunishKind(1, 7), chen: branchPunishKind(4, 4), shen: branchPunishKind(8, 8), mao_chen: branchPunishKind(3, 4) };
  // guardians for every branch
  out.guard = branchCN.map((_, b) => { const g = computeYearGuardians(b); return g.taiSui + '/' + g.suiPo + '/' + g.sanSha; });
  // stars
  out.tianyi = Object.keys(SS_TIANYI).map(k => SS_TIANYI[k].length).join('');
  out.hong = branchCN.map((_, b) => { const h = mod(3 - b, 12); return mod(h + 6, 12) === mod(9 - b, 12); }).every(Boolean);
  return JSON.stringify(out);
})()`));
check(tbl.perm.every(n => n === 12), 'every stem passes through 12 distinct growth phases');
check(tbl.guan.every(Boolean), '临官 (Office) falls on each stem\'s 禄 branch');
check(tbl.wang === '卯寅午巳午巳酉申子亥', '帝旺 (Prime) falls on 甲卯 乙寅 丙午 丁巳 戊午 己巳 庚酉 辛申 壬子 癸亥');
check(tbl.chang === '亥午寅酉寅酉巳子申卯', '长生 (Growth) falls on 甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯');
check(tbl.ren === '帝旺衰病死墓绝胎养长生沐浴冠带临官', 'Yang Water (壬) across 子丑寅...亥 = 帝旺 衰 病 死 墓 绝 胎 养 长生 沐浴 冠带 临官');
check(tbl.yi === '病衰帝旺临官冠带沐浴长生养胎绝墓死', 'Yin Wood (乙) runs backward across 子丑寅...亥 = 病 衰 帝旺 临官 冠带 沐浴 长生 养 胎 绝 墓 死');
check(tbl.sym.every(Boolean) && tbl.sizes.join() === '10,8,12,12', 'bond / clash / harm / break tables are symmetric pairings with the right sizes');
check(tbl.trineCover === '0,1,2,3,4,5,6,7,8,9,10,11' && tbl.seasonCover === tbl.trineCover, 'trine groups and seasonal groups each cover all 12 branches exactly once');
check(tbl.pun.yinsi === 'ungrateful' && tbl.pun.sishen === 'ungrateful' && tbl.pun.chouxu === 'bully' && tbl.pun.xuwei === 'bully' && tbl.pun.zimao === 'rude', '三刑: 寅巳 巳申 (无恩), 丑戌 戌未 (恃势), 子卯 (无礼)');
check(tbl.pun.yinshen === null && tbl.pun.chouwei === null, '寅申 and 丑未 are clashes, not additionally punishments');
check(tbl.pun.chen === 'self' && tbl.pun.shen === null && tbl.pun.mao_chen === null, '自刑 applies to 辰午酉亥 only (not 申); 卯辰 is not a punishment');
const guardExpect = { 0: ['N', 'S', 'S'], 1: ['NE', 'SW', 'E'], 2: ['NE', 'SW', 'N'], 3: ['E', 'W', 'W'], 4: ['SE', 'NW', 'S'], 5: ['SE', 'NW', 'E'], 6: ['S', 'N', 'N'], 7: ['SW', 'NE', 'W'], 8: ['SW', 'NE', 'S'], 9: ['W', 'E', 'E'], 10: ['NW', 'SE', 'N'], 11: ['NW', 'SE', 'W'] };
// Tai Sui = the branch's own sector, Sui Po = the opposite (clashing) branch's sector, San Sha by trine group
Object.keys(guardExpect).forEach(b => check(tbl.guard[b] === guardExpect[b].join('/'), `Tai Sui / Sui Po / San Sha for branch ${b}: ${tbl.guard[b]}`));
check(tbl.tianyi === '2222222222', '天乙贵人 gives each of the ten stems exactly two branches');
check(tbl.hong === true, '天喜 is always opposite 红鸾 (+6)');

// ---------------------------------------------------------------------------------------------------------------------
// 2. Cross-check against the sample's facts for the same birth data (Roy, 7 Sep 1976 09:33, male)
// ---------------------------------------------------------------------------------------------------------------------
const base = JSON.parse(run(`(function(){ const p = getProfileData(${JSON.stringify(roy)}); const b = p.bazi;
  return JSON.stringify({ pillars: [b.yearStemIdx, b.yearBranchIdx, b.monthStemIdx, b.monthBranchIdx, b.dayStemIdx, b.dayBranchIdx, b.hourStemIdx, b.hourBranchIdx].join(','),
    counts: computeTenGodCounts(b), stars: computeNatalStars(b), cyc: p.daYunPillars.slice(0, 8).map(c => c.startISO),
    cycPil: p.daYunPillars.slice(0, 8).map(c => stemCN[c.stemIdx] + branchCN[c.branchIdx]).join(' ') }); })()`));
check(base.pillars === '2,4,2,8,8,10,1,5', 'natal pillars 丙辰 丙申 壬戌 乙巳 (the sample\'s chart)');
const exCounts = { P: 1, RW: 1, EG: 0, HO: 2, DW: 1, IW: 3, DO: 0, '7K': 4, DR: 1, IR: 2 };
check(Object.keys(exCounts).every(k => (base.counts[k] || 0) === exCounts[k]) && Object.values(base.counts).reduce((a, b) => a + b, 0) === 15, 'ten-god counts match the sample exactly (15 marks)');
check(same(base.stars.hour, ['tianyi', 'taiji', 'jiesha', 'wangshen', 'guchen', 'tianxi']), 'hour-pillar stars match the sample: 天乙 太极 劫煞 亡神 孤辰 天喜');
check(base.stars.year.includes('fuxing') && base.stars.day.includes('yuede') && base.stars.day.includes('yinyangcuocuo'), 'year 福星, day 月德 + 阴阳差错 match the sample');
check(base.stars.month.includes('xuetang') && base.stars.month.includes('yima'), 'month-pillar 学堂 + 驿马 match the sample');
check(base.cycPil.startsWith('丁酉 戊戌 己亥 庚子 辛丑 壬寅 癸卯 甲辰'), 'ten-year cycles 丁酉 戊戌 己亥 庚子 辛丑 壬寅 癸卯 甲辰');
// Jiao Yun: the sample prints 29 Oct 2016 and 29 Oct 2026 (GMT+8); the engine works from the real birth instant
const sgt = (iso) => new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10);
check(Math.abs(Date.parse(sgt(base.cyc[4]) + 'T00:00:00Z') - Date.parse('2016-10-29T00:00:00Z')) <= 86400000 && Math.abs(Date.parse(sgt(base.cyc[5]) + 'T00:00:00Z') - Date.parse('2026-10-29T00:00:00Z')) <= 86400000, `Jiao Yun of 辛丑 and 壬寅 falls on 29 Oct 2016 / 2026 within a day (${sgt(base.cyc[4])}, ${sgt(base.cyc[5])})`);

const yrs = JSON.parse(run(`(function(){ const p = getProfileData(${JSON.stringify(roy)}); return JSON.stringify([2026, 2027].map(yr => { const y = computeYearlyInsights(p, yr);
  return { year: yr, phase: y.phase.zh, guard: y.guardians, sectors: Object.fromEntries(y.sectors.map(s => [s.dir, s.star])), cyN: y.cycleYearNumber, cycle: stemCN[y.cycle.stemIdx] + branchCN[y.cycle.branchIdx], startMs: y.startMs, endMs: y.endMs,
    inter: y.interactions.map(i => i.kind + ':' + i.tgt), combos: y.combos, fav: y.favourable, stars: y.stars,
    months: y.months.map(m => ({ key: m.key, pil: stemCN[m.stemIdx] + branchCN[m.branchIdx], startMs: m.startMs, endMs: m.endMs, inter: m.interactions.map(i => i.kind + ':' + i.tgt + (i.elem !== undefined && i.elem !== null ? '>' + i.elem : '')), combos: m.combos, stars: m.stars, chg: m.cycleChanges, cyc: stemCN[m.cycle.stemIdx] + branchCN[m.cycle.branchIdx], elem: m.elem, fav: m.favourable, bal: m.balancing })) }; })); })()`));
const [y26, y27] = yrs;
check(y26.phase === '胎' && y27.phase === '养', 'year-in-a-line growth phases: 2026 午 = 胎 (Conception / "Seeding"), 2027 未 = 养 (Nurture / "Nurturing")');
check(y26.cyN === 10 && y27.cyN === 1 && y26.cycle === '辛丑' && y27.cycle === '壬寅', '2026 is year 10 of the 辛丑 cycle, 2027 is year 1 of the 壬寅 cycle');
check(JSON.stringify(y26.guard) === '{"taiSui":"S","suiPo":"N","sanSha":"N"}' && JSON.stringify(y27.guard) === '{"taiSui":"SW","suiPo":"NE","sanSha":"W"}', 'Tai Sui / Sui Po / San Sha: 2026 S/N/N, 2027 SW/NE/W (as printed in the sample)');
const sec26 = { SE: 9, S: 5, SW: 7, E: 8, center: 1, W: 3, NE: 4, N: 6, NW: 2 }, sec27 = { SE: 8, S: 4, SW: 6, E: 7, center: 9, W: 2, NE: 3, N: 5, NW: 1 };
check(JSON.stringify(Object.keys(sec26).map(k => y26.sectors[k])) === JSON.stringify(Object.values(sec26)), '2026 nine-sector flying-star chart matches the sample');
check(JSON.stringify(Object.keys(sec27).map(k => y27.sectors[k])) === JSON.stringify(Object.values(sec27)), '2027 nine-sector flying-star chart matches the sample');

// month boundaries and pillars, GMT+8 (sample times; this engine's solver may differ by minutes)
const sampleStart = {
  2026: ['2026-02-04T04:02', '2026-03-05T21:59', '2026-04-05T02:40', '2026-05-05T19:48', '2026-06-05T23:48', '2026-07-07T09:56', '2026-08-07T19:42', '2026-09-07T22:41', '2026-10-08T14:29', '2026-11-07T17:52', '2026-12-07T10:52', '2027-01-05T22:09'],
  2027: ['2027-02-04T09:46', '2027-03-06T03:39', '2027-04-05T08:17', '2027-05-06T01:25', '2027-06-06T05:25', '2027-07-07T15:37', '2027-08-08T01:26', '2027-09-08T04:28', '2027-10-08T20:17', '2027-11-07T23:38', '2027-12-07T16:37', '2028-01-06T03:54']
};
const samplePil = { 2026: '庚寅 辛卯 壬辰 癸巳 甲午 乙未 丙申 丁酉 戊戌 己亥 庚子 辛丑', 2027: '壬寅 癸卯 甲辰 乙巳 丙午 丁未 戊申 己酉 庚戌 辛亥 壬子 癸丑' };
yrs.forEach(y => {
  check(y.months.map(m => m.pil).join(' ') === samplePil[y.year], `${y.year}: the 12 month pillars match the sample (${samplePil[y.year]})`);
  const worst = Math.max(...y.months.map((m, i) => Math.abs(m.startMs + 8 * 3600e3 - Date.parse(sampleStart[y.year][i] + ':00Z'))));
  check(worst <= 20 * 60e3, `${y.year}: every solar-term month boundary is within 20 minutes of the sample (worst ${(worst / 60e3).toFixed(1)} min)`);
  check(y.months.every((m, i) => i === 11 ? m.endMs === y.endMs : m.endMs === y.months[i + 1].startMs) && y.months[0].startMs === y.startMs, `${y.year}: the 12 months tile the Li Chun year with no gap or overlap`);
});

// interactions each month makes with the four natal pillars: the sample's printed list, mapped to this engine's kinds
const E = { // sample facts (not engine output): kind:target pairs
  2026: [
    ['stem-bond:hour', 'clash:month', 'double-clash:month', 'punish:hour', 'harm:hour'],
    ['stem-bond:year', 'stem-bond:month', 'stem-clash:hour', 'harm:year', 'branch-bond:day>1'],
    ['stem-clash:year', 'stem-clash:month', 'repeat:year', 'self-punish:year', 'same-branch-stem-clash:year', 'clash:day', 'store-open:day>1', 'same-stem-branch-clash:day'],
    ['branch-bond:month>4', 'punish:month', 'break:month', 'repeat:hour'],
    ['half-trine:day>1'],
    ['punish:day', 'break:day', 'double-clash:cycle', 'clash:cycle'],
    ['stem-clash:day', 'repeat:month', 'repeat-pillar:month', 'branch-bond:hour>4', 'punish:hour', 'break:hour'],
    ['stem-bond:day', 'branch-bond:year>3', 'harm:day', 'half-trine:hour>3', 'season:month,day>3'],
    ['clash:year', 'store-open:year>4', 'repeat:day', 'same-branch-stem-clash:day'],
    ['harm:month', 'clash:hour', 'double-clash:hour'],
    ['stem-bond:hour', 'trine:month,year>4', 'double-clash:flowYear', 'clash:flowYear'],
    ['stem-bond:year', 'stem-bond:month', 'stem-clash:hour', 'break:year', 'punish:day'] // Jan 2027 - the sample's extra "伏吟（大运）" uses the 2026 decade for that month; the engine uses the decade actually running
  ],
  2027: [
    ['stem-clash:year', 'stem-clash:month', 'clash:month', 'double-clash:month', 'punish:hour', 'harm:hour', 'repeat-pillar:cycle'],
    ['harm:year', 'branch-bond:day>1'],
    ['repeat:year', 'self-punish:year', 'clash:day', 'store-open:day>1'],
    ['branch-bond:month>4', 'punish:month', 'break:month', 'repeat:hour', 'repeat-pillar:hour'],
    ['stem-clash:day', 'half-trine:day>1'],
    ['stem-bond:day', 'punish:day', 'break:day', 'repeat-pillar:flowYear'],
    ['repeat:month', 'branch-bond:hour>4', 'punish:hour', 'break:hour', 'double-clash:cycle', 'clash:cycle'],
    ['branch-bond:year>3', 'harm:day', 'half-trine:hour>3', 'season:month,day>3'],
    ['stem-bond:hour', 'clash:year', 'store-open:year>4', 'double-clash:year', 'repeat:day'],
    ['stem-bond:year', 'stem-bond:month', 'stem-clash:hour', 'harm:month', 'clash:hour', 'double-clash:hour'],
    ['stem-clash:year', 'stem-clash:month', 'trine:month,year>4'],
    ['break:year', 'punish:day', 'double-clash:flowYear', 'clash:flowYear']
  ]
};
yrs.forEach(y => y.months.forEach((m, i) => {
  // the sample orders palaces differently and prints "month,day" participants in chart order; compare as sets
  check(same(m.inter, E[y.year][i]), `${y.year} month ${m.key} ${m.pil}: interactions match the sample (${m.inter.join(' ')})`);
}));
check(y27.months.every(m => m.cyc === '壬寅'), 'every month of 2027 runs in the 壬寅 decade');
check(y26.months[8].chg === true && y26.months[8].key === 10 && y26.months[9].cyc === '壬寅' && y26.months[7].cyc === '辛丑', 'October 2026 is flagged as containing the change of cycle; August is 辛丑 and November is 壬寅');

// ten-god patterns: the sample's per-month list, mapped to this engine's names (the sample calls 官-triggered ones 杀印相生)
const C26 = [['shayin', 'shangguanpeiyin'], ['shayin', 'shangguanpeiyin'], [], [], ['xiaoshen'], ['shangguanpeiyin'], ['bijie', 'caipoyin'], ['bijie', 'caipoyin'], ['shayin'], ['guanyin', 'guansha'], ['shayin', 'shangguanpeiyin'], ['shayin', 'shangguanpeiyin']];
const C27 = [[], [], ['xiaoshen'], ['shangguanpeiyin'], ['bijie', 'caipoyin'], ['bijie', 'caipoyin'], ['shayin'], ['guanyin', 'guansha'], ['shayin', 'shangguanpeiyin'], ['shayin', 'shangguanpeiyin'], [], []];
y26.months.forEach((m, i) => check(same(m.combos, C26[i]), `2026 month ${m.key} ${m.pil}: ten-god patterns ${m.combos.join(',') || 'none'}`));
y27.months.forEach((m, i) => check(same(m.combos, C27[i]), `2027 month ${m.key} ${m.pil}: ten-god patterns ${m.combos.join(',') || 'none'}`));
check(same(y26.combos, ['bijie', 'caipoyin']) && same(y27.combos, ['bijie', 'caipoyin']), 'a wealth-stem year (丙午, 丁未) forms 比劫夺财 and 财破印 against this chart');
check(same(y26.inter, ['stem-clash:day', 'half-trine:day', 'stem-bond:cycle']) && same(y27.inter, ['stem-bond:day', 'punish:day', 'break:day', 'stem-bond:cycle']), 'the year meets the four pillars as the sample prints it (2026: 干冲+半合 with the day, 干合 with the decade; 2027: 干合+刑+破 with the day, 干合 with the decade)');

// stars each flowing month carries: every star the sample prints AND this engine implements must be present
const S26 = [['wenchang', 'yima'], ['tianyi', 'taohua'], ['huagai', 'yuede'], ['tianyi', 'taiji', 'jiesha', 'wangshen', 'guchen', 'tianxi', 'tiande'], ['feiren', 'zaisha', 'jiangxing'], [], ['taiji', 'xuetang', 'yima'], ['taohua'], ['huagai'], ['lushen', 'jiesha', 'wangshen', 'hongluan'], ['yangren', 'hongyan', 'jiangxing', 'zaisha'], ['jinyu', 'guasu']];
const S27 = [['wenchang', 'yima', 'yuede'], ['tianyi', 'taohua', 'tiande'], ['huagai'], ['tianyi', 'taiji', 'jiesha', 'wangshen', 'guchen', 'tianxi'], ['feiren', 'zaisha', 'jiangxing'], [], ['taiji', 'xuetang', 'yima'], ['taohua'], ['huagai'], ['lushen', 'jiesha', 'wangshen', 'hongluan'], ['yangren', 'hongyan', 'jiangxing', 'zaisha', 'yuede'], ['jinyu', 'guasu', 'tiande']];
const sub = (a, b) => a.every(x => b.includes(x));
y26.months.forEach((m, i) => check(sub(S26[i], m.stars), `2026 month ${m.key} ${m.pil}: carries the sample's stars ${S26[i].join(',') || '(none)'} (engine: ${m.stars.join(',') || 'none'})`));
y27.months.forEach((m, i) => check(sub(S27[i], m.stars), `2027 month ${m.key} ${m.pil}: carries the sample's stars ${S27[i].join(',') || '(none)'} (engine: ${m.stars.join(',') || 'none'})`));
check(y26.months.concat(y27.months).every(m => m.stars.every(id => ['fuxing'].includes(id) || S26.concat(S27).flat().includes(id))), 'the engine adds no star type the sample never shows other than 福星 (a standard rule the sample omits for flowing months)');

// ---------------------------------------------------------------------------------------------------------------------
// 3. Verdicts follow THIS APP's Useful God, not the sample's
// ---------------------------------------------------------------------------------------------------------------------
const verdict = JSON.parse(run(`(function(){ const p = getProfileData(${JSON.stringify(roy)}); const a = computeDetailedReadingAnalysis(p); const y = computeYearlyInsights(p, 2026);
  return JSON.stringify({ fav: a.usefulGod.favourable, ok: y.months.every(m => m.favourable === a.usefulGod.favourable.includes(m.elem)), yearFav: y.favourable === a.usefulGod.favourable.includes(y.elem),
    bal: y.months.filter(m => !m.favourable).every(m => { const b = m.balancing; return b && a.usefulGod.favourable.includes(b.elem) && (b.how === 'restrain' ? mod(b.elem + 2, 5) === m.elem : mod(b.elem - 1, 5) === m.elem); }),
    balNone: computeBalancingElement(3, [0, 2]) }); })()`));
check(verdict.ok && verdict.yearFav, 'every month\'s Favourable / Attention follows the same Useful God (用神) verdict the Detailed Reading uses');
check(verdict.bal, 'every Attention month names a balancing element that is favourable and really restrains (克) or drains (泄) the month\'s element');
check(verdict.balNone === null, 'no balancing element is invented when no favourable element can restrain or drain the excess');

// ---------------------------------------------------------------------------------------------------------------------
// 4. Display: Timing / Core / Environment, both languages, the PDF registry and the Detailed Reading
// ---------------------------------------------------------------------------------------------------------------------
const html = run(`generateYearlyInsightsHTML(getProfileData(${JSON.stringify(roy)}))`);
const text = strip(html);
const nowY = new Date().getFullYear();
check((html.match(/<article class="reading">/g) || []).length === 2, 'two yearly articles (current and next Li Chun year)');
check(/Yearly Insights/.test(text) && /The year in a line/.test(text) && /Month by month/.test(text) && /Practice by element/.test(text) && /What helps this year/.test(text) && /What to watch this year/.test(text), 'sections: year in a line, helps / watch, month by month, practice by element');
check((html.match(/Start of Spring|Insects Awaken|Clear and Bright|Start of Summer|Grain in Ear|Minor Heat|Start of Autumn|White Dew|Cold Dew|Start of Winter|Major Snow|Minor Cold/g) || []).length >= 48, 'both years name all 12 solar terms in the strip and the table');
check(!/undefined|NaN|\[object/.test(text), 'no "undefined", NaN or [object] in the English yearly reading');
const natal = run(`renderNatalChartNotesHTML(getProfileData(${JSON.stringify(roy)}))`);
check(/Natal Chart Notes/.test(strip(natal)) && /Day Master stands at/.test(strip(natal)) && /The ten gods, counted - 15 marks/.test(strip(natal)) && /Fortune Star/.test(strip(natal)), 'natal chart notes: growth phase per pillar, ten-god counts (15 marks) and the stars');
const sector = run(`renderAnnualSectorGuideHTML()`);
check((sector.match(/Annual Sector Guide/g) || []).length === 2 && /Tai Sui/.test(strip(sector)) && /Year Breaker/.test(strip(sector)) && /Three Killings/.test(strip(sector)), 'sector guide: two years, each with Tai Sui, Year Breaker and Three Killings marked');
check(/reads nothing from your birth chart/.test(strip(sector)), 'the sector guide says it reads nothing from the chart (it is a tradition about places)');
run(`lang = 'zh'`);
const htmlZh = run(`generateYearlyInsightsHTML(getProfileData(${JSON.stringify(roy)}))`), natalZh = run(`renderNatalChartNotesHTML(getProfileData(${JSON.stringify(roy)}))`), sectorZh = run(`renderAnnualSectorGuideHTML()`);
run(`lang = 'en'`);
[['yearly', htmlZh], ['natal', natalZh], ['sector', sectorZh]].forEach(([k, h]) => {
  const t = strip(h);
  check(!/undefined|NaN|\[object/.test(t), `no "undefined" in the Chinese ${k} output`);
  check(!/(胎|养|死|病|墓|绝|长生|冠带|沐浴) \1/.test(t) && !/(干合|干冲|天克地冲|伏吟|比劫夺财|杀印相生|伤官配印) \1/.test(t) && !/(福星贵人|太极贵人|天乙贵人|月德贵人|驿马|桃花|华盖|劫煞|亡神|学堂|禄神) \1/.test(t), `the Chinese ${k} output does not double the Chinese term`);
});
check(/年流年书/.test(strip(htmlZh)) && /逐月/.test(strip(htmlZh)) && /命盘批注/.test(strip(natalZh)) && /九宫方位指南/.test(strip(sectorZh)), 'Chinese headings are present');

// the three displays are wired into the tabs (and therefore the PDF, which is built from the same registry)
run(`state.users['test@test.com'].profile = ${JSON.stringify(roy)}; go('chart');`);
const reg = JSON.parse(run(`(function(){ const dom = document; renderSystemChart(getProfileData(), 'i', null, false, null); const t = chartTabRegistry['i']; return JSON.stringify({ timing: /Yearly Insights/.test(t.timing) && /Month by month/.test(t.timing), core: /Natal Chart Notes/.test(t.core), env: /Annual Sector Guide/.test(t.environment), jy: /Exact Jiao Yun Moment/.test(t.timing) }); })()`));
check(reg.timing && reg.core && reg.env && reg.jy, 'Yearly Insights (Timing), Natal Chart Notes (Core), Sector Guide (Environment) and the exact Jiao Yun row are all in the tab registry the PDF is built from');

const integ = JSON.parse(run(`(function(){ const i = buildIntegratedSignals(getProfileData(${JSON.stringify(roy)}), 'i'); const y = i.signals.filter(s => s.sys === 'yearly');
  return JSON.stringify({ n: y.length, doms: [...new Set(y.map(s => s.doms.join('+')))], pols: [...new Set(y.map(s => s.pol))], unavailable: i.unavailable.includes('yearly'), sample: y.slice(0, 3).map(s => s.text) }); })()`));
check(integ.n >= 8 && !integ.unavailable, `the Detailed Reading takes ${integ.n} Yearly Insights signals`);
check(integ.pols.includes(1) && integ.pols.includes(-1), 'the signals include both supportive and cautionary lines');
check(integ.doms.some(d => /thisYear/.test(d)) && integ.doms.some(d => /nextYear/.test(d)), 'signals land in both the this-year and next-year sections');
const dr = strip(run(`generateDetailedReading(getProfileData(${JSON.stringify(roy)}), 'i')`));
check(/Yearly Insights \(Li Chun year\)/.test(dr) && /Day Master stands at/.test(dr), 'the Detailed Reading names Yearly Insights among the systems and quotes the growth phase');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
