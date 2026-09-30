/* ========================================== */
/* GENERATORS, LOTTERY, AND PREDICTIONS       */
/* ========================================== */

function parseToDigits(inputStr) {
    let digits = '';
    for(let char of inputStr.toUpperCase()) {
       if(/[A-Z]/.test(char)) { let num = char.charCodeAt(0) - 64; while(num > 9) num = String(num).split('').reduce((a,b)=>a+Number(b),0); digits += num; } 
       else if (/[0-9]/.test(char)) { digits += char; }
    }
    return digits;
}

function analyzeNumbersDynamic(digitsStr, p, partnerP, isZh) {
   const dmElemZH = ['木','木','火','火','土','土','金','金','水','水']; const dmElemStr = ['Wood','Wood','Fire','Fire','Earth','Earth','Metal','Metal','Water','Water'];
   const numToElem = {1:'Water',6:'Water', 2:'Fire',7:'Fire', 3:'Wood',8:'Wood', 4:'Metal',9:'Metal', 5:'Earth',0:'Earth'};
   const numToElemZH = {1:'水',6:'水', 2:'火',7:'火', 3:'木',8:'木', 4:'金',9:'金', 5:'土',0:'土'};

   // BUG 3 FIX: was reading p.dayStemIdx (always undefined - the real path is p.bazi.dayStemIdx),
   // which silently broke the elemental filtering for vehicle/mobile number generation and scoring
   // (via JS "undefined" propagating through, and mod()'s NaN-safety net masking it by always
   // returning 0 - producing "0000" every time instead of a real elementally-supportive candidate).
   const e1 = dmElemStr[p.bazi.dayStemIdx]; const e2 = partnerP ? dmElemStr[partnerP.bazi.dayStemIdx] : null;
   let counts = {Water:0, Fire:0, Wood:0, Metal:0, Earth:0};
   for (let d of digitsStr) counts[numToElem[d]]++;
   const generates = { 'Water':'Wood', 'Wood':'Fire', 'Fire':'Earth', 'Earth':'Metal', 'Metal':'Water' };
   const clashes = { 'Water':'Fire', 'Fire':'Metal', 'Metal':'Wood', 'Wood':'Earth', 'Earth':'Water' };
   
   let clashCount = 0; let supportCount = 0; let clashElems = new Set(); let supportElems = new Set();
   Object.keys(counts).forEach(elem => {
     if(counts[elem] > 0) {
       if (clashes[elem] === e1 || clashes[e1] === elem) { clashCount += counts[elem]; clashElems.add(elem); }
       if (generates[elem] === e1 || elem === e1) { supportCount += counts[elem]; supportElems.add(elem); }
       if (e2) {
         if (clashes[elem] === e2 || clashes[e2] === elem) { clashCount += counts[elem]; clashElems.add(elem); }
         if (generates[elem] === e2 || elem === e2) { supportCount += counts[elem]; supportElems.add(elem); }
       }
     }
   });

   let scoreMod = (supportCount * 5) - (clashCount * 4);
   let text = isZh 
     ? `<strong>五行成分:</strong> 本命[${dmElemZH[p.bazi.dayStemIdx]}]${e2 ? `，伴侣[${dmElemZH[partnerP.bazi.dayStemIdx]}]` : ''}。组合包含 ${digitsStr.split('').map(d=>d+`(${numToElemZH[d]})`).join(', ')}。`
     : `<strong>Elements:</strong> You [${e1}]${e2 ? `, Partner [${e2}]` : ''}. Contains ${digitsStr.split('').map(d=>d+`(${numToElem[d]})`).join(', ')}.`;

   const maxElem = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) || 'Earth';
   const maxElemZH = maxElem === 'Water'?'水':maxElem === 'Wood'?'木':maxElem === 'Fire'?'火':maxElem === 'Earth'?'土':'金';
   const netBalance = supportCount - clashCount;
   const dominant = netBalance > 0 ? 'supportive' : netBalance < 0 ? 'draining' : 'neutral';

   // BUG FIX: hl (beyond item 1), pos, neg, cau were static boilerplate regardless of the actual
   // digits entered - the score changed but the "Deep Analysis" text never did. All four arrays now
   // reflect the real support/clash counts and which specific elements are driving them.
   let hl = [
       isZh ? `检测到强烈的 [${maxElemZH}] 元素共振 (出现 ${counts[maxElem]} 次)。` : `Strong resonance with [${maxElem}] element (appears ${counts[maxElem]}x).`,
       isZh ? `${supportCount} 位生扶本命日主，${clashCount} 位形成冲克。` : `${supportCount} digit(s) support your Day Master vs ${clashCount} clashing digit(s).`,
       isZh ? `整体五行倾向：${dominant === 'supportive' ? '助力' : dominant === 'draining' ? '耗损' : '中性'}。` : `Overall elemental tilt: ${dominant} (net ${netBalance >= 0 ? '+' : ''}${netBalance}).`
   ];
   
   let pos = supportCount > 0
     ? [
       isZh ? `${[...supportElems].join('、')} 元素直接生扶日主，提供长效助力。` : `The ${[...supportElems].join('/')} digits directly support your Day Master, providing sustained help.`,
       isZh ? `${supportCount} 组生扶数字有助稳定日常能量。` : `${supportCount} supportive digit(s) build steady, positive momentum through daily use.`,
       isZh ? '有助催旺贵人运与隐藏资源。' : 'Helps activate benefactor luck and hidden resources.'
     ]
     : [
       isZh ? '虽无直接生扶数字，但也未形成强烈冲克。' : 'No directly-supportive digits, but also no severe clash - a neutral baseline.',
       isZh ? '可作为中性号码长期使用。' : 'Workable as a neutral, low-risk number for daily use.',
       isZh ? '搭配幸运颜色可进一步增强效果。' : 'Pairing with your lucky colors can help reinforce this number\'s effect.'
     ];

   let neg = clashCount > 0
     ? [
       isZh ? `${[...clashElems].join('、')} 元素与日主形成冲克，可能带来能量耗损。` : `The ${[...clashElems].join('/')} digits clash with your Day Master, which may drain energy over time.`,
       isZh ? `${clashCount} 组冲克数字需要留意使用场合。` : `${clashCount} clashing digit(s) mean this number may amplify stress in high-pressure situations.`,
       isZh ? '长期高频使用可能放大冲克影响。' : 'Frequent, high-stakes use could amplify the clash over time.'
     ]
     : [
       isZh ? '数字构成独立闭环，不干扰本命核心。' : 'No clashing digits detected - the number does not work against your Day Master.',
       isZh ? '能量内敛，适合低调行事。' : 'Energy is reserved, suitable for low-profile, steady use.',
       isZh ? '不易被外界负面磁场冲刷。' : 'Resistant to external negative magnetic interference.'
     ];

   let cau = [
       clashCount > supportCount
         ? (isZh ? '冲克数字多于生扶，建议搭配化解物品或考虑更换。' : 'Clashing digits outweigh supportive ones - consider a remedy item or a different number if this is for a major purchase.')
         : (isZh ? '保持平和心态，切勿因好运而盲目冒进。' : 'Maintain grounded execution; do not blindly over-leverage even a supportive number.'),
       isZh ? '注意观察使用此号码后的前三个月能量变化。' : 'Observe energetic shifts within the first 3 months of usage.',
       isZh ? '若感觉受阻，可搭配幸运色衣物进行化解。' : 'If feeling blocked, deploy lucky colors as a physical remedy.'
   ];

   return { text, hl, pos, neg, cau, scoreMod, supportCount, clashCount };
}

function auditVehicleScore(inputVal, p, partnerP) {
   const digits = parseToDigits(inputVal); if (!digits.length) return { score: 50, explanation: '' };
   const sum = [...digits].map(Number).reduce((a, b) => a + b, 0); const elemCheck = analyzeNumbersDynamic(digits, p, partnerP, lang === 'zh');
   return { 
       score: Math.min(99, Math.max(40, 78 + elemCheck.scoreMod + (sum % 13))), 
       explanation: lang === 'zh' ? `字符转化总和: ${sum}。<br>${elemCheck.text}` : `Parsed Sum: ${sum}.<br>${elemCheck.text}`, 
       hl: elemCheck.hl, pos: elemCheck.pos, neg: elemCheck.neg, cau: elemCheck.cau 
   };
}

function auditMobileScore(inputVal, p, partnerP) {
   const digits = parseToDigits(inputVal); if (!digits.length) return { score: 50, explanation: '' };
   const sum = [...digits].map(Number).reduce((a, b) => a + b, 0); const elemCheck = analyzeNumbersDynamic(digits, p, partnerP, lang === 'zh');
   return {
       score: Math.min(99, Math.max(40, 80 + elemCheck.scoreMod + (sum % 11))),
       explanation: lang === 'zh' ? `总和: ${sum}。<br>${elemCheck.text}` : `Sum: ${sum}.<br>${elemCheck.text}`,
       hl: elemCheck.hl, pos: elemCheck.pos, neg: elemCheck.neg, cau: elemCheck.cau
   };
}

// ENHANCEMENT (this round): "Check Address Compatibility" - reuses the EXACT SAME verified digit/
// elemental-audit engine already built and tested for Mobile Number and Vehicle Plate (parseToDigits +
// analyzeNumbersDynamic), rather than attempting real geocoding (which this app deliberately does not
// do - see renderHomeDetailsBlock's own honesty note). An address is turned into a digit string the
// same way a plate or phone number is: letters fold down to single digits via the same A=1..Z=26
// repeated-digit-sum rule, house/unit/postal numbers pass through as-is, and any other punctuation is
// ignored - so "123 Orchard Road, Singapore" and "Blk 456 Ang Mo Kio Ave 3 #12-34" both yield a real,
// deterministic digit string to cross-reference against the household's Day Master(s), exactly the way
// a plate number already is. This gives a genuine, computed, non-fabricated compatibility score for
// "the address to be checked" without ever claiming to know anything about the physical property
// itself (facing direction / construction year remain their own, separate, real Flying Star inputs).
function auditAddressScore(inputVal, p, partnerP) {
   const digits = parseToDigits(inputVal); if (!digits.length) return { score: 50, explanation: '' };
   const sum = [...digits].map(Number).reduce((a, b) => a + b, 0); const elemCheck = analyzeNumbersDynamic(digits, p, partnerP, lang === 'zh');
   return {
       score: Math.min(99, Math.max(40, 79 + elemCheck.scoreMod + (sum % 12))),
       explanation: lang === 'zh' ? `地址转化数字总和: ${sum}。<br>${elemCheck.text}` : `Address-derived digit sum: ${sum}.<br>${elemCheck.text}`,
       hl: elemCheck.hl, pos: elemCheck.pos, neg: elemCheck.neg, cau: elemCheck.cau
   };
}

// BUG 1/2 FIX: previously the generator FAKED a 95-99% score (overwriting whatever the real audit
// returned) while the "Check" button used the real audit formula - so the same number could show two
// different scores depending on which button produced it. The generator now builds candidates purely
// from digits that are elementally supportive (same element as, or generating, the Day Master's
// element - and the partner's, if shared) so the REAL audit score reliably clears 95%, and it reports
// that real score directly instead of a fabricated one.
const NUM_TO_ELEM = {1:'Water',6:'Water', 2:'Fire',7:'Fire', 3:'Wood',8:'Wood', 4:'Metal',9:'Metal', 5:'Earth',0:'Earth'};
const ELEM_GENERATES = { 'Water':'Wood', 'Wood':'Fire', 'Fire':'Earth', 'Earth':'Metal', 'Metal':'Water' };
const ELEM_CLASHES = { 'Water':'Fire', 'Fire':'Metal', 'Metal':'Wood', 'Wood':'Earth', 'Earth':'Water' };
const DM_ELEM_STR = ['Wood','Wood','Fire','Fire','Earth','Earth','Metal','Metal','Water','Water'];

function buildSafeDigitPool(p, partnerP) {
   const e1 = DM_ELEM_STR[p.bazi.dayStemIdx]; const e2 = partnerP ? DM_ELEM_STR[partnerP.bazi.dayStemIdx] : null;
   const isSafe = (elem) => {
     const supportsE1 = elem === e1 || ELEM_GENERATES[elem] === e1;
     const clashesE1 = ELEM_CLASHES[elem] === e1 || ELEM_CLASHES[e1] === elem;
     if (clashesE1) return false;
     if (e2) {
       const clashesE2 = ELEM_CLASHES[elem] === e2 || ELEM_CLASHES[e2] === elem;
       if (clashesE2) return false;
     }
     return supportsE1 || (e2 && (elem === e2 || ELEM_GENERATES[elem] === e2));
   };
   const pool = Object.keys(NUM_TO_ELEM).filter(d => isSafe(NUM_TO_ELEM[d]));
   // Guaranteed non-empty: every element either supports, is neutral, or is filtered by clash - if the
   // pool ever comes back empty (only possible in a same-element-clash edge case), fall back to all
   // non-clashing digits so a candidate can still always be built.
   if (pool.length) return pool;
   return Object.keys(NUM_TO_ELEM).filter(d => !(ELEM_CLASHES[NUM_TO_ELEM[d]] === e1 || ELEM_CLASHES[e1] === NUM_TO_ELEM[d]));
}

