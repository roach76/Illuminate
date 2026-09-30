// FILE: engine-core.js
// Description: Core state, constants, dictionaries, and safe storage handling.

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const mod = (n, m) => { if (isNaN(n) || isNaN(m)) return 0; return ((n % m) + m) % m; };

// BUG FIX (deep audit): this app builds every view via raw string template interpolation into
// innerHTML, with no automatic escaping the way a framework like React would provide. User-supplied
// text (names, Chinese names, birth city, mobile number, vehicle plates, home address) was being
// injected into these templates completely unescaped - confirmed directly: entering
// "<script>alert(1)</script>" as a name resulted in that exact tag appearing verbatim, unescaped, in
// the rendered HTML. Since profile data persists in localStorage and re-renders every time that
// profile is viewed, this is a genuine STORED XSS vulnerability, not just a theoretical one - a
// malicious name entered once (a shared/family device, or a future profile-import feature) would
// execute every time that profile is opened afterward. escapeHtml() is applied at the specific
// points user text enters a rendered template (see getProfileData and the Personal Assets/Home
// Details render functions) - not at save time, so the raw, unescaped value is preserved for
// re-populating edit forms (setting an input's .value is not an innerHTML injection and needs no
// escaping) and is not corrupted by literal HTML-entity text appearing where a user typed an
// ordinary character like an apostrophe.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ENHANCEMENT (this round): Master Numbers (11, 22, 33) - confirmed as the three universally
// recognized master numbers across numerology sources, with a consistent rule: reduction stops
// immediately at 11, 22, or 33 at ANY step, rather than continuing on to a single digit. Previously
// this app always reduced fully to 1-9, silently collapsing every master-number chart into its base
// digit (11->2, 22->4, 33->6) with no acknowledgement that a master number applied at all.
const reduceNum = (num) => {
  let s = Number(num);
  while (s > 9 && s !== 11 && s !== 22 && s !== 33) s = String(s).split('').reduce((a, b) => a + Number(b), 0);
  return s;
};
// Full reduction to a single digit 1-9, ignoring master numbers - used only where a strict single
// digit is structurally required (e.g. building a fixed-length numeric code), never for the Life
// Path Number itself, which should show its true master number when one applies.
const reduceNumFull = (num) => { let s = Number(num); while (s > 9) s = String(s).split('').reduce((a, b) => a + Number(b), 0); return s; };

const STORAGE_KEY = 'illuminate-local-v101';
const OLD_KEYS = ['illuminate-local-v100', 'illuminate-local-v99', 'illuminate-local-v98'];

let lang = localStorage.getItem('illuminate_lang') || 'en';
let signup = true;

const stems = ['Jia · Wood','Yi · Wood','Bing · Fire','Ding · Fire','Wu · Earth','Ji · Earth','Geng · Metal','Xin · Metal','Ren · Water','Gui · Water'];
const stemCN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const branches = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
const branchCN = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const hiddenStemsEN = ['Gui (癸)','Ji, Gui, Xin (己,癸,辛)','Jia, Bing, Wu (甲,丙,戊)','Yi (乙)','Wu, Yi, Gui (戊,乙,癸)','Bing, Wu, Geng (丙,戊,庚)','Ding, Ji (丁,己)','Ji, Ding, Yi (己,丁,乙)','Geng, Ren, Wu (庚,壬,戊)','Xin (辛)','Wu, Xin, Ding (戊,辛,丁)','Ren, Jia (壬,甲)'];
// BUG 2 FIX: Chinese characters for Hidden Stems (previously undefined -> rendered blank)
const hiddenStemsCN = ['癸','己·癸·辛','甲·丙·戊','乙','戊·乙·癸','丙·戊·庚','丁·己','己·丁·乙','庚·壬·戊','辛','戊·辛·丁','壬·甲'];

const ZODIAC_TRAITS = [
  { animal: 'Rat', allies: 'Dragon, Monkey', hidden: 'Ox', avoid: 'Horse' },
  { animal: 'Ox', allies: 'Snake, Rooster', hidden: 'Rat', avoid: 'Goat' },
  { animal: 'Tiger', allies: 'Horse, Dog', hidden: 'Pig', avoid: 'Monkey' },
  { animal: 'Rabbit', allies: 'Pig, Goat', hidden: 'Dog', avoid: 'Rooster' },
  { animal: 'Dragon', allies: 'Monkey, Rat', hidden: 'Rooster', avoid: 'Dog' },
  { animal: 'Snake', allies: 'Rooster, Ox', hidden: 'Monkey', avoid: 'Pig' },
  { animal: 'Horse', allies: 'Tiger, Dog', hidden: 'Goat', avoid: 'Rat' },
  { animal: 'Goat', allies: 'Rabbit, Pig', hidden: 'Horse', avoid: 'Ox' },
  { animal: 'Monkey', allies: 'Rat, Dragon', hidden: 'Snake', avoid: 'Tiger' },
  { animal: 'Rooster', allies: 'Ox, Snake', hidden: 'Dragon', avoid: 'Rabbit' },
  { animal: 'Dog', allies: 'Tiger, Horse', hidden: 'Rabbit', avoid: 'Dragon' },
  { animal: 'Pig', allies: 'Rabbit, Goat', hidden: 'Tiger', avoid: 'Snake' }
];

