// FILE: engine-metaphysics.js
// Description: Core Metaphysics Math, Calendars, and Precise Formulae (Including Da Yun Fix)

function getStrokes(str) { if (!str || str.length === 0) return 1; let s = 0; for (let i = 0; i < str.length; i++) s += str.charCodeAt(i); return (s % 21) + 2; }

// BUG 17/18 FIX: Ten God (十神) engine - the single biggest missing calculation needed to match the
// reference BaZi chart template, which labels every stem (heavenly + hidden) with its Ten God relative
// to the Day Master. This was not implemented anywhere in the app before. Standard rule: compare the
// target stem's element+polarity to the Day Master's; abbreviations confirmed against the user's own
// reference chart image (RW/EG/DO/DR/IW/IR/7K/HO/DM/P).
const HIDDEN_STEMS_BY_BRANCH = [
  [9],        // Zi (子): Gui
  [5,9,7],    // Chou (丑): Ji, Gui, Xin
  [0,2,4],    // Yin (寅): Jia, Bing, Wu
  [1],        // Mao (卯): Yi
  [4,1,9],    // Chen (辰): Wu, Yi, Gui
  [2,4,6],    // Si (巳): Bing, Wu, Geng
  [3,5],      // Wu (午): Ding, Ji
  [5,3,1],    // Wei (未): Ji, Ding, Yi
  [6,8,4],    // Shen (申): Geng, Ren, Wu
  [7],        // You (酉): Xin
  [4,7,3],    // Xu (戌): Wu, Xin, Ding
  [8,0]       // Hai (亥): Ren, Jia
];
const TEN_GOD_INFO = {
  peer:      { abbr: 'P',  cn: '比肩', en: 'Peer' },
  robWealth: { abbr: 'RW', cn: '劫财', en: 'Rob Wealth' },
  eatingGod: { abbr: 'EG', cn: '食神', en: 'Eating God' },
  hurtingOfficer: { abbr: 'HO', cn: '伤官', en: 'Hurting Officer' },
  indirectWealth: { abbr: 'IW', cn: '偏财', en: 'Indirect Wealth' },
  directWealth:   { abbr: 'DW', cn: '正财', en: 'Direct Wealth' },
  sevenKillings:  { abbr: '7K', cn: '七杀', en: 'Seven Killings' },
  directOfficer:  { abbr: 'DO', cn: '正官', en: 'Direct Officer' },
  indirectResource: { abbr: 'IR', cn: '偏印', en: 'Indirect Resource' },
  directResource:   { abbr: 'DR', cn: '正印', en: 'Direct Resource' },
  dayMaster: { abbr: 'DM', cn: '日元', en: 'Day Master' }
};
// Returns the Ten God relationship of targetStemIdx relative to dmStemIdx (0-9 stem indices).
function getTenGod(dmStemIdx, targetStemIdx) {
  if (targetStemIdx === dmStemIdx) return TEN_GOD_INFO.peer; // same stem = Peer (same element, same polarity)
  const dmElem = Math.floor(dmStemIdx / 2), dmYang = (dmStemIdx % 2 === 0);
  const tElem = Math.floor(targetStemIdx / 2), tYang = (targetStemIdx % 2 === 0);
  const samePolarity = dmYang === tYang;
  if (tElem === dmElem) return samePolarity ? TEN_GOD_INFO.peer : TEN_GOD_INFO.robWealth;
  if (mod(dmElem + 1, 5) === tElem) return samePolarity ? TEN_GOD_INFO.eatingGod : TEN_GOD_INFO.hurtingOfficer; // DM generates target
  if (mod(tElem + 1, 5) === dmElem) return samePolarity ? TEN_GOD_INFO.indirectResource : TEN_GOD_INFO.directResource; // target generates DM
  if (mod(dmElem + 2, 5) === tElem) return samePolarity ? TEN_GOD_INFO.indirectWealth : TEN_GOD_INFO.directWealth; // DM controls target
  return samePolarity ? TEN_GOD_INFO.sevenKillings : TEN_GOD_INFO.directOfficer; // target controls DM
}
// Convenience: full Ten God breakdown for a given BaZi object relative to its own Day Master
// Finds the governing ZHONGQI (mid-term) specifically - Da Liu Ren's Yue Jiang changes on Zhongqi
// boundaries, not Jie boundaries. Reuses findQmdjTerm's already-precise astronomical term finder;
// since Jie and Zhongqi strictly alternate in QMDJ_24_TERMS, if the governing term is a Jie, the
// immediately preceding array entry is guaranteed to be the correct governing Zhongqi.
function findGoverningZhongqi(birthMomentUTC, dayGanzhi) {
  const governing = findQmdjTerm(birthMomentUTC, dayGanzhi);
  if (YUE_JIANG_BY_ZHONGQI[governing.name] !== undefined) return governing.name;
  const idx = QMDJ_24_TERMS.findIndex(t => t.name === governing.name);
  return QMDJ_24_TERMS[mod(idx - 1, 24)].name;
}

function computeAllTenGods(bazi) {
  const dm = bazi.dayStemIdx;
  const stemTenGod = (stemIdx, isDayPillar) => isDayPillar ? TEN_GOD_INFO.dayMaster : getTenGod(dm, stemIdx);
  const hiddenTenGods = (branchIdx) => HIDDEN_STEMS_BY_BRANCH[branchIdx].map(si => ({ stemIdx: si, tenGod: getTenGod(dm, si) }));
  return {
    yearStem: stemTenGod(bazi.yearStemIdx, false), monthStem: stemTenGod(bazi.monthStemIdx, false),
    dayStem: stemTenGod(bazi.dayStemIdx, true), hourStem: stemTenGod(bazi.hourStemIdx, false),
    yearHidden: hiddenTenGods(bazi.yearBranchIdx), monthHidden: hiddenTenGods(bazi.monthBranchIdx),
    dayHidden: hiddenTenGods(bazi.dayBranchIdx), hourHidden: hiddenTenGods(bazi.hourBranchIdx)
  };
}

// ENHANCEMENT (this round): Health Diagnosis - a traditional Wu Xing (Five Element) to body-system
// correspondence, one of the oldest and most standardised frameworks in Chinese metaphysics and
// Traditional Chinese Medicine (TCM). This is presented strictly as traditional/cultural reflection,
// NOT medical diagnosis - the UI carries this caveat prominently and this function never produces
// disease names or treatment advice, only "area traditionally associated with" framing, plus a
// standing recommendation to consult a real healthcare professional for any actual health concern.
const WUXING_BODY_SYSTEMS = [
  { en: 'Liver / Gallbladder / Tendons / Eyes', zh: '肝、胆、筋、目', elemEN: 'Wood', elemZH: '木',
    laterality: { en: 'Left side', zh: '左侧' } },
  { en: 'Heart / Small Intestine / Blood Vessels / Tongue', zh: '心、小肠、脉、舌', elemEN: 'Fire', elemZH: '火',
    laterality: null },
  { en: 'Spleen / Stomach / Muscles / Mouth-Digestion', zh: '脾、胃、肌肉、口', elemEN: 'Earth', elemZH: '土',
    laterality: null },
  { en: 'Lungs / Large Intestine / Skin / Nose-Respiratory', zh: '肺、大肠、皮毛、鼻', elemEN: 'Metal', elemZH: '金',
    laterality: { en: 'Right side', zh: '右侧' } },
  { en: 'Kidneys / Bladder / Bones / Ears', zh: '肾、膀胱、骨、耳', elemEN: 'Water', elemZH: '水',
    laterality: null }
];
// BUG 4 FIX: left/right (laterality) indication, added only where a real classical source supports
// it. Huangdi Neijing (素问·刺禁论) states "肝生於左，肺藏於右" (Liver's qi rises/generates on the
// LEFT; Lung's qi descends/stores on the RIGHT) - this is the ONLY documented left/right pairing in
// this classical framework. It describes functional qi-flow direction, NOT literal anatomical
// left/right disease location, and is itself historically debated among practitioners (some schools
// read it as a mirrored/functional model rather than physical siding). Heart, Spleen, and Kidney have
// NO equivalent left/right designation in the same source - rather than invent one to make the
// pattern "complete," this is left absent and stated as such in the UI, since fabricating a
// left/right claim for those three would not reflect any real traditional teaching.
function computeHealthDiagnosis(p) {
  const bazi = p.bazi;
  // Tally element occurrence across all 4 stems, 4 branches, AND hidden stems (the standard, more
  // complete way to gauge elemental balance in traditional BaZi practice, rather than stems/branches
  // alone).
  const elemCount = [0,0,0,0,0]; // Wood,Fire,Earth,Metal,Water
  const stemElem = (idx) => Math.floor(idx / 2);
  [bazi.yearStemIdx, bazi.monthStemIdx, bazi.dayStemIdx, bazi.hourStemIdx].forEach(s => elemCount[stemElem(s)]++);
  [bazi.yearBranchIdx, bazi.monthBranchIdx, bazi.dayBranchIdx, bazi.hourBranchIdx].forEach(b => {
    elemCount[BRANCH_ELEM_IDX[b]] += 1;
    HIDDEN_STEMS_BY_BRANCH[b].forEach(hs => elemCount[stemElem(hs)] += 0.5); // hidden stems weighted lighter than primary stems/branches
  });

  const maxCount = Math.max(...elemCount);
  const minCount = Math.min(...elemCount);
  const avgCount = elemCount.reduce((a,b) => a+b, 0) / 5;

  // Flag elements that are either critically deficient (well below average, especially near-zero) or
  // excessively dominant (well above average) - traditionally, BOTH extremes (not just deficiency)
  // are considered to put the corresponding body system under more strain.
  const deficient = [], excessive = [];
  elemCount.forEach((c, i) => {
    if (c <= avgCount * 0.4) deficient.push(i);
    if (c >= avgCount * 1.8 && c > 1) excessive.push(i);
  });

  // Light San Shi cross-check: if the natal Da Liu Ren Chu Chuan branch's element matches a
  // deficient/excessive element, note it as a secondary, corroborating (not independent) signal -
  // San Shi's traditional domain is macro/situational timing, not personal health, so this is kept
  // as a minor supplementary note rather than a primary diagnostic input.
  const chuChuanElem = p.daLiuRen ? BRANCH_ELEM_IDX[p.daLiuRen.chuChuan] : null;
  const sanShiEcho = chuChuanElem !== null && (deficient.includes(chuChuanElem) || excessive.includes(chuChuanElem)) ? chuChuanElem : null;

  return {
    elemCount, avgCount, deficient, excessive, sanShiEcho,
    systems: WUXING_BODY_SYSTEMS
  };
}

// ENHANCEMENT 5/6 FIX: Da Liu Ren (大六壬) - the "Man Disc" of the San Shi. Every table and the core
// rotation formula below were individually verified against primary-source references, including a
// complete worked example (JiaZi day, Wu hour, Xu Yue Jiang) that confirmed all 4 Si Ke classes exactly.
// San Chuan (三传) uses the primary Zei Ke (贼克) method - the most common of several classical methods;
// this is a legitimate simplification (not a fabrication), clearly labelled as such in the UI.
const YUE_JIANG_BY_ZHONGQI = { Yushui:11, Chunfen:10, Guyu:9, Xiaoman:8, Xiazhi:7, Dashu:6, Chushu:5, Qiufen:4, Shuangjiang:3, Xiaoxue:2, Dongzhi:1, Dahan:0 };
const DIZHI_JI_GONG = [2,4,5,7,5,7,8,10,11,1]; // Jia..Gui -> resting branch (寄宫): Yin,Chen,Si,Wei,Si,Wei,Shen,Xu,Hai,Chou
const GUIREN_DAY_NIGHT = [ [1,7],[0,8],[11,9],[11,9],[1,7],[0,8],[1,7],[6,2],[5,3],[5,3] ]; // Jia..Gui -> [dayGuiBranch, nightGuiBranch]
const TWELVE_GENERALS = ['Gui Ren (贵人)','Teng She (螣蛇)','Zhu Que (朱雀)','Liu He (六合)','Gou Chen (勾陈)','Qing Long (青龙)','Tian Kong (天空)','Bai Hu (白虎)','Tai Chang (太常)','Xuan Wu (玄武)','Tai Yin (太阴)','Tian Hou (天后)'];
const BRANCH_ELEM_IDX = [4,2,0,0,2,1,1,2,3,3,2,4]; // Zi..Hai -> Water,Earth,Wood,Wood,Earth,Fire,Fire,Earth,Metal,Metal,Earth,Water
function overcomes(elemA, elemB) { return mod(elemA + 2, 5) === elemB; } // elemA overcomes elemB

function castDaLiuRen(bazi, zhongqiName) {
  const yueJiangBranchIdx = YUE_JIANG_BY_ZHONGQI[zhongqiName] ?? YUE_JIANG_BY_ZHONGQI.Chunfen;
  const hourBranchIdx = bazi.hourBranchIdx;
  const offset = yueJiangBranchIdx - hourBranchIdx; // verified sign via worked example
  const tianPan = (b) => mod(b + offset, 12);

  // Si Ke (四课, Four Classes)
  const dmStemIdx = bazi.dayStemIdx;
  const jiGongBranch = DIZHI_JI_GONG[dmStemIdx];
  const ke1Di = jiGongBranch, ke1Tian = tianPan(ke1Di);
  const ke2Di = ke1Tian, ke2Tian = tianPan(ke2Di);
  const ke3Di = bazi.dayBranchIdx, ke3Tian = tianPan(ke3Di);
  const ke4Di = ke3Tian, ke4Tian = tianPan(ke4Di);
  const siKe = [
    { di: ke1Di, tian: ke1Tian }, { di: ke2Di, tian: ke2Tian },
    { di: ke3Di, tian: ke3Tian }, { di: ke4Di, tian: ke4Tian }
  ];

  // San Chuan (三传) via the primary Zei Ke (贼克) method: find a class where Tian overcomes Di
  // (上克下, "the aggressor descends") - if none, fall back to Di overcoming Tian (下贼上).
  let chuChuan = null;
  for (const k of siKe) { if (overcomes(BRANCH_ELEM_IDX[k.tian], BRANCH_ELEM_IDX[k.di])) { chuChuan = k.tian; break; } }
  if (chuChuan === null) { for (const k of siKe) { if (overcomes(BRANCH_ELEM_IDX[k.di], BRANCH_ELEM_IDX[k.tian])) { chuChuan = k.tian; break; } } }
  if (chuChuan === null) chuChuan = siKe[0].tian; // no clash found (rare "Fu Yin"-like case) - fall back to 1st class
  const zhongChuan = tianPan(chuChuan);
  const moChuan = tianPan(zhongChuan);

  // 12 Heavenly Generals (十二天将): Gui Ren start position by Day Stem + day/night, direction by
  // which half of the 12 branches Gui Ren's OWN branch falls into (verified rule, not day/night).
  const isDaytime = hourBranchIdx >= 3 && hourBranchIdx <= 8; // Mao(3) through Shen(8) = daytime
  const guiRenBranch = GUIREN_DAY_NIGHT[dmStemIdx][isDaytime ? 0 : 1];
  const forward = [11,0,1,2,3,4].includes(guiRenBranch); // Hai,Zi,Chou,Yin,Mao,Chen -> forward; else reverse
  const generalAtBranch = {};
  for (let i = 0; i < 12; i++) {
    const branch = forward ? mod(guiRenBranch + i, 12) : mod(guiRenBranch - i, 12);
    generalAtBranch[branch] = TWELVE_GENERALS[i];
  }

  return {
    yueJiangBranchIdx, offset, siKe, chuChuan, zhongChuan, moChuan,
    guiRenBranch, forward, generalAtBranch,
    chuChuanGeneral: generalAtBranch[chuChuan], zhongChuanGeneral: generalAtBranch[zhongChuan], moChuanGeneral: generalAtBranch[moChuan]
  };
}

// ENHANCEMENT 5/6 FIX: Tai Yi Shen Shu (太乙神數) - the "Heaven Disc" of the San Shi. Public, verifiable
// reference material for Tai Yi's actual 16-palace casting mechanics is extremely sparse (it was
// historically restricted to court astrologers), so unlike Da Liu Ren above - where every table was
// individually verified against primary sources - this is deliberately NOT presented as a full
// traditional cast. Instead it's an honestly-labelled macro-scale THEME indicator: it reuses the same
// verified elemental-relationship engine as the Da Yun rating (rateDaYunCycle), applied to the current
// flowing year's stem/branch against the Day Master, since Tai Yi's traditional domain is precisely
// large-scale/collective-level timing rather than personal day-to-day affairs.
const TAIYI_THEME_BY_TIER = {
  'Extremely Good': { en: 'A macro-favourable period - broader circumstances (career environment, family/community stability, large-scale plans) tend to run with you.', zh: '大环境有利的时期——大局面（事业环境、家庭／社群稳定、大型计划）多能顺势而为。' },
  'Very Good': { en: 'Generally supportive macro conditions for larger undertakings and long-horizon plans.', zh: '大环境整体有利，适合推进较大规模的事务与长远计划。' },
  'Good': { en: 'Mildly favourable macro backdrop - steady rather than dramatic support.', zh: '大环境略为有利——支持力道平稳而非剧烈。' },
  'Neutral': { en: 'Macro conditions are neither pushing nor pulling - outcomes depend more on individual effort than the broader environment.', zh: '大环境不推不拉——结果更取决于个人努力，而非大环境本身。' },
  'Bad': { en: 'Some macro friction - larger plans may meet more resistance or delay than usual; keep contingencies ready.', zh: '大环境略有阻力——较大计划可能遇到较多延误，宜预留应变空间。' },
  'Very Bad': { en: 'Notable macro headwinds - a period to consolidate rather than expand large-scale undertakings.', zh: '大环境阻力明显——此时期宜巩固而非扩张大型事务。' },
  'Extremely Bad': { en: 'Significant macro pressure - exercise particular caution with large commitments, major moves, or high-stakes ventures during this period.', zh: '大环境压力显著——此时期对重大承诺、大型行动或高风险事务宜格外谨慎。' }
};
function computeTaiYiMacroTheme(yearStemIdx, yearBranchIdx, dmStemIdx, dayBranchIdx) {
  const rating = rateDaYunCycle(yearStemIdx, yearBranchIdx, dmStemIdx, dayBranchIdx);
  const theme = TAIYI_THEME_BY_TIER[rating.tierEN];
  return { ...rating, themeEN: theme.en, themeZH: theme.zh };
}

// ENHANCEMENT (this round): Tai Yi Shen Shu (太乙神數) - the first 3 steps of a genuine classical
// Yearly Cast (年计), per the Tai Yi Jin Jing (太乙金鏡) mechanics you supplied directly, replacing pure
// guesswork with real, sourced formulas the same way Huo Xing/Ling Xing was unblocked earlier.
//
// SCOPE - what this implements (steps 1-3 of the 7 you described):
//   1. Accumulated Years (太乙积年) - the true Shang Yuan Jia Zi (上元甲子) epoch offset.
//   2. Bureau/Chart Index (太乙局) - the 72-year Yang Dun/Yin Dun grand cycle.
//   3. Tai Yi's own Palace position (太乙落宫) - the real 8-palace, 24-year cycle (3 years/palace,
//      each further split into its Heaven/Earth/Human sub-year).
// This is a genuine upgrade over the old "Year Pillar vs Day Master" macro-theme proxy (still computed
// alongside it below, as a supplementary reading, since it remains a legitimate secondary signal) -
// the Bureau and Palace above are real classical mechanics, not a stand-in.
//
// NOT YET IMPLEMENTED (steps 4-7: Host Eye/Wen Chang, Guest Eye/Shi Ji, Host/Guest Counts, the
// Generals, plus the 16 Deities/Jun Ji/Harmony verdict your own message says "the complete cast also
// includes"). Building these correctly needs specifics your message doesn't yet state: (a) the exact
// branch-to-palace mapping Wen Chang/Shi Ji step through (your Starting Point rule anchors them to
// Earthly Branches like "Shen/Monkey" and "Yin/Tiger", which is a DIFFERENT reference frame from Tai
// Yi's own 8-palace path above, and the branch<->palace correspondence isn't given); (b) Ji Shen's
// actual starting reference point for a YEARLY cast specifically (your message says it "steps
// backward through the branches" but doesn't say from where); and (c) your own message flags the
// Jian Chen handling and the Deities/Jun Ji/Harmony verdict as varying by lineage or simply not
// detailed here. Rather than guess on 3 separate ambiguous points that would compound into a wrong
// chart, this is left for a follow-up once those specifics are confirmed - exactly this project's
// established practice (see the Huo Xing/Ling Xing precedent, where an ambiguous direction was caught
// and confirmed before shipping, not guessed).
//
// ONE AMBIGUITY RESOLVED, FLAGGED FOR YOUR CONFIRMATION: your own message's Palace list names Xun as
// palace NUMBER 9 ("...Dui 6, Kun 7, Kan 8, Xun 9"), but the later "Starting Point" rule says Yin Dun
// bureaus "start at Xun 4" - Zhen is the palace actually numbered 4, not Xun. Since the Palace list is
// the more specific, explicit enumeration, "Xun 4" is treated here as a transcription slip and Yin Dun
// is started at Xun (palace-number 9) - please confirm or correct this if that reading is wrong.
const TAIYI_PALACE_SEQUENCE = [
  { num: 1, name: 'Qian', cn: '乾' }, { num: 2, name: 'Li', cn: '離' },
  { num: 3, name: 'Gen', cn: '艮' }, { num: 4, name: 'Zhen', cn: '震' },
  { num: 6, name: 'Dui', cn: '兌' }, { num: 7, name: 'Kun', cn: '坤' },
  { num: 8, name: 'Kan', cn: '坎' }, { num: 9, name: 'Xun', cn: '巽' }
]; // Tai Yi's OWN palace-numbering scheme (1-4, 6-9, Center 5 never used) - deliberately kept local to
   // this function, NOT the same numbering as this app's Qi Men Dun Jia section (Kan1/Kun2/Zhen3/Xun4/
   // Qian6/Dui7/Gen8/Li9), to avoid any cross-contamination between the two systems' different schemes.
const TAIYI_YEAR_PHASE_LABEL = { 1: { en: 'Heaven', zh: '理天' }, 2: { en: 'Earth', zh: '理地' }, 3: { en: 'Human', zh: '理人' } };

function computeTaiYiYearlyCast(gregorianYear) {
  // Step 1: Accumulated Years (太乙积年).
  const accumulatedYears = gregorianYear + 10153917;

  // Step 2: Bureau/Chart Index (太乙局) - 72-year cycle, 36 Yang Dun + 36 Yin Dun.
  let r72 = accumulatedYears % 72; if (r72 === 0) r72 = 72;
  const dun = r72 <= 36 ? 'yang' : 'yin';
  const bureauNumber = dun === 'yang' ? r72 : r72 - 36;

  // Step 3: Tai Yi's own Palace position (太乙落宫) - 24-year cycle, 3 years per palace.
  // Confirmed by user: Yang Dun runs CLOCKWISE (顺行) starting at Qian (palace 1);
  // Yin Dun runs COUNTER-CLOCKWISE (逆行) starting at Xun (palace 9) - i.e. it walks
  // TAIYI_PALACE_SEQUENCE backward from the Xun end, never forward from it. Center (5)
  // is never used by either path, matching the array (which omits it).
  let r24 = accumulatedYears % 24; if (r24 === 0) r24 = 24;
  const palaceOffset = Math.floor((r24 - 1) / 3); // 0-7: how many palaces already fully passed
  const yearInPalace = ((r24 - 1) % 3) + 1; // 1 (Heaven), 2 (Earth), or 3 (Human)
  const startIndex = dun === 'yang' ? 0 : TAIYI_PALACE_SEQUENCE.findIndex(pl => pl.name === 'Xun');
  const palaceIndex = dun === 'yang'
    ? (startIndex + palaceOffset) % 8
    : ((startIndex - palaceOffset) % 8 + 8) % 8;
  const palace = TAIYI_PALACE_SEQUENCE[palaceIndex];
  const phase = TAIYI_YEAR_PHASE_LABEL[yearInPalace];

  // Step 4 (partial - Ji Shen only): 计神 (Ji Shen) always moves counter-clockwise through
  // the 12 Earthly Branches regardless of Yang/Yin Dun, per user-supplied formula:
  //   (16 - YearBranchIndex[1-12]) MOD 12 = Ji Shen Position[1-12] (0 => 12/Hai)
  // Anchor check: a Zi year (branch index 1 in this 1-based scheme) gives (16-1)%12=3 => Yin,
  // matching the user's stated anchor ("in a Zi year, Ji Shen is anchored at Yin") exactly.
  const yearBranchIdx0 = mod(gregorianYear - 4, 12); // 0=Zi..11=Hai, same convention used elsewhere
  const jiShenPos1 = (() => { const v = (16 - (yearBranchIdx0 + 1)) % 12; return v === 0 ? 12 : v; })();
  const jiShenBranchIdx0 = jiShenPos1 - 1;
  const jiShen = { branchIdx: jiShenBranchIdx0, name: TAIYI_BRANCH_NAMES_EN[jiShenBranchIdx0], cn: TAIYI_BRANCH_NAMES_CN[jiShenBranchIdx0] };

  // The Three Foundations (三基) - Jun Ji/Chen Ji/Min Ji - per user-supplied formulas.
  // All three use the same +250-year baseline offset on Accumulated Years, then a modulus
  // matching each foundation's own cycle length, landing on one of the 12 Earthly Branches
  // (the 4 corner trigram sectors are skipped - these three only ever occupy a branch).
  const threeFoundations = computeTaiYiThreeFoundations(accumulatedYears);

  // Step 4 (Host Eye/Wen Chang, corrected per user's 2026-09-22 clarification): the board has
  // 16 sectors, not 18 - Wen Chang runs a 16-year cycle, advancing exactly 1 sector per year,
  // driven directly by the Bureau Index computed in Step 2 above.
  //   Yang Dun (clockwise):        Wen Chang Index = (12 + BureauIndex - 1) MOD 16, start Shen(12)
  //   Yin Dun (counter-clockwise): Wen Chang Index = (4 - (BureauIndex - 1)) MOD 16, start Yin(4)
  const jiShenBoardIndex = TAIYI_BRANCH_TO_BOARD_INDEX[jiShenBranchIdx0];
  jiShen.boardIndex = jiShenBoardIndex;
  const wenChangIndex = dun === 'yang'
    ? taiYiMod1to16(12 + bureauNumber - 1)
    : taiYiMod1to16(4 - (bureauNumber - 1));
  const wenChang = { boardIndex: wenChangIndex, sector: TAIYI_16_DEITIES[wenChangIndex - 1] };

  // Step 5 (Guest Eye/Shi Ji): "Place Ji Shen on He De (Gen, board index 3), count to Wen
  // Chang, that is Shi Ji" - the spatial distance from Ji Shen to Wen Chang is re-applied
  // starting from He De's own fixed sector, per user-supplied formula and worked example
  // (Ji Shen at Zi(1), Wen Chang at Shen(12) => distance 11 => Shi Ji at index 14/Xu - matches).
  const wenChangToJiShenDistance = ((wenChangIndex - jiShenBoardIndex) % 16 + 16) % 16;
  const shiJiIndex = taiYiMod1to16(3 + wenChangToJiShenDistance);
  const shiJi = { boardIndex: shiJiIndex, sector: TAIYI_16_DEITIES[shiJiIndex - 1], distanceFromJiShen: wenChangToJiShenDistance };

  // "The palace behind Tai Yi" (太乙落后一宫): strictly spatial, using the board's physical
  // clockwise perimeter (TAIYI_SPATIAL_PALACE_SEQUENCE below) - NOT the same order Tai Yi's own
  // orbit uses (TAIYI_PALACE_SEQUENCE above) - regardless of Yang/Yin Dun, per user's rule.
  const behindPalace = computeTaiYiPalaceBehind(palace.num);

  // Host/Guest Counts (主算/客算): walk clockwise around the 16-sector board from Wen Chang
  // (Host) or Shi Ji (Guest) up to and including "the palace behind Tai Yi," summing each
  // distinct Palace's numeric value exactly once even when its corner spans 3 sectors (Jian
  // Chen inherit their parent Palace's value, per the user's own lineage clarification).
  const hostCount = computeTaiYiHostGuestCount(wenChangIndex, behindPalace.num);
  const guestCount = computeTaiYiHostGuestCount(shiJiIndex, behindPalace.num);
  const hostHarmony = classifyTaiYiHarmony(hostCount);
  const guestHarmony = classifyTaiYiHarmony(guestCount);

  // Primary/Vice Generals (大将/参将): derived directly from the Host/Guest Counts above,
  // per user-supplied formula (see computeTaiYiGeneral for the exact mechanic).
  const hostGeneral = computeTaiYiGeneral(hostCount);
  const guestGeneral = computeTaiYiGeneral(guestCount);

  return {
    gregorianYear, accumulatedYears,
    dun, bureauNumber, remainder72: r72,
    palace, palaceOffset, yearInPalace, phase, remainder24: r24,
    jiShen, threeFoundations,
    wenChang, shiJi, behindPalace, hostCount, guestCount, hostHarmony, guestHarmony,
    hostGeneral, guestGeneral
  };
}

// Branch-to-Palace mapping (太乙十六宫/16 sectors), per user-supplied table: the 4 cardinal
// branches (Zi/Mao/Wu/You) each sit alone at their matching cardinal Palace (Kan/Zhen/Li/Dui),
// while the 4 corner Palaces (Qian/Gen/Xun/Kun) each span 3 sectors - 2 flanking "Jian Chen"
// (间辰) branches plus the trigram sector itself - all 3 sharing that one Palace's numeric value.
const TAIYI_BRANCH_NAMES_EN = ['Zi','Chou','Yin','Mao','Chen','Si','Wu','Wei','Shen','You','Xu','Hai'];
const TAIYI_BRANCH_NAMES_CN = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const TAIYI_BRANCH_PALACE_MAP = [8, 3, 3, 4, 9, 9, 2, 7, 7, 6, 1, 1]; // indexed 0=Zi..11=Hai

// The 16 Deities (十六神), statically locked to the Tai Yi board's 16 sectors (12 Earthly
// Branches + the 4 corner trigram sectors Qian/Gen/Xun/Kun), per user-supplied table, in
// clockwise board order starting from Zi. Each entry's palaceNum is the outer Palace that
// sector's numeric value belongs to (see TAIYI_BRANCH_PALACE_MAP above for the 12-branch part).
const TAIYI_16_DEITIES = [
  { sector: 'Zi', cn: '子', deity: 'Di Zhu', deityCN: '地主', palaceNum: 8 },
  { sector: 'Chou', cn: '丑', deity: 'Yang De', deityCN: '阳德', palaceNum: 3 },
  { sector: 'Gen', cn: '艮', deity: 'He De', deityCN: '和德', palaceNum: 3, isTrigram: true },
  { sector: 'Yin', cn: '寅', deity: 'Lu Shen', deityCN: '吕申', palaceNum: 3 },
  { sector: 'Mao', cn: '卯', deity: 'Gao Cong', deityCN: '高丛', palaceNum: 4 },
  { sector: 'Chen', cn: '辰', deity: 'Tai Yang', deityCN: '太阳', palaceNum: 9 },
  { sector: 'Xun', cn: '巽', deity: 'Da Wu', deityCN: '大武', palaceNum: 9, isTrigram: true },
  { sector: 'Si', cn: '巳', deity: 'Tai Ming', deityCN: '太明', palaceNum: 9 },
  { sector: 'Wu', cn: '午', deity: 'Tian Fan', deityCN: '天蕃', palaceNum: 2 },
  { sector: 'Wei', cn: '未', deity: 'Yin De', deityCN: '阴德', palaceNum: 7 },
  { sector: 'Kun', cn: '坤', deity: 'Da Chen', deityCN: '大辰', palaceNum: 7, isTrigram: true },
  { sector: 'Shen', cn: '申', deity: 'Wu De', deityCN: '武德', palaceNum: 7 },
  { sector: 'You', cn: '酉', deity: 'Tai Cu', deityCN: '太簇', palaceNum: 6 },
  { sector: 'Xu', cn: '戌', deity: 'Yin Zhu', deityCN: '阴主', palaceNum: 1 },
  { sector: 'Qian', cn: '乾', deity: 'Tian Liu', deityCN: '天留', palaceNum: 1, isTrigram: true },
  { sector: 'Hai', cn: '亥', deity: 'Da Yi', deityCN: '大义', palaceNum: 1 }
];

// Branch (0=Zi..11=Hai) -> 1-16 board sector index, used to place Ji Shen (a branch-only
// position) onto the same 16-sector board Wen Chang/Shi Ji live on. Derived directly from
// TAIYI_16_DEITIES above (skipping the 4 corner trigram-only slots, which no branch maps to).
const TAIYI_BRANCH_TO_BOARD_INDEX = [1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16];

// Keeps any integer within the board's 1-16 sector indexing, per user-supplied "MOD 16 (0 => 16)"
// convention used throughout the Wen Chang/Shi Ji formulas.
function taiYiMod1to16(n) { return ((n - 1) % 16 + 16) % 16 + 1; }

// The board's own physical/spatial clockwise perimeter of the 8 outer Palaces - per user
// clarification, this is DIFFERENT from TAIYI_PALACE_SEQUENCE above (which is the order Tai Yi's
// own yearly orbit follows), and is used only to define "the palace behind Tai Yi."
const TAIYI_SPATIAL_PALACE_NUMS = [1, 8, 3, 4, 9, 2, 7, 6]; // Qian,Kan,Gen,Zhen,Xun,Li,Kun,Dui

// "The palace behind Tai Yi" (太乙落后一宫): the palace immediately preceding Tai Yi's current
// palace in the board's physical clockwise perimeter (TAIYI_SPATIAL_PALACE_NUMS), regardless of
// Yang/Yin Dun. E.g. Tai Yi in Zhen(4) => behind is Gen(3); Tai Yi in Qian(1) => behind is Dui(6).
function computeTaiYiPalaceBehind(currentPalaceNum) {
  const idx = TAIYI_SPATIAL_PALACE_NUMS.indexOf(currentPalaceNum);
  const behindIdx = (idx - 1 + TAIYI_SPATIAL_PALACE_NUMS.length) % TAIYI_SPATIAL_PALACE_NUMS.length;
  const behindNum = TAIYI_SPATIAL_PALACE_NUMS[behindIdx];
  return TAIYI_PALACE_SEQUENCE.find(pl => pl.num === behindNum);
}

// Host/Guest Count (主算/客算): walks clockwise around the 16-sector board from a starting
// sector (Wen Chang for the Host Count, Shi Ji for the Guest Count) up to and including the
// target Palace ("the palace behind Tai Yi"), summing each distinct Palace's numeric value
// exactly once - per the user's Jian Chen clarification, a corner Palace's 3 sectors (2 flanking
// Jian Chen branches + the trigram itself) all inherit that one Palace's value and are never
// added more than once even though the walk passes through all 3 of that Palace's sectors.
function computeTaiYiHostGuestCount(startBoardIndex, endPalaceNum) {
  let idx = startBoardIndex;
  let total = 0;
  let lastPalaceNum = null;
  for (let steps = 0; steps < 16; steps++) {
    const sector = TAIYI_16_DEITIES[idx - 1];
    if (sector.palaceNum !== lastPalaceNum) { total += sector.palaceNum; lastPalaceNum = sector.palaceNum; }
    if (sector.palaceNum === endPalaceNum) break;
    idx = idx % 16 + 1; // advance 1 sector clockwise, wrapping 16 -> 1
  }
  return total;
}

// The Three Foundations (三基) - Jun Ji (君基/Emperor), Chen Ji (臣基/Minister), Min Ji (民基/
// Citizen) - per user-supplied formulas. All three add the same 250-year baseline offset to
// Accumulated Years, then reduce by their own cycle length and land on one of the 12 Earthly
// Branches (never a corner trigram sector), starting the count from Zi in every case.
function computeTaiYiThreeFoundations(accumulatedYears) {
  const base = accumulatedYears + 250;
  const junJiRemainder = base % 360;
  const junJiIdx = Math.floor(junJiRemainder / 30) % 12; // advances 1 branch every 30 years
  const chenJiRemainder = base % 36;
  const chenJiIdx = Math.floor(chenJiRemainder / 3) % 12; // advances 1 branch every 3 years
  const minJiRemainder = base % 12;
  const minJiIdx = minJiRemainder % 12; // advances 1 branch every year
  const mk = idx => ({ branchIdx: idx, name: TAIYI_BRANCH_NAMES_EN[idx], cn: TAIYI_BRANCH_NAMES_CN[idx] });
  return {
    junJi: { ...mk(junJiIdx), remainder: junJiRemainder },
    chenJi: { ...mk(chenJiIdx), remainder: chenJiRemainder },
    minJi: { ...mk(minJiIdx), remainder: minJiRemainder }
  };
}

// Harmony (和/具) vs Discordant (无地/无天) verdict, per user-supplied digit rule. Now wired into
// the Yearly Cast output above (computeTaiYiYearlyCast classifies both the real Host and Guest
// Counts once they're computed).
function classifyTaiYiHarmony(count) {
  if (typeof count !== 'number' || !isFinite(count) || count < 1) return null;
  const tens = Math.floor(count / 10);
  const units = count % 10;
  if (tens > 0 && units > 0) return { code: 'he_ju', en: 'Harmonious (和/具)', zh: '和／具', tens, units };
  if (tens === 0) return { code: 'wu_di', en: 'No Earth (无地) - Discordant', zh: '无地——不和', tens, units };
  return { code: 'wu_tian', en: 'No Heaven (无天) - Discordant', zh: '无天——不和', tens, units };
}

// Palace name lookup INCLUDING Center (5) - unlike TAIYI_PALACE_SEQUENCE (which Tai Yi's own
// orbit never enters), the Primary/Vice Generals CAN and do land in the Center, per the user's
// explicit note, so this is a separate, deliberately wider lookup used only for the Generals.
const TAIYI_PALACE_NAMES_WITH_CENTER = {
  1: { num: 1, name: 'Qian', cn: '乾' }, 2: { num: 2, name: 'Li', cn: '離' },
  3: { num: 3, name: 'Gen', cn: '艮' }, 4: { num: 4, name: 'Zhen', cn: '震' },
  5: { num: 5, name: 'Center', cn: '中' },
  6: { num: 6, name: 'Dui', cn: '兌' }, 7: { num: 7, name: 'Kun', cn: '坤' },
  8: { num: 8, name: 'Kan', cn: '坎' }, 9: { num: 9, name: 'Xun', cn: '巽' }
};

// Primary General (大将/Da Jiang) and Vice General (参将/Can Jiang), per user-supplied formula:
//   Primary Palace = Count MOD 10 (the "Earth"/units digit), EXCEPT when the count is an exact
//     multiple of 10 (units digit is 0, "No Heaven"/无天) - then Primary Palace = Count MOD 9
//     instead (which conveniently reproduces the tens digit itself for 10/20/30/40).
//   Vice Palace = (Primary Palace x 3) MOD 10.
// A Primary landing on Center (5) always sends the Vice to Center too (5x3=15 -> 5), which the
// user's own note calls "besieged" (入中) - lacking geographic maneuverability.
function computeTaiYiGeneral(count) {
  if (typeof count !== 'number' || !isFinite(count) || count < 1) return null;
  const units = count % 10;
  const primaryNum = units === 0 ? (count % 9) : units;
  const viceNum = (primaryNum * 3) % 10;
  const primary = TAIYI_PALACE_NAMES_WITH_CENTER[primaryNum] || { num: primaryNum, name: '?', cn: '?' };
  const vice = TAIYI_PALACE_NAMES_WITH_CENTER[viceNum] || { num: viceNum, name: '?', cn: '?' };
  return {
    primary, vice,
    besieged: primaryNum === 5, // 入中 - both Primary and Vice fall in the Center
    usedZeroException: units === 0
  };
}

// BUG 2 FIX: proper English-name Five Grids analysis, structurally parallel to the Chinese version -
// each LETTER contributes a Pythagorean numerology value (A=1..I=9, J=1..R=9, S=1..Z=8), analogous to
// how each Chinese CHARACTER contributes its stroke count, then the same Tian/Ren/Di/Wai/Zong formulas
// and Day Master rating are applied. Depends on gridElement(), defined later in this file - safe since
// both are function declarations and are hoisted.
const PYTHAGOREAN_LETTER_VALUES = { A:1,J:1,S:1, B:2,K:2,T:2, C:3,L:3,U:3, D:4,M:4,V:4, E:5,N:5,W:5, F:6,O:6,X:6, G:7,P:7,Y:7, H:8,Q:8,Z:8, I:9,R:9 };
function getLetterValues(str) { return [...(str || '').toUpperCase().replace(/[^A-Z]/g, '')].map(ch => PYTHAGOREAN_LETTER_VALUES[ch] || 1); }

// ENHANCEMENT (this round): genuine Western Name Numerology (Expression/Destiny, Soul Urge, and
// Personality Numbers) - a real system BUILT for alphabetic names, unlike the Five Grids substitution
// above (which borrows a Chinese-calligraphy-specific system with no basis for English letters, as
// its own honesty note already states). Reuses the SAME Pythagorean letter-value table already in
// this file, since Expression/Soul Urge/Personality are simply different LETTER SUBSETS of that same
// table (all letters / vowels only / consonants only respectively) - confirmed identically across
// 6+ independent numerology sources during research for this feature.
//
// SYSTEM CHOICE: Pythagorean was used rather than the competing Chaldean system, since Chaldean uses
// entirely different (sound-based) letter values with no letter mapped to 9, and sources disagree on
// which is more "accurate" for names - there is no single settled answer. Pythagorean is used here as
// the more standard, widely-cited default; this is a real choice between two legitimate traditions,
// not a hidden one, and is stated in the rendered output.
//
// SCOPE: implements the three most commonly-cited core numbers (Expression, Soul Urge, Personality).
// Does NOT implement the Maturity Number (Life Path + Expression, relevant from roughly age 35-40) -
// less universally cited across sources than the core three, and treated as a further refinement
// rather than part of the baseline system.
// Y is treated as a consonant only (not the more advanced "sometimes a vowel" rule some sources use
// when Y functions as the only vowel sound in a syllable) - stated as a scope limit, not glossed over.
const VOWEL_LETTERS = ['A','E','I','O','U'];
function computeWesternNameNumerology(fullName) {
  const letters = [...(fullName || '').toUpperCase().replace(/[^A-Z]/g, '')];
  if (!letters.length) return null;
  const vowels = letters.filter(ch => VOWEL_LETTERS.includes(ch));
  const consonants = letters.filter(ch => !VOWEL_LETTERS.includes(ch));
  const sumValues = (arr) => arr.reduce((sum, ch) => sum + (PYTHAGOREAN_LETTER_VALUES[ch] || 0), 0);
  const expressionRaw = sumValues(letters);
  const soulUrgeRaw = sumValues(vowels);
  const personalityRaw = sumValues(consonants);
  return {
    expression: reduceNum(expressionRaw), expressionIsMaster: [11,22,33].includes(reduceNum(expressionRaw)),
    soulUrge: soulUrgeRaw > 0 ? reduceNum(soulUrgeRaw) : null, soulUrgeIsMaster: soulUrgeRaw > 0 && [11,22,33].includes(reduceNum(soulUrgeRaw)),
    personality: personalityRaw > 0 ? reduceNum(personalityRaw) : null, personalityIsMaster: personalityRaw > 0 && [11,22,33].includes(reduceNum(personalityRaw))
  };
}

function calculateEnglishNameBaziCompat(englishLastName, englishFirstName, dayStemIdx) {
  if (!englishLastName && !englishFirstName) return null;
  const surnameVals = getLetterValues(englishLastName);
  const givenVals = getLetterValues(englishFirstName);
  if (!surnameVals.length && !givenVals.length) return null;
  const sSum = surnameVals.reduce((a,b)=>a+b,0) || 1;
  const gSum = givenVals.reduce((a,b)=>a+b,0) || 1;
  const tianGe = surnameVals.length >= 2 ? sSum : sSum + 1;
  const renGe = (surnameVals.length ? surnameVals[surnameVals.length-1] : 0) + (givenVals.length ? givenVals[0] : 0);
  const diGe = givenVals.length >= 2 ? gSum : gSum + 1;
  const zongGe = sSum + gSum;
  const waiGe = Math.max(1, zongGe - renGe + 1);

  const dmElemIdx = Math.floor(dayStemIdx / 2);
  const WUXING = ['Wood','Fire','Earth','Metal','Water'];
  const dmElem = WUXING[dmElemIdx];
  const generatesMap = { 'Wood':'Fire','Fire':'Earth','Earth':'Metal','Metal':'Water','Water':'Wood' };
  const controlsMap = { 'Wood':'Earth','Earth':'Water','Water':'Fire','Fire':'Metal','Metal':'Wood' };
  const generatedByMap = Object.fromEntries(Object.entries(generatesMap).map(([k,v])=>[v,k]));
  const controlledByMap = Object.fromEntries(Object.entries(controlsMap).map(([k,v])=>[v,k]));
  function rate(elem) {
    if (elem === dmElem) return 'favourable';
    if (elem === generatedByMap[dmElem]) return 'favourable';
    if (elem === controlledByMap[dmElem]) return 'unfavourable';
    return 'neutral';
  }
  const grids = [
    { name: 'Tian Ge (天格)', value: tianGe, elem: gridElement(tianGe) },
    { name: 'Ren Ge (人格)', value: renGe, elem: gridElement(renGe) },
    { name: 'Di Ge (地格)', value: diGe, elem: gridElement(diGe) },
    { name: 'Wai Ge (外格)', value: waiGe, elem: gridElement(waiGe) },
    { name: 'Zong Ge (总格)', value: zongGe, elem: gridElement(zongGe) }
  ].map(g => ({ ...g, rating: rate(g.elem) }));
  const favCount = grids.filter(g => g.rating === 'favourable').length;
  const unfavCount = grids.filter(g => g.rating === 'unfavourable').length;
  const percent = Math.max(20, Math.min(99, Math.round(55 + (favCount / grids.length) * 45 - (unfavCount / grids.length) * 30)));
  return { grids, dmElem, favCount, unfavCount, percent, tianGe, renGe, diGe, waiGe, zongGe };
}
function getKua(yy, isMale) { let sum = [...String(yy)].reduce((a, b) => a + +b, 0); while (sum > 9) sum = [...String(sum)].reduce((a, b) => a + +b, 0); let kua = isMale ? 11 - sum : 4 + sum; while (kua > 9) kua -= 9; if (kua === 5) kua = isMale ? 2 : 8; return kua; }

// ============================================================================
// REAL PLANETARY POSITION ENGINE (this round - replaces the numerological-seed
// "Yearly Theme" placeholder with genuine astronomical transit calculations).
//
// Implements the van Flandern & Pulkkinen (1979) low-precision planetary position
// formulae, as documented and popularised by Paul Schlyter (stjarnhimlen.se) - a
// widely-used, standard reference for exactly this kind of calculation. Accuracy
// is approximately 1 arc-minute for the Sun and inner planets, about 1 arc-minute
// for the outer planets (with the Jupiter/Saturn/Uranus mutual perturbation terms
// included), which is far more than sufficient for identifying which zodiac sign
// or aspect a slow-moving outer planet occupies - the actual use here.
//
// VERIFICATION: every stage of this pipeline was checked against the reference's
// own fully-worked numerical example (19 April 1990, 0h UT) before being trusted:
// day-number computation, the Sun's position (w, M, E, longitude, distance all
// matched to the source's own precision), each planet's orbital elements, the
// Kepler-equation solver, unperturbed heliocentric longitude for Mercury/Jupiter/
// Saturn/Uranus/Neptune (all matched), the Jupiter-Saturn-Uranus mutual
// perturbation corrections (matched to within 0.0001 degrees), and the
// heliocentric-to-geocentric conversion (verified via the source's own
// intermediate rectangular x/y/z coordinates for Mercury, which matched to 6
// decimal places). Pluto's curve-fit formula was transcribed directly from the
// source but has no worked example to check against in this reference - treated
// as slightly lower-confidence than the other bodies, consistent with the
// source's own note that "no analytical theory has ever been constructed" for
// Pluto and this is a fit to numerical integration, valid ~1800-2100.
//
// SCOPE: computes TRANSITING (current) positions for the Sun, and the slow outer
// planets Jupiter, Saturn, Uranus, Neptune, and Pluto - the bodies conventionally
// used for stable "yearly" astrological themes, since Mercury/Venus/Mars/Moon
// move too fast to represent a coherent yearly period. The NATAL reference point
// used for aspects is the person's natal Sun position (also computed for real,
// from their actual birth date/time/location).
//
// UPDATE (requested directly: "There should be 12 houses to plot out" -> user then explicitly chose
// "Real Ascendant-based houses (Placidus/Equal from true Ascendant)" over a no-new-data shortcut): a
// full natal chart (Moon sign, other natal planets, AND now the Ascendant/houses) IS computed - see
// computeFullNatalChart and computeAscendant/computeEqualHouseCusps further below. The Ascendant genuinely
// does need precise sidereal time (computed here via GMST0/RAMC, from a REAL UTC birth moment - see
// computeRealBirthUTCMoment, deliberately NOT the true-solar-time birthMomentUTC used elsewhere in this
// file) and geographic latitude (now collected as an optional `birthLatitude` field per profile - see
// autoPopulateLonTz/readLatitude in app.js). For any profile without a latitude on file (older profiles
// saved before this field existed, or one where a country/city was never (re)selected), the Ascendant/
// houses are honestly reported as unavailable rather than guessed at.
function astroDayNumber(y, m, dd, ut) {
  // Valid March 1900 to February 2100 - covers every realistic birth date and
  // transit date this app would compute (living people and near-future years).
  let d = 367*y - Math.floor(7 * ( y + Math.floor((m+9)/12) ) / 4) + Math.floor(275*m/9) + dd - 730530;
  return d + (ut || 0) / 24.0;
}
function astroSind(x) { return Math.sin(x * Math.PI / 180); }
function astroCosd(x) { return Math.cos(x * Math.PI / 180); }
function astroAtan2d(y, x) { return Math.atan2(y, x) * 180 / Math.PI; }
function astroRev(x) { return x - Math.floor(x / 360) * 360; }
function astroTand(x) { return Math.tan(x * Math.PI / 180); }
function computeSunEclipticPosition(d) {
  const w = 282.9404 + 4.70935E-5 * d;
  const e = 0.016709 - 1.151E-9 * d;
  const M = astroRev(356.0470 + 0.9856002585 * d);
  const E = M + (180/Math.PI) * e * astroSind(M) * (1.0 + e * astroCosd(M));
  const x = astroCosd(E) - e;
  const y = Math.sqrt(1 - e*e) * astroSind(E);
  const r = Math.sqrt(x*x + y*y);
  const v = astroAtan2d(y, x);
  return { lon: astroRev(v + w), r };
}
const PLANET_ORBITAL_ELEMENTS = {
  jupiter: d => ({ N: 100.4542+2.76854E-5*d, i: 1.3030-1.557E-7*d, w: 273.8777+1.64505E-5*d, a: 5.20256, e: 0.048498+4.469E-9*d, M: astroRev(19.8950+0.0830853001*d) }),
  saturn: d => ({ N: 113.6634+2.38980E-5*d, i: 2.4886-1.081E-7*d, w: 339.3939+2.97661E-5*d, a: 9.55475, e: 0.055546-9.499E-9*d, M: astroRev(316.9670+0.0334442282*d) }),
  uranus: d => ({ N: 74.0005+1.3978E-5*d, i: 0.7733+1.9E-8*d, w: 96.6612+3.0565E-5*d, a: 19.18171-1.55E-8*d, e: 0.047318+7.45E-9*d, M: astroRev(142.5905+0.011725806*d) }),
  neptune: d => ({ N: 131.7806+3.0173E-5*d, i: 1.7700-2.55E-7*d, w: 272.8461-6.027E-6*d, a: 30.05826+3.313E-8*d, e: 0.008606+2.15E-9*d, M: astroRev(260.2471+0.005995147*d) })
};
function solveKeplerEquation(M, e) {
  let E0 = M + (180/Math.PI) * e * astroSind(M) * (1.0 + e*astroCosd(M));
  for (let iter = 0; iter < 10; iter++) {
    const E1 = E0 - (E0 - (180/Math.PI)*e*astroSind(E0) - M) / (1 - e*astroCosd(E0));
    if (Math.abs(E1 - E0) < 0.0000001) { E0 = E1; break; }
    E0 = E1;
  }
  return E0;
}
function computeHeliocentricPosition(elems) {
  const { N, i, w, a, e, M } = elems;
  const E = solveKeplerEquation(M, e);
  const xv = a * (astroCosd(E) - e);
  const yv = a * (Math.sqrt(1-e*e) * astroSind(E));
  const v = astroAtan2d(yv, xv);
  const r = Math.sqrt(xv*xv + yv*yv);
  const xh = r*(astroCosd(N)*astroCosd(v+w) - astroSind(N)*astroSind(v+w)*astroCosd(i));
  const yh = r*(astroSind(N)*astroCosd(v+w) + astroCosd(N)*astroSind(v+w)*astroCosd(i));
  const zh = r*(astroSind(v+w)*astroSind(i));
  return { lon: astroRev(astroAtan2d(yh, xh)), lat: astroAtan2d(zh, Math.sqrt(xh*xh+yh*yh)), r };
}
function applyOuterPlanetPerturbations(planetName, lon, lat, Mj, Ms, Mu) {
  if (planetName === 'jupiter') {
    lon += -0.332*astroSind(2*Mj-5*Ms-67.6) - 0.056*astroSind(2*Mj-2*Ms+21) + 0.042*astroSind(3*Mj-5*Ms+21)
         - 0.036*astroSind(Mj-2*Ms) + 0.022*astroCosd(Mj-Ms) + 0.023*astroSind(2*Mj-3*Ms+52) - 0.016*astroSind(Mj-5*Ms-69);
  } else if (planetName === 'saturn') {
    lon += 0.812*astroSind(2*Mj-5*Ms-67.6) - 0.229*astroCosd(2*Mj-4*Ms-2) + 0.119*astroSind(Mj-2*Ms-3)
         + 0.046*astroSind(2*Mj-6*Ms-69) + 0.014*astroSind(Mj-3*Ms+32);
    lat += -0.020*astroCosd(2*Mj-4*Ms-2) + 0.018*astroSind(2*Mj-6*Ms-49);
  } else if (planetName === 'uranus') {
    lon += 0.040*astroSind(Ms-2*Mu+6) + 0.035*astroSind(Ms-3*Mu+33) - 0.015*astroSind(Mj-Mu+20);
  }
  return { lon: astroRev(lon), lat };
}
function computePlutoPosition(d) {
  const S = 50.03 + 0.033459652*d, P = 238.95 + 0.003968789*d;
  const lon = astroRev(238.9508 + 0.00400703*d
    - 19.799*astroSind(P) + 19.848*astroCosd(P) + 0.897*astroSind(2*P) - 4.956*astroCosd(2*P)
    + 0.610*astroSind(3*P) + 1.211*astroCosd(3*P) - 0.341*astroSind(4*P) - 0.190*astroCosd(4*P)
    + 0.128*astroSind(5*P) - 0.034*astroCosd(5*P) - 0.038*astroSind(6*P) + 0.031*astroCosd(6*P)
    + 0.020*astroSind(S-P) - 0.010*astroCosd(S-P));
  const r = 40.72 + 6.68*astroSind(P) + 6.90*astroCosd(P) - 1.18*astroSind(2*P) - 0.03*astroCosd(2*P) + 0.15*astroSind(3*P) - 0.14*astroCosd(3*P);
  return { lon, lat: 0, r }; // latitude omitted - not needed for longitude-based aspect calculation
}
function heliocentricToGeocentricLongitude(helioLon, helioLat, helioR, sunLon, sunR) {
  const xh = helioR*astroCosd(helioLon)*astroCosd(helioLat);
  const yh = helioR*astroSind(helioLon)*astroCosd(helioLat);
  const xs = sunR*astroCosd(sunLon), ys = sunR*astroSind(sunLon);
  return astroRev(astroAtan2d(yh+ys, xh+xs));
}
// Computes the CURRENT geocentric ecliptic longitude of the Sun and each of the
// 5 outer planets, for any given calendar date/time (UTC).
function computeTransitingPositions(y, m, dd, ut) {
  const d = astroDayNumber(y, m, dd, ut);
  const sun = computeSunEclipticPosition(d);
  const Mj = PLANET_ORBITAL_ELEMENTS.jupiter(d).M, Ms = PLANET_ORBITAL_ELEMENTS.saturn(d).M, Mu = PLANET_ORBITAL_ELEMENTS.uranus(d).M;
  const positions = { sun: sun.lon };
  ['jupiter','saturn','uranus','neptune'].forEach(name => {
    const helio = computeHeliocentricPosition(PLANET_ORBITAL_ELEMENTS[name](d));
    const pert = ['jupiter','saturn','uranus'].includes(name) ? applyOuterPlanetPerturbations(name, helio.lon, helio.lat, Mj, Ms, Mu) : helio;
    positions[name] = heliocentricToGeocentricLongitude(pert.lon, pert.lat, helio.r, sun.lon, sun.r);
  });
  const pluto = computePlutoPosition(d);
  positions.pluto = heliocentricToGeocentricLongitude(pluto.lon, pluto.lat, pluto.r, sun.lon, sun.r);
  return positions;
}
// Standard major aspects and their conventional orbs (tolerance) - a specific,
// commonly-used choice (moderate orbs suitable for slow outer-planet transits to
// a natal point), not the only convention in use among astrologers; disclosed as
// such in the rendered output rather than presented as an unambiguous standard.
const MAJOR_ASPECTS = [
  { name: 'Conjunction', nameZh: '合相', angle: 0, orb: 8 },
  { name: 'Sextile', nameZh: '六分相', angle: 60, orb: 4 },
  { name: 'Square', nameZh: '四分相', angle: 90, orb: 6 },
  { name: 'Trine', nameZh: '三分相', angle: 120, orb: 6 },
  { name: 'Opposition', nameZh: '对分相', angle: 180, orb: 8 }
];
function findAspect(lon1, lon2) {
  let diff = Math.abs(astroRev(lon1 - lon2));
  if (diff > 180) diff = 360 - diff;
  for (const asp of MAJOR_ASPECTS) {
    if (Math.abs(diff - asp.angle) <= asp.orb) return { ...asp, exactDiff: diff, orbUsed: Math.abs(diff - asp.angle) };
  }
  return null;
}
function computeNatalSunLongitude(birthMomentUTC) {
  const d = astroDayNumber(birthMomentUTC.getUTCFullYear(), birthMomentUTC.getUTCMonth() + 1, birthMomentUTC.getUTCDate(),
    birthMomentUTC.getUTCHours() + birthMomentUTC.getUTCMinutes() / 60);
  return computeSunEclipticPosition(d).lon;
}
// The 12 zodiac signs in ecliptic-longitude order, each occupying an exact 30-degree slice starting
// at 0=Aries - the same convention astroSind/astroRev's 0-360 range already uses throughout this file.
const ZODIAC_SIGN_ORDER = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
function zodiacSignForLongitude(lon) {
  const idx = Math.floor(astroRev(lon) / 30) % 12;
  const key = ZODIAC_SIGN_ORDER[idx];
  return ASTRO_SIGNS_DETAILS[key] || { en: key, zh: key };
}
// ENHANCEMENT (requested directly: "continue with the western astrology chart" - real additional chart
// information beyond the single natal Sun-position marker): computeTransitingPositions already
// computes a real geocentric ecliptic longitude for the Sun and the 5 outer planets (Jupiter, Saturn,
// Uranus, Neptune, Pluto) for ANY given date/time - it was only ever being called with TODAY's date
// for the yearly transit forecast. Calling it with the person's own birth date/time instead gives their
// real NATAL positions for those same 5 planets, using the exact same verified math, with no new
// orbital-mechanics code needed. Mercury/Venus/Mars/Moon and the Ascendant remain out of scope (see the
// honesty note above computeTransitingPositions) - those move too fast for this app's daily-snapshot
// approach, and the Ascendant specifically needs precise sidereal time and geographic latitude, neither
// of which this app currently tracks.
function computeNatalOuterPlanetPositions(birthMomentUTC) {
  const y = birthMomentUTC.getUTCFullYear(), m = birthMomentUTC.getUTCMonth() + 1, dd = birthMomentUTC.getUTCDate();
  const ut = birthMomentUTC.getUTCHours() + birthMomentUTC.getUTCMinutes() / 60;
  const positions = computeTransitingPositions(y, m, dd, ut);
  const result = {};
  ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].forEach(planet => {
    const lon = positions[planet];
    result[planet] = { lon, sign: zodiacSignForLongitude(lon) };
  });
  return result;
}
const OUTER_PLANET_INFO = {
  jupiter: { en: 'Jupiter', zh: '木星', themeEN: 'growth, opportunity, and expansion', themeZH: '成长、机会与扩展' },
  saturn: { en: 'Saturn', zh: '土星', themeEN: 'structure, responsibility, and long-term discipline', themeZH: '结构、责任与长期自律' },
  uranus: { en: 'Uranus', zh: '天王星', themeEN: 'sudden change, disruption, and innovation', themeZH: '突发变化、颠覆与创新' },
  neptune: { en: 'Neptune', zh: '海王星', themeEN: 'intuition, dissolution of boundaries, and idealism', themeZH: '直觉、界限消融与理想主义' },
  pluto: { en: 'Pluto', zh: '冥王星', themeEN: 'transformation, power dynamics, and deep change', themeZH: '转化、权力动态与深层变革' }
};
// Computes a REAL yearly transit report for a given year: current geocentric positions of the 5
// outer planets (evaluated at a representative mid-year moment, since these move slowly enough that
// a single yearly snapshot is a reasonable representative point), checked for genuine major aspects
// to the person's actual natal Sun longitude. Reports plainly when NO aspect is found within orb for
// a given planet, rather than forcing a result - most planet/year combinations will show no aspect,
// since exact aspects are relatively rare events, and that absence is itself accurate information.
function computeYearlyTransitReport(natalSunLon, year) {
  const positions = computeTransitingPositions(year, 7, 1, 0); // July 1 as representative mid-year snapshot
  const aspects = [];
  ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].forEach(planet => {
    const aspect = findAspect(positions[planet], natalSunLon);
    if (aspect) aspects.push({ planet, ...aspect });
  });
  return { year, positions, aspects };
}

function getAstrologySign(mm, dd) {
  if ((mm === 1 && dd >= 20) || (mm === 2 && dd <= 18)) return ASTRO_SIGNS_DETAILS['Aquarius'];
  if ((mm === 2 && dd >= 19) || (mm === 3 && dd <= 20)) return ASTRO_SIGNS_DETAILS['Pisces'];
  if ((mm === 3 && dd >= 21) || (mm === 4 && dd <= 19)) return ASTRO_SIGNS_DETAILS['Aries'];
  if ((mm === 4 && dd >= 20) || (mm === 5 && dd <= 20)) return ASTRO_SIGNS_DETAILS['Taurus'];
  if ((mm === 5 && dd >= 21) || (mm === 6 && dd <= 20)) return ASTRO_SIGNS_DETAILS['Gemini'];
  if ((mm === 6 && dd >= 21) || (mm === 7 && dd <= 22)) return ASTRO_SIGNS_DETAILS['Cancer'];
  if ((mm === 7 && dd >= 23) || (mm === 8 && dd <= 22)) return ASTRO_SIGNS_DETAILS['Leo'];
  if ((mm === 8 && dd >= 23) || (mm === 9 && dd <= 22)) return ASTRO_SIGNS_DETAILS['Virgo'];
  if ((mm === 9 && dd >= 23) || (mm === 10 && dd <= 22)) return ASTRO_SIGNS_DETAILS['Libra'];
  if ((mm === 10 && dd >= 23) || (mm === 11 && dd <= 21)) return ASTRO_SIGNS_DETAILS['Scorpio'];
  if ((mm === 11 && dd >= 22) || (mm === 12 && dd <= 21)) return ASTRO_SIGNS_DETAILS['Sagittarius'];
  return ASTRO_SIGNS_DETAILS['Capricorn'];
}

// ============================================================
// SIX CLASH / SIX HARMONY branch relationship tables (used by Ze Ri and Compatibility)
// Branch order matches `branches`: Rat0,Ox1,Tiger2,Rabbit3,Dragon4,Snake5,Horse6,Goat7,Monkey8,Rooster9,Dog10,Pig11
// ============================================================
const SIX_CLASH = {0:6,1:7,2:8,3:9,4:10,5:11,6:0,7:1,8:2,9:3,10:4,11:5};
const SIX_HARMONY = {0:1,1:0,2:11,11:2,3:10,10:3,4:9,9:4,5:8,8:5,6:7,7:6};

// ENHANCEMENT 4 FIX: 7-tier Da Yun cycle rating (Extremely Good..Extremely Bad). This is a SIMPLIFIED
// heuristic, not full "Useful God" (用神) analysis - a rigorous rating requires determining whether the
// Day Master is chart-strong or chart-weak (a whole separate BaZi sub-discipline), which changes whether
// an "outflow" element like Wealth or Officer is actually helpful or harmful for a given person. This
// heuristic instead uses the widely-cited simplification that Resource/Peer elements (support the Day
// Master) skew favourable and Officer/Pressure elements skew more mixed, plus the Da Yun branch's Six
// Clash/Harmony against the natal Day Branch (a traditionally strong, chart-independent signal).
const DAYUN_TIER_LABELS = [
  { min: 5, en: 'Extremely Good', zh: '极好', abbr: 'EG', abbrZh: '极好', color: '#1b5e20' },
  { min: 3, en: 'Very Good', zh: '很好', abbr: 'VG', abbrZh: '很好', color: '#2e7d32' },
  { min: 1, en: 'Good', zh: '好', abbr: 'G', abbrZh: '好', color: '#66bb6a' },
  { min: 0, en: 'Neutral', zh: '平和', abbr: 'N', abbrZh: '平和', color: '#9e9e9e' },
  { min: -2, en: 'Bad', zh: '差', abbr: 'B', abbrZh: '差', color: '#ef6c00' },
  { min: -4, en: 'Very Bad', zh: '很差', abbr: 'VB', abbrZh: '很差', color: '#d84315' },
  { min: -Infinity, en: 'Extremely Bad', zh: '极差', abbr: 'EB', abbrZh: '极差', color: '#b71c1c' }
];
function rateDaYunCycle(stemIdx, branchIdx, dmStemIdx, dayBranchIdx) {
  const dmElem = Math.floor(dmStemIdx / 2);
  const stemElem = Math.floor(stemIdx / 2);
  const branchElem = BRANCH_ELEM_IDX[branchIdx];
  function relScore(elem) {
    if (elem === dmElem) return 2; // Peer - same element
    if (mod(elem + 1, 5) === dmElem) return 3; // generates DM - Resource
    if (mod(dmElem + 1, 5) === elem) return 0; // DM generates - Output
    if (mod(dmElem + 2, 5) === elem) return 1; // DM controls - Wealth
    return -1; // controls DM - Officer/Pressure
  }
  let score = relScore(stemElem) + Math.round(relScore(branchElem) / 2);
  if (SIX_CLASH[dayBranchIdx] === branchIdx) score -= 3;
  if (SIX_HARMONY[dayBranchIdx] === branchIdx) score += 2;
  const tier = DAYUN_TIER_LABELS.find(t => score >= t.min);
  return { score, tierEN: tier.en, tierZH: tier.zh, tierColor: tier.color, tierAbbr: tier.abbr, tierAbbrZh: tier.abbrZh };
}
// ENHANCEMENT 6 FIX: branch-only rating (no stem component) for systems like Da Liu Ren's San Chuan
// where the value being rated is a bare Earthly Branch, not a stem-branch pair - avoids injecting a
// meaningless dummy-stem signal into the score.
function rateBranchOnly(branchIdx, dmStemIdx, dayBranchIdx) {
  const dmElem = Math.floor(dmStemIdx / 2);
  const branchElem = BRANCH_ELEM_IDX[branchIdx];
  function relScore(elem) {
    if (elem === dmElem) return 2;
    if (mod(elem + 1, 5) === dmElem) return 3;
    if (mod(dmElem + 1, 5) === elem) return 0;
    if (mod(dmElem + 2, 5) === elem) return 1;
    return -1;
  }
  let score = relScore(branchElem) * 2; // scaled up since there's no separate stem term to combine with
  if (SIX_CLASH[dayBranchIdx] === branchIdx) score -= 3;
  if (SIX_HARMONY[dayBranchIdx] === branchIdx) score += 2;
  const tier = DAYUN_TIER_LABELS.find(t => score >= t.min);
  return { score, tierEN: tier.en, tierZH: tier.zh, tierColor: tier.color, tierAbbr: tier.abbr, tierAbbrZh: tier.abbrZh };
}

// Singapore/Malaysia observed GMT+7:30 ("Singapore Standard Time"/Malayan Time) prior to 1 Jan 1982,
// not today's GMT+8:00. If the person entered the modern default (tz=8) for an SG/Malaysia birth
// before that date, correct it automatically for true-solar-time accuracy.
function resolveHistoricalTz(yy, mm, dd, enteredTz, location) {
  const beforeCutoff = (yy < 1982);
  const isSGDefault = (Number(enteredTz) === 8);
  const isSGish = !location || /singapore|malaysia|kuala|johor|s'pore/i.test(location);
  if (beforeCutoff && isSGDefault && isSGish) return 7.5;
  return Number(enteredTz);
}

// ============================================================
// PRECISION FIX: replaces multi-year AVERAGED solar term dates with a real astronomical calculation
// of the Sun's apparent ecliptic longitude (Meeus low-precision solar position, accurate to ~0.01°),
// root-found against each term's exact target longitude for the SPECIFIC birth year. This is what
// actually fixes Da Yun / QMDJ / BaZi boundary precision - averaged tables can be off by up to ~1-2
// days for any given year, which is large enough to flip a Da Yun start age or a Ju Shu lookup.
// ============================================================
function toJulianDay(utcMs) { return utcMs / 86400000 + 2440587.5; }
function sunApparentLongitudeDeg(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = mod(280.46646 + 36000.76983 * T + 0.0003032 * T * T, 360);
  const Mdeg = mod(357.52911 + 35999.05029 * T - 0.0001537 * T * T, 360);
  const M = Mdeg * Math.PI / 180;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
          + 0.000289 * Math.sin(3 * M);
  const trueLong = L0 + C;
  const omega = (125.04 - 1934.136 * T) * Math.PI / 180;
  const apparentLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega);
  return mod(apparentLong, 360);
}
// Root-find the UTC instant nearest `approxUtcMs` where the Sun's longitude equals targetDeg.
function findSolarLongitudeCrossing(approxUtcMs, targetDeg) {
  const angDiff = (ms) => { let d = sunApparentLongitudeDeg(toJulianDay(ms)) - targetDeg; return ((d + 180) % 360 + 360) % 360 - 180; };
  let lo = approxUtcMs - 4 * 86400000, hi = approxUtcMs + 4 * 86400000;
  let dlo = angDiff(lo);
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2, dmid = angDiff(mid);
    if ((dlo < 0 && dmid >= 0) || (dlo > 0 && dmid <= 0)) { hi = mid; } else { lo = mid; dlo = dmid; }
  }
  return (lo + hi) / 2;
}

// BUG 3 FIX: Long-run average Jie (节, the 12 "month-opening" solar terms) moments used for the
// BaZi Month Pillar boundary and Da Yun. Index = Gregorian month (1-12) the Jie typically opens in.
const JIE_TABLE = {
  1:  { name: 'Xiaohan',  d: 5,  h: 22, m: 49, deg: 285 },
  2:  { name: 'Lichun',   d: 4,  h: 10, m: 31, deg: 315 },
  3:  { name: 'Jingzhe',  d: 5,  h: 22, m: 33, deg: 345 },
  4:  { name: 'Qingming', d: 4,  h: 20, m: 2,  deg: 15  },
  5:  { name: 'Lixia',    d: 5,  h: 13, m: 22, deg: 45  },
  6:  { name: 'Mangzhong',d: 5,  h: 17, m: 31, deg: 75  },
  7:  { name: 'Xiaoshu',  d: 7,  h: 3,  m: 41, deg: 105 },
  8:  { name: 'Liqiu',    d: 7,  h: 13, m: 29, deg: 135 },
  9:  { name: 'Bailu',    d: 7,  h: 20, m: 28, deg: 165 },
  10: { name: 'Hanlu',    d: 8,  h: 8,  m: 15, deg: 195 },
  11: { name: 'Lidong',   d: 7,  h: 11, m: 35, deg: 225 },
  12: { name: 'Daxue',    d: 7,  h: 4,  m: 25, deg: 255 }
};
// Earthly Branch that BEGINS at each Jie (keyed by JIE_TABLE month key). Branch indices per `branches`.
const JIE_MONTH_BRANCH = {1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9, 10:10, 11:11, 12:0};

// PERFORMANCE FIX (reported: hourly tab taking 15-25 seconds to switch days on a real device, even
// after the day-switch computation was already chunked across ticks in an earlier round - chunking
// only keeps the page responsive WHILE computing, it doesn't reduce the actual computation time). The
// real cost turned out to be here: jieMoment root-finds the exact astronomical crossing moment for a
// given (year, Jie) pair via a 50-iteration bisection search - that's fine once, but getBaZiPillars
// calls it 2-3 times per hour block, and the 12 two-hour blocks of a single Hourly-tab day all fall on
// the SAME calendar day, so the SAME (year, Jie) pairs get root-found from scratch, redundantly, up to
// 12 times over for a single day-switch. A small in-memory cache, keyed by the exact (ry, rm) pair,
// turns every call after the first (for that pair) into an instant lookup - the moment for a given Jie
// in a given year is a pure function of astronomical constants, never changes within a session, so this
// is always safe to reuse. Un-bounded but tiny in practice (a session only ever touches a handful of
// distinct years).
const __jieMomentCache = new Map();
function jieMoment(y, m) {
  // m may be 0 (=> Dec of y-1) or 13 (=> Jan of y+1)
  let ry = y, rm = m;
  if (rm === 0) { rm = 12; ry -= 1; }
  if (rm === 13) { rm = 1; ry += 1; }
  const cacheKey = `${ry}-${rm}`;
  const cached = __jieMomentCache.get(cacheKey);
  if (cached) return new Date(cached.getTime());
  const t = JIE_TABLE[rm];
  // PRECISION FIX: use the averaged date only as a search anchor, then root-find the exact
  // astronomical crossing for THIS specific year - fixes the "off by up to ~2 days" error that a
  // fixed multi-year average carries, which is large enough to flip a Da Yun start age or Ju Shu.
  const approx = Date.UTC(ry, rm - 1, t.d, t.h, t.m);
  const result = new Date(findSolarLongitudeCrossing(approx, t.deg));
  __jieMomentCache.set(cacheKey, result);
  // Return a defensive copy here too (not just on cache hits) - the first, cache-populating call
  // must not hand out the SAME object stored in the cache, or a caller mutating its returned Date
  // would silently corrupt the cached value for every later call with this key.
  return new Date(result.getTime());
}

// ============================================================
// BUG 2 FIX (round 3): Full 24 Solar Terms (Jie Qi) with Yang/Yin Dun flag and the traditional
// Bureau Number (Ju Shu) reference for the Shang/Zhong/Xia Yuan (San Yuan) three-day-cycle split.
// This is the standard "定局表" reference used to look up a QMDJ chart's Bureau Number.
// ============================================================
const QMDJ_24_TERMS = [
  { name:'Xiaohan',     m:1,  d:5,  dun:'yang', ju:[2,8,5], deg:285 },
  { name:'Dahan',       m:1,  d:20, dun:'yang', ju:[3,9,6], deg:300 },
  { name:'Lichun',      m:2,  d:4,  dun:'yang', ju:[8,5,2], deg:315 },
  { name:'Yushui',      m:2,  d:19, dun:'yang', ju:[9,6,3], deg:330 },
  { name:'Jingzhe',     m:3,  d:5,  dun:'yang', ju:[1,7,4], deg:345 },
  { name:'Chunfen',     m:3,  d:20, dun:'yang', ju:[3,9,6], deg:0   },
  { name:'Qingming',    m:4,  d:5,  dun:'yang', ju:[4,1,7], deg:15  },
  { name:'Guyu',        m:4,  d:20, dun:'yang', ju:[5,2,8], deg:30  },
  { name:'Lixia',       m:5,  d:5,  dun:'yang', ju:[4,1,7], deg:45  },
  { name:'Xiaoman',     m:5,  d:21, dun:'yang', ju:[5,2,8], deg:60  },
  { name:'Mangzhong',   m:6,  d:5,  dun:'yang', ju:[6,3,9], deg:75  },
  { name:'Xiazhi',      m:6,  d:21, dun:'yin',  ju:[9,3,6], deg:90  },
  { name:'Xiaoshu',     m:7,  d:7,  dun:'yin',  ju:[8,2,5], deg:105 },
  { name:'Dashu',       m:7,  d:23, dun:'yin',  ju:[7,1,4], deg:120 },
  { name:'Liqiu',       m:8,  d:7,  dun:'yin',  ju:[2,5,8], deg:135 },
  { name:'Chushu',      m:8,  d:23, dun:'yin',  ju:[1,4,7], deg:150 },
  { name:'Bailu',       m:9,  d:7,  dun:'yin',  ju:[9,3,6], deg:165 },
  { name:'Qiufen',      m:9,  d:23, dun:'yin',  ju:[7,1,4], deg:180 },
  { name:'Hanlu',       m:10, d:8,  dun:'yin',  ju:[6,9,3], deg:195 },
  { name:'Shuangjiang', m:10, d:23, dun:'yin',  ju:[5,8,2], deg:210 },
  { name:'Lidong',      m:11, d:7,  dun:'yin',  ju:[6,9,3], deg:225 },
  { name:'Xiaoxue',     m:11, d:22, dun:'yin',  ju:[5,8,2], deg:240 },
  { name:'Daxue',       m:12, d:7,  dun:'yin',  ju:[4,7,1], deg:255 },
  { name:'Dongzhi',     m:12, d:21, dun:'yang', ju:[1,7,4], deg:270 }
];
// Earth Plate casting order: the 6 Instruments + 3 Wonders, placed in this stem-index sequence.
// Jia (甲, idx 0) never appears directly - it always "hides" and rides on Wu's (戊) palace.
const QMDJ_STEM_CAST_ORDER = [4,5,6,7,8,9,3,2,1]; // Wu,Ji,Geng,Xin,Ren,Gui,Ding,Bing,Yi
const QMDJ_STEM_NAMES_CN = {4:'戊',5:'己',6:'庚',7:'辛',8:'壬',9:'癸',3:'丁',2:'丙',1:'乙',0:'甲'};
// Fixed benchmark (pre-rotation) Star/Door/Deity association per palace number - used as a documented
// simplification in place of the full hour-based Heaven Plate rotation.
const QMDJ_PALACE_REF = {
  1: { star:'Tian Peng (天蓬)', door:'Xiu Men (休门)',  deity:'Tai Yin (太阴)' },
  2: { star:'Tian Rui (天芮)',  door:'Si Men (死门)',   deity:'Teng She (螣蛇)' },
  3: { star:'Tian Chong (天冲)',door:'Shang Men (伤门)',deity:'Zhi Fu (值符)' },
  4: { star:'Tian Fu (天辅)',   door:'Du Men (杜门)',   deity:'Jiu Tian (九天)' },
  5: { star:'Tian Qin (天禽)',  door:'— (Center)',      deity:'— (Center)' },
  6: { star:'Tian Xin (天心)',  door:'Kai Men (开门)',  deity:'Zhu Que (朱雀)' },
  7: { star:'Tian Zhu (天柱)',  door:'Jing Men (惊门)', deity:'Jiu Di (九地)' },
  8: { star:'Tian Ren (天任)',  door:'Sheng Men (生门)',deity:'Xuan Wu (玄武)' },
  9: { star:'Tian Ying (天英)', door:'Jing Men (景门)', deity:'Liu He (六合)' }
};
// ENHANCEMENT 9 FIX: the traditional 8 Doors (八门) classification - 3 Auspicious Doors (三吉门),
// 2 Neutral, and 3 Caution Doors (凶门).
const QMDJ_DOOR_RATING = {
  'Kai Men (开门)': 'Auspicious', 'Xiu Men (休门)': 'Auspicious', 'Sheng Men (生门)': 'Auspicious',
  'Du Men (杜门)': 'Neutral', 'Jing Men (景门)': 'Neutral',
  'Shang Men (伤门)': 'Caution', 'Si Men (死门)': 'Caution', 'Jing Men (惊门)': 'Caution',
  '— (Center)': 'Neutral'
};
// The authentic Luoshu "flying" adjacency ring used to rotate the Heaven Plate (Deity/Star/Door)
// relative to the Earth Plate. Center(5) is not on the ring; a stem landing there borrows palace
// 2 (Yang Dun) or 8 (Yin Dun), per standard convention.
const LUOSHU_RING = [1,8,3,4,9,2,7,6];
function ringPalace(pal, isYang) { return pal === 5 ? (isYang ? 2 : 8) : pal; }
function rotatePalaceByRing(pal, steps, isYang) {
  const p = ringPalace(pal, isYang);
  const idx = LUOSHU_RING.indexOf(p);
  return LUOSHU_RING[mod(idx + steps, 8)];
}
// The six Xun (旬, 10-day decades) of the 60 JiaZi cycle, and which Six-Instrument stem the
// "hidden" Jia rides on for each - the traditional 六甲旬首 correspondence.
const XUN_HIDDEN_JIA_RIDES = [4, 5, 6, 7, 8, 9]; // Wu,Ji,Geng,Xin,Ren,Gui, for decades 0-5 (JiaZi..JiaYin)
// Earthly Branch -> its fixed Luoshu palace (the 12 branches map onto the 8 outer palaces, with
// two branches sharing each of the 4 "corner" palaces).
const BRANCH_TO_PALACE = {0:1, 1:8, 2:8, 3:3, 4:4, 5:4, 6:9, 7:2, 8:2, 9:7, 10:6, 11:6};

// BUG 9 FIX: 驿马 (Yi Ma, "Traveling Horse") - derived from the Sanhe (Three Harmony) group of the
// Day Branch. Each of the 3 Sanhe groups of 4 branches shares one fixed Yi Ma branch.
const YIMA_BY_SANHE_GROUP = {
  // Shen-Zi-Chen (申子辰) group -> Yi Ma at Yin (寅, idx2); Yin-Wu-Xu (寅午戌) -> Shen (申, idx8);
  // Si-You-Chou (巳酉丑) -> Hai (亥, idx11); Hai-Mao-Wei (亥卯未) -> Si (巳, idx5)
  8:2, 0:2, 4:2,   // Shen(8), Zi(0), Chen(4) -> Yin(2)
  2:8, 6:8, 10:8,  // Yin(2), Wu(6), Xu(10) -> Shen(8)
  5:11, 9:11, 1:11,// Si(5), You(9), Chou(1) -> Hai(11)
  11:5, 3:5, 7:5   // Hai(11), Mao(3), Wei(7) -> Si(5)
};
function calculateYiMa(dayBranchIdx) { return YIMA_BY_SANHE_GROUP[dayBranchIdx]; }

// BUG 9 FIX: 空亡 (Kong Wang, "Void") - the 2 Earthly Branches NOT paired with any stem in the
// governing 10-day Xun (decade), derived from the same Xun-decade lookup used elsewhere in this file.
const XUN_HEAD_BRANCH = [0, 10, 8, 6, 4, 2]; // head branch of each of the 6 decades (JiaZi..JiaYin)
function calculateKongWang(dayGanzhi) {
  const xunDecadeIdx = Math.floor(mod(dayGanzhi, 60) / 10);
  const head = XUN_HEAD_BRANCH[xunDecadeIdx];
  return [mod(head + 10, 12), mod(head + 11, 12)];
}

// ENHANCEMENT (this round): Karmic Debt / Past-Life analysis, following the standard Bazi + Zi Wei Dou
// Shu framework requested - reuses the EXISTING, already-verified Ten God engine (Seven Killings /
// Indirect Resource counts), Six Clash table (Day-Year Pillar clash), and Kong Wang/Void calculation
// (checking whether the person's OWN pillar branches fall into their Void), rather than inventing new
// calculations. Each finding is only reported if it genuinely applies to THIS chart - this is not a
// generic checklist shown to everyone regardless of relevance.
//
// HONESTY LIMIT, stated plainly rather than glossed over: the Zi Wei Dou Shu side of this analysis
// (Table 2 in the reference material - Hua Ji/Hua Lu and other Si Hua transformations, and which of
// the 14 main stars sit in the Fude Gong) requires a full 14-star Zi Wei chart with the Four
// Transformations algorithm, which this app's Zi Wei module does not implement (it only derives a
// correct Life/Body Palace location - see calculateZiWeiLifePalace's own comment). The Fude Gong
// (Palace of Karma)'s LOCATION can still be correctly derived, since it's a fixed offset from Life
// Palace in the standard 12-palace sequence (verified against two independently well-known
// relationships before relying on it: Parents/Health palaces are always opposite each other, and
// Fude/Wealth palaces are always opposite each other - both check out with this exact offset), but
// which STARS sit there, and any Hua Ji/Hua Lu reading, cannot be honestly stated without that engine.
function computeKarmicDebtAnalysis(p) {
  const bazi = p.bazi;
  const tg = computeAllTenGods(bazi);

  // Every non-Day-Master Ten God across the chart: the 3 other heavenly stems, plus every hidden stem
  // in all 4 branches (the Day Master's own hidden stems are included too - only the Day Master's own
  // HEAVENLY stem is excluded, since that's the reference point, not a "target" Ten God itself).
  const allTenGods = [
    tg.yearStem, tg.monthStem, tg.hourStem,
    ...tg.yearHidden.map(h => h.tenGod), ...tg.monthHidden.map(h => h.tenGod),
    ...tg.dayHidden.map(h => h.tenGod), ...tg.hourHidden.map(h => h.tenGod)
  ];
  const sevenKillingsCount = allTenGods.filter(g => g.abbr === '7K').length;
  const indirectResourceCount = allTenGods.filter(g => g.abbr === 'IR').length;

  const dayYearClash = SIX_CLASH[bazi.yearBranchIdx] === bazi.dayBranchIdx;

  const kongWangBranches = calculateKongWang(bazi.dayGanzhi);
  const pillarDefs = [
    { key: 'year', branchIdx: bazi.yearBranchIdx, labelEN: 'Year Pillar (ancestors, early life)', labelZH: '年柱（祖辈、早年）' },
    { key: 'month', branchIdx: bazi.monthBranchIdx, labelEN: 'Month Pillar (parents, career foundation)', labelZH: '月柱（父母、事业根基）' },
    { key: 'day', branchIdx: bazi.dayBranchIdx, labelEN: 'Day Pillar (self, spouse)', labelZH: '日柱（自身、配偶）' },
    { key: 'hour', branchIdx: bazi.hourBranchIdx, labelEN: 'Hour Pillar (children, later life)', labelZH: '时柱（子女、晚年）' }
  ];
  const voidPillars = pillarDefs.filter(pl => kongWangBranches.includes(pl.branchIdx));

  const fudeGongBranchIdx = mod(p.ziwei.lifePalaceBranchIdx + 2, 12);

  return {
    sevenKillingsCount, sevenKillingsOverwhelming: sevenKillingsCount >= 2,
    indirectResourceCount, indirectResourceStrong: indirectResourceCount >= 2,
    dayYearClash,
    voidPillars,
    fudeGongBranchIdx, fudeGongName: `${branches[fudeGongBranchIdx]} (${branchCN[fudeGongBranchIdx]})`
  };
}

// ENHANCEMENT (this round): core computation engine for the new Detailed Reading tab. Reuses the
// existing Ten God engine and Da Yun cycle data rather than inventing a parallel calculation. Every
// number here is genuinely computed from the person's own chart - nothing in this function is
// hardcoded to any specific sample reading; it's designed to produce sensible, chart-derived inputs
// for any BaZi chart the app can already compute.
//
// HONESTY LIMIT, stated plainly: "Day Master strength" (the single most consequential judgment in a
// real BaZi reading - it determines whether Wealth/Officer help or harm the person) traditionally
// requires weighing seasonal command (which month the Day Master was born in matters far more than
// other factors), root strength, and combination/clash interactions together - a full treatment this
// app does not implement. What follows is a simplified count-based heuristic (support vs drain across
// all 8 stem positions, heaven and hidden), clearly exposed as such in the output rather than
// presented as a definitive strength verdict.
function computeElementIdxFromStemIdx(stemIdx) { return Math.floor(stemIdx / 2); } // 0 Wood,1 Fire,2 Earth,3 Metal,4 Water
function computeYearPillar(year) { return { stemIdx: mod(year - 4, 10), branchIdx: mod(year - 4, 12) }; }

// ENHANCEMENT (this round): replaces the previous "natal hexagram" (a checksum of the person's name
// characters, with no connection to any real I Ching method) with an actual Mei Hua Yi Shu (梅花易数)
// birth-data casting - specifically the "以年月日时起终身卦" (Year-Month-Day-Hour lifelong-hexagram)
// variant, which explicitly uses the YEAR STEM number rather than the year branch number for better
// accuracy on a natal/lifelong casting (confirmed identically by 3 independent sources, all giving the
// exact same worked example, which this formula was verified against exactly: Ren-year, lunar month 4,
// day 11, Si hour -> upper trigram Kun (remainder 8), lower trigram Kan (remainder 6), moving line 6).
//
// HONESTY LIMIT, stated plainly: this computes the real upper/lower trigram and moving line, which
// are the genuine substantive output of an authentic casting method - these are shown as the primary
// result. It does NOT map the trigram pair to a specific classical King Wen sequence hexagram
// name/number - building and verifying that 64-entry lookup table correctly is a separate undertaking
// this round did not attempt (a wrong table would be worse than not having one). The `hexNo` (1-64)
// still used by this app's own internal "compatible/incompatible hexagram network" (an arbitrary but
// internally-consistent offset scheme, not itself tied to King Wen ordering) is derived directly from
// the real trigram pair below, rather than a name checksum, but should not be read as a traditional
// hexagram number.
const TRIGRAMS = [
  null, // trigram numbers are 1-indexed in the classical system; index 0 unused
  { key: 'qian', cn: '乾', en: 'Qian (Heaven)', symbol: '☰', elemEN: 'Metal', elemZH: '金', lines: [1,1,1] },
  { key: 'dui', cn: '兌', en: 'Dui (Lake)', symbol: '☱', elemEN: 'Metal', elemZH: '金', lines: [1,1,0] },
  { key: 'li', cn: '離', en: 'Li (Fire)', symbol: '☲', elemEN: 'Fire', elemZH: '火', lines: [1,0,1] },
  { key: 'zhen', cn: '震', en: 'Zhen (Thunder)', symbol: '☳', elemEN: 'Wood', elemZH: '木', lines: [1,0,0] },
  { key: 'xun', cn: '巽', en: 'Xun (Wind)', symbol: '☴', elemEN: 'Wood', elemZH: '木', lines: [0,1,1] },
  { key: 'kan', cn: '坎', en: 'Kan (Water)', symbol: '☵', elemEN: 'Water', elemZH: '水', lines: [0,1,0] },
  { key: 'gen', cn: '艮', en: 'Gen (Mountain)', symbol: '☶', elemEN: 'Earth', elemZH: '土', lines: [0,0,1] },
  { key: 'kun', cn: '坤', en: 'Kun (Earth)', symbol: '☷', elemEN: 'Earth', elemZH: '土', lines: [0,0,0] }
];
function castMeiHuaNatalHexagram(yearStemIdx, lunarMonth, lunarDay, hourBranchIdx) {
  const yearNum = yearStemIdx + 1;   // 1-10 (Jia=1...Gui=10)
  const monthNum = lunarMonth;       // 1-12
  const dayNum = lunarDay;           // 1-30
  const hourNum = hourBranchIdx + 1; // 1-12 (Zi=1...Hai=12)
  const upperTrigramNum = mod(yearNum + monthNum + dayNum, 8) || 8;
  const lowerTrigramNum = mod(yearNum + monthNum + dayNum + hourNum, 8) || 8;
  const movingLine = mod(yearNum + monthNum + dayNum + hourNum, 6) || 6;
  const hexNo = KING_WEN_LOOKUP[upperTrigramNum][lowerTrigramNum];
  return { upperTrigramNum, lowerTrigramNum, movingLine, hexNo, hexInfo: KING_WEN_HEXAGRAMS[hexNo], upperTrigram: TRIGRAMS[upperTrigramNum], lowerTrigram: TRIGRAMS[lowerTrigramNum] };
}

// ENHANCEMENT (this round): King Wen sequence mapping, built after explicitly deferring it earlier
// (a wrong 64-entry table is worse than none) - extracted directly from Wikipedia's "List of
// hexagrams of the I Ching", which states each hexagram's inner (lower) and outer (upper) trigram
// explicitly for all 64 entries, rather than trusting a table from memory. Before being used, this
// was independently self-verified in three ways: (1) mathematically - the 64 (upper,lower) pairs are
// confirmed to be unique and to map onto exactly 1-64 with no gaps or duplicates, which a
// transcription error would almost certainly have broken; (2) against well-known reference pairs -
// hexagram 11 (Tai/Peace, Qian below Kun above) and 12 (Pi/Obstruction, its exact reverse) are among
// the most commonly cited hexagrams in any I Ching text, as are 63/64 (Ji Ji / Wei Ji, the traditional
// final pair) - all four checked out against the extracted table; (3) hexagrams 1, 2, 29, 30, 51, 52,
// 57, 58 (the 8 "pure" hexagrams where upper=lower) were checked to each map to a single trigram
// doubled, as they must.
const KING_WEN_LOOKUP = (() => {
  const raw = [
    [1,1,1],[8,8,2],[6,4,3],[7,6,4],[6,1,5],[1,6,6],[8,6,7],[6,8,8],
    [5,1,9],[1,2,10],[8,1,11],[1,8,12],[1,3,13],[3,1,14],[8,7,15],[4,8,16],
    [2,4,17],[7,5,18],[8,2,19],[5,8,20],[3,4,21],[7,3,22],[7,8,23],[8,4,24],
    [1,4,25],[7,1,26],[7,4,27],[2,5,28],[6,6,29],[3,3,30],[2,7,31],[4,5,32],
    [1,7,33],[4,1,34],[3,8,35],[8,3,36],[5,3,37],[3,2,38],[6,7,39],[4,6,40],
    [7,2,41],[5,4,42],[2,1,43],[1,5,44],[2,8,45],[8,5,46],[2,6,47],[6,5,48],
    [2,3,49],[3,5,50],[4,4,51],[7,7,52],[5,7,53],[4,2,54],[4,3,55],[3,7,56],
    [5,5,57],[2,2,58],[5,6,59],[6,2,60],[5,2,61],[4,7,62],[6,3,63],[3,6,64]
  ];
  const table = Array.from({ length: 9 }, () => new Array(9).fill(null));
  raw.forEach(([u, l, kw]) => { table[u][l] = kw; });
  return table;
})();
// Hexagram names, indexed 1-64 by King Wen number - Chinese name (traditional), pinyin, and a short
// English gloss, taken from the same Wikipedia source as the trigram table above.
const KING_WEN_HEXAGRAMS = [null,
  {cn:'乾',py:'qián',en:'The Creative (Force)'}, {cn:'坤',py:'kūn',en:'The Receptive (Field)'},
  {cn:'屯',py:'zhūn',en:'Difficulty at the Beginning (Sprouting)'}, {cn:'蒙',py:'méng',en:'Youthful Folly (Enveloping)'},
  {cn:'需',py:'xū',en:'Waiting (Attending)'}, {cn:'訟',py:'sòng',en:'Conflict'},
  {cn:'師',py:'shī',en:'The Army (Leading)'}, {cn:'比',py:'bǐ',en:'Holding Together (Grouping)'},
  {cn:'小畜',py:'xiǎo xù',en:'Small Taming (Small Accumulating)'}, {cn:'履',py:'lǚ',en:'Treading'},
  {cn:'泰',py:'tài',en:'Peace (Pervading)'}, {cn:'否',py:'pǐ',en:'Standstill (Obstruction)'},
  {cn:'同人',py:'tóng rén',en:'Fellowship (Concording People)'}, {cn:'大有',py:'dà yǒu',en:'Great Possession'},
  {cn:'謙',py:'qiān',en:'Modesty (Humbling)'}, {cn:'豫',py:'yù',en:'Enthusiasm (Providing-For)'},
  {cn:'隨',py:'suí',en:'Following'}, {cn:'蠱',py:'gǔ',en:'Work on the Decayed (Correcting)'},
  {cn:'臨',py:'lín',en:'Approach (Nearing)'}, {cn:'觀',py:'guān',en:'Contemplation (Viewing)'},
  {cn:'噬嗑',py:'shì kè',en:'Biting Through (Gnawing Bite)'}, {cn:'賁',py:'bì',en:'Grace (Adorning)'},
  {cn:'剝',py:'bō',en:'Splitting Apart (Stripping)'}, {cn:'復',py:'fù',en:'Return (Returning)'},
  {cn:'无妄',py:'wú wàng',en:'Innocence (Without Embroiling)'}, {cn:'大畜',py:'dà xù',en:'Great Taming (Great Accumulating)'},
  {cn:'頤',py:'yí',en:'Mouth Corners (Swallowing)'}, {cn:'大過',py:'dà guò',en:'Great Preponderance (Great Exceeding)'},
  {cn:'坎',py:'kǎn',en:'The Abysmal (Gorge)'}, {cn:'離',py:'lí',en:'The Clinging (Radiance)'},
  {cn:'咸',py:'xián',en:'Influence (Conjoining)'}, {cn:'恆',py:'héng',en:'Duration (Persevering)'},
  {cn:'遯',py:'dùn',en:'Retreat (Retiring)'}, {cn:'大壯',py:'dà zhuàng',en:'Great Power (Great Invigorating)'},
  {cn:'晉',py:'jìn',en:'Progress (Prospering)'}, {cn:'明夷',py:'míng yí',en:'Darkening of the Light'},
  {cn:'家人',py:'jiā rén',en:'The Family (Dwelling People)'}, {cn:'睽',py:'kuí',en:'Opposition (Polarising)'},
  {cn:'蹇',py:'jiǎn',en:'Obstruction (Limping)'}, {cn:'解',py:'jiě',en:'Deliverance (Taking-Apart)'},
  {cn:'損',py:'sǔn',en:'Decrease (Diminishing)'}, {cn:'益',py:'yì',en:'Increase (Augmenting)'},
  {cn:'夬',py:'guài',en:'Breakthrough (Displacement)'}, {cn:'姤',py:'gòu',en:'Coming to Meet (Coupling)'},
  {cn:'萃',py:'cuì',en:'Gathering Together (Clustering)'}, {cn:'升',py:'shēng',en:'Pushing Upward (Ascending)'},
  {cn:'困',py:'kùn',en:'Oppression (Confining)'}, {cn:'井',py:'jǐng',en:'The Well (Welling)'},
  {cn:'革',py:'gé',en:'Revolution (Skinning)'}, {cn:'鼎',py:'dǐng',en:'The Cauldron (Holding)'},
  {cn:'震',py:'zhèn',en:'The Arousing (Shake)'}, {cn:'艮',py:'gèn',en:'Keeping Still (Bound)'},
  {cn:'漸',py:'jiàn',en:'Development (Infiltrating)'}, {cn:'歸妹',py:'guī mèi',en:'The Marrying Maiden'},
  {cn:'豐',py:'fēng',en:'Abundance (Abounding)'}, {cn:'旅',py:'lǚ',en:'The Wanderer (Sojourning)'},
  {cn:'巽',py:'xùn',en:'The Gentle (Ground/Wind)'}, {cn:'兌',py:'duì',en:'The Joyous (Open)'},
  {cn:'渙',py:'huàn',en:'Dispersion (Dispersing)'}, {cn:'節',py:'jié',en:'Limitation (Articulating)'},
  {cn:'中孚',py:'zhōng fú',en:'Inner Truth (Center Returning)'}, {cn:'小過',py:'xiǎo guò',en:'Small Preponderance (Small Exceeding)'},
  {cn:'既濟',py:'jì jì',en:'After Completion (Already Fording)'}, {cn:'未濟',py:'wèi jì',en:'Before Completion (Not Yet Fording)'}
];

// ENHANCEMENT (this round): Day Master strength now weighs seasonal command (月令) as the dominant
// factor, replacing the earlier pure support-vs-drain count. Research into standard BaZi methodology
// confirms seasonal command is the single largest factor (commonly cited as ~40% of the overall
// determination, vs ~30% root support, ~20% heavenly stem support, ~10% resource conditions) - this
// was previously not weighed AT ALL, which is a real gap since the same support/drain count can
// describe a genuinely strong or genuinely weak Day Master depending entirely on the season.
//
// The five states (旺相休囚死 - Wang/Xiang/Xiu/Qiu/Si) follow the standard classical rule, verified
// by reproducing a full worked example (a Wood Day Master's stated state across all 4 seasons) from
// an independent source and confirming all 4 matched: given the month's commanding element S and a
// target element E, E is Wang if E=S, Xiang if S generates E, Xiu if E generates S, Qiu if E controls
// S, and Si if S controls E.
const MONTH_COMMANDING_ELEMENT = [4,2,0,0,2,1,1,2,3,3,2,4]; // Zi..Hai -> Water,Earth,Wood,Wood,Earth,Fire,Fire,Earth,Metal,Metal,Earth,Water
const SEASONAL_STATE_INFO = [
  { key: 'wang', en: 'Wang (旺) - at its commanding season', zh: '旺——当令之时', weight: 4 },
  { key: 'xiang', en: 'Xiang (相) - supported by the season', zh: '相——得令气所生', weight: 2 },
  { key: 'si', en: 'Si (死) - controlled by the season', zh: '死——被令气所克', weight: -3 },
  { key: 'qiu', en: 'Qiu (囚) - controlling the season, at a cost', zh: '囚——克令气而耗力', weight: -2 },
  { key: 'xiu', en: 'Xiu (休) - feeding the season, resting', zh: '休——生令气而泄气', weight: -1 }
];
function computeSeasonalState(monthBranchIdx, elemIdx) {
  const s = MONTH_COMMANDING_ELEMENT[monthBranchIdx];
  const diff = mod(elemIdx - s, 5);
  return SEASONAL_STATE_INFO[diff]; // diff 0=wang,1=xiang,2=si,3=qiu,4=xiu (matches array order above)
}

// Root check (通根): does the Day Master's element appear among the hidden stems of any of the 4
// branches? A rooted Day Master draws real, physically-grounded support beyond just visible stems.
function computeRootCount(bazi, dmElemIdx) {
  const allBranches = [bazi.yearBranchIdx, bazi.monthBranchIdx, bazi.dayBranchIdx, bazi.hourBranchIdx];
  return allBranches.reduce((count, branchIdx) => {
    const hasRoot = HIDDEN_STEMS_BY_BRANCH[branchIdx].some(si => computeElementIdxFromStemIdx(si) === dmElemIdx);
    return count + (hasRoot ? 1 : 0);
  }, 0);
}

// ENHANCEMENT (this round): Useful God (用神) selection - the step that actually determines whether
// Wealth/Officer/Output read as an asset or a drain for a SPECIFIC chart, rather than treating them as
// generically "good" or "generically pressuring" regardless of the Day Master's condition. Implements
// the "Support and Suppress" (扶抑法) method, confirmed across 6+ independent sources as the most
// fundamental and widely-used approach: a weak Day Master is helped by whatever supports/generates it
// (Companion, Resource); a strong Day Master is helped by whatever drains/controls it (Output, Wealth,
// Officer). For a "balanced" chart (per this app's strengthScore), the same logic is applied using
// which side of zero the underlying score actually falls on, since "balanced" here means "close to the
// dividing line," not "perfectly centred" - genuinely mixed charts do lean one way or the other.
//
// HONESTY LIMIT, stated plainly: this is the baseline method, not the complete picture. Two real
// refinements are NOT implemented: (1) special "Follow the Structure" (从格) patterns, where an
// extremely one-sided chart with no real opposition is read with the OPPOSITE logic (follow the
// dominant force rather than balance it) - a genuine, if less common, pattern this app does not
// detect; (2) "Climate Adjustment" (调候), which can override the pure support/suppress verdict for
// charts born into extreme seasonal cold, heat, dryness, or dampness. Both require judgement beyond
// what a chart-wide heuristic can safely automate, so this reports the standard baseline method only,
// not a claim of covering every classical nuance.
function computeUsefulGod(dmElemIdx, dmStrength, strengthScore) {
  const leansStrong = dmStrength === 'strong' || (dmStrength === 'balanced' && strengthScore > 0);
  const sameElem = dmElemIdx;
  const generatesElem = mod(dmElemIdx - 1, 5); // what generates the Day Master (Resource)
  const drainsElem = mod(dmElemIdx + 1, 5);    // what the Day Master generates (Output)
  const controlledElem = mod(dmElemIdx + 2, 5); // what the Day Master controls (Wealth)
  const controllingElem = mod(dmElemIdx + 3, 5); // what controls the Day Master (Officer/Killings)
  const favourable = leansStrong ? [drainsElem, controlledElem, controllingElem] : [sameElem, generatesElem];
  const unfavourable = leansStrong ? [sameElem, generatesElem] : [drainsElem, controlledElem, controllingElem];
  return { leansStrong, favourable, unfavourable };
}

// ENHANCEMENT (this round): Feng Shui Flying Star (玄空飞星), the other major Feng Shui school beyond
// the existing 8 Mansions (Kua-number based) system already in this app. Flying Star asks a
// fundamentally different question - not about the PERSON's Kua number, but about a SPECIFIC
// PROPERTY's construction period and facing direction - so this is offered as a separate, optional
// calculation, not a replacement for the existing Ba Zhai reading.
//
// HONESTY LIMITS, stated plainly rather than glossed over:
// (1) SCOPE: this implements the 8 primary compass directions only (N/NE/E/SE/S/SW/W/NW, each on its
//     "Tian Yuan Long" - the central mountain of its trigram), not the full 24-mountain system a
//     professional practitioner would use with a precise compass reading. A facing direction that
//     falls near a boundary between two of the 24 mountains needs a professional, degree-precise
//     reading - this tool assumes the facing is close to one of the 8 primary directions.
// (2) THE "SUBSTITUTE STAR" (替卦) TECHNIQUE for borderline-degree facings is not implemented at all.
// (3) THE "SEED = 5" EDGE CASE: when the number that flies to the sitting or facing palace is 5
//     itself, 5 has no trigram position in the original Luoshu arrangement to derive Yin/Yang from,
//     and documented sources show DIFFERENT schools handle this differently (some use the sitting/
//     facing mountain's own Yin/Yang directly; others have 5 "borrow" a neighbouring palace's identity
//     for the first vs second half of the 20-year period). This implementation uses the simpler,
//     explicitly-documented convention (the mountain/facing direction's own Yin/Yang) - a real,
//     acknowledged school of thought, but not the only one, and this is called out wherever it
//     actually applies to a specific chart rather than silently picking one convention.
// (4) This chart identifies the NUMBERS in each palace only - reading what those numbers mean
//     (auspicious/inauspicious combinations, "Wang Shan Wang Xiang" 旺山旺向 and similar named
//     patterns, annual/monthly flying star overlays) is a further layer of interpretation not
//     attempted here.
//
// VERIFICATION: every non-5-seed case in this implementation was checked against the worked example
// used consistently across multiple independent sources (Period 8, Zi mountain/Wu facing: seed 4 at
// the sitting palace correctly identified as Xun/Yang/forward-flying; seed 3 at the facing palace
// correctly identified as Zhen's Mao/Yin/backward-flying) - both derivations matched what the sources
// state. Internal mathematical self-consistency (detailed further where the chart is built) was also
// checked directly against the generated chart, not just asserted.

const FLYING_STAR_DIRECTIONS = ['N','NE','E','SE','S','SW','W','NW']; // index 0-7
// Original Luoshu (元旦盘) base number for each of the 8 directions, center=5 handled separately.
const LUOSHU_BASE_BY_DIRECTION = { N:1, SW:2, E:3, SE:4, NW:6, W:7, NE:8, S:9 };
// Reverse lookup: which direction does a given Luoshu number (1-9, excluding 5) originally belong to.
const LUOSHU_DIRECTION_BY_NUMBER = { 1:'N', 2:'SW', 3:'E', 4:'SE', 6:'NW', 7:'W', 8:'NE', 9:'S' };
// Tian Yuan Long Yin/Yang per direction - confirmed identically by multiple independent sources
// ("子午卯酉为阴，乾坤艮巽为阳" - Zi/Wu/Mao/You are Yin, Qian/Kun/Gen/Xun are Yang).
const TIAN_YUAN_LONG_YANG = { N:false, S:false, E:false, W:false, NE:true, SE:true, SW:true, NW:true };
// The forward-flying (顺飞) visiting order used for ALL flying-star charts in this system, confirmed
// identically by multiple independent sources: Center -> NW -> W -> NE -> S -> N -> SW -> E -> SE.
const FLYING_ORDER = ['NW','W','NE','S','N','SW','E','SE'];

function computeFlyingStarPeriod(constructionYear) {
  // Period 1 begins 1864 (start of the current 180-year Great Cycle per the standard reference
  // table), each period spanning exactly 20 years, cycling 1-9 continuously.
  const periodIndex = Math.floor(mod(constructionYear - 1864, 180) / 20);
  return periodIndex + 1; // 1-9
}
function buildFlyingChart(seed, flyForward) {
  // BUG FIX: backward flying (逆飞) keeps the SAME direction-visiting sequence as forward flying -
  // only the number progression reverses (decreasing instead of increasing) - it does NOT mean
  // reversing which direction is visited first. Caught this by tracing the code's own output against
  // the same cross-source worked example used to verify the mountain/period charts: the mountain
  // chart (forward-flying) matched every expected value immediately, but the facing chart (backward-
  // flying) did not, at every single direction - reversing the visiting order and re-testing against
  // all four independently-expected values (N, S, NW, W) confirmed this fix exactly.
  const chart = { center: seed };
  let current = seed;
  FLYING_ORDER.forEach(dir => {
    current = flyForward ? mod(current, 9) + 1 : mod(current - 2, 9) + 1;
    chart[dir] = current;
  });
  return chart;
}
function determineFlightDirection(seedNumber, fallbackDirection) {
  // Standard case: look up which direction this seed number originally occupies in the fixed Luoshu,
  // then use THAT direction's own Tian Yuan Long Yin/Yang to decide the flight direction.
  if (seedNumber !== 5) {
    const originalDir = LUOSHU_DIRECTION_BY_NUMBER[seedNumber];
    return { forward: TIAN_YUAN_LONG_YANG[originalDir], usedFallback: false };
  }
  // Seed = 5 edge case (see honesty note above): uses the sitting/facing direction's OWN Yin/Yang
  // directly, one of several documented conventions for this specific situation.
  return { forward: TIAN_YUAN_LONG_YANG[fallbackDirection], usedFallback: true };
}
function computeFlyingStarChart(constructionYear, facingDirection) {
  const period = computeFlyingStarPeriod(constructionYear);
  const sittingDirection = FLYING_STAR_DIRECTIONS[mod(FLYING_STAR_DIRECTIONS.indexOf(facingDirection) + 4, 8)];

  const periodChart = buildFlyingChart(period, true); // period stars always fly forward

  const mountainSeed = periodChart[sittingDirection];
  const mountainDir = determineFlightDirection(mountainSeed, sittingDirection);
  const mountainChart = buildFlyingChart(mountainSeed, mountainDir.forward);

  const facingSeed = periodChart[facingDirection];
  const facingDir = determineFlightDirection(facingSeed, facingDirection);
  const facingChart = buildFlyingChart(facingSeed, facingDir.forward);

  const palaces = {};
  [...FLYING_STAR_DIRECTIONS, 'center'].forEach(dir => {
    palaces[dir] = { period: periodChart[dir], mountain: mountainChart[dir], facing: facingChart[dir] };
  });

  return {
    period, facingDirection, sittingDirection, palaces,
    mountainUsedFallback: mountainDir.usedFallback, facingUsedFallback: facingDir.usedFallback
  };
}

// ENHANCEMENT (this round): Annual, Monthly, and Daily flying-star overlays - the "further, more
// advanced layer" this app's Flying Star honesty note originally listed as not covered. All three
// temporal stars fly FORWARD once computed (confirmed explicitly for the daily star by an independent
// source - "无论阳三元还是阴三元，入中飞星皆顺飞九宫", regardless of Yang/Yin period; annual and
// monthly stars are conventionally treated the same way), which usefully removes the Yin/Yang
// forward/backward branching that the property-based Mountain/Facing stars needed.
//
// CONFIDENCE LEVELS DIFFER ACROSS THE THREE, STATED HONESTLY:
// - ANNUAL: formula verified against 2 directly-stated worked examples from an independent source
//   (2006 -> 3, 2007 -> 2), both matching exactly.
// - MONTHLY: formula cross-derived from a documented mnemonic and confirmed internally consistent
//   (the four zodiac groups it produces align with a real classical grouping - 子卯午酉, 丑辰未戌,
//   寅巳申亥 - rather than an arbitrary split), but not checked against an external worked example.
// - DAILY: substantially more complex (six different solar-term windows, each with its own formula,
//   three of which use a "complement to 10" step) and built on this app's own already-verified
//   astronomical solar-term boundaries. This was NOT cross-checked against a clean external worked
//   example - the one candidate example found in research involved an additional edge case (a
//   60-day-cycle boundary complication) that could not be confidently unpacked in the time available,
//   so it was not used as a verification source rather than risk a false-confidence match. Treat the
//   Daily star as the least-verified of the three.
function computeAnnualFlyingStar(year) {
  const lastTwoDigits = mod(year, 100);
  const digitSum = reduceNumFull(Math.floor(lastTwoDigits / 10) + mod(lastTwoDigits, 10));
  const base = year >= 2000 ? 9 - digitSum : 10 - digitSum;
  const seed = base <= 0 ? base + 9 : (base > 9 ? mod(base - 1, 9) + 1 : base);
  return buildFlyingChart(seed, true);
}
// Zodiac-branch grouping for the Monthly star's starting point - Rat/Rabbit/Horse/Rooster (子卯午酉)
// start January at 8; Ox/Dragon/Goat/Dog (丑辰未戌) start at 5; Tiger/Snake/Monkey/Pig (寅巳申亥)
// start at 2 - derived from a documented mnemonic and confirmed to align with this real classical
// branch grouping (not an arbitrary split of the 12 zodiac signs).
const MONTHLY_STAR_JAN_SEED_BY_YEAR_BRANCH = { 0:8, 3:8, 6:8, 9:8, 1:5, 4:5, 7:5, 10:5, 2:2, 5:2, 8:2, 11:2 };
function computeMonthlyFlyingStar(year, month, yearBranchIdx) {
  const janSeed = MONTHLY_STAR_JAN_SEED_BY_YEAR_BRANCH[yearBranchIdx];
  const seed = mod(janSeed - (month - 1) - 1, 9) + 1; // decreases by 1 each month, wrapping 1->9
  return buildFlyingChart(seed, true);
}
// Six solar-term windows for the Daily star, each atop this app's own astronomically-verified term
// boundaries (see findQmdjTerm) rather than a fixed-date approximation.
const DAILY_STAR_WINDOW_BY_TERM = {
  '冬至':'A','小寒':'A','大寒':'A','立春':'A', '雨水':'B','惊蛰':'B','春分':'B','清明':'B',
  '谷雨':'C','立夏':'C','小满':'C','芒种':'C', '夏至':'D','小暑':'D','大暑':'D','立秋':'D',
  '处暑':'E','白露':'E','秋分':'E','寒露':'E', '霜降':'F','立冬':'F','小雪':'F','大雪':'F'
};
function computeDailyFlyingStarSeed(dayGanzhi, governingTermName) {
  const window = DAILY_STAR_WINDOW_BY_TERM[governingTermName];
  const ganzhiNum = mod(dayGanzhi, 60) + 1; // 1-indexed (Jia-Zi = 1) per the classical formula's own convention
  const raw = (base) => { const r = mod(base, 9); return r === 0 ? 9 : r; };
  let value;
  if (window === 'A') value = raw(ganzhiNum);
  else if (window === 'B') value = raw(ganzhiNum + 6);
  else if (window === 'C') value = raw(ganzhiNum + 3);
  else if (window === 'D') value = 10 - raw(ganzhiNum);
  else if (window === 'E') value = 10 - raw(ganzhiNum + 6);
  else value = 10 - raw(ganzhiNum + 3); // window F
  return value;
}
function computeDailyFlyingStar(dateUTC) {
  const y = dateUTC.getUTCFullYear(), m = dateUTC.getUTCMonth() + 1, d = dateUTC.getUTCDate();
  const epochDay = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  const dayGanzhi = mod(epochDay + 17, 60); // same epoch alignment used throughout this file
  const term = findQmdjTerm(dateUTC, dayGanzhi);
  const seed = computeDailyFlyingStarSeed(dayGanzhi, term.name);
  return { chart: buildFlyingChart(seed, true), seed, governingTerm: term.name };
}
function computeFlyingStarTemporalOverlay(now) {
  const year = now.getUTCFullYear(), month = now.getUTCMonth() + 1, day = now.getUTCDate();
  // Reuses the app's own already-verified Li Chun boundary correction (via getBaZiPillars) to
  // determine which zodiac year currently governs, rather than a naive calendar-year assumption -
  // the Monthly star's zodiac grouping needs the true solar year, not the Jan 1 calendar year.
  const todayBazi = getBaZiPillars(year, month, day, 12, 0, 103.8198, 8);
  return {
    annual: { chart: computeAnnualFlyingStar(todayBazi.yearForPillar), year: todayBazi.yearForPillar },
    monthly: { chart: computeMonthlyFlyingStar(year, month, todayBazi.yearBranchIdx), year, month },
    daily: computeDailyFlyingStar(now)
  };
}

function computeDetailedReadingAnalysis(p) {
  const bazi = p.bazi;
  const tg = computeAllTenGods(bazi);
  const dmElemIdx = computeElementIdxFromStemIdx(bazi.dayStemIdx);

  // --- Day Master strength: weighted composite (see honesty note above and the one further below) ---
  const supportAbbrs = ['P', 'RW', 'DR', 'IR']; // same element or generates the Day Master
  const drainAbbrs = ['EG', 'HO', 'DW', 'IW', 'DO', '7K']; // Day Master generates/controls, or is controlled by
  const allNonDMGods = [
    tg.yearStem, tg.monthStem, tg.hourStem,
    ...tg.yearHidden.map(h => h.tenGod), ...tg.monthHidden.map(h => h.tenGod),
    ...tg.dayHidden.map(h => h.tenGod), ...tg.hourHidden.map(h => h.tenGod)
  ];
  const supportCount = allNonDMGods.filter(g => supportAbbrs.includes(g.abbr)).length;
  const drainCount = allNonDMGods.filter(g => drainAbbrs.includes(g.abbr)).length;

  const seasonalState = computeSeasonalState(bazi.monthBranchIdx, dmElemIdx);
  const rootCount = computeRootCount(bazi, dmElemIdx);
  const heavenlyStemSupportCount = [tg.yearStem, tg.monthStem, tg.hourStem].filter(g => supportAbbrs.includes(g.abbr)).length;

  // HONESTY NOTE: this weighted composite is still a heuristic, not a full professional treatment -
  // it does not account for branch combinations/clashes that can validate or invalidate a root, nor
  // for special chart structures (从格, "Follow" patterns) where an apparently weak Day Master is
  // deliberately read as if strong. The relative weights (seasonal command heaviest, then roots, then
  // heavenly stem support, then the general support/drain balance) follow the standard ordering
  // researched above, but the specific numeric weights are this app's own reasonable calibration of
  // that ordering, not a classical numeric standard (the classical system gives qualitative states,
  // not point values).
  const strengthScore = seasonalState.weight + (rootCount * 2) + (heavenlyStemSupportCount * 1.5) + (supportCount - drainCount) * 0.5;
  const dmStrength = strengthScore >= 3 ? 'strong' : (strengthScore <= -3 ? 'weak' : 'balanced');

  // --- Dominant Ten God (excluding Peer, which is just "self-element" and less narratively useful) ---
  const godCounts = {};
  allNonDMGods.forEach(g => { godCounts[g.abbr] = (godCounts[g.abbr] || 0) + 1; });
  const dominantAbbr = Object.keys(godCounts).filter(a => a !== 'P').sort((a, b) => godCounts[b] - godCounts[a])[0] || 'P';
  const dominantGod = Object.values(TEN_GOD_INFO).find(g => g.abbr === dominantAbbr) || TEN_GOD_INFO.peer;

  // --- Wealth type balance (for the Luck / Direct vs Indirect vs Windfall section) ---
  const directWealthCount = allNonDMGods.filter(g => g.abbr === 'DW').length;
  const indirectWealthCount = allNonDMGods.filter(g => g.abbr === 'IW').length;

  // --- Output ("release valve") and Authority presence ---
  const hasHurtingOfficer = allNonDMGods.some(g => g.abbr === 'HO');
  const hasEatingGod = allNonDMGods.some(g => g.abbr === 'EG');
  const hasSevenKillings = allNonDMGods.some(g => g.abbr === '7K');
  const hasDirectOfficer = allNonDMGods.some(g => g.abbr === 'DO');
  const hasRobWealth = allNonDMGods.some(g => g.abbr === 'RW');

  // --- Career palace (Month) and Spouse palace (Day) hidden-stem detail ---
  const careerPalaceGods = tg.monthHidden.map(h => h.tenGod);
  const spousePalaceGods = tg.dayHidden.map(h => h.tenGod);

  // --- Current / next calendar year pillars, with their Ten God relationship to the Day Master ---
  const nowYear = new Date().getFullYear();
  const curYearPillar = computeYearPillar(nowYear);
  const nextYearPillar = computeYearPillar(nowYear + 1);
  const curYearGod = getTenGod(bazi.dayStemIdx, curYearPillar.stemIdx);
  const nextYearGod = getTenGod(bazi.dayStemIdx, nextYearPillar.stemIdx);
  const curYearBranchHiddenGods = HIDDEN_STEMS_BY_BRANCH[curYearPillar.branchIdx].map(si => getTenGod(bazi.dayStemIdx, si));
  const nextYearBranchHiddenGods = HIDDEN_STEMS_BY_BRANCH[nextYearPillar.branchIdx].map(si => getTenGod(bazi.dayStemIdx, si));

  // --- Current / next Da Yun (10-year Luck Pillar) cycle ---
  const currentAge = computeCurrentAge(p.birthdate);
  const cyclesFromCurrent = (p.daYunPillars || []).filter(dy => (dy.age + 9) >= currentAge);
  const curCycle = cyclesFromCurrent[0] || null;
  const nextCycle = cyclesFromCurrent[1] || null;
  const cycleGod = (cy) => cy ? getTenGod(bazi.dayStemIdx, cy.stemIdx) : null;
  const cycleBranchHiddenGods = (cy) => cy ? HIDDEN_STEMS_BY_BRANCH[cy.branchIdx].map(si => getTenGod(bazi.dayStemIdx, si)) : [];
  // Is this cycle the very first one covering "now" a transition (i.e. currentAge is within its first year)?
  const isCycleTransitionNow = curCycle ? (nowYear === curCycle.calendarYearStart || nowYear === curCycle.calendarYearStart + 1) : false;

  const usefulGod = computeUsefulGod(dmElemIdx, dmStrength, strengthScore);
  // Whether the CURRENT and NEXT year/cycle each fall on the favourable or unfavourable side, per the
  // Useful God verdict just computed - lets the Year/Cycle sections say something genuinely evaluative
  // ("this year's energy works in your favour" / "leans against you") instead of only naming a Ten God.
  const yearElemFavourable = (pillar) => usefulGod.favourable.includes(computeElementIdxFromStemIdx(pillar.stemIdx));
  const cycleElemFavourable = (cy) => cy ? usefulGod.favourable.includes(computeElementIdxFromStemIdx(cy.stemIdx)) : null;

  return {
    dmElemIdx, dmStemIdx: bazi.dayStemIdx,
    dmStrength, supportCount, drainCount, seasonalState, rootCount, heavenlyStemSupportCount, strengthScore,
    usefulGod, curYearFavourable: yearElemFavourable(curYearPillar), nextYearFavourable: yearElemFavourable(nextYearPillar),
    curCycleFavourable: cycleElemFavourable(curCycle), nextCycleFavourable: cycleElemFavourable(nextCycle),
    dominantGod,
    directWealthCount, indirectWealthCount,
    hasHurtingOfficer, hasEatingGod, hasSevenKillings, hasDirectOfficer, hasRobWealth,
    careerPalaceGods, spousePalaceGods,
    nowYear, curYearPillar, nextYearPillar, curYearGod, nextYearGod, curYearBranchHiddenGods, nextYearBranchHiddenGods,
    currentAge, curCycle, nextCycle, curCycleGod: cycleGod(curCycle), nextCycleGod: cycleGod(nextCycle),
    curCycleBranchHiddenGods: cycleBranchHiddenGods(curCycle), nextCycleBranchHiddenGods: cycleBranchHiddenGods(nextCycle),
    isCycleTransitionNow
  };
}

// Locate the governing 24-term window and San Yuan (Shang/Zhong/Xia) segment for a given UTC birth moment.
// The San Yuan segment is determined from the birth DAY's own position in the 60 JiaZi cycle (the
// traditional method ties San Yuan to which 5-day "Fu Tou" block the day pillar falls in), not merely
// how many raw calendar days have elapsed since the term opened.
// PERFORMANCE FIX (see jieMoment's own cache comment above for the full story - this is the much
// bigger half of the same fix). Building `spans` here root-finds 3 years x 24 terms = 72 astronomical
// crossings (each its own 50-iteration bisection) EVERY call - and unlike jieMoment (2-3 calls per
// hour block), this runs once per castQmdjChart call, i.e. once per hour block, so a single 12-block
// Hourly-tab day-switch was root-finding 12 x 72 = 864 crossings from scratch, the overwhelming majority
// of them for the exact same (year, term) pairs as the block right before it. Cached by center year `y`
// (all 3 years of that window at once, since QMDJ_24_TERMS is a plain array so per-entry keying would
// need year+index anyway) - a repeat call for the same `y` becomes an array lookup instead of 72 root-
// finds.
const __qmdjTermSpansCache = new Map();
function computeQmdjTermSpansForYear(y) {
  const cached = __qmdjTermSpansCache.get(y);
  if (cached) return cached;
  const spans = [];
  [y - 1, y, y + 1].forEach(yr => {
    QMDJ_24_TERMS.forEach((t, idx) => {
      const approx = Date.UTC(yr, t.m - 1, t.d, 12, 0);
      spans.push({ ...t, idx, moment: new Date(findSolarLongitudeCrossing(approx, t.deg)) });
    });
  });
  spans.sort((a, b) => a.moment - b.moment);
  __qmdjTermSpansCache.set(y, spans);
  return spans;
}
function findQmdjTerm(birthMomentUTC, dayGanzhi) {
  const y = birthMomentUTC.getUTCFullYear();
  // Build ordered term moments spanning prev-Dec .. this year .. next-Jan for boundary safety.
  // PRECISION FIX: each term's moment is root-found astronomically for the SPECIFIC year (same fix as
  // jieMoment) instead of read off a fixed multi-year average date.
  const spans = computeQmdjTermSpansForYear(y);
  let governing = spans[0];
  for (const s of spans) { if (s.moment <= birthMomentUTC) governing = s; else break; }
  const yuanIdx = Math.floor(mod(dayGanzhi, 15) / 5);
  const ju = governing.ju[yuanIdx];
  const daysSince = Math.floor((birthMomentUTC - governing.moment) / 86400000);
  return { name: governing.name, dun: governing.dun, ju, yuanIdx, daysSince };
}

// Equation of Time (EoT): the difference between apparent (sundial) solar time and mean solar time,
// caused by Earth's elliptical orbit and axial tilt. Standard NOAA approximation, accurate to ~1 minute.
// Needed for a fully precise True Solar Time correction (longitude alone is not enough near hour
// boundaries), consistent with the traditional method's own use of EoT.
function equationOfTimeMinutes(y, m, d) {
  const N = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const B = (2 * Math.PI / 365) * (N - 81);
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

function getBaZiPillars(yy, mm, dd, hh, min, lon, tz) {
  const y = Number(yy), m = Number(mm), d = Number(dd);

  // True solar time correction (longitude + timezone + Equation of Time), consistently used for
  // Year/Month/Hour boundaries and for Da Yun.
  let totalMinutes = (hh * 60) + min + ((lon * 4) - (tz * 60)) + equationOfTimeMinutes(y, m, d);
  let adjHh = Math.floor(totalMinutes / 60);
  let adjMin = totalMinutes - (adjHh * 60);
  let dayOffset = 0;
  if (adjHh < 0) { adjHh += 24; dayOffset = -1; } else if (adjHh >= 24) { adjHh -= 24; dayOffset = 1; }

  let birthMoment = new Date(Date.UTC(y, m - 1, d, adjHh, adjMin));
  birthMoment.setUTCDate(birthMoment.getUTCDate() + dayOffset);
  const by = birthMoment.getUTCFullYear(), bm = birthMoment.getUTCMonth() + 1;

  // BUG (Year Pillar) FIX: the BaZi year switches at Li Chun (~Feb 4), not 1 January.
  const lichunThisY = jieMoment(by, 2);
  const yearForPillar = (birthMoment < lichunThisY) ? by - 1 : by;
  const yearStemIdx = mod(yearForPillar - 4, 10); const yearBranchIdx = mod(yearForPillar - 4, 12);

  // BUG (Month Pillar) FIX: the BaZi month switches at each of the 12 Jie, not the 1st of the
  // Gregorian month. Find the most recent Jie at/before the true-solar birth moment.
  let candidateKey = bm;
  let candidateMoment = jieMoment(by, candidateKey);
  if (birthMoment < candidateMoment) { candidateKey = bm - 1; candidateMoment = jieMoment(by, candidateKey); }
  const govKey = ((candidateKey - 1) % 12 + 12) % 12 + 1;
  const monthBranchIdx = JIE_MONTH_BRANCH[govKey];
  const solarMonthNumber = mod(monthBranchIdx - 2 + 12, 12) + 1; // 1 = Yin/Tiger month (starts at Lichun)
  const month1Stem = mod(2 * ((yearStemIdx % 5) + 1), 10); // Five Tiger Escape (五虎遁) rule
  const monthStemIdx = mod(month1Stem + (solarMonthNumber - 1), 10);

  // Day Pillar - a continuous 60-day cycle, unaffected by solar terms
  const epochDay = Math.floor(Date.UTC(y, m - 1, d) / 86400000) + dayOffset;
  const dayGanzhi = mod(epochDay + 17, 60);
  const dayStemIdx = mod(dayGanzhi, 10); const dayBranchIdx = mod(dayGanzhi, 12);
  const hourBranchIdx = mod(Math.floor(mod(adjHh + 1, 24) / 2), 12);
  const hourStemIdx = mod((dayStemIdx * 2) + hourBranchIdx, 10);

  // ENHANCEMENT (requested directly: real Ascendant-based houses): `birthMoment` above is deliberately
  // TRUE SOLAR TIME relabeled as UTC (see the totalMinutes calc above) - a fine simplification for the
  // Sun/planet/BaZi calculations already using it, but WRONG for the Ascendant, which is extremely
  // sensitive to genuine UTC (Local Sidereal Time advances ~15 degrees per hour, so even a 1-hour
  // mislabeling would shift the Ascendant by ~15 degrees). `realBirthMomentUTC` is a SEPARATE, genuinely
  // real UTC instant (local clock time minus the standard timezone offset only - no longitude/Equation-
  // of-Time correction, which is specific to the true-solar-time convention above and must not leak in
  // here), used ONLY by the Ascendant/house calculation.
  const realBirthMomentUTC = computeRealBirthUTCMoment(y, m, d, hh, min, tz);

  return { dayGanzhi, dayStemIdx, dayBranchIdx, yearStemIdx, yearBranchIdx, yearForPillar, monthStemIdx, monthBranchIdx, hourStemIdx, hourBranchIdx, adjHh, birthMomentUTC: birthMoment, realBirthMomentUTC, solarMonthNumber };
}

// ENHANCEMENT (requested directly: real Ascendant-based houses) - see the note above getBaZiPillars'
// return statement for why this must be a separate function from the true-solar-time birthMoment above.
function computeRealBirthUTCMoment(yy, mm, dd, hh, min, tz) {
  const y = Number(yy), m = Number(mm), d = Number(dd);
  const naive = new Date(Date.UTC(y, m - 1, d, Number(hh) || 0, Number(min) || 0));
  naive.setUTCMinutes(naive.getUTCMinutes() - Math.round(Number(tz) * 60));
  return naive;
}

// BUG (Da Yun) FIX: Exact Da Yun Calculation based on the 3-day time-scaling ratio, driven off the
// nearest Jie (solar term) to the TRUE SOLAR TIME birth moment (longitude/timezone corrected,
// consistent with the BaZi pillar engine), per the JiaZi-derived forward/backward direction.
// Fully dynamic per-profile: every input (date, time, gender, longitude, timezone) changes the result.
function calculateExactDaYun(yy, mm, dd, hh, min, isMale, isYangYear, lon = 103.8, tz = 8) {
    const forward = (isYangYear && isMale) || (!isYangYear && !isMale);

    // True solar time correction (mirrors getBaZiPillars so Da Yun and the Hour Pillar always agree)
    let totalMinutes = (hh * 60) + min + ((lon * 4) - (tz * 60)) + equationOfTimeMinutes(yy, mm, dd);
    let adjHh = Math.floor(totalMinutes / 60);
    let adjMin = totalMinutes - (adjHh * 60);
    let dayOffset = 0;
    if (adjHh < 0) { adjHh += 24; dayOffset = -1; } else if (adjHh >= 24) { adjHh -= 24; dayOffset = 1; }

    const birthMoment = new Date(Date.UTC(yy, mm - 1, dd, adjHh, adjMin));
    birthMoment.setUTCDate(birthMoment.getUTCDate() + dayOffset);
    // Use the (possibly rolled-over) month for locating the correct Jie window
    const refY = birthMoment.getUTCFullYear(), refM = birthMoment.getUTCMonth() + 1;
    const thisMonthJie = jieMoment(refY, refM);

    let targetMoment;
    if (forward) {
        // Next Jie at or after birth
        targetMoment = (birthMoment <= thisMonthJie) ? thisMonthJie : jieMoment(refY, refM + 1);
    } else {
        // Previous Jie at or before birth
        targetMoment = (birthMoment >= thisMonthJie) ? thisMonthJie : jieMoment(refY, refM - 1);
    }

    // Step A: Total Time Gap in Hours (Ghours)
    const gapMs = Math.abs(targetMoment.getTime() - birthMoment.getTime());
    const gapHours = gapMs / 3600000;

    // Step B: Convert Time Gap to "Life Days" (1 Hour of Gap = 5 Days of Life)
    const dLife = gapHours * 5;

    // Step C: Breakdown into Years, Months, Days - ALWAYS rounded down (floor), per spec
    const dyYears = Math.floor(dLife / 360);
    const dyRem = dLife % 360;
    const dyMonths = Math.floor(dyRem / 30);
    const dyDays = Math.floor(dyRem % 30);

    const exactStr = `${dyYears} Yrs, ${dyMonths} Mths, ${dyDays} Days`;
    return { startAge: dyYears, exactStr, dyYears, dyMonths, dyDays, forward };
}

// ENHANCEMENT: Chinese Name vs BaZi compatibility. Uses a curated common-character stroke
// dictionary (traditional/proper stroke counts for frequently-used surname & given-name characters);
// falls back to a documented deterministic approximation (Unicode-codepoint-derived, clearly labelled)
// for any character outside that dictionary, since a complete stroke dictionary for all ~90,000 CJK
// characters cannot be reasonably embedded here.
const CN_STROKE_DICT = {
  '陈':16,'林':8,'黄':12,'张':11,'李':7,'王':4,'吴':7,'刘':6,'蔡':17,'杨':7,'许':6,'郑':8,'谢':17,'洪':9,'郭':11,'朱':6,'胡':9,'何':7,'高':10,'罗':8,
  '梁':11,'宋':7,'唐':10,'徐':10,'孙':6,'马':3,'冯':5,'袁':10,'邓':4,'曾':12,'彭':12,'苏':7,'卢':5,'蒋':17,'蔡':17,'魏':17,'田':5,'董':13,'潘':15,'范':8,
  '汤':6,'尹':4,'黎':15,'易':8,'常':11,'武':8,'乔':6,'贾':10,'路':13,'娄':11,'危':6,'江':6,'童':12,'颜':15,'郭':11,'梅':11,'盛':11,'林':8,'钟':9,'游':12,
  '伟':11,'芳':7,'娜':9,'秀':7,'英':8,'华':6,'慧':15,'巧':5,'美':9,'娟':10,'静':14,'淑':11,'惠':12,'珠':10,'翠':14,'雅':12,'芝':6,'玉':5,'萍':11,'红':6,
  '娥':10,'玲':9,'兰':5,'凤':4,'洁':9,'梅':11,'琳':12,'素':10,'云':4,'莲':10,'真':10,'环':8,'雪':11,'荣':9,'爱':10,'妹':8,'霞':17,'香':9,'月':4,'莉':10,
  '志':7,'强':11,'磊':15,'军':6,'洋':9,'勇':9,'艳':8,'杰':8,'娟':10,'涛':10,'明':8,'超':12,'秀':7,'霞':17,'平':5,'刚':6,'桂':10,'荣':9,'峰':10,'珍':9,
  '嘉':14,'伟':11,'俊':9,'凯':12,'瑞':13,'欣':8,'诗':13,'颖':16,'思':9,'雨':8,'轩':10,'昊':8,'宇':6,'辰':7,'泽':16,'皓':11,'睿':14,'萱':13,'涵':11,'子':3,
  '芸':10,'心':4,'安':6,'恩':10,'嘉':14,'家':10,'国':8,'建':9,'文':4,'武':8,'金':8,'水':4,'木':4,'火':4,'土':3,'龙':5,'凤':4,'福':13,'寿':7,'康':11
};
function getChineseCharStrokes(ch) {
  if (CN_STROKE_DICT[ch] !== undefined) return CN_STROKE_DICT[ch];
  // Documented approximation for characters outside the curated dictionary: deterministic,
  // codepoint-derived, kept within the plausible 2-23 stroke range for common CJK characters.
  return (ch.codePointAt(0) % 22) + 2;
}
function getChineseNameStrokes(str) {
  if (!str) return 0;
  return [...str].reduce((sum, ch) => sum + getChineseCharStrokes(ch), 0);
}
// Grid-number-to-element mapping used in Five Grids (姓名学) theory: last digit of the grid total.
const GRID_LAST_DIGIT_ELEMENT = { 1:'Wood',2:'Wood', 3:'Fire',4:'Fire', 5:'Earth',6:'Earth', 7:'Metal',8:'Metal', 9:'Water',0:'Water' };
function gridElement(n) { return GRID_LAST_DIGIT_ELEMENT[mod(n, 10)]; }

// ENHANCEMENT (this round): the classical 81-number fortune table (八十一数吉凶表, Kumasaki-school
// Five Grids numerology), replacing the previous last-digit-only element mapping with the actual
// auspicious/inauspicious verdict + short theme name each number traditionally carries. Extracted
// from a single, internally-consistent source giving both a detailed and a concise version of the
// same 81 entries (which agree with each other), then verified three ways: (1) completeness - the 81
// entries map to exactly 1-81 with no gaps or duplicates; (2) cross-checked against a second,
// independent source for entries #1 and #2, which matched exactly; (3) checked against the
// widely-known facts that #1 (太极之数) and #81 (万物回春, explicitly the "return to source" of #1)
// are both auspicious, and #2 (两仪之数) is inauspicious - all three checked out.
// Numbers above 81 wrap around by repeatedly subtracting 80 (not a simple mod 81) - per the classical
// rule stated alongside the table itself (e.g. 160 -> 80; 161 -> 1), reflecting "81 returns to its
// origin, equivalent to 1".
const GRID_81_FORTUNE = [null,
  {theme:'太极之数',cn:'吉'}, {theme:'两仪之数',cn:'凶'}, {theme:'三才之数',cn:'吉'}, {theme:'四象之数',cn:'凶'},
  {theme:'五行之数',cn:'吉'}, {theme:'六爻之数',cn:'吉'}, {theme:'七政之数',cn:'吉'}, {theme:'八卦之数',cn:'半吉'},
  {theme:'大成之数',cn:'凶'}, {theme:'终结之数',cn:'凶'}, {theme:'旱苗逢雨',cn:'吉'}, {theme:'掘井无泉',cn:'凶'},
  {theme:'春日牡丹',cn:'吉'}, {theme:'破兆',cn:'凶'}, {theme:'福寿',cn:'吉'}, {theme:'厚重',cn:'吉'},
  {theme:'刚强',cn:'半吉'}, {theme:'铁镜重磨',cn:'半吉'}, {theme:'多难',cn:'凶'}, {theme:'屋下藏金',cn:'凶'},
  {theme:'明月中天',cn:'吉'}, {theme:'秋草逢霜',cn:'凶'}, {theme:'壮丽',cn:'吉'}, {theme:'掘藏得金',cn:'吉'},
  {theme:'荣俊',cn:'半吉'}, {theme:'变怪',cn:'凶'}, {theme:'增长',cn:'凶'}, {theme:'阔水浮萍',cn:'凶'},
  {theme:'智谋',cn:'吉'}, {theme:'非运',cn:'半吉'}, {theme:'春日花开',cn:'吉'}, {theme:'宝马金鞍',cn:'吉'},
  {theme:'旭日升天',cn:'吉'}, {theme:'破家',cn:'凶'}, {theme:'高楼望月',cn:'吉'}, {theme:'波澜重叠',cn:'半吉'},
  {theme:'猛虎出林',cn:'吉'}, {theme:'磨铁成针',cn:'半吉'}, {theme:'富贵荣华',cn:'半吉'}, {theme:'退安',cn:'凶'},
  {theme:'有德',cn:'吉'}, {theme:'寒蝉在柳',cn:'凶'}, {theme:'散财破产',cn:'凶'}, {theme:'烦闷',cn:'凶'},
  {theme:'顺风',cn:'吉'}, {theme:'浪里淘金',cn:'凶'}, {theme:'点石成金',cn:'吉'}, {theme:'古松立鹤',cn:'吉'},
  {theme:'转变',cn:'半吉'}, {theme:'小舟入海',cn:'半吉'}, {theme:'沉浮',cn:'半吉'}, {theme:'达眼',cn:'吉'},
  {theme:'曲卷难星',cn:'凶'}, {theme:'石上栽花',cn:'凶'}, {theme:'善恶',cn:'半吉'}, {theme:'浪里行舟',cn:'凶'},
  {theme:'日照春松',cn:'吉'}, {theme:'晚行遇月',cn:'半吉'}, {theme:'寒蝉悲风',cn:'凶'}, {theme:'无谋',cn:'凶'},
  {theme:'牡丹芙蓉',cn:'吉'}, {theme:'衰败',cn:'凶'}, {theme:'舟归平海',cn:'吉'}, {theme:'非命',cn:'凶'},
  {theme:'巨流归海',cn:'吉'}, {theme:'岩头步马',cn:'凶'}, {theme:'顺风通达',cn:'吉'}, {theme:'顺风吹帆',cn:'吉'},
  {theme:'非业',cn:'凶'}, {theme:'残菊逢霜',cn:'凶'}, {theme:'石上金花',cn:'半吉'}, {theme:'劳苦',cn:'半吉'},
  {theme:'无勇',cn:'半吉'}, {theme:'残菊经霜',cn:'凶'}, {theme:'退守',cn:'凶'}, {theme:'离散',cn:'凶'},
  {theme:'半吉',cn:'半吉'}, {theme:'晚苦',cn:'凶'}, {theme:'云头望月',cn:'凶'}, {theme:'遁吉',cn:'凶'},
  {theme:'万物回春',cn:'吉'}
];
const GRID_FORTUNE_LABEL = { '吉': { en: 'Auspicious', zh: '吉' }, '凶': { en: 'Inauspicious', zh: '凶' }, '半吉': { en: 'Mixed', zh: '半吉' } };
const GRID_FORTUNE_COLOR = { '吉': 'var(--success)', '凶': 'var(--danger)', '半吉': 'var(--warning)' };
// Numbers above 81 wrap around by repeatedly subtracting 80 (not a simple mod 81) - per the classical
// rule stated alongside the table itself. Verified against all three of the source's own worked
// examples: 82 -> 2, 160 -> 80, and 161 -> 1 (via TWO subtractions: 161-80=81, then 81-80=1, exactly
// as the source states "subtract 80 twice") - this last case specifically shows 81 is only used as a
// destination when the raw number IS 81 to begin with, not when reached by wrapping from something
// higher, which a naive "wrap until <= 81" loop would get wrong (it would stop at 81 for 161 instead
// of continuing to 1, contradicting the source's own explicit example).
function gridFortune(n) {
  let wrapped = n;
  if (wrapped > 81) { while (wrapped > 80) wrapped -= 80; }
  const entry = GRID_81_FORTUNE[wrapped];
  return { number: wrapped, theme: entry.theme, verdict: entry.cn, label: GRID_FORTUNE_LABEL[entry.cn], color: GRID_FORTUNE_COLOR[entry.cn] };
}

function calculateChineseNameBaziCompat(chineseLastName, chineseFirstName, dayStemIdx) {
  if (!chineseLastName && !chineseFirstName) return null;
  const surnameChars = [...(chineseLastName || '')];
  const givenChars = [...(chineseFirstName || '')];
  const surnameStrokes = surnameChars.map(getChineseCharStrokes);
  const givenStrokes = givenChars.map(getChineseCharStrokes);
  const sSum = surnameStrokes.reduce((a,b)=>a+b,0);
  const gSum = givenStrokes.reduce((a,b)=>a+b,0);
  // Standard Five Grids formulae (single or double-character surname/given-name aware)
  const tianGe = surnameChars.length >= 2 ? sSum : sSum + 1;
  const renGe = (surnameChars.length ? surnameStrokes[surnameStrokes.length-1] : 0) + (givenStrokes.length ? givenStrokes[0] : 0);
  const diGe = givenChars.length >= 2 ? gSum : gSum + 1;
  const zongGe = sSum + gSum;
  const waiGe = Math.max(1, zongGe - renGe + 1);

  const dmElemIdx = Math.floor(dayStemIdx / 2); // 0 Wood,1 Fire,2 Earth,3 Metal,4 Water
  const WUXING = ['Wood','Fire','Earth','Metal','Water'];
  const dmElem = WUXING[dmElemIdx];
  const generatesMap = { 'Wood':'Fire','Fire':'Earth','Earth':'Metal','Metal':'Water','Water':'Wood' };
  const controlsMap = { 'Wood':'Earth','Earth':'Water','Water':'Fire','Fire':'Metal','Metal':'Wood' };
  const generatedByMap = Object.fromEntries(Object.entries(generatesMap).map(([k,v])=>[v,k]));
  const controlledByMap = Object.fromEntries(Object.entries(controlsMap).map(([k,v])=>[v,k]));
  // Favourable: same element as Day Master, or the element that GENERATES the Day Master (resource).
  // Unfavourable: the element that CONTROLS/overcomes the Day Master (over-pressure).
  // Neutral: the element the Day Master generates (output) or controls (wealth).
  function rate(elem) {
    if (elem === dmElem) return 'favourable';
    if (elem === generatedByMap[dmElem]) return 'favourable';
    if (elem === controlledByMap[dmElem]) return 'unfavourable';
    return 'neutral';
  }
  const grids = [
    { name: 'Tian Ge (天格)', value: tianGe, elem: gridElement(tianGe) },
    { name: 'Ren Ge (人格)', value: renGe, elem: gridElement(renGe) },
    { name: 'Di Ge (地格)', value: diGe, elem: gridElement(diGe) },
    { name: 'Wai Ge (外格)', value: waiGe, elem: gridElement(waiGe) },
    { name: 'Zong Ge (总格)', value: zongGe, elem: gridElement(zongGe) }
  ].map(g => ({ ...g, rating: rate(g.elem) }));

  const favCount = grids.filter(g => g.rating === 'favourable').length;
  const unfavCount = grids.filter(g => g.rating === 'unfavourable').length;
  const percent = Math.max(20, Math.min(99, Math.round(55 + (favCount / grids.length) * 45 - (unfavCount / grids.length) * 30)));

  return { grids, dmElem, favCount, unfavCount, percent, tianGe, renGe, diGe, waiGe, zongGe, surnameChars, givenChars };
}

// Search a small curated pool of common given-name characters for a 1-2 character combination
// (surname fixed, one given-name character optionally retained) that raises the compatibility to
// 90%+. Returns null if no combination in the pool clears 90%.
const CN_GIVEN_NAME_POOL = ['安','恩','嘉','家','国','建','文','宇','辰','泽','皓','睿','萱','涵','子','芸','心','轩','昊','瑞','欣','思','雨','颖','诗','明','俊','凯','伟','杰','涛','超','平','刚','桂','荣','峰','珍','龙','凤','福','寿','康','美','娟','静','淑','惠','雅','芝','玉','萍','红','兰','洁','琳','素','云','莲','真','环','雪','月','莉'];
// BUG 4 FIX: retainPosition lets the caller pin the retained character to the 1st OR 2nd given-name
// position (previously always position 1). Candidates that repeat a character (either duplicating the
// two given-name characters, or repeating a character already in the surname) are now excluded, since
// repeated characters are traditionally avoided in Chinese given names.
// ENHANCEMENT 3 FIX: reclicking "suggest another name" should give a genuinely different suggestion
// each time while still guaranteeing >=85% compatibility wherever the search space allows it. Instead
// of returning only the single best candidate, this now collects ALL candidates scoring >=85%, sorted
// best-first, and the caller can request the Nth one (or exclude already-shown names) to cycle through
// distinct suggestions on repeat clicks.
function suggestChineseGivenNameList(chineseLastName, dayStemIdx, retainChar, retainPosition = 1, minPercent = 85) {
  const surnameChars = [...(chineseLastName || '')];
  const results = [];
  const seen = new Set();
  const fixedPool = retainChar ? [retainChar] : CN_GIVEN_NAME_POOL;
  for (const cFixed of fixedPool) {
    if (retainChar && cFixed !== retainChar) continue;
    for (const cOther of CN_GIVEN_NAME_POOL) {
      const c1 = retainPosition === 2 ? cOther : cFixed;
      const c2 = retainPosition === 2 ? cFixed : cOther;
      if (c1 === c2) continue;
      if (surnameChars.includes(c1) || surnameChars.includes(c2)) continue;
      const candidate = c1 + c2;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      const result = calculateChineseNameBaziCompat(chineseLastName, candidate, dayStemIdx);
      if (result && result.percent >= minPercent) results.push({ name: candidate, ...result });
    }
  }
  results.sort((a, b) => b.percent - a.percent);
  return results; // caller picks by index / filters out already-shown names
}
// Backward-compatible single-best wrapper (still used by the initial auto-suggestion on the page)
function suggestChineseGivenName(chineseLastName, dayStemIdx, retainChar, retainPosition = 1) {
  const list = suggestChineseGivenNameList(chineseLastName, dayStemIdx, retainChar, retainPosition, 85);
  if (list.length) return list[0];
  // Nothing reached 85% - fall back to the best available below that bar rather than returning nothing
  const fallback = suggestChineseGivenNameList(chineseLastName, dayStemIdx, retainChar, retainPosition, 0);
  return fallback[0] || null;
}


function convertGregorianToLunar(yy, mm, dd, lunarYearForDisplay) {
    // BUG FIX: previously displayed the raw Gregorian month/day mislabelled as "lunar" - now reuses
    // the exact same approximate lunar month/day used by the Bone Weight section, so the "Lunar
    // Birthdate" badge and the Bone Weight section never show conflicting lunar dates again.
    // BUG FIX (reported: "Lunar birth does not show year value"): this always showed the 60-year
    // cyclical Stem-Branch name (e.g. "Bing-Chen Year") but never the actual 4-digit lunar year number
    // itself, unlike every other date shown in this app. `lunarYearForDisplay` - the Li Chun-corrected
    // true lunar year (bazi.yearForPillar), already computed by the caller and consistent with the
    // Year Pillar shown elsewhere in the chart - is now included alongside the Stem-Branch name.
    const displayYear = lunarYearForDisplay ?? yy;
    const yStem = stemCN[mod(displayYear - 4, 10)]; const yBranch = branchCN[mod(displayYear - 4, 12)];
    const { lunarMonth, lunarDay } = approximateLunarMonthDay(yy, mm, dd);
    return {
      fullLunarEN: `Lunar ${displayYear} (${yStem}-${yBranch} Year), Month ${lunarMonth}, Day ${lunarDay} (approx.)`,
      fullLunarCN: `农历${displayYear}年（${yStem}${yBranch}年）${lunarMonth}月${lunarDay}日 (约)`
    };
}

function getProfileData(customProfile = null) {
  const u = activeUser(); const p = customProfile || (u ? u.profile : null);
  if (!p || !p.birthdate) return null;

  const sum = p.birthdate.split('-').join('').split('').reduce((a, b) => a + +b, 0);
  const [yy, mm, dd] = (p.birthdate || '1990-01-01').split('-').map(Number);
  const timeParts = (p.birthtime || '12:00').split(':');
  const hh = Number(timeParts[0]); const min = Number(timeParts[1]);
  const lon = Number(p.birthLongitude) || 103.8;
  // BUG (Da Yun/QMDJ) FIX: auto-correct for Singapore/Malaysia's pre-1982 GMT+7:30 offset
  const tzOff = resolveHistoricalTz(yy, mm, dd, Number(p.birthTimezone) || 8, p.birthLocation);

  const bazi = getBaZiPillars(yy, mm, dd, hh, min, lon, tzOff);
  const isMale = p.gender === 'male'; const isYangYear = (bazi.yearStemIdx % 2) === 0;
  
  // BUG (Da Yun) FIX: pass the profile's actual longitude/timezone through so Da Yun is truly dynamic
  // per-profile (previously silently fell back to the Singapore default for every chart).
  const daYunCalc = calculateExactDaYun(yy, mm, dd, hh, min, isMale, isYangYear, lon, tzOff);

  // Explicit Da Yun START YEAR (calendar year the first luck pillar takes over), per Bug 5
  const daYunStartDate = new Date(yy, mm - 1, dd);
  daYunStartDate.setFullYear(daYunStartDate.getFullYear() + daYunCalc.dyYears);
  daYunStartDate.setMonth(daYunStartDate.getMonth() + daYunCalc.dyMonths);
  daYunStartDate.setDate(daYunStartDate.getDate() + daYunCalc.dyDays);
  const daYunStartYear = daYunStartDate.getFullYear();

  // BUG FIX: Da Yun start AGE now rounds to the nearest whole year using the requested convention -
  // a remainder of 7-12 months rounds UP to the next year, 1-6 months rounds DOWN (0 months stays as-is).
  const nominalStartAge = daYunCalc.dyMonths >= 7 ? daYunCalc.dyYears + 1 : daYunCalc.dyYears;

  // BUG 3 FIX: generate enough Da Yun cycles to run all the way to age 100 (not a fixed 10 cycles
  // counted from the start age), so the current cycle through the age-100 cycle are always available.
  let daYunPillars = [];
  const forward = daYunCalc.forward;
  const startAgeClamped = Math.max(0, nominalStartAge);
  const cycleCount = Math.max(1, Math.ceil((100 - startAgeClamped) / 10) + 1);
  for (let i = 0; i < cycleCount; i++) {
      let offset = forward ? (i + 1) : -(i + 1);
      const age = startAgeClamped + (i * 10);
      if (age > 100) break;
      daYunPillars.push({ age, stemIdx: mod(bazi.monthStemIdx + offset, 10), branchIdx: mod(bazi.monthBranchIdx + offset, 12), calendarYearStart: daYunStartYear + (i * 10),
        rating: rateDaYunCycle(mod(bazi.monthStemIdx + offset, 10), mod(bazi.monthBranchIdx + offset, 12), bazi.dayStemIdx, bazi.dayBranchIdx) });
  }

  // Bug 2/6 FIX: Ming Li Base Colors - now bilingual (previously English-only, causing "Ming Li table
  // still has English when Chinese is chosen"). engine-metaphysics.js loads before app.js's bt() but
  // `lang` itself is a global from engine-core.js, so it's checked directly here rather than via bt().
  const isZhColor = (typeof lang !== 'undefined' && lang === 'zh');
  let luckyColor = isZhColor ? '绿色与金色' : 'Green & Gold', avoidColor = isZhColor ? '黑色与深色系' : 'Black & Dark Colors';
  const dayStemChar = stemCN[bazi.dayStemIdx || 0];
  if (['壬','癸'].includes(dayStemChar)) { luckyColor = isZhColor ? '银白色与深蓝色' : 'Metallic Silver & Deep Blue'; avoidColor = isZhColor ? '棕色与土色' : 'Brown & Earth'; }
  else if (['丙','丁'].includes(dayStemChar)) { luckyColor = isZhColor ? '森林绿与宝石红' : 'Forest Green & Ruby Red'; avoidColor = isZhColor ? '深蓝色' : 'Dark Blue'; }
  else if (['甲','乙'].includes(dayStemChar)) { luckyColor = isZhColor ? '水蓝色与叶绿色' : 'Aqua Blue & Leaf Green'; avoidColor = isZhColor ? '白色与金色' : 'White & Gold'; }
  else if (['庚','辛'].includes(dayStemChar)) { luckyColor = isZhColor ? '土黄色与珍珠白' : 'Earth Yellow & Pearl White'; avoidColor = isZhColor ? '红色与橙色' : 'Red & Orange'; }
  else { luckyColor = isZhColor ? '火红色与金黄色' : 'Fire Red & Golden Yellow'; avoidColor = isZhColor ? '绿色与木色' : 'Green & Wood'; }

  // BUG 1/2/3 FIX: proper Five Grids analysis for BOTH name systems, computed once here for reuse.
  // The MAIN "tianGe/renGe/..." fields (used in the primary Name Analysis header) now come from the
  // CHINESE name when available (strictly, per Bug 1) - previously this always used a crude English
  // charCode-sum regardless of whether a Chinese name existed.
  const chineseNameCompat = calculateChineseNameBaziCompat(p.chineseLastName, p.chineseFirstName, bazi.dayStemIdx);
  const englishNameCompat = calculateEnglishNameBaziCompat(p.englishLastName, p.englishFirstName, bazi.dayStemIdx);
  // Genuine Western Name Numerology (Expression/Soul Urge/Personality) - computed from the full
  // English name regardless of whether a Chinese name is also on file, since this is a distinct,
  // legitimate system in its own right rather than a substitute for missing Chinese characters.
  const westernNameNumerology = computeWesternNameNumerology(`${p.englishFirstName || ''} ${p.englishLastName || ''}`);
  const primaryNameGrids = chineseNameCompat || englishNameCompat || { tianGe: 1, renGe: 1, diGe: 1, waiGe: 1, zongGe: 1 };
  const lifeNum = reduceNum(sum);
  const qmdjPalaceNames = ['','Kan (坎 / N)','Kun (坤 / SW)','Zhen (震 / E)','Xun (巽 / SE)','Center (中)','Qian (乾 / NW)','Dui (兑 / W)','Gen (艮 / NE)','Li (离 / S)'];

// Full Ju Shu (Bureau Number) + Earth/Heaven Plate casting, dynamically derived from the true-solar
// birth moment's governing 24-Solar-Term / San Yuan window. VERIFIED: the Fu Tou (符头) -> Shang/
// Zhong/Xia Yuan assignment and the full 24-term x 3-Yuan Ju Shu lookup table have both been checked
// day-by-day / term-by-term against an authoritative Tung Shu reference and match exactly - this is
// no longer an approximation. The remaining simplification is in the Heaven Plate: Deity/Star/Door
// placement uses a documented benchmark-rotation model rather than the full hour-based casting ritual,
// so treat individual Deity/Star/Door pairings as illustrative of the mechanism rather than a
// professionally verified output, even though Ju Shu, Dun type, and Solar Term are all now verified.
const qmdj = castQmdjChart(bazi);

  // ENHANCEMENT 5 FIX: San Shi category - Da Liu Ren (大六壬) cast for this profile's natal moment,
  // and Tai Yi Shen Shu (太乙神數) macro theme for the natal year.
  const natalZhongqi = findGoverningZhongqi(bazi.birthMomentUTC, bazi.dayGanzhi);
  const daLiuRen = castDaLiuRen(bazi, natalZhongqi);
  const taiYi = { ...computeTaiYiMacroTheme(bazi.yearStemIdx, bazi.yearBranchIdx, bazi.dayStemIdx, bazi.dayBranchIdx), yearlyCast: computeTaiYiYearlyCast(bazi.birthMomentUTC.getUTCFullYear()) };

  const numCompat = [1,5,9].map(n=>(mod((lifeNum+n),9))||9);
  const numAvoid = [4,8].map(n=>(mod((lifeNum+n),9))||9);
  // BUG 14 FIX: 4-digit Life Lucky Number, built from the Life Path number and its two favourable numbers.
  // Uses reduceNumFull (always single-digit) rather than the master-number-aware lifeNum here
  // specifically, so this stays a genuine 4-digit code even when the Life Path itself is a master
  // number (11/22/33) - the master number is still shown correctly wherever the Life Path itself is
  // displayed, just not baked into this separate, fixed-length derived code.
  const lifeNumForLuckyCode = reduceNumFull(sum);
  const lifeLuckyNumber = `${lifeNumForLuckyCode}${numCompat[0]}${numCompat[1]}${mod(lifeNumForLuckyCode + numCompat[0] + numCompat[1], 9) || 9}`;
  const isMasterNumber = [11, 22, 33].includes(lifeNum);

  // ENHANCEMENT 1: Chinese Bone Weight, dynamically calculated per-profile
  const boneWeight = calculateBoneWeight(yy, mm, dd, hh, min, bazi);

  // Full 14-star Zi Wei Dou Shu chart - reuses boneWeight's already-computed true lunar month/day
  // (which correctly handles the "late Zi hour" 23:00-23:59 next-lunar-day convention) rather than
  // recomputing separately, so the two never disagree about which lunar date is being used.
  const ziweiChart = calculateZWDSChart(boneWeight.lunarMonth, boneWeight.lunarDay, bazi.hourBranchIdx, bazi.yearStemIdx, bazi.yearBranchIdx);
  const ziwei = ziweiChart;

  // Real Mei Hua Yi Shu casting (year-stem/lunar-month/lunar-day/hour), replacing the previous
  // name-checksum "natal hexagram" - see castMeiHuaNatalHexagram for the verified formula.
  const meiHua = castMeiHuaNatalHexagram(bazi.yearStemIdx, boneWeight.lunarMonth, boneWeight.lunarDay, bazi.hourBranchIdx);

  return {
    ...p, sum,
    // BUG FIX (deep audit, XSS): these specific fields are escaped here because they are the ones
    // interpolated directly into HTML templates throughout the app - overriding the raw versions the
    // `...p` spread above already included. The RAW (unescaped) values remain on the original `p`/
    // `u.profile` object for anything that legitimately needs them verbatim (e.g. re-populating an
    // edit form's input .value, which is not an innerHTML injection and must not be double-escaped).
    englishFirstName: escapeHtml(p.englishFirstName), englishLastName: escapeHtml(p.englishLastName),
    chineseFirstName: escapeHtml(p.chineseFirstName), chineseLastName: escapeHtml(p.chineseLastName),
    birthLocation: escapeHtml(p.birthLocation),
    englishName: `${escapeHtml(p.englishFirstName)} ${escapeHtml(p.englishLastName)}`, displayName: escapeHtml(p.englishFirstName), isMale,
    // ENHANCEMENT (requested directly: real Ascendant-based houses) - computed here (once, per profile
    // load) rather than deep inside each render function, since it needs both `bazi` (for the real UTC
    // birth moment) and the raw profile's own `birthLatitude`/`birthLongitude` in scope together. Returns
    // null (handled honestly downstream) when this profile has no birth latitude on file yet.
    houses: computeNatalHouses({ bazi, birthLatitude: p.birthLatitude, birthLongitude: lon }),
    bazi, daYunPillars, exactDaYunCalcStr: daYunCalc.exactStr, daYunStartYear, nominalStartAge, lunar: convertGregorianToLunar(yy, mm, dd, bazi.yearForPillar), astro: getAstrologySign(mm, dd),
    luckyColor, avoidColor,
    tianGe: primaryNameGrids.tianGe, renGe: primaryNameGrids.renGe, diGe: primaryNameGrids.diGe, waiGe: primaryNameGrids.waiGe, zongGe: primaryNameGrids.zongGe,
    chineseNameCompat, englishNameCompat, westernNameNumerology,
    animal: branches[bazi.yearBranchIdx], animalCN: branchCN[bazi.yearBranchIdx],
    zodiacData: ZODIAC_TRAITS[bazi.yearBranchIdx],
    hexNo: meiHua.hexNo, meiHua, palaceIdx: qmdj.natalPalace, palaceName: qmdjPalaceNames[qmdj.natalPalace], dunType: qmdj.dun === 'yang' ? 'Yang Dun (阳遁)' : 'Yin Dun (阴遁)',
    qmdj,
    daLiuRen, natalZhongqi, taiYi,
    ziwei,
    kuaGroup: [1,3,4,9].includes(getKua(yy, isMale)) ? 'East (东四命)' : 'West (西四命)', kuaNum: getKua(yy, isMale),
    // Bug 12: Ming Li Variables
    lifespan: 78 + (sum % 17), children: 1 + (sum % 3) + (isMale ? 0 : 1), mAge1: 25 + (sum % 5), mAge2: 32 + (sum % 4),
    // Bug 9/14: Numerology
    life: lifeNum, isMasterNumber, numCompat, numAvoid, lifeLuckyNumber,
    // Enhancement 1: Bone Weight
    boneWeight
  };
}

// BUG 2 FIX (round 3): cast the QMDJ Earth Plate from the Ju Shu (Bureau Number) and locate the
// Day Master's natal palace, per Steps 1-5 of the traditional method. The Heaven Plate's hour-based
// Zhi Fu/Zhi Shi rotation is a further, extremely deep layer beyond a single natal-palace lookup;
// this implementation casts the Earth Plate authentically and displays the benchmark Star/Door/Deity
// reference for each palace (documented as a simplification of the full hour-rotated Heaven Plate).
// BUG 1 FIX (round 5): full Qi Men Dun Jia cast, following the traditional method precisely:
//  Step 1-2 (Four Pillars, Solar Term, Dun Type) are handled by getBaZiPillars/findQmdjTerm.
//  Step 3 (Ju Shu) is handled by findQmdjTerm's San Yuan lookup.
//  Step 4 (Earth Plate): the 6 Instruments + 3 Wonders are cast into the 9 palaces starting at the
//    Ju palace, stepping forward (Yang Dun) or backward (Yin Dun) through the Lo Shu numbers.
//  Step 4 (Heaven Plate): the governing Xun's hidden-Jia stem is located on the Earth Plate (its
//    "Xun Shou" palace); the Zhi Fu deity/star riding there is then rotated to the palace matching
//    the CURRENT HOUR's Earthly Branch, and the entire Deity/Star/Door assembly rotates by the same
//    number of Luoshu-ring steps, so the Heaven Plate genuinely reflects the birth hour, not just Ju.
//  Step 5 (Life Palace/Wealth Palace/Life Door): read directly off the rotated Heaven Plate.
function castQmdjChart(bazi) {
  const term = findQmdjTerm(bazi.birthMomentUTC, bazi.dayGanzhi);
  const isYang = term.dun === 'yang';

  // Earth Plate (Di Pan): cast the 6 Instruments + 3 Wonders from the Ju palace
  const earthPlate = {}; // palace number -> stem index sitting there
  QMDJ_STEM_CAST_ORDER.forEach((stemIdx, step) => {
    const palace = isYang ? (mod(term.ju - 1 + step, 9) + 1) : (mod(term.ju - 1 - step, 9) + 1);
    earthPlate[palace] = stemIdx;
  });
  const earthPalaceOfStem = {};
  Object.entries(earthPlate).forEach(([pal, stemIdx]) => { earthPalaceOfStem[stemIdx] = Number(pal); });

  // Heaven Plate (Tian Pan): locate the Xun Shou (governing decade's hidden-Jia-riding stem) on the
  // Earth Plate, then rotate the whole Deity/Star/Door assembly so Zhi Fu lands on the hour's palace.
  const xunDecadeIdx = Math.floor(mod(bazi.dayGanzhi, 60) / 10);
  const xunShouStem = XUN_HIDDEN_JIA_RIDES[xunDecadeIdx];
  const xunShouPalace = earthPalaceOfStem[xunShouStem] !== undefined ? earthPalaceOfStem[xunShouStem] : 5;
  const hourBranchPalace = BRANCH_TO_PALACE[bazi.hourBranchIdx];
  const fromRingIdx = LUOSHU_RING.indexOf(ringPalace(xunShouPalace, isYang));
  const toRingIdx = LUOSHU_RING.indexOf(ringPalace(hourBranchPalace, isYang));
  const rotationSteps = toRingIdx - fromRingIdx;

  // Locate the Day Master's palace on the (now hour-rotated) Heaven Plate. If the Day Master's stem
  // lands on Earth-Plate palace 5 (Center), it "borrows" palace 2 (Yang Dun) or 8 (Yin Dun) before
  // rotating - the same convention already used everywhere else in this file via ringPalace(). This
  // was previously hardcoded to stay at palace 5 ("Center"), which isn't even a valid compass palace -
  // confirmed wrong against the authoritative test-data spreadsheet (2 of 3 known cases gave "Center").
  const dmStemIdx = bazi.dayStemIdx;
  const trackedStemIdx = (dmStemIdx === 0) ? 4 : dmStemIdx; // Jia hides, rides on Wu
  const dmEarthPalaceRaw = earthPalaceOfStem[trackedStemIdx] !== undefined ? earthPalaceOfStem[trackedStemIdx] : 5;
  const dmEarthPalace = ringPalace(dmEarthPalaceRaw, isYang);
  const natalPalace = rotatePalaceByRing(dmEarthPalace, rotationSteps, isYang);

  // Build the full 9-palace grid: each Earth Plate palace's Deity/Star/Door reference rotates with it.
  // Palace 5 (Center) itself never appears as a Heaven Plate destination - it also borrows 2/8.
  // BUG 17/18 FIX: expose BOTH stems distinctly per cell, matching the reference chart template which
  // shows two separate stems per palace: diPanStem (Earth Plate - fixed, whatever stem physically sits
  // at that palace number, unaffected by hour) and tianPanStem (Heaven Plate - the stem that travelled
  // here from its Ju-cast position, riding along with the Deity/Star/Door as Zhi Fu rotates). These were
  // previously conflated into a single "earthStem" field that was actually the Heaven Plate value.
  const grid = {};
  for (let pal = 1; pal <= 9; pal++) {
    const heavenPalace = rotatePalaceByRing(pal, rotationSteps, isYang);
    grid[heavenPalace] = {
      tianPanStem: earthPlate[pal] !== undefined ? QMDJ_STEM_NAMES_CN[earthPlate[pal]] : '—',
      earthStem: earthPlate[pal] !== undefined ? QMDJ_STEM_NAMES_CN[earthPlate[pal]] : '—', // kept for backward compatibility
      ...(QMDJ_PALACE_REF[pal] || QMDJ_PALACE_REF[5])
    };
  }
  for (let pal = 1; pal <= 9; pal++) { if (!grid[pal]) grid[pal] = { tianPanStem: '—', earthStem: '—', ...QMDJ_PALACE_REF[5] }; }
  // Now attach the TRUE (static) Di Pan stem for each palace's own physical position
  for (let pal = 1; pal <= 9; pal++) { grid[pal].diPanStem = earthPlate[pal] !== undefined ? QMDJ_STEM_NAMES_CN[earthPlate[pal]] : '—'; }

  // Wealth Palace: wherever the Sheng Men (生门, benchmark palace 8) door rotated to.
  // Life Door: the door now sitting in the Day Master's natal palace.
  const wealthPalace = (natalPalace === 5) ? 8 : rotatePalaceByRing(8, rotationSteps, isYang);
  const lifeDoor = grid[natalPalace].door;
  const lifeDeity = grid[natalPalace].deity;
  const lifeStar = grid[natalPalace].star;

  // BUG 9 FIX: Yi Ma (驿马, Traveling Horse) and Kong Wang (空亡, Void) - both computed once per
  // chart cast and surfaced on the grid, since they mark palaces/branches of special significance
  // (Yi Ma = favourable for travel/movement-related activity; Kong Wang = "hollow" - avoid major
  // commitments tied to that palace).
  const yiMaBranchIdx = calculateYiMa(bazi.dayBranchIdx);
  const yiMaPalace = BRANCH_TO_PALACE[yiMaBranchIdx];
  const kongWangBranches = calculateKongWang(bazi.dayGanzhi);
  const kongWangPalaces = [...new Set(kongWangBranches.map(b => BRANCH_TO_PALACE[b]))];

  return {
    termName: term.name, dun: term.dun, ju: term.ju, yuanLabel: ['Shang Yuan (上元)','Zhong Yuan (中元)','Xia Yuan (下元)'][term.yuanIdx],
    natalPalace, dayMasterStemCN: stemCN[dmStemIdx], grid,
    wealthPalace, lifeDoor, lifeDeity, lifeStar,
    xunShouPalace, hourBranchPalace, rotationSteps,
    yiMaBranchIdx, yiMaPalace, kongWangBranches, kongWangPalaces,
    ref: grid[natalPalace]
  };
}

// ENHANCEMENT 8 FIX: Daily QMDJ Chart - casts a fresh QMDJ chart for TODAY (current date/time),
// then locates where the profile's own Day Master stem sits on today's chart, so the app can give
// day-specific advice ("your Day Master rides the Sheng Men door today") rather than only a static
// natal reading. Uses Singapore (default) true-solar correction since this is a shared "today" chart.
function getDailyQmdjForProfile(p) {
  const now = new Date();
  const yy = now.getFullYear(), mm = now.getMonth() + 1, dd = now.getDate();
  const hh = now.getHours(), min = now.getMinutes();
  const todayBazi = getBaZiPillars(yy, mm, dd, hh, min, 103.8198, 8);
  const todayQmdj = castQmdjChart(todayBazi);

  // Locate the profile's own Day Master stem within TODAY's Earth Plate (mirrors the natal-palace logic)
  const dmStemIdx = p.bazi.dayStemIdx;
  const trackedStemIdx = (dmStemIdx === 0) ? 4 : dmStemIdx;
  const trackedStemCN = QMDJ_STEM_NAMES_CN[trackedStemIdx];
  let personPalaceToday = todayQmdj.natalPalace;
  for (let pal = 1; pal <= 9; pal++) { if (todayQmdj.grid[pal].earthStem === trackedStemCN) { personPalaceToday = pal; break; } }
  const cellToday = todayQmdj.grid[personPalaceToday];
  const doorRatingToday = QMDJ_DOOR_RATING[cellToday.door] || 'Neutral';

  return {
    dateStr: now.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    todayQmdj, personPalaceToday, cellToday, doorRatingToday, todayBazi
  };
}

// ENHANCEMENT 6 FIX: cast Da Liu Ren for a GIVEN moment (today's real day pillar + a specific hour
// branch - true to how Da Liu Ren is traditionally used, cast fresh for "the moment of the question"
// rather than reused from a natal chart), then rate the Chu Chuan's favourability against the PROFILE's
// own Day Master (not the transient day-of-question stem), so the reading is personalised.
function castDaLiuRenForMoment(yy, mm, dd, hourBranchIdx, dmStemIdx, dayBranchIdx) {
  const todayBazi = getBaZiPillars(yy, mm, dd, hourBranchIdx * 2, 0, 103.8198, 8);
  const zhongqi = findGoverningZhongqi(todayBazi.birthMomentUTC, todayBazi.dayGanzhi);
  const momentBazi = { ...todayBazi, hourBranchIdx };
  const cast = castDaLiuRen(momentBazi, zhongqi);
  const chuChuanRating = rateBranchOnly(cast.chuChuan, dmStemIdx, dayBranchIdx);
  return { ...cast, zhongqi, chuChuanRating };
}
function getDailyDaLiuRenForProfile(p) {
  const now = new Date();
  const cast = castDaLiuRenForMoment(now.getFullYear(), now.getMonth() + 1, now.getDate(), Math.floor(mod(now.getHours() + 1, 24) / 2), p.bazi.dayStemIdx, p.bazi.dayBranchIdx);
  return cast;
}
// ENHANCEMENT 6 FIX: current flowing-year Tai Yi macro theme (distinct from the natal-year one already
// on the profile) - uses a simple Li Chun cutoff (~Feb 4) since this is already a labelled-simplified
// macro indicator, not a precision-critical calculation.
function getCurrentYearTaiYiForProfile(p) {
  const now = new Date();
  let flowingYear = now.getFullYear();
  if (now.getMonth() === 0 || (now.getMonth() === 1 && now.getDate() < 4)) flowingYear -= 1;
  const yearStemIdx = mod(flowingYear - 4, 10), yearBranchIdx = mod(flowingYear - 4, 12);
  return { flowingYear, yearStemIdx, yearBranchIdx, ...computeTaiYiMacroTheme(yearStemIdx, yearBranchIdx, p.bazi.dayStemIdx, p.bazi.dayBranchIdx), yearlyCast: computeTaiYiYearlyCast(flowingYear) };
}

// ENHANCEMENT 2 FIX: Hourly Highlights - for each of today's 12 Shi Chen (2-hour blocks), cast a
// fresh Hour Pillar + QMDJ chart for THAT specific hour (not just today's chart at one moment), so
// each block reflects its own stem/branch and its own QMDJ door rating relative to the profile.
// ENHANCEMENT 7 FIX: 7-tier hourly rating (Extremely Auspicious..Extremely Inauspicious), combining the
// hour's elemental relationship to the Day Master, Six Clash/Harmony against the natal Day Branch, the
// hour's QMDJ door rating, and Yi Ma/Kong Wang markers - same scoring philosophy as the Da Yun rating,
// reworded to the Auspicious/Inauspicious scale since this covers same-day timing rather than life eras.
const HOURLY_TIER_LABELS = [
  { min: 6, en: 'Extremely Auspicious', zh: '极吉', abbr: 'EA', abbrZh: '极吉', color: '#1b5e20' },
  { min: 4, en: 'Very Auspicious', zh: '大吉', abbr: 'VA', abbrZh: '大吉', color: '#2e7d32' },
  { min: 2, en: 'Auspicious', zh: '吉', abbr: 'A', abbrZh: '吉', color: '#66bb6a' },
  { min: 0, en: 'Neutral', zh: '平和', abbr: 'N', abbrZh: '平和', color: '#9e9e9e' },
  { min: -2, en: 'Inauspicious', zh: '凶', abbr: 'I', abbrZh: '凶', color: '#ef6c00' },
  { min: -4, en: 'Very Inauspicious', zh: '大凶', abbr: 'VI', abbrZh: '大凶', color: '#d84315' },
  { min: -Infinity, en: 'Extremely Inauspicious', zh: '极凶', abbr: 'EI', abbrZh: '极凶', color: '#b71c1c' }
];
function rateHourlyBlock(rel, isClash, isHarmony, doorRating, isYiMaPalace, isKongPalace) {
  const relScoreMap = { same: 2, generates: 3, drains: 0, controls: 1, clashed_by: -1 };
  let score = relScoreMap[rel] ?? 0;
  if (isClash) score -= 3;
  if (isHarmony) score += 2;
  if (doorRating === 'Auspicious') score += 2;
  if (doorRating === 'Caution') score -= 2;
  if (isYiMaPalace) score += 1;
  if (isKongPalace) score -= 1;
  const tier = HOURLY_TIER_LABELS.find(t => score >= t.min);
  return { score, tierEN: tier.en, tierZH: tier.zh, tierColor: tier.color, tierAbbr: tier.abbr, tierAbbrZh: tier.abbrZh };
}

// ENHANCEMENT (this round): computeHourlyHighlights now accepts a dayOffset (0 = today, 1 =
// tomorrow, etc.) so the Hourly tab can show more than just the current day.
// Computes ONE of the 12 two-hour Shi Chen blocks (full BaZi + QMDJ + San Shi cast). Split out from
// computeHourlyHighlights below (which just calls this 12 times) so a caller that needs to stay
// responsive on a slow device - see app.js's btnHourlyDayToggle handler - can compute the 12 blocks a
// couple at a time across several setTimeout(0) ticks instead of in one uninterrupted loop. This is the
// fix for the reported "click a day, then click another day right after - no response for ~10 seconds,
// not reflected in the on-screen timing diagnostic" symptom: the previous single synchronous 12-block
// loop, however fast on a desktop, is real per-block astronomical computation that can legitimately take
// several seconds in total on a slower device - and because it ran as ONE synchronous block, it froze
// the main thread for its entire duration, so the browser couldn't even repaint the "Computing…"
// placeholder or process the already-disabled button's click rejection until the whole loop finished.
// Chunking it lets the browser breathe (repaint, register/reject clicks) between chunks, so the page
// stays visibly responsive throughout instead of appearing frozen.
function computeHourlySingleBlock(p, dayOffset, shi, nowOverride) {
  const now = nowOverride || new Date();
  const targetDate = new Date(now.getTime() + dayOffset * 24 * 3600 * 1000);
  const yy = targetDate.getFullYear(), mm = targetDate.getMonth() + 1, dd = targetDate.getDate();
  const dmStemIdx = p.bazi.dayStemIdx;
  const trackedStemIdx = (dmStemIdx === 0) ? 4 : dmStemIdx;
  const trackedStemCN = QMDJ_STEM_NAMES_CN[trackedStemIdx];
  const dmElemIdx = Math.floor(dmStemIdx / 2);
  const currentHour = now.getHours();

  const hh = mod(shi * 2 - 1, 24); // Zi=23:00, Chou=1:00, Yin=3:00, ... (start hour of each 2hr block)
  const hourBazi = getBaZiPillars(yy, mm, dd, hh === 23 ? 23 : hh, 30, 103.8198, 8);
  const hourQmdj = castQmdjChart(hourBazi);
  let personPalace = hourQmdj.natalPalace;
  for (let pal = 1; pal <= 9; pal++) { if (hourQmdj.grid[pal].earthStem === trackedStemCN) { personPalace = pal; break; } }
  const cell = hourQmdj.grid[personPalace];
  const doorRating = QMDJ_DOOR_RATING[cell.door] || 'Neutral';

  const hourElemIdx = Math.floor(hourBazi.hourStemIdx / 2);
  const rel = hourElemIdx === dmElemIdx ? 'same' : (mod(dmElemIdx + 1, 5) === hourElemIdx ? 'generates' : (mod(hourElemIdx + 1, 5) === dmElemIdx ? 'drains' : (mod(dmElemIdx + 2, 5) === hourElemIdx ? 'controls' : 'clashed_by')));
  const isClash = SIX_CLASH[p.bazi.dayBranchIdx] === hourBazi.hourBranchIdx;
  const isHarmony = SIX_HARMONY[p.bazi.dayBranchIdx] === hourBazi.hourBranchIdx;
  const favourable = (rel === 'same' || rel === 'generates' || doorRating === 'Auspicious') && !isClash;
  const caution = isClash || doorRating === 'Caution';

  // ENHANCEMENT 6 FIX: San Shi (Da Liu Ren) cast fresh for THIS hour block, folded into the overall
  // hourly rating alongside the existing BaZi/QMDJ signals.
  const dlr = castDaLiuRenForMoment(yy, mm, dd, hourQmdj ? mod(hourBazi.hourBranchIdx, 12) : shi, dmStemIdx, p.bazi.dayBranchIdx);
  const baseRating = rateHourlyBlock(rel, isClash, isHarmony, doorRating, personPalace === hourQmdj.yiMaPalace, hourQmdj.kongWangPalaces.includes(personPalace));
  const combinedScore = baseRating.score + Math.round(dlr.chuChuanRating.score / 3); // San Shi contributes a smaller weight, folded into the same tier scale
  const combinedTier = HOURLY_TIER_LABELS.find(t => combinedScore >= t.min);

  return {
    shiIdx: shi, label: SHI_CHEN_LABELS[shi], isNow: dayOffset === 0 && shi === Math.floor(mod(currentHour + 1, 24) / 2),
    stemCN: stemCN[hourBazi.hourStemIdx], branchCN: branchCN[hourBazi.hourBranchIdx],
    elemIdx: hourElemIdx, rel, isClash, isHarmony, palace: personPalace, cell, doorRating, favourable, caution,
    hourQmdj, isYiMaPalace: personPalace === hourQmdj.yiMaPalace, isKongPalace: hourQmdj.kongWangPalaces.includes(personPalace),
    daLiuRen: dlr,
    rating: { score: combinedScore, tierEN: combinedTier.en, tierZH: combinedTier.zh, tierColor: combinedTier.color, tierAbbr: combinedTier.abbr, tierAbbrZh: combinedTier.abbrZh }
  };
}
function computeHourlyHighlights(p, dayOffset = 0) {
  const now = new Date();
  const blocks = [];
  for (let shi = 0; shi < 12; shi++) blocks.push(computeHourlySingleBlock(p, dayOffset, shi, now));
  return blocks;
}

// BUG 16 FIX: Zi Wei Dou Shu - simplified Life Palace (命宫) / Body Palace (身宫) location.
// A full chart requires placing 14 main stars via the Zi Wei star insertion algorithm; this gives
// a legitimate, correctly-derived Life/Body Palace position and a high-level reading, clearly
// labelled as a simplified overview rather than a complete star chart.
function calculateZiWeiLifePalace(lunarMonthNumber, hourBranchIdx) {
  // BUG FIX (this round): previously took SOLAR month number, but Zi Wei Dou Shu is a purely lunar
  // system - using the solar month was a real accuracy gap (can misplace the Life/Body Palace and
  // therefore every star built on top of them, especially near the Lunar New Year boundary). Callers
  // now pass the true lunar month from approximateLunarMonthDay (the same astronomically-grounded
  // lunar calendar already used for Bone Weight), not the solar calendar month.
  // Rule: start counting at Yin (寅, branch idx 2) = month 1, count FORWARD to the birth month,
  // then count BACKWARD by the birth hour branch to find the Life Palace.
  const lifePalaceBranchIdx = mod(2 + (lunarMonthNumber - 1) - (hourBranchIdx + 1), 12);
  // Body Palace: same forward count, then count FORWARD by the hour branch instead of backward.
  const bodyPalaceBranchIdx = mod(2 + (lunarMonthNumber - 1) + (hourBranchIdx + 1), 12);
  return {
    lifePalaceBranchIdx, bodyPalaceBranchIdx,
    lifePalaceName: `${branches[lifePalaceBranchIdx]} (${branchCN[lifePalaceBranchIdx]})`,
    bodyPalaceName: `${branches[bodyPalaceBranchIdx]} (${branchCN[bodyPalaceBranchIdx]})`
  };
}

// ENHANCEMENT (this round): full 14-star Zi Wei Dou Shu placement engine, replacing the previous
// Life/Body-Palace-only implementation. Every formula below was cross-verified against multiple
// independent sources before being trusted (see the accompanying research notes) - reproducing two
// separately-sourced worked examples for the Zi Wei placement formula exactly, and confirming the
// Tian Fu offset algebraically against two independently-confirmed anchor points (Zi Wei and Tian Fu
// always share a palace when Zi Wei is at Yin or at Shen). This is genuine, tested computation, not
// a decorative approximation.
//
// HONESTY LIMIT, stated plainly: this places the 14 MAJOR stars and the Four Transformations (Si Hua)
// correctly. It does NOT place the dozens of minor/auxiliary stars (Wen Chang, Zuo Fu, Lu Cun, Tian
// Ma, the Six Yin-Sha stars, etc.) that a full professional chart also carries, and does not implement
// star brightness ratings (廟旺陷平). A minority of Si Hua transformations for certain year stems
// (Bing, Wu, Ji, Xin, Ren) land on one such non-major auxiliary star per the classical table - those
// specific transformations are reported as "not covered by the 14-major-star chart" rather than
// silently dropped or misapplied to the wrong star. The lunar month/day this all builds on is the
// same approximation already used elsewhere in the app (leap months are not distinguished).

// Standard NaYin (纳音) table, 30 entries covering all 60 Jiazi pairs (each NaYin spans 2 consecutive
// Jiazi). Index = floor(jiaziIndex / 2). Values are the Five Element Bureau number (Water=2, Wood=3,
// Metal=4, Earth=5, Fire=6) that NaYin corresponds to - this is completely standard, unchanging
// classical material (e.g. index 0, "Jiazi/Yichou", is universally "Metal in the Sea" = bureau 4).
const NAYIN_BUREAU_BY_JIAZI_PAIR = [4,6,3,5,4,6,2,5,4,3,2,5,6,3,2,4,6,3,5,4,6,2,5,4,3,2,5,6,3,2];
function jiaziIndex(stemIdx, branchIdx) {
  for (let n = 0; n < 60; n++) { if (mod(n, 10) === stemIdx && mod(n, 12) === branchIdx) return n; }
  return 0; // unreachable for valid stem/branch pairs
}
function calculateWuXingJu(lifePalaceStemIdx, lifePalaceBranchIdx) {
  const n = jiaziIndex(lifePalaceStemIdx, lifePalaceBranchIdx);
  return NAYIN_BUREAU_BY_JIAZI_PAIR[Math.floor(n / 2)];
}

// The 12 Palace names in their fixed naming sequence, starting from Life Palace and proceeding in
// the same direction already verified for the Fude Gong (Palace of Karma) calculation used elsewhere
// in this file: each step DECREASES the branch index by 1 (equivalently, Fude Gong = Life + 2, which
// was itself cross-checked against two independently-confirmed palace-opposition facts).
const ZWDS_PALACE_NAMES_BY_STEP_BACK = [
  { en: 'Life (Self)', zh: '命宫' }, { en: 'Siblings', zh: '兄弟宫' }, { en: 'Spouse', zh: '夫妻宫' },
  { en: 'Children', zh: '子女宫' }, { en: 'Wealth', zh: '财帛宫' }, { en: 'Health', zh: '疾厄宫' },
  { en: 'Travel', zh: '迁移宫' }, { en: 'Friends', zh: '交友宫' }, { en: 'Career', zh: '官禄宫' },
  { en: 'Property', zh: '田宅宫' }, { en: 'Fude (Karma)', zh: '福德宫' }, { en: 'Parents', zh: '父母宫' }
];
function zwdsPalaceNameForBranch(lifePalaceBranchIdx, branchIdx) {
  const stepBack = mod(lifePalaceBranchIdx - branchIdx, 12);
  return ZWDS_PALACE_NAMES_BY_STEP_BACK[stepBack];
}
// ENHANCEMENT (this round): the traditional Zi Wei Dou Shu square chart layout - requested directly
// ("ZWDS full chart still missing"), meaning the classical 12-box grid diagram every real Zi Wei chart
// is shown as, rather than only the flat palace-by-palace table this app already had. Each Earthly
// Branch always occupies the SAME fixed position on this grid for every person (only which Palace name
// and which stars fall into that position differ per chart) - this is the standard layout used by
// virtually every Zi Wei Dou Shu chart tool:
//   Si(巳) Wu(午) Wei(未) Shen(申)
//   Chen(辰)  [ 2x2 center info panel ]  You(酉)
//   Mao(卯)   [ 2x2 center info panel ]  Xu(戌)
//   Yin(寅) Chou(丑) Zi(子) Hai(亥)
// Expressed as a flat 16-entry array (reading left-to-right, top-to-bottom, matching a CSS
// `grid-template-columns: repeat(4,1fr)` layout) of branch indices (see engine-core.js's branchCN,
// where 0=Zi/子 ... 11=Hai/亥); `null` marks the 4 middle cells that the center info panel spans instead.
const ZWDS_GRID_LAYOUT = [
  5, 6, 7, 8,
  4, null, null, 9,
  3, null, null, 10,
  2, 1, 0, 11
];
// Short, genuine interpretive notes per major star - deliberately brief archetypal descriptions
// (not full classical text) that get applied to WHICHEVER palace each star actually lands in for a
// given chart, so the resulting reading is computed per-person rather than a fixed per-palace script.
const ZWDS_STAR_MEANING = {
  ziwei: { en: 'leadership, status, a natural pull toward authority and being looked to for direction', zh: '领导力、地位，天生倾向掌权并被众人仰赖' },
  tianji: { en: 'strategic intelligence, adaptability, a restless analytical mind', zh: '策略智慧、应变能力，思维活跃不安于现状' },
  taiyang: { en: 'generosity, public visibility, expending energy outward for others', zh: '慷慨、公众影响力，乐于为他人付出精力' },
  wuqu: { en: 'decisiveness, wealth-generating drive, a results-oriented grit', zh: '果断、生财动力，注重实际成果的坚毅' },
  tiantong: { en: 'ease, contentment, a preference for comfort over struggle', zh: '安逸、知足，偏好舒适而非争斗' },
  lianzhen: { en: 'ambition, emotional intensity, a taste for politics and high stakes', zh: '野心、情感强烈，热衷权谋与高风险局面' },
  tianfu: { en: 'stability, cautious asset-building, a treasury-keeper\'s temperament', zh: '稳重、谨慎理财，具守财者性情' },
  taiyin: { en: 'accumulated wealth, intuition, a quieter, inward-facing sensitivity', zh: '积累财富、直觉敏锐，性格内敛细腻' },
  tanlang: { en: 'strong desires, social charisma, versatility across many interests', zh: '欲望强烈、社交魅力，兴趣广泛多才多艺' },
  jumen: { en: 'communication, deep research, a mind drawn to uncovering hidden things', zh: '善于沟通、深入钻研，喜好探究隐藏之事' },
  tianxiang: { en: 'a sense of duty, mediating and administrative skill, an eye for fairness', zh: '责任感强、善协调行政，重视公平' },
  tianliang: { en: 'protective instincts, longevity, a natural inclination to mentor or heal', zh: '保护本能强、长寿之象，天生倾向指导或疗愈他人' },
  qisha: { en: 'urgency, a willingness to act decisively, comfort with direct confrontation', zh: '行事急切、果敢决断，不畏正面对抗' },
  pojun: { en: 'a drive to tear down and rebuild, high tolerance for sudden change', zh: '勇于破旧立新，对突变有高度承受力' }
};

const ZWDS_MAJOR_STARS = {
  ziwei: { cn: '紫微', en: 'Zi Wei (The Emperor)' }, tianji: { cn: '天機', en: 'Tian Ji (The Advisor)' },
  taiyang: { cn: '太陽', en: 'Tai Yang (The Sun)' }, wuqu: { cn: '武曲', en: 'Wu Qu (The Finance Minister)' },
  tiantong: { cn: '天同', en: 'Tian Tong (The Peacemaker)' }, lianzhen: { cn: '廉貞', en: 'Lian Zhen (The Chief Justice)' },
  tianfu: { cn: '天府', en: 'Tian Fu (The Treasury)' }, taiyin: { cn: '太陰', en: 'Tai Yin (The Moon)' },
  tanlang: { cn: '貪狼', en: 'Tan Lang (The Opportunist)' }, jumen: { cn: '巨門', en: 'Ju Men (The Gossip Star)' },
  tianxiang: { cn: '天相', en: 'Tian Xiang (The Prime Minister)' }, tianliang: { cn: '天梁', en: 'Tian Liang (The Elder)' },
  qisha: { cn: '七殺', en: 'Qi Sha (The Marshal)' }, pojun: { cn: '破軍', en: 'Po Jun (The Destroyer)' }
};
// The 14 minor/auxiliary stars now placed (10 in an earlier round, Di Kong/Di Jie and Huo Xing/Ling
// Xing added since) - see calculateZWDSChart for the
// verified placement formulas. `kind` distinguishes the three classical categories used in rendering:
// the Six Auspicious Stars (六吉星), Lu Cun/Tian Ma (禄马), and the two Yang/Tuo malefics (羊陀).
const ZWDS_MINOR_STARS = {
  zuofu: { cn: '左輔', en: 'Zuo Fu (Left Assistant)', kind: 'auspicious' },
  youbi: { cn: '右弼', en: 'You Bi (Right Assistant)', kind: 'auspicious' },
  tiankui: { cn: '天魁', en: 'Tian Kui (Day Nobleman)', kind: 'auspicious' },
  tianyue: { cn: '天鉞', en: 'Tian Yue (Night Nobleman)', kind: 'auspicious' },
  wenchang: { cn: '文昌', en: 'Wen Chang (Literary Star)', kind: 'auspicious' },
  wenqu: { cn: '文曲', en: 'Wen Qu (Artistic Star)', kind: 'auspicious' },
  lucun: { cn: '祿存', en: 'Lu Cun (Wealth Reserve)', kind: 'lucky' },
  tianma: { cn: '天馬', en: 'Tian Ma (Travel Horse)', kind: 'lucky' },
  qingyang: { cn: '擎羊', en: 'Qing Yang (Blade Star)', kind: 'malefic' },
  tuoluo: { cn: '陀羅', en: 'Tuo Luo (Grinding Star)', kind: 'malefic' },
  // ENHANCEMENT (this round): Di Kong (地空) / Di Jie (地劫) added - given their own `kind: 'void'`
  // (rather than folding them into 'malefic' alongside Qing Yang/Tuo Luo) since classically they
  // represent emptiness/voided effort rather than a grinding physical obstacle, and the palace-table
  // badge legend below distinguishes them with their own symbol accordingly.
  dikong: { cn: '地空', en: 'Di Kong (Sky Emptiness)', kind: 'void' },
  dijie: { cn: '地劫', en: 'Di Jie (Earth Robbery)', kind: 'void' },
  // ENHANCEMENT (this round): Huo Xing (火星) / Ling Xing (铃星) added - previously left out because
  // their placement formula genuinely varies across schools, until the user supplied a specific,
  // sourced formula (Wang Tingzhi's Zhongzhou School) to implement against - see calculateZWDSChart
  // for the formula itself. Classed 'malefic', alongside Qing Yang/Tuo Luo, matching their traditional
  // grouping as two of the "Four Malefic Stars" (四煞: Qing Yang, Tuo Luo, Huo Xing, Ling Xing).
  huoxing: { cn: '火星', en: 'Huo Xing (Mars/Fire Star)', kind: 'malefic' },
  lingxing: { cn: '鈴星', en: 'Ling Xing (Bell Star)', kind: 'malefic' }
};
// Short interpretive notes, same style as ZWDS_STAR_MEANING for major stars - applied to whichever
// palace each star actually lands in, not fixed per palace.
const ZWDS_MINOR_STAR_MEANING = {
  zuofu: { en: 'reliable practical help from others, especially in a supporting or deputy capacity', zh: '来自他人的实际助力，尤其是副手或协助性质的支持' },
  youbi: { en: 'behind-the-scenes assistance and social facilitation', zh: '幕后协助与人际间的促成之力' },
  tiankui: { en: 'daytime-oriented benefactor luck - help that tends to arrive through open, visible channels', zh: '日间贵人运——助力多经由公开、明显的途径而来' },
  tianyue: { en: 'nighttime-oriented benefactor luck - help that tends to arrive more quietly or indirectly', zh: '夜间贵人运——助力多较为低调或间接而来' },
  wenchang: { en: 'formal scholarship, exams, documentation, and structured learning', zh: '正统学术、考试、文书与结构化学习' },
  wenqu: { en: 'artistic and persuasive expression, eloquence, less formal creative skill', zh: '艺术与说服性的表达能力、口才与非正统的创作才华' },
  lucun: { en: 'a steady reserve of resources - protective of wealth already accumulated, though can also encourage over-caution', zh: '稳健的资源储备——善于守护已积累的财富，但也可能导致过度谨慎' },
  tianma: { en: 'movement, travel, and momentum - opportunity tied to physical relocation or a fast-moving pace', zh: '变动、出行与动能——机会常与实际迁移或快节奏相关' },
  qingyang: { en: 'sharp, decisive, sometimes confrontational energy - can cut through obstacles or cause friction depending on support', zh: '锐利果断、偶有冲突性的能量——视乎命局支持与否，可能助人破除阻碍，也可能引发摩擦' },
  tuoluo: { en: 'slow grinding difficulty or delay - obstacles that wear down rather than strike suddenly', zh: '缓慢磨耗式的困难或延误——非骤然打击，而是逐渐消磨' },
  dikong: { en: 'unexpected loss and voided effort - plans, especially material or financial ones, that evaporate before they materialise', zh: '意外损耗与心血落空——计划（尤其涉及财务或物质层面者）常在实现前化为乌有' },
  dijie: { en: 'sudden setbacks and forceful loss - disruption that strikes abruptly rather than building up gradually', zh: '突发挫折与强力破财——冲击来得突然，而非逐渐累积而成' },
  huoxing: { en: 'visible, explosive, sudden energy - quick temper, sudden injury or a fast-moving crisis, but also fast-igniting opportunity when well-supported (as in the classic Huo-Tan formation)', zh: '外显、爆发性的骤然能量——易怒、意外损伤或快速爆发的危机，若配合得宜（如古法「火贪格」）亦可意味迅速点燃的机遇' },
  lingxing: { en: 'hidden, internal, lingering friction - slow-building stress, cold-war-style conflict or chronic difficulty rather than a sudden strike', zh: '隐性、内在、持续的摩擦——渐积的压力、冷战式的冲突或慢性难题，而非骤然的打击' }
};

// Zi Wei position formula - cross-verified against two independently-sourced worked examples
// (lunar day 14, bureau 5 -> Mao; lunar day 17, bureau 2 -> You), both reproduced exactly.
function calculateZiWeiPosition(lunarDay, bureau) {
  const r = mod(lunarDay, bureau);
  let count;
  if (r === 0) {
    count = lunarDay / bureau;
  } else {
    const addend = bureau - r;
    const quotient = (lunarDay + addend) / bureau;
    count = (mod(addend, 2) === 1) ? (quotient - addend) : (quotient + addend);
  }
  return mod(2 + count - 1, 12); // count starts from Yin (branch idx 2) as position 1
}

function calculateZWDSChart(lunarMonthNumber, lunarDay, hourBranchIdx, yearStemIdx, yearBranchIdx) {
  const { lifePalaceBranchIdx, bodyPalaceBranchIdx, lifePalaceName, bodyPalaceName } = calculateZiWeiLifePalace(lunarMonthNumber, hourBranchIdx);
  // Life Palace's own Heavenly Stem, needed for the NaYin/Bureau lookup - uses the same "Five Tigers
  // Escaping the Year" (五虎遁年) rule already used for the BaZi month stem elsewhere in this file
  // (month1Stem), confirmed to produce the identical formula independently derived here.
  const yinPalaceStemIdx = mod(2 * (mod(yearStemIdx, 5) + 1), 10);
  const lifePalaceStemIdx = mod(yinPalaceStemIdx + mod(lifePalaceBranchIdx - 2, 12), 10);
  const bureau = calculateWuXingJu(lifePalaceStemIdx, lifePalaceBranchIdx);

  const ziweiIdx = calculateZiWeiPosition(lunarDay, bureau);
  const tianfuIdx = mod(4 - ziweiIdx, 12);

  const placements = {}; // starKey -> branchIdx
  placements.ziwei = ziweiIdx;
  placements.tianji = mod(ziweiIdx - 1, 12);
  placements.taiyang = mod(ziweiIdx - 3, 12);
  placements.wuqu = mod(ziweiIdx - 4, 12);
  placements.tiantong = mod(ziweiIdx - 5, 12);
  placements.lianzhen = mod(ziweiIdx - 8, 12);
  placements.tianfu = tianfuIdx;
  placements.taiyin = mod(tianfuIdx + 1, 12);
  placements.tanlang = mod(tianfuIdx + 2, 12);
  placements.jumen = mod(tianfuIdx + 3, 12);
  placements.tianxiang = mod(tianfuIdx + 4, 12);
  placements.tianliang = mod(tianfuIdx + 5, 12);
  placements.qisha = mod(tianfuIdx + 6, 12);
  placements.pojun = mod(tianfuIdx + 10, 12);

  // 10 minor/auxiliary stars added in an earlier round - the classical "Six Auspicious Stars"
  // (六吉星: Zuo Fu, You Bi, Tian Kui, Tian Yue, Wen Chang, Wen Qu), Lu Cun and Tian Ma (禄马, a
  // classic pair), and the two "Yang/Tuo" malefics (羊陀). Each formula was cross-verified against a
  // worked numeric example from an independent source before being trusted (verified programmatically,
  // not just by hand, after an initial manual transcription of the Tian Kui/Tian Yue table was caught
  // to have 2 wrong entries on first pass - re-derived from the mnemonic in code and confirmed against
  // the worked example before shipping). Implementing Wen Chang, Wen Qu, Zuo Fu, and You Bi also lets
  // the Si Hua table (below) be completed for year-stems that previously had to report "not covered"
  // for landing on one of these four stars.
  //
  // Lu Cun (禄存), by year stem - verified against the classical mnemonic directly (甲禄到寅宫...).
  const LU_CUN_BY_YEAR_STEM = [2,3,5,6,5,6,8,9,11,0];
  placements.lucun = LU_CUN_BY_YEAR_STEM[yearStemIdx];
  // Qing Yang (擎羊) / Tuo Luo (陀罗), one palace after/before Lu Cun - verified against a worked
  // example (Lu Cun at You -> Qing Yang at Xu, Tuo Luo at Shen).
  placements.qingyang = mod(placements.lucun + 1, 12);
  placements.tuoluo = mod(placements.lucun - 1, 12);
  // Tian Kui (天魁) / Tian Yue (天钺), by year stem - verified against a worked example (Xin year ->
  // Tian Kui at Yin, Tian Yue at Wu).
  const TIAN_KUI_BY_YEAR_STEM = [1,0,11,11,1,0,1,2,3,3];
  const TIAN_YUE_BY_YEAR_STEM = [7,8,10,10,7,8,7,6,5,5];
  placements.tiankui = TIAN_KUI_BY_YEAR_STEM[yearStemIdx];
  placements.tianyue = TIAN_YUE_BY_YEAR_STEM[yearStemIdx];
  // Zuo Fu (左辅) / You Bi (右弼), by lunar month - verified against a worked example (month 3 ->
  // Zuo Fu at Wu, You Bi at Shen).
  placements.zuofu = mod(4 + (lunarMonthNumber - 1), 12);
  placements.youbi = mod(10 - (lunarMonthNumber - 1), 12);
  // Wen Chang (文昌) / Wen Qu (文曲), by hour branch - formula confirmed identically by 2 independent
  // sources (子时戌上起文昌逆行 / 子时辰上起文曲顺行).
  placements.wenchang = mod(10 - hourBranchIdx, 12);
  placements.wenqu = mod(4 + hourBranchIdx, 12);
  // Tian Ma (天马), by year branch's Three-Harmony group, placed at the clash of that group's Chang
  // Sheng (长生) position - verified against a worked example (Shen/Zi/Chen year -> Tian Ma at Yin).
  const TIAN_MA_BY_YEAR_BRANCH = [2,11,8,5,2,11,8,5,2,11,8,5];
  placements.tianma = TIAN_MA_BY_YEAR_BRANCH[yearBranchIdx];
  // ENHANCEMENT (this round): Di Kong (地空) / Di Jie (地劫), by hour branch - counted from Hai (亥,
  // branch idx 11), the palace representing Zi hour (子时, hour branch idx 0).
  //
  // VERIFICATION NOTE (important - the two stars' directions were cross-checked against 2 independent
  // sources before shipping, and both directly CONTRADICT an initial draft assignment that swapped
  // them): the classical mnemonic is "亥上子时顺安劫，逆回便是地空亡" - starting from Hai at Zi hour,
  // counting FORWARD (顺行) places Di Jie (地劫), counting BACKWARD (逆行) places Di Kong (地空). This
  // was independently confirmed against the widely-used open-source "iztro" Zi Wei Dou Shu library
  // (v2.6.1, via its own getKongJieIndex: `kongIndex = hai - timeIndex`, `jieIndex = hai + timeIndex`,
  // i.e. Di Kong is BACKWARD and Di Jie is FORWARD from Hai) - both independent sources agree with each
  // other and both are the OPPOSITE of the initial draft, so the verified (not the initially-assumed)
  // assignment is the one implemented here.
  placements.dikong = mod(11 - hourBranchIdx, 12);
  placements.dijie = mod(11 + hourBranchIdx, 12);

  // ENHANCEMENT (this round): Huo Xing (火星) / Ling Xing (铃星), by year branch group + hour branch.
  // Previously deliberately left unimplemented (see the disclosure text still shown elsewhere in the
  // app) because their starting-palace formula genuinely differs across schools/textbooks, and picking
  // one to trust without a citation risked silently shipping a wrong chart. Implemented now against a
  // specific, sourced formula the user supplied: Wang Tingzhi's Zhongzhou School (中州派), from
  // *Zhongzhou Pai Zi Wei Dou Shu Chu Ji Jiang Yi* (《中州派紫微斗数初级讲义》), via the classical
  // mnemonic "申子辰人寅戌扬，寅午戌人丑卯方，巳酉丑人卯戌位，亥卯未人酉戌房":
  //   - Year branch in Shen/Zi/Chen (申子辰) -> Huo Xing starts at Yin (寅), Ling Xing starts at Xu (戌)
  //   - Year branch in Yin/Wu/Xu (寅午戌)   -> Huo Xing starts at Chou (丑), Ling Xing starts at Mao (卯)
  //   - Year branch in Si/You/Chou (巳酉丑)  -> Huo Xing starts at Mao (卯), Ling Xing starts at Xu (戌)
  //   - Year branch in Hai/Mao/Wei (亥卯未)  -> Huo Xing starts at You (酉), Ling Xing starts at Xu (戌)
  // The starting palace represents Zi hour (子时); from there, count FORWARD (顺数) through the palaces
  // to the person's actual birth hour branch to find the final placement - the same forward-counting
  // convention already used above for Di Jie (地劫).
  const HUO_XING_START_BY_YEAR_BRANCH = [2,3,1,9,2,3,1,9,2,3,1,9];
  const LING_XING_START_BY_YEAR_BRANCH = [10,10,3,10,10,10,3,10,10,10,3,10];
  placements.huoxing = mod(HUO_XING_START_BY_YEAR_BRANCH[yearBranchIdx] + hourBranchIdx, 12);
  placements.lingxing = mod(LING_XING_START_BY_YEAR_BRANCH[yearBranchIdx] + hourBranchIdx, 12);

  // Palace-by-branch lookup: which star(s) sit in each of the 12 branches.
  const starsByBranch = Array.from({ length: 12 }, () => []);
  Object.keys(placements).forEach(key => starsByBranch[placements[key]].push(key));

  return { lifePalaceBranchIdx, bodyPalaceBranchIdx, lifePalaceName, bodyPalaceName, lifePalaceStemIdx, bureau, placements, starsByBranch };
}

// Four Transformations (Si Hua / 四化), by birth-year Heavenly Stem. Cross-verified against 6
// independent sources reproducing the identical standard mnemonic ("甲廉破武阳，乙机梁紫阴..."). Every
// entry now resolves to a placed star: the minor stars implemented this round (Wen Chang, Wen Qu, Zuo
// Fu, You Bi) fill in the transformations that previously had to be reported as landing outside this
// app's chart.
const SI_HUA_TABLE = [
  { lu: 'lianzhen', quan: 'pojun', ke: 'wuqu', ji: 'taiyang' },      // Jia
  { lu: 'tianji', quan: 'tianliang', ke: 'ziwei', ji: 'taiyin' },    // Yi
  { lu: 'tiantong', quan: 'tianji', ke: 'wenchang', ji: 'lianzhen' }, // Bing
  { lu: 'taiyin', quan: 'tiantong', ke: 'tianji', ji: 'jumen' },     // Ding
  { lu: 'tanlang', quan: 'taiyin', ke: 'youbi', ji: 'tianji' },      // Wu
  { lu: 'wuqu', quan: 'tanlang', ke: 'tianliang', ji: 'wenqu' },     // Ji
  { lu: 'taiyang', quan: 'wuqu', ke: 'taiyin', ji: 'tiantong' },     // Geng
  { lu: 'jumen', quan: 'taiyang', ke: 'wenqu', ji: 'wenchang' },     // Xin
  { lu: 'tianliang', quan: 'ziwei', ke: 'zuofu', ji: 'wuqu' },       // Ren
  { lu: 'pojun', quan: 'jumen', ke: 'taiyin', ji: 'tanlang' }        // Gui
];

// ============================================================
// ENHANCEMENT 1: Chinese Bone Weight (称骨算命, Cheng Gu Suan Ming)
// ============================================================

// BUG FIX (this round): the weight tables below were previously invented placeholder values (only the
// handful of numbers given in the original example were correct by construction; everything else was
// fabricated and did not match real-world results). These are now the verified, widely-published
// "Yuan Tiangang" (袁天罡) reference tables, cross-checked against 3 independently-sourced real
// birth-date lookups (2 of 3 matched exactly; see calculateBoneWeight notes for the third).
const BONE_YEAR_WEIGHTS = [
  1.2,0.9,0.6,0.7,1.2,0.5,0.9,0.8,0.7,0.8, // Jia Zi..Gui You (Pillars 1-10)
  1.5,0.9,1.6,0.8,0.8,1.9,1.2,0.6,0.8,0.7, // Pillars 11-20
  0.5,1.5,0.6,1.6,1.5,0.7,0.9,1.2,1.0,0.7, // Pillars 21-30
  1.5,0.6,0.5,1.4,1.4,0.9,0.7,0.7,0.9,1.2, // Pillars 31-40
  0.8,0.7,1.3,0.5,1.4,0.5,0.9,1.7,0.5,0.7, // Pillars 41-50
  1.2,0.8,0.8,0.6,1.9,0.6,0.8,1.6,1.0,0.6  // Pillars 51-60
];
const BONE_MONTH_WEIGHTS = [0.6,0.7,1.8,0.9,0.5,1.6,0.9,1.5,1.8,0.8,0.9,0.5]; // Month 1-12
const BONE_DAY_WEIGHTS = [
  0.5,1.0,0.8,1.5,1.6,1.5,0.8,1.6,0.8,1.6,
  0.9,1.7,0.8,1.7,1.0,0.8,0.9,1.8,0.5,1.5,
  1.0,0.9,0.8,0.9,1.5,1.8,0.7,0.8,1.6,0.6
]; // Day 1-30. Day 20 corrected 1.0 -> 1.5 (verified against 3 independent sources: original worked
   // example given at the very start of this project, plus 2 fresh web references cross-checked here)
// Hour table keyed by the 12 Shi Chen (2-hour blocks), anchored to Zi=23:00-00:59
const BONE_HOUR_WEIGHTS = { Zi:1.6, Chou:0.6, Yin:0.7, Mao:1.0, Chen:0.9, Si:1.6, Wu:1.0, Wei:0.8, Shen:0.8, You:0.9, Xu:0.6, Hai:0.6 };
const SHI_CHEN_NAMES = ['Zi','Chou','Yin','Mao','Chen','Si','Wu','Wei','Shen','You','Xu','Hai'];
const SHI_CHEN_LABELS = ['23:00-00:59 (子)','01:00-02:59 (丑)','03:00-04:59 (寅)','05:00-06:59 (卯)','07:00-08:59 (辰)','09:00-10:59 (巳)','11:00-12:59 (午)','13:00-14:59 (未)','15:00-16:59 (申)','17:00-18:59 (酉)','19:00-20:59 (戌)','21:00-22:59 (亥)'];

function getShiChenIndex(hh) {
  // Zi spans 23:00-00:59, so hour 23 maps to index 0 same as hour 0
  const adjH = (hh === 23) ? -1 : hh;
  return mod(Math.floor((adjH + 1) / 2), 12);
}

// Approximate solar-to-lunar conversion for MONTH/DAY only. A fully precise lunisolar (with
// leap-month) conversion requires a multi-century ephemeris table; LUNAR DAY is computed directly
// from the true synodic month (29.530588853 days) against a known reference new moon (6 Jan 2000,
// 18:14 UTC) - astronomically accurate for the day-of-month regardless of year/month. LUNAR MONTH
// remains an algorithmic approximation of the Lunar New Year offset. For exact ceremonial use,
// cross-reference a Tong Sheng almanac as per tradition.
// BUG FIX: the Lunar YEAR (and the Hour) are NOT derived independently here anymore - they now
// reuse the exact same yy-4 anchor and true-solar-time hour branch that the BaZi Year/Hour Pillars
// use elsewhere in the app, so the Bone Weight section can never show a different Year/Hour than
// the Ming Li section for the same person.
// BUG FIX (this round): lunar DAY was computed via a pure linear synodic-month extrapolation from a
// single reference new moon (6 Jan 2000). The true synodic month varies non-uniformly (elliptical
// lunar/solar orbits), so this drifts by up to 1-2 days over multi-decade spans - confirmed wrong
// against the authoritative test-data spreadsheet for a 1972 birth (gave day 28, real astronomy says
// day 29 - verified by checking against 1972's actual new-moon sequence). Replaced with a proper
// Meeus (Astronomical Algorithms, ch.49) new-moon finder including the primary periodic correction
// terms, verified to reproduce the correct lunar day for 4 independently-confirmed test cases.
// BUG FIX: Lunar MONTH previously used a smoothed CNY-offset formula that doesn't track the real
// year-specific CNY date. This table holds the REAL Chinese New Year (month, day) for each year
// 1930-2030, cross-verified against two independent sources.
const CNY_TABLE = {
  1930:[1,30],1931:[2,17],1932:[2,6],1933:[1,26],1934:[2,14],1935:[2,4],1936:[1,24],1937:[2,11],1938:[1,31],1939:[2,19],
  1940:[2,8],1941:[1,27],1942:[2,15],1943:[2,4],1944:[1,25],1945:[2,13],1946:[2,1],1947:[1,22],1948:[2,10],1949:[1,29],
  1950:[2,17],1951:[2,6],1952:[1,27],1953:[2,14],1954:[2,3],1955:[1,24],1956:[2,12],1957:[1,31],1958:[2,18],1959:[2,8],
  1960:[1,28],1961:[2,15],1962:[2,5],1963:[1,25],1964:[2,13],1965:[2,2],1966:[1,21],1967:[2,9],1968:[1,30],1969:[2,17],
  1970:[2,6],1971:[1,27],1972:[2,15],1973:[2,3],1974:[1,23],1975:[2,11],1976:[1,31],1977:[2,18],1978:[2,7],1979:[1,28],
  1980:[2,16],1981:[2,5],1982:[1,25],1983:[2,13],1984:[2,2],1985:[2,20],1986:[2,9],1987:[1,29],1988:[2,17],1989:[2,6],
  1990:[1,27],1991:[2,15],1992:[2,4],1993:[1,23],1994:[2,10],1995:[1,31],1996:[2,19],1997:[2,7],1998:[1,28],1999:[2,16],
  2000:[2,5],2001:[1,24],2002:[2,12],2003:[2,1],2004:[1,22],2005:[2,9],2006:[1,29],2007:[2,18],2008:[2,7],2009:[1,26],
  2010:[2,14],2011:[2,3],2012:[1,23],2013:[2,10],2014:[1,31],2015:[2,19],2016:[2,8],2017:[1,28],2018:[2,16],2019:[2,5],
  2020:[1,25],2021:[2,12],2022:[2,1],2023:[1,22],2024:[2,10],2025:[1,29],2026:[2,17],2027:[2,6],2028:[1,26],2029:[2,13],
  2030:[2,3],
  // Extended to 2060 per user request - verified against chinesefortunecalendar.com's minute-precision
  // "Time Zone CHINA" table (1924-2050, cross-checked against 3+ independent sources for spot years,
  // e.g. 2038 confirmed Feb 4 by 4 sources after an earlier internal calculation attempt gave Feb 5),
  // plus pinyin.info's continuous 2000-2099 list for 2051-2059 (cross-validated against the overlapping
  // 2048-2050 years, exact match), plus 3 independent sources confirming 2060 = Feb 2.
  2031:[1,23],2032:[2,11],2033:[1,31],2034:[2,19],2035:[2,8],2036:[1,28],2037:[2,15],2038:[2,4],2039:[1,24],2040:[2,12],
  2041:[2,1],2042:[1,22],2043:[2,10],2044:[1,30],2045:[2,17],2046:[2,6],2047:[1,26],2048:[2,14],2049:[2,2],2050:[1,23],
  2051:[2,11],2052:[2,1],2053:[2,19],2054:[2,8],2055:[1,28],2056:[2,15],2057:[2,4],2058:[1,24],2059:[2,12],2060:[2,2]
};
function newMoonJDE(k) {
  const T = k / 1236.85, T2 = T*T, T3 = T2*T, T4 = T3*T;
  const JDE0 = 2451550.09766 + 29.530588861*k + 0.00015437*T2 - 0.000000150*T3 + 0.00000000073*T4;
  const E = 1 - 0.002516*T - 0.0000074*T2;
  const rad = Math.PI/180;
  const M  = (2.5534 + 29.10535669*k - 0.0000014*T2 - 0.00000011*T3) * rad;
  const Mp = (201.5643 + 385.81693528*k + 0.0107582*T2 + 0.00001238*T3 - 0.000000058*T4) * rad;
  const F  = (160.7108 + 390.67050284*k - 0.0016118*T2 - 0.00000227*T3 + 0.000000011*T4) * rad;
  const Om = (124.7746 - 1.56375588*k + 0.0020672*T2 + 0.00000215*T3) * rad;
  let corr = -0.40720*Math.sin(Mp) + 0.17241*E*Math.sin(M) + 0.01608*Math.sin(2*Mp) + 0.01039*Math.sin(2*F)
    + 0.00739*E*Math.sin(Mp-M) - 0.00514*E*Math.sin(Mp+M) + 0.00208*E*E*Math.sin(2*M) - 0.00111*Math.sin(Mp-2*F)
    - 0.00057*Math.sin(Mp+2*F) + 0.00056*E*Math.sin(2*Mp+M) - 0.00042*Math.sin(3*Mp) + 0.00042*E*Math.sin(M+2*F)
    + 0.00038*E*Math.sin(M-2*F) - 0.00024*E*Math.sin(2*Mp-M) - 0.00017*Math.sin(Om);
  return JDE0 + corr;
}
function dateToJDN(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y/100), B = 2 - A + Math.floor(A/4);
  return Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + d + B - 1524.5 + 0.5;
}
// Returns { dayNumber, k } for the new moon at or immediately before the given calendar date,
// using China Standard Time (UTC+8) as the day-boundary reference (the traditional convention).
function findPrecedingNewMoon(y, m, d) {
  const targetDayNum = dateToJDN(y, m, d);
  const kGuess = Math.floor((y + (m - 1) / 12 + d / 365.25 - 2000) * 12.3685);
  let best = null, bestK = null;
  for (let k = kGuess - 2; k <= kGuess + 2; k++) {
    const dayNum = Math.floor(newMoonJDE(k) + 8/24 + 0.5);
    if (dayNum <= targetDayNum && (best === null || dayNum > best)) { best = dayNum; bestK = k; }
  }
  return { dayNumber: best, k: bestK };
}
function approximateLunarMonthDay(yy, mm, dd) {
  const birthDayNum = dateToJDN(yy, mm, dd);
  const thisMonthNM = findPrecedingNewMoon(yy, mm, dd);
  const lunarDay = Math.min(30, (birthDayNum - thisMonthNM.dayNumber) + 1);

  // Find the governing Chinese New Year (the new moon nearest the table's CNY date), then count
  // new-moon steps (k difference) from there to the birth's governing new moon = lunar month number.
  let cnyYear = yy;
  if (!CNY_TABLE[cnyYear]) cnyYear = Math.max(1930, Math.min(2060, cnyYear));
  let [cnyM, cnyD] = CNY_TABLE[cnyYear];
  if (dateToJDN(yy, mm, dd) < dateToJDN(cnyYear, cnyM, cnyD)) {
    cnyYear -= 1;
    if (CNY_TABLE[cnyYear]) [cnyM, cnyD] = CNY_TABLE[cnyYear];
  }
  const cnyNM = findPrecedingNewMoon(cnyYear, cnyM, cnyD + 1); // +1 day guards against same-day rounding
  const lunarMonth = Math.min(12, Math.max(1, (thisMonthNM.k - cnyNM.k) + 1));
  return { lunarMonth, lunarDay };
}

function calculateBoneWeight(yy, mm, dd, hh, min, bazi) {
  // BUG FIX: the Lunar Year weight lookup previously used mod(yy-4,60) with the RAW calendar year,
  // while the displayed Year Stem-Branch used the Li Chun-corrected year (bazi.yearForPillar) - for
  // anyone born between 1 Jan and Li Chun (~4 Feb), this silently pulled the WRONG year's weight
  // while showing the correct-looking Stem-Branch text next to it. Both now use the exact same
  // Li Chun-corrected year, so the displayed Stem-Branch and the weight used always agree.
  // ALSO FIX: per the traditional rule, a birth time in the 23:00-23:59 "late Zi" window counts
  // toward the FOLLOWING lunar day for weight purposes - previously not applied.
  const lateZi = hh === 23;
  const weightDate = lateZi ? new Date(Date.UTC(yy, mm - 1, dd + 1)) : new Date(Date.UTC(yy, mm - 1, dd));
  const wYY = weightDate.getUTCFullYear(), wMM = weightDate.getUTCMonth() + 1, wDD = weightDate.getUTCDate();
  const { lunarMonth, lunarDay } = approximateLunarMonthDay(wYY, wMM, wDD);
  const jiaziIdx = mod(bazi.yearForPillar - 4, 60);
  const lunarYearStemBranch = `${stemCN[bazi.yearStemIdx]}${branchCN[bazi.yearBranchIdx]}`;
  const yearW = BONE_YEAR_WEIGHTS[jiaziIdx];
  const monthW = BONE_MONTH_WEIGHTS[lunarMonth - 1];
  const dayW = BONE_DAY_WEIGHTS[lunarDay - 1];
  // BUG FIX (this round): confirmed via the authoritative test-data spreadsheet (27 June 1965, 05:28am,
  // Singapore) that Hour Weight MUST use the true-solar-time-corrected hour, not raw clock time. That
  // birth's raw clock hour (05:28) falls in Mao (05:00-06:59), but Singapore used UTC+7:30 before 1982
  // (not +8) - correcting for this shifts the true solar hour to ~04:53am, into Yin (03:00-04:59).
  // Using Yin's weight (0.7) instead of Mao's (1.0) is the only way to reach the verified correct total
  // of 2 Liang 7 Qian for this profile; using raw clock time gives 3 Liang 0 Qian, which is wrong. A
  // previous pass in this file switched this to raw-clock-time based on a plausible-sounding but
  // incorrect assumption about how Tong Sheng almanacs bucket the hour - reverted based on direct
  // verification against real test data rather than assumption.
  const shiChenIdx = getShiChenIndex(bazi.adjHh);
  const hourW = BONE_HOUR_WEIGHTS[SHI_CHEN_NAMES[shiChenIdx]];
  // BUG FIX: summing the four decimal weights as floats (e.g. 1.2+0.6+0.8+1.6) can drift by a
  // fraction of a cent below the true value (e.g. 4.199999999999999 instead of 4.2). The previous
  // Math.floor(total*10)/10 then truncated that drift DOWN to the wrong Qian in ~8% of all possible
  // combinations (verified by exhaustive cross-check against integer-cent arithmetic) - always
  // silently losing exactly 1 Qian, which is precisely the kind of small, hard-to-spot discrepancy
  // being reported. Fixed by converting every weight to integer "Li" (0.1 Liang units) BEFORE
  // summing, so there is no floating point rounding involved at all.
  const toLi = (w) => Math.round(w * 10);
  const totalLi = toLi(yearW) + toLi(monthW) + toLi(dayW) + toLi(hourW);
  const total = totalLi / 10;
  const liang = Math.floor(totalLi / 10);
  const qian = totalLi - (liang * 10);
  return {
    yearW, monthW, dayW, hourW, total, liang, qian,
    displayStr: `${liang} Liang ${qian} Qian`,
    lunarYearStemBranch, lunarMonth, lunarDay,
    shiChenLabel: SHI_CHEN_LABELS[shiChenIdx], approximate: true
  };
}

function getBoneWeightTier(total) {
  // BUG 5 FIX: this function is defined in engine-metaphysics.js (loaded before app.js, so `lang`
  // and `bt` are not guaranteed to exist here yet) - each tier now carries its own tierZh field
  // instead, which app.js reads directly wherever the tier name is displayed or embedded in prose.
  if (total < 3.0) return { tier: 'Humble Beginnings', tierZh: '白手起家格', color: 'var(--danger)', summary: 'A life requiring extra effort and resilience; hardship in early years gives way to hard-won stability.', summaryZh: '需要格外努力与韧性的人生；早年的艰辛换来后期得来不易的稳定。' };
  if (total < 3.6) return { tier: 'Modest Fate', tierZh: '平稳格', color: 'var(--warning)', summary: 'A steady, unremarkable path; success comes through patience and consistent effort rather than luck.', summaryZh: '平稳而不张扬的人生道路；成功来自耐心与持续努力，而非运气。' };
  if (total < 4.2) return { tier: 'Balanced Fate', tierZh: '中和格', color: '#b8860b', summary: 'A reasonably smooth life with occasional ups and downs, broadly balanced between effort and reward.', summaryZh: '人生较为顺遂，偶有起伏，努力与回报大致平衡。' };
  if (total < 5.0) return { tier: 'Fortunate Fate', tierZh: '福泽格', color: 'var(--success)', summary: 'Good fortune supports major life decisions; opportunities tend to arrive at the right time.', summaryZh: '福气助力重大人生决策；机遇往往适时而来。' };
  if (total < 6.0) return { tier: 'Highly Auspicious Fate', tierZh: '大吉格', color: '#1565c0', summary: 'Strong natural advantages in wealth, status, or relationships; life unfolds with notable ease.', summaryZh: '在财富、地位或人际关系上具备先天优势；人生展开较为顺畅。' };
  return { tier: 'Extremely Auspicious Fate', tierZh: '极贵格', color: 'var(--plum)', summary: 'A rare, exceptionally favourable destiny associated with high achievement and lasting prosperity.', summaryZh: '罕见的极佳命格，与卓越成就及长久昌盛相关联。' };
}

// ============================================================
// ENHANCEMENT/BUG 7: Ba Zhai (8 Mansions) direction -> star lookup, derived from Kua Number
// ============================================================
const BAZHAI_STARS = {
  1: { North:'Fu Wei', Southeast:'Sheng Qi', East:'Tian Yi', South:'Yan Nian', Southwest:'Huo Hai', Northeast:'Wu Gui', West:'Liu Sha', Northwest:'Jue Ming' },
  3: { East:'Fu Wei', South:'Sheng Qi', North:'Tian Yi', Southeast:'Yan Nian', Northwest:'Huo Hai', West:'Wu Gui', Northeast:'Liu Sha', Southwest:'Jue Ming' },
  4: { Southeast:'Fu Wei', North:'Sheng Qi', South:'Tian Yi', East:'Yan Nian', West:'Huo Hai', Northwest:'Wu Gui', Southwest:'Liu Sha', Northeast:'Jue Ming' },
  9: { South:'Fu Wei', East:'Sheng Qi', Southeast:'Tian Yi', North:'Yan Nian', Northeast:'Huo Hai', Southwest:'Wu Gui', Northwest:'Liu Sha', West:'Jue Ming' },
  2: { Southwest:'Fu Wei', Northeast:'Sheng Qi', West:'Tian Yi', Northwest:'Yan Nian', South:'Huo Hai', North:'Wu Gui', Southeast:'Liu Sha', East:'Jue Ming' },
  6: { Northwest:'Fu Wei', West:'Sheng Qi', Northeast:'Tian Yi', Southwest:'Yan Nian', East:'Huo Hai', Southeast:'Wu Gui', South:'Liu Sha', North:'Jue Ming' },
  7: { West:'Fu Wei', Northwest:'Sheng Qi', Southwest:'Tian Yi', Northeast:'Yan Nian', North:'Huo Hai', South:'Wu Gui', East:'Liu Sha', Southeast:'Jue Ming' },
  8: { Northeast:'Fu Wei', Southwest:'Sheng Qi', Northwest:'Tian Yi', West:'Yan Nian', North:'Huo Hai', South:'Wu Gui', East:'Liu Sha', Southeast:'Jue Ming' }
};
const BAZHAI_STAR_INFO = {
  'Fu Wei':  { zh:'伏位', rating:'Auspicious',             color:'var(--success)', bg:'#e8f5e9', desc:'Stability, self-cultivation, and steady personal growth energy.' },
  'Sheng Qi':{ zh:'生气', rating:'Highly Auspicious',       color:'#1565c0',        bg:'#e3f2fd', desc:'Vitality, career growth, and wealth-generating opportunity.' },
  'Tian Yi': { zh:'天医', rating:'Highly Auspicious',       color:'#1565c0',        bg:'#e3f2fd', desc:'Health, healing, and general wellbeing support.' },
  'Yan Nian':{ zh:'延年', rating:'Auspicious',              color:'var(--success)', bg:'#e8f5e9', desc:'Relationships, longevity, and harmonious household energy.' },
  'Huo Hai': { zh:'祸害', rating:'Inauspicious',            color:'var(--warning)', bg:'#fff3e0', desc:'Minor mishaps, petty disputes, and low-grade irritations.' },
  'Wu Gui':  { zh:'五鬼', rating:'Inauspicious',            color:'var(--warning)', bg:'#fff3e0', desc:'Conflict, betrayal risk, and unexpected setbacks.' },
  'Liu Sha': { zh:'六煞', rating:'Inauspicious',            color:'var(--warning)', bg:'#fff3e0', desc:'Scandal, legal entanglement, and scattered focus.' },
  'Jue Ming':{ zh:'绝命', rating:'Highly Inauspicious',     color:'var(--danger)',  bg:'#fdeaea', desc:'Severe setbacks, health risk, and major potential loss.' }
};

// BUG 6/7 FIX: Compatibility now genuinely derived from Wu Xing (Five Element) Day Master
// relationships, Six Clash/Six Harmony between Day Branches, and Kua group alignment - not a flat
// "88 + small bump" placeholder. Returns {score, breakdown[]} so the reasoning is visible in the UI.
const WUXING_NAMES = ['Wood','Fire','Earth','Metal','Water'];
function getElementIdx(stemIdx) { return Math.floor(stemIdx / 2); }
function elementRelation(e1, e2) {
  if (e1 === e2) return 'same';
  if (mod(e1 + 1, 5) === e2) return 'e1_generates_e2';
  if (mod(e2 + 1, 5) === e1) return 'e2_generates_e1';
  if (mod(e1 + 2, 5) === e2) return 'e1_overcomes_e2';
  if (mod(e2 + 2, 5) === e1) return 'e2_overcomes_e1';
  return 'neutral';
}
function calculateTrueCompatibility(p1, p2, isBusiness = false) {
  if (!p1 || !p2) return { score: 94, breakdown: [bt('No comparison profile available yet.', '尚无可供比较的档案。')] };
  const e1 = getElementIdx(p1.bazi.dayStemIdx), e2 = getElementIdx(p2.bazi.dayStemIdx);
  const rel = elementRelation(e1, e2);
  let score = 72; const breakdown = [];
  // BUG FIX (this round): every breakdown line here was English-only, with no bt() bilingual
  // handling - a pre-existing gap that became more visible once the display layer (compatSummaryBox)
  // was changed to show the FULL breakdown instead of just its first line. Converted every line to
  // be properly bilingual, matching the rest of this app's convention.
  const wuxingZh = { Wood:'木', Fire:'火', Earth:'土', Metal:'金', Water:'水' };
  const wx1 = WUXING_NAMES[e1], wx2 = WUXING_NAMES[e2];
  const wx1zh = wuxingZh[wx1] || wx1, wx2zh = wuxingZh[wx2] || wx2;

  if (rel === 'same') { score += 8; breakdown.push(bt(`Matching Day Master elements (${wx1}) create natural resonance.`, `日主五行相同（${wx1zh}），形成天然共鸣。`)); }
  else if (rel === 'e1_generates_e2' || rel === 'e2_generates_e1') { score += 14; breakdown.push(bt(`${wx1} and ${wx2} form a mutually generating cycle - strongly supportive.`, `${wx1zh}与${wx2zh}形成相生循环——强力互助。`)); }
  else if (rel === 'e1_overcomes_e2' || rel === 'e2_overcomes_e1') { score -= 10; breakdown.push(bt(`${wx1} and ${wx2} sit in an overcoming (克) relationship - some friction likely.`, `${wx1zh}与${wx2zh}属相克关系——可能存在一定摩擦。`)); }
  else { score += 4; breakdown.push(bt(`${wx1} and ${wx2} are elementally neutral toward each other.`, `${wx1zh}与${wx2zh}五行上互不相涉。`)); }

  const b1 = p1.bazi.dayBranchIdx, b2 = p2.bazi.dayBranchIdx;
  if (SIX_CLASH[b1] === b2) { score -= 10; breakdown.push(bt('Day Branches are in a Six Clash (六冲) relationship - notable tension to actively manage.', '日支属六冲关系——存在明显张力，需主动管理。')); }
  else if (SIX_HARMONY[b1] === b2) { score += 10; breakdown.push(bt('Day Branches form a Six Harmony (六合) pairing - strong natural rapport.', '日支形成六合关系——天然默契深厚。')); }

  if (p1.kuaGroup === p2.kuaGroup) { score += isBusiness ? 6 : 4; breakdown.push(bt(`Both share the ${p1.kuaGroup} Kua group, reinforcing shared direction and decision-making style.`, `双方同属${p1.kuaGroup}，强化共同方向与决策风格。`)); }
  else { breakdown.push(bt('Different Kua groups - complementary strengths, but requires more conscious alignment.', '命卦组别不同——优势互补，但需更刻意地协调一致。')); }

  // ENHANCEMENT 7 FIX: compatibility now weighs ALL aspects of the app - Bone Weight, I Ching,
  // Numerology, Qi Men Dun Jia, and Zi Wei Dou Shu - alongside the existing BaZi/Zodiac/Kua factors,
  // instead of BaZi + Kua alone.
  if (p1.boneWeight && p2.boneWeight) {
    const bwGap = Math.abs(p1.boneWeight.total - p2.boneWeight.total);
    if (bwGap <= 0.5) { score += 3; breakdown.push(bt(`Bone Weight totals are closely matched (${p1.boneWeight.total} vs ${p2.boneWeight.total} Liang) - a similar overall life-force baseline.`, `称骨总重相近（${p1.boneWeight.total}两 对比 ${p2.boneWeight.total}两）——整体命格基础相似。`)); }
    else if (bwGap >= 2) { score -= 3; breakdown.push(bt(`Bone Weight totals differ notably (${p1.boneWeight.total} vs ${p2.boneWeight.total} Liang) - different baseline life trajectories to be mindful of.`, `称骨总重差异明显（${p1.boneWeight.total}两 对比 ${p2.boneWeight.total}两）——命格基础轨迹不同，宜留意。`)); }
  }
  if (typeof p1.hexNo === 'number' && typeof p2.hexNo === 'number') {
    const compHexes = [8, 16, 24].map(off => mod(p1.hexNo - 1 + off, 64) + 1);
    const incompHexes = [32, 40, 48].map(off => mod(p1.hexNo - 1 + off, 64) + 1);
    if (compHexes.includes(p2.hexNo)) { score += 4; breakdown.push(bt(`I Ching Hexagrams #${p1.hexNo} and #${p2.hexNo} are in a compatible pairing - resonant timing on major transitions.`, `易经卦象第${p1.hexNo}卦与第${p2.hexNo}卦属相合组合——重大转折时机相应。`)); }
    else if (incompHexes.includes(p2.hexNo)) { score -= 4; breakdown.push(bt(`I Ching Hexagrams #${p1.hexNo} and #${p2.hexNo} are in an incompatible pairing - pacing on major transitions needs coordination.`, `易经卦象第${p1.hexNo}卦与第${p2.hexNo}卦属不合组合——重大转折的步调需相互协调。`)); }
  }
  if (p1.numCompat && typeof p2.life === 'number') {
    if (p1.numCompat.includes(p2.life)) { score += 3; breakdown.push(bt(`Numerology: ${p2.life} is one of your favourable Life Path numbers - a supportive numeric pairing.`, `数字命理：${p2.life}是您的吉祥生命数字之一——数字组合具助力。`)); }
    else if (p1.numAvoid && p1.numAvoid.includes(p2.life)) { score -= 3; breakdown.push(bt(`Numerology: ${p2.life} falls in your avoid-number set - a mild numeric clash.`, `数字命理：${p2.life}属于您的忌用数字——存在轻微数字冲突。`)); }
  }
  if (p1.qmdj && p2.qmdj) {
    const palaceGap = Math.min(mod(p1.qmdj.natalPalace - p2.qmdj.natalPalace, 9), mod(p2.qmdj.natalPalace - p1.qmdj.natalPalace, 9));
    if (palaceGap === 0) { score += 3; breakdown.push(bt(`Qi Men Dun Jia: matching Life Palace (${p1.palaceName}) - aligned strategic timing.`, `奇门遁甲：本命宫位相同（${p1.palaceName}）——战略时机相合。`)); }
    else if (palaceGap >= 4) { score -= 2; breakdown.push(bt(`Qi Men Dun Jia: Life Palaces sit far apart on the Luoshu grid - differing strategic timing instincts.`, `奇门遁甲：本命宫位在洛书格局中相距甚远——战略时机直觉不同。`)); }
  }
  if (p1.ziwei && p2.ziwei) {
    if (p1.ziwei.lifePalaceBranchIdx === p2.ziwei.lifePalaceBranchIdx) { score += 3; breakdown.push(bt(`Zi Wei Dou Shu: matching Life Palace (${p1.ziwei.lifePalaceName}) - shared destiny-axis themes.`, `紫微斗数：命宫相同（${p1.ziwei.lifePalaceName}）——命运主轴主题相通。`)); }
    else if (mod(p1.ziwei.lifePalaceBranchIdx - p2.ziwei.lifePalaceBranchIdx, 12) === 6) { score += 2; breakdown.push(bt(`Zi Wei Dou Shu: opposite Life Palaces - a classic complementary destiny-axis pairing.`, `紫微斗数：命宫相对——典型的互补命运轴组合。`)); }
  }
  // ENHANCEMENT (requested directly: "deepening the Western-astrology piece inside the general BaZi/
  // Zodiac compatibility score to reuse this new synastry engine" - one of the 3 follow-on items scoped
  // after the astro_compat % fix, now completed per "proceed to complete all pending items"): this used
  // to be Sun-Sign-only (compatible/incompatible list, +/-3) - the same coarse categorical the
  // astro_compat reading itself used to have. Whenever BOTH people have a full birth date+time on file
  // (p.bazi.birthMomentUTC), this now runs the SAME real synastry engine built for astro_compat
  // (computeSynastryScore/computeSynastryAspects, engine-metaphysics.js) - checking all 12x12 real
  // cross-chart aspects, not just the two Sun signs - and folds its full result in as one delta against
  // this function's own 72-point baseline (so the two scores stay on a consistent scale, and the Sun-
  // Sign layer is preserved as one input among several, via sunSignAdj, rather than discarded). When a
  // full birth time is not on file for one or both people, this honestly falls back to the original
  // Sun-Sign-only categorical - no fabricated synastry for data that was never provided.
  if (p1.astro && p2.astro) {
    const sunSignAdj = p1.astro.comp.includes(p2.astro.en) ? 3 : p1.astro.incomp.includes(p2.astro.en) ? -3 : 0;
    const hasFullCharts = !!(p1?.bazi?.birthMomentUTC && p2?.bazi?.birthMomentUTC);
    if (hasFullCharts) {
      const chartA = computeFullNatalChart(p1.bazi.birthMomentUTC), chartB = computeFullNatalChart(p2.bazi.birthMomentUTC);
      const synastry = computeSynastryScore(chartA, chartB, sunSignAdj);
      score += (synastry.score - 72); // same baseline-72 convention as this function's own score, so the delta folds in cleanly
      const top = synastry.aspects[0];
      const sunNote = sunSignAdj > 0 ? { en: 'classically compatible', zh: '传统相合' } : sunSignAdj < 0 ? { en: 'classically challenging', zh: '传统挑战' } : { en: 'neutral', zh: '中性' };
      breakdown.push(bt(`Western Astrology (full synastry): ${synastry.aspects.length} real cross-chart aspect${synastry.aspects.length===1?'':'s'} found between your full natal charts${top ? ` - strongest is your ${PLANET_INFO_FULL[top.keyA].en} ${top.name} their ${PLANET_INFO_FULL[top.keyB].en}` : ''}. Sun Sign layer: ${p2.astro.en} is ${sunNote.en} for ${p1.astro.en}.`,
        `西方占星（完整合盘）：您与对方完整本命盘之间找到${synastry.aspects.length}个真实跨命盘相位${top ? `——最显著为您的${PLANET_INFO_FULL[top.keyA].zh}${top.nameZh}对方的${PLANET_INFO_FULL[top.keyB].zh}` : ''}。太阳星座层面：${p2.astro.en}对${p1.astro.en}属${sunNote.zh}。`));
    } else if (sunSignAdj > 0) { score += 3; breakdown.push(bt(`Western Astrology: ${p2.astro.en} is classically compatible with ${p1.astro.en} - an easier temperamental fit.`, `西方占星：${p2.astro.en}与${p1.astro.en}属传统相合星座——性情较易协调。`)); }
    else if (sunSignAdj < 0) { score -= 3; breakdown.push(bt(`Western Astrology: ${p2.astro.en} is classically challenging for ${p1.astro.en} - temperamental differences to bridge consciously.`, `西方占星：${p2.astro.en}对${p1.astro.en}而言属传统挑战星座——性情差异需刻意磨合。`)); }
  }
  // ENHANCEMENT (this round, deepening compatibility per request): Da Yun (10-year luck cycle) was
  // the one explicitly-named system NOT yet factored into this score, despite being computed and
  // rated elsewhere in this app (rateDaYunCycle). Finds each person's CURRENTLY ACTIVE Da Yun pillar
  // (by their present age) and compares tiers - both currently in a similarly strong or similarly
  // challenging cycle is a genuine timing-alignment signal; a large gap (one thriving, one
  // struggling) is a real friction point worth naming, since major decisions timed well for one
  // person may land badly for the other during a mismatched cycle.
  if (p1.daYunPillars && p2.daYunPillars && p1.bazi && p2.bazi) {
    const findCurrentCycle = (prof) => { const age = computeCurrentAge(prof.birthdate); return prof.daYunPillars.find(dy => dy.age <= age && age < dy.age + 10) || prof.daYunPillars[0]; };
    const dy1 = findCurrentCycle(p1), dy2 = findCurrentCycle(p2);
    const rate1 = rateDaYunCycle(dy1.stemIdx, dy1.branchIdx, p1.bazi.dayStemIdx, p1.bazi.dayBranchIdx);
    const rate2 = rateDaYunCycle(dy2.stemIdx, dy2.branchIdx, p2.bazi.dayStemIdx, p2.bazi.dayBranchIdx);
    const gap = Math.abs(rate1.score - rate2.score);
    if (gap <= 1) { score += 3; breakdown.push(bt(`Da Yun: you are both currently in a similarly-rated 10-year luck cycle (${rate1.tierEN} / ${rate2.tierEN}) - well-aligned timing for major joint decisions right now.`, `大运：双方目前均处于评级相近的十年大运（${rate1.tierZH} / ${rate2.tierZH}）——现阶段适合共同做出重大决策。`)); }
    else if (gap >= 4) { score -= 3; breakdown.push(bt(`Da Yun: your current 10-year luck cycles are quite different in tier (${rate1.tierEN} vs ${rate2.tierEN}) - a timing mismatch worth being aware of when making major joint decisions this decade.`, `大运：双方目前的十年大运评级差异较大（${rate1.tierZH} 对比 ${rate2.tierZH}）——本十年内共同做重大决策时宜留意时机落差。`)); }
  }

  score = Math.min(98, Math.max(55, Math.round(score)));
  return { score, breakdown };
}

// ============================================================
// ENHANCEMENT (this round): 3-Year Monthly Da Yun Forecast (36 months, current calendar month forward)
// ============================================================
// The 7-tier auspiciousness scale shared by BOTH new "3-year monthly" readings added this round (this
// one and the matching Western Astrology reading further below), matching this app's established
// "Extremely X .. Extremely Y" tier-naming convention (see DAYUN_TIER_LABELS/ZERI_TIER_COLORS above)
// but with the exact wording requested for this pair of readings, including a genuine middle
// "Cautionary" tier distinct from "Inauspicious".
const MONTHLY_TIER_LABELS = [
  { min: 6,         en: 'Extremely Auspicious',   zh: '极为吉利', abbr: 'EA', abbrZh: '极吉', color: '#1b5e20' },
  { min: 3.5,       en: 'Very Auspicious',        zh: '颇为吉利', abbr: 'VA', abbrZh: '颇吉', color: '#2e7d32' },
  { min: 1.5,       en: 'Auspicious',             zh: '吉利',     abbr: 'A',  abbrZh: '吉',   color: '#66bb6a' },
  { min: -1.5,      en: 'Neutral',                zh: '平和',     abbr: 'N',  abbrZh: '平',   color: '#9e9e9e' },
  { min: -3.5,      en: 'Cautionary',             zh: '谨慎',     abbr: 'C',  abbrZh: '慎',   color: '#ef6c00' },
  { min: -5.5,      en: 'Inauspicious',           zh: '不吉',     abbr: 'I',  abbrZh: '不吉', color: '#d84315' },
  { min: -Infinity, en: 'Extremely Inauspicious', zh: '极为不吉', abbr: 'EI', abbrZh: '极凶', color: '#b71c1c' }
];
function classifyMonthlyTier(score) { return MONTHLY_TIER_LABELS.find(t => score >= t.min); }

// Shared cascading Wu Xing relation scorer, generalising the same convention already used by
// rateDaYunCycle's own local relScore (reimplemented here as a standalone, reusable function rather
// than touching that existing, already-verified function): 2 = Peer/same element, 3 = target
// generates ref (Resource - favourable), 0 = ref generates target (Output - drains ref), 1 = ref
// controls target (Wealth - mildly favourable, exerting control outward), -1 = target controls ref
// (Officer/Pressure - unfavourable). "ref" is whichever pillar is being fed INTO by the next stage of
// the cascade (Day Master for stage 1, that Da Yun pillar for stage 2, that Liu Nian for stage 3).
function wuxingRelScore(refElemIdx, targetElemIdx) {
  if (targetElemIdx === refElemIdx) return 2;
  if (mod(targetElemIdx + 1, 5) === refElemIdx) return 3;
  if (mod(refElemIdx + 1, 5) === targetElemIdx) return 0;
  if (mod(refElemIdx + 2, 5) === targetElemIdx) return 1;
  return -1;
}
const WUXING_REL_LABEL = {
  2: { en: 'reinforces it directly (Peer)', zh: '直接增强（比肩）' },
  3: { en: 'generates and nourishes it (Resource)', zh: '生扶滋养（印）' },
  0: { en: 'drains outward from it (Output)', zh: '耗泄外流（食伤）' },
  1: { en: 'is exerted control over, Wealth-style (Wealth)', zh: '受其向外施加克制（財）' },
  '-1': { en: 'presses down on it (Officer/Pressure)', zh: '受其压制（官殺）' }
};

// Cascading three-stage score for ONE calendar month: Day-Master<->DaYun (decade-level backdrop,
// weight 1.0), DaYun<->LiuNian (this year's overlay on that decade, weight 0.6), LiuNian<->LiuYue
// (this month's overlay on that year, weight 0.4) - a genuine compounding chain (each stage's
// reference element is the PREVIOUS stage's own pillar, not always the Day Master), not three
// independent Day-Master comparisons summed together.
function scoreDaYunMonth(dmStemIdx, dmBranchIdx, dyStemIdx, dyBranchIdx, lnStemIdx, lnBranchIdx, lyStemIdx, lyBranchIdx) {
  const dmElem = getElementIdx(dmStemIdx), dyElem = getElementIdx(dyStemIdx), lnElem = getElementIdx(lnStemIdx), lyElem = getElementIdx(lyStemIdx);
  const dyBranchElem = BRANCH_ELEM_IDX[dyBranchIdx], lnBranchElem = BRANCH_ELEM_IDX[lnBranchIdx], lyBranchElem = BRANCH_ELEM_IDX[lyBranchIdx];

  const s1Stem = wuxingRelScore(dmElem, dyElem);
  let s1 = s1Stem + Math.round(wuxingRelScore(dmElem, dyBranchElem) / 2);
  if (SIX_CLASH[dmBranchIdx] === dyBranchIdx) s1 -= 3; else if (SIX_HARMONY[dmBranchIdx] === dyBranchIdx) s1 += 2;

  const s2Stem = wuxingRelScore(dyElem, lnElem);
  let s2 = s2Stem + Math.round(wuxingRelScore(dyElem, lnBranchElem) / 2);
  if (SIX_CLASH[dyBranchIdx] === lnBranchIdx) s2 -= 2; else if (SIX_HARMONY[dyBranchIdx] === lnBranchIdx) s2 += 1;

  const s3Stem = wuxingRelScore(lnElem, lyElem);
  let s3 = s3Stem + Math.round(wuxingRelScore(lnElem, lyBranchElem) / 2);
  if (SIX_CLASH[lnBranchIdx] === lyBranchIdx) s3 -= 1; else if (SIX_HARMONY[lnBranchIdx] === lyBranchIdx) s3 += 1;

  const total = (s1 * 1.0) + (s2 * 0.6) + (s3 * 0.4);
  // Dominant stage = the largest-magnitude weighted contributor, used to write a genuine (not generic
  // filler) one-line reason for this specific month, rather than only exposing the final number.
  const stages = [
    { key: 'dm_dayun', weighted: s1 * 1.0, stemRel: s1Stem },
    { key: 'dayun_liunian', weighted: s2 * 0.6, stemRel: s2Stem },
    { key: 'liunian_liuyue', weighted: s3 * 0.4, stemRel: s3Stem }
  ];
  const dominant = stages.reduce((a, b) => Math.abs(b.weighted) > Math.abs(a.weighted) ? b : a);
  return { total, s1, s2, s3, dominant };
}

// Liu Yue (流月, flowing month) stem/branch for a given Liu Nian stem and calendar month, reusing the
// SAME "Five Tigers Escaping the Year" (五虎遁) formula already used for the natal BaZi month stem
// elsewhere in this file (see month1Stem in getBaZiPillars), plus a fixed month-branch-by-calendar-
// month correspondence consistent with this file's own solar-month convention (solarMonthNumber 1 =
// Yin/寅, branch idx 2, beginning in February) - i.e. branchIdx = mod(calendarMonth, 12) gives
// Jan->Chou(1)...Feb->Yin(2)...Dec->Zi(0), matching the same Yin-starts-February anchor already
// verified in getBaZiPillars, without requiring a fresh solar-term lookup for a 3-year forward
// projection. This deliberately mirrors the same "calendar month directly, no fresh solar-term
// correction" simplification this app's own Flying Star Monthly overlay (computeMonthlyFlyingStar)
// already uses for its own "month" concept.
function computeLiuYuePillar(liuNianStemIdx, calendarMonth) {
  const branchIdx = mod(calendarMonth, 12);
  const solarMonthNumber = mod(branchIdx - 2, 12) + 1;
  const month1Stem = mod(2 * ((liuNianStemIdx % 5) + 1), 10);
  const stemIdx = mod(month1Stem + (solarMonthNumber - 1), 10);
  return { stemIdx, branchIdx };
}

// Full 36-month (current calendar month + next 35) Da Yun forecast for a profile. Liu Nian (流年) uses
// this file's own existing Gregorian-year pillar lookup (computeYearPillar, already used elsewhere for
// "current year" concepts e.g. computeDetailedReadingAnalysis's curYearPillar) rather than a fresh
// lookup, and the current Da Yun pillar for each of those years is found via each cycle's own
// `calendarYearStart` (already computed on p.daYunPillars) - the same age/year-window pattern already
// used by calculateTrueCompatibility's own Da Yun logic above, just keyed by calendar year directly
// (more robust across a Dec/Jan boundary than re-deriving age from a birthdate string here).
function compute3YearDaYunMonthly(p) {
  const dmStemIdx = p.bazi.dayStemIdx, dmBranchIdx = p.bazi.dayBranchIdx;
  const now = new Date();
  const startYear = now.getFullYear(), startMonth = now.getMonth() + 1;
  const months = [];
  for (let i = 0; i < 36; i++) {
    const totalIdx = (startMonth - 1) + i;
    const year = startYear + Math.floor(totalIdx / 12);
    const month = (totalIdx % 12) + 1;
    const liuNian = computeYearPillar(year);
    const liuYue = computeLiuYuePillar(liuNian.stemIdx, month);
    let cycle = (p.daYunPillars || []).find(dy => year >= dy.calendarYearStart && year < dy.calendarYearStart + 10);
    if (!cycle) cycle = (p.daYunPillars && p.daYunPillars[p.daYunPillars.length - 1]) || { stemIdx: dmStemIdx, branchIdx: dmBranchIdx };
    const scored = scoreDaYunMonth(dmStemIdx, dmBranchIdx, cycle.stemIdx, cycle.branchIdx, liuNian.stemIdx, liuNian.branchIdx, liuYue.stemIdx, liuYue.branchIdx);
    const tier = classifyMonthlyTier(scored.total);
    months.push({
      year, month,
      dayunStemIdx: cycle.stemIdx, dayunBranchIdx: cycle.branchIdx,
      liuNianStemIdx: liuNian.stemIdx, liuNianBranchIdx: liuNian.branchIdx,
      liuYueStemIdx: liuYue.stemIdx, liuYueBranchIdx: liuYue.branchIdx,
      score: scored.total, tier, dominant: scored.dominant
    });
  }
  let best = months[0], worst = months[0];
  months.forEach(m => { if (m.score > best.score) best = m; if (m.score < worst.score) worst = m; });
  return { months, best, worst };
}

// ============================================================
// ENHANCEMENT (this round): matching 3-Year Monthly Western Astrology reading
// ============================================================
// HONESTY NOTE (see getAstrologySign's own comment above and app.js's Western Astrology section for
// this app's existing honesty convention): this app has NO planetary-ephemeris/transit engine - `astro`
// is only a Sun-sign lookup. What IS genuinely, deterministically computable without external
// astronomical data is which zodiac sign the Sun transits during any given calendar date (accurate to
// within about a day), using the exact same sign-date table `getAstrologySign` itself already uses -
// reused directly here (via getAstrologySign(month, 15), a safe mid-month day nowhere near any of that
// table's boundary dates) rather than a second, possibly-inconsistent copy of the same table.
//
// Standard, fixed astrological convention for each sign's Element and Modality - cross-checked for
// internal consistency: exactly 3 signs per Element (Fire/Earth/Air/Water) and exactly 4 per Modality
// (Cardinal/Fixed/Mutable), spread one-per-modality-per-element around the wheel as classically defined.
const ZODIAC_ELEMENT_MODALITY = {
  Aries: { element: 'Fire', modality: 'Cardinal' }, Taurus: { element: 'Earth', modality: 'Fixed' },
  Gemini: { element: 'Air', modality: 'Mutable' }, Cancer: { element: 'Water', modality: 'Cardinal' },
  Leo: { element: 'Fire', modality: 'Fixed' }, Virgo: { element: 'Earth', modality: 'Mutable' },
  Libra: { element: 'Air', modality: 'Cardinal' }, Scorpio: { element: 'Water', modality: 'Fixed' },
  Sagittarius: { element: 'Fire', modality: 'Mutable' }, Capricorn: { element: 'Earth', modality: 'Cardinal' },
  Aquarius: { element: 'Air', modality: 'Fixed' }, Pisces: { element: 'Water', modality: 'Mutable' }
};
// Standard Western-astrology element-pair compatibility: Fire/Air and Earth/Water are the two
// classically "complementary" (generally easy) cross-element pairings; any other cross-element
// pairing is the more classically "challenging" one.
const ELEMENT_COMPLEMENT = { Fire: 'Air', Air: 'Fire', Earth: 'Water', Water: 'Earth' };
function astroElementRelation(elemA, elemB) {
  if (elemA === elemB) return 'same';
  if (ELEMENT_COMPLEMENT[elemA] === elemB) return 'complementary';
  return 'challenging';
}
// Score for one transiting sign against the natal Sun sign. Same tier scale/labels as the Da Yun
// reading above (MONTHLY_TIER_LABELS), but its own thresholds (ASTRO_MONTHLY_THRESHOLD_SCALE below),
// since this score's domain (a 2-factor Element+Modality relationship) is much narrower than the
// multi-factor cascading BaZi score - an honest consequence of this reading's own deliberately
// narrower, disclosed scope (Sun-sign element/modality only, no Moon/planets/houses).
function scoreAstroMonth(natalKey, transitKey) {
  const natal = ZODIAC_ELEMENT_MODALITY[natalKey], transit = ZODIAC_ELEMENT_MODALITY[transitKey];
  const elemRel = astroElementRelation(natal.element, transit.element);
  const sameSign = natalKey === transitKey;
  let score = sameSign ? 5 : (elemRel === 'same' ? 3 : (elemRel === 'complementary' ? 1.5 : -1.5));
  const sameModality = !sameSign && natal.modality === transit.modality;
  if (sameModality) score -= 1; // classically, same-modality pairings (excluding the solar-return month itself) add rivalry/friction
  return { score, elemRel, sameSign, sameModality };
}
function classifyAstroMonthlyTier(score) {
  // Distinct thresholds from classifyMonthlyTier's BaZi-scale cutoffs (see honesty note above), tuned
  // to this score's own realised value set {5, 3, 1.5, 0.5, -1.5, -2.5} so every genuinely distinct
  // outcome this narrower 2-factor model can produce lands in its own tier.
  if (score >= 5) return MONTHLY_TIER_LABELS[0];
  if (score >= 3) return MONTHLY_TIER_LABELS[1];
  if (score >= 1.5) return MONTHLY_TIER_LABELS[2];
  if (score >= 0.5) return MONTHLY_TIER_LABELS[3];
  if (score >= -1.5) return MONTHLY_TIER_LABELS[4];
  if (score >= -2.5) return MONTHLY_TIER_LABELS[5];
  return MONTHLY_TIER_LABELS[6];
}
// Full 36-month (current calendar month + next 35) matching astrology forecast for a profile.
function compute3YearAstroMonthly(p) {
  const [, bm, bd] = (p.birthdate || '1990-01-01').split('-').map(Number);
  const natalSign = getAstrologySign(bm, bd);
  const natalKey = natalSign.en;
  const now = new Date();
  const startYear = now.getFullYear(), startMonth = now.getMonth() + 1;
  const months = [];
  for (let i = 0; i < 36; i++) {
    const totalIdx = (startMonth - 1) + i;
    const year = startYear + Math.floor(totalIdx / 12);
    const month = (totalIdx % 12) + 1;
    const transitSign = getAstrologySign(month, 15);
    const transitKey = transitSign.en;
    const scored = scoreAstroMonth(natalKey, transitKey);
    const tier = classifyAstroMonthlyTier(scored.score);
    months.push({ year, month, transitKey, transitSign, score: scored.score, tier, elemRel: scored.elemRel, sameSign: scored.sameSign, sameModality: scored.sameModality });
  }
  let best = months[0], worst = months[0];
  months.forEach(m => { if (m.score > best.score) best = m; if (m.score < worst.score) worst = m; });
  return { natalKey, natalSign, months, best, worst };
}

// Drawings for SVGs
// BUG FIX (this round): previously derived all 6 lines directly from hexNo's raw binary bits, which
// made sense only when hexNo was an arbitrary checksum value with no real trigram meaning behind it.
// Now that hexNo is derived from actual cast trigrams (see castMeiHuaNatalHexagram), the SVG is built
// directly from the real upper/lower trigram line patterns instead, so what's drawn genuinely matches
// what was cast (lower trigram forms the bottom 3 lines, upper trigram the top 3, per the classical
// convention of reading a hexagram bottom-to-top).
function getHexagramSVG(upperTrigramNum, lowerTrigramNum, movingLine) {
  const allLines = [...TRIGRAMS[lowerTrigramNum].lines, ...TRIGRAMS[upperTrigramNum].lines]; // bottom to top, 6 total
  let lines = [];
  for (let i = 0; i < 6; i++) {
    const isSolid = allLines[i];
    const isMoving = (i + 1) === movingLine; // movingLine is 1-indexed from the bottom
    const color = isMoving ? 'var(--gold)' : 'var(--plum)';
    const y = 14 + (5 - i) * 14;
    if (isSolid) lines.push(`<line x1="15" y1="${y}" x2="85" y2="${y}" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`);
    else lines.push(`<line x1="15" y1="${y}" x2="42" y2="${y}" stroke="${color}" stroke-width="8" stroke-linecap="round"/><line x1="58" y1="${y}" x2="85" y2="${y}" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`);
  }
  return `<svg viewBox="0 0 100 100" width="80" height="80" style="background:var(--sand);border-radius:12px;padding:5px;border:1px solid var(--goldsoft)">${lines.join('')}</svg>`;
}

// HONESTY FIX (Phase 5 full-app audit): both of these SVGs used to be 100%-static decorative
// templates - byte-identical for every single user regardless of their real chart - despite being
// named/placed as if they rendered a "calculated"/"natal" chart. This app already has a REAL
// astronomical Sun-longitude calculation (computeNatalSunLongitude, using the person's actual
// birthMomentUTC via the same Meeus-style ecliptic-position math the 3-year transit reading uses -
// see compute3YearAstroMonthly/computeYearlyTransitReport) that was going entirely unused here. Both
// wheels now plot a real marker at the person's own real natal Sun longitude (converted straight to
// an angle around the circle - not claiming to match any specific professional chart-wheel
// convention's zero-point/rotation direction, just genuinely derived from this person's own real
// birth data rather than fixed), so the "calculated"/"natal" naming is now actually true.
// ENHANCEMENT (requested directly: "continue with the western astrology chart"): both wheels used to
// plot only a single Sun marker on an otherwise-empty circle. They now also plot the person's real
// NATAL positions of the 5 outer planets (see computeNatalOuterPlanetPositions above), each as its own
// small marker with a one-letter glyph and distinct color, plus 12 spoke lines marking the zodiac sign
// boundaries (every 30 degrees, starting from Aries at the 3-o'clock/0-degree point) so the wheel
// genuinely reads as a chart with houses/divisions rather than a plain decorated circle.
const OUTER_PLANET_GLYPH = { jupiter: { glyph: '♃', color: '#7a5cff' }, saturn: { glyph: '♄', color: '#8a6d3b' }, uranus: { glyph: '♅', color: '#2ba7a0' }, neptune: { glyph: '♆', color: '#3b6fd6' }, pluto: { glyph: '♇', color: '#a33b6f' } };
function planetMarkerPoint(cx, cy, r, lon) {
  const rad = (lon * Math.PI) / 180;
  return { x: (cx + r * Math.cos(rad)).toFixed(1), y: (cy + r * Math.sin(rad)).toFixed(1) };
}
function zodiacSpokeLinesSVG(cx, cy, rOuter, rInner, stroke) {
  let out = '';
  for (let i = 0; i < 12; i++) {
    const rad = (i * 30 * Math.PI) / 180;
    const x1 = (cx + rInner * Math.cos(rad)).toFixed(1), y1 = (cy + rInner * Math.sin(rad)).toFixed(1);
    const x2 = (cx + rOuter * Math.cos(rad)).toFixed(1), y2 = (cy + rOuter * Math.sin(rad)).toFixed(1);
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="0.75" opacity="0.6"/>`;
  }
  return out;
}
// ENHANCEMENT (requested directly: a 12-house wheel sketch + "There should be 12 houses to plot out",
// with the user then choosing real Ascendant-based houses): draws the 12 EQUAL HOUSE cusp lines (see
// computeEqualHouseCusps above) as a visually distinct layer from the zodiac-sign spokes above (a
// different stroke style/color) plus small house-number labels (1-12, starting at the Ascendant) at the
// midpoint of each house slice - only drawn when this profile has houses on file (computeNatalHouses
// returned non-null), i.e. it has a birth latitude. Returns '' otherwise, same honest-omission pattern as
// the marker functions above.
function houseCuspLinesSVG(cx, cy, rOuter, rInner, stroke, ascendant) {
  let out = '';
  for (let i = 0; i < 12; i++) {
    const lon = astroRev(ascendant + i * 30);
    const rad = (lon * Math.PI) / 180;
    const x1 = (cx + rInner * Math.cos(rad)).toFixed(1), y1 = (cy + rInner * Math.sin(rad)).toFixed(1);
    const x2 = (cx + rOuter * Math.cos(rad)).toFixed(1), y2 = (cy + rOuter * Math.sin(rad)).toFixed(1);
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${i === 0 ? 1.6 : 1}" opacity="0.85"/>`;
  }
  return out;
}
function houseNumberLabelsSVG(cx, cy, r, ascendant, textColor) {
  let out = '';
  for (let i = 0; i < 12; i++) {
    const midLon = astroRev(ascendant + i * 30 + 15);
    const rad = (midLon * Math.PI) / 180;
    const x = (cx + r * Math.cos(rad)).toFixed(1), y = (cy + r * Math.sin(rad)).toFixed(1);
    out += `<text x="${x}" y="${y}" font-size="6" fill="${textColor}" text-anchor="middle" dominant-baseline="central" opacity="0.8">${i + 1}</text>`;
  }
  return out;
}
function outerPlanetMarkersSVG(p, cx, cy, r, textColor) {
  if (!p?.bazi?.birthMomentUTC) return '';
  const natal = computeNatalOuterPlanetPositions(p.bazi.birthMomentUTC);
  return Object.keys(natal).map(planet => {
    const { lon } = natal[planet];
    const { glyph, color } = OUTER_PLANET_GLYPH[planet];
    const pt = planetMarkerPoint(cx, cy, r, lon);
    return `<circle cx="${pt.x}" cy="${pt.y}" r="6" fill="${color}"/><text x="${pt.x}" y="${pt.y}" font-size="8" fill="${textColor}" text-anchor="middle" dominant-baseline="central" font-weight="bold">${glyph}</text>`;
  }).join('');
}
// ENHANCEMENT (requested directly: "why are there only 5 planets plotted in the chart, plot all and
// include the eclipse and the eclipse trail as 2 separate planets"): the wheels used to plot only the
// Sun (its own special large marker, unchanged below) plus the 5 outer planets via outerPlanetMarkersSVG
// above (kept, unchanged, for backward compatibility - it is no longer called by the wheels below). This
// plots the remaining 6 points a full natal chart needs - Moon, Mercury, Venus, Mars (the "personal"
// planets), Jupiter/Saturn (the "social" planets, already covered above but included here too for a
// single unified pass) and the North/South Node (the eclipse axis) - reusing computeFullNatalChart, the
// same real, verified computation already powering the Full Natal Chart Deep Reading. Markers are spread
// across 3 concentric rings by category (personal planets nearest the rim, the Nodes and social planets
// in the middle, the slow-moving transpersonal planets nearest the centre) purely to reduce glyph overlap
// when several points share a similar longitude - it carries no astrological meaning of its own.
function fullChartMarkersSVG(p, cx, cy, rMax, textColor) {
  if (!p?.bazi?.birthMomentUTC) return '';
  const natal = computeFullNatalChart(p.bazi.birthMomentUTC);
  const RING_R = {
    moon: rMax, mercury: rMax, venus: rMax, mars: rMax,
    jupiter: rMax * 0.72, saturn: rMax * 0.72, northnode: rMax * 0.72, southnode: rMax * 0.72,
    uranus: rMax * 0.46, neptune: rMax * 0.46, pluto: rMax * 0.46
  };
  return Object.keys(RING_R).map(key => {
    const { lon } = natal[key];
    const info = PLANET_INFO_FULL[key];
    const pt = planetMarkerPoint(cx, cy, RING_R[key], lon);
    return `<circle cx="${pt.x}" cy="${pt.y}" r="5.5" fill="${info.color}"/><text x="${pt.x}" y="${pt.y}" font-size="7.5" fill="${textColor}" text-anchor="middle" dominant-baseline="central" font-weight="bold">${info.glyph}</text>`;
  }).join('');
}
// ENHANCEMENT (requested directly: real Ascendant-based houses) - a small shared helper so both wheels
// below draw the same house-cusp layer (12 lines + house-number labels + an "ASC" tag at the house-1
// cusp) consistently, only when this profile actually has houses on file (see computeNatalHouses).
function houseWheelLayer(p, cx, cy, rOuter, rLabel, stroke) {
  if (!p?.houses) return '';
  const ascPt = planetMarkerPoint(cx, cy, rOuter, p.houses.ascendant);
  return `${houseCuspLinesSVG(cx, cy, rOuter, rLabel - 6, stroke, p.houses.ascendant)}${houseNumberLabelsSVG(cx, cy, rLabel, p.houses.ascendant, stroke)}<text x="${ascPt.x}" y="${ascPt.y}" font-size="6.5" fill="${stroke}" text-anchor="middle" font-weight="bold">ASC</text>`;
}
function getCalculatedAstrologyChartHTML(p) {
  const lon = (p?.bazi?.birthMomentUTC) ? computeNatalSunLongitude(p.bazi.birthMomentUTC) : 0;
  const sunPt = planetMarkerPoint(80, 80, 65, lon);
  return `<svg viewBox="0 0 160 160" width="130" height="130" style="background:#fff;border-radius:50%;border:2px solid var(--gold);box-shadow:inset 0 0 10px rgba(184,134,53,0.2)"><circle cx="80" cy="80" r="74" fill="none" stroke="var(--plum)" stroke-width="1.5" stroke-dasharray="3,3"/><circle cx="80" cy="80" r="56" fill="none" stroke="var(--line)" stroke-width="1"/>${zodiacSpokeLinesSVG(80, 80, 74, 56, 'var(--line)')}<line x1="80" y1="6" x2="80" y2="154" stroke="var(--line)" stroke-width="1"/><line x1="6" y1="80" x2="154" y2="80" stroke="var(--line)" stroke-width="1"/>${houseWheelLayer(p, 80, 80, 55, 50, 'var(--plum)')}${fullChartMarkersSVG(p, 80, 80, 42, '#fff')}<circle cx="${sunPt.x}" cy="${sunPt.y}" r="8" fill="var(--gold)"/><text x="${sunPt.x}" y="${sunPt.y}" font-size="9" fill="#fff" text-anchor="middle" dominant-baseline="central" font-weight="bold">☉</text></svg>`;
}
function getNatalChartDiagramHTML(p) {
  const lon = (p?.bazi?.birthMomentUTC) ? computeNatalSunLongitude(p.bazi.birthMomentUTC) : 0;
  const sunPt = planetMarkerPoint(80, 80, 58, lon);
  return `<svg viewBox="0 0 160 160" width="130" height="130" style="background:#20273b;border-radius:50%;border:2px solid var(--plum)"><circle cx="80" cy="80" r="72" fill="none" stroke="var(--gold)" stroke-width="2"/><circle cx="80" cy="80" r="45" fill="none" stroke="var(--goldsoft)" stroke-width="1" stroke-dasharray="4,2"/>${zodiacSpokeLinesSVG(80, 80, 72, 45, 'var(--goldsoft)')}${houseWheelLayer(p, 80, 80, 38, 34, '#f2c98a')}${fullChartMarkersSVG(p, 80, 80, 30, '#20273b')}<circle cx="${sunPt.x}" cy="${sunPt.y}" r="6" fill="#f2c98a"/><text x="80" y="84" font-size="9" fill="#f2c98a" text-anchor="middle" font-weight="bold">${(p?.astro?.en || 'Aro').slice(0,3)}</text></svg>`;
}
// The legend + sign-by-sign breakdown shown alongside the two wheels above, so the (now full-chart, 12-
// point) markers are actually legible (a 7.5px glyph on its own doesn't communicate which point or which
// sign it's in) rather than being decorative dots with no accompanying text. Expanded (this round) from
// the 5 outer planets to every point the wheels now plot - Sun through the North/South Node.
function getNatalOuterPlanetsLegendHTML(p) {
  if (!p?.bazi?.birthMomentUTC) return '';
  const natal = computeFullNatalChart(p.bazi.birthMomentUTC);
  // ENHANCEMENT (requested directly: real Ascendant-based houses) - shows each point's house number
  // alongside its sign whenever this profile has houses on file (see computeNatalHouses/computeNatalPointHouses).
  const pointHouses = p?.houses ? computeNatalPointHouses(natal, p.houses) : null;
  const rows = NATAL_ASPECT_PLANET_ORDER.map(key => {
    const info = PLANET_INFO_FULL[key];
    const sign = natal[key].sign;
    const houseNote = pointHouses ? bt(` (House ${pointHouses[key]})`, `（第${pointHouses[key]}宫）`) : '';
    return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:${info.color};color:#fff;font-size:10px;font-weight:bold">${info.glyph}</span>
      <span>${bt(`${info.en}: ${sign.en}`, `${info.zh}：${sign.zh}`)}${houseNote}</span>
    </div>`;
  }).join('');
  const ascRow = p?.houses ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0;border-top:1px dashed var(--goldsoft);margin-top:4px;padding-top:4px">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--plum);color:#fff;font-size:9px;font-weight:bold">ASC</span>
      <span>${bt(`Ascendant: ${p.houses.ascendantSign.en}`, `上升星座：${p.houses.ascendantSign.zh}`)}</span>
    </div>` : '';
  return `<div style="min-width:150px">${rows}${ascRow}</div>`;
}

// ============================================================
// ENHANCEMENT (requested directly: "go deeper for the western astrology section... chart out all
// planets into a natal chart and provide a natal reading", plus a real annual and monthly deep reading
// "based on the movements of the planets and how it impacts the natal chart"). This extends the
// planetary-position engine above (Sun + 5 outer planets, already real/verified) to also cover Mercury,
// Venus, Mars, and the Moon - the remaining classical "planets" a natal chart conventionally includes.
// The Ascendant/houses remain OUT OF SCOPE and are not silently approximated: that specifically needs
// precise sidereal time AND geographic latitude (see the honesty note above computeTransitingPositions),
// and this app still only collects birth longitude, not latitude. Every reading below is built from
// real computed planetary longitudes/aspects for the specific profile, not template text.
// ============================================================

// Mercury/Venus/Mars: the SAME unperturbed 2-body Kepler orbit already used above for Neptune/Pluto
// (this tutorial's own method applies no further correction terms to these three either, at this
// precision level). heliocentricToGeocentricLongitude already generalizes to ANY planet's heliocentric
// position - it is a plain vector addition (Earth->Planet = Earth->Sun + Sun->Planet) - so no new
// geocentric-conversion logic is required to add them.
PLANET_ORBITAL_ELEMENTS.mercury = d => ({ N: 48.3313+3.24587E-5*d, i: 7.0047+5.00E-8*d, w: 29.1241+1.01444E-5*d, a: 0.387098, e: 0.205635+5.59E-10*d, M: astroRev(168.6562+4.0923344368*d) });
PLANET_ORBITAL_ELEMENTS.venus   = d => ({ N: 76.6799+2.46590E-5*d, i: 3.3946+2.75E-8*d, w: 54.8910+1.38374E-5*d, a: 0.723330, e: 0.006773-1.302E-9*d, M: astroRev(48.0052+1.6021302244*d) });
PLANET_ORBITAL_ELEMENTS.mars    = d => ({ N: 49.5574+2.11081E-5*d, i: 1.8497-1.78E-8*d, w: 286.5016+2.92961E-5*d, a: 1.523688, e: 0.093405+2.516E-9*d, M: astroRev(18.6021+0.5240207766*d) });

// Geocentric ecliptic longitude of the Moon - the Moon orbits Earth directly (no heliocentric step),
// and its raw 2-body orbit position can be off by more than a degree, which the Sun/outer-planet code
// above never needed to worry about (they're all being checked against much wider, multi-degree orbs).
// The Moon moves ~13deg/day, so a set of well-known correction terms (Evection, Variation, the Yearly
// Equation, and further named/unnamed periodic terms) is applied on top of the unperturbed orbit, using
// the same standard low-precision lunar theory this file's other planetary code is already drawn from.
function computeMoonEclipticLongitude(d) {
  const elems = { N: astroRev(125.1228-0.0529538083*d), i: 5.1454, w: astroRev(318.0634+0.1643573223*d), a: 60.2666, e: 0.054900, M: astroRev(115.3654+13.0649929509*d) };
  const E = solveKeplerEquation(elems.M, elems.e);
  const xv = elems.a*(astroCosd(E)-elems.e), yv = elems.a*(Math.sqrt(1-elems.e*elems.e)*astroSind(E));
  const v = astroAtan2d(yv, xv), r = Math.sqrt(xv*xv+yv*yv);
  const vw = v + elems.w;
  const xh = r*(astroCosd(elems.N)*astroCosd(vw) - astroSind(elems.N)*astroSind(vw)*astroCosd(elems.i));
  const yh = r*(astroSind(elems.N)*astroCosd(vw) + astroCosd(elems.N)*astroSind(vw)*astroCosd(elems.i));
  let lon = astroAtan2d(yh, xh);
  const Ms = astroRev(356.0470+0.9856002585*d); // Sun's mean anomaly
  const wSun = 282.9404+4.70935E-5*d;           // Sun's argument of perihelion
  const Ls = astroRev(wSun + Ms);               // Sun's mean longitude
  const Mm = elems.M;                           // Moon's mean anomaly
  const Lm = astroRev(elems.N + elems.w + Mm);  // Moon's mean longitude
  const D = astroRev(Lm - Ls);                  // Moon's mean elongation from the Sun
  const F = astroRev(Lm - elems.N);             // Moon's argument of latitude
  lon += -1.274*astroSind(Mm-2*D) + 0.658*astroSind(2*D) - 0.186*astroSind(Ms) - 0.059*astroSind(2*Mm-2*D)
       - 0.057*astroSind(Mm-2*D+Ms) + 0.053*astroSind(Mm+2*D) + 0.046*astroSind(2*D-Ms) + 0.041*astroSind(Mm-Ms)
       - 0.035*astroSind(D) - 0.031*astroSind(Mm+Ms) - 0.015*astroSind(2*F-2*D) + 0.011*astroSind(Mm-4*D);
  return astroRev(lon);
}

// ENHANCEMENT (requested directly: "why are there only 5 planets plotted in the chart, plot all and
// include the eclipse and the eclipse trail as 2 separate planets"): the Moon's ascending-node longitude
// is already computed above as part of the Moon's own orbital elements (elems.N, the "N" in the standard
// {N,i,w,a,e,M} orbital-element set) - it is the same quantity classically called the (Mean) North Node,
// and it is the point where solar/lunar eclipses occur (the Moon must be near one of its two nodes for
// an eclipse to happen - hence "the eclipse point"). The South Node ("the eclipse trail") is, by
// definition, always exactly 180 degrees opposite it. This uses the MEAN node (a smooth, steadily-
// regressing point, ~19.3 degrees/year retrograde) rather than the astronomically "true" (osculating)
// node, which oscillates around the mean by as much as ~1.5 degrees on a roughly-monthly cycle - a
// standard, disclosed simplification (the same precision tier as the rest of this file's low-precision
// orbital-mechanics method), verified directly against a real independent ephemeris (prokerala.com) for
// 2026-09-28: this formula placed the North Node at Aquarius 27.9 degrees against that source's TRUE
// node position of Aquarius 29.4 degrees - a 1.5-degree gap, exactly the expected mean-vs-true amplitude,
// confirming the formula itself is correct for what it claims to compute (the mean node).
function computeLunarNodes(d) {
  const northNode = astroRev(125.1228 - 0.0529538083*d);
  return { northnode: northNode, southnode: astroRev(northNode + 180) };
}

// All 12 natal points this app charts (the 10 classical planets - Sun, Moon, Mercury, Venus, Mars,
// Jupiter, Saturn, Uranus, Neptune, Pluto - plus the Moon's North and South Node, the two "eclipse
// points"), each with its real longitude and zodiac sign, from one real birth moment. Sun + the 5 outer
// planets reuse computeTransitingPositions directly (the exact same verified, perturbation-corrected
// path already used by computeNatalOuterPlanetPositions above) rather than a second implementation.
const NATAL_ASPECT_PLANET_ORDER = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','northnode','southnode'];
function computeFullNatalChart(birthMomentUTC) {
  const y = birthMomentUTC.getUTCFullYear(), m = birthMomentUTC.getUTCMonth()+1, dd = birthMomentUTC.getUTCDate();
  const ut = birthMomentUTC.getUTCHours() + birthMomentUTC.getUTCMinutes()/60;
  const d = astroDayNumber(y, m, dd, ut);
  const transiting = computeTransitingPositions(y, m, dd, ut);
  const result = {};
  ['sun','jupiter','saturn','uranus','neptune','pluto'].forEach(k => { result[k] = { lon: transiting[k], sign: zodiacSignForLongitude(transiting[k]) }; });
  const moonLon = computeMoonEclipticLongitude(d);
  result.moon = { lon: moonLon, sign: zodiacSignForLongitude(moonLon) };
  const sunPos = computeSunEclipticPosition(d);
  ['mercury','venus','mars'].forEach(name => {
    const helio = computeHeliocentricPosition(PLANET_ORBITAL_ELEMENTS[name](d));
    const lon = heliocentricToGeocentricLongitude(helio.lon, helio.lat, helio.r, sunPos.lon, sunPos.r);
    result[name] = { lon, sign: zodiacSignForLongitude(lon) };
  });
  const nodes = computeLunarNodes(d);
  result.northnode = { lon: nodes.northnode, sign: zodiacSignForLongitude(nodes.northnode) };
  result.southnode = { lon: nodes.southnode, sign: zodiacSignForLongitude(nodes.southnode) };
  return result;
}

// ============================================================
// ENHANCEMENT (requested directly: a whiteboard sketch of a 12-house wheel + "There should be 12 houses
// to plot out" -> the user then explicitly chose "Real Ascendant-based houses (Placidus/Equal from true
// Ascendant)" when asked, over a no-new-data Whole-Sign/Equal-from-Sun shortcut). The Ascendant (the
// zodiac degree rising on the eastern horizon at the birth moment) is the one natal-chart quantity this
// app genuinely could not compute before now, because it needs TWO things the rest of this file's
// planetary math never required: (1) a genuinely real UTC birth instant - NOT the true-solar-time
// birthMomentUTC used everywhere else in this file, since Local Sidereal Time advances a full 360 degrees
// every ~23h56m, so even an hour of mislabeling shifts the Ascendant by ~15 degrees (see
// computeRealBirthUTCMoment above); and (2) the birth LATITUDE, which this app is only now (this round)
// collecting as an optional per-profile field (see autoPopulateLonTz/readLatitude in app.js) - longitude
// alone was never enough.
//
// METHOD: standard low-precision sidereal-time formulas (the same tier of method, and the same author's
// convention, as the rest of this file's Sun/planet positions): Greenwich Mean Sidereal Time at 0h UT is
// derived from the Sun's own mean longitude (GMST0 = Ls + 180 degrees), advanced by the sidereal rate
// (~1.0027379 degrees of sidereal time per degree of solar time) for the real UT time-of-day, then shifted
// by the birth longitude to get the Right Ascension of the Midheaven (RAMC, aka Local Sidereal Time). The
// Ascendant is then the standard RAMC/obliquity/latitude formula below. Verified by construction (each
// intermediate quantity - GMST0, RAMC, obliquity - matches this file's/the standard convention's own
// formulas) rather than against a second independent ephemeris source, since (unlike the planetary
// positions) this app does not currently have a birth-latitude test profile to cross-check against a
// public chart-calculation site - flagged honestly in the natal reading's caveats below.
//
// HOUSE SYSTEM: this uses the EQUAL HOUSE system (each house is a full, undistorted 30-degree slice
// starting at the Ascendant) rather than Placidus (the most common system among professional astrologers,
// which uses unequal, latitude-and-declination-dependent house sizes and requires an iterative numerical
// solution with no simple closed-form formula). This is the specific, disclosed convention chosen here -
// consistent with this file's established pattern of naming which specific convention is used wherever
// professional astrologers genuinely differ (aspect orbs, the Mean vs True Lunar Node, etc.) - not a
// silent substitute presented as Placidus.
function astroDayNumberAtUT0(y, m, dd) { return astroDayNumber(y, m, dd, 0); }
function computeAscendant(realBirthMomentUTC, lonDeg, latDeg) {
  const y = realBirthMomentUTC.getUTCFullYear(), m = realBirthMomentUTC.getUTCMonth() + 1, dd = realBirthMomentUTC.getUTCDate();
  const utHours = realBirthMomentUTC.getUTCHours() + realBirthMomentUTC.getUTCMinutes() / 60 + realBirthMomentUTC.getUTCSeconds() / 3600;
  // GMST0: Greenwich Mean Sidereal Time at 0h UT for this calendar date, from the Sun's own mean longitude.
  const d0 = astroDayNumberAtUT0(y, m, dd);
  const wSun0 = 282.9404 + 4.70935E-5 * d0;
  const MSun0 = astroRev(356.0470 + 0.9856002585 * d0);
  const Ls0 = astroRev(MSun0 + wSun0);
  const GMST0 = astroRev(Ls0 + 180);
  // Advance by the real UT time-of-day at the true sidereal rate, then shift by birth longitude (east
  // positive) to get RAMC (Right Ascension of the Midheaven), i.e. the Local Sidereal Time.
  const GMST = astroRev(GMST0 + utHours * 15.04106864);
  const RAMC = astroRev(GMST + lonDeg);
  // Obliquity of the ecliptic at the real birth moment (this file's own formula, reused for consistency).
  const dFull = astroDayNumber(y, m, dd, utHours);
  const obliquity = 23.4393 - 3.563E-7 * dFull;
  const ascendant = astroRev(astroAtan2d(-astroCosd(RAMC), astroSind(RAMC) * astroCosd(obliquity) + astroTand(latDeg) * astroSind(obliquity)));
  return { ascendant, ramc: RAMC, obliquity };
}
// Equal House cusps: 12 cusps of exactly 30 degrees each, starting at the Ascendant (house 1 cusp).
function computeEqualHouseCusps(ascendant) {
  const cusps = [];
  for (let i = 0; i < 12; i++) cusps.push(astroRev(ascendant + i * 30));
  return cusps;
}
// Which of the 12 equal houses a given ecliptic longitude falls into (1-12).
function assignHouseNumber(lon, ascendant) {
  return Math.floor(astroRev(lon - ascendant) / 30) + 1;
}
// Top-level entry point: computes the Ascendant/house-cusp data for a profile, or returns null when the
// profile has no birth latitude on file yet (an older profile, or one where a country/city was never
// (re)selected) - an honest "unavailable" rather than a guessed/defaulted latitude.
function computeNatalHouses(p) {
  if (!p?.bazi?.realBirthMomentUTC || typeof p.birthLatitude !== 'number' || isNaN(p.birthLatitude)) return null;
  const lon = Number(p.birthLongitude);
  if (isNaN(lon)) return null;
  const { ascendant, ramc, obliquity } = computeAscendant(p.bazi.realBirthMomentUTC, lon, p.birthLatitude);
  const cusps = computeEqualHouseCusps(ascendant);
  return { ascendant, ascendantSign: zodiacSignForLongitude(ascendant), cusps, ramc, obliquity };
}
// Assigns each of the 12 natal points in a computeFullNatalChart() result to its house number, given the
// houses object above (computeNatalHouses) - kept separate so callers that already have both objects
// don't need to recompute the Ascendant.
function computeNatalPointHouses(natalChart, houses) {
  if (!houses) return null;
  const result = {};
  NATAL_ASPECT_PLANET_ORDER.forEach(key => { result[key] = assignHouseNumber(natalChart[key].lon, houses.ascendant); });
  return result;
}
// The traditional 12 astrological houses' real-world life domains - a standard, classically-established
// convention (the same kind of public reference this file already uses for SIGN_PROFILE_TABLE/Element-
// Modality associations), not fabricated per profile. WHICH natal points fall in which house IS genuinely
// computed per profile (computeNatalPointHouses above).
const HOUSE_LIFE_AREAS = {
  1: EZ('the self: identity, appearance, and how you come across to others', '自我：身份认同、外在形象及给他人的第一印象'),
  2: EZ('money, possessions, personal values, and income', '金钱、财物、个人价值观及收入'),
  3: EZ('communication, siblings, short trips, and everyday learning', '沟通、手足关系、短程旅行及日常学习'),
  4: EZ('home, family roots, and one parent', '家庭、根源及双亲之一'),
  5: EZ('romance, creativity, self-expression, and children', '恋爱、创造力、自我表达及子女'),
  6: EZ('daily work, health routines, and habits of service', '日常工作、健康习惯及服务性事务'),
  7: EZ('partnerships, marriage, and one-to-one relationships/contracts', '伴侣关系、婚姻及一对一的关系／合约'),
  8: EZ('shared resources, intimacy, and deep transformation', '共享资源、亲密关系及深层转化'),
  9: EZ('higher learning, long-distance travel, philosophy, and belief systems', '高等教育、长途旅行、哲学及信仰体系'),
  10: EZ('career, public reputation, and authority', '事业、公众声誉及权威地位'),
  11: EZ('friendships, community, and hopes/goals', '友谊、社群及愿望目标'),
  12: EZ('the subconscious, solitude, and matters that stay hidden', '潜意识、独处及隐而未显的事务')
};

// Full natal aspect grid (all 45 unique pairs among the 10 points above), tightest orb first - the
// real basis for "characteristics" text below, not just a list of isolated sign placements.
function computeNatalAspectGrid(natalChart) {
  const aspects = [];
  for (let i = 0; i < NATAL_ASPECT_PLANET_ORDER.length; i++) {
    for (let j = i + 1; j < NATAL_ASPECT_PLANET_ORDER.length; j++) {
      const a = NATAL_ASPECT_PLANET_ORDER[i], b = NATAL_ASPECT_PLANET_ORDER[j];
      const found = findAspect(natalChart[a].lon, natalChart[b].lon);
      if (found) aspects.push({ a, b, ...found });
    }
  }
  aspects.sort((x, y) => x.orbUsed - y.orbUsed);
  return aspects;
}

// Display info (glyph/color/theme) for all 10 natal points - the 5 outer planets reuse OUTER_PLANET_INFO
// / OUTER_PLANET_GLYPH directly (single source of truth), Sun/Moon/Mercury/Venus/Mars are added here.
const PLANET_INFO_FULL = {
  sun: { en: 'Sun', zh: '太阳', glyph: '☉', color: '#e6a817', themeEN: 'core identity, vitality, and ego', themeZH: '核心身份、活力与自我' },
  moon: { en: 'Moon', zh: '月亮', glyph: '☾', color: '#8ea9c9', themeEN: 'emotions, instinct, and inner needs', themeZH: '情绪、本能与内在需求' },
  mercury: { en: 'Mercury', zh: '水星', glyph: '☿', color: '#7fae6a', themeEN: 'communication, thinking, and reasoning style', themeZH: '沟通、思维与推理方式' },
  venus: { en: 'Venus', zh: '金星', glyph: '♀', color: '#d883a8', themeEN: 'love, values, and attraction', themeZH: '爱情、价值观与吸引力' },
  mars: { en: 'Mars', zh: '火星', glyph: '♂', color: '#c1443c', themeEN: 'drive, assertiveness, and competition', themeZH: '动力、进取心与竞争方式' }
};
Object.keys(OUTER_PLANET_INFO).forEach(k => { PLANET_INFO_FULL[k] = { ...OUTER_PLANET_INFO[k], glyph: OUTER_PLANET_GLYPH[k].glyph, color: OUTER_PLANET_GLYPH[k].color }; });
// ENHANCEMENT (requested directly: "plot all [planets] and include the eclipse and the eclipse trail as
// 2 separate planets"): the North Node ("the eclipse point" - see computeLunarNodes above) and South
// Node ("the eclipse trail", always exactly opposite it) are added here as their own full chart points,
// alongside the 10 classical planets above, so every downstream consumer of PLANET_INFO_FULL (the chart
// wheels, the legend, the natal reading, and the annual/monthly transit interpretations below) treats
// them as first-class natal points rather than a special case.
PLANET_INFO_FULL.northnode = { en: 'North Node', zh: '北交点', glyph: '☊', color: '#c9a227', themeEN: "your karmic growth direction - the eclipse point, and the qualities life is pushing you to develop", themeZH: '业力成长方向——日月食点，也是生命正推动您去发展的特质' };
PLANET_INFO_FULL.southnode = { en: 'South Node', zh: '南交点', glyph: '☋', color: '#6b6b6b', themeEN: "your inherited comfort zone - the eclipse trail, and the familiar patterns you are better served releasing than clinging to", themeZH: '与生俱来的舒适圈——日月食的轨迹，也是您宜释放而非执着的熟悉模式' };

// ENHANCEMENT (requested directly: "the descriptions ... only mentions the planet movements. Explain in
// detail what those mean to the profile"): the annual/monthly deep readings used to just name an aspect
// ("Transiting Jupiter Trine your natal Venus") plus a one-clause theme mash-up. That named the movement
// but never spelled out what it actually means for this person's life. PLANET_IMPACT_AREAS gives each
// natal point's concrete, real-world domains (not just an abstract theme word), and TRANSIT_VERB_PHRASES
// gives each transiting planet's characteristic effect depending on whether the aspect it forms is
// harmonious (Trine/Sextile), challenging (Square/Opposition), or a Conjunction (which blends the two
// planets' energies, so its own tone follows CONJUNCTION_VALENCE below rather than being fixed).
// describeTransitAspectMeaning combines the two into one concrete, profile-specific sentence.
const PLANET_IMPACT_AREAS = {
  sun: EZ('your sense of self, vitality, and overall life direction', '您的自我认同、活力与整体人生方向'),
  moon: EZ('your emotional life, home, and sense of inner security', '您的情绪生活、家庭及内心安全感'),
  mercury: EZ('communication, contracts, negotiations, and day-to-day decisions', '沟通、合约、谈判及日常决策事务'),
  venus: EZ('relationships, romance, finances, and personal values', '人际关系、恋爱、财务及个人价值观'),
  mars: EZ('drive, physical energy, conflict, and how assertively you pursue what you want', '行动力、体能、冲突处理及争取所求时的积极程度'),
  jupiter: EZ('growth, opportunity, education, travel, and overall luck', '成长、机会、教育、旅行及整体运势'),
  saturn: EZ('career structure, long-term responsibilities, and major commitments', '事业架构、长期责任及重大承诺'),
  uranus: EZ('independence, technology, and sudden, unplanned change', '独立自主、科技及突发的计划外变化'),
  neptune: EZ('intuition, creativity, boundaries, and spiritual/emotional clarity', '直觉、创造力、界限感及灵性／情感层面的清晰度'),
  pluto: EZ('deep transformation, power dynamics, and matters you cannot easily control', '深层转化、权力动态及难以轻易掌控的事务'),
  northnode: EZ('the growth direction you are being called toward - new, sometimes unfamiliar territory worth leaning into', '正被召唤前往的成长方向——值得把握的全新且或感陌生的领域'),
  southnode: EZ('old, familiar patterns and past investments you may be asked to release or rebalance', '过往熟悉的模式与既有投入，可能需要您释放或重新调整平衡')
};
const TRANSIT_VERB_PHRASES = {
  sun: { harmonious: EZ('brings a welcome boost of confidence, visibility, and energy to', '为...带来一股受欢迎的信心、能见度与活力提升'),
    challenging: EZ('creates friction around self-assertion and ego - a good moment to check whether you are being heard, or overreaching, in', '在自我表达与自尊层面产生摩擦——适合检视自己在此方面是被听见，还是用力过猛'),
    conjunction: EZ('puts a spotlight directly on', '将聚光灯直接照向') },
  jupiter: { harmonious: EZ('opens up a genuine window for growth, lucky breaks, and expansion in', '为...打开真正的成长、幸运机会与扩展窗口'),
    challenging: EZ('tempts you toward overconfidence or overcommitting in', '在此方面容易诱使您过度自信或承担过多'),
    conjunction: EZ('markedly expands and amplifies (for better AND for excess, if unchecked)', '显著扩大并放大（若不加节制，可能好事与过度并存）') },
  saturn: { harmonious: EZ('rewards patient, disciplined effort with real, lasting structure in', '以真实且持久的架构，回报耐心与自律的付出'),
    challenging: EZ('applies real pressure and tests your staying power in', '带来实质压力，考验您在此方面的持久力'),
    conjunction: EZ('adds weight, responsibility, and a hard-but-fair reality check to', '为...增添分量、责任，以及严峻却公允的现实检验') },
  uranus: { harmonious: EZ('brings a liberating, positive surprise or upgrade to', '为...带来解放性的正向惊喜或提升'),
    challenging: EZ('can trigger sudden, destabilizing disruption in', '可能在此方面引发突发且具破坏性的变动'),
    conjunction: EZ('electrifies and destabilizes (in a way that ultimately modernizes)', '带来激荡与不稳（但最终有助于革新）') },
  neptune: { harmonious: EZ('adds inspiration, compassion, and a sense of flow to', '为...增添灵感、同理心与顺流感'),
    challenging: EZ('risks confusion, over-idealization, or blurred boundaries in', '在此方面存在困惑、过度理想化或界限模糊的风险'),
    conjunction: EZ('dissolves hard edges - inspiring, but easy to lose clarity around', '软化了原有的界线——富启发性，但容易因此失去清晰的判断') },
  pluto: { harmonious: EZ('unlocks a deep, empowering transformation in', '在此方面开启一场深刻且赋能的转化'),
    challenging: EZ('can force an intense, all-or-nothing confrontation in', '可能在此方面引发强烈且不容妥协的对峙'),
    conjunction: EZ('intensifies and compels genuine, no-going-back change in', '强化并促使此方面发生真实、不可逆的改变') },
  northnode: { harmonious: EZ('aligns smoothly with your growth path, making it easier to lean into', '与您的成长方向顺畅对齐，让您更容易把握'),
    challenging: EZ('nudges you (not always comfortably) to grow past your habitual pattern in', '促使您（未必舒适地）跨越在此方面的惯性模式而成长'),
    conjunction: EZ('spotlights as a genuine, karmically-significant growth opportunity in', '标示出一个真实且具业力意义的成长机会，落在') },
  southnode: { harmonious: EZ('lets you comfortably draw on past strengths in', '让您能自在地运用过往在此方面累积的优势'),
    challenging: EZ('tempts you to retreat into an over-familiar, less productive pattern in', '容易诱使您退回过度熟悉却成效较低的旧模式'),
    conjunction: EZ('surfaces a familiar, past-oriented theme worth consciously releasing in', '浮现一个值得您有意识释怀的、偏向过去取向的熟悉主题，落在') }
};
function transitAspectBucket(aspectName) {
  if (aspectName === 'Conjunction') return 'conjunction';
  return (aspectName === 'Trine' || aspectName === 'Sextile') ? 'harmonious' : 'challenging';
}
function describeTransitAspectMeaning(a) {
  const transitInfo = PLANET_INFO_FULL[a.transitKey], natalInfo = PLANET_INFO_FULL[a.natalKey];
  const areas = PLANET_IMPACT_AREAS[a.natalKey];
  const bucket = transitAspectBucket(a.name);
  const verb = (TRANSIT_VERB_PHRASES[a.transitKey] || TRANSIT_VERB_PHRASES.sun)[bucket];
  // ENHANCEMENT (house activation, requested/prioritized directly: "Houses into Annual/Monthly astrology
  // first"): when this natal point's house is known (p.houses on file), name it and its real-world life
  // area (HOUSE_LIFE_AREAS) - a second, independent confirmation of which part of life this transit
  // actually touches, alongside the planet-based PLANET_IMPACT_AREAS phrase above.
  const houseNote = a.natalHouse
    ? { en: ` This also activates your House ${a.natalHouse} - ${HOUSE_LIFE_AREAS[a.natalHouse].en}.`, zh: `此相位同时触动您的第${a.natalHouse}宫——${HOUSE_LIFE_AREAS[a.natalHouse].zh}。` }
    : { en: '', zh: '' };
  return bt(`Transiting ${transitInfo.en} ${a.name} your natal ${natalInfo.en}: this ${verb.en} ${areas.en}.${houseNote.en}`,
    `行运${transitInfo.zh}${a.nameZh}本命${natalInfo.zh}：此相位${verb.zh}${areas.zh}。${houseNote.zh}`);
}
// Same idea as describeTransitAspectMeaning above, but for the Monthly Deep Reading's own transiting-Sun-
// sign-vs-natal-point layer (see computeMonthlyDeepReading/scoreAstroMonth) rather than a full aspect -
// reuses the Sun's own harmonious/challenging phrasing from TRANSIT_VERB_PHRASES, since this layer is
// specifically the transiting Sun's monthly sign.
function describeMonthlyHighlightMeaning(m, h) {
  const natalInfo = PLANET_INFO_FULL[h.natalKey];
  const areas = PLANET_IMPACT_AREAS[h.natalKey];
  const bucket = h.sameSign ? 'conjunction' : (h.score > 0 ? 'harmonious' : 'challenging');
  const verb = TRANSIT_VERB_PHRASES.sun[bucket];
  // BUG FIX (caught by this round's new house-activation test): this used to call bt() here directly,
  // which resolves to a plain STRING for the CURRENT language rather than an {en,zh} pair - so
  // relNote.en/relNote.zh below were always undefined, silently inserting the literal text "undefined"
  // into every monthly highlight description. Fixed by building a real {en,zh} pair instead, exactly
  // like houseNote just below, and resolving it with bt() only once, at the final return.
  const relNote = h.sameSign ? { en: ' (your solar-return month for this point)', zh: '（此本命点的「回归月」）' }
    : { en: ` (a ${h.elemRel} elemental relationship this month)`, zh: `（本月呈${{same:'相同',complementary:'互补',challenging:'挑战性'}[h.elemRel]}元素关系）` };
  // ENHANCEMENT (house activation - see describeTransitAspectMeaning above for the same technique applied
  // to the Annual Deep Reading): names this natal point's house/life-area when the profile has house data.
  const houseNote = h.natalHouse
    ? { en: ` This also activates your House ${h.natalHouse} - ${HOUSE_LIFE_AREAS[h.natalHouse].en}.`, zh: `此相位同时触动您的第${h.natalHouse}宫——${HOUSE_LIFE_AREAS[h.natalHouse].zh}。` }
    : { en: '', zh: '' };
  return bt(`The transiting Sun in ${m.transitSign.en} against your natal ${natalInfo.en}${relNote.en}: this ${verb.en} ${areas.en}.${houseNote.en}`,
    `行运太阳位于${m.transitSign.zh}，对照本命${natalInfo.zh}${relNote.zh}：此${verb.zh}${areas.zh}。${houseNote.zh}`);
}

// Per-sign reference table for the natal deep reading's career/industry/health/relationship/parenting
// content - standard, classically-established Western-astrology sign associations (the same kind of
// public, widely-cited convention this file already relies on for Element/Modality and Compatible/
// Incompatible sign lists above), not fabricated per profile. What IS genuinely computed per profile is
// WHICH of these 12 rows applies to which planet for this specific person, and which planets are
// blended together for each life-domain (career = Sun + Mars + Saturn; health = Sun + Mars; etc.).
//
// LOAD-ORDER FIX: this table (and the luck-template tables just below it) must NOT resolve their text
// via app.js's bt() at module-load time - index.html loads engine-metaphysics.js BEFORE app.js, so
// bt() does not exist yet when this file's top-level code runs (unlike the bt() calls elsewhere in
// this file, which all sit safely inside FUNCTION BODIES that are only ever called later, once app.js
// has finished loading). EZ() is a plain, load-order-safe {en, zh} pair-builder - callers resolve the
// actual display language later, at render time in app.js, via bt(pair.en, pair.zh).
function EZ(en, zh) { return { en, zh }; }
const SIGN_PROFILE_TABLE = {
  Aries: { careerTraits: EZ('pioneering, decisive, and thrives on competition and fast starts', '开拓进取、当机立断，喜好竞争与快速起步'),
    careers: EZ('entrepreneur, sales/business development, sports & fitness, military/emergency services, surgery', '创业者、业务拓展、体育与健身、军警／急救、外科医疗'),
    industries: EZ('startups, sports, defence & emergency response, direct sales', '初创企业、体育、国防与紧急救援、直销'),
    bodyArea: EZ('the head (headaches/migraines) and a tendency toward cuts, burns, or fevers from impulsiveness', '头部（头痛／偏头痛），及因冲动行事而易生的割伤、烫伤或发热'),
    relationshipStyle: EZ('passionate and direct, needs excitement, can be impatient in partnership', '热烈直接，需要新鲜刺激，在关系中可能较缺乏耐性'),
    parentingStyle: EZ('energetic and encourages independence, should guard against impatience with a slower-paced child', '充满活力、鼓励独立，需留意对步调较慢的孩子保持耐性') },
  Taurus: { careerTraits: EZ('steady, patient, and values security and tangible results', '稳重耐心，重视安全感与实质成果'),
    careers: EZ('finance/banking, real estate, agriculture, culinary arts, luxury goods & design', '金融银行、房地产、农业、餐饮／厨艺、奢侈品与设计'),
    industries: EZ('banking & finance, real estate, food & agriculture, luxury retail', '银行金融、房地产、食品与农业、奢侈品零售'),
    bodyArea: EZ('the throat and thyroid, with neck tension and a risk of overindulgence', '喉咙与甲状腺，易有颈部紧绷及饮食过量的倾向'),
    relationshipStyle: EZ('loyal and sensual, values stability, can be possessive or stubborn', '忠诚且感官细腻，重视稳定，可能较为占有欲强或固执'),
    parentingStyle: EZ('nurturing and provides material security, may resist a child\'s push for change', '养育性强、提供物质保障，可能较难适应孩子求变的诉求') },
  Gemini: { careerTraits: EZ('quick-witted, versatile, and thrives on variety and communication', '机智灵活、多才多艺，喜好多样性与沟通交流'),
    careers: EZ('journalism/writing, marketing, teaching, sales, media & broadcasting', '新闻／写作、市场营销、教学、销售、媒体与广播'),
    industries: EZ('media & publishing, telecoms, education, marketing', '媒体出版、电信、教育、市场营销'),
    bodyArea: EZ('the lungs, nervous system, and hands/arms, with anxiety-related issues', '肺部、神经系统与手臂，易有焦虑相关问题'),
    relationshipStyle: EZ('playful, needs mental stimulation, can appear inconsistent', '风趣活泼，需要思想上的刺激，有时显得反复不定'),
    parentingStyle: EZ('communicative and curious, a co-explorer with their children, may need to provide more routine/structure', '善于沟通、好奇心强，是孩子的探索伙伴，需留意提供更多常规与架构') },
  Cancer: { careerTraits: EZ('nurturing, intuitive, and protective of team and home', '养育性强、直觉敏锐，重视团队与家庭的保护'),
    careers: EZ('healthcare/nursing, hospitality, real estate, human resources, food service', '医疗护理、餐旅服务、房地产、人力资源、餐饮业'),
    industries: EZ('healthcare, hospitality & food, real estate, childcare & education', '医疗保健、餐旅与食品、房地产、幼教'),
    bodyArea: EZ('the stomach and digestion, chest, and emotional-eating patterns', '肠胃消化、胸部，及情绪性饮食倾向'),
    relationshipStyle: EZ('deeply caring, needs emotional security, can be moody or clingy', '深具关怀，需要情感上的安全感，可能情绪化或较依赖对方'),
    parentingStyle: EZ('highly nurturing and home-centred, may be overprotective', '养育性极强、以家庭为重，可能过度保护子女') },
  Leo: { careerTraits: EZ('charismatic, a natural leader, and thrives in the spotlight', '魅力十足、天生的领导者，喜好站在焦点之中'),
    careers: EZ('management/executive roles, performing arts, entertainment, public relations, entrepreneurship', '管理／高管职位、表演艺术、娱乐业、公关、创业'),
    industries: EZ('entertainment, media, luxury brands, executive leadership', '娱乐业、媒体、奢侈品牌、企业领导层'),
    bodyArea: EZ('the heart, spine/back, and circulatory system', '心脏、脊椎／背部及循环系统'),
    relationshipStyle: EZ('generous and warm, needs admiration, can be prideful', '慷慨热情，需要被欣赏认可，可能较为自尊心强'),
    parentingStyle: EZ('warm and encouraging, proud of their children\'s achievements, may push for the spotlight', '温暖且富鼓励性，为子女的成就感到自豪，可能较推崇子女展现自我') },
  Virgo: { careerTraits: EZ('analytical, detail-oriented, and service-minded', '善于分析、注重细节、乐于服务他人'),
    careers: EZ('accounting/analysis, healthcare & allied health, quality assurance, editing, operations & admin', '会计／分析、医疗保健相关、质量管理、编辑、行政营运'),
    industries: EZ('healthcare, finance & accounting, publishing & editing, operations & logistics', '医疗保健、财务会计、出版编辑、营运物流'),
    bodyArea: EZ('the digestive system, gut sensitivity, and stress-related issues', '消化系统、肠胃敏感及压力相关问题'),
    relationshipStyle: EZ('devoted and practical, can be overly critical of a partner', '忠诚务实，可能对伴侣过于苛求挑剔'),
    parentingStyle: EZ('attentive and detail-focused, may set very high standards', '细心周到、注重细节，可能对子女要求过高') },
  Libra: { careerTraits: EZ('diplomatic, fair-minded, and works well in partnership', '善于外交、公正持平，适合合作性质的工作'),
    careers: EZ('law, diplomacy & human resources, design, counselling, public relations', '法律、外交与人力资源、设计、咨询辅导、公关'),
    industries: EZ('legal services, design & aesthetics, human resources, diplomacy & public relations', '法律服务、设计美学、人力资源、外交公关'),
    bodyArea: EZ('the kidneys, lower back, and hormonal balance', '肾脏、下背部及荷尔蒙平衡'),
    relationshipStyle: EZ('romantic and harmony-seeking, can avoid necessary conflict', '浪漫、追求和谐，可能回避必要的冲突'),
    parentingStyle: EZ('fair and seeks balance among children, may struggle to enforce firm rules', '公平且力求子女间的平衡，可能较难坚持严格规范') },
  Scorpio: { careerTraits: EZ('intense, strategic, and comfortable with high stakes and transformation', '强烈专注、善于谋略，能坦然面对高风险与蜕变'),
    careers: EZ('research, psychology, investigation & finance, surgery, crisis management', '研究、心理学、调查与金融、外科医疗、危机管理'),
    industries: EZ('finance & investment, research & science, security & investigation, psychology', '金融投资、研究科学、安全调查、心理学'),
    bodyArea: EZ('the reproductive/urinary system and a tendency to suppress stress internally', '生殖／泌尿系统，及压抑压力于内的倾向'),
    relationshipStyle: EZ('deeply loyal and passionate, can be possessive or secretive', '深情忠诚，可能较占有欲强或隐秘'),
    parentingStyle: EZ('protective and deeply bonded, may struggle to let go and grant independence', '保护性强、亲子连结深厚，可能较难放手让子女独立') },
  Sagittarius: { careerTraits: EZ('adventurous, philosophical, and a big-picture thinker', '冒险进取、富哲思、擅长把握大局'),
    careers: EZ('travel & tourism, higher education, publishing, international business, coaching', '旅游业、高等教育、出版业、国际商务、教练培训'),
    industries: EZ('travel & tourism, education, publishing, international trade', '旅游业、教育、出版业、国际贸易'),
    bodyArea: EZ('the hips/thighs and liver, with overindulgence-related issues', '髋部／大腿及肝脏，易有饮食过量相关问题'),
    relationshipStyle: EZ('freedom-loving and honest, may resist commitment or routine', '崇尚自由、坦率真诚，可能较抗拒承诺或例行常规'),
    parentingStyle: EZ('encourages exploration and independence, may need to provide more consistency', '鼓励探索与独立，需留意提供更多的一致性') },
  Capricorn: { careerTraits: EZ('disciplined, ambitious, and plays a long game', '自律进取、雄心壮志，善于长远布局'),
    careers: EZ('management/executive roles, engineering, government & administration, corporate finance', '管理／高管职位、工程、政府行政、企业财务'),
    industries: EZ('government & public administration, engineering & construction, corporate finance', '政府公共行政、工程建筑、企业财务'),
    bodyArea: EZ('the knees, bones/joints, and skin, with stress from overwork', '膝盖、骨骼关节及皮肤，易因过度操劳而生压力'),
    relationshipStyle: EZ('committed and responsible, can be reserved or work-focused', '忠诚负责，可能较为内敛或专注于事业'),
    parentingStyle: EZ('structured and sets clear expectations, may need to soften strictness', '有条理、期望明确，需留意适度放宽严格程度') },
  Aquarius: { careerTraits: EZ('innovative, independent, and drawn to causes and ideas', '创新独立，热衷于理念与社会议题'),
    careers: EZ('technology & engineering, science, social work & activism, research', '科技工程、科学研究、社会工作与倡议、研究'),
    industries: EZ('technology, science & research, non-profit & social impact', '科技业、科学研究、非营利与社会公益'),
    bodyArea: EZ('the circulatory system and ankles, with nervous-system stress', '循环系统与脚踝，易有神经系统方面的压力'),
    relationshipStyle: EZ('values friendship-based connection and independence, can seem emotionally detached', '重视友谊为基础的连结与独立空间，有时显得情感疏离'),
    parentingStyle: EZ('encourages individuality and treats children as equals, may need to provide more warmth and routine', '鼓励个性发展、平等对待子女，需留意提供更多温暖与常规') },
  Pisces: { careerTraits: EZ('imaginative, empathetic, and drawn to creative or healing work', '富想象力、感同身受，倾向创意或疗愈性质的工作'),
    careers: EZ('creative arts, music, counselling & therapy, healthcare (nursing), non-profit work', '创意艺术、音乐、咨询治疗、医疗护理、非营利工作'),
    industries: EZ('arts & entertainment, healthcare, non-profit & social services', '艺术娱乐、医疗保健、非营利与社会服务'),
    bodyArea: EZ('the feet and immune system, with sensitivity to stress and escapism', '双脚及免疫系统，对压力与逃避现实较为敏感'),
    relationshipStyle: EZ('romantic and compassionate, can lose boundaries or over-idealize a partner', '浪漫富同理心，可能界限模糊或过度理想化伴侣'),
    parentingStyle: EZ('gentle and imaginative, may need firmer boundaries', '温柔富想象力，需留意建立更明确的界限') }
};

// Element/Modality-driven "luck" flavour templates (Direct Luck = Jupiter's own natal sign, Indirect/
// Hard-Won Luck = Saturn's own natal sign) - genuinely derived per profile from that planet's real
// natal Element+Modality, not fixed text, while keeping the underlying template compact and reusable
// across all 12 signs rather than 12 bespoke, harder-to-verify paragraphs per luck type.
const LUCK_ELEMENT_ARRIVAL = {
  Fire: EZ('through bold action and visibility - opportunities favour those who move first and put themselves forward', '透过果敢行动与展现自我而来——率先行动、勇于展现自身的人更容易把握机会'),
  Earth: EZ('through steady, tangible effort and real assets - opportunities compound slowly but reliably', '透过踏实积累与实质资产而来——机会虽积累缓慢，但稳健可靠'),
  Air: EZ('through networks, ideas, and communication - opportunities arrive via the right conversation or connection', '透过人脉、想法与沟通而来——机会往往经由适当的对话或人脉而至'),
  Water: EZ('through intuition, emotional connection, and good timing - opportunities arrive when the mood/moment feels right', '透过直觉、情感连结与恰当时机而来——当氛围与时机对了，机会便随之而至')
};
const LUCK_MODALITY_TIMING = {
  Cardinal: EZ('tends to arrive at the START of new ventures', '往往在新事业起步之初出现'),
  Fixed: EZ('builds and compounds the longer you stay the course', '随着坚持到底的时间越长而不断累积增强'),
  Mutable: EZ('arrives through adapting and seizing unplanned openings', '透过灵活应变、把握计划外的机会而来')
};
const DISCIPLINE_ELEMENT_FOCUS = {
  Fire: EZ('tempering impulsiveness and following through past the initial burst of enthusiasm', '克制冲动、在最初的热情消退后仍持续坚持到底'),
  Earth: EZ('avoiding excess rigidity and being too risk-averse when change is genuinely needed', '避免过度僵化，在确实需要改变时不过度规避风险'),
  Air: EZ('following through on ideas rather than moving on to the next one too soon', '将想法落实到底，而非过早转向下一个念头'),
  Water: EZ('setting clear emotional boundaries rather than letting feelings dictate every decision', '建立清晰的情感界限，而非任由情绪主导每个决定')
};
function describeDirectLuck(jupiterSign) {
  const em = ZODIAC_ELEMENT_MODALITY[jupiterSign.en];
  const arrival = LUCK_ELEMENT_ARRIVAL[em.element], timing = LUCK_MODALITY_TIMING[em.modality];
  return bt(`Jupiter in ${jupiterSign.en}: your Direct Luck - the growth and opportunity that arrives with comparatively little resistance - ${arrival.en}, and ${timing.en}.`,
    `木星在${jupiterSign.zh}：您的正财／直接福气——阻力相对较小的成长与机会——${arrival.zh}，且${timing.zh}。`);
}
function describeIndirectLuck(saturnSign) {
  const em = ZODIAC_ELEMENT_MODALITY[saturnSign.en];
  const focus = DISCIPLINE_ELEMENT_FOCUS[em.element];
  return bt(`Saturn in ${saturnSign.en}: your Indirect (Hard-Won) Luck - success that requires real discipline first - depends on ${focus.en}, but rewards compound over time once that discipline is in place.`,
    `土星在${saturnSign.zh}：您的偏财／努力所得的福气——需先付出真正自律才能获致的成功——关键在于${focus.zh}，一旦建立此自律，回报将随时间持续累积。`);
}

// ============================================================
// 5-tier scale shared by the new Annual Deep Reading and Monthly Deep Reading below, using the exact
// wording requested ("Very Auspicious, Auspicious, Neutral, Inauspicious, Very Inauspicious") - a
// distinct scale from this file's other 6/7-tier readings (DAYUN_TIER_LABELS/MONTHLY_TIER_LABELS),
// since this one is driven by a different, disclosed heuristic (real transiting-aspect scoring against
// the FULL natal chart, weighted by aspect type/orb/planet significance - a documented convention, not
// the only one in use among astrologers).
// ============================================================
const WESTERN_5TIER_LABELS = [
  { min: 4,          en: 'Very Auspicious',   zh: '非常吉利', abbr: 'VA', abbrZh: '非吉', color: '#1b5e20' },
  { min: 1.25,       en: 'Auspicious',        zh: '吉利',     abbr: 'A',  abbrZh: '吉',   color: '#66bb6a' },
  { min: -1.25,      en: 'Neutral',           zh: '中性',     abbr: 'N',  abbrZh: '中',   color: '#9e9e9e' },
  { min: -4,         en: 'Inauspicious',      zh: '不吉',     abbr: 'I',  abbrZh: '不吉', color: '#ef6c00' },
  { min: -Infinity,  en: 'Very Inauspicious', zh: '非常不吉', abbr: 'VI', abbrZh: '非不', color: '#b71c1c' }
];
function classifyWestern5Tier(score) { return WESTERN_5TIER_LABELS.find(t => score >= t.min); }

// Aspect-quality scoring for a transiting planet forming a real aspect to a natal point. Trine/Sextile
// are traditionally flowing/supportive, Square/Opposition traditionally more challenging; a Conjunction
// blends the two planets' energies, so its valence depends on which TRANSITING planet is involved
// (Jupiter/Venus conjunctions read positively, Saturn/Mars/Pluto more challenging, Uranus/Neptune mixed
// - a standard, disclosed convention). Orb tightness scales the effect (closer to exact = stronger), and
// slower-moving transiting planets carry more multi-year/month significance than the Sun's own snapshot.
const ASPECT_BASE_SCORE = { Trine: 3, Sextile: 2, Conjunction: 0, Square: -2, Opposition: -2.5 };
// ENHANCEMENT (requested directly: "include the eclipse and the eclipse trail as 2 separate planets"):
// the transiting Moon's North/South Node (the eclipse axis) is now checked against the full natal chart
// too, alongside the Sun and 5 outer planets. A North Node conjunction is traditionally read as a
// genuinely significant, karmically-favourable alignment (a moderate positive valence); a South Node
// conjunction leans mildly toward release/loss themes (a moderate negative valence) - both intentionally
// kept less extreme than Jupiter/Saturn's valence, since the Nodes are points of destiny/direction rather
// than planets exerting their own gravitational-style "pressure".
const CONJUNCTION_VALENCE = { sun: 1, moon: 1, mercury: 0.5, venus: 2.5, mars: -1.5, jupiter: 3, saturn: -2, uranus: -1, neptune: -0.5, pluto: -2, northnode: 1.5, southnode: -1 };
// The Nodes regress about 19.3 degrees/year (slower than the Sun, faster than Saturn) - weighted here
// between the Sun and the slower outer planets to reflect that pace and their traditionally significant,
// but not dominant, role in a whole-year reading.
const TRANSIT_PLANET_WEIGHT = { sun: 0.6, jupiter: 1.0, saturn: 1.3, uranus: 1.2, neptune: 1.1, pluto: 1.5, northnode: 0.9, southnode: 0.9 };
function scoreTransitAspect(a) {
  const base = a.name === 'Conjunction' ? CONJUNCTION_VALENCE[a.transitKey] : ASPECT_BASE_SCORE[a.name];
  const orbMultiplier = 1 - (a.orbUsed / a.orb) * 0.5;
  const weight = TRANSIT_PLANET_WEIGHT[a.transitKey] || 1;
  return base * orbMultiplier * weight;
}

// ============================================================
// ENHANCEMENT (requested directly: "for item 1 [all compatibility to show %], look at the western
// astrology section. % is missing there"): the "Astrology Compatibility" reading (Life/Business Partner)
// only ever compared the two people's Sun Signs against a classic compatible/incompatible list - a
// coarse 3-way categorical ("compatible"/"incompatible"/"neutral"), never a percentage, unlike every
// other compatibility reading in this app. This replaces/extends that with a genuine SYNASTRY score -
// the real, professionally-established technique of checking every one of one person's natal points
// against every one of the other person's, not just comparing Sun signs.
//
// computeSynastryAspects checks ALL 12x12 = 144 combinations between two people's full natal charts,
// using the exact same real findAspect() geometry already used for the single-chart natal aspect grid
// and the transit readings above - no new astronomical method, just applying it across two charts
// instead of one. Order matters here (unlike a single chart's own aspect grid): "my Venus aspecting your
// Mars" is a different real synastry contact from "my Mars aspecting your Venus," so both directions are
// kept, not deduplicated.
function computeSynastryAspects(chartA, chartB) {
  const aspects = [];
  NATAL_ASPECT_PLANET_ORDER.forEach(keyA => {
    NATAL_ASPECT_PLANET_ORDER.forEach(keyB => {
      const found = findAspect(chartA[keyA].lon, chartB[keyB].lon);
      if (found) aspects.push({ keyA, keyB, ...found });
    });
  });
  return aspects;
}
// Real synastry literature gives outsized weight to a handful of specific PERSONAL-planet conjunctions:
// Sun-Moon, Sun-Venus, and Moon-Venus are the classic "instant warmth/rapport" contacts; Venus-Mars is
// the classic attraction/chemistry contact; Saturn or Pluto conjunct a personal planet (Sun/Moon) is the
// classic "binding but restrictive/intense" contact. A conjunction between two SLOW-moving outer planets
// (e.g. both people's natal Uranus, or both natal Neptune) is near-guaranteed for anyone born within a
// few years of the other person and carries no real INDIVIDUAL significance for this specific pairing -
// scored at 0 rather than invented meaning, the same "don't fabricate significance" principle already
// applied elsewhere in this app (e.g. Huo Xing/Ling Xing being left unimplemented until a sourced
// formula was supplied).
const SYNASTRY_CONJUNCTION_FOCUS = {
  'sun-moon': 3.5, 'moon-sun': 3.5, 'sun-venus': 2.5, 'venus-sun': 2.5, 'moon-venus': 2.5, 'venus-moon': 2.5,
  'venus-mars': 3, 'mars-venus': 3,
  'saturn-sun': -2, 'sun-saturn': -2, 'saturn-moon': -2, 'moon-saturn': -2,
  'pluto-sun': -2, 'sun-pluto': -2, 'pluto-moon': -2, 'moon-pluto': -2
};
// Personal planets (Sun/Moon/Mercury/Venus/Mars) carry far more INDIVIDUAL (as opposed to generational)
// significance in a two-person synastry read than the slow outer planets - the same real-world reasoning
// already used for NATAL_PLANET_MONTHLY_WEIGHT above, applied here to weight each side of a synastry pair.
const SYNASTRY_PLANET_WEIGHT = { sun: 1.3, moon: 1.3, mercury: 1.0, venus: 1.2, mars: 1.1, jupiter: 0.7, saturn: 0.7, uranus: 0.3, neptune: 0.3, pluto: 0.3, northnode: 0.8, southnode: 0.8 };
function scoreSynastryAspect(a) {
  const focusKey = `${a.keyA}-${a.keyB}`;
  const base = a.name === 'Conjunction' ? (SYNASTRY_CONJUNCTION_FOCUS[focusKey] ?? 0) : ASPECT_BASE_SCORE[a.name];
  const orbMultiplier = 1 - (a.orbUsed / a.orb) * 0.5;
  const weight = (SYNASTRY_PLANET_WEIGHT[a.keyA] + SYNASTRY_PLANET_WEIGHT[a.keyB]) / 2;
  return base * orbMultiplier * weight;
}
// Combines the real synastry aspect grid above into one percentage, using the SAME baseline-72/clamped-
// 55-98 convention already used by calculateTrueCompatibility, so every compatibility score in this app
// reads on the same scale. `sunSignAdj` folds in the pre-existing classic Sun-sign compatible/
// incompatible check (kept, not discarded, as one real input among several - just no longer the only one).
function computeSynastryScore(chartA, chartB, sunSignAdj = 0) {
  const aspects = computeSynastryAspects(chartA, chartB);
  const scored = aspects.map(a => ({ ...a, weightedScore: scoreSynastryAspect(a) })).sort((x, y) => Math.abs(y.weightedScore) - Math.abs(x.weightedScore));
  const total = scored.reduce((s, a) => s + a.weightedScore, 0) + sunSignAdj;
  const score = Math.min(98, Math.max(55, Math.round(72 + total)));
  return { score, aspects: scored };
}

// ENHANCEMENT (requested directly, and previously scoped via AskUserQuestion as the recommended first
// follow-on item: "Houses into Annual/Monthly astrology first"): when a profile has real house data on
// file (p.houses - requires a birth latitude, see computeNatalHouses above), each transiting aspect below
// also names WHICH of the person's 12 houses the aspected natal point sits in - i.e. which real-world
// life area (HOUSE_LIFE_AREAS) that year's/month's transit is actually activating, a standard technique
// in real astrological practice ("house activation"). It also lets that house's ANGULARITY genuinely
// affect the weighted score: the 4 angular houses (1/4/7/10 - self, home, partnerships, career) are the
// traditionally most outwardly-impactful ones, the 4 succedent houses (2/5/8/11) a baseline middle
// ground, and the 4 cadent houses (3/6/9/12) traditionally more internal/adaptive and thus a touch less
// impactful - a real, disclosed, classically-established convention (the same kind of public reference
// this file already relies on for aspect-type/orb/planet-weight scoring), not a fabricated per-profile
// adjustment. Profiles with NO house data on file (p.houses === null) are handled honestly: no house
// note is added and no angularity multiplier is applied - the score and reading fall back exactly to
// this feature's pre-house behavior, never a guessed or defaulted house.
function houseAngularityMultiplier(houseNum) {
  if (houseNum === 1 || houseNum === 4 || houseNum === 7 || houseNum === 10) return 1.15; // angular
  if (houseNum === 2 || houseNum === 5 || houseNum === 8 || houseNum === 11) return 1.0;  // succedent
  return 0.9; // 3, 6, 9, 12 - cadent
}
// Annual Deep Reading: for each of `yearsCount` years (current year forward), checks the REAL
// geocentric positions of the Sun and 5 outer planets (mid-year snapshot, as computeYearlyTransitReport
// above already does) against ALL 10 natal points (not just the natal Sun, as the older yearly forecast
// did) - the genuine, disclosed convention of "transiting outer planets aspecting the full natal chart"
// used for a yearly overview in real astrological practice.
function computeAnnualDeepReading(p, yearsCount) {
  yearsCount = yearsCount || 3;
  const natalChart = computeFullNatalChart(p.bazi.birthMomentUTC);
  const houses = p.houses || null;
  const natalPointHouses = houses ? computeNatalPointHouses(natalChart, houses) : null;
  const nowY = new Date().getFullYear();
  const years = [];
  for (let i = 0; i < yearsCount; i++) {
    const yr = nowY + i;
    const positions = computeTransitingPositions(yr, 7, 1, 0);
    // The transiting North/South Node (the eclipse axis) - see computeLunarNodes - checked alongside the
    // Sun and 5 outer planets, against every one of the 12 natal points.
    const nodePositions = computeLunarNodes(astroDayNumber(yr, 7, 1, 0));
    const allTransitPositions = { ...positions, ...nodePositions };
    const found = [];
    ['sun', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'northnode', 'southnode'].forEach(transitKey => {
      NATAL_ASPECT_PLANET_ORDER.forEach(natalKey => {
        const asp = findAspect(allTransitPositions[transitKey], natalChart[natalKey].lon);
        if (asp) {
          const entry = { transitKey, natalKey, ...asp };
          if (natalPointHouses) entry.natalHouse = natalPointHouses[natalKey];
          found.push(entry);
        }
      });
    });
    const scored = found.map(a => {
      const raw = scoreTransitAspect(a);
      const weightedScore = a.natalHouse ? raw * houseAngularityMultiplier(a.natalHouse) : raw;
      return { ...a, weightedScore };
    });
    scored.sort((x, y) => y.weightedScore - x.weightedScore);
    const total = scored.reduce((s, a) => s + a.weightedScore, 0);
    const tier = classifyWestern5Tier(total);
    years.push({ year: yr, aspects: scored, score: total, tier, hasHouses: !!houses });
  }
  return { natalChart, years, houses };
}

// Monthly Deep Reading: blends that same year's outer-planet backdrop (spread evenly across its 12
// months) with a month-specific layer - the transiting Sun's own zodiac sign for that month (mid-month
// snapshot, exactly as compute3YearAstroMonthly's own honestly-scoped Sun-sign-transit method already
// does) checked against EVERY natal point's sign (not just the natal Sun), each weighted by how
// personally significant that natal point is to a "how does this month feel" reading (Sun/Moon weighted
// highest, outer planets lowest, since a natal outer-planet placement is a generational, not personal,
// signature).
const NATAL_PLANET_MONTHLY_WEIGHT = { sun: 1.5, moon: 1.5, mercury: 1.0, venus: 1.0, mars: 1.0, jupiter: 0.5, saturn: 0.5, uranus: 0.3, neptune: 0.3, pluto: 0.3, northnode: 0.6, southnode: 0.6 };
function computeMonthlyDeepReading(p, monthsCount) {
  monthsCount = monthsCount || 24;
  const natalChart = computeFullNatalChart(p.bazi.birthMomentUTC);
  const houses = p.houses || null;
  // Same house-activation technique as computeAnnualDeepReading above, applied here to each month's
  // natal-point highlights: which house that natal point sits in (an honest "unavailable" - not a
  // guessed default - when the profile has no birth latitude on file) and the same angular/succedent/
  // cadent weighting convention.
  const natalPointHouses = houses ? computeNatalPointHouses(natalChart, houses) : null;
  const annual = computeAnnualDeepReading(p, Math.ceil(monthsCount / 12) + 1);
  const now = new Date();
  const startYear = now.getFullYear(), startMonth = now.getMonth() + 1;
  const months = [];
  for (let i = 0; i < monthsCount; i++) {
    const totalIdx = (startMonth - 1) + i;
    const year = startYear + Math.floor(totalIdx / 12);
    const month = (totalIdx % 12) + 1;
    const yearData = annual.years.find(y => y.year === year) || annual.years[annual.years.length - 1];
    const backdropScore = yearData.score / 12;
    const transitSign = getAstrologySign(month, 15);
    const transitKey = transitSign.en;
    let monthlyScore = 0;
    const highlights = [];
    NATAL_ASPECT_PLANET_ORDER.forEach(natalKey => {
      const natalSignKey = natalChart[natalKey].sign.en;
      const weight = NATAL_PLANET_MONTHLY_WEIGHT[natalKey] || 0.5;
      const scoredRel = scoreAstroMonth(natalSignKey, transitKey);
      const natalHouse = natalPointHouses ? natalPointHouses[natalKey] : null;
      const s = scoredRel.score * weight * (natalHouse ? houseAngularityMultiplier(natalHouse) : 1);
      monthlyScore += s;
      if (Math.abs(s) >= weight * 1.4) highlights.push({ natalKey, score: s, elemRel: scoredRel.elemRel, sameSign: scoredRel.sameSign, natalHouse });
    });
    highlights.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    const total = backdropScore + monthlyScore;
    const tier = classifyWestern5Tier(total);
    months.push({ year, month, transitSign, transitKey, backdropScore, monthlyScore, score: total, tier, topYearAspects: yearData.aspects.slice(0, 2), highlights: highlights.slice(0, 3), hasHouses: !!houses });
  }
  let best = months[0], worst = months[0];
  months.forEach(m => { if (m.score > best.score) best = m; if (m.score < worst.score) worst = m; });
  return { natalChart, months, best, worst, houses };
}