// ENHANCEMENT FIX: 4D-style "System Roll" permutation count for a 4-digit string (used to prioritise
// vehicle plates / mobile last-4-digits that are cheaper/easier to bet as a 4D number: a number with
// repeated digits has fewer unique permutations - 24 (all different) is the most expensive/least
// preferred category, so we only fall back to it if nothing at 12-or-fewer clears the score bar).
function countPermutations4(str) {
  const counts = {};
  for (const c of str) counts[c] = (counts[c] || 0) + 1;
  let denom = 1;
  const fact = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  Object.values(counts).forEach(c => { denom *= fact(c); });
  return fact(str.length) / denom;
}

function generateUnanchoredMobile(p, partnerP, mDigits, prefix, offsetIndex = 0) {
   const pool = buildSafeDigitPool(p, partnerP);
   let suffixLen = (mDigits === 4) ? 4 : 7;

   // BUG 3 FIX: the previous pickDigit used a fixed linear stride (seed + i*733) through the pool -
   // when the safe pool has exactly 4 elements (a common case), stepping through 4 consecutive
   // positions with a stride coprime to 4 ALWAYS visits all 4 distinct pool values exactly once,
   // structurally guaranteeing 24 permutations (all-different digits) every single time, no matter
   // how many tries were attempted. The <=12-permutation search could therefore never succeed. Each
   // digit position is now drawn independently at random from the safe pool per try, which allows
   // genuine repeats (and therefore <=12-permutation candidates) to actually occur, while every digit
   // drawn is still from the same elementally-supportive pool, preserving the >=95% score guarantee.
   let best24 = null;
   for (let tries = 0; tries < 30; tries++) {
     let digits = ''; for (let i = 0; i < suffixLen; i++) digits += pool[Math.floor(Math.random() * pool.length)];
     const cand = (mDigits === 4) ? digits : prefix + digits;
     const res = auditMobileScore(cand, p, partnerP);
     const last4Perms = countPermutations4(digits.slice(-4));
     if (res.score >= 95) {
       if (last4Perms <= 12) { res.number = cand; res.attempts = tries + 1; res.permCount = last4Perms; return res; }
       if (!best24) { res.number = cand; res.attempts = tries + 1; res.permCount = last4Perms; best24 = res; }
     }
   }
   if (best24) return best24;
   // Final safety net if nothing hit 95 in 30 tries (should be extremely rare given the safe pool)
   let digits = ''; for (let i = 0; i < suffixLen; i++) digits += pool[Math.floor(Math.random() * pool.length)];
   const cand = (mDigits === 4) ? digits : prefix + digits;
   const res = auditMobileScore(cand, p, partnerP);
   res.number = cand; res.attempts = 31; res.permCount = countPermutations4(digits.slice(-4));
   return res;
}

function generateUnanchoredVehicle(p, partnerP, vDigits, offsetIndex = 0) {
   const pool = buildSafeDigitPool(p, partnerP);

   // BUG 3 FIX: same fix as generateUnanchoredMobile above - independent random draws per digit
   // position per try, instead of a deterministic linear stride that structurally could never
   // produce a repeated digit (and therefore never <=12 permutations) when the safe pool has exactly
   // 4 elements, a common case.
   let best24 = null;
   for (let tries = 0; tries < 30; tries++) {
     let cand = ''; for (let i = 0; i < vDigits; i++) cand += pool[Math.floor(Math.random() * pool.length)];
     const res = auditVehicleScore(cand, p, partnerP);
     const last4 = cand.length >= 4 ? cand.slice(-4) : cand.padStart(4, cand[0] || '0');
     const permCount = countPermutations4(last4);
     if (res.score >= 95) {
       if (permCount <= 12) { res.number = cand; res.attempts = tries + 1; res.permCount = permCount; return res; }
       if (!best24) { res.number = cand; res.attempts = tries + 1; res.permCount = permCount; best24 = res; }
     }
   }
   if (best24) return best24;
   let cand = ''; for (let i = 0; i < vDigits; i++) cand += pool[Math.floor(Math.random() * pool.length)];
   const res = auditVehicleScore(cand, p, partnerP);
   res.number = cand; res.attempts = 31; res.permCount = countPermutations4(cand.length >= 4 ? cand.slice(-4) : cand.padStart(4, cand[0] || '0'));
   return res;
}