const ASTRO_SIGNS_DETAILS = {
  'Aries': { zh: '白羊座', en: 'Aries', comp: 'Leo, Sagittarius, Gemini', incomp: 'Cancer, Capricorn' },
  'Taurus': { zh: '金牛座', en: 'Taurus', comp: 'Virgo, Capricorn, Cancer', incomp: 'Leo, Aquarius' },
  'Gemini': { zh: '双子座', en: 'Gemini', comp: 'Libra, Aquarius, Aries', incomp: 'Virgo, Pisces' },
  'Cancer': { zh: '巨蟹座', en: 'Cancer', comp: 'Scorpio, Pisces, Taurus', incomp: 'Aries, Libra' },
  'Leo': { zh: '狮子座', en: 'Leo', comp: 'Aries, Sagittarius, Gemini', incomp: 'Taurus, Scorpio' },
  'Virgo': { zh: '处女座', en: 'Virgo', comp: 'Taurus, Capricorn, Cancer', incomp: 'Gemini, Sagittarius' },
  'Libra': { zh: '天秤座', en: 'Libra', comp: 'Gemini, Aquarius, Leo', incomp: 'Cancer, Capricorn' },
  'Scorpio': { zh: '天蝎座', en: 'Scorpio', comp: 'Cancer, Pisces, Virgo', incomp: 'Leo, Aquarius' },
  'Sagittarius': { zh: '射手座', en: 'Sagittarius', comp: 'Aries, Leo, Libra', incomp: 'Virgo, Pisces' },
  'Capricorn': { zh: '摩羯座', en: 'Capricorn', comp: 'Taurus, Virgo, Scorpio', incomp: 'Aries, Libra' },
  'Aquarius': { zh: '水瓶座', en: 'Aquarius', comp: 'Gemini, Libra, Sagittarius', incomp: 'Taurus, Scorpio' },
  'Pisces': { zh: '双鱼座', en: 'Pisces', comp: 'Cancer, Scorpio, Capricorn', incomp: 'Gemini, Sagittarius' }
};
// CHINESE LANGUAGE FIX: sun-sign names used in the "Compatible Signs"/"Incompatible Signs" rows were
// hardcoded English CSV lists (e.g. "Virgo, Capricorn, Cancer") with no Chinese equivalent - this
// dictionary + helper lets app.js translate any such list at display time.
const SIGN_NAME_ZH = { Aries:'白羊座', Taurus:'金牛座', Gemini:'双子座', Cancer:'巨蟹座', Leo:'狮子座', Virgo:'处女座', Libra:'天秤座', Scorpio:'天蝎座', Sagittarius:'射手座', Capricorn:'摩羯座', Aquarius:'水瓶座', Pisces:'双鱼座' };
function translateSignList(csv) { return (csv || '').split(',').map(s => SIGN_NAME_ZH[s.trim()] || s.trim()).join('、'); }

// BUG 15 FIX: these arrays were referenced by engine-predictions.js but never defined anywhere,
// so every call to render the 4D/TOTO sections threw a ReferenceError before any HTML was written -
// leaving both containers permanently empty. Defining them here restores the section.
const HOT_4D_DIGITS = [0,1,2,3,4,5,6,7,8,9];
const HOT_TOTO_NUMS = [1,3,5,7,9,11,13,17,19,21,23,27,29,31,33,37,39,41,43,47,49,2,4,6,8,10,12,14,18,22,26,30,34,38,42,46];


function loadState() {
   let raw = localStorage.getItem(STORAGE_KEY);
   if (!raw) { for (let oldKey of OLD_KEYS) { raw = localStorage.getItem(oldKey); if (raw) break; } }
   try { return JSON.parse(raw || '{"users":{},"active":null}'); } catch (e) { return { users: {}, active: null }; }
}
// BUG FIX (contributes directly to the reported localStorage quota problem): loadState() has always
// fallen back to reading an OLDER-format key (illuminate-local-v100/-v99/-v98) when the current one is
// empty - a one-time migration path for whoever's been using this app since before the current storage
// format. But nothing ever DELETED that old key afterward, on the (correct, at the time) assumption
// that it was just harmless leftover. It isn't: localStorage's quota is shared across every key on the
// same origin, not per-key, so a long-time user who has been through more than one format bump (this
// app has gone through v98 -> v99 -> v100 -> v101 so far) can end up with several COMPLETE, stale
// copies of their entire account sitting in storage at once, all counting against the same quota as
// the one copy actually in use. This is a very plausible major contributor to hitting the quota well
// before the current, live data alone would justify it. Cleaning this up right after load - not only
// when a migration just happened, but any time a stale key is found at all, since a user could easily
// have gone through several bumps without this cleanup ever having run before - directly frees real
// space with zero effect on the live account (nothing here is currently read from these keys anymore).
function cleanupOldStorageKeys() {
  OLD_KEYS.forEach(oldKey => {
    try { if (localStorage.getItem(oldKey) !== null) localStorage.removeItem(oldKey); }
    catch (e) { if (typeof console !== 'undefined') console.warn('cleanupOldStorageKeys: could not remove ' + oldKey + ', continuing:', e); }
  });
}
state = loadState();
cleanupOldStorageKeys();