// BUG 4 FIX: shared date formatter so "Upcoming" prediction dates use the EXACT SAME style as actual
// draw dates ("Wed 2 Sep 2026") everywhere in the lottery section, instead of the previous
// d.toLocaleDateString() call, which is locale-dependent (e.g. "9/9/2026" in en-US) and looked
// inconsistent next to the "Wed 2 Sep 2026"-style actual results.
const DRAW_DATE_DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DRAW_DATE_MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDrawDate(d) {
  return `${DRAW_DATE_DAY_ABBR[d.getDay()]} ${d.getDate()} ${DRAW_DATE_MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}
function check4DHit(testNum, testArr) { if (testArr.includes(testNum)) return 'direct'; const sortStr = s => s.split('').sort().join(''); if (testArr.some(a => sortStr(a) === sortStr(testNum))) return 'box'; return ''; }
function checkTOTOHit(num, actual) { return actual.winning.includes(num) || actual.additional === num; }
function highlightActual4D(numStr, suggestedArr) { const hitType = check4DHit(numStr, suggestedArr); if (hitType === 'direct') return `<span class="hl-act-direct">${numStr}</span>`; if (hitType === 'box') return `<span class="hl-act-box">${numStr}</span>`; return numStr; }
function highlightActualTOTO(num, suggestedSets) { let hit = false; suggestedSets.forEach(set => { if(set.includes(num)) hit = true; }); if (hit) return `<span class="hl-act-direct">${num}</span>`; return num; }

// ENHANCEMENT (this round): favourite-number highlighting, checked against ACTUAL drawn numbers
// (distinct from the existing suggested-number hit highlighting above, which stays unchanged).
// 4D: a favourite is a 4-digit number. Purple = exact same digit sequence as a winning number.
// Blue = same 4 digits in a different order (a permutation) but not an exact match.
// TOTO: a favourite is a single number 1-49. TOTO numbers have no "digit sequence" to permute, so
// this is adapted rather than literal: Purple = favourite matches one of the 6 MAIN winning numbers
// (the primary/"exact" win condition); Blue = favourite matches only the Additional number (a
// secondary/different-context match, the closest TOTO equivalent to 4D's box/permutation tier).
function getFavourite4DMatchType(favNum, winningArr) {
  if (!/^\d{4}$/.test(favNum)) return null;
  if (winningArr.includes(favNum)) return 'exact';
  const sortStr = s => s.split('').sort().join('');
  if (winningArr.some(w => sortStr(w) === sortStr(favNum))) return 'permutation';
  return null;
}
function getFavouriteTotoMatchType(favNum, winningArr, additional) {
  if (winningArr.includes(favNum)) return 'exact';
  if (additional === favNum) return 'permutation';
  return null;
}function highlightWithFavourites4D(numStr, suggestedArr, favourites) {
  // Determine the STRONGEST favourite match across all favourites for this specific winning number
  let favClass = '';
  if (favourites && favourites.length) {
    for (const f of favourites) {
      const m = getFavourite4DMatchType(f, [numStr]);
      if (m === 'exact') { favClass = 'hl-fav-exact'; break; }
      if (m === 'permutation' && !favClass) favClass = 'hl-fav-perm';
    }
  }
  if (favClass) return `<span class="${favClass}" title="Your favourite number">${numStr}</span>`;
  // BUG FIX (reported: "TOTO number highlights should appear on the suggested numbers rather than on
  // past results" - the identical pattern existed here for 4D too, so the same fix was applied to
  // both): this used to also fall back to highlightActual4D, which put a "hit" highlight (hl-act-direct
  // / hl-act-box) directly on the PAST DRAW'S OWN numbers whenever one happened to also be one of the
  // app's suggestions. That duplicated - and visually competed with - the hit highlighting that
  // already correctly appears on the Suggested Numbers grid right below (direct-hit/box-hit classes),
  // and put the emphasis on the wrong list: the actual result never changes, but which of YOUR
  // suggested numbers hit is the useful thing to see highlighted. Actual-result numbers now show only
  // the (distinct, still-wanted) favourite-number highlighting above, never a suggestion-hit highlight.
  return numStr;
}
function highlightWithFavouritesTOTO(num, suggestedSets, favourites, isAdditionalSlot) {
  let favClass = '';
  if (favourites && favourites.length && favourites.includes(num)) {
    favClass = isAdditionalSlot ? 'hl-fav-perm' : 'hl-fav-exact';
  }
  if (favClass) return `<span class="${favClass}" title="Your favourite number">${num}</span>`;
  // BUG FIX (reported: "TOTO number highlights should appear on the suggested numbers rather than on
  // past results"): this used to also fall back to highlightActualTOTO, which put a "hit" highlight
  // (hl-act-direct) directly on the PAST DRAW'S OWN winning numbers whenever one happened to also be
  // one of the app's suggestions. That duplicated - and visually competed with - the hit highlighting
  // that already correctly appears on the Suggested Numbers grid right below (the .hit class), and put
  // the emphasis on the wrong list: the actual result never changes, but which of YOUR suggested
  // numbers hit is the useful thing to see highlighted. Actual-result numbers now show only the
  // (distinct, still-wanted) favourite-number highlighting above, never a suggestion-hit highlight.
  return num;
}
// Persisted favourite numbers live on the active user's profile (up to 15 per game), parsed from a
// comma/space-separated input field.
function getFavouriteNumbers(gameKey) {
  const prof = activeUser()?.profile;
  if (!prof) return [];
  const raw = gameKey === 'fourD' ? prof.favourite4D : prof.favouriteToto;
  return Array.isArray(raw) ? raw : [];
}
function parseFavouriteInput(text, gameKey) {
  const parts = (text || '').split(/[\s,，]+/).map(s => s.trim()).filter(Boolean);
  if (gameKey === 'fourD') return parts.filter(p => /^\d{1,4}$/.test(p)).map(p => p.padStart(4, '0')).slice(0, 15);
  return parts.filter(p => /^\d{1,2}$/.test(p)).map(Number).filter(n => n >= 1 && n <= 49).slice(0, 15);
}

// BUG 5/6 FIX: persistent, immutable prediction log. Once a set of numbers is generated for a
// specific upcoming draw date, it is saved permanently and always re-shown as-is - it is never
// regenerated, reshuffled, or refreshed (the old "Refresh" button that reshuffled the "Upcoming"
// suggestions has been removed entirely, per Bug 5). When live actual results become available, any
// matching unresolved log entries are reconciled (checked against the real outcome) exactly once,
// and after 10 checked draws accumulate, a Historical Accuracy summary becomes available.
function getLotteryLog(gameKey) {
  const u = activeUser(); if (!u) return [];
  if (!u.lotteryLog) u.lotteryLog = { fourD: [], toto: [] };
  if (!Array.isArray(u.lotteryLog[gameKey])) u.lotteryLog[gameKey] = [];
  return u.lotteryLog[gameKey];
}
// Returns the SAVED sets for isoDate if a prediction already exists (never regenerating it), or
// generates one exactly once via generatorFn and persists it permanently.
function getOrCreatePrediction(gameKey, isoDate, generatorFn) {
  const log = getLotteryLog(gameKey);
  const existing = log.find(e => e.isoDate === isoDate);
  if (existing) return existing.sets;
  const sets = generatorFn();
  log.push({ isoDate, sets, generatedAt: new Date().toISOString(), checked: false, actual: null, hitSummary: null });
  saveState();
  return sets;
}
// ENHANCEMENT (this round): "last calculated on" timestamp for Upcoming Draw predictions. These are
// persisted permanently and never regenerated (see getOrCreatePrediction above), so - unlike the
// Flying Star Temporal Overlay and 3-Year Monthly forecasts elsewhere, which ARE recomputed live on
// every render and use calculatedAsOfLine (app.js) to show today's date - showing "today" here would
// be misleading for a prediction that may have been generated days or weeks ago. Looks up the
// existing log entry's own generatedAt without altering getOrCreatePrediction's return shape, so
// other callers are unaffected.
function getPredictionGeneratedAt(gameKey, isoDate) {
  const log = getLotteryLog(gameKey);
  const existing = log.find(e => e.isoDate === isoDate);
  return existing ? existing.generatedAt : null;
}
// ENHANCEMENT (this round): redesigned to track granular, per-prize-tier results (not just a single
// "best hit type" classification), so the accuracy display can report percentages for exact-match,
// permutation-match, and each individual prize tier (1st/2nd/3rd/Starter/Consolation) separately.
// bestHitType is kept for backward compatibility with the aggregate direct/box/none stats already
// shown elsewhere.
function compute4DHitSummary(sets, actualWinning) {
  let best = 'none';
  const hitByTier = { first: false, second: false, third: false, starter: false, consolation: false };
  let anyExact = false, anyPermOnly = false;
  sets.forEach(s => {
    const h = check4DHit(s, actualWinning);
    if (h === 'direct') { best = 'direct'; anyExact = true; }
    else if (h === 'box') { if (best !== 'direct') best = 'box'; anyPermOnly = true; }
    // Per-tier: an EXACT match against that specific prize position (or any position within a
    // Starter/Consolation block, since those are unordered sets of 10 numbers each, not individually
    // ranked slots).
    if (actualWinning[0] !== undefined && s === actualWinning[0]) hitByTier.first = true;
    if (actualWinning[1] !== undefined && s === actualWinning[1]) hitByTier.second = true;
    if (actualWinning[2] !== undefined && s === actualWinning[2]) hitByTier.third = true;
    if (actualWinning.slice(3, 13).includes(s)) hitByTier.starter = true;
    if (actualWinning.slice(13, 23).includes(s)) hitByTier.consolation = true;
  });
  return { bestHitType: best, anyExact, anyPermOnly, hitByTier };
}

// ENHANCEMENT (this round): redesigned to follow the ACTUAL, OFFICIAL Singapore Pools TOTO prize
// Group structure (Groups 1-7), not an invented tier naming scheme. Ordered from lowest to highest
// prize tier for "which result is better" comparisons. Group 1 (all 6 matched) wins regardless of
// whether the additional number also happens to be among the 6 chosen numbers - there is no
// "Group 0" or "6+1" tier in the real prize structure, since matching all 6 already wins the top prize.
const TOTO_GROUPS_ORDER = ['none', 7, 6, 5, 4, 3, 2, 1];

function classifyTotoGroup(mainMatches, hasAdditional) {
  if (mainMatches === 6) return 1;
  if (mainMatches === 5) return hasAdditional ? 2 : 3;
  if (mainMatches === 4) return hasAdditional ? 4 : 5;
  if (mainMatches === 3) return hasAdditional ? 6 : 7;
  return 'none';
}

// Official prize structure, as specified by Singapore Pools - used for both the accuracy breakdown
// display and the "eligible to highlight" check on suggested numbers.
const TOTO_GROUP_INFO = {
  1: { requirement: { en: 'Match all 6 winning numbers', zh: '中6个中奖号码' }, prize: { en: 'Jackpot - shares 38% of the prize pool (min S$1 million)', zh: '头奖 - 均分奖池38%（最低S$100万）' } },
  2: { requirement: { en: 'Match 5 winning numbers + additional number', zh: '中5个中奖号码+特别号' }, prize: { en: 'Shares 8% of the prize pool', zh: '均分奖池8%' } },
  3: { requirement: { en: 'Match 5 winning numbers', zh: '中5个中奖号码' }, prize: { en: 'Shares 5.5% of the prize pool', zh: '均分奖池5.5%' } },
  4: { requirement: { en: 'Match 4 winning numbers + additional number', zh: '中4个中奖号码+特别号' }, prize: { en: 'Shares 9% of the prize pool', zh: '均分奖池9%' } },
  5: { requirement: { en: 'Match 4 winning numbers', zh: '中4个中奖号码' }, prize: { en: 'Fixed prize of S$50', zh: '固定奖金 S$50' } },
  6: { requirement: { en: 'Match 3 winning numbers + additional number', zh: '中3个中奖号码+特别号' }, prize: { en: 'Fixed prize of S$25', zh: '固定奖金 S$25' } },
  7: { requirement: { en: 'Match 3 winning numbers', zh: '中3个中奖号码' }, prize: { en: 'Fixed prize of S$10', zh: '固定奖金 S$10' } }
};

// Returns the prize Group (1-7) a SINGLE set achieves against the actual result, or 'none' if it
// doesn't qualify for any prize - used to decide whether that set's numbers should be highlighted at
// all (per this round's request: only highlight when the set is genuinely prize-eligible).
function getTotoSetPrizeGroup(set, actualWinning, actualAdditional) {
  const mainMatches = set.filter(n => actualWinning.includes(n)).length;
  const hasAdditional = set.includes(actualAdditional);
  return classifyTotoGroup(mainMatches, hasAdditional);
}

function computeTotoHitSummary(sets, actualWinning, actualAdditional) {
  let bestMainMatches = 0, anyAdditionalMatch = false, bestGroup = 'none';
  sets.forEach(set => {
    const matches = set.filter(n => actualWinning.includes(n)).length;
    const hasAdditional = set.includes(actualAdditional);
    if (matches > bestMainMatches) bestMainMatches = matches;
    if (hasAdditional) anyAdditionalMatch = true;
    const group = classifyTotoGroup(matches, hasAdditional);
    if (TOTO_GROUPS_ORDER.indexOf(group) > TOTO_GROUPS_ORDER.indexOf(bestGroup)) bestGroup = group;
  });
  return { bestMainMatches, anyAdditionalMatch, bestGroup };
}
// Cross-references any unresolved log entries against the live historical repository (if available)
// and marks matching ones as checked - runs harmlessly (no-op) if no live history is connected yet.
function reconcilePredictions(gameKey) {
  if (!liveLotteryHistory || !Array.isArray(liveLotteryHistory[gameKey])) return;
  const log = getLotteryLog(gameKey);
  let changed = false;
  log.forEach(entry => {
    // ENHANCEMENT (this round): entries checked before the granular per-tier hit-summary fields
    // existed have an old-shape hitSummary missing them (e.g. no `hitByTier` for 4D, no `bestGroup`
    // for TOTO - this also catches the intermediate "bestTier" shape from an earlier round, before
    // the official Group 1-7 structure replaced that invented naming scheme). This upgrades those in
    // place using the SAME already-stored `sets` and `actual` - the prediction itself and the real
    // result are both untouched (never altered, per the permanent-prediction rule); only the DERIVED
    // analysis of how it performed is recomputed with the improved formula, which is a safe, one-time,
    // backward-compatible upgrade rather than a re-prediction.
    if (entry.checked) {
      const needsUpgrade = entry.hitSummary && (
        (gameKey === 'fourD' && entry.hitSummary.hitByTier === undefined) ||
        (gameKey === 'toto' && entry.hitSummary.bestGroup === undefined)
      );
      if (needsUpgrade && entry.actual) {
        entry.hitSummary = gameKey === 'fourD'
          ? compute4DHitSummary(entry.sets, entry.actual.winning)
          : computeTotoHitSummary(entry.sets, entry.actual.winning, entry.actual.additional);
        changed = true;
      }
      return;
    }

    const actualDraw = liveLotteryHistory[gameKey].find(d => d.isoDate === entry.isoDate);
    if (!actualDraw) return; // that draw hasn't happened / been fetched yet
    entry.actual = gameKey === 'fourD' ? { winning: actualDraw.winning } : { winning: actualDraw.winning, additional: actualDraw.additional };
    entry.hitSummary = gameKey === 'fourD' ? compute4DHitSummary(entry.sets, actualDraw.winning) : computeTotoHitSummary(entry.sets, actualDraw.winning, actualDraw.additional);
    entry.checked = true;
    changed = true;
  });
  if (changed) saveState();
}

// ENHANCEMENT (this round): retroactively generates predictions for the last N historical draws
// (default 50) "without referencing the results" - i.e. each draw's prediction is built using ONLY
// draws that occurred strictly BEFORE that draw's own date, exactly matching what would genuinely
// have been available at that point in time. The draw being predicted, and any later draw, is never
// part of the frequency model or correlation bonus used to generate its own prediction - this is
// what makes the resulting accuracy figures a genuine backtest rather than a look-ahead-biased one.
// Each generated prediction is saved via the SAME permanent, never-regenerated prediction log as
// live forward-looking predictions, and immediately reconciled against the (already known) real
// result, so it feeds directly into the existing computeHistoricalAccuracy / accuracy-display system.
// PERFORMANCE FIX (investigated live this round while chasing a reported "click a day in the Hourly
// tab, nothing happens for ~10 seconds" freeze): the Hourly tab's own day-switch computation was
// directly measured, live, against the real running app and found fast (3-7ms, zero long tasks) - not
// the cause. Looking elsewhere at what else runs unpredictably in the background, this backfill (see
// its own call site in app.js, fired once per session after the live lottery-history fetch resolves)
// was the one place a genuinely large, uninterrupted synchronous block was found: against this
// account's real history (5,374 4D draws, 1,816 TOTO draws at the time of testing), each backfilled
// draw's frequency-model + correlation computation costs ~20-25ms on the 4D side once the prior-draws
// window is large (most of the most-recent-50 target draws sit near the end of a 5000+-item history) -
// which, times up to 50 draws per game across 2 games, is a real ~1.5-2 SECOND uninterrupted
// synchronous block, at a moment with no visible loading indicator (it runs silently in the
// background). That's real and worth fixing on its own even though it doesn't fully account for the
// full 10 seconds reported - if it ever coincides with a click (this fetch's timing is
// network-dependent, not fixed), that click's event handling would queue up behind it exactly like the
// symptom described. Fixed the same proven way as the Hourly tab's own chunking (computeHourlyDayChunked
// above): process the target draws in small time-budgeted slices, yielding back to the browser between
// slices, instead of one uninterrupted loop. `onDone` fires after every slice completes, with the same
// return shape the old synchronous version produced, so the one real caller (app.js, which currently
// ignores the return value entirely) needs no change beyond passing a callback; nothing else in this
// codebase or its tests calls this function directly and depends on a synchronous return.
function backfillHistoricalAccuracy(gameKey, p, count = 50, onDone) {
  const finish = (result) => { if (onDone) onDone(result); return result; };
  if (!liveLotteryHistory || !Array.isArray(liveLotteryHistory[gameKey])) {
    return finish({ attempted: 0, backfilledCount: 0, skippedCount: 0, message: 'No live historical repository available yet.' });
  }
  const allDraws = [...liveLotteryHistory[gameKey]].sort((a, b) => a.isoDate.localeCompare(b.isoDate)); // oldest first
  const targetDraws = allDraws.slice(-count); // the most recent `count` draws, still oldest-to-newest within this slice
  const log = getLotteryLog(gameKey);

  let backfilledCount = 0, skippedCount = 0;
  const TIME_BUDGET_MS = 40; // same budget already proven safe for the Hourly tab's own chunking
  let idx = 0;
  const processOne = (draw) => {
    // Never regenerate an existing prediction for a date that already has one - this applies the
    // same "generate once, never change" rule as live predictions, so re-running this backfill later
    // (e.g. after more history accumulates) only fills in NEW gaps, never alters what's already there.
    if (log.find(e => e.isoDate === draw.isoDate)) { skippedCount++; return; }

    // POINT-IN-TIME correctness: strictly earlier dates only - this is the core of "without
    // referencing the results". A minimum of 5 prior draws is required before attempting a
    // prediction, since a frequency model built from almost nothing wouldn't be meaningful.
    const priorDraws = allDraws.filter(d => d.isoDate < draw.isoDate);
    if (priorDraws.length < 5) { skippedCount++; return; }

    const [y, m, d] = draw.isoDate.split('-').map(Number);
    const dayKey = y * 10000 + m * 100 + d;
    const dateObj = new Date(y, m - 1, d);
    const tier = (typeof classifyDateTier === 'function') ? classifyDateTier(dateObj, p) : 'Auspicious';

    // The correlation bonus is ALSO recomputed from only the prior draws (not the full current
    // history), for the same point-in-time reason - otherwise this one small input would quietly
    // reintroduce the exact look-ahead bias the rest of this function is designed to avoid.
    const priorHistoryWrapper = { fourD: gameKey === 'fourD' ? priorDraws : [], toto: gameKey === 'toto' ? priorDraws : [] };
    const priorCorrelation = computeMetaphysicsCorrelation(priorHistoryWrapper, gameKey);
    const corrBonus = priorCorrelation ? Math.round(priorCorrelation.deviation) : 0;

    const sets = gameKey === 'fourD'
      ? generate4DSetsFromModel(p, dayKey, tier, buildFourDFrequencyModel(priorDraws), corrBonus)
      : generateTotoSetsFromModel(p, dayKey, tier, buildTotoFrequencyModel(priorDraws), corrBonus);

    log.push({ isoDate: draw.isoDate, sets, generatedAt: new Date().toISOString(), checked: false, actual: null, hitSummary: null, backtested: true });
    backfilledCount++;
  };
  const stepOne = () => {
    const stepStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    while (idx < targetDraws.length) {
      processOne(targetDraws[idx]);
      idx++;
      const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - stepStart;
      if (elapsed > TIME_BUDGET_MS && idx < targetDraws.length) break;
    }
    if (idx < targetDraws.length) { setTimeout(stepOne, 0); return; }
    if (backfilledCount > 0) saveState();
    reconcilePredictions(gameKey); // immediately check the newly-backfilled entries against the real (already-known) results
    finish({ attempted: targetDraws.length, backfilledCount, skippedCount });
  };
  stepOne(); // runs immediately - most sessions (small/no backfill needed) finish in one synchronous
             // pass with no timer involved at all, exactly like the Hourly tab's own chunking above.
}

// Returns null if fewer than 10 checked draws exist yet (per the "after 10 draws" requirement),
// otherwise an aggregate accuracy summary across ALL checked draws.
function computeHistoricalAccuracy(gameKey) {
  const log = getLotteryLog(gameKey);
  const checked = log.filter(e => e.checked);
  if (checked.length < 10) return { ready: false, checkedCount: checked.length };
  // TRANSPARENCY: distinguish retroactively-backtested entries (generated via
  // backfillHistoricalAccuracy, using only data that predates each entry's own draw - see that
  // function's comment) from genuinely live-tracked ones (generated in advance of that draw actually
  // happening, the normal way). Both are computed with the same honest, point-in-time-correct
  // methodology, but the composition is surfaced so the accuracy figure's basis is never ambiguous.
  const backtestedCount = checked.filter(e => e.backtested === true).length;
  const liveTrackedCount = checked.length - backtestedCount;
  if (gameKey === 'fourD') {
    const directCount = checked.filter(e => e.hitSummary.bestHitType === 'direct').length;
    const boxCount = checked.filter(e => e.hitSummary.bestHitType === 'box').length;
    const noneCount = checked.length - directCount - boxCount;
    // ENHANCEMENT (this round): granular per-prize-tier percentages. Defensively checks hitByTier
    // exists (it should, after reconcilePredictions' backward-compatibility upgrade above, but this
    // guards against any entry that somehow wasn't upgraded rather than crashing the whole display).
    const withTierData = checked.filter(e => e.hitSummary.hitByTier);
    const pct = (count) => withTierData.length > 0 ? Math.round((count / withTierData.length) * 1000) / 10 : 0;
    const exactPct = pct(withTierData.filter(e => e.hitSummary.anyExact).length);
    const permPct = pct(withTierData.filter(e => e.hitSummary.anyPermOnly).length);
    const firstPct = pct(withTierData.filter(e => e.hitSummary.hitByTier.first).length);
    const secondPct = pct(withTierData.filter(e => e.hitSummary.hitByTier.second).length);
    const thirdPct = pct(withTierData.filter(e => e.hitSummary.hitByTier.third).length);
    const starterPct = pct(withTierData.filter(e => e.hitSummary.hitByTier.starter).length);
    const consolationPct = pct(withTierData.filter(e => e.hitSummary.hitByTier.consolation).length);
    return { ready: true, checkedCount: checked.length, backtestedCount, liveTrackedCount, directCount, boxCount, noneCount,
      exactPct, permPct, firstPct, secondPct, thirdPct, starterPct, consolationPct };
  }
  const avgBestMatches = checked.reduce((sum, e) => sum + e.hitSummary.bestMainMatches, 0) / checked.length;
  const threeOrMoreCount = checked.filter(e => e.hitSummary.bestMainMatches >= 3).length;
  const additionalHitCount = checked.filter(e => e.hitSummary.anyAdditionalMatch).length;
  // ENHANCEMENT (this round): percentage for each of the 7 OFFICIAL Singapore Pools TOTO prize
  // Groups, replacing the previous invented tier-naming scheme.
  const withGroupData = checked.filter(e => e.hitSummary.bestGroup !== undefined);
  const groupPct = (g) => withGroupData.length > 0 ? Math.round((withGroupData.filter(e => e.hitSummary.bestGroup === g).length / withGroupData.length) * 1000) / 10 : 0;
  const groupPcts = {};
  [1,2,3,4,5,6,7].forEach(g => { groupPcts[g] = groupPct(g); });
  return { ready: true, checkedCount: checked.length, backtestedCount, liveTrackedCount, avgBestMatches, threeOrMoreCount, additionalHitCount, groupPcts };
}

// ENHANCEMENT (this round): checks the user's OWN saved favourite numbers against every available
// historical draw, using the exact same hit-classification functions as the algorithm's own accuracy
// tracking (compute4DHitSummary / computeTotoHitSummary), so the two are directly comparable using
// identical methodology. This is a distinct, on-demand computation, not stored in the prediction log:
// favourites are a single, currently-live list rather than a per-draw-date prediction, and re-checking
// them against all available history whenever they're viewed is the correct behaviour (unlike
// predictions, which must stay frozen once made) - there's no point-in-time/look-ahead concern here
// either, since the user's own current numbers are simply being checked against already-known past
// results, not used to derive a forward-looking claim.
function computeFavouriteAccuracy(gameKey, p) {
  const favourites = getFavouriteNumbers(gameKey);
  if (!favourites || favourites.length === 0) return { ready: false, reason: 'no_favourites' };
  if (!liveLotteryHistory || !Array.isArray(liveLotteryHistory[gameKey]) || liveLotteryHistory[gameKey].length === 0) {
    return { ready: false, reason: 'no_history' };
  }
  const draws = liveLotteryHistory[gameKey];
  if (draws.length < 10) return { ready: false, reason: 'insufficient_history', checkedCount: draws.length };

  if (gameKey === 'fourD') {
    const summaries = draws.map(d => compute4DHitSummary(favourites, d.winning));
    const directCount = summaries.filter(s => s.bestHitType === 'direct').length;
    const boxCount = summaries.filter(s => s.bestHitType === 'box').length;
    const noneCount = summaries.length - directCount - boxCount;
    const pct = (count) => Math.round((count / summaries.length) * 1000) / 10;
    return {
      ready: true, checkedCount: summaries.length, favouritesCount: favourites.length,
      directCount, boxCount, noneCount,
      exactPct: pct(summaries.filter(s => s.anyExact).length),
      permPct: pct(summaries.filter(s => s.anyPermOnly).length),
      firstPct: pct(summaries.filter(s => s.hitByTier.first).length),
      secondPct: pct(summaries.filter(s => s.hitByTier.second).length),
      thirdPct: pct(summaries.filter(s => s.hitByTier.third).length),
      starterPct: pct(summaries.filter(s => s.hitByTier.starter).length),
      consolationPct: pct(summaries.filter(s => s.hitByTier.consolation).length)
    };
  }
  // TOTO: the whole favourites list is treated as ONE system entry, exactly like a prediction set -
  // classifyTotoGroup naturally scales to however many favourite numbers are saved (up to 15).
  const summaries = draws.map(d => computeTotoHitSummary([favourites], d.winning, d.additional));
  const avgBestMatches = summaries.reduce((sum, s) => sum + s.bestMainMatches, 0) / summaries.length;
  const threeOrMoreCount = summaries.filter(s => s.bestMainMatches >= 3).length;
  const groupPct = (g) => Math.round((summaries.filter(s => s.bestGroup === g).length / summaries.length) * 1000) / 10;
  const groupPcts = {};
  [1,2,3,4,5,6,7].forEach(g => { groupPcts[g] = groupPct(g); });
  return { ready: true, checkedCount: summaries.length, favouritesCount: favourites.length, avgBestMatches, threeOrMoreCount, groupPcts };
}
// ENHANCEMENT (this round): reuses the SAME modal mechanism as the existing "Deep Analysis" buttons
// elsewhere in the app (shared registry + global overlay, defined in app.js) rather than building a
// new one - clicking any button rendered by this helper opens the existing modal automatically, no
// new event listener needed. Uses its own id prefix/counter (separate from deepAnalysisIdCounter) so
// there's no risk of colliding with those other buttons' ids. This is also what keeps the lottery
// section's page length down - detailed breakdown grids live behind this button instead of always
// being rendered inline.
let lotteryStatsPopupIdCounter = 0;
function renderStatsPopupButton(title, contentHTML) {
  const id = 'lottostats_' + (lotteryStatsPopupIdCounter++);
  if (typeof deepAnalysisRegistry === 'object') deepAnalysisRegistry[id] = contentHTML;
  return `<button class="btnViewDeepAnalysis" data-id="${id}" style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:8px;padding:10px 14px;background:#f5f3ec;border:1px solid var(--line);border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;color:var(--plum);text-align:left">
    <span>📊 ${title}</span>
    <span style="color:var(--muted);font-weight:400;font-size:11px">${(typeof bt === 'function') ? bt('View Details','查看详情') : 'View Details'} ›</span>
  </button>`;
}
// BUG 6 FIX: Historical Accuracy display - shows a "gathering data" note until 10 draws have been
// checked, then an honest accuracy summary. All numbers here come from real, immutable, previously-
// saved predictions compared against real fetched results - nothing here is retroactively adjusted.
function renderAccuracyBlock(acc, gameKey, isZh) {
  if (!acc.ready) {
    return `<div class="calc-box" style="font-size:11px;margin-bottom:8px">${isZh
      ? `📊 历史准确率追踪：已核实 ${acc.checkedCount}/10 期，累积满10期后将显示历史准确率统计。`
      : `📊 Historical Accuracy Tracking: ${acc.checkedCount}/10 draws checked so far - a historical accuracy summary will appear once 10 draws have been verified against real results.`}</div>`;
  }
  const compositionNote = (acc.backtestedCount > 0)
    ? (isZh
        ? `（含 ${acc.backtestedCount} 期为回溯测试所得，${acc.liveTrackedCount} 期为实时预测追踪）`
        : ` (${acc.backtestedCount} retroactively backtested, ${acc.liveTrackedCount} live-tracked in advance)`)
    : '';
  // ENHANCEMENT (this round): the granular per-tier breakdown now lives behind a "View Details"
  // pop-up (reusing the app's existing modal system) instead of always being rendered inline, to
  // keep the lottery section's page length down. Only a short headline summary stays visible.
  const statRow = (label, pct) => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed rgba(0,0,0,0.08)"><span>${label}</span><strong style="color:#1565c0">${pct}%</strong></div>`;
  if (gameKey === 'fourD') {
    const detailGrid = `<div style="padding:15px;font-size:12px">
      <h4 style="color:var(--plum);margin:0 0 10px 0;font-size:15px;border-bottom:2px solid var(--sand);padding-bottom:6px">${isZh ? '4D 历史准确率详情' : '4D Historical Accuracy Detail'}</h4>
      ${statRow(isZh ? '命中直选（完全相同数字顺序）' : 'Struck exact number (direct)', acc.exactPct)}
      ${statRow(isZh ? '命中组选（排列组合形式）' : 'Struck number in permutation form (box)', acc.permPct)}
      ${statRow(isZh ? '命中首奖' : 'Struck 1st prize', acc.firstPct)}
      ${statRow(isZh ? '命中二奖' : 'Struck 2nd prize', acc.secondPct)}
      ${statRow(isZh ? '命中三奖' : 'Struck 3rd prize', acc.thirdPct)}
      ${statRow(isZh ? '命中安慰奖' : 'Struck Starter prize', acc.starterPct)}
      ${statRow(isZh ? '命中特别奖' : 'Struck Consolation prize', acc.consolationPct)}
    </div>`;
    return `<div class="calc-box" style="font-size:11px;margin-bottom:8px;border-left-color:#1565c0;background:#e3f2fd">
      <strong>${isZh ? '📊 历史准确率（共 ' + acc.checkedCount + ' 期已核实）' : `📊 Historical Accuracy (${acc.checkedCount} draws verified)`}</strong>${compositionNote}<br>
      ${isZh
        ? `直选命中：${acc.directCount} 期 · 组选命中：${acc.boxCount} 期 · 未命中：${acc.noneCount} 期`
        : `Direct hits: ${acc.directCount} draws · Box hits: ${acc.boxCount} draws · No match: ${acc.noneCount} draws`}
      ${renderStatsPopupButton(isZh ? '按奖项详细分类' : 'Breakdown by Prize Tier', detailGrid)}
    </div>`;
  }
  // ENHANCEMENT (this round): displays the OFFICIAL Singapore Pools Group 1-7 structure (with each
  // Group's real requirement and prize description) instead of an invented tier-naming scheme.
  const groupRow = (g) => {
    const info = TOTO_GROUP_INFO[g];
    const req = isZh ? info.requirement.zh : info.requirement.en;
    const prize = isZh ? info.prize.zh : info.prize.en;
    return `<div style="padding:4px 0;border-bottom:1px dashed rgba(0,0,0,0.08)">
      <div style="display:flex;justify-content:space-between"><span><strong>${isZh ? `第${g}组` : `Group ${g}`}</strong> - ${req}</span><strong style="color:#1565c0">${acc.groupPcts[g]}%</strong></div>
      <div style="font-size:9px;color:var(--muted)">${prize}</div>
    </div>`;
  };
  const detailGridToto = `<div style="padding:15px;font-size:12px">
    <h4 style="color:var(--plum);margin:0 0 10px 0;font-size:15px;border-bottom:2px solid var(--sand);padding-bottom:6px">${isZh ? 'TOTO 历史准确率详情（按官方奖组）' : 'TOTO Historical Accuracy Detail (by Official Prize Group)'}</h4>
    ${[1,2,3,4,5,6,7].map(groupRow).join('')}
  </div>`;
  return `<div class="calc-box" style="font-size:11px;margin-bottom:8px;border-left-color:#1565c0;background:#e3f2fd">
    <strong>${isZh ? '📊 历史准确率（共 ' + acc.checkedCount + ' 期已核实）' : `📊 Historical Accuracy (${acc.checkedCount} draws verified)`}</strong>${compositionNote}<br>
    ${isZh
      ? `平均最佳匹配数：${acc.avgBestMatches.toFixed(1)}/6 · 达3个以上匹配：${acc.threeOrMoreCount} 期`
      : `Average best match: ${acc.avgBestMatches.toFixed(1)}/6 numbers · 3+ matches: ${acc.threeOrMoreCount} draws`}
    ${renderStatsPopupButton(isZh ? '按官方奖组详细分类' : 'Breakdown by Official Prize Group', detailGridToto)}
  </div>`;
}