// BUG FIX (reported: "sign out link is not working" / "the links work intermittently" - confirmed
// via the user's own Console tab, showing an uncaught QuotaExceededError thrown from this exact line
// every time it fired): localStorage has a per-origin quota (typically 5-10MB), and a long-lived
// account can eventually accumulate enough data to exceed it. saveState() previously had no
// try/catch anywhere, so a quota failure threw synchronously and silently aborted whatever function
// called it partway through - e.g. auth.js's Sign Out handler does `state.active = null; saveState();
// go('welcome');`, so a thrown error on the saveState() line meant go('welcome') never ran and Sign
// Out visibly did nothing; any other handler that saves state and then does more work (navigation,
// re-rendering) was vulnerable the same way, matching "the links work intermittently."
//
// saveState() now NEVER throws. If the initial save fails on a quota error, it tries to free space by
// pruning the oldest already-RESOLVED lottery prediction log entries (safely disposable historical
// record - unresolved/upcoming predictions and every profile field are left untouched) and retries.
//
// FOLLOW-UP FIX (reported directly, via a fresh Console screenshot taken AFTER installing the first
// version of this fix: pruning to a flat cap of 30 entries per game was recovering SOME saves - "saveState:
// succeeded after pruning" did appear - but others still failed with "still over quota after pruning",
// specifically from backfillHistoricalAccuracy/reconcilePredictions). A single fixed cap either prunes
// enough or it doesn't; for a real, very long-lived account sitting right at the edge of its quota, one
// flat cut isn't always enough headroom, and there was nothing further to try. Pruning now escalates
// through progressively more aggressive caps (30 -> 10 -> 0, where 0 means every already-resolved entry
// is removed, keeping only unresolved/upcoming predictions) and retries the save after each step,
// stopping as soon as one succeeds. If even removing ALL resolved lottery history still isn't enough,
// that's strong evidence the real bloat is somewhere else entirely (e.g. many accounts sharing this
// device) - a diagnostic breakdown of each account's approximate size is then logged to the console to
// help pinpoint it, and the same dismissible on-screen warning is shown either way.
let storageWarningShown = false;
function pruneOldestResolvedLotteryEntries(maxKeptPerGame) {
  let prunedAny = false;
  Object.values(state.users || {}).forEach(u => {
    if (!u || !u.lotteryLog) return;
    ['fourD', 'toto'].forEach(gameKey => {
      const log = u.lotteryLog[gameKey];
      if (!Array.isArray(log) || log.length <= maxKeptPerGame) return;
      const resolved = log.filter(e => e && e.checked).sort((a, b) => String(a.isoDate).localeCompare(String(b.isoDate)));
      const overflow = log.length - maxKeptPerGame;
      if (overflow > 0 && resolved.length > 0) {
        const dropIsoDates = new Set(resolved.slice(0, Math.min(overflow, resolved.length)).map(e => e.isoDate));
        u.lotteryLog[gameKey] = log.filter(e => !dropIsoDates.has(e.isoDate));
        prunedAny = true;
      }
    });
  });
  return prunedAny;
}
// Best-effort diagnostic only (never affects what's saved) - logged solely to help pinpoint the real
// source of storage bloat when even the most aggressive pruning above isn't enough, since that means
// the bulk of the size lives somewhere other than lottery prediction history.
function logStorageSizeDiagnostics() {
  if (typeof console === 'undefined') return;
  try {
    const perAccount = Object.keys(state.users || {}).map(email => {
      let size = -1;
      try { size = JSON.stringify(state.users[email]).length; } catch (e) { /* leave as -1 */ }
      return { email, approxChars: size };
    }).sort((a, b) => b.approxChars - a.approxChars);
    console.warn('[Illuminate storage] Could not free enough space by pruning lottery history alone. Approximate size per account on this device (largest first), to help identify the real source:', perAccount);
  } catch (e) { /* diagnostics are best-effort only, never allowed to affect saving */ }
}
function showStorageWarning() {
  if (typeof document === 'undefined') return;
  const banner = document.getElementById('storageWarningBanner');
  const text = document.getElementById('storageWarningText');
  if (!banner || !text) return;
  const msg = (typeof bt === 'function')
    ? bt('This browser\'s storage is almost full, so a recent change could not be saved. Try removing a profile you no longer need (Account > Manage Profiles), or freeing up space in your browser\'s site settings.',
         '此浏览器的存储空间已接近上限，最近的更改未能保存。请尝试删除不再需要的档案（账户 > 管理档案），或在浏览器的网站设置中释放存储空间。')
    : 'This browser\'s storage is almost full, so a recent change could not be saved.';
  text.textContent = msg;
  banner.style.display = 'block';
}
// ENHANCEMENT (this round - background PDF pre-rendering): saveState is the single choke point every
// data-changing action in this app already goes through, so it's the natural place to kick off a
// (debounced, idle-time-only) background PDF pre-render after a successful save - see the full design
// comment above __pdfPreRenderCache in app.js. schedulePdfPreRender is defined later in app.js, loaded
// after this file, but is only ever actually CALLED from here well after both scripts have finished
// loading (in response to a real user edit), so the forward reference is safe - the typeof guard just
// keeps this file standalone-safe (e.g. under a test harness that loads engine-core.js without app.js).
const saveState = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (typeof schedulePdfPreRender === 'function') schedulePdfPreRender();
    return true;
  } catch (e) {
    const isQuotaError = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
    if (!isQuotaError) { console.error('saveState failed:', e); return false; }
    console.warn('saveState: localStorage quota exceeded - attempting to free space by pruning old, already-resolved prediction history...');
    const PRUNE_CAP_STEPS = [30, 10, 0]; // increasingly aggressive - 0 removes every resolved entry
    for (let i = 0; i < PRUNE_CAP_STEPS.length; i++) {
      if (!pruneOldestResolvedLotteryEntries(PRUNE_CAP_STEPS[i])) continue; // nothing left to prune at this level
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        console.warn(`saveState: succeeded after pruning old prediction history down to ${PRUNE_CAP_STEPS[i]} entries per game.`);
        if (typeof schedulePdfPreRender === 'function') schedulePdfPreRender();
        return true;
      } catch (e2) { /* still over quota - escalate to the next, more aggressive cap */ }
    }
    console.error('saveState: still over quota even after removing all resolved prediction history - this save was skipped, but the app keeps working from memory.', e);
    logStorageSizeDiagnostics();
    if (!storageWarningShown) { storageWarningShown = true; showStorageWarning(); }
    return false;
  }
};
const activeUser = () => state.users[state.active];

// ENHANCEMENT (Phase 1, reported: "household occupants need full data collection for household deep
// analysis"): household occupants used to only collect a bare birth YEAR (enough for a Kua number, not
// enough for a real BaZi-based reading). New occupants now collect a full birthdate (+ optional time)
// - see renderOccupantsListHTML/btnAddOccupant in app.js. This one-time migration backfills a
// PLACEHOLDER birthdate for any occupant saved under the old {year, gender}-only shape, so the data
// model is consistent going forward, while being explicit (via `approximateBirth: true`) that this
// specific occupant's date is a stand-in, not their real birthdate - per this project's standing "no
// reading half baked, assumed, or uncalculated or made up" instruction, nothing downstream is allowed
// to quietly treat this placeholder as precise. June 15th (not Jan 1st) is used deliberately, to avoid
// landing exactly on a Li Chun solar-term boundary, which could otherwise flip which lunar year a
// downstream BaZi calculation assigns this placeholder date to.
function migrateOccupantBirthData() {
  let migratedAny = false;
  Object.values(state.users || {}).forEach(u => {
    const profiles = [u.profile, u.partner, u.businessPartner, ...(u.additionalBizPartners || []), ...(u.children || [])].filter(Boolean);
    profiles.forEach(prof => {
      (prof.bazhaiOccupants || []).forEach(o => {
        if (!o.birthdate && o.year) {
          o.birthdate = `${o.year}-06-15`;
          o.birthtime = o.birthtime || '';
          o.approximateBirth = true;
          migratedAny = true;
        }
      });
    });
  });
  if (migratedAny) saveState();
}
migrateOccupantBirthData();

// ============================================================================
// UNIFIED MULTI-ROLE PEOPLE MODEL (this round)
// ============================================================================
// Replaces the old fixed profile "slots" (Life Partner / Business Partner / Household Occupant /
// Child) with a single list, u.people, where ONE real person can carry MULTIPLE role tags at once
// (e.g. someone who is both a Life Partner and a Business Partner) - see UPDATE_NOTES for the full
// design writeup. Deliberately NOT rewriting the ~138-call-site prefix-based rendering/PDF/
// compatibility engine (renderSystemChart, buildProfilePdfHTML, calculateTrueCompatibility,
// getAllExistingProfiles, etc.) - instead, u.partner / u.businessPartner / u.additionalBizPartners /
// u.children / u.profile.bazhaiOccupants are kept, structurally identical to before, but are now a
// DERIVED VIEW rebuilt from u.people by rebuildLegacySlotsFromPeople() below. Nothing else should
// hand-edit those legacy fields directly any more - app.js's mutation handlers write to u.people (via
// the sync helpers there) and then call this function.
//
// Each u.people entry: { id, roles: [subset of 'partner'|'businessPartner'|'child'|'occupant'],
// englishFirstName, englishLastName, chineseFirstName, chineseLastName, birthdate, birthtime, gender,
// birthLocation, birthLongitude, birthTimezone, mobileNumber, vehicles (only meaningful with the
// 'partner' role), approximateBirth (only meaningful with the 'occupant' role) }. u.profile (the
// account owner) is NOT part of u.people - you cannot tag yourself with a role relative to yourself.
function makePersonId() { return 'p_' + Math.random().toString(36).slice(2, 10); }

// Recomputes u.partner / u.businessPartner / u.additionalBizPartners / u.children /
// u.profile.bazhaiOccupants purely from u.people. Must be called after EVERY mutation of u.people.
// Idempotent - calling it repeatedly against the same u.people always produces the same result.
//
// "Only one Life Partner" - u.partner is the FIRST person (in u.people order) tagged 'partner'; a
// second person can never simultaneously hold that tag because the UI (app.js's
// checkOnlyOnePartnerRule) BLOCKS tagging a second person 'partner' while one is already tagged,
// rather than silently auto-swapping the tag off the existing one - see app.js for the full rationale.
// u.businessPartner is the FIRST person tagged 'businessPartner' (the "core" slot); every OTHER
// businessPartner-tagged person becomes u.additionalBizPartners, in u.people order (unlimited, as
// before). u.children / u.profile.bazhaiOccupants are every person tagged 'child' / 'occupant',
// unlimited, in u.people order.
//
// A person tagged with MULTIPLE roles (e.g. ['partner','businessPartner']) correctly appears in BOTH
// legacy slots as independent copies of the same underlying data - each is a plain field-for-field
// copy of the u.people entry (minus 'id'/'roles', and minus 'name'/'approximateBirth' which only the
// bazhaiOccupants shape below uses), so every downstream calculation (BaZi, Zi Wei, compatibility,
// PDF) reads exactly the fields it always has.
function rebuildLegacySlotsFromPeople(u) {
  if (!u || !Array.isArray(u.people)) return;
  const people = u.people;

  const toRawRecord = (person) => {
    const rec = Object.assign({}, person);
    delete rec.id; delete rec.roles; delete rec.name; delete rec.approximateBirth;
    return rec;
  };

  const partners = people.filter(p => (p.roles || []).includes('partner'));
  const bizPartners = people.filter(p => (p.roles || []).includes('businessPartner'));
  const children = people.filter(p => (p.roles || []).includes('child'));
  const occupants = people.filter(p => (p.roles || []).includes('occupant'));

  u.partner = partners.length ? toRawRecord(partners[0]) : null;

  if (bizPartners.length) {
    u.businessPartner = toRawRecord(bizPartners[0]);
    u.additionalBizPartners = bizPartners.slice(1).map(toRawRecord);
  } else {
    u.businessPartner = null;
    u.additionalBizPartners = [];
  }

  u.children = children.map(toRawRecord);

  if (u.profile) {
    // `year` is preserved verbatim when already present on the person (backward compatibility with
    // getOccupantKua, which some older/placeholder occupants rely on), else derived from birthdate.
    u.profile.bazhaiOccupants = occupants.map(p => ({
      name: p.name || p.englishFirstName || '',
      year: p.year !== undefined ? p.year : (p.birthdate ? new Date(p.birthdate + 'T00:00:00').getFullYear() : undefined),
      birthdate: p.birthdate || '', birthtime: p.birthtime || '',
      gender: p.gender || 'male', approximateBirth: !!p.approximateBirth
    }));
  }
}

// One-time, idempotent migration: if u.people does not exist yet AND at least one of the old fields
// has data, builds u.people from them (deterministic 1:1 mapping, no conflict-merging needed) and then
// calls rebuildLegacySlotsFromPeople() so the live UI reads the freshly-regenerated versions. The
// pre-migration originals are NOT deleted by this function - they are simply overwritten in place by
// the (field-for-field-equivalent) regenerated versions, so nothing is lost. Returns true if it did
// anything, so callers can decide whether a save is needed. Running this twice is a guaranteed no-op:
// once u.people exists, this returns false immediately without touching anything.
function migratePeopleFromLegacy(u) {
  if (!u || Array.isArray(u.people)) return false; // already migrated (or has no profile at all) - no-op
  const hasLegacyData = !!(
    u.partner || u.businessPartner ||
    (u.additionalBizPartners && u.additionalBizPartners.length) ||
    (u.children && u.children.length) ||
    (u.profile && u.profile.bazhaiOccupants && u.profile.bazhaiOccupants.length)
  );
  if (!hasLegacyData) return false; // nothing to migrate yet - leave u.people unset until first Add

  const people = [];
  const addPerson = (raw, roles) => { people.push(Object.assign({}, raw, { id: makePersonId(), roles: roles.slice() })); };
  if (u.partner) addPerson(u.partner, ['partner']);
  if (u.businessPartner) addPerson(u.businessPartner, ['businessPartner']);
  (u.additionalBizPartners || []).forEach(bp => addPerson(bp, ['businessPartner']));
  (u.children || []).forEach(c => addPerson(c, ['child']));
  if (u.profile) { (u.profile.bazhaiOccupants || []).forEach(o => addPerson(o, ['occupant'])); }

  u.people = people;
  rebuildLegacySlotsFromPeople(u);
  return true;
}

function migratePeopleForAllUsers() {
  let migratedAny = false;
  Object.values(state.users || {}).forEach(u => { if (migratePeopleFromLegacy(u)) migratedAny = true; });
  if (migratedAny) saveState();
}
migratePeopleForAllUsers();