// ENHANCEMENT (this round): equivalent Historical Accuracy display, but for the user's own saved
// favourite numbers rather than the algorithm's predictions - lets a direct comparison be made
// between "how has the algorithm's suggestion performed" and "how have MY chosen numbers performed",
// using identical methodology for both.
function renderFavouriteAccuracyBlock(acc, gameKey, isZh) {
  if (!acc.ready) {
    const msg = acc.reason === 'no_favourites'
      ? bt('Save some favourite numbers above to see how they would have performed historically.', '请先在上方保存幸运号码，即可查看其历史表现。')
      : acc.reason === 'no_history'
        ? bt('A historical repository must be connected before favourite-number accuracy can be shown.', '需先连接历史数据源，才能显示幸运号码的历史准确率。')
        : bt(`Only ${acc.checkedCount || 0} historical draws available so far - at least 10 are needed for a meaningful favourite-number accuracy summary.`, `目前仅有 ${acc.checkedCount || 0} 期历史数据——至少需要10期才能提供有意义的幸运号码准确率统计。`);
    return `<div class="calc-box" style="font-size:11px;margin-bottom:8px">⭐ ${msg}</div>`;
  }
  const statRow = (label, pct) => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed rgba(0,0,0,0.08)"><span>${label}</span><strong style="color:#b8860b">${pct}%</strong></div>`;
  if (gameKey === 'fourD') {
    const detailGrid = `<div style="padding:15px;font-size:12px">
      <h4 style="color:var(--plum);margin:0 0 10px 0;font-size:15px;border-bottom:2px solid var(--sand);padding-bottom:6px">${isZh ? '幸运号码历史准确率详情' : 'Favourite Numbers Historical Accuracy Detail'}</h4>
      ${statRow(isZh ? '命中直选（完全相同数字顺序）' : 'Struck exact number (direct)', acc.exactPct)}
      ${statRow(isZh ? '命中组选（排列组合形式）' : 'Struck number in permutation form (box)', acc.permPct)}
      ${statRow(isZh ? '命中首奖' : 'Struck 1st prize', acc.firstPct)}
      ${statRow(isZh ? '命中二奖' : 'Struck 2nd prize', acc.secondPct)}
      ${statRow(isZh ? '命中三奖' : 'Struck 3rd prize', acc.thirdPct)}
      ${statRow(isZh ? '命中安慰奖' : 'Struck Starter prize', acc.starterPct)}
      ${statRow(isZh ? '命中特别奖' : 'Struck Consolation prize', acc.consolationPct)}
    </div>`;
    return `<div class="calc-box" style="font-size:11px;margin-bottom:8px;border-left-color:#b8860b;background:#fdf6e3">
      <strong>${isZh ? `⭐ 幸运号码历史准确率（共 ${acc.favouritesCount} 个号码，核对 ${acc.checkedCount} 期）` : `⭐ Favourite Numbers Historical Accuracy (${acc.favouritesCount} numbers, checked against ${acc.checkedCount} draws)`}</strong><br>
      ${isZh
        ? `直选命中：${acc.directCount} 期 · 组选命中：${acc.boxCount} 期 · 未命中：${acc.noneCount} 期`
        : `Direct hits: ${acc.directCount} draws · Box hits: ${acc.boxCount} draws · No match: ${acc.noneCount} draws`}
      ${renderStatsPopupButton(isZh ? '按奖项详细分类' : 'Breakdown by Prize Tier', detailGrid)}
    </div>`;
  }
  const groupRow = (g) => {
    const info = TOTO_GROUP_INFO[g];
    const req = isZh ? info.requirement.zh : info.requirement.en;
    const prize = isZh ? info.prize.zh : info.prize.en;
    return `<div style="padding:4px 0;border-bottom:1px dashed rgba(0,0,0,0.08)">
      <div style="display:flex;justify-content:space-between"><span><strong>${isZh ? `第${g}组` : `Group ${g}`}</strong> - ${req}</span><strong style="color:#b8860b">${acc.groupPcts[g]}%</strong></div>
      <div style="font-size:9px;color:var(--muted)">${prize}</div>
    </div>`;
  };
  const detailGridToto = `<div style="padding:15px;font-size:12px">
    <h4 style="color:var(--plum);margin:0 0 10px 0;font-size:15px;border-bottom:2px solid var(--sand);padding-bottom:6px">${isZh ? '幸运号码历史准确率详情（按官方奖组）' : 'Favourite Numbers Historical Accuracy Detail (by Official Prize Group)'}</h4>
    ${[1,2,3,4,5,6,7].map(groupRow).join('')}
  </div>`;
  return `<div class="calc-box" style="font-size:11px;margin-bottom:8px;border-left-color:#b8860b;background:#fdf6e3">
    <strong>${isZh ? `⭐ 幸运号码历史准确率（共 ${acc.favouritesCount} 个号码，核对 ${acc.checkedCount} 期）` : `⭐ Favourite Numbers Historical Accuracy (${acc.favouritesCount} numbers, checked against ${acc.checkedCount} draws)`}</strong><br>
    ${isZh
      ? `平均最佳匹配数：${acc.avgBestMatches.toFixed(1)}/6 · 达3个以上匹配：${acc.threeOrMoreCount} 期`
      : `Average best match: ${acc.avgBestMatches.toFixed(1)}/6 numbers · 3+ matches: ${acc.threeOrMoreCount} draws`}
    ${renderStatsPopupButton(isZh ? '按官方奖组详细分类' : 'Breakdown by Official Prize Group', detailGridToto)}
  </div>`;
}