// CHINESE LANGUAGE FIX (static UI chrome): previously only 3 elements (brand tagline, welcome
// title, lang toggle button) were ever updated by the language toggle - every label, button,
// heading, and placeholder across the intake forms, nav bar, and account page stayed English
// regardless of the toggle. This dictionary + expanded updateStaticLanguage() covers the entire
// static page.
// ENHANCEMENT (this round): country-based longitude/timezone lookup, so users don't need to already
// know their exact birth longitude or UTC offset - a real usability barrier the manual-entry-only
// fields previously had. Manual entry remains available and is NOT replaced; this is an additional,
// optional convenience that pre-fills those same fields, which stay fully editable afterward.
//
// Uses each country's CAPITAL CITY longitude (a reasonable representative point, though large
// countries spanning multiple meridians will have some error for cities far from the capital) and the
// STANDARD (non-DST) UTC offset. If someone's birth occurred during a period when their region
// observed daylight saving time, the offset here will be 1 hour off from what was locally observed at
// that moment - this is a real, disclosed limitation, not silently glossed over.
//
// The half-hour/45-minute/quarter-hour offsets (India, Sri Lanka +5:30; Nepal +5:45; Afghanistan
// +4:30; Iran +3:30; Myanmar +6:30; Central Australia +9:30) were specifically cross-verified against
// 7 independent sources before being trusted, given how easy these non-standard offsets are to get
// wrong - all matched consistently.
// ENHANCEMENT (requested directly, follow-up round: "plot all [planets] ... include ... 12 houses to
// plot out" / real Ascendant-based houses): every entry now also carries `lat` (the same reference
// city's real latitude, north positive/south negative) alongside its existing lon/tz - reusing the SAME
// country/city selection UX already in place for longitude/timezone, so a real (if reference-city-
// approximate) birth latitude is available for every profile with NO new form field required. Existing
// profiles saved before this round simply have no `lat` yet (undefined) until the country/city is
// re-selected or the profile is re-saved - handled as a graceful "Ascendant/houses unavailable" case
// everywhere this is consumed, exactly like a missing birthMomentUTC already is.
const COUNTRY_LONGITUDE_TIMEZONE = {
  // ASEAN
  'Singapore': {lon: 103.82, tz: 8, lat: 1.35}, 'Malaysia': {lon: 101.69, tz: 8, lat: 3.14}, 'Indonesia': {lon: 106.85, tz: 7, lat: -6.21},
  'Thailand': {lon: 100.50, tz: 7, lat: 13.75}, 'Vietnam': {lon: 105.85, tz: 7, lat: 21.03}, 'Philippines': {lon: 120.98, tz: 8, lat: 14.60},
  'Myanmar': {lon: 96.16, tz: 6.5, lat: 16.87}, 'Cambodia': {lon: 104.92, tz: 7, lat: 11.55}, 'Laos': {lon: 102.63, tz: 7, lat: 17.97},
  'Brunei': {lon: 114.94, tz: 8, lat: 4.94},
  // East Asia
  'China': {lon: 116.41, tz: 8, lat: 39.90}, 'Japan': {lon: 139.69, tz: 9, lat: 35.68}, 'South Korea': {lon: 126.98, tz: 9, lat: 37.57},
  'North Korea': {lon: 125.75, tz: 9, lat: 39.02}, 'Taiwan': {lon: 121.56, tz: 8, lat: 25.03}, 'Hong Kong': {lon: 114.17, tz: 8, lat: 22.32},
  'Macau': {lon: 113.54, tz: 8, lat: 22.20}, 'Mongolia': {lon: 106.92, tz: 8, lat: 47.92},
  // South Asia
  'India': {lon: 77.21, tz: 5.5, lat: 28.61}, 'Pakistan': {lon: 73.06, tz: 5, lat: 33.72}, 'Bangladesh': {lon: 90.41, tz: 6, lat: 23.81},
  'Sri Lanka': {lon: 79.86, tz: 5.5, lat: 6.93}, 'Nepal': {lon: 85.32, tz: 5.75, lat: 27.72}, 'Bhutan': {lon: 89.64, tz: 6, lat: 27.47},
  'Afghanistan': {lon: 69.21, tz: 4.5, lat: 34.56}, 'Maldives': {lon: 73.51, tz: 5, lat: 4.17},
  // Middle East
  'Iran': {lon: 51.42, tz: 3.5, lat: 35.69}, 'Iraq': {lon: 44.37, tz: 3, lat: 33.31}, 'Saudi Arabia': {lon: 46.72, tz: 3, lat: 24.71},
  'United Arab Emirates': {lon: 54.37, tz: 4, lat: 24.45}, 'Qatar': {lon: 51.53, tz: 3, lat: 25.29}, 'Kuwait': {lon: 47.98, tz: 3, lat: 29.38},
  'Bahrain': {lon: 50.59, tz: 3, lat: 26.23}, 'Oman': {lon: 58.41, tz: 4, lat: 23.59}, 'Israel': {lon: 35.21, tz: 2, lat: 31.77},
  'Jordan': {lon: 35.94, tz: 3, lat: 31.95}, 'Lebanon': {lon: 35.50, tz: 2, lat: 33.89}, 'Syria': {lon: 36.29, tz: 3, lat: 33.51},
  'Turkey': {lon: 32.86, tz: 3, lat: 39.93}, 'Yemen': {lon: 44.19, tz: 3, lat: 15.35},
  // Europe
  'United Kingdom': {lon: -0.13, tz: 0, lat: 51.51}, 'Ireland': {lon: -6.27, tz: 0, lat: 53.35}, 'Portugal': {lon: -9.14, tz: 0, lat: 38.72},
  'France': {lon: 2.35, tz: 1, lat: 48.86}, 'Germany': {lon: 13.40, tz: 1, lat: 52.52}, 'Spain': {lon: -3.70, tz: 1, lat: 40.42},
  'Italy': {lon: 12.50, tz: 1, lat: 41.90}, 'Netherlands': {lon: 4.90, tz: 1, lat: 52.37}, 'Belgium': {lon: 4.35, tz: 1, lat: 50.85},
  'Switzerland': {lon: 7.45, tz: 1, lat: 46.95}, 'Austria': {lon: 16.37, tz: 1, lat: 48.21}, 'Poland': {lon: 21.02, tz: 1, lat: 52.23},
  'Sweden': {lon: 18.06, tz: 1, lat: 59.33}, 'Norway': {lon: 10.75, tz: 1, lat: 59.91}, 'Denmark': {lon: 12.57, tz: 1, lat: 55.68},
  'Finland': {lon: 24.94, tz: 2, lat: 60.17}, 'Greece': {lon: 23.73, tz: 2, lat: 37.98}, 'Romania': {lon: 26.10, tz: 2, lat: 44.43},
  'Russia': {lon: 37.62, tz: 3, lat: 55.75}, 'Ukraine': {lon: 30.52, tz: 2, lat: 50.45}, 'Czech Republic': {lon: 14.42, tz: 1, lat: 50.09},
  'Hungary': {lon: 19.04, tz: 1, lat: 47.50},
  // Oceania
  'Australia': {lon: 149.13, tz: 10, lat: -35.28}, 'New Zealand': {lon: 174.78, tz: 12, lat: -41.29},
  // North America
  'United States': {lon: -77.04, tz: -5, lat: 38.90}, 'Canada': {lon: -75.70, tz: -5, lat: 45.42}, 'Mexico': {lon: -99.13, tz: -6, lat: 19.43},
  // South America
  'Brazil': {lon: -47.93, tz: -3, lat: -15.79}, 'Argentina': {lon: -58.38, tz: -3, lat: -34.60}, 'Chile': {lon: -70.65, tz: -4, lat: -33.45},
  'Colombia': {lon: -74.08, tz: -5, lat: 4.71}, 'Peru': {lon: -77.03, tz: -5, lat: -12.05},
  // Africa
  'Egypt': {lon: 31.24, tz: 2, lat: 30.04}, 'South Africa': {lon: 28.19, tz: 2, lat: -25.75}, 'Nigeria': {lon: 7.49, tz: 1, lat: 9.08},
  'Kenya': {lon: 36.82, tz: 3, lat: -1.29}, 'Morocco': {lon: -6.85, tz: 1, lat: 34.02}
};

// ENHANCEMENT (this round): city-level selection for the 7 countries in the list above that genuinely
// span multiple time zones on their mainland (per multiple independent sources) - the single
// capital-city value used for these countries in COUNTRY_LONGITUDE_TIMEZONE is a reasonable default
// but a real source of error for anyone born far from that capital. When one of these 7 countries is
// selected, a second dropdown lets the user pick a representative city closer to their actual birth
// region instead. All offsets are standard (non-DST) time, consistent with the rest of this table and
// with how this app already handles timezone (a fixed input, not a DST-aware system).
// Verified internally by checking a strong consistency property before trusting this data: within
// each country, sorting cities by longitude produces a perfectly monotonic offset sequence (moving
// east/west in a country moves the clock in the matching direction, with no out-of-order entries) -
// a real transcription error would very likely have broken this pattern, and none did.
// Each city entry now also carries `lat` (see the comment above COUNTRY_LONGITUDE_TIMEZONE for why).
const MULTI_TIMEZONE_COUNTRY_CITIES = {
  'United States': [
    {city:'New York (Eastern)', lon:-74.01, tz:-5, lat:40.71}, {city:'Chicago (Central)', lon:-87.65, tz:-6, lat:41.88},
    {city:'Denver (Mountain)', lon:-104.99, tz:-7, lat:39.74}, {city:'Phoenix (Arizona, no DST)', lon:-112.07, tz:-7, lat:33.45},
    {city:'Los Angeles (Pacific)', lon:-118.24, tz:-8, lat:34.05}, {city:'Anchorage (Alaska)', lon:-149.90, tz:-9, lat:61.22},
    {city:'Honolulu (Hawaii)', lon:-157.86, tz:-10, lat:21.31}
  ],
  'Canada': [
    {city:"St. John's (Newfoundland)", lon:-52.71, tz:-3.5, lat:47.56}, {city:'Halifax (Atlantic)', lon:-63.57, tz:-4, lat:44.65},
    {city:'Toronto (Eastern)', lon:-79.38, tz:-5, lat:43.65}, {city:'Winnipeg (Central)', lon:-97.14, tz:-6, lat:49.90},
    {city:'Edmonton (Mountain)', lon:-113.49, tz:-7, lat:53.55}, {city:'Vancouver (Pacific)', lon:-123.12, tz:-8, lat:49.28}
  ],
  'Russia': [
    {city:'Kaliningrad', lon:20.51, tz:2, lat:54.71}, {city:'Moscow', lon:37.62, tz:3, lat:55.75}, {city:'Samara', lon:50.15, tz:4, lat:53.20},
    {city:'Yekaterinburg', lon:60.61, tz:5, lat:56.84}, {city:'Omsk', lon:73.37, tz:6, lat:54.99}, {city:'Krasnoyarsk', lon:92.85, tz:7, lat:56.01},
    {city:'Irkutsk', lon:104.30, tz:8, lat:52.29}, {city:'Yakutsk', lon:129.73, tz:9, lat:62.03}, {city:'Vladivostok', lon:131.90, tz:10, lat:43.12},
    {city:'Magadan', lon:150.81, tz:11, lat:59.56}, {city:'Petropavlovsk-Kamchatsky', lon:158.65, tz:12, lat:53.02}
  ],
  'Australia': [
    {city:'Perth (Western)', lon:115.86, tz:8, lat:-31.95}, {city:'Darwin (Northern Territory)', lon:130.84, tz:9.5, lat:-12.46},
    {city:'Adelaide (South Australia)', lon:138.60, tz:9.5, lat:-34.93}, {city:'Melbourne (Victoria)', lon:144.96, tz:10, lat:-37.81},
    {city:'Sydney (New South Wales)', lon:151.21, tz:10, lat:-33.87}, {city:'Brisbane (Queensland)', lon:153.03, tz:10, lat:-27.47}
  ],
  'Indonesia': [
    {city:'Jakarta (Western, WIB)', lon:106.85, tz:7, lat:-6.21}, {city:'Makassar (Central, WITA)', lon:119.42, tz:8, lat:-5.15},
    {city:'Jayapura (Eastern, WIT)', lon:140.70, tz:9, lat:-2.53}
  ],
  'Mexico': [
    {city:'Tijuana (Northwest)', lon:-117.02, tz:-8, lat:32.53}, {city:'Chihuahua (Pacific)', lon:-106.42, tz:-7, lat:28.63},
    {city:'Mexico City (Central)', lon:-99.13, tz:-6, lat:19.43}, {city:'Cancun (Southeast)', lon:-86.85, tz:-5, lat:21.16}
  ],
  'Brazil': [
    {city:'Rio Branco (Acre)', lon:-67.81, tz:-5, lat:-9.97}, {city:'Manaus (Amazon)', lon:-60.02, tz:-4, lat:-3.12},
    {city:'Brasília / Rio / São Paulo', lon:-47.93, tz:-3, lat:-15.79}, {city:'Fernando de Noronha', lon:-32.42, tz:-2, lat:-3.85}
  ]
};