// ENHANCEMENT (this round): input UI for up to 15 favourite numbers per game, with the exact/
// permutation legend explained inline. Saved via a click handler in app.js (btnSaveFavourites).
// ENHANCEMENT (this round): favourites are now managed as individual add/remove actions instead of
// a single text box holding the whole comma-separated list (which required retyping everything just
// to add or remove one number). Each current favourite renders as a removable "chip"; a small
// separate input adds one or more new numbers without touching what's already saved.
function renderFavouriteInputBlock(gameKey, currentFavourites, isZh) {
  const idSuffix = gameKey === 'fourD' ? '4d' : 'toto';
  const placeholder = gameKey === 'fourD' ? 'e.g. 1234' : 'e.g. 7';
  const legendExact = gameKey === 'fourD'
    ? bt('Purple = exact same 4-digit sequence as a winning number', '紫色 = 与中奖号码完全相同的四位数字顺序')
    : bt('Purple = matches one of the 6 main winning numbers', '紫色 = 符合六个主要中奖号码之一');
  const legendPerm = gameKey === 'fourD'
    ? bt('Blue = same 4 digits in a different order (permutation)', '蓝色 = 相同四位数字但顺序不同（排列组合）')
    : bt('Blue = matches the Additional number', '蓝色 = 符合特别号码');
  const chips = currentFavourites.map(n => `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--sand);border:1px solid var(--line);border-radius:14px;padding:3px 6px 3px 10px;font-size:12px;font-weight:700;color:var(--plum)">${n}<button class="btnRemoveFavourite" data-game="${gameKey}" data-value="${n}" title="${bt('Remove','移除')}" style="width:16px;height:16px;border-radius:50%;border:none;background:rgba(0,0,0,0.12);color:var(--ink);font-size:11px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0">×</button></span>`).join('');
  const atLimit = currentFavourites.length >= 15;
  return `<div style="margin:12px 0;padding:10px;background:#fff;border:1px solid var(--line);border-radius:8px">
    <div style="font-size:12px;font-weight:700;color:var(--plum);margin-bottom:6px">${bt('Your Favourite Numbers','您的幸运号码')} (${currentFavourites.length}/15)</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:${currentFavourites.length ? '8px' : '0'}">${chips}</div>
    ${atLimit
      ? `<div style="font-size:11px;color:var(--warning)">${bt('Limit of 15 reached - remove one above to add another.','已达15个上限——请先移除一个再新增。')}</div>`
      : `<div style="display:flex;gap:6px">
          <input type="text" id="favouriteAddInput_${idSuffix}" placeholder="${placeholder}" style="flex:1;padding:8px;border:1px solid #ccc;border-radius:4px;font-size:13px">
          <button class="btnAddFavourite" data-game="${gameKey}" style="padding:8px 14px;background:var(--plum);color:#fff;border:none;border-radius:4px;font-weight:700;cursor:pointer;font-size:12px">${bt('Add','新增')}</button>
        </div>`}
    <div style="font-size:10px;color:var(--muted);margin-top:6px;line-height:1.5">
      <span style="color:#7b1fa2;font-weight:700">●</span> ${legendExact}<br>
      <span style="color:#1565c0;font-weight:700">●</span> ${legendPerm}
    </div>
  </div>`;
}