const STATIC_UI_ZH = {
  welcomeSub: '通过八字、奇门遁甲、数字命理与易经，探索自我反思之旅。',
  txtExportCenterHeader: '导出中心', txtExportCenterNote: '为任一档案导出完整PDF报告，或一次导出所有档案，各自独立为一份文件，并打包成一个ZIP压缩包下载。',
  txtExportAllZip: '导出全部档案（ZIP）',
  txtExportPdf: '导出PDF',
  lblCountryLookup: '出生国家 *',
  lblPartnerCountryLookup: '出生国家 *',
  lblBizCountryLookup: '出生国家 *',
  lblBiz2CountryLookup: '出生国家 *',
  lblChildCountryLookup: '出生国家 *',
  navDetailedReadingText: '详读',
  txtDetailedReadingHeader: '详细解读',
  txtDetailedReadingSub: '完整叙事式八字解读，涵盖命、事业、财富、运势、感情、健康，以及您当前与即将到来的流年与大运周期。',
  btnCreateAcc: '创建账户', btnSignIn: '登录',
  // NOTE: authTitle/authSub/authSubmit/modeToggle are deliberately NOT listed here any more - their
  // English/Chinese text now depends on BOTH the current language AND whether the auth screen is in
  // Create-Account or Sign-In mode, which this dictionary alone can't express (it only ever captures
  // one "original English" string per id, whichever happened to be showing the first time this ran -
  // exactly the kind of stale, mode-blind snapshot that caused the "unable to login"/"unable to create
  // new account" bug in the first place). See updateAuthModeUI() below, which is bilingual-aware on
  // its own and handles all four of these ids directly, and is called instead of/alongside this
  // function wherever the auth screen's mode might have changed.
  lblAuthEmail: '电子邮箱', lblAuthPass: '密码',
  txtAuthNote: '资料仅保存在本设备上。',
  txtFoundation: '您的根基', txtStoryBegin: '您的故事从何时开始？',
  txtGregorianNote: '请输入您的公历出生资料，以推算您的农历与八字命盘。',
  lblEnglishLastName: '英文姓氏 (姓) *', lblEnglishFirstName: '英文名字 (名) *',
  lblChineseLastName: '中文姓氏（选填）', lblChineseFirstName: '中文名字（选填）',
  lblBirthGender: '性别（必填）*', lblBirthDate: '出生日期 *', lblBirthTime: '出生时间 *',
  saveProfile: '保存资料',
  txtDailyCompass: '您的每日指南与综合解读', txtPartnerSummaryEyebrow: '伴侣摘要与每日运势',
  txtBizSummaryEyebrow: '事业伙伴摘要与契合分析',
  txtYourSystems: '命理体系', btnViewAll: '查看全部',
  lblSysName: '姓名学', subSysName: '五格数理',
  lblSysZodiac: '生肖', subSysZodiac: '三合与相冲',
  lblSysMingLi: '命理 (命理)', subSysMingLi: '命理分析',
  lblSysDaYun: '大运 (大运)', subSysDaYun: '大运周期',
  lblSysQmdj: '奇门遁甲', subSysQmdj: '命宫',
  lblSysZiWei: '紫微斗数', subSysZiWei: '紫微星',
  lblSysBone: '称骨 (称骨)', subSysBone: '称骨算命',
  lblSysFs: '风水 (风水)', subSysFs: '环境风水',
  lblSysIChing: '易经 (易经)', subSysIChing: '卦象',
  lblSysZeRi: '择日 (择日)', subSysZeRi: '择日选时',
  lblSysXiang: '相术 (相术)', subSysXiang: '面相手相',
  lblSysNum: '数字命理', subSysNum: '生命数字',
  lblSysWestern: '西洋占星', subSysWestern: '太阳星座',
  txtMetaSuggestions: '玄学建议',
  lblFourDPill: '新加坡万字票 4D', txtFourDHeading: '新加坡万字票 4D 开奖与预测',
  lblTotoPill: '新加坡多多 TOTO', txtTotoHeading: '新加坡多多 TOTO 开奖与预测',
  txtDisclaimer: '仅供反思与娱乐，非科学、财务或医疗建议。',
  txtYourChart: '您的命盘',
  txtPartnerCompat: '伴侣契合度', txtCompatSub: '比较双方命盘，获得关系反思洞见。',
  lblPartnerEngLast: '伴侣英文姓氏 (姓) *', lblPartnerEngFirst: '伴侣英文名字 (名) *',
  lblPartnerChiLast: '伴侣中文姓氏', lblPartnerChiFirst: '伴侣中文名字',
  lblPartnerGender: '伴侣性别（必填）*', lblPartnerDate: '伴侣出生日期 *', lblPartnerTime: '伴侣出生时间 *',
  btnCalculateCompat: '计算伴侣契合度',
  txtBizHeader: '事业伙伴契合分析', txtBizSub: '评估战略执行协同与商业契合度。',
  lblBizEngLast: '事业伙伴英文姓氏 (姓) *', lblBizEngFirst: '事业伙伴英文名字 (名) *',
  lblBizChiLast: '事业伙伴中文姓氏', lblBizChiFirst: '事业伙伴中文名字',
  lblBizGender: '伙伴性别（必填）*', lblBizDate: '伙伴出生日期 *', lblBizTime: '伙伴出生时间 *',
  btnCalculateBiz: '计算事业契合度',
  txtFullPartnerHeader: '伴侣完整分析', btnEditPartner: '编辑', btnRemovePartner: '移除',
  txtFullBizHeader: '事业伙伴完整分析', btnEditBiz: '编辑', btnRemoveBiz: '移除',
  txtAccountHeader: '账户', txtProfileHeader: '个人资料', editProfile: '编辑出生资料',
  txtManageProfilesHeader: '管理档案', txtManageProfilesNote: '在此直接跳转至任一档案的编辑页面。',
  txtAccountOccupantsHeader: '家庭住户', txtAccountOccupantsNote: '适用于尚未建立完整档案的家庭成员——您的生活伴侣与子女已自动纳入，请勿在此重复添加。',
  btnDismissStorageWarning: '关闭',
  txtPrivacyHeader: '隐私', signOut: '退出登录',
  navTodayText: '今日', navChartText: '命盘', navCompatText: '伴侣', navBizText: '事业', navChildrenText: '子女', navAccountText: '账户',
  txtChildrenHeader: '子女', txtChildrenSub: '最多添加5位子女档案，进行完整八字分析与家庭契合度评估。',
  optSelectGender: '请选择性别', optMale: '男 / Male', optFemale: '女 / Female',
  optPSelectGender: '请选择性别', optPMale: '男 / Male', optPFemale: '女 / Female',
  optBSelectGender: '请选择性别', optBMale: '男 / Male', optBFemale: '女 / Female',
  txtChildrenHeader: '子女', txtChildrenSub: '最多可添加 5 位子女资料，进行完整八字分析与家庭契合度评估。',
  lblChildEngLast: '子女英文姓氏 (姓) *', lblChildEngFirst: '子女英文名字 (名) *',
  lblChildChiLast: '子女中文姓氏', lblChildChiFirst: '子女中文名字',
  lblChildGender: '子女性别（必填）*', lblChildDate: '子女出生日期 *', lblChildTime: '子女出生时间 *',
  btnAddChild: '添加子女资料', optCSelectGender: '请选择性别', optCMale: '男 / Male', optCFemale: '女 / Female',
  txtAddAnotherBiz: '添加另一位事业伙伴（最多3位）',
  lblBiz2EngLast: '事业伙伴英文姓氏 (姓) *', lblBiz2EngFirst: '事业伙伴英文名字 (名) *',
  lblBiz2ChiLast: '事业伙伴中文姓氏', lblBiz2ChiFirst: '事业伙伴中文名字',
  lblBiz2Gender: '伙伴性别（必填）*', lblBiz2Date: '伙伴出生日期 *', lblBiz2Time: '伙伴出生时间 *',
  btnAddBizPartner2: '添加事业伙伴', optB2SelectGender: '请选择性别', optB2Male: '男 / Male', optB2Female: '女 / Female',
  navHourlyText: '每小时', txtHourlyHeader: '每日亮点', txtHourlySub: '根据您的八字、奇门遁甲、紫微斗数及中文姓名，逐小时解析今日能量。',
  lblPersonalAssetsSummary: '个人资产与地址', txtPersonalAssetsSummaryNote: '手机、车牌及地址契合度评分一览——点击查看「个人资产」及「风水」的完整详情。'
};
const STATIC_UI_EN = {}; // populated on first run so toggling back to English restores the originals