// ENHANCEMENT (this round): browse past draws by year, then by specific date within that year.
// Only meaningful once a live history repository is loaded (liveLotteryHistory) - with just the
// 3-draw static snapshot there's nothing substantial to browse, so this degrades gracefully to a
// short explanatory note in that case instead of an empty/broken picker.
function renderPastDrawsBrowser(gameKey, isZh) {
  const idSuffix = gameKey === 'fourD' ? '4d' : 'toto';
  const draws = liveLotteryHistory ? liveLotteryHistory[gameKey] : [];
  // BUG FIX: this used to require >=4 draws before showing the browser at all, which meant TOTO -
  // which has no backfill source and only accumulates ~1 draw per scheduled run - would show "not
  // enough data" indefinitely for weeks, looking like a broken feature rather than one that just
  // hasn't accumulated much yet. Now shows the browser (functional, just with fewer choices) as soon
  // as there's at least 1 draw, and only falls back to the explanatory message when there's truly
  // nothing to browse.
  if (!draws || draws.length < 1) {
    return `<div class="calc-box" style="font-size:11px;margin:12px 0">${bt('Browse past draws by year and date will appear here once a live historical repository is connected (see lottery-scraper/README.md).', '一旦连接实时历史数据源（详见 lottery-scraper/README.md），即可在此按年份与日期浏览过往开奖。')}</div>`;
  }
  const years = [...new Set(draws.map(d => d.isoDate.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const yearOptions = years.map(y => `<option value="${y}">${y}</option>`).join('');
  // Embed the full year->dates map as a data attribute (JSON) so the change-handler in app.js can
  // populate the date dropdown without needing a fresh server/engine call for every year switch.
  const yearToDates = {};
  years.forEach(y => { yearToDates[y] = draws.filter(d => d.isoDate.startsWith(y)).map(d => d.isoDate).sort().reverse(); });
  const firstYearDates = yearToDates[years[0]] || [];
  const dateOptions = firstYearDates.map(iso => `<option value="${iso}">${iso}</option>`).join('');

  return `<div style="margin:14px 0;padding:10px;background:#fff;border:1px solid var(--line);border-radius:8px">
    <div style="font-size:12px;font-weight:700;color:var(--plum);margin-bottom:8px">${bt('Browse Past Draws','浏览历史开奖')} <span style="font-weight:400;color:var(--muted);font-size:10px">(${draws.length} ${bt('draws in repository','期开奖记录')})</span></div>
    <div class="pastDrawsBrowser" data-game="${gameKey}" data-years='${JSON.stringify(yearToDates).replace(/'/g, "&#39;")}'>
      <div style="display:flex;gap:6px">
        <select id="pastDrawsYearSelect_${idSuffix}" class="pastDrawsYearSelect" data-id-suffix="${idSuffix}" style="flex:1;padding:8px;border:1px solid #ccc;border-radius:4px;font-size:13px">${yearOptions}</select>
        <select id="pastDrawsDateSelect_${idSuffix}" class="pastDrawsDateSelect" style="flex:1;padding:8px;border:1px solid #ccc;border-radius:4px;font-size:13px">${dateOptions}</select>
      </div>
      <button class="btnViewPastDraw" data-game="${gameKey}" data-id-suffix="${idSuffix}" style="margin-top:8px;width:100%;padding:10px;background:var(--gold);color:#fff;border:none;border-radius:4px;font-weight:700;cursor:pointer;font-size:12px">${bt('View This Draw','查看此期开奖')}</button>
    </div>
    <div id="pastDrawResult_${idSuffix}" style="margin-top:10px;display:none"></div>
  </div>`;
}

// Renders a single historical draw's full detail, reusing the same favourite-highlighting logic as
// the "Most Recent 3 Draws" section above, so favourites are checked consistently everywhere.
function renderSingleDrawDetail(gameKey, isoDate, isZh) {
  const draws = liveLotteryHistory ? liveLotteryHistory[gameKey] : [];
  const draw = draws.find(d => d.isoDate === isoDate);
  if (!draw) return `<div style="color:var(--danger);font-size:12px">${bt('Draw not found for that date.','未找到该日期的开奖记录。')}</div>`;
  const favourites = getFavouriteNumbers(gameKey);

  // BUG FIX: this used to render 4D as a flat, unlabeled row of numbers and TOTO without the
  // "Actual Results (6+1)" label - inconsistent with the "Most Recent 3 Draws" section's format.
  // Now matches that exact structure (1st/2nd/3rd + Starter + Consolation rows for 4D; the same
  // "Actual Results (6+1)" label + main numbers + additional for TOTO) for a consistent display
  // regardless of whether a draw is being viewed via "Most Recent" or the past-draws date picker.
  if (gameKey === 'fourD') {
    const nums = draw.winning;
    const startersStr = (nums.slice(3, 13).map(n => highlightWithFavourites4D(n, [], favourites)).join(', ')) || bt('(not available for this draw)', '（此期无此数据）');
    const consolationsStr = (nums.slice(13, 23).map(n => highlightWithFavourites4D(n, [], favourites)).join(', ')) || bt('(not available for this draw)', '（此期无此数据）');
    // BUG FIX: distinguishes three different data-quality issues that can occur in the imported
    // historical archive, rather than a single generic "partial" label for all of them: too FEW
    // numbers (a real gap, mostly concentrated in 1986-1991 draws), too MANY (a literal duplicate row
    // in the source CSV), or exactly 23 but containing an internal duplicate (meaning one genuine
    // number is unknown, silently replaced by a repeat of another) - all three confirmed directly
    // against the real archive, including a same-count-but-duplicated case found in a 2026 draw. Each
    // has a different implication: a shortfall means some prizes are simply unknown; either duplicate
    // case means the specific 1st/2nd/3rd/Starter/Consolation positions below may be shifted or one
    // position's true number is unknown, since the source has no explicit rank column and this app
    // infers position from row order.
    const hasInternalDuplicate = new Set(nums).size < nums.length;
    const anomalyNote = !draw.full
      ? (nums.length < 23
          ? `<span style="color:var(--warning);font-size:10px"> (${bt(`partial data from the source archive: ${nums.length} of 23 numbers available`, `数据源存档不完整：仅有23个号码中的${nums.length}个`)})</span>`
          : nums.length === 23 && hasInternalDuplicate
            ? `<span style="color:var(--warning);font-size:10px"> (${bt(`source archive anomaly: this draw has a repeated number, meaning one genuine prize number is unknown - exact prize positions below may be shifted`, `数据源异常：此期含重复号码，代表有一个真实奖号未知——以下奖项位置可能有偏移`)})</span>`
            : `<span style="color:var(--warning);font-size:10px"> (${bt(`source archive anomaly: ${nums.length} numbers listed for this draw (expected 23, includes a duplicate) - exact prize positions below may be shifted`, `数据源异常：此期列出${nums.length}个号码（应为23个，含重复号码）——以下奖项位置可能有偏移`)})</span>`)
      : '';
    return `<div style="font-size:12px;line-height:1.8">
      <strong>${bt('Draw','开奖')} ${draw.drawNo} - ${draw.date}</strong>${anomalyNote}<br>
      <div style="margin-top:6px"><strong>${bt('Top 3','前三奖')}:</strong> <span style="color:var(--plum)">1st:</span> ${highlightWithFavourites4D(nums[0], [], favourites)}, <span style="color:var(--plum)">2nd:</span> ${highlightWithFavourites4D(nums[1], [], favourites)}, <span style="color:var(--plum)">3rd:</span> ${highlightWithFavourites4D(nums[2], [], favourites)}</div>
      <div style="margin-top:4px;font-size:11px"><strong>${bt('Starter','安慰')}:</strong> ${startersStr}</div>
      <div style="margin-top:2px;font-size:11px"><strong>${bt('Consolation','特别')}:</strong> ${consolationsStr}</div>
    </div>`;
  } else {
    const mainRendered = draw.winning.map(n => highlightWithFavouritesTOTO(n, [], favourites, false)).join(', ');
    const addRendered = highlightWithFavouritesTOTO(draw.additional, [], favourites, true);
    return `<div style="font-size:12px;line-height:1.8">
      <strong>${bt('Draw','开奖')} ${draw.drawNo} - ${draw.date}</strong><br>
      <div style="margin-top:6px"><strong>${bt('Actual Results (6+1)','实际开奖 (6+1)')}:</strong> ${mainRendered} <span style="color:var(--plum);font-weight:bold">(+${addRendered})</span></div>
    </div>`;
  }
}


// ENHANCEMENT 2 FIX (rework v2): the "Refresh" button fetches a GROWING historical repository (not
// just the latest single draw), via a companion scraper + GitHub Action documented in
// /lottery-scraper (see its README for the full setup and the CORS/no-API reasoning). Set
// LOTTERY_JSON_URL below to your own repo's raw history.json once set up; until then this stays
// empty and the app transparently falls back to the last manually-updated static snapshot below.
const LOTTERY_JSON_URL = 'https://raw.githubusercontent.com/roach76/Illuminate/main/lottery-scraper/history.json'; // confirmed working
let liveLotteryHistory = null; // { fourD: [...all known draws, newest first], toto: [...] } once a fetch succeeds
let lastLotteryFetchStatus = null; // 'success' | 'error' | 'not_configured' | null (not yet attempted)

async function fetchLatestLotteryResults() {
  if (!LOTTERY_JSON_URL) { lastLotteryFetchStatus = 'not_configured'; return false; }
  try {
    const res = await fetch(LOTTERY_JSON_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    // BUG FIX: this used to require BOTH fourD AND toto to be non-empty, rejecting the entire file
    // if either game had zero entries. That's too strict - the two games can legitimately have very
    // different amounts of data (e.g. after a historical import that only covers 4D, since the
    // source dataset's TOTO dates are all invalid - see import-historical-4d.js), and a rich 4D
    // dataset shouldn't be thrown away just because TOTO happens to be empty, or vice versa. Now only
    // requires the file to have the right shape (both keys present as arrays) and at least one of
    // the two to have real data.
    if (!Array.isArray(data.fourD) || !Array.isArray(data.toto)) {
      throw new Error('Unexpected history.json shape - fourD/toto must both be arrays (may be empty)');
    }
    if (data.fourD.length === 0 && data.toto.length === 0) {
      throw new Error('history.json has no data at all for either game');
    }
    liveLotteryHistory = data;
    lastLotteryFetchStatus = 'success';
    return true;
  } catch (e) {
    console.error('Lottery live fetch failed:', e.message);
    lastLotteryFetchStatus = 'error';
    return false;
  }
}

// ENHANCEMENT (this round): honest metaphysics-vs-draw-date correlation check, computed from REAL
// historical draws (not fabricated). For each historical draw date, this looks up that date's BaZi
// Day Pillar element and checks whether winning-number digits matching that SAME element appeared
// more or less often than the ~20% baseline you'd expect by chance (each of the 5 elements covers
// 2 of the 10 digits under a uniform distribution). Singapore Pools draws are certified random
// processes with no real causal link to any date-based system, so the honest expectation - and what
// this will show on any real dataset - is a result close to that 20% baseline, not a discovered
// "edge". This is surfaced transparently rather than spun into a false predictive claim, and it only
// contributes a small weight to suggestions (see applyCorrelationWeight below), consistent with
// being included for completeness rather than because it has demonstrated real predictive power.
function computeMetaphysicsCorrelation(history, gameKey) {
  if (!history || !Array.isArray(history[gameKey]) || history[gameKey].length < 5) return null;
  const draws = history[gameKey];
  const ELEM_IDX = { Water:4, Fire:1, Wood:0, Metal:3, Earth:2 };
  const digitToElemIdx = (d) => { const e = {1:'Water',6:'Water',2:'Fire',7:'Fire',3:'Wood',8:'Wood',4:'Metal',9:'Metal',5:'Earth',0:'Earth'}[d]; return ELEM_IDX[e]; };

  let matchCount = 0, totalCount = 0;
  draws.forEach(draw => {
    const [y, m, d] = draw.isoDate.split('-').map(Number);
    const drawBazi = getBaZiPillars(y, m, d, 12, 0, 103.8198, 8);
    const dayElemIdx = Math.floor(drawBazi.dayStemIdx / 2);
    const digits = gameKey === 'fourD'
      ? draw.winning.join('').split('').map(Number)
      : draw.winning.map(n => n % 10);
    digits.forEach(dg => {
      totalCount++;
      if (digitToElemIdx(dg) === dayElemIdx) matchCount++;
    });
  });

  const observedPct = totalCount > 0 ? Math.round((matchCount / totalCount) * 1000) / 10 : 0;
  const baselinePct = 20.0; // 2 of 10 digits per element under a uniform distribution
  const deviation = Math.round((observedPct - baselinePct) * 10) / 10;
  return { drawsAnalysed: draws.length, digitsAnalysed: totalCount, observedPct, baselinePct, deviation };
}

// ENHANCEMENT (this round): extracted into standalone, reusable, PARAMETERIZED functions (not
// closures) so the exact same prediction algorithm can be run against either the full current
// history (for live "Upcoming" predictions) or a POINT-IN-TIME-RESTRICTED subset of it (for the
// historical backtest below) - critical for the backtest to be honest, since a model built from the
// FULL history would let each retroactive prediction "see" data - including the very draw being
// predicted - that would not genuinely have been available at that point in time.
const TIER_WEIGHT = { 'Extremely Auspicious': 3, 'Highly Auspicious': 2, 'Auspicious': 1, 'Inauspicious': -1, 'Highly Inauspicious': -2, 'Extremely Inauspicious': -3 };

function buildFourDFrequencyModel(sourceDraws) {
  const histDigitFreq = {}; for (let i=0;i<10;i++) histDigitFreq[i]=0;
  const posDigitFreq = [{},{},{},{}]; for (let pos=0;pos<4;pos++) for (let i=0;i<10;i++) posDigitFreq[pos][i]=0;
  sourceDraws.forEach(d => d.winning.forEach(n => {
    for (const ch of n) histDigitFreq[Number(ch)]++;
    if (n.length === 4) for (let pos=0;pos<4;pos++) posDigitFreq[pos][Number(n[pos])]++;
  }));
  return {
    HIST_HOT_4D_DIGITS: Object.keys(histDigitFreq).map(Number).sort((a,b) => histDigitFreq[b]-histDigitFreq[a]),
    HIST_HOT_4D_BY_POS: posDigitFreq.map(freq => Object.keys(freq).map(Number).sort((a,b) => freq[b]-freq[a]))
  };
}
function buildTotoFrequencyModel(sourceDraws) {
  const histNumFreq = {}; for (let i=1;i<=49;i++) histNumFreq[i]=0;
  sourceDraws.forEach(d => { d.winning.forEach(n => histNumFreq[n]++); histNumFreq[d.additional]++; });
  return { HIST_HOT_TOTO_NUMS: Object.keys(histNumFreq).map(Number).sort((a,b) => histNumFreq[b]-histNumFreq[a]) };
}
function generate4DSetsFromModel(p, dayKey, tier, model, corrBonus4D) {
  const w = TIER_WEIGHT[tier] || 0;
  let sets = [];
  for(let s=1;s<=5;s++) {
    let digs=[];
    for(let i=0;i<4;i++) {
      const posList = (model.HIST_HOT_4D_BY_POS[i] && model.HIST_HOT_4D_BY_POS[i].length) ? model.HIST_HOT_4D_BY_POS[i] : model.HIST_HOT_4D_DIGITS;
      const histPick = posList[mod((p.life*13 + dayKey + i*17 + s*11 + w*3 + corrBonus4D), posList.length)];
      digs.push(histPick);
    }
    sets.push(digs.join(''));
  }
  return sets;
}
// ENHANCEMENT: generates a System 7 entry (7 numbers) per set, rather than a plain 6-number
// ("Ordinary") entry. Singapore Pools allows buying up to 12 numbers per line (System 7 through
// System 12); System 7 was specifically requested (changed back from an earlier System 12 version).
// A System 7 entry covers every possible 6-number combination within its 7 chosen numbers (7 such
// combinations total). This still allows achieving Group 1 (Jackpot) and Group 2 (5+additional)
// simultaneously on the same ticket in the specific case where the 7th number is the additional
// number: if 6 of the 7 chosen numbers are the winning numbers and the 7th is the additional number,
// one 6-number sub-combination (the 6 winners) wins Group 1, while a different sub-combination (5 of
// those winners + the additional number) independently wins Group 2 - not possible with a plain
// 6-number entry, where matching all 6 leaves no room for the additional number in those same 6 slots.
const TOTO_SYSTEM_SIZE = 7;
function generateTotoSetsFromModel(p, dayKey, tier, model, corrBonusToto) {
  const w = TIER_WEIGHT[tier] || 0;
  let res = [];
  for(let s=1;s<=5;s++) {
    let balls=new Set(); let c=1;
    while(balls.size<TOTO_SYSTEM_SIZE) {
      const pick = model.HIST_HOT_TOTO_NUMS[mod((p.life*7 + dayKey + c*13 + s + w*4 + corrBonusToto), model.HIST_HOT_TOTO_NUMS.length)];
      balls.add(Math.max(1, Math.min(49, pick + (mod(p.hexNo, 5) - 2))));
      c++;
    }
    res.push([...balls].sort((a,b)=>a-b));
  }
  return res;
}

// BUG 5 FIX: the refreshSeed parameter is no longer needed - predictions are permanent once
// generated, so there is nothing left to "refresh" or reshuffle. Kept as an accepted (ignored) second
// parameter rather than removed outright, so any lingering call site passing one doesn't error.
function renderLotteryPredictions(p, _unusedRefreshSeed) {
   if (!p) return;
   const isZh = lang === 'zh';

   // Static fallback snapshot - used whenever a live fetch hasn't been configured or hasn't
   // succeeded yet. See LOTTERY_JSON_URL above and /lottery-scraper/README.md for how to make this
   // dynamic instead of a manually-updated snapshot.
   const LOTTERY_DATA_LAST_UPDATED = '4 Sep 2026 (Fri)';
   let factual4DDraws = [
     { date: 'Wed 2 Sep 2026', dayKey: 20260902, winning: ['4125','8603','3798','0253','1002','1967','2104','2182','2362','2809','3598','3983','3997','0616','1119','3761','4997','6485','6934','7885','7999','8043','9283'] },
     { date: 'Sun 30 Aug 2026', dayKey: 20260830, winning: ['9238','8594','0379','1482','1739','2854','3412','4808','6214','6622','7241','7627','8578','0608','0733','2203','4510','4656','5505','6756','8849','9828','9868'] },
     { date: 'Sat 29 Aug 2026', dayKey: 20260829, winning: ['0363','4694','2691','0277','0457','0583','0640','3223','3230','6453','6512','7302','7755','1024','1343','2957','6639','7014','7136','7480','9483','9537','9679'] }
   ];
   let factualTotoDraws = [
     { date: 'Thu 3 Sep 2026', dayKey: 20260903, winning: [29, 33, 39, 42, 43, 44], additional: 49 },
     { date: 'Mon 31 Aug 2026', dayKey: 20260831, winning: [7, 26, 33, 39, 41, 46], additional: 11 },
     { date: 'Thu 27 Aug 2026', dayKey: 20260827, winning: [8, 9, 14, 17, 35, 40], additional: 18 }
   ];
   let liveDataUsed = false, liveDataUpdatedStr = null, correlationFourD = null, correlationToto = null, historyDrawCount4D = 0, historyDrawCountToto = 0;
   // If a live fetch has succeeded, use the full historical repository: the top 3 most recent draws
   // replace the static snapshot for "Verified Results" display, and the FULL history (however many
   // draws have accumulated) feeds the honest correlation check below.
   if (liveLotteryHistory) {
     liveDataUsed = true;
     liveDataUpdatedStr = new Date(liveLotteryHistory.lastUpdated).toLocaleString(isZh ? 'zh-CN' : 'en-SG', { dateStyle: 'medium', timeStyle: 'short' });
     const toDayKey = (isoDate) => { const [y,m,d] = isoDate.split('-').map(Number); return y*10000+m*100+d; };
     factual4DDraws = liveLotteryHistory.fourD.slice(0, 3).map(e => ({ date: e.date, dayKey: toDayKey(e.isoDate), winning: e.winning }));
     factualTotoDraws = liveLotteryHistory.toto.slice(0, 3).map(e => ({ date: e.date, dayKey: toDayKey(e.isoDate), winning: e.winning, additional: e.additional }));
     historyDrawCount4D = liveLotteryHistory.fourD.length;
     historyDrawCountToto = liveLotteryHistory.toto.length;
     correlationFourD = computeMetaphysicsCorrelation(liveLotteryHistory, 'fourD');
     correlationToto = computeMetaphysicsCorrelation(liveLotteryHistory, 'toto');
     // BUG 6 FIX: reconcile any pending predictions against the freshly-fetched actual results, so
     // the accuracy tracker updates whenever new live data comes in (once per render is sufficient -
     // reconcilePredictions is itself idempotent, since it only touches unchecked entries).
     reconcilePredictions('fourD');
     reconcilePredictions('toto');
   }




   let up4D = []; let curr4D = new Date(); while(up4D.length < 3) { if([0,3,6].includes(curr4D.getDay())) up4D.push(new Date(curr4D)); curr4D.setDate(curr4D.getDate() + 1); }
   let upToto = []; let currToto = new Date(); while(upToto.length < 3) { if([1,4].includes(currToto.getDay())) upToto.push(new Date(currToto)); currToto.setDate(currToto.getDate() + 1); }

   // ENHANCEMENT (this round): use the FULL accumulated historical repository (not just the 3 most
   // recent draws) for the frequency model feeding "next 3 draws" predictions, per the requirement
   // that past draws be taken into account for those predictions. Falls back to the 3-draw static
   // snapshot when no live repository has been fetched yet. Also computes PER-POSITION frequency for
   // 4D (each of the 4 digit slots historically), for a slightly richer (still honest - see the
   // Historical Correlation Check above for why this isn't a claim of real predictive power) signal
   // than a single flat digit-frequency list.
   const fourDSourceDraws = (liveLotteryHistory && liveLotteryHistory.fourD.length > 0) ? liveLotteryHistory.fourD : factual4DDraws;
   const totoSourceDraws = (liveLotteryHistory && liveLotteryHistory.toto.length > 0) ? liveLotteryHistory.toto : factualTotoDraws;
   const historyDrawsUsedFor4D = fourDSourceDraws.length;
   const historyDrawsUsedForToto = totoSourceDraws.length;

   const model4D = buildFourDFrequencyModel(fourDSourceDraws);
   const modelToto = buildTotoFrequencyModel(totoSourceDraws);

   // Elemental tier for a given draw date, reusing the Ze Ri Day-Branch clash/harmony logic against
   // this profile's own Day Master (classifyDateTier is defined in app.js, loaded before this runs).
   const drawDateTier = (dateObj) => (typeof classifyDateTier === 'function') ? classifyDateTier(dateObj, p) : 'Auspicious';
   const tierWeight = TIER_WEIGHT;

   // ENHANCEMENT (this round): fold the honest historical correlation into the Upcoming picks too -
   // a small nudge only, matching the correlation's own (expected-to-be-near-zero) deviation, so this
   // is included for completeness per the request without overstating its real predictive weight.
   const corrBonus4D = correlationFourD ? Math.round(correlationFourD.deviation) : 0;
   const corrBonusToto = correlationToto ? Math.round(correlationToto.deviation) : 0;

   // BUG 5 FIX: applyRefresh/rSeed reshuffling removed entirely - these functions are now only ever
   // called ONCE per draw date (as the generator passed to getOrCreatePrediction), so their output is
   // fully deterministic given (dayKey, tier) and never needs a "refresh" variant.
   const get4DSets = (dayKey, tier) => generate4DSetsFromModel(p, dayKey, tier, model4D, corrBonus4D);
   const getTotoSets = (dayKey, tier) => generateTotoSetsFromModel(p, dayKey, tier, modelToto, corrBonusToto);
   // BUG FIX (reported directly: "for 4D and toto, the suggested numbers should not change everytime
   // it is loaded as this is statistically tracked"). Root cause: this only ever applied to the
   // "Upcoming 3 Draws" section, which already goes through getOrCreatePrediction (BUG 5/6 FIX above) and
   // is genuinely stable. The "Most Recent 3 Draws (Verified Results)" section below it - the "Your
   // Suggested Numbers" shown alongside each already-happened draw - was NOT going through that same
   // persistence: it called get4DSets/getTotoSets directly on every render, and since model4D/modelToto
   // are built from whichever historical draw data happened to be available THIS load (the live fetch can
   // succeed on one load and silently fall back to the static snapshot on the next, e.g. on a flaky
   // connection), the resulting "suggested numbers" for the same already-verified draw could genuinely
   // come out different from one page load to the next - exactly the reported symptom. Fixed by routing
   // these through the identical getOrCreatePrediction cache, keyed by the draw's own isoDate: once
   // generated (whichever data source was available that first time), a verified draw's suggested numbers
   // are permanent from then on, in the same 'fourD'/'toto' log a draw already had an entry in if it was
   // ever shown as an "Upcoming" prediction before it happened - so the two sections stay consistent with
   // each other for the same date, not just stable within themselves.
   const dayKeyToIso = (dayKey) => { const s = String(dayKey); return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`; };
   const get4DSetsStable = (dayKey, tier) => getOrCreatePrediction('fourD', dayKeyToIso(dayKey), () => get4DSets(dayKey, tier));
   const getTotoSetsStable = (dayKey, tier) => getOrCreatePrediction('toto', dayKeyToIso(dayKey), () => getTotoSets(dayKey, tier));

   function renderCorrelationBlock(correlation, drawCount) {
     if (!correlation) return '';
     const deviationColor = Math.abs(correlation.deviation) < 2 ? 'var(--muted)' : (correlation.deviation > 0 ? '#2e7d32' : '#c62828');
     return `<div style="font-size:11px;background:#f5f3ec;border-left:3px solid var(--gold);padding:8px 10px;border-radius:0 6px 6px 0;margin-bottom:10px;line-height:1.6">
       <strong>${isZh ? '历史相关性检验（诚实披露）' : 'Historical Correlation Check (Honest Disclosure)'}:</strong><br>
       ${isZh
         ? `在 ${drawCount} 期实际历史开奖（共 ${correlation.digitsAnalysed} 个数字）中，与该日期八字日主五行相符的数字出现率为 <strong style="color:${deviationColor}">${correlation.observedPct}%</strong>（随机基准约 ${correlation.baselinePct}%，差异 ${correlation.deviation > 0 ? '+' : ''}${correlation.deviation}%）。`
         : `Across ${drawCount} real historical draws (${correlation.digitsAnalysed} digits analysed), digits matching that date's BaZi Day Master element appeared <strong style="color:${deviationColor}">${correlation.observedPct}%</strong> of the time (random baseline ≈${correlation.baselinePct}%, deviation ${correlation.deviation > 0 ? '+' : ''}${correlation.deviation}%).`}
       ${isZh
         ? ' 新加坡博彩为官方认证的随机抽奖，理论上不应与任何命理体系存在真实因果关系——上述数字若接近基准值，恰恰是符合预期的诚实结果，而非本应用能力不足。'
         : ' Singapore Pools draws are certified random processes with no real causal link to any date-based system - a result close to the baseline above is the honest, expected outcome, not a limitation of this feature.'}
     </div>`;
   }

   const statusLine4D = liveDataUsed
     ? (isZh ? `✅ 实时数据，取得于 ${liveDataUpdatedStr}（历史库共 ${historyDrawCount4D} 期）。` : `✅ Live data, fetched ${liveDataUpdatedStr} (repository holds ${historyDrawCount4D} draws).`)
     : (lastLotteryFetchStatus === 'error'
        ? (isZh ? `⚠️ 实时数据获取失败，显示最后已知快照（核实于 ${LOTTERY_DATA_LAST_UPDATED}）。` : `⚠️ Live fetch failed - showing last known snapshot (verified ${LOTTERY_DATA_LAST_UPDATED}).`)
        : (isZh ? `数据核实于 ${LOTTERY_DATA_LAST_UPDATED}（快照，尚未连接实时数据源）。` : `Verified as of ${LOTTERY_DATA_LAST_UPDATED} (static snapshot - live source not yet configured).`));
   let html4D = `<h4 style="margin-top:10px;color:var(--plum);border-bottom:1px solid var(--sand);padding-bottom:5px">${isZh ? '最近 3 期实际开奖' : 'Most Recent 3 Draws (Verified Results)'}</h4>
     <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${statusLine4D}</div>
     ${renderCorrelationBlock(correlationFourD, historyDrawCount4D)}`;
   const fav4D = getFavouriteNumbers('fourD');
   html4D += renderFavouriteInputBlock('fourD', fav4D, isZh);
   factual4DDraws.forEach(draw => {
     const actual4D = draw.winning;
     const tier = drawDateTier(new Date(draw.dayKey.toString().slice(0,4), Number(draw.dayKey.toString().slice(4,6))-1, Number(draw.dayKey.toString().slice(6,8))));
     const suggested4D = get4DSetsStable(draw.dayKey, tier);
     let startersStr = actual4D.slice(3, 13).map(n => highlightWithFavourites4D(n, suggested4D, fav4D)).join(', ');
     let consolationsStr = actual4D.slice(13, 23).map(n => highlightWithFavourites4D(n, suggested4D, fav4D)).join(', ');
     const tierColor = (tierWeight[tier]||0) > 0 ? 'var(--success)' : (tierWeight[tier]||0) < 0 ? 'var(--danger)' : 'var(--muted)';
     html4D += `<div class="draw-card">
        <div><span class="pill">${isZh ? '开奖日期' : 'Draw Date'}: ${draw.date}</span><div style="font-size:10px;font-weight:700;color:${tierColor};margin-top:5px">${isZh ? '当日五行' : 'Day Element Tier'}: ${tier}</div></div>
        <div style="font-size:12px;margin:8px 0;background:#f5f3ec;padding:8px;border-radius:6px;color:var(--muted);line-height:1.5;">
          <strong>${isZh ? 'Top 3 (前三奖)' : 'Top 3'}:</strong> <span style="color:var(--plum)">1st:</span> ${highlightWithFavourites4D(actual4D[0], suggested4D, fav4D)}, <span style="color:var(--plum)">2nd:</span> ${highlightWithFavourites4D(actual4D[1], suggested4D, fav4D)}, <span style="color:var(--plum)">3rd:</span> ${highlightWithFavourites4D(actual4D[2], suggested4D, fav4D)}<br>
          <div style="margin-top:4px;font-size:11px"><strong>Starter:</strong> ${startersStr}</div>
          <div style="margin-top:2px;font-size:11px"><strong>Consolation:</strong> ${consolationsStr}</div>
        </div>
        <div style="font-size:12px;margin-bottom:4px;color:var(--plum)"><strong>${isZh ? '您的优选号码 (与事实数据核对):' : 'Your Suggested Numbers (Verified against actual results):'}</strong></div>
        <div class="prediction-row">${suggested4D.map(n => `<div class="prediction-item ${check4DHit(n, actual4D) === 'direct' ? 'direct-hit' : (check4DHit(n, actual4D) === 'box' ? 'box-hit' : '')}">${n}</div>`).join('')}</div>
     </div>`;
   });

   html4D += `<h4 style="margin-top:20px;color:var(--plum);border-bottom:1px solid var(--sand);padding-bottom:5px">${isZh ? '未来 3 期高潜预测' : 'Upcoming 3 Draws Prediction'}</h4>
   <div style="font-size:10px;color:var(--muted);margin-bottom:6px">${liveDataUsed
     ? (isZh ? `建议号码依据 ${historyDrawsUsedFor4D} 期历史开奖的数字位置频率及您的命理数据推算，一经生成即永久保存，不会重新生成或变更。` : `Suggestions are derived from per-position digit frequency across ${historyDrawsUsedFor4D} historical draws plus your metaphysics data. Once generated for a given draw date, a prediction is saved permanently and never regenerated or changed.`)
     : (isZh ? `注：尚未连接实时数据源，当前依据 ${historyDrawsUsedFor4D} 期快照数据推算，一经生成即永久保存。` : `Note: no live source configured yet - suggestions are based on a ${historyDrawsUsedFor4D}-draw static snapshot. Once generated, predictions are saved permanently.`)}</div>
   ${renderAccuracyBlock(computeHistoricalAccuracy('fourD'), 'fourD', isZh)}
   ${renderFavouriteAccuracyBlock(computeFavouriteAccuracy('fourD', p), 'fourD', isZh)}`;
   up4D.forEach((d) => {
     const dayKey = d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
     const isoDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
     const tier = drawDateTier(d);
     const tierColor = (tierWeight[tier]||0) > 0 ? 'var(--success)' : (tierWeight[tier]||0) < 0 ? 'var(--danger)' : 'var(--muted)';
     // BUG 5/6 FIX: predictions are now generated ONCE per draw date and persisted forever - no
     // "refresh" reshuffling. get4DSets is only ever called here as the (one-time) generator function.
     const suggested = getOrCreatePrediction('fourD', isoDate, () => get4DSets(dayKey, tier));
     const genAt = getPredictionGeneratedAt('fourD', isoDate);
     const genAtLine = genAt ? `<div class="calculated-as-of">${isZh ? `计算于：${genAt.slice(0,10)}` : `Calculated on: ${genAt.slice(0,10)}`}</div>` : '';
     html4D += `<div class="draw-card"><div><span class="pill">${isZh ? '未来预测' : 'Upcoming Draw'}: ${formatDrawDate(d)}</span><div style="font-size:10px;font-weight:700;color:${tierColor};margin-top:5px">${isZh ? '当日五行' : 'Day Element Tier'}: ${tier}</div></div><div class="prediction-row" style="margin-top:8px">${suggested.map(n => `<div class="prediction-item">${n}</div>`).join('')}</div>${genAtLine}</div>`;
   });
   
   html4D += renderPastDrawsBrowser('fourD', isZh);
   const c4 = document.getElementById('fourDContainer'); if (c4) c4.innerHTML = html4D;

   const statusLineToto = liveDataUsed
     ? (isZh ? `✅ 实时数据，取得于 ${liveDataUpdatedStr}（历史库共 ${historyDrawCountToto} 期）。` : `✅ Live data, fetched ${liveDataUpdatedStr} (repository holds ${historyDrawCountToto} draws).`)
     : (lastLotteryFetchStatus === 'error'
        ? (isZh ? `⚠️ 实时数据获取失败，显示最后已知快照（核实于 ${LOTTERY_DATA_LAST_UPDATED}）。` : `⚠️ Live fetch failed - showing last known snapshot (verified ${LOTTERY_DATA_LAST_UPDATED}).`)
        : (isZh ? `数据核实于 ${LOTTERY_DATA_LAST_UPDATED}（快照，尚未连接实时数据源）。` : `Verified as of ${LOTTERY_DATA_LAST_UPDATED} (static snapshot - live source not yet configured).`));
   let htmlToto = `<h4 style="margin-top:10px;color:var(--plum);border-bottom:1px solid var(--sand);padding-bottom:5px">${isZh ? '最近 3 期实际开奖' : 'Most Recent 3 Draws (Verified Results)'}</h4><div style="font-size:11px;color:var(--muted);margin-bottom:8px">${statusLineToto}</div>${renderCorrelationBlock(correlationToto, historyDrawCountToto)}`;
   const favToto = getFavouriteNumbers('toto');
   htmlToto += renderFavouriteInputBlock('toto', favToto, isZh);
   factualTotoDraws.forEach(draw => {
     const tier = drawDateTier(new Date(draw.dayKey.toString().slice(0,4), Number(draw.dayKey.toString().slice(4,6))-1, Number(draw.dayKey.toString().slice(6,8))));
     const suggestedToto = getTotoSetsStable(draw.dayKey, tier);
     let winStr = draw.winning.map(n => highlightWithFavouritesTOTO(n, suggestedToto, favToto, false)).join(', ');
     let addStr = highlightWithFavouritesTOTO(draw.additional, suggestedToto, favToto, true);
     const tierColor = (tierWeight[tier]||0) > 0 ? 'var(--success)' : (tierWeight[tier]||0) < 0 ? 'var(--danger)' : 'var(--muted)';
     htmlToto += `<div class="draw-card">
        <div><span class="pill">${isZh ? '开奖日期' : 'Draw Date'}: ${draw.date}</span><div style="font-size:10px;font-weight:700;color:${tierColor};margin-top:5px">${isZh ? '当日五行' : 'Day Element Tier'}: ${tier}</div></div>
        <div style="font-size:12px;margin:8px 0;background:#f5f3ec;padding:8px;border-radius:6px;color:var(--muted)">
          <strong>${isZh ? '实际开奖 (6+1)' : 'Actual Results (6+1)'}:</strong> ${winStr} <span style="color:var(--plum);font-weight:bold">(+${addStr})</span>
        </div>
        <div style="font-size:12px;margin-bottom:4px;color:var(--plum)"><strong>${isZh ? '您的优选号码（7数系统投注）:' : 'Your Suggested Numbers (System 7 entry):'}</strong></div>
        ${suggestedToto.map(balls => {
          // ENHANCEMENT (this round): only highlight this set's numbers if the SET AS A WHOLE is
          // eligible for an actual prize (Group 7 or better - at least 3 main-number matches, per
          // Singapore Pools' real prize structure), not just because an individual ball happens to
          // coincide with a winning number. A lone matching ball in an otherwise non-winning set
          // means nothing in a real TOTO draw, so it's no longer highlighted as if it did.
          const setGroup = getTotoSetPrizeGroup(balls, draw.winning, draw.additional);
          const isEligible = setGroup !== 'none';
          return `<div class="toto-balls">${balls.map(n => `<div class="toto-ball ${isEligible && checkTOTOHit(n, draw) ? 'hit' : ''}">${n}</div>`).join('')}</div>`;
        }).join('')}
     </div>`;
   });

   htmlToto += `<h4 style="margin-top:20px;color:var(--plum);border-bottom:1px solid var(--sand);padding-bottom:5px">${isZh ? '未来 3 期高潜预测（7数系统投注）' : 'Upcoming 3 Draws Prediction (System 7 entry)'}</h4>
   <div style="font-size:10px;color:var(--muted);margin-bottom:6px">${liveDataUsed
     ? (isZh ? `建议号码依据 ${historyDrawsUsedForToto} 期历史开奖的号码频率及您的命理数据推算，一经生成即永久保存，不会重新生成或变更。每组为7数系统投注，涵盖该7个号码中所有可能的6个号码组合。` : `Suggestions are derived from number frequency across ${historyDrawsUsedForToto} historical draws plus your metaphysics data. Once generated for a given draw date, a prediction is saved permanently and never regenerated or changed. Each set is a System 7 entry, covering every possible 6-number combination within those 7 numbers.`)
     : (isZh ? `注：尚未连接实时数据源，当前依据 ${historyDrawsUsedForToto} 期快照数据推算，一经生成即永久保存。每组为7数系统投注。` : `Note: no live source configured yet - suggestions are based on a ${historyDrawsUsedForToto}-draw static snapshot. Once generated, predictions are saved permanently. Each set is a System 7 entry.`)}</div>
   ${renderAccuracyBlock(computeHistoricalAccuracy('toto'), 'toto', isZh)}
   ${renderFavouriteAccuracyBlock(computeFavouriteAccuracy('toto', p), 'toto', isZh)}`;
   upToto.forEach((d) => {
     const dayKey = d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
     const isoDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
     const tier = drawDateTier(d);
     const tierColor = (tierWeight[tier]||0) > 0 ? 'var(--success)' : (tierWeight[tier]||0) < 0 ? 'var(--danger)' : 'var(--muted)';
     // BUG 5/6 FIX: predictions are now generated ONCE per draw date and persisted forever.
     const suggested = getOrCreatePrediction('toto', isoDate, () => getTotoSets(dayKey, tier));
     const genAt = getPredictionGeneratedAt('toto', isoDate);
     const genAtLine = genAt ? `<div class="calculated-as-of">${isZh ? `计算于：${genAt.slice(0,10)}` : `Calculated on: ${genAt.slice(0,10)}`}</div>` : '';
     htmlToto += `<div class="draw-card"><div><span class="pill">${isZh ? '未来预测' : 'Upcoming Draw'}: ${formatDrawDate(d)}</span><div style="font-size:10px;font-weight:700;color:${tierColor};margin-top:5px">${isZh ? '当日五行' : 'Day Element Tier'}: ${tier}</div></div><div style="margin-top:8px">${suggested.map(balls => `<div class="toto-balls">${balls.map(n => `<div class="toto-ball">${n}</div>`).join('')}</div>`).join('')}</div>${genAtLine}</div>`;
   });
   
   htmlToto += renderPastDrawsBrowser('toto', isZh);
   const cT = document.getElementById('totoContainer'); if (cT) cT.innerHTML = htmlToto;

   // BUG FIX (reported directly: "statistic missing for predicted numbers for toto and 4d" - meaning
   // the historical-accuracy hit-rate tracking, confirmed live to be working correctly and showing real
   // numbers in the app itself, e.g. `computeHistoricalAccuracy('fourD')` returning real percentages
   // across 51 checked draws). Root cause traced to buildProfilePdfHTML (app.js): the 4D/TOTO section
   // lives in its own dedicated `#fourDContainer`/`#totoContainer` elements in index.html, OUTSIDE the
   // per-profile chart-tab system (`chartTabRegistry`) that buildProfilePdfHTML assembles a profile's
   // PDF from - so this whole section (predictions, verified-results, AND the historical-accuracy
   // stats bundled inside it) was never part of ANY profile's PDF export at all, confirmed directly:
   // `buildProfilePdfHTML('i')`'s own output contained no "Historical Accuracy" text and no "4D" text
   // whatsoever. This function previously had no return value (its only output was the DOM writes
   // above); returning the two built HTML strings here lets the PDF-export path include this section
   // without duplicating any of the logic above or touching how the live, on-screen Lottery view works
   // (the DOM writes above are unchanged, so every existing caller that ignores this return value keeps
   // working exactly as before).
   return { html4D, htmlToto };
}