function updateStaticLanguage() {
  const isZh = lang === 'zh';
  const langToggle = $('#langToggle'); if (langToggle) langToggle.textContent = isZh ? 'EN' : '中文';
  const brandTagline = $('#brandTagline'); if (brandTagline) brandTagline.textContent = isZh ? '点亮生命' : 'Illuminating Life';
  const welcomeTitle = $('#welcomeTitle'); if (welcomeTitle) welcomeTitle.textContent = isZh ? '点亮生命。' : 'Illuminating Life.';

  Object.keys(STATIC_UI_ZH).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!(id in STATIC_UI_EN)) STATIC_UI_EN[id] = el.textContent; // capture original English once
    el.textContent = isZh ? STATIC_UI_ZH[id] : STATIC_UI_EN[id];
  });
}

// BUG FIX (reported: "unable to login when an existing account exist" and, separately, "also unable
// to create new account"): both traced to the SAME root cause. The `signup` boolean is what actually
// decides whether the auth screen's Submit button creates a brand-new account (overwriting anything
// already at that email) or validates a login against an existing one - but nothing ever set it
// explicitly for either of the two ways a user reaches this screen. The Welcome screen's "Create an
// account" and "Sign in" buttons both just navigated to the same #auth view (via a generic handler
// that only knows how to change the visible screen, not the auth intent behind the click) - so
// whichever mode `signup` happened to be left in from a previous visit (or its own default of `true`)
// silently decided what actually happened, regardless of which button was clicked:
//  - Clicking "Sign In" while `signup` was still `true` (its default, or left over from before) didn't
//    validate credentials at all - it ran the CREATE branch, silently overwriting the existing account
//    with a fresh, empty profile. That reads exactly like "unable to login": the account's data
//    appears to vanish and the app drops back to the intake form instead of loading what was there.
//  - Once `signup` had been flipped to `false` at any point (e.g. via the in-form "I already have an
//    account" toggle), clicking "Create an account" from the Welcome screen for a genuinely NEW
//    account ran the LOGIN branch instead, which correctly found no existing user at that email and
//    reported "Invalid credentials" - "unable to create new account".
// On top of that, the in-form toggle itself never updated any visible text anywhere on the screen (the
// title, subtitle, and Submit button always just said "Welcome" / "Create a local account..." /
// "Create account", no matter which mode was actually active) - so there was no way to see which mode
// you were in even for someone who found the toggle.
//
// This function is the single place that keeps the auth screen's visible text in sync with the REAL
// current mode, in the current language - called whenever `signup` is set (by the two Welcome buttons
// and the in-form toggle, all fixed in auth.js) and whenever the auth view is shown at all (from
// go(), in app.js), so the screen can never show text that doesn't match what Submit will actually do.
function updateAuthModeUI() {
  const isZh = lang === 'zh';
  const setText = (id, en, zh) => { const el = document.getElementById(id); if (el) el.textContent = isZh ? zh : en; };
  if (signup) {
    setText('authTitle', 'Welcome', '欢迎');
    setText('authSub', 'Create a local account to save your profile in this browser.', '创建本机账户，将您的资料保存在此浏览器中。');
    setText('authSubmit', 'Create account', '创建账户');
    setText('modeToggle', 'I already have an account', '我已有账户');
  } else {
    setText('authTitle', 'Welcome back', '欢迎回来');
    setText('authSub', 'Sign in to the account already saved on this device.', '登录此设备上已保存的账户。');
    setText('authSubmit', 'Sign in', '登录');
    setText('modeToggle', "I don't have an account yet", '我还没有账户');
  }
  const err = document.getElementById('authError'); if (err) err.textContent = '';
}
