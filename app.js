// FILE: app.js
// Description: UI Routing, Deep Analysis Master Engine, Full Re-integration + Bug Fixes 1-16

// --- Strict 7-Part Format Deep Analysis Renderer ---
// CHINESE LANGUAGE FIX: this single renderer produces the structural chrome (the 7 numbered section
// labels) for every deep-analysis block in the ENTIRE app (~50+ call sites). Previously it was 100%
// English regardless of the language toggle - since it is the most-repeated piece of UI in the app,
// making it bilingual here has the largest possible impact on "Chinese not working throughout the app".
const DEEP_ANALYSIS_LABELS = {
  en: { title_fallback: 'DEEP ANALYSIS', characteristics: 'Characteristics', explanation: 'Explanation & Description of Findings', traits: 'Traits of Findings', highlights: 'Highlights', positives: 'Positives', negatives: 'Negatives', cautions: 'Cautions', remedies: 'Remedies & Suggestions (to counter Negatives/Cautions)', frictions: 'Potential Frictions & How to Manage Them', manageBy: 'Manage by', summary: 'Summary Findings' },
  zh: { title_fallback: '深度分析', characteristics: '特征', explanation: '发现的解释与描述', traits: '发现的特点', highlights: '亮点', positives: '优势', negatives: '劣势', cautions: '注意事项', remedies: '化解建议（应对劣势/注意事项）', frictions: '潜在摩擦点及应对方法', manageBy: '应对方法', summary: '总结发现' }
};
function scoreColor(score) { return score >= 95 ? 'var(--success)' : score >= 80 ? 'var(--warning)' : 'var(--danger)'; }

// BUG FIX: rating badges (Extremely Auspicious, Very Inauspicious, etc.) were overflowing their
// narrow table cells in the Hourly and Da Yun summary tables. Table cells now show the short
// abbreviation instead (see the `abbr`/`abbrZh` fields added to DAYUN_TIER_LABELS and
// HOURLY_TIER_LABELS), and this shared legend renders once per table so the abbreviations stay
// understandable - the same mechanism is reused for every table with this kind of rating badge,
// rather than a one-off fix for just the Hourly tab.
function renderRatingLegend(tierLabelsArray) {
  const items = tierLabelsArray.map(t => `<span style="display:inline-flex;align-items:center;gap:3px;margin:2px 8px 2px 0"><span style="display:inline-block;width:18px;text-align:center;color:#fff;background:${t.color};border-radius:8px;font-size:10px;font-weight:700;padding:1px 4px">${bt(t.abbr, t.abbrZh)}</span><span style="font-size:10px;color:var(--muted)">${bt(t.en, t.zh)}</span></span>`).join('');
  return `<div style="margin-top:8px;padding-top:6px;border-top:1px dashed var(--line)">${items}</div>`;
}

// ENHANCEMENT (this round): Flying Star (玄空飞星) result renderer - builds a 3x3 grid showing the
// Period/Mountain/Facing star numbers for each palace, given a construction year and facing
// direction entered via the standalone calculator in the Feng Shui section. This is a property-based
// calculation independent of any saved profile, so it takes raw inputs directly rather than a profile
// object. `p` (a profile's computed data, optional) is only used to attach a "Go Deep" deep-analysis
// button below the chart - the chart calculation itself never depends on it.
function renderFlyingStarResult(constructionYear, facingDir, p) {
  const chart = computeFlyingStarChart(constructionYear, facingDir);
  // Grid layout matching the traditional 3x3 compass arrangement (NW-N-NE / W-Center-E / SW-S-SE)
  const gridOrder = ['NW','N','NE','W','center','E','SW','S','SE'];
  const cellHTML = gridOrder.map(dir => {
    const pal = chart.palaces[dir];
    const isFacing = dir === chart.facingDirection, isSitting = dir === chart.sittingDirection;
    // BUG FIX (reported again: "Flying Star direction labels overrun their grid cells"): the earlier
    // CSS overflow-safety fix stopped the grid from breaking its container, but the English labels
    // themselves (full words like "Northeast") were still too long to actually sit comfortably inside
    // a ~100px-wide cell alongside the "(Facing)"/"(Sitting)" suffix. Grid cells now use the short
    // direction key itself (N/NE/E/SE/S/SW/W/NW, C for center) - the narrative sentence below the grid
    // (a few lines down) still spells out the full word, since it has room to.
    const label = dir === 'center' ? bt('C','中宫') : bt(dir, FLYING_STAR_DIR_LABEL_ZH[dir]);
    return `<div style="border:1px solid #ccc; padding:8px; text-align:center; background:${isFacing ? '#fff3e0' : isSitting ? '#e3f2fd' : '#fff'}; min-width:0; overflow:hidden">
      <div style="font-size:10px; color:var(--muted); margin-bottom:4px; overflow-wrap:break-word">${label}${isFacing ? bt(' (Facing)',' (向)') : isSitting ? bt(' (Sitting)',' (坐)') : ''}</div>
      <div style="display:flex; justify-content:space-between; gap:4px; font-size:13px; font-weight:700; color:var(--plum)">
        <span style="min-width:0">${pal.mountain}</span><span style="min-width:0">${pal.facing}</span>
      </div>
      <div style="font-size:11px; color:var(--muted); margin-top:2px">${bt('Period','运')} ${pal.period}</div>
    </div>`;
  }).join('');
  const fallbackNote = (chart.mountainUsedFallback || chart.facingUsedFallback) ? `<div class="calc-box" style="font-size:11px;margin-top:8px">${bt(`This chart hit the "seed = 5" edge case for its ${chart.mountainUsedFallback && chart.facingUsedFallback ? 'Mountain and Facing stars' : chart.mountainUsedFallback ? 'Mountain star' : 'Facing star'} (5 has no fixed trigram position to derive Yin/Yang from) - documented sources differ on the convention here; this uses the sitting/facing direction's own Yin/Yang directly, one acknowledged approach among others.`, `此盘的${chart.mountainUsedFallback && chart.facingUsedFallback ? '山星与向星' : chart.mountainUsedFallback ? '山星' : '向星'}遇上「入中数为5」的特殊情况（5无固定卦位可据以判断阴阳）——各家对此处理方式不一；此处采用坐向本身的阴阳直接判断，为其中一种公认做法，非唯一解。`)}</div>` : '';
  // BUG FIX (reported: "Flying Star chart rendering outside its display box"): CSS Grid columns
  // default to a min-width of "auto", which means an unbreakable piece of content (a long label, a
  // wide number) can force a column WIDER than its 1fr share and push the whole grid past its
  // container's edge - this app's own content column is only ~330-380px wide on a real phone screen,
  // narrow enough for this to bite. `min-width:0` on both the grid container and every cell lets each
  // column actually shrink to fit, and `overflow:hidden`/`overflow-wrap:break-word` on each cell is a
  // second line of defence for the rare label that still doesn't fit.
  return `
    <div class="calc-box" style="font-size:12px">${bt(`Period ${chart.period} (construction year ${constructionYear}) - Facing ${FLYING_STAR_DIR_LABEL_EN[facingDir]}, Sitting ${FLYING_STAR_DIR_LABEL_EN[chart.sittingDirection]}.`, `第${chart.period}运（建造年份${constructionYear}）——向${FLYING_STAR_DIR_LABEL_ZH[facingDir]}，坐${FLYING_STAR_DIR_LABEL_ZH[chart.sittingDirection]}。`)}</div>
    <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:4px; margin:10px 0; min-width:0; max-width:100%">${cellHTML}</div>
    <div style="font-size:10px; color:var(--muted)">${bt('Each cell: top-left = Mountain Star, top-right = Facing Star, bottom = Period Star.','每格：左上=山星，右上=向星，下方=运星。')}</div>
    ${fallbackNote}
    <div class="calc-box" style="font-size:11px;margin-top:8px">${bt('This identifies the numbers occupying each palace only - named patterns (like Wang Shan Wang Xiang) and combination readings between the property chart and the current annual/monthly/daily stars below are not included. Uses the 8 primary compass directions only, not the full 24-mountain system a professional reading would use with a precise compass degree - treat a facing that falls near a boundary between two of the 24 mountains as needing a professional assessment.', '此处仅列出各宫数字——命名格局（如旺山旺向）及本命盘与下方流年／流月／流日飞星的组合吉凶解读均未涵盖在内。仅采用八个基本方位，非专业风水师使用的完整二十四山系统——若朝向接近二十四山交界处，宜寻求专业评估。')}</div>
    ${p ? generateDeepAnalysisData('flyingstar_property', p, { title: 'Flying Star Property Deep Analysis', chart, constructionYear, facingDir }) : ''}
  `;
}

// ENHANCEMENT (this round): Annual/Monthly/Daily Flying Star overlay - computed automatically from
// today's date (no input needed), unlike the property calculator above which needs construction year
// and facing direction. This shows which numbers currently occupy each of the 9 palaces regardless of
// any specific property, useful as a general "what's active right now" reference.
// `p` (a profile's computed data, optional) is only used to attach a "Go Deep" deep-analysis button
// below the grids - the chart calculation itself never depends on it.
// ENHANCEMENT (this round): "Calculated as of" line for readings that are recomputed live from
// today's date on every render (Flying Star Temporal Overlay, 3-Year Monthly Da Yun Forecast,
// 3-Year Monthly Western Astrology Match) - makes clear these are current-as-of-viewing, not a
// fixed prediction. NOT used for lottery predictions, which are persisted once and never
// regenerated - those show their own stored generation date instead (see renderLotteryPredictions
// in engine-predictions.js).
function calculatedAsOfLine(dateObj) {
  const d = dateObj || new Date();
  const dateStr = d.toISOString().slice(0, 10);
  return `<div class="calculated-as-of">${bt(`Calculated as of: ${dateStr}`, `计算基准日期：${dateStr}`)}</div>`;
}
function renderFlyingStarTemporalOverlay(p) {
  const overlay = computeFlyingStarTemporalOverlay(new Date());
  const gridOrder = ['NW','N','NE','W','center','E','SW','S','SE'];
  const buildGrid = (chart) => gridOrder.map(dir => {
    // BUG FIX: same grid-cell abbreviation fix as renderFlyingStarResult above - short direction key
    // instead of the full English word, so it actually fits a ~100px cell.
    const label = dir === 'center' ? bt('C','中宫') : bt(dir, FLYING_STAR_DIR_LABEL_ZH[dir]);
    return `<div style="border:1px solid #ccc; padding:6px; text-align:center; background:#fff; min-width:0; overflow:hidden">
      <div style="font-size:9px; color:var(--muted); overflow-wrap:break-word">${label}</div>
      <div style="font-size:14px; font-weight:700; color:var(--plum)">${chart[dir]}</div>
    </div>`;
  }).join('');
  // BUG FIX (reported: "Flying Star chart rendering outside its display box"): three full 3x3 grids
  // side-by-side (9 cells wide in total) inside a fixed `1fr 1fr 1fr` outer grid had no minimum-width
  // safety net, so on a real phone screen (this app's content column is only ~330-380px wide) the
  // labels ("Monthly (2026-09)", "流月（2026年9月）", etc.) could force each column wider than its
  // 1fr share, pushing the whole three-grid block past the edge of its container. Switched the outer
  // grid to `repeat(auto-fit, minmax(...))` with `min-width:0` throughout, so Annual/Monthly/Daily
  // gracefully wrap onto more than one row on a narrow screen instead of forcing an overflow.
  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(108px, 1fr)); gap:12px; margin-top:8px; min-width:0; max-width:100%">
      <div style="min-width:0">
        <div style="font-size:11px; font-weight:700; color:var(--plum); margin-bottom:4px; text-align:center">${bt(`Annual (${overlay.annual.year})`, `流年（${overlay.annual.year}）`)}</div>
        <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:2px; min-width:0">${buildGrid(overlay.annual.chart)}</div>
      </div>
      <div style="min-width:0">
        <div style="font-size:11px; font-weight:700; color:var(--plum); margin-bottom:4px; text-align:center">${bt(`Monthly (${overlay.monthly.year}-${String(overlay.monthly.month).padStart(2,'0')})`, `流月（${overlay.monthly.year}年${overlay.monthly.month}月）`)}</div>
        <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:2px; min-width:0">${buildGrid(overlay.monthly.chart)}</div>
      </div>
      <div style="min-width:0">
        <div style="font-size:11px; font-weight:700; color:var(--plum); margin-bottom:4px; text-align:center">${bt(`Daily`, `流日`)}</div>
        <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:2px; min-width:0">${buildGrid(overlay.daily.chart)}</div>
      </div>
    </div>
    <div style="font-size:10px; color:var(--muted); margin-top:6px">${bt(`Daily star governed by the ${overlay.daily.governingTerm} solar term period (seed ${overlay.daily.seed}).`, `流日星依「${overlay.daily.governingTerm}」节气区间推算（入中数${overlay.daily.seed}）。`)}</div>
    ${calculatedAsOfLine()}
    <div class="calc-box" style="font-size:11px;margin-top:8px">${bt('Confidence differs across these three: the Annual formula was verified against 2 independently-stated worked examples and matched exactly. The Monthly formula was derived from a documented mnemonic and confirmed internally consistent with a real classical zodiac grouping, but not checked against an external worked example. The Daily formula is the most complex of the three (six different solar-term-based windows) and could NOT be checked against a clean external worked example in the time available - treat it as the least-verified of the three. None of these charts have yet been read against any specific property\'s own Mountain/Facing chart above - that combination reading is a further step not attempted here.', '三者置信度不同：流年公式已对照两个独立来源明确给出的实例，完全吻合。流月公式依据文献口诀推导，并与真实的传统生肖分组内部一致（非任意分组），但未有外部实例可供核对。流日公式为三者中最复杂（六种不同节气区间各有公式），且在现有时间内未能找到可靠的外部实例核对——请将其视为三者中把握最低的一项。以上飞星盘尚未与上方特定建筑物本身的山星／向星盘进行组合解读——该组合分析属进一步步骤，本处未涵盖。')}</div>
    ${p ? generateDeepAnalysisData('flyingstar_temporal', p, { title: 'Flying Star Temporal Overlay Deep Analysis', overlay }) : ''}
  `;
}

// ENHANCEMENT (this round): Personal Assets - Mobile Number, Vehicle Number(s), and Home Address
// persistence, replacing the previous one-off, non-persistent number checkers on the home page.
// Reuses the SAME scoring engine (auditVehicleScore/auditMobileScore) already built and tested for
// those checkers - only the persistence and profile-tying is new, not the underlying analysis.
// SCOPE (per explicit request): Mobile Number applies to every profile type (individual, life
// partner, business partner(s), children). Vehicle ownership applies to individual and life partner
// only. Home Address/facing/construction year is a household-level concept, entered on the
// individual's own profile, and its analysis (Ba Zhai, Flying Star) already extends to partner,
// children, and household occupants via the existing household/occupants mechanisms.
function renderMobileNumberBlock(prefix, p, prof) {
  const mobileVal = prof?.mobileNumber || '';
  const resultHTML = mobileVal ? computeMobileNumberDeepAnalysisHTML(mobileVal, prefix) : '';
  return `
    <article class="reading">
      <span class="pill">${bt('Mobile Number','手机号码')}</span>${needsInputBadge(!!mobileVal)}
      <div class="pdf-exclude">
        <label class="field" style="margin-top:0"><span style="font-size:12px">${bt('Your Mobile Number (saved automatically)','您的手机号码（自动保存）')}</span>
          <input type="tel" id="mobileNumberInput_${prefix}" name="mobileNumberInput_${prefix}" class="mobileNumberInput" data-prefix="${prefix}" value="${escapeHtml(mobileVal)}" maxlength="20" placeholder="${bt('e.g. 91234567','例如 91234567')}" style="width:100%; padding:10px; margin-top:5px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
        </label>
      </div>
      <div id="mobileNumberResult_${prefix}">${resultHTML}</div>
    </article>
  `;
}
function computeMobileNumberDeepAnalysisHTML(mobileVal, prefix) {
  const prof = getProfileByPrefix(prefix);
  const p = prof ? getProfileData(prof) : getProfileData();
  const res = auditMobileScore(mobileVal, p, null);
  return generateDeepAnalysisData('mobile_number', p, { title: 'Mobile Number Deep Elemental Analysis', number: escapeHtml(mobileVal), auditResult: res });
}
function renderVehiclesBlock(prefix, p, prof) {
  // UPDATED (reported: "why does the profile data entry for business partner have vehicle plate number
  // for life partner only? business partner should have compatibility score and deep analysis for their
  // own mobile number and vehicle number"): Vehicle Number now also applies to Business Partner ('b'),
  // scored against their own Day Master only (no "shared with Life Partner" concept applies to a
  // Business Partner - see computeVehicleDeepAnalysisHTML). Still doesn't apply to Children/Household
  // Occupants, who have no vehicle-ownership concept in this app.
  if (prefix !== 'i' && prefix !== 'p' && prefix !== 'b') return '';
  prof.vehicles = prof.vehicles || [];
  // "Shared with Life Partner" only has meaning for the individual/Life Partner pair - a Business
  // Partner's own vehicle has no analogous "Life Partner" to cross-reference in this app's data model,
  // so that checkbox and its cross-referencing are simply omitted for prefix 'b': their vehicle is
  // scored purely against their own Day Master (see computeVehicleDeepAnalysisHTML).
  const showSharedCheckbox = (prefix === 'i' || prefix === 'p');
  const rowsHTML = prof.vehicles.map((v, idx) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px;background:#f5f3ec;border-radius:8px">
      <span style="flex:1;font-weight:700;color:var(--plum);font-size:13px">${escapeHtml(v.number)}</span>
      ${showSharedCheckbox ? `<label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)"><input type="checkbox" id="vehicleSharedCheckbox_${prefix}_${idx}" name="vehicleSharedCheckbox_${prefix}_${idx}" class="vehicleSharedCheckbox" data-prefix="${prefix}" data-idx="${idx}" ${v.shared?'checked':''} autocomplete="off"> ${bt('Shared','共用')}</label>` : ''}
      <button class="btnRemoveVehicle pdf-exclude" data-prefix="${prefix}" data-idx="${idx}" style="border:0;background:var(--danger);color:#fff;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer">${bt('Remove','移除')}</button>
    </div>
    <div id="vehicleResult_${prefix}_${idx}">${computeVehicleDeepAnalysisHTML(prefix, idx)}</div>
  `).join('');
  return `
    <article class="reading">
      <span class="pill">${bt('Vehicle Number Plate(s)','车牌号码')}</span>${needsInputBadge(prof.vehicles.length > 0)}
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${showSharedCheckbox ? bt('Multiple vehicles supported - each is tied to this specific profile. Check "Shared" if this vehicle is also used by your Life Partner.', '支持多辆车——每辆车均与此特定档案绑定。若此车辆亦由生活伴侣共用，请勾选「共用」。') : bt('Multiple vehicles supported - each is tied to this specific Business Partner profile and scored against their own Day Master.', '支持多辆车——每辆车均与此事业伙伴档案绑定，并依其本人日主评分。')}</div>
      ${rowsHTML}
      <div class="pdf-exclude field-row">
        <label class="field" style="margin:0;flex:1"><span style="font-size:12px">${bt('Add Vehicle Plate Number','添加车牌号码')}</span>
          <input type="text" id="newVehicleInput_${prefix}" maxlength="20" placeholder="${bt('e.g. SJL1234A','例如 SJL1234A')}" style="width:100%; padding:10px; margin-top:5px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
        </label>
        <button class="btnAddVehicle" data-prefix="${prefix}" style="align-self:flex-end; padding:10px 16px; background:var(--gold); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; margin-top:5px">${bt('Add','添加')}</button>
      </div>
    </article>
  `;
}
function computeVehicleDeepAnalysisHTML(prefix, idx) {
  const prof = getProfileByPrefix(prefix);
  if (!prof || !prof.vehicles || !prof.vehicles[idx]) return '';
  const v = prof.vehicles[idx];
  const p = getProfileData(prof);
  const u = activeUser();
  let partnerP = null;
  if (v.shared) {
    if (prefix === 'i' && u?.partner) partnerP = getProfileData(u.partner);
    else if (prefix === 'p') partnerP = getProfileData(); // the individual, from the partner's own view
  }
  const res = auditVehicleScore(v.number, p, partnerP);
  return generateDeepAnalysisData('vehicle_number', p, { title: `Vehicle Plate Deep Analysis - ${escapeHtml(v.number)}`, number: escapeHtml(v.number), auditResult: res, shared: v.shared, partnerP });
}

// ENHANCEMENT (reported: "Move the mobile number and vehicle plate checker into the personal assets
// section. They should not reside in the landing page"): the standalone "Vehicle Plate Check and
// Generator" / "Mobile Phone Check and Generator" tools used to live on the Home dashboard as a single,
// profile-agnostic widget - always scored against the main individual profile regardless of which
// profile's chart you were actually viewing, and with no real place to live once a profile's own chart
// is what you're looking at. They now render per-profile, directly inside THAT profile's own Personal
// Assets section, right after the persistent saved Mobile Number/Vehicle Plate fields above - so
// exploring a number is always scored against whichever profile's Personal Assets you're actually on,
// never silently the main individual by default. Vehicle Plate stays scoped to individual + Life
// Partner only (matching renderVehiclesBlock's own scope - other profile types have no vehicle
// ownership concept in this app); Mobile Number Check applies to every profile type (matching
// renderMobileNumberBlock's own scope). The underlying scoring/generation engine
// (auditVehicleScore/auditMobileScore/generateUnanchoredVehicle/generateUnanchoredMobile) is completely
// unchanged - only where this tool lives, and which profile it's scored against, changed.
function renderNumberCheckerGeneratorBlock(prefix, p, prof) {
  // UPDATED (reported: business partner should have compatibility score and deep analysis for their
  // own vehicle number too): the Check-and-Generator tool now also renders for Business Partner ('b'),
  // matching renderVehiclesBlock's own extended scope. The "shared with Life Partner" checkbox has no
  // meaning for a Business Partner's own vehicle in this app's data model, so it's omitted for 'b' -
  // checking/generating there is always scored against the Business Partner's own Day Master only.
  const showVehicleShared = (prefix === 'i' || prefix === 'p');
  // BUG FIX (reported directly: "items like vehicle plate check and generator should not be included
  // into the pdf" - confirmed by inspecting an actual export: pages 50-51 showed a "Vehicle Plate Check
  // and Generator" / "Mobile Phone Check and Generator" heading followed by an empty "---" placeholder
  // box, wasting a near-blank page). This whole block is a purely interactive, exploratory tool (check a
  // candidate number/plate before committing to it, or generate a suggestion) with no persisted data of
  // its own to show in a static PDF - its individual form controls were already marked pdf-exclude, but
  // the outer <article> wrapper (and its heading pill) were not, so the empty shell survived into the
  // export. Marked pdf-exclude at the top level, matching how every other interactive-only widget in this
  // app is already excluded, so the ENTIRE section (heading included) is dropped from every PDF export.
  const vehicleSection = (prefix === 'i' || prefix === 'p' || prefix === 'b') ? `
    <article class="reading pdf-exclude">
      <span class="pill">${bt('Vehicle Plate Check and Generator', '车牌号码查询与生成')}</span>
      <div class="pdf-exclude" style="font-size:11px;color:var(--muted);margin-bottom:8px">${bt('Explore a plate before committing to it for this profile - checking or generating here never overwrites the saved plate(s) above.', '在为此档案正式使用某车牌前先行探索——此处查询或生成不会覆盖上方已保存的车牌。')}</div>
      <div class="pdf-exclude">
        <label class="field" style="margin-top:0"><span style="font-size:12px">${bt('Check a Vehicle Plate Number', '查询车牌号码')}</span>
          <input type="text" id="currentVehicleInput_${prefix}" class="currentVehicleInput" data-prefix="${prefix}" placeholder="${bt('e.g. SJL1234A', '例如 SJL1234A')}" style="width:100%; padding:10px; margin-top:5px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
        </label>
        ${showVehicleShared ? `<label class="checkbox-field" style="margin-top:6px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="checkVehicleSharedPartner_${prefix}" class="checkVehicleSharedPartner" data-prefix="${prefix}" autocomplete="off"><span style="font-size:12px">${bt('Check as Shared Vehicle Plate with Life Partner', '按与生活伴侣共用车牌查询')}</span></label>` : ''}
        <button class="btnCheckVehicle" data-prefix="${prefix}" style="margin-top:8px;background:var(--plum);color:#fff;border:0;border-radius:8px;font-size:12px;font-weight:700;padding:10px 16px;cursor:pointer">${bt('Check This Plate', '查询此车牌')}</button>
      </div>
      <div class="calc-box" id="currentVehicleAuditResult_${prefix}" style="padding:12px;margin-top:8px;display:none"></div>
      <hr class="pdf-exclude" style="border:0;border-top:1px dashed var(--line);margin:15px 0">
      <div class="pdf-exclude field-row">
        <label class="field" style="margin:0"><span style="font-size:12px">${bt('Generate Suggested Plate Length', '生成建议车牌位数')}</span>
          <select id="vehicleDigitSelect_${prefix}" class="vehicleDigitSelect" data-prefix="${prefix}" autocomplete="off">
            <option value="3">${bt('3 Digits', '3位')}</option>
            <option value="4" selected>${bt('4 Digits', '4位')}</option>
          </select>
        </label>
        ${showVehicleShared ? `<label class="checkbox-field" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="sharedPartnerVehicle_${prefix}" class="sharedPartnerVehicle" data-prefix="${prefix}" autocomplete="off"><span style="font-size:12px">${bt('Generate as Shared Vehicle Plate with Life Partner', '生成与生活伴侣共用车牌')}</span></label>` : ''}
      </div>
      <div class="calc-box" style="margin-top:8px"><strong id="vehicleNumberDisplay_${prefix}" style="font-size:20px;color:var(--plum);letter-spacing:1px">---</strong></div>
      <button class="btnRegenVehicle pdf-exclude" data-prefix="${prefix}" style="margin-top:8px;background:var(--sand);border:0;border-radius:8px;font-size:12px;font-weight:700;padding:10px 16px;cursor:pointer">${bt('🔄 Regenerate >95% Number', '🔄 重新生成 >95% 号码')}</button>
      <div id="vehicleCalcDetails_${prefix}" style="margin-top:10px"></div>
    </article>
  ` : '';

  const mobileSection = `
    <article class="reading pdf-exclude">
      <span class="pill">${bt('Mobile Phone Check and Generator', '手机号码查询与生成')}</span>
      <div class="pdf-exclude" style="font-size:11px;color:var(--muted);margin-bottom:8px">${bt('Explore a number before committing to it for this profile - checking or generating here never overwrites the saved number above.', '在为此档案正式使用某号码前先行探索——此处查询或生成不会覆盖上方已保存的号码。')}</div>
      <div class="pdf-exclude">
        <label class="field" style="margin-top:0"><span style="font-size:12px">${bt('Check a Mobile Number', '查询手机号码')}</span>
          <input type="tel" id="currentMobileInput_${prefix}" class="currentMobileInput" data-prefix="${prefix}" placeholder="${bt('e.g. 91234567', '例如 91234567')}" style="width:100%; padding:10px; margin-top:5px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
        </label>
        <label class="checkbox-field" style="margin-top:6px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="checkMobileSharedPartner_${prefix}" class="checkMobileSharedPartner" data-prefix="${prefix}" autocomplete="off"><span style="font-size:12px">${bt('Check as Shared Mobile Number with Life Partner', '按与生活伴侣共用号码查询')}</span></label>
        <button class="btnCheckMobile" data-prefix="${prefix}" style="margin-top:8px;background:var(--plum);color:#fff;border:0;border-radius:8px;font-size:12px;font-weight:700;padding:10px 16px;cursor:pointer">${bt('Check This Number', '查询此号码')}</button>
      </div>
      <div class="calc-box" id="currentMobileAuditResult_${prefix}" style="padding:12px;margin-top:8px;display:none"></div>
      <hr class="pdf-exclude" style="border:0;border-top:1px dashed var(--line);margin:15px 0">
      <div class="pdf-exclude field-row">
        <label class="field" style="margin:0"><span style="font-size:12px">${bt('Generate Suggested Mobile Length', '生成建议号码位数')}</span>
          <select id="mobileDigitSelect_${prefix}" class="mobileDigitSelect" data-prefix="${prefix}" autocomplete="off">
            <option value="4">${bt('4 Digits (Suffix)', '4位（末四位）')}</option>
            <option value="8" selected>${bt('8 Digits (Full SG Mobile)', '8位（完整新加坡号码）')}</option>
          </select>
        </label>
        <label class="field"><span style="font-size:12px">${bt('Singapore Mobile Prefix', '新加坡手机前缀')}</span>
          <select id="mobilePrefixSelect_${prefix}" class="mobilePrefixSelect" data-prefix="${prefix}" autocomplete="off">
            <option value="auto" selected>${bt('Auto-Derived (Default 9)', '自动生成（默认 9）')}</option>
            <option value="8">${bt('Force 8 Prefix', '强制 8 开头')}</option>
            <option value="9">${bt('Force 9 Prefix', '强制 9 开头')}</option>
          </select>
        </label>
        <label class="checkbox-field" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="sharedPartnerMobile_${prefix}" class="sharedPartnerMobile" data-prefix="${prefix}" autocomplete="off"><span style="font-size:12px">${bt('Generate as Shared Mobile Number with Life Partner', '生成与生活伴侣共用号码')}</span></label>
      </div>
      <div class="calc-box" style="margin-top:8px"><strong id="mobileNumberDisplay_${prefix}" style="font-size:20px;color:var(--plum);letter-spacing:1px">---</strong></div>
      <button class="btnRegenMobile pdf-exclude" data-prefix="${prefix}" style="margin-top:8px;background:var(--sand);border:0;border-radius:8px;font-size:12px;font-weight:700;padding:10px 16px;cursor:pointer">${bt('🔄 Regenerate >95% Number', '🔄 重新生成 >95% 号码')}</button>
      <div id="mobileCalcDetails_${prefix}" style="margin-top:10px"></div>
    </article>
  `;

  return vehicleSection + mobileSection;
}

// ENHANCEMENT (Task #76/#77, reported: "Feng Shui address check should keep the user profile address
// as persistent and keep a separate list of checked address (limited to 6 in total with the profile
// address)" + "address input [should] be in the form of House Number/Block, Street Name, Unit(if
// Applicable), Country, City, Postal Code, Construction Year for easier data management" - user
// confirmed "Yes, restructure now"): the single free-text address field is replaced by 6 structured
// fields (+ Construction Year on the persistent entry). The household now keeps exactly ONE persistent
// "Home Address" (u.home.addresses.profile) plus a rolling history of additional "Checked Addresses"
// (u.home.addresses.checked), capped so the two together never exceed 6 entries - the profile address
// always counts as one of the 6, so up to 5 more can be checked before the oldest is evicted to make
// room for a new one. Legacy u.home.address / u.home.constructionYear (still the fields the Intake
// page's own quick free-text field writes to - left untouched there, unrelated form) are migrated into
// the structured profile address the first time this section renders for an account that hasn't set
// one up here yet, and are kept in sync on every edit so Flying Star (which reads
// u.home.constructionYear directly) and Intake's own prefill both keep working unchanged.
const ADDRESS_STRUCT_FIELDS = ['houseNumber', 'streetName', 'unit', 'city', 'country', 'postalCode'];
// UPDATED (reported: "All address input street name should be mandatory"): Street Name moved from
// optional into the mandatory set alongside House Number/Block, City, Country, and Postal Code. Unit
// remains the only optional structured field (it genuinely doesn't apply to every address).
const ADDRESS_MANDATORY_FIELDS = ['houseNumber', 'streetName', 'city', 'country', 'postalCode'];
// UPDATED (reported: "Address input should have a checkbox to indicate if the address is a shared
// address" + "Check Address does not have year built, facing, and shared with life partner input
// options"): every address entry (the persistent Home Address, and each Checked Address) now carries
// its own `facing` (Home Main Door Facing for THAT property - independent of the main profile's
// prof.fsDir, which always mirrors whichever address is currently the persistent Home Address - see
// btnUseCheckedAsHome) and `shared` (explicitly ticked, not assumed just because a Life Partner exists -
// see renderAddressFieldsHTML/buildPersonalAssetsSummaryRows for what `shared` now gates).
function blankAddressEntry() { return { houseNumber: '', streetName: '', unit: '', city: '', country: '', postalCode: '', constructionYear: '', facing: '', shared: false }; }
function isAddressEmpty(a) { return !a || !ADDRESS_STRUCT_FIELDS.some(k => a[k]); }
// An address is COMPLETE (all 5 mandatory fields present) vs merely non-empty (isAddressEmpty above,
// which only checks that at least one of the 6 fields has something in it). "Mandatory" is enforced at
// the two points a person actually submits an address (the Intake page's Save button, and the "Check
// Another Address" form's own submit button - see their handlers) by blocking submission outright; the
// persistent Home Address block auto-saves per keystroke with no submit step to gate, so there
// completeness instead gates when the address is treated as "ready" for compatibility analysis/PDF
// export readiness, with an inline reminder of what's still missing - see renderHomeDetailsBlock.
function isAddressComplete(a) { return !!a && ADDRESS_MANDATORY_FIELDS.every(k => (a[k] || '').toString().trim()); }
const ADDRESS_MANDATORY_FIELD_LABELS = { houseNumber: () => bt('House Number / Block','门牌号/座号'), streetName: () => bt('Street Name','街道名称'), city: () => bt('City','城市'), country: () => bt('Country','国家'), postalCode: () => bt('Postal Code','邮政编码') };
function buildAddressMandatoryReminderHTML(addr) {
  if (isAddressEmpty(addr) || isAddressComplete(addr)) return ''; // nothing entered yet, or already complete - no reminder needed either way
  const missing = ADDRESS_MANDATORY_FIELDS.filter(k => !(addr[k] || '').toString().trim());
  // UPDATED (reported: "remove the home address entry from Feng Shui as it is to be managed at the
  // profile level"): this reminder is now purely informational here - the missing fields are filled in
  // on the Profile page, not inline, so the text says so.
  return `<div class="pdf-exclude calc-box" style="font-size:11px;border-left-color:var(--danger);margin-top:6px">${bt('Still needed on your Profile page for Address Compatibility analysis: ', '尚需在个人档案页面补充以进行地址契合度分析：')}${missing.map(k => ADDRESS_MANDATORY_FIELD_LABELS[k]()).join(', ')}</div>`;
}
function composeAddressString(a) {
  if (!a) return '';
  const line1 = [a.houseNumber, a.streetName].filter(Boolean).join(' ');
  const line2 = a.unit ? `#${a.unit}` : '';
  const line3 = [a.city, a.postalCode].filter(Boolean).join(' ');
  return [line1, line2, line3, a.country].filter(Boolean).join(', ');
}
// UPDATED (reported: "There should an option to add work address to check for compatibility and deep
// analysis for user and business partners"): a third, independent address slot - u.home.addresses.work
// - alongside the existing profile (Home) address and checked-addresses history. Unlike `profile`, it
// is never auto-migrated from any legacy field (there was never a legacy single work-address field) and
// defaults to null until the person actually enters one on the Intake/Profile page.
function ensureHomeAddressModel(u) {
  u.home = u.home || {};
  if (!u.home.addresses) u.home.addresses = { profile: null, checked: [], work: null };
  if (!u.home.addresses.profile && u.home.address) {
    u.home.addresses.profile = { ...blankAddressEntry(), streetName: u.home.address, constructionYear: u.home.constructionYear || '' };
  }
  if (!u.home.addresses.checked) u.home.addresses.checked = [];
  if (u.home.addresses.work === undefined) u.home.addresses.work = null;
  return u.home.addresses;
}
// Keeps the legacy single-string fields in sync so every OTHER existing reader (Flying Star,
// buildProfilePdfHTML, the Intake page's own prefill) keeps working without modification.
function syncLegacyHomeFields(u) {
  const profAddr = u.home.addresses && u.home.addresses.profile;
  if (profAddr && !isAddressEmpty(profAddr)) u.home.address = composeAddressString(profAddr);
  if (profAddr && profAddr.constructionYear) u.home.constructionYear = profAddr.constructionYear;
}
// UPDATED (reported: "Street Name should be mandatory" - dropped the "(Optional)" wording now that it's
// required, same as every other mandatory field) and (reported: "Check Address does not have year
// built, facing, and shared with life partner input options"): `includeYear` now also gates a new Home
// Main Door Facing select (this address entry's OWN `facing`, independent of prof.fsDir - see
// blankAddressEntry's comment) alongside Construction Year, since both are only meaningful once a
// specific property is being evaluated (not yet relevant while still typing a fresh, incomplete
// address). The "Shared with Life Partner" checkbox is unconditional - relevant for every address entry,
// including the persistent Home Address, so it always renders regardless of `includeYear`.
function renderAddressFieldsHTML(idPrefix, a, includeYear, includeFacing) {
  a = a || blankAddressEntry();
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const field = (key, label) => `
    <label class="field" style="margin:0"><span style="font-size:11px">${label}${ADDRESS_MANDATORY_FIELDS.includes(key) ? ' *' : ''}</span>
      <input type="text" id="${idPrefix}${cap(key)}" class="addrField" data-key="${key}" data-idprefix="${idPrefix}" value="${escapeHtml(a[key] || '')}" maxlength="120" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
    </label>`;
  const u = activeUser();
  const hasPartner = !!(u && u.partner);
  return `
    <div class="pdf-exclude" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
      ${field('houseNumber', bt('House Number / Block', '门牌号/座号'))}
      ${field('streetName', bt('Street Name', '街道名称'))}
      ${field('unit', bt('Unit (if applicable)', '单位号（如适用）'))}
      ${field('city', bt('City', '城市'))}
      ${field('country', bt('Country', '国家'))}
      ${field('postalCode', bt('Postal Code', '邮政编码'))}
      ${includeYear ? `<label class="field" style="margin:0"><span style="font-size:11px">${bt('Construction Year', '建造年份')}</span>
        <input type="number" id="${idPrefix}ConstructionYear" class="addrField" data-key="constructionYear" data-idprefix="${idPrefix}" value="${a.constructionYear || ''}" min="1864" max="2043" placeholder="e.g. 2015" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:4px" autocomplete="off"></label>` : ''}
      ${includeFacing ? `<label class="field" style="margin:0"><span style="font-size:11px">${bt('Home Main Door Facing', '住家大门朝向')}</span>
        <select id="${idPrefix}Facing" class="addrField" data-key="facing" data-idprefix="${idPrefix}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
          <option value="" ${!a.facing ? 'selected' : ''}>${bt('-- Select Direction --','-- 请选择方向 --')}</option>
          ${BAZHAI_DIR_OPTIONS.map(d => `<option value="${d}" ${a.facing===d?'selected':''}>${d} (${DIR_LABEL_ZH[d]})</option>`).join('')}
        </select></label>` : ''}
    </div>
    ${hasPartner ? `<label class="field" style="margin:6px 0 0;display:flex;align-items:center;gap:6px;flex-direction:row">
      <input type="checkbox" id="${idPrefix}Shared" class="addrField" data-key="shared" data-idprefix="${idPrefix}" ${a.shared ? 'checked' : ''} autocomplete="off" style="width:auto;margin:0">
      <span style="font-size:11px">${bt('Shared address with Life Partner', '与生活伴侣共用地址')}</span>
    </label>` : ''}`;
}
// UPDATED (reported: "remove the home address entry from Feng Shui as it is to be managed at the
// profile level"): the persistent Home Address's editable structured fields (House Number, Street
// Name, Unit, City, Country, Postal Code, Construction Year, Home Facing Direction, and the Shared
// checkbox) no longer render here at all - every one of them already exists on the Intake/Profile page
// (see index.html's intakeHouseNumber/.../intakeAddrShared fields), which is now the ONLY place the
// Home Address is entered or edited. This section shows the saved address read-only (with an "Edit on
// Profile" shortcut) and keeps its own real job: computing the Address Compatibility reading from
// whatever is on file, plus exploring OTHER addresses via "Check Another Address" below.
function renderHomeDetailsBlock(u, fsDirVal) {
  const addresses = ensureHomeAddressModel(u);
  syncLegacyHomeFields(u);
  const profAddr = addresses.profile || blankAddressEntry();
  const profReady = isAddressComplete(profAddr);
  const profComposed = composeAddressString(profAddr);
  // Read-only summary of everything saved on the Profile page - address, construction year, facing
  // direction, and shared status - so this section still shows what's on file without offering to
  // edit it here. Sits outside any pdf-exclude wrapper so it survives PDF export as before.
  const summaryParts = [
    profComposed ? `<strong>${bt('Home Address', '住家地址')}:</strong> ${escapeHtml(profComposed)}` : '',
    profAddr.constructionYear ? `<strong>${bt('Construction Year', '建造年份')}:</strong> ${profAddr.constructionYear}` : '',
    fsDirVal ? `<strong>${bt('Home Facing Direction', '住家朝向')}:</strong> ${fsDirVal} (${DIR_LABEL_ZH[fsDirVal] || ''})` : '',
    profAddr.shared ? `<strong>${bt('Shared with Life Partner', '与生活伴侣共用')}:</strong> ${bt('Yes','是')}` : '',
  ].filter(Boolean);
  const summaryLine = summaryParts.length ? `<div class="calc-box" style="font-size:12px">${summaryParts.join(' &nbsp;·&nbsp; ')}</div>` : '';
  // BUG FIX (reported: "even the home address does not display the compatibility %"): every address
  // here (home, work, and each checked address below) already had its score COMPUTED - auditAddressScore
  // ran every time via computeAddressDeepAnalysisHTML - but that score only ever appeared once a person
  // tapped through to "View Details" on the collapsed Deep Analysis card; nothing showed it up front.
  // Every other Personal Assets item (Mobile Number, each Vehicle Plate) already shows its score inline
  // as plain text - only the address block was missing this. Fixed by computing the score once here
  // (reusing the exact same auditAddressScore call the deep-analysis card already makes, so the number
  // can never disagree with what "View Details" shows) and rendering it as a visible line, the same
  // pattern as Mobile Number/Vehicle Plate, right above the (still-present, unchanged) Deep Analysis card.
  const scoreLineHTML = (score) => `<div style="font-size:12px;font-weight:700;color:${scoreColor(score)};margin-top:4px">${bt('Compatibility Score', '契合度评分')}: ${score}%</div>`;
  const profPartnerForScore = (!!profAddr.shared && u.partner) ? getProfileData(u.partner) : null;
  const profP = getProfileData(getProfileByPrefix('i') || u.profile);
  // Home Address's facing direction lives on the profile itself (fsDirVal, param) not on the address
  // entry - so both are passed through to get the blended Ba Zhai + Flying Star score described above.
  const profScorePct = profReady ? computeAddressFullCompatibility(profComposed, profP, profPartnerForScore, fsDirVal, profAddr.constructionYear).score : null;
  const addressResultHTML = profReady ? (scoreLineHTML(profScorePct) + computeAddressDeepAnalysisHTML(profComposed, !!profAddr.shared, fsDirVal, profAddr.constructionYear)) : '';
  const mandatoryReminderHTML = buildAddressMandatoryReminderHTML(profAddr);

  // ENHANCEMENT (reported: "There should an option to add work address to check for compatibility and
  // deep analysis for user and business partners"): a second, independent address - read-only here too
  // (edited on the Profile page, same "Edit on Profile" pattern as the Home Address above), never used
  // for Feng Shui, and never inherited by the Life Partner/Children/Household Occupants - see
  // buildPersonalAssetsSummaryRows for exactly who it applies to.
  const workAddr = addresses.work;
  const workComposed = workAddr && !isAddressEmpty(workAddr) ? composeAddressString(workAddr) : '';
  const workScorePct = workComposed ? auditAddressScore(workComposed, getProfileData(getProfileByPrefix('i') || u.profile), null).score : null;
  const workResultHTML = workComposed ? (scoreLineHTML(workScorePct) + computeAddressDeepAnalysisHTML(workComposed, false)) : '';
  const workSummaryBlockHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--plum);margin-top:16px;display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>${bt('Your Work Address (managed on Profile page)', '您的工作地址（于个人档案页面管理）')}</span>
      <button class="btnEditHomeAddressOnProfile pdf-exclude" style="border:0;background:var(--plum);color:#fff;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0">${bt('Edit on Profile', '在个人档案中编辑')}</button>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px">${bt('Applies to your own Address Compatibility and any Business Partner(s) only - not the Life Partner, Children, or Household Occupants, who instead use the Home Address above.', '仅适用于您本人及事业伙伴的地址契合度分析——不适用于生活伴侣、子女或家庭住户，后者使用上方的住家地址。')}</div>
    ${workComposed ? `<div class="calc-box" style="font-size:12px">${escapeHtml(workComposed)}</div><div style="margin-top:6px">${workResultHTML}</div>` : `<div class="calc-box pdf-exclude" style="font-size:12px;color:var(--muted)">${bt('No work address saved yet - add one on your Profile page (optional).', '尚未保存工作地址——可在个人档案页面添加（可选）。')}</div>`}
  `;

  const checkedList = addresses.checked || [];
  const u2 = u;
  // UPDATED (reported: "Where are the results for the check address? Compatibility score and deep
  // analysis missing"): each checked address previously showed only a bare score % in its summary row,
  // with no deep analysis at all (unlike the Home Address above, which always showed a full
  // computeAddressDeepAnalysisHTML breakdown). Every checked address now gets the exact same full
  // Compatibility Score + Deep Analysis, computed the same way, right under its own row.
  const checkedRowsHTML = checkedList.map((a, idx) => {
    const composed = composeAddressString(a);
    const checkedPartnerForScore = (!!a.shared && u.partner) ? getProfileData(u.partner) : null;
    const checkedP = getProfileData(getProfileByPrefix('i') || u.profile);
    // Checked addresses already collect their own facing direction + construction year on the "Check
    // Another Address" form, so the blended Ba Zhai + Flying Star score applies here too, same as Home.
    const checkedScorePct = computeAddressFullCompatibility(composed, checkedP, checkedPartnerForScore, a.facing, a.constructionYear).score;
    const deepHTML = computeAddressDeepAnalysisHTML(composed, !!a.shared, a.facing, a.constructionYear);
    return `
      <div class="calc-box" style="margin-top:6px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px">
          <span>${escapeHtml(composed)}${a.constructionYear ? ` (${a.constructionYear})` : ''}${a.facing ? ` · ${a.facing}` : ''}${a.shared ? ` · ${bt('Shared','共享')}` : ''}</span>
          <span class="pdf-exclude" style="display:flex;gap:6px;flex-shrink:0">
            <button class="btnUseCheckedAsHome" data-idx="${idx}" style="border:0;background:var(--gold);color:#fff;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer">${bt('Set as Home', '设为住家')}</button>
            <button class="btnRemoveCheckedAddress" data-idx="${idx}" style="border:0;background:#c0392b;color:#fff;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer">${bt('Remove', '删除')}</button>
          </span>
        </div>
        ${scoreLineHTML(checkedScorePct)}
        <div style="margin-top:6px">${deepHTML}</div>
      </div>`;
  }).join('');
  // Cap: profile address + checked list never exceed 6 entries total.
  const canAddMore = (checkedList.length + (profReady ? 1 : 0)) < 6;

  return `
    <article class="reading" id="homeAddressBlock">
      <span class="pill">${bt('Check Address Compatibility (for Feng Shui Analysis)','核对地址契合度（用于风水分析）')}</span>${needsInputBadge(profReady)}
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${bt('Your home address is entered and edited on your Profile page, then reused automatically here, and across Ba Zhai and Flying Star below. This app performs no geocoding or location lookup on the address text; each compatibility score below is derived purely from that address\'s own digits/characters, cross-referenced against your household\'s Day Master(s) - the same method already used for Mobile Number and Vehicle Plate. Note: floor plans are not analysed by this app - see the Flying Star section below for why, and what to do instead.', '您的住家地址在您的个人档案页面中输入及修改，本处及下方八宅与飞星分析将自动重复使用。本应用不会对地址文字进行地理位置查询；下方各项契合度评分均纯粹依据该地址文字本身的数字／字符，与您家庭的八字日主交叉比对推算得出——与手机号码及车牌号码所采用的方法相同。说明：本应用不分析户型图——原因及替代方案请见下方飞星部分。')}</div>
      <div style="font-size:12px;font-weight:700;color:var(--plum);margin-top:6px;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span>${bt('Your Home Address (managed on Profile page)', '您的住家地址（于个人档案页面管理）')}</span>
        <button class="btnEditHomeAddressOnProfile pdf-exclude" style="border:0;background:var(--plum);color:#fff;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0">${bt('Edit on Profile', '在个人档案中编辑')}</button>
      </div>
      ${summaryLine || `<div class="calc-box pdf-exclude" style="font-size:12px;color:var(--muted)">${bt('No home address saved yet - add one on your Profile page.', '尚未保存住家地址——请在个人档案页面添加。')}</div>`}
      <div id="homeAddressMandatoryReminder">${mandatoryReminderHTML}</div>
      <div id="homeAddressResult">${addressResultHTML}</div>

      ${workSummaryBlockHTML}

      <div style="font-size:12px;font-weight:700;color:var(--plum);margin-top:16px">${bt(`Checked Addresses (${checkedList.length}/5)`, `已核对地址（${checkedList.length}/5）`)}</div>
      <div style="font-size:10px;color:var(--muted)">${bt('Up to 6 addresses total, including your home address above.', '最多6个地址，含上方住家地址。')}</div>
      <div id="checkedAddressesList">${checkedRowsHTML || `<div style="font-size:11px;color:var(--muted);padding:6px 0">${bt('No additional addresses checked yet.', '尚未核对其他地址。')}</div>`}</div>
      ${canAddMore ? `<button class="btnShowAddAddressForm pdf-exclude" style="margin-top:8px;border:0;background:var(--gold);color:#fff;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">${bt('+ Check Another Address', '+ 核对其他地址')}</button>
      <div id="addAddressForm" class="hidden pdf-exclude" style="margin-top:8px">
        ${renderAddressFieldsHTML('newAddr', null, true, true)}
        <div id="newAddrError" class="error" style="font-size:11px;margin-top:4px"></div>
        <button class="btnConfirmAddAddress" style="margin-top:6px;border:0;background:var(--plum);color:#fff;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">${bt('Check This Address', '核对此地址')}</button>
      </div>` : `<div style="font-size:11px;color:var(--muted);margin-top:8px">${bt('Maximum of 6 addresses reached. Remove one above to check another.', '已达最多6个地址上限，请先删除一项再添加。')}</div>`}
    </article>
  `;
}
// Patches only the Home Address / Checked Addresses block in place (rather than a full renderAllViews,
// which would reset whichever chart tab the person currently has open back to Core) - the same
// targeted-refresh pattern already used for the Household Occupants list elsewhere on this page.
function refreshHomeAddressBlock(u) {
  const container = document.getElementById('homeAddressBlock');
  if (!container) return;
  // UPDATED (this round): renderHomeDetailsBlock's read-only summary now also shows the Home Facing
  // Direction, so a refresh must pass the current fsDir - previously omitted here (it was only ever
  // needed by the now-removed editable facing selector's `selected` state), which would otherwise
  // blank that line out until the next full page reload.
  const prof = getProfileByPrefix('i');
  const fresh = document.createRange().createContextualFragment(renderHomeDetailsBlock(u, prof?.fsDir));
  container.replaceWith(fresh);
}
// ENHANCEMENT (reported: "the address should take into consideration the ba zhai and flying star for
// compatibility calculation and deep analysis"): until now, an address's Compatibility Score came ONLY
// from its digit-elemental audit (auditAddressScore, the same method used for Mobile Number/Vehicle
// Plate) - completely separate from the Ba Zhai (personal Kua-vs-facing-direction) and Flying Star
// (property chart from construction year + facing) systems already used elsewhere in this app (the
// combined household Ba Zhai/Flying Star reading above, and the Flying Star property chart below).
// This blends all three into the one % shown, per the scope agreed: applies wherever a facing
// direction is actually on file (Home Address and each Checked Address - Work Address deliberately has
// no facing/construction year field at all, since it's explicitly out of Feng Shui scope, so it
// continues to use the digit score alone, unchanged); when no facing direction is saved, falls back to
// the digit score alone (same as before this change) rather than blocking the score entirely.
//
// Ba Zhai -> score: this profile's own Kua number's star at the given facing direction
// (BAZHAI_STARS/BAZHAI_STAR_INFO, the exact same lookup the personal Ba Zhai reading above already
// uses) mapped from its 4-tier rating to a 0-100 number on the same rough scale auditAddressScore uses
// (40-99): Highly Auspicious=95, Auspicious=82, Inauspicious=55, Highly Inauspicious=35.
const BAZHAI_RATING_TO_SCORE = { 'Highly Auspicious': 95, 'Auspicious': 82, 'Inauspicious': 55, 'Highly Inauspicious': 35 };
// Flying Star -> score: favourable=90, mixed (favourable:null, e.g. Star 4)=65, unfavourable=40 -
// same 3-way favourable/null/false shape FLYING_STAR_NATURE already carries.
function flyingStarFavToScore(fav) { return fav === true ? 90 : fav === false ? 40 : 65; }
// Computes the blended Compatibility Score (and the raw per-system findings, for the deep-analysis
// text) for one address. `facing` is a full direction name ("North"...), matching both
// BAZHAI_STARS' keys directly and DIR_FULL_TO_SHORT's input; `constructionYear` gates the Flying
// Star component specifically (Ba Zhai needs only the facing direction, not construction year).
function computeAddressFullCompatibility(addrVal, p, partnerP, facing, constructionYear) {
  const digitRes = auditAddressScore(addrVal, p, partnerP);
  const result = { score: digitRes.score, digitScore: digitRes.score, digitRes, baZhai: null, flyingStar: null };
  if (!facing || !p?.kuaNum || typeof BAZHAI_STARS === 'undefined') return result;

  const star = BAZHAI_STARS[p.kuaNum] && BAZHAI_STARS[p.kuaNum][facing];
  const info = star && BAZHAI_STAR_INFO[star];
  if (info) {
    result.baZhai = { star, rating: info.rating, desc: info.desc, score: BAZHAI_RATING_TO_SCORE[info.rating] ?? 65, direction: facing };
  }

  if (constructionYear && typeof computeFlyingStarChart === 'function' && typeof DIR_FULL_TO_SHORT !== 'undefined') {
    const shortFacing = DIR_FULL_TO_SHORT[facing];
    if (shortFacing) {
      const chart = computeFlyingStarChart(constructionYear, shortFacing);
      const facingPalace = chart.palaces[chart.facingDirection];
      const sittingPalace = chart.palaces[chart.sittingDirection];
      if (facingPalace && sittingPalace) {
        const facingStarNature = FLYING_STAR_NATURE[facingPalace.facing];
        const mountainStarNature = FLYING_STAR_NATURE[sittingPalace.mountain];
        const facingScore = flyingStarFavToScore(facingStarNature ? facingStarNature.favourable : null);
        const mountainScore = flyingStarFavToScore(mountainStarNature ? mountainStarNature.favourable : null);
        result.flyingStar = {
          period: chart.period, facingStarNum: facingPalace.facing, mountainStarNum: sittingPalace.mountain,
          facingFav: facingStarNature ? facingStarNature.favourable : null, mountainFav: mountainStarNature ? mountainStarNature.favourable : null,
          score: Math.round((facingScore + mountainScore) / 2),
        };
      }
    }
  }

  const components = [result.digitScore, result.baZhai?.score, result.flyingStar?.score].filter(n => typeof n === 'number');
  result.score = Math.round(components.reduce((a, b) => a + b, 0) / components.length);
  return result;
}
// UPDATED (this round): now accepts an optional `facing`/`constructionYear` so the blended Ba Zhai +
// Flying Star score above can be computed for callers that have that data (Home Address, Checked
// Addresses); omitted entirely, this keeps behaving exactly as before (digit score only) - the Work
// Address caller relies on this unchanged fallback, matching its deliberate no-Feng-Shui-fields design.
// UPDATED (reported: "Address input should have a checkbox to indicate if the address is a shared
// address"): `shared` now gates cross-referencing the Life Partner's Day Master here too, same as the
// Checked Addresses list above - defaults to true so existing callers that don't pass it (there are
// none left in this app, but keeps this function safe to call generically) keep the prior behavior.
function computeAddressDeepAnalysisHTML(addrVal, shared = true, facing = null, constructionYear = null) {
  const u = activeUser(); if (!u) return '';
  const prof = getProfileByPrefix('i');
  const p = prof ? getProfileData(prof) : getProfileData();
  if (!p) return '';
  const partnerP = (shared && u.partner) ? getProfileData(u.partner) : null;
  const full = computeAddressFullCompatibility(addrVal, p, partnerP, facing, constructionYear);
  return generateDeepAnalysisData('address', p, { title: 'Address Compatibility Deep Analysis', address: escapeHtml(addrVal), auditResult: full.digitRes, partnerP, fullResult: full });
}

// ENHANCEMENT (this round, suggested: "a single, top-level 'Personal Assets & Address' summary card
// on your own profile's main dashboard, showing Mobile Number / Vehicle Plate(s) / Address
// Compatibility scores together in one glance, rather than three separate sections a person has to
// know to go looking for individually"). Reuses the exact same scoring engine (auditMobileScore/
// auditVehicleScore/auditAddressScore) already computing these scores everywhere else in the app -
// this card is purely a read-only, at-a-glance aggregation, not a second source of truth. Each field
// that hasn't been entered yet shows a plain "Not set" rather than a fabricated placeholder score.
// ENHANCEMENT (reported: "Personal Assets compatibility should be part of the summary cards in
// landing page and charts for all profiles"): the row-building logic below used to live only inside
// renderPersonalAssetsSummaryCard (the Home dashboard card, main profile only). Extracted into its
// own reusable function so the exact same scoring/labels can also back a per-profile card embedded
// directly in EVERY profile's own chart (see buildPersonalAssetsSummaryCardHTML below), not just the
// main profile's dashboard - one source of truth for both call sites.
// UPDATED (reported: "personal assets to show the numbers and address in the summary pages"): every
// row below used to show ONLY the compatibility score (e.g. "87%"), never the actual saved value - so
// there was no way to tell WHICH number or address that score belonged to without leaving the summary
// card. Each row's value now leads with the real saved number/plate(s)/address text, with the score
// alongside it in brackets - same scoring engine, same "Not set yet" fallback when nothing's saved yet.
// A vehicle marked "shared" (in the per-profile Checker & Generator tool) is only ever SAVED on the
// one profile that entered it, in that profile's own prof.vehicles array - it is never automatically
// duplicated onto the Life Partner's own profile record. This helper is what makes it VISIBLE on the
// partner's own Personal Assets summary too (read-only, tagged "(Shared)"), which is what "shared"
// should mean from a reporting standpoint even though the underlying data still lives in one place.
// Own entries always win on a number clash (a profile's own record of a plate is authoritative for
// itself), so a mirrored entry is only added when that plate isn't already present in the owner's own
// list.
function getVehiclesForSummary(prefix, prof, u) {
  const ownVehicles = prof?.vehicles || [];
  let mirrored = [];
  if (prefix === 'i' && u.partner) {
    mirrored = (u.partner.vehicles || []).filter(v => v.shared);
  } else if (prefix === 'p' && u.profile) {
    mirrored = (u.profile.vehicles || []).filter(v => v.shared);
  }
  const seen = new Set(ownVehicles.map(v => v.number));
  return [...ownVehicles, ...mirrored.filter(v => !seen.has(v.number))];
}
// Each row is a small vertical block: a bold "<Asset> Compatibility: XX% (Shared)" line, followed by
// the actual saved value on its own line(s) below - the exact multi-line format requested for the
// Personal Assets summary (landing card and chart-level card both render from this same shape via
// `lines`). "(Shared)" is only ever appended when the item is genuinely shared with the Life Partner -
// a vehicle explicitly marked shared in the Checker & Generator tool, or the household address whenever
// a Life Partner profile exists - and it renders identically on both profiles' own summary cards (see
// getVehiclesForSummary above for vehicles; the address is already read from the one shared
// u.home.addresses.profile record, so both profiles' cards already show the same address as-is).
function buildPersonalAssetsSummaryRows(prefix, p, prof, u) {
  const rows = [];
  const sharedTag = ` (${bt('Shared', '共享')})`;

  // --- Mobile Number ---
  const mobileVal = prof?.mobileNumber || '';
  if (mobileVal) {
    const res = auditMobileScore(mobileVal, p, null);
    rows.push({ ok: true, lines: [
      `${bt('Mobile Number Compatibility', '手机号码契合度')}: ${res.score}%`,
      escapeHtml(mobileVal),
    ] });
  } else {
    rows.push({ ok: false, lines: [ `${bt('Mobile Number Compatibility', '手机号码契合度')}: ${bt('Not set yet', '尚未设置')}` ] });
  }

  // --- Vehicle Number(s) --- scoped to Individual + Life Partner + Business Partner (see
  // renderVehiclesBlock's own extended scope). "Shared with Life Partner" mirroring only applies to the
  // Individual/Life Partner pair; a Business Partner's own vehicle is scored purely against their own
  // Day Master, with no partner cross-reference and no "(Shared)" tag.
  if (prefix === 'i' || prefix === 'p' || prefix === 'b') {
    const partnerP = (prefix === 'i' && u.partner) ? getProfileData(u.partner) : (prefix === 'p' ? getProfileData() : null);
    const vehicles = (prefix === 'b') ? (prof?.vehicles || []) : getVehiclesForSummary(prefix, prof, u);
    if (vehicles.length) {
      vehicles.forEach(v => {
        const res = auditVehicleScore(v.number, p, v.shared ? partnerP : null);
        rows.push({ ok: true, lines: [
          `${bt('Vehicle Number Compatibility', '车牌号码契合度')}: ${res.score}%${v.shared ? sharedTag : ''}`,
          escapeHtml(v.number),
        ] });
      });
    } else {
      rows.push({ ok: false, lines: [ `${bt('Vehicle Number Compatibility', '车牌号码契合度')}: ${bt('Not set yet', '尚未设置')}` ] });
    }
  }

  // --- Address Compatibility --- REDESIGNED (reported: "profile address should only apply to user,
  // life partner, house occupants. Children should not inherit the address unless option is selected.
  // business partners should not inherit the address, unless it is a work address. There should an
  // option to add work address to check for compatibility and deep analysis for user and business
  // partners"):
  //   - Individual ('i') and Life Partner ('p'): the household Home Address (u.home.addresses.profile)
  //     always applies, exactly as before - unchanged scope, still the household's one shared record.
  //   - Business Partner ('b'/'b2_N'): the Home Address NO LONGER applies at all (a business partner
  //     does not live at this household's home) - only the separate, optional Work Address
  //     (u.home.addresses.work) is shown, scored purely against that business partner's own Day Master
  //     (no partner cross-reference/"(Shared)" tag - a workplace isn't "shared" the way a home is).
  //   - Child ('cN'): the Home Address only applies when that specific child's own
  //     `includeHomeAddress` flag is set (via the People Management screen) - off by default, so a
  //     child no longer silently inherits the household address the way every other role used to.
  //   - Individual ('i') ALSO gets a second, separate Work Address Compatibility row when one is on
  //     file, alongside the (always-shown) Home Address row - the person who actually works there.
  //   - Household Occupants have no profile page of their own (no prefix reaches this function for
  //     them) - they already only ever factor into the Ba Zhai household roster, which is inherently
  //     home-address-based, so no change was needed there.
  const addresses = ensureHomeAddressModel(u);
  const isBizPartner = prefix === 'b' || (typeof prefix === 'string' && prefix.startsWith('b2_'));
  const isChild = typeof prefix === 'string' && prefix.startsWith('c'); // 'c0','c1',... - same convention as getProfileByPrefix
  const addressRowFor = (addr, label, { isShared, extraLines } = {}) => {
    if (!addr || isAddressEmpty(addr)) return { ok: false, lines: [ `${label}: ${bt('Not set yet', '尚未设置')}` ] };
    const composed = composeAddressString(addr);
    const partnerP = isShared ? ((prefix === 'i') ? getProfileData(u.partner) : getProfileData()) : null;
    const res = auditAddressScore(composed, p, partnerP);
    const addrLines = [];
    const line1 = [addr.houseNumber, addr.streetName].filter(Boolean).join(' ');
    if (line1) addrLines.push(escapeHtml(line1));
    if (addr.unit) addrLines.push(escapeHtml(addr.unit));
    const line3 = [addr.city, addr.postalCode].filter(Boolean).join(' ');
    if (line3) addrLines.push(escapeHtml(line3));
    if (addr.country) addrLines.push(escapeHtml(addr.country));
    if (extraLines) addrLines.push(...extraLines);
    return { ok: true, lines: [ `${label}: ${res.score}%${isShared ? sharedTag : ''}`, ...addrLines ] };
  };

  if (isChild) {
    if (prof?.includeHomeAddress) {
      const profAddr = addresses.profile;
      rows.push(addressRowFor(profAddr, bt('Address Compatibility', '地址契合度')));
    } else {
      rows.push({ ok: false, lines: [ `${bt('Address Compatibility', '地址契合度')}: ${bt('Not included (enable "Include Home Address" for this child in People Management)', '未纳入（可在「成员管理」中为此子女启用「纳入住家地址」）')}` ] });
    }
  } else if (isBizPartner) {
    rows.push(addressRowFor(addresses.work, bt('Work Address Compatibility', '工作地址契合度')));
  } else {
    // Individual and Life Partner: Home Address always applies, exactly as before.
    const profAddr = addresses.profile;
    const isShared = (prefix === 'i' || prefix === 'p') && !!u.partner && !!profAddr?.shared;
    const extraLines = [];
    if (profAddr?.constructionYear) extraLines.push(`${bt('Construction Year', '建造年份')}: ${escapeHtml(String(profAddr.constructionYear))}`);
    if (prof?.fsDir) extraLines.push(`${bt('Home Main Door Facing', '住家大门朝向')}: ${escapeHtml(prof.fsDir)}`);
    rows.push(addressRowFor(profAddr, bt('Address Compatibility', '地址契合度'), { isShared, extraLines }));
    // Individual only: an additional, separate Work Address row when one is on file.
    if (prefix === 'i') {
      rows.push(addressRowFor(addresses.work, bt('Work Address Compatibility', '工作地址契合度')));
    }
  }
  return rows;
}
// ENHANCEMENT (reported: "remove the personal assets section from the system list on the landing
// page. No changes to personal assets on the other pages."): the standalone Home-dashboard card this
// function used to fill (#personalAssetsSummaryRows) has been removed from index.html - the same
// Mobile Number/Vehicle Plate(s)/Address Compatibility summary is now shown inline inside each
// profile's own top landing summary card instead (see generateSummaryCardHTML's assetsSummaryHTML,
// which reuses buildPersonalAssetsSummaryRows below). This function and its call site are removed as
// dead code rather than left calling into an element that no longer exists.
// The same rows, as an inline HTML string, embedded directly at the top of EVERY profile's own chart
// (see renderSystemChart) - "landing page and charts for all profiles" per the request, not just the
// main profile's Home dashboard. Read-only, same scoring, same labels; tapping it is unnecessary here
// since the real editable fields already live a scroll away in that same profile's Personal Assets /
// Feng Shui sections.
function buildPersonalAssetsSummaryCardHTML(prefix, p, prof, u) {
  const rows = buildPersonalAssetsSummaryRows(prefix, p, prof, u);
  return `
    <article class="reading" style="padding-top:0">
      <span class="pill">${bt('Personal Assets & Address', '个人资产与地址')}</span>
      ${rows.map(r => `
        <div style="padding:6px 0;border-bottom:1px solid var(--line)">
          <div style="font-size:13px;font-weight:700;color:${r.ok ? 'var(--plum)' : 'var(--muted)'}">${r.lines[0]}</div>
          ${r.lines.slice(1).map(l => `<div style="font-size:12px;color:var(--ink);margin-top:2px">${l}</div>`).join('')}
        </div>`).join('')}
    </article>
  `;
}

// actually reports about their own features, since this app has no photo/image analysis capability.
// Each mapping below is grounded in classical associations confirmed by 2+ independent sources during
// research for this feature (nose = Wealth Palace 财帛宫 with bridge/tip shape indicating earning
// capacity; mouth size and lip thickness indicating sociability/temperament; chin shape indicating
// later-life fortune and temperament; eye vitality indicating intelligence/insight). Face shape
// categories are the well-established general classifications used throughout physiognomy sources.
// HONESTY LIMIT: this is a coarse, 5-feature self-report, not a trained reader's holistic
// assessment - a real practitioner reads proportion, symmetry, colour, and how features interact
// together, not just 5 independent categorical choices. Stated in the rendered output itself.
const XIANG_SHU_FACE_SHAPE_OPTIONS = {
  round: { en: 'Round', zh: '圆型脸', reading: { en: 'Sociable, easygoing, and adaptable - you tend to navigate life by feel and relationship rather than rigid plans, and generally find it easy to get along with a wide range of people.', zh: '善于社交、随和、适应力强——您倾向凭直觉与人际关系而非僵化计划行事，通常能与各种类型的人相处融洽。' } },
  square: { en: 'Square', zh: '方型脸', reading: { en: 'Decisive and strong-willed, with a practical, results-oriented streak - a natural doer, though this can tip into stubbornness under pressure.', zh: '果断、意志坚定，务实且注重结果——天生的行动派，但压力之下也可能显得固执。' } },
  oval: { en: 'Oval (melon-seed)', zh: '瓜子脸', reading: { en: 'Refined and detail-oriented, with a sensitive, aesthetically-tuned disposition - you likely notice nuance that others miss.', zh: '细腻、注重细节，性情敏感且具审美天赋——您可能比他人更容易察觉细微之处。' } },
  triangle: { en: 'Triangle (wide forehead, narrow chin)', zh: '由字脸（额宽下窄）', reading: { en: 'Intellectual and imaginative, with ideas that often outpace practical execution - your strength is vision, so pairing with someone execution-minded tends to work well.', zh: '富有智性与想象力，构思常快于实际执行——您的强项在于愿景构想，与执行力强的人搭档合作往往效果更佳。' } },
  long: { en: 'Long/rectangular', zh: '长型脸', reading: { en: 'Steady, patient, and methodical - you build things carefully over time rather than rushing, though decisions may take longer to land.', zh: '沉稳、耐心、按部就班——您倾向长期稳健地累积成果而非仓促行事，但做决定可能需要较长时间。' } }
};
const XIANG_SHU_EYES_OPTIONS = {
  bright: { en: 'Bright and lively', zh: '明亮有神', reading: { en: 'Per this feature\'s classical reading, this indicates sharp insight and strong observational intelligence - you likely read situations and people quickly.', zh: '依此特征的传统解读，显示洞察力敏锐、观察力强——您可能很快就能看透情势与他人。' } },
  calm: { en: 'Calm and steady', zh: '沉稳', reading: { en: 'Composed and deliberate - you project trustworthiness and rarely act on impulse, which tends to earn confidence from others over time.', zh: '沉着而深思熟虑——您给人可信赖之感，鲜少冲动行事，长久下来容易赢得他人信任。' } },
  focused: { en: 'Small and focused', zh: '细长专注', reading: { en: 'Meticulous and observant, with a naturally cautious streak - you likely catch details in agreements or plans that others skip past.', zh: '细致、观察入微，天生带有谨慎倾向——您可能比他人更容易察觉协议或计划中的细节疏漏。' } },
  gentle: { en: 'Soft and gentle', zh: '温和', reading: { en: 'Warm and empathetic, generally conflict-averse - people likely find you easy to open up to.', zh: '温暖、富同理心，通常倾向避免冲突——他人可能觉得容易向您敞开心扉。' } }
};
const XIANG_SHU_NOSE_OPTIONS = {
  straight_full: { en: 'Straight bridge, full round tip', zh: '鼻梁挺直，鼻头圆润饱满', reading: { en: 'The nose is traditionally read as the Wealth Palace (财帛宫) - this combination is the classically favourable one, associated with strong earning capacity and a smoother career path.', zh: '鼻子传统上被视为财帛宫——此组合属传统上的有利相，通常与较强的赚钱能力及较顺遂的事业运相关。' } },
  straight_pointed: { en: 'Straight bridge, pointed tip', zh: '鼻梁挺直，鼻头尖削', reading: { en: 'Per the Wealth Palace reading, the straight bridge suggests decisiveness, while the pointed tip suggests wealth built through sharp judgment rather than steady accumulation - more feast-or-famine than gradual.', zh: '依财帛宫解读，鼻梁挺直显示果断，鼻头尖削则显示财富较多来自精准判断而非稳定累积——起伏较大，而非渐进式增长。' } },
  low_full: { en: 'Low bridge, full round tip', zh: '鼻梁较低，鼻头圆润饱满', reading: { en: 'Per the Wealth Palace reading, wealth here tends to build slowly through steady, patient effort rather than bold moves - reliable but rarely fast.', zh: '依财帛宫解读，财富多透过稳健耐心的努力慢慢累积，而非大胆冒进——可靠但少见速成。' } },
  low_pointed: { en: 'Low bridge, pointed tip', zh: '鼻梁较低，鼻头尖削', reading: { en: 'Per the Wealth Palace reading, this is traditionally read as the more challenging combination for wealth and career - benefiting from more deliberate planning and seeking outside counsel before big financial decisions, rather than relying purely on instinct.', zh: '依财帛宫解读，此组合传统上被视为财运与事业较具挑战的相——较适合在重大财务决策前多加规划并寻求他人意见，而非单凭直觉行事。' } }
};
const XIANG_SHU_MOUTH_OPTIONS = {
  large_thick: { en: 'Large mouth, thick lips', zh: '嘴巴大，嘴唇厚', reading: { en: 'Outgoing, warm, and sociable, generally comfortable taking the lead in a room - traditionally also associated with robust health and appetite.', zh: '外向、热情、善于社交，通常也乐于在群体中担任主导角色——传统上也与体质健壮、食欲旺盛相关。' } },
  large_thin: { en: 'Large mouth, thin lips', zh: '嘴巴大，嘴唇薄', reading: { en: 'Bold and ambitious in action, but more guarded emotionally than the large-mouth/thick-lip combination - decisive in what you do, more private in what you feel.', zh: '行事大胆且富野心，但情感上比大嘴厚唇者更为内敛——行动果决，情感则较私密。' } },
  small_thick: { en: 'Small mouth, thick lips', zh: '嘴巴小，嘴唇厚', reading: { en: 'Warm-hearted underneath a more reserved exterior - you likely take longer to open up, but feel deeply once you do.', zh: '外表较内敛，内心却温暖——您可能需要较长时间才能敞开心扉，但一旦如此便情感深厚。' } },
  small_thin: { en: 'Small mouth, thin lips', zh: '嘴巴小，嘴唇薄', reading: { en: 'Introverted and meticulous, careful in how you act and reserved in how you express emotion - not unfriendly, just more selective about when to engage.', zh: '性格内向、做事细致，行事谨慎、情感表达内敛——并非不友善，只是在参与投入上较为挑剔。' } }
};
const XIANG_SHU_CHIN_OPTIONS = {
  round_full: { en: 'Round and full', zh: '圆润丰满', reading: { en: 'Traditionally read as favourable for later-life fortune - associated with a gentle temperament and generally warmer family relationships over time.', zh: '传统上被视为晚年运势的有利相——通常与温和的性情及日渐融洽的家庭关系相关。' } },
  pointed_narrow: { en: 'Pointed and narrow', zh: '尖削窄小', reading: { en: 'Traditionally read as a chin needing more deliberate planning for later-life stability, alongside a temperament that can run more stubborn or impatient under stress.', zh: '传统上认为需更用心规划以确保晚年稳定，性情在压力下也可能较为固执或急躁。' } },
  square_strong: { en: 'Square and strong', zh: '方正有力', reading: { en: 'Determined and resilient, with later-life stability more often earned through persistence than given - a chin that traditionally favours those who keep going.', zh: '意志坚定、韧性十足，晚年的稳定多透过坚持而非天赐获得——传统上偏爱坚持不懈者。' } }
};
function computeXiangShuReading(features) {
  const face = XIANG_SHU_FACE_SHAPE_OPTIONS[features.face];
  const eyes = XIANG_SHU_EYES_OPTIONS[features.eyes];
  const nose = XIANG_SHU_NOSE_OPTIONS[features.nose];
  const mouth = XIANG_SHU_MOUTH_OPTIONS[features.mouth];
  const chin = XIANG_SHU_CHIN_OPTIONS[features.chin];
  if (!face || !eyes || !nose || !mouth || !chin) return null;
  return { face, eyes, nose, mouth, chin };
}
function renderXiangShuResult(features) {
  const r = computeXiangShuReading(features);
  if (!r) return `<div class="error" style="min-height:auto">${bt('Please select all 5 features.','请选择全部五项特征。')}</div>`;
  const rows = [
    { label: bt('Face Shape','脸型'), val: r.face, key: 'face' },
    { label: bt('Eyes','眼睛'), val: r.eyes, key: 'eyes' },
    { label: bt('Nose (Wealth Palace 财帛宫)','鼻子（财帛宫）'), val: r.nose, key: 'nose' },
    { label: bt('Mouth','嘴巴'), val: r.mouth, key: 'mouth' },
    { label: bt('Chin','下巴'), val: r.chin, key: 'chin' }
  ];
  const rowsHTML = rows.map(row => `
    <div style="margin-bottom:10px;padding:10px;background:#f5f3ec;border-left:3px solid var(--gold);border-radius:0 8px 8px 0">
      <div style="font-size:11px;color:var(--muted);margin-bottom:2px">${row.label}: <strong style="color:var(--plum)">${bt(row.val.en, row.val.zh)}</strong></div>
      <div style="font-size:12px">${bt(row.val.reading.en, row.val.reading.zh)}</div>
    </div>`).join('');
  return `
    ${rowsHTML}
    <div class="calc-box" style="font-size:11px;margin-top:8px">${bt('This is a coarse, 5-feature self-report, not a trained reader\'s holistic assessment - a real practitioner reads proportion, symmetry, colour, and how features interact together as a whole, not 5 independent categorical choices in isolation. Each association above reflects a classical reading of that specific feature, cross-checked against multiple sources during research, not a personalized diagnosis.', '此为简化的五项特征自我报告，并非专业相师的整体判断——真正的相术需综观比例、对称、气色及各特征间的相互作用，而非五项独立类别的孤立叠加。以上每项关联皆反映该特征的传统解读，撰写时已交叉核对多方来源，但并非针对个人的专属诊断。')}</div>
  `;
}

// ENHANCEMENT (this round): Western Name Numerology (Expression/Soul Urge/Personality) rendering -
// the core digit meanings (1-9) are shared across all three numbers, since standard numerology gives
// each digit a consistent underlying meaning; what differs between Expression/Soul Urge/Personality is
// WHICH aspect of the person that meaning is being applied to, not the meaning itself.
const NUMEROLOGY_CORE_DIGIT_MEANING = {
  1: { en: 'independence, leadership, and initiative', zh: '独立、领导力与开创精神' },
  2: { en: 'cooperation, diplomacy, and sensitivity to others', zh: '合作、圆融及对他人的敏锐体察' },
  3: { en: 'creative self-expression, sociability, and optimism', zh: '创意表达、社交能力与乐观态度' },
  4: { en: 'discipline, structure, and reliable follow-through', zh: '纪律性、条理与可靠的执行力' },
  5: { en: 'adaptability, curiosity, and a need for variety and freedom', zh: '适应力、好奇心，以及对多元与自由的需求' },
  6: { en: 'responsibility, nurturing, and care for family or community', zh: '责任感、照顾他人，以及对家庭或社群的关怀' },
  7: { en: 'analysis, introspection, and a search for deeper understanding', zh: '分析力、内省，以及对深层理解的追求' },
  8: { en: 'ambition, material achievement, and executive capability', zh: '野心、物质成就，以及管理执行的能力' },
  9: { en: 'compassion, idealism, and a broad, humanitarian outlook', zh: '同理心、理想主义，以及宏观、人道的视野' },
  11: { en: 'amplified intuition and inspirational vision, alongside heightened sensitivity (a Master Number - see the Life Path section above for what this means)', zh: '强化的直觉与鼓舞人心的愿景，伴随更高的敏感度（大师数——详见上方生命数字部分的说明）' },
  22: { en: 'amplified capacity to turn large-scale visions into concrete reality, alongside a heavier practical burden (a Master Number)', zh: '强化的能力，可将宏大愿景化为具体现实，伴随更沉重的实务负担（大师数）' },
  33: { en: 'amplified pull toward large-scale, selfless service, alongside a real risk of self-neglect if unbalanced (a Master Number)', zh: '强化的无私服务倾向，若未能取得平衡则伴随忽略自身需求的真实风险（大师数）' }
};
function renderWesternNameNumerologyBlock(p) {
  const wn = p.westernNameNumerology;
  if (!wn) return '';
  const expMeaning = NUMEROLOGY_CORE_DIGIT_MEANING[wn.expression];
  const rows = [
    { label: bt('Expression / Destiny Number','表达数／命运数'), num: wn.expression, aspect: bt('what you\'re capable of becoming - your natural talents and the direction your gifts tend to push you toward','您能够成就的方向——您天生的才能，以及天赋倾向引导您前进的方向'), meaning: expMeaning },
    { label: bt('Soul Urge Number','灵魂渴望数'), num: wn.soulUrge, aspect: bt('what you actually want at the deepest level - your inner motivation, separate from what you show outwardly','您内心深处真正渴望的事物——您的内在动机，有别于外在展现的一面'), meaning: wn.soulUrge ? NUMEROLOGY_CORE_DIGIT_MEANING[wn.soulUrge] : null },
    { label: bt('Personality Number','人格数'), num: wn.personality, aspect: bt('the impression you make on others - your outward persona and first impression, not necessarily your inner reality','您给他人留下的印象——您的外在形象与第一印象，不一定等同于您的内在真实面貌'), meaning: wn.personality ? NUMEROLOGY_CORE_DIGIT_MEANING[wn.personality] : null }
  ];
  const rowsHTML = rows.map(row => row.meaning ? `
    <div style="margin-bottom:10px;padding:10px;background:#f5f3ec;border-left:3px solid var(--gold);border-radius:0 8px 8px 0">
      <div style="font-size:11px;color:var(--muted);margin-bottom:2px">${row.label}: <strong style="color:var(--plum)">${row.num}</strong>${[11,22,33].includes(row.num) ? bt(' (Master Number)',' (大师数)') : ''}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${bt('Describes:','代表：')} ${row.aspect}</div>
      <div style="font-size:12px">${bt(row.meaning.en, row.meaning.zh)}</div>
    </div>` : '').join('');
  return `
    <article class="reading">
      <span class="pill">${bt('Western Name Numerology (Pythagorean)','西方姓名数字命理（毕达哥拉斯体系）')}</span>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">${bt('A different system from the Five Grids analysis in Name Analysis above - built specifically for alphabetic names, using the Pythagorean letter-value system (A-Z mapped 1-9). Calculated from your full English name.', '与上方「姓名分析」中的五格法不同——此系统专为字母姓名设计，采用毕达哥拉斯字母数值系统（A-Z对应1-9）。依您完整的英文姓名推算。')}</div>
      ${rowsHTML}
      <div class="calc-box" style="font-size:11px;margin-top:8px">${bt('System choice: uses Pythagorean letter values, the more standard and widely-cited system - a competing system (Chaldean) uses different, sound-based values with no letter mapped to 9, and sources disagree on which is "more accurate." Scope: covers the three most commonly-cited core numbers only, not the further "Maturity Number" refinement; Y is always treated as a consonant, not the more advanced rule where Y sometimes counts as a vowel.', '体系选择：采用毕达哥拉斯字母数值系统，为较为标准、广泛引用的体系——另有迦勒底（Chaldean）体系采用不同的、以音韵为基础的数值，且无字母对应数字9，各方说法不一，未有定论何者「更准确」。范围：仅涵盖三个最常被引用的核心数字，未包含进一步的「成熟数」；Y 一律视为辅音，未采用Y有时可作元音计算的进阶规则。')}</div>
    </article>
  `;
}

// ENHANCEMENT (this round): PDF export - builds a self-contained HTML document for a given profile
// (individual, life partner, or business partner) and hands it to html2pdf.js. For the individual
// profile specifically, the person's own full chart is followed by dedicated Compatibility sections
// for the Life Partner and/or Business Partner, if either is on file - reusing the exact same
// compat_life/compat_biz deep-analysis content already used elsewhere (called with the individual as
// the primary profile, so the "Your X / their Y" phrasing correctly reads from the individual's own
// point of view, matching how it's meant to be read on this page).
// BUG FIX (root cause finally confirmed via concrete browser diagnostic data, not theory): the
// exported PDF's rendered canvas came back with zero height, and the diagnostic log traced this
// precisely - html2canvas's own internal clone of the content computed to only 769px tall, versus
// the real, live container's 55,416px. That is consistent with every <details> element (this app
// wraps most sections in one, via wrapSectionCollapsible, collapsed by default) reverting to its
// closed state somewhere in html2canvas's cloning process, even though this app was already setting
// `.open = true` on every one of them before capture - that JS property change was evidently not
// surviving whatever internal cloning/serialization html2canvas performs, collapsing the vast
// majority of content back down to just each section's one-line summary bar.
// Rather than continue depending on a boolean DOM property surviving a cloning process this app has
// no visibility into or control over, this removes the dependency entirely for PDF export: every
// <details>/<summary> pair is converted to a plain, unconditionally-visible <div> pair directly in
// the HTML STRING, before it ever becomes a live DOM element. There is no "open" state left to lose,
// because there is no <details> element left at all by the time html2canvas ever sees this content.
function stripDetailsForPdf(html) {
  // BUG FIX (widened after testing revealed a second, differently-classed <details> pattern this
  // app also uses - "subsection-toggle", for the QMDJ 9-palace chart expand/collapse - separate from
  // wrapSectionCollapsible's "section-details"/"section-summary" pattern this fix originally targeted
  // only. Rather than keep hardcoding each specific class name variant (and risk missing a future
  // one the same way), this now matches ANY <details>/<summary> tag regardless of its class, while
  // preserving whatever attributes it had (so existing CSS styling for that class still applies to
  // the resulting <div>).
  return html
    .replace(/<details(\s+[^>]*)?>/g, '<div$1>')
    .replace(/<\/details>/g, '</div>')
    .replace(/<summary(\s+[^>]*)?>/g, '<div$1>')
    .replace(/<\/summary>/g, '</div>')
    // The chevron (▸) is a live-app toggle-state indicator with no meaning in a static, fully-expanded
    // PDF - removed rather than left showing a meaningless static arrow next to every section title.
    .replace(/<span class="section-chevron">[^<]*<\/span>/g, '');
}

// Shared by every profile's PDF (main, Life/Business Partner, Children) so the section is identical
// in heading and format to what the Reading tab shows - see buildProfilePdfHTML.
function detailedReadingSectionHTML(p) {
  return wrapSectionCollapsible(`<h2 class="section-header">${bt('Detailed Reading','详细解读')}</h2><article class="reading">${generateDetailedReading(p)}</article>`);
}

function buildProfilePdfHTML(prefix) {
  const prof = getProfileByPrefix(prefix);
  const p = prof ? getProfileData(prof) : getProfileData();
  if (!p) return null;
  const u = activeUser();

  pdfExportMode = true;
  let bodyHTML;
  try {
    // BUG FIX (reported: "compatibility summary is missing from all profiles"): renderSystemChart's
    // own "Life Partner Alignment" / "Business Partner Alignment" section (shown at the top of a
    // partner's or business partner's own chart in the live app) lives in its RETURN VALUE, outside
    // the 4-tab system - it is NOT part of chartTabRegistry. This function was discarding that return
    // value entirely and rebuilding bodyHTML only from the 4 tabs, silently dropping that section (and
    // the profile-overview header above it) from every partner/business-partner PDF export. It also
    // wasn't passing the compatResult/mainP this section needs in the first place. Fixed by computing
    // the correct compatibility parameters for this prefix, capturing renderSystemChart's actual
    // return value, and keeping the portion before the tab bar (profile overview + alignment section)
    // instead of throwing it away.
    let compatResultForPrefix = null, isBusinessForPrefix = false, mainPForPrefix = null;
    if (prefix === 'p' && u?.partner) {
      mainPForPrefix = getProfileData();
      compatResultForPrefix = calculateTrueCompatibility(mainPForPrefix, p, false);
    } else if (prefix === 'b' && u?.businessPartner) {
      mainPForPrefix = getProfileData();
      isBusinessForPrefix = true;
      compatResultForPrefix = calculateTrueCompatibility(mainPForPrefix, p, true);
    } else if (typeof prefix === 'string' && prefix.startsWith('b2_')) {
      mainPForPrefix = getProfileData();
      isBusinessForPrefix = true;
      compatResultForPrefix = calculateTrueCompatibility(mainPForPrefix, p, true);
    }
    const fullChartResult = renderSystemChart(p, prefix, compatResultForPrefix, isBusinessForPrefix, mainPForPrefix);
    const tabBarIdx = fullChartResult.indexOf('<div class="chart-tab-bar"');
    const headerAndCompatHTML = tabBarIdx >= 0 ? fullChartResult.slice(0, tabBarIdx) : '';

    const tabs = chartTabRegistry[prefix];
    bodyHTML = headerAndCompatHTML + ['core', 'timing', 'environment', 'more'].map(t => tabs[t] || '').join('');

    if (prefix === 'i') {
      // BUG FIX (reported: garbled/nonsensical Table-of-Contents line items like "Life Partner Deep
      // Compatibility Profile Life Part..." and "This is a rule-based reading generated from your own
      // chart's computed..."): every one of the sections below is now run through the same
      // wrapSectionCollapsible() helper the ~15 main tab sections already use, instead of being appended
      // as a loose, un-wrapped `<h2>` + `<article>` pair. That helper folds the h2+content into ONE
      // `.section-details`/`.section-summary` element, which is exactly the pattern extractSectionTitle
      // (used to build the TOC) looks for - so each of these now gets its own correct, clean TOC entry
      // (its real heading text) instead of either a garbled fallback or (after that fallback was
      // removed) silently no entry at all.
      let compatSections = '';
      if (u?.partner) {
        const partnerP = getProfileData(u.partner);
        const cr = calculateTrueCompatibility(p, partnerP, false);
        compatSections += wrapSectionCollapsible(`<h2 class="section-header">${bt('Life Partner Compatibility','伴侣契合度')} - ${partnerP.displayName}</h2>
          <article class="reading">${generateDeepAnalysisData('compat_life', p, {title: 'Life Partner Deep Compatibility Profile', compatResult: cr, partnerP})}</article>`);
      }
      // ENHANCEMENT (this round): previously only the CORE business partner was included, silently
      // dropping up to 2 additional business partners from the main profile's PDF. Now loops over all
      // of them (core + additional), each getting its own compatibility section.
      const allBizPartners = [];
      if (u?.businessPartner) allBizPartners.push({ raw: u.businessPartner, label: '' });
      (u?.additionalBizPartners || []).forEach((bp, i) => allBizPartners.push({ raw: bp, label: ` #${i + 2}` }));
      allBizPartners.forEach(({ raw, label }) => {
        const bizP = getProfileData(raw);
        const cr = calculateTrueCompatibility(p, bizP, true);
        compatSections += wrapSectionCollapsible(`<h2 class="section-header">${bt('Business Partner Compatibility','事业伙伴契合度')}${label} - ${bizP.displayName}</h2>
          <article class="reading">${generateDeepAnalysisData('compat_biz', p, {title: `Business Partner${label} Strategic Alignment Profile`, compatResult: cr, partnerP: bizP})}</article>`);
      });
      // ENHANCEMENT (this round): children and household occupants were previously entirely absent
      // from the main profile's PDF export - a real gap given both are core household context. Adds
      // a compact Family Summary (each child's key facts + compatibility with the main person) and a
      // Household Occupants roster (Kua numbers), rather than embedding every child's full multi-page
      // chart, which would make the export unwieldy - each child can still be exported individually
      // via their own "View Chart" + Export PDF (see renderChildrenTab).
      if (u?.children?.length) {
        let familyHTML = `<h2 class="section-header">${bt('Family Summary - Children','家庭概览——子女')}</h2>`;
        u.children.forEach(c => {
          const cp = getProfileData(c);
          const cr = calculateTrueCompatibility(p, cp, false);
          familyHTML += `<article class="reading">
            <div class="calc-box">• <strong>${cp.englishName}</strong> · ${bt('Age','年龄')} ${computeCurrentAge(cp.birthdate)} · ${cp.animal} (${cp.animalCN}) · ${bt('Day Master','日主')}: ${stems[cp.bazi.dayStemIdx]} · ${bt('Kua','命卦')} ${cp.kuaNum} (${cp.kuaGroup}) · ${bt('Compatibility with you','与您的契合度')}: ${cr.score}%</div>
          </article>`;
        });
        bodyHTML += wrapSectionCollapsible(familyHTML);
      }
      const occupants = prof?.bazhaiOccupants || [];
      if (occupants.length) {
        let occHTML = `<h2 class="section-header">${bt('Household Occupants','家庭住户')}</h2><article class="reading">`;
        occupants.forEach((o, i) => {
          const k = getOccupantKua(o.year, o.gender);
          occHTML += `<div class="calc-box" style="margin-bottom:6px">• ${bt(`Occupant ${i+1}`, `住户${i+1}`)}: ${bt(o.gender==='male'?'Male':'Female', o.gender==='male'?'男':'女')}, b.${o.year} → ${bt('Kua','命卦')} ${k.kuaNum} (${k.kuaGroup})</div>`;
        });
        occHTML += '</article>';
        bodyHTML += wrapSectionCollapsible(occHTML);
      }
      // BUG FIX (reported directly: "statistic missing for predicted numbers for toto and 4d" - meaning
      // the historical hit-rate tracking, confirmed live to be genuinely working and showing real
      // numbers on-screen. Investigation found the actual gap was one level up: the ENTIRE 4D/TOTO
      // Predictions section - verified results, upcoming predictions, AND the historical-accuracy stats
      // bundled inside it - lives in its own dedicated `#fourDContainer`/`#totoContainer` elements in
      // index.html, outside the per-profile chart-tab system this function otherwise pulls a PDF's
      // body from, so it had never been part of ANY profile's PDF export at all - confirmed directly by
      // checking a real generated export's HTML for "Historical Accuracy"/"4D" text and finding neither).
      // renderLotteryPredictions now returns its two built HTML strings (see its own comment in
      // engine-predictions.js) instead of only writing them into those DOM containers, so they can be
      // included here too - scoped to the main profile only ('i'), matching how the live Lottery view
      // itself is scoped to the active user's own profile, not per family member.
      const lotteryHtml = (typeof renderLotteryPredictions === 'function') ? renderLotteryPredictions(p) : null;
      if (lotteryHtml) {
        bodyHTML += wrapSectionCollapsible(`<h2 class="section-header">${bt('Singapore Pools 4D Results and Predictions','新加坡博彩万字票（4D）成绩与预测')}</h2><article class="reading">${lotteryHtml.html4D}</article>`);
        bodyHTML += wrapSectionCollapsible(`<h2 class="section-header">${bt('Singapore Pools TOTO Results and Predictions','新加坡博彩多多（TOTO）成绩与预测')}</h2><article class="reading">${lotteryHtml.htmlToto}</article>`);
      }
      // BUG FIX (reported directly: "The Detailed reading is missing. This should go after summary and
      // before the compatibility summary"). Root cause: Detailed Reading lives entirely in its own
      // separate app screen/tab (detailedReadingTab), outside the 4-tab chart registry
      // (core/timing/environment/more) this function pulls bodyHTML from - it was never included in
      // the PDF export at all. generateDetailedReading(p) is self-contained (built purely from this
      // profile's own already-computed chart data, no live DOM/tab state needed), so it's called
      // directly here and inserted right after the "Details Summary" section (already part of the
      // 'core' tab pulled in above) and before the compatibility summaries appended below - exactly the
      // placement asked for.
      bodyHTML += detailedReadingSectionHTML(p);
      bodyHTML += compatSections;
    } else {
      // ENHANCEMENT (reported: "include a reading for all profiles following the reading format from
      // the reading tab"): the Detailed Reading section above was only appended inside the
      // prefix === 'i' branch, so every Life Partner, Business Partner (core + additional) and Child
      // PDF - including each one's file in the "Export All Profiles (ZIP)" - silently omitted it, even
      // though the Reading tab itself (renderDetailedReadingTab) already supports every one of those
      // profiles via its selector. generateDetailedReading(p) is self-contained per profile, so the
      // identical section is now appended to every other profile's PDF as well, same format and
      // heading as the main profile's.
      bodyHTML += detailedReadingSectionHTML(p);
    }
  } finally {
    pdfExportMode = false;
  }

  const genDate = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-SG', { year: 'numeric', month: 'long', day: 'numeric' });
  const profileLabel = prefix === 'i' ? '' :
    prefix === 'p' ? bt(' (Life Partner)', '（生命伴侣）') :
    prefix === 'b' ? bt(' (Business Partner)', '（事业伙伴）') :
    (typeof prefix === 'string' && prefix.startsWith('b2_')) ? bt(` (Business Partner #${Number(prefix.slice(3)) + 2})`, `（事业伙伴 #${Number(prefix.slice(3)) + 2}）`) :
    (typeof prefix === 'string' && prefix.startsWith('c')) ? bt(' (Child)', '（子女）') : '';
  return stripDetailsForPdf(`
    <div style="font-family:Georgia,serif;padding:20px;color:#182030">
      <div style="text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #b88635">
        <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#5c345b;font-weight:800">Illuminate</div>
        <h1 style="font:500 26px Georgia,serif;margin:8px 0">${p.englishName}${profileLabel}</h1>
        <div style="font-size:12px;color:#697386">${bt('Generated on','生成日期')} ${genDate}</div>
      </div>
      ${bodyHTML}
      <div style="margin-top:30px;padding-top:15px;border-top:1px solid #ded8cd;font-size:11px;color:#697386;text-align:center">${bt('For reflection and entertainment; not scientific, financial, or medical advice.','仅供反思与娱乐参考，并非科学、财务或医疗建议。')}</div>
    </div>
  `);
}

// DIAGNOSTIC (added after a fix attempt corrected the canvas SIZE - now 1438 x 110774, matching real
// content height - but the actual painted pixels are still essentially empty, a 6-character data
// URL). This isolates whether html2canvas can paint ANYTHING at all in this browser/environment,
// independent of this app's complex 296K-character PDF content - a minimal, 3-line, solid-colour
// test box either succeeds or fails the exact same way, telling us whether the problem is something
// specific to this app's content or a more fundamental environment restriction (this app is being
// opened via a file:// URL rather than a real web server, which carries its own, separate,
// well-documented restrictions for several browser APIs - not fully ruled out yet). Callable directly
// from the browser console as `testHtml2CanvasBasic()` for a fast answer without navigating the app.
function testHtml2CanvasBasic() {
  if (typeof html2pdf === 'undefined') { console.error('[Illuminate PDF TEST] html2pdf is not loaded.'); return; }
  const test = document.createElement('div');
  test.style.cssText = 'width:200px; height:100px; background:red; color:#fff; font-size:20px; padding:10px;';
  test.textContent = 'TEST BOX';
  document.body.appendChild(test);
  console.log('[Illuminate PDF TEST] Test box appended - offsetWidth:', test.offsetWidth, 'offsetHeight:', test.offsetHeight);
  html2pdf().set({ html2canvas: { scale: 1 } }).from(test).toCanvas().then(function () {
    const canvas = this.prop.canvas;
    const dataUrl = canvas.toDataURL('image/png');
    console.log('[Illuminate PDF TEST] Canvas dimensions:', canvas.width, 'x', canvas.height, '| Data URL length:', dataUrl.length);
    console.log('[Illuminate PDF TEST] If this length is also tiny (under ~100), html2canvas cannot paint ANYTHING in this environment - not specific to this app\'s content. If it is large (thousands+), simple content works fine and the problem is specific to this app\'s more complex content.');
    document.body.removeChild(test);
  }).catch((err) => {
    console.error('[Illuminate PDF TEST] Error:', err);
    document.body.removeChild(test);
  });
}

// BUG FIX (root cause finally confirmed, not guessed - by html2pdf.js's own official documentation,
// word for word, plus independent confirmation from multiple browser-vendor sources): browsers
// impose a hard maximum canvas dimension - Chrome and Firefox both cap this at 32,767 pixels.
// Beyond that limit, a canvas silently has NO paintable pixels - not an error, just blank - which is
// exactly the "correct reported size, but ~6-character (empty) data URL" result seen in diagnostic
// testing on this app's actual export. This content's natural height (55,000+ px) already exceeds
// that limit on its own; at scale:2 for image quality, the canvas would need to be 110,000+ px tall -
// more than 3x over. html2pdf.js's own documented known issues describe this exact failure mode by
// name: "HTML5 canvases have a maximum height/width. Anything larger will fail to render... this
// results in large PDFs rendering completely blank in html2pdf.js." None of the seven prior fix
// attempts (positioning, DOM structure, html2canvas config, foreignObjectRendering, <details>
// stripping) could have worked, because none of them addressed this actual constraint - each one
// left the same oversized single canvas being requested from the browser.
// Fix: split the content into several chunks, each one's natural height kept low enough that even
// at scale:2 it stays safely under the 32,767px browser limit. Each chunk is captured separately
// (still using html2pdf.js's own worker API, via its toCanvas() step, so no separate/uncertain
// global variable for html2canvas needs to be guessed at), then every resulting chunk canvas is
// further sliced into A4-page-sized pieces and assembled into one multi-page PDF using jsPDF
// directly - accessed via html2pdf.js's own bundled jsPDF constructor, checked at more than one
// possible global location since the exact bundle export name isn't sample-verified here.
// ENHANCEMENT (requested directly: "Add a PDF generation bar to show PDF generation status"): a
// small, fixed-position overlay with a progress bar and status text, shown for the duration of a
// PDF export - this process captures dozens of sections sequentially with small delays between each
// (see captureChunksIntoPdf), so it can take several seconds with no visible feedback otherwise.
// Plain DOM/inline-style construction (no changes to styles.css or index.html needed) so this stays
// self-contained to the export feature; removed automatically on completion or error.
function showPdfExportProgress() {
  let bar = document.getElementById('pdfExportProgressOverlay');
  if (bar) return bar;
  bar = document.createElement('div');
  bar.id = 'pdfExportProgressOverlay';
  bar.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:99999; background:#fff; border-bottom:1px solid var(--line); padding:12px 20px; box-shadow:0 2px 8px rgba(0,0,0,0.08); font-family:Inter,system-ui,sans-serif;';
  bar.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <span id="pdfExportProgressLabel" style="font-size:13px; font-weight:700; color:var(--plum)">${bt('Generating PDF...', '正在生成PDF……')}</span>
      <span id="pdfExportProgressPct" style="font-size:12px; color:var(--muted)">0%</span>
    </div>
    <div style="height:6px; background:var(--sand); border-radius:4px; overflow:hidden;">
      <div id="pdfExportProgressFill" style="height:100%; width:0%; background:var(--gold); transition:width 0.2s ease;"></div>
    </div>
    <div id="pdfExportProgressDiag" style="font-size:10px;color:var(--muted);margin-top:4px"></div>
  `;
  document.body.appendChild(bar);
  return bar;
}
function updatePdfExportProgress(label, percent) {
  const bar = document.getElementById('pdfExportProgressOverlay');
  if (!bar) return;
  const labelEl = document.getElementById('pdfExportProgressLabel');
  const pctEl = document.getElementById('pdfExportProgressPct');
  const fillEl = document.getElementById('pdfExportProgressFill');
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  if (labelEl && label) labelEl.textContent = label;
  if (pctEl) pctEl.textContent = clamped + '%';
  if (fillEl) fillEl.style.width = clamped + '%';
}
function hidePdfExportProgress() {
  const bar = document.getElementById('pdfExportProgressOverlay');
  if (bar) bar.remove();
}
// LIVE SELF-CHECK (added after repeated "Duplicate form field id" reports in Chrome's DevTools Issues
// panel, each time immediately after generating a PDF): exhaustive code review of the id-reassignment
// and try/finally cleanup in exportProfileToPdfInner/captureChunksIntoPdf/buildProfilePdfBlob found no
// path that can leave a duplicate id live, and a purpose-built test that monkey-patches every DOM
// mutation method to check id-uniqueness after EVERY single mutation during a real export (run twice in
// one session, mimicking "generate a PDF, then generate another") found zero live collisions at any
// point. Rather than ask for another round of squinting at DevTools, this scans the ACTUAL live
// document for duplicate ids right after each export completes and reports the real, current count
// directly here - no DevTools needed - so the ground truth is visible in the app itself. It's also
// exposed on window so it can be run manually at any time (e.g. right after DevTools shows an Issue) to
// check the CURRENT live state of the page, independent of whatever the Issues panel is still showing -
// Chrome's Issues panel is known to retain/accumulate entries from earlier actions within a tab session
// rather than always reflecting the page's current DOM.
function scanLiveDuplicateIds() {
  const idMap = new Map();
  document.querySelectorAll('[id]').forEach(el => {
    if (!el.id) return;
    idMap.set(el.id, (idMap.get(el.id) || 0) + 1);
  });
  const dupes = [...idMap.entries()].filter(([, count]) => count > 1);
  return { count: dupes.length, dupes };
}
if (typeof window !== 'undefined') window.__illuminateCheckDuplicateIds = scanLiveDuplicateIds;

// Locates a top-level `<h2 class="section-header">` heading inside `containerEl` whose text content
// satisfies `matchFn`, and returns the HTML of everything between it and the next such heading (or
// the end of the container) as a string - i.e. exactly the content the live app itself renders for
// that one section.
// NOTE: this matches by heading TEXT, not by `id`. This app's own `idAttr()` helper (see its
// definition, `renderSystemChart`) deliberately OMITS the `id` attribute for every profile except the
// main one ('i'), specifically to avoid duplicate-DOM-id warnings when multiple profiles' charts are
// rendered simultaneously in the live app (home view can show the main + partner + business charts at
// once). Looking sections up by id would therefore silently return nothing for every partner/business/
// child profile export - text matching works identically for every profile.
function extractChartSectionHtml(containerEl, matchFn) {
  const headings = Array.from(containerEl.querySelectorAll('h2.section-header'));
  const heading = headings.find(h => matchFn(h.textContent || ''));
  if (!heading) return '';
  let html = '';
  let node = heading.nextElementSibling;
  while (node && !(node.tagName === 'H2' && node.classList.contains('section-header'))) {
    html += node.outerHTML;
    node = node.nextElementSibling;
  }
  return html;
}

// Converts a semantic HTML fragment - as produced by this app's own chart-rendering functions
// (h2/h3/h4 headings, <p> text, .calc-box notes, .pill labels, <ul>/<li> lists, <hr> dividers) - into
// calls on the native PDF writer `w`. This lets sections that don't yet have their own hand-built
// rawOnly data path (Personal Assets, Health Diagnosis, Xiang Shu, San Shi, Ze Ri, Zi Wei Dou Shu,
// Feng Shui, Detailed Reading) still produce real, searchable, properly page-broken native text - by
// walking the EXACT same HTML the live chart view and the screenshot-based PDF export both already
// use, rather than re-deriving each one's calculations by hand a second time (which would risk
// silently drifting out of sync with the live app as either side changes).
function renderHtmlFragmentIntoWriter(w, html) {
  if (!html) return;
  const container = document.createElement('div');
  container.innerHTML = html;
  const skipTags = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SCRIPT', 'STYLE', 'LABEL']);
  const skipClasses = ['pdf-exclude', 'btnViewDeepAnalysis', 'hidden'];
  const walk = (node) => {
    Array.from(node.children).forEach(el => {
      if (skipTags.has(el.tagName)) return;
      if (el.classList && skipClasses.some(c => el.classList.contains(c))) return;
      if (el.style && el.style.display === 'none') return;
      if (/^H[1-4]$/.test(el.tagName)) {
        const t = (el.textContent || '').trim();
        if (t) w.addSubHeader(t);
        return;
      }
      if (el.tagName === 'HR') { w.addDivider(); return; }
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        const items = Array.from(el.children).filter(li => li.tagName === 'LI').map(li => (li.textContent || '').trim()).filter(Boolean);
        if (items.length) w.addBulletList(items, { fontSize: 9 });
        return;
      }
      if (el.classList && el.classList.contains('calc-box')) {
        const t = (el.textContent || '').trim();
        if (t) w.addCalcBox(t, { fontSize: 9 });
        return;
      }
      if (el.classList && el.classList.contains('pill')) {
        const t = (el.textContent || '').trim();
        if (t) w.addParagraph(t, { fontSize: 9, bold: true, color: PDF_COLOR_GOLD });
        return;
      }
      if (el.tagName === 'P') {
        const t = (el.textContent || '').trim();
        if (t) w.addParagraph(t, { fontSize: 9 });
        return;
      }
      // Generic container (div, article, span, section): recurse into its own element children so
      // nested structure (e.g. <article class="reading"><div>...</div></article>) still gets walked
      // fully - only fall back to treating its own text as one paragraph once there is nothing left
      // to recurse into.
      if (el.children && el.children.length > 0) {
        walk(el);
      } else {
        const t = (el.textContent || '').trim();
        if (t) w.addParagraph(t, { fontSize: 9 });
      }
    });
  };
  walk(container);
}

// Content-model builder: assembles a list of {title, render(w)} sections using the SAME underlying
// profile data (getProfileData(), generateDeepAnalysisData(..., true)) the live app already
// computes, rendering each one directly with the native writer's primitives above. Section ORDER and
// SET follow the explicit sequence requested: Summary Information, Comparison (main profile only),
// Detailed Reading, Ming Li, Personal Assets, Zodiac, Name Analysis, Health Diagnosis, I Ching, Xiang
// Shu, Da Yun, San Shi, Ze Ri, Zi Wei Dou Shu, Hourly Highlights, Feng Shui, Numerology, Western
// Astrology. Sections without their own rawOnly data path reuse the live app's own chart HTML via
// extractChartSectionHtml()/renderHtmlFragmentIntoWriter() above, rather than re-deriving each one's
// logic by hand a second time.
function buildNativeProfileSections(prefix) {
  const prof = getProfileByPrefix(prefix);
  const p = prof ? getProfileData(prof) : getProfileData();
  if (!p) return [];
  const sections = [];
  const u = activeUser();

  // One-time setup for every section below that reuses the live chart's own HTML (Personal Assets,
  // Health Diagnosis, Xiang Shu, San Shi, Ze Ri, Zi Wei Dou Shu, Feng Shui): computes the same
  // compatibility parameters buildProfilePdfHTML already uses, calls renderSystemChart ONCE (which
  // populates chartTabRegistry[prefix] as a side effect), then parses the full concatenated tab HTML
  // into one detached container that extractChartSectionHtml() below can pull individual sections out
  // of. Wrapped in the same pdfExportMode flag buildProfilePdfHTML uses, so any export-specific
  // rendering differences (e.g. no interactive "View Deep Analysis" buttons) apply here too.
  let chartContainerEl = null;
  pdfExportMode = true;
  try {
    let compatResultForPrefix = null, isBusinessForPrefix = false, mainPForPrefix = null;
    if (prefix === 'p' && u?.partner) {
      mainPForPrefix = getProfileData();
      compatResultForPrefix = calculateTrueCompatibility(mainPForPrefix, p, false);
    } else if (prefix === 'b' && u?.businessPartner) {
      mainPForPrefix = getProfileData();
      isBusinessForPrefix = true;
      compatResultForPrefix = calculateTrueCompatibility(mainPForPrefix, p, true);
    } else if (typeof prefix === 'string' && prefix.startsWith('b2_')) {
      mainPForPrefix = getProfileData();
      isBusinessForPrefix = true;
      compatResultForPrefix = calculateTrueCompatibility(mainPForPrefix, p, true);
    }
    renderSystemChart(p, prefix, compatResultForPrefix, isBusinessForPrefix, mainPForPrefix);
    const tabs = chartTabRegistry[prefix] || {};
    const chartFullHtml = ['core', 'timing', 'environment', 'more'].map(t => tabs[t] || '').join('');
    chartContainerEl = document.createElement('div');
    chartContainerEl.innerHTML = chartFullHtml;
  } finally {
    pdfExportMode = false;
  }
  const addChartSection = (w, matchFn) => renderHtmlFragmentIntoWriter(w, extractChartSectionHtml(chartContainerEl, matchFn));

  // --- 1. Summary Information (Profile Overview tiles + Details Summary rows, combined) ---
  const bwTierForSummary = getBoneWeightTier(p.boneWeight.total);
  sections.push({
    title: bt('Summary Information', '概览信息'),
    render(w) {
      const profileAge = computeCurrentAge(p.birthdate);
      const genderLabel = bt(p.isMale ? 'Male' : 'Female', p.isMale ? '男' : '女');
      w.addParagraph(`${p.englishName}  ·  ${genderLabel}  ·  ${bt('Age','年龄')} ${profileAge}  ·  ${p.animal} (${p.animalCN})`, { fontSize: 11, bold: true, color: PDF_COLOR_PLUM });
      w.addSpacer(2);
      w.addTileGrid([
        { label: bt('Gregorian Birth','阳历出生'), value: `${p.birthdate}  ${p.birthtime}${p.birthLocation ? ' · ' + p.birthLocation : ''}` },
        { label: bt('Lunar Birth','农历出生'), value: bt(p.lunar.fullLunarEN, p.lunar.fullLunarCN) },
        { label: bt('Day Master','日主'), value: `${stems[p.bazi.dayStemIdx]} (${stemCN[p.bazi.dayStemIdx]})` },
        { label: bt('Bone Weight','骨重'), value: `${p.boneWeight.displayStr} (${p.boneWeight.total} ${bt('Liang','两')})` },
        { label: bt('Da Yun (Current Cycle)','大运（当前）'), value: `${bt('Start Age','起运年龄')} ${p.nominalStartAge} (${p.daYunStartYear})` },
        { label: bt('Life Expectancy','预期寿命'), value: `${p.lifespan} ${bt('Yrs','岁')}` },
        { label: bt('Numerology Life Path','生命数字'), value: `${p.life} (${bt('Lucky No.','幸运号码')}: ${p.lifeLuckyNumber})` },
        { label: bt('Sun Sign','太阳星座'), value: p.astro.en },
        { label: bt('I Ching Hexagram','易经本命卦'), value: `#${p.hexNo}` },
        { label: bt('Zi Wei Life Palace','紫微命宫'), value: p.ziwei.lifePalaceName },
        { label: bt('QMDJ Life Palace','奇门命宫'), value: `${bt('Palace','宫位')} ${p.qmdj.natalPalace} (${p.palaceName})` },
        { label: bt('Ba Zhai Kua','八宅命卦'), value: `${p.kuaGroup} - ${bt('Kua','卦')} ${p.kuaNum}` },
      ], { columns: 2 });
      w.addSpacer(2);
      w.addDivider();
      const rows = [
        [bt('Zodiac','生肖'), `${p.animal} (${p.animalCN}) — ${bt('Allies','三合')}: ${p.zodiacData.allies}, ${bt('Conflict','相冲')}: ${p.zodiacData.avoid}`],
        [bt('BaZi Day Master','八字日主'), `${stems[p.bazi.dayStemIdx]} (${stemCN[p.bazi.dayStemIdx]})`],
        [bt('Da Yun','大运'), `${bt('Start Year','起运年')} ${p.daYunStartYear} (${bt('Age','年龄')} ${p.nominalStartAge})`],
        [bt('Life Expectancy','预期寿命'), `${p.lifespan} ${bt('Yrs','岁')}`],
        [bt('Zi Wei Life Palace','紫微命宫'), p.ziwei.lifePalaceName],
        [bt('QMDJ Life Palace','奇门命宫'), `${bt('Palace','宫位')} ${p.qmdj.natalPalace} (${p.palaceName})`],
        [bt('Bone Weight','骨重'), `${p.boneWeight.displayStr} — ${bt(bwTierForSummary.tier, bwTierForSummary.tierZh)}`],
        [bt('Ba Zhai Kua','八宅命卦'), `${p.kuaGroup} - ${bt('Kua','卦')} ${p.kuaNum}`],
        [bt('I Ching Natal Hexagram','易经本命卦'), `#${p.hexNo}`],
        [bt('Numerology Life Path','生命数字'), `${p.life} (${bt('Lucky Number','幸运号码')}: ${p.lifeLuckyNumber})`],
        [bt('Sun Sign','太阳星座'), p.astro.en],
      ];
      rows.forEach(([label, value]) => w.addParagraph(`${label}: ${value}`, { fontSize: 9 }));
    }
  });

  // --- 2. Comparison details - main profile only (Life/Business Partner compatibility, Family
  // Summary, Household Occupants), mirroring buildProfilePdfHTML's own prefix==='i' block. ---
  if (prefix === 'i') {
    sections.push({
      title: bt('Comparison Details', '契合度比较'),
      render(w) {
        let wroteAny = false;
        if (u?.partner) {
          const partnerP = getProfileData(u.partner);
          const cr = calculateTrueCompatibility(p, partnerP, false);
          w.addSubHeader(`${bt('Life Partner Compatibility','伴侣契合度')} - ${partnerP.displayName}`);
          w.addDeepAnalysisBlock(generateDeepAnalysisData('compat_life', p, { title: 'Life Partner Deep Compatibility Profile', compatResult: cr, partnerP }, true));
          wroteAny = true;
        }
        const allBizPartners = [];
        if (u?.businessPartner) allBizPartners.push({ raw: u.businessPartner, label: '' });
        (u?.additionalBizPartners || []).forEach((bp, i) => allBizPartners.push({ raw: bp, label: ` #${i + 2}` }));
        allBizPartners.forEach(({ raw, label }) => {
          const bizP = getProfileData(raw);
          const cr = calculateTrueCompatibility(p, bizP, true);
          w.addSubHeader(`${bt('Business Partner Compatibility','事业伙伴契合度')}${label} - ${bizP.displayName}`);
          w.addDeepAnalysisBlock(generateDeepAnalysisData('compat_biz', p, { title: `Business Partner${label} Strategic Alignment Profile`, compatResult: cr, partnerP: bizP }, true));
          wroteAny = true;
        });
        if (u?.children?.length) {
          w.addSubHeader(bt('Family Summary - Children','家庭概览——子女'));
          u.children.forEach(c => {
            const cp = getProfileData(c);
            const cr = calculateTrueCompatibility(p, cp, false);
            w.addCalcBox(`${cp.englishName} · ${bt('Age','年龄')} ${computeCurrentAge(cp.birthdate)} · ${cp.animal} (${cp.animalCN}) · ${bt('Day Master','日主')}: ${stems[cp.bazi.dayStemIdx]} · ${bt('Kua','命卦')} ${cp.kuaNum} (${cp.kuaGroup}) · ${bt('Compatibility with you','与您的契合度')}: ${cr.score}%`, { fontSize: 9 });
          });
          wroteAny = true;
        }
        const occupants = prof?.bazhaiOccupants || [];
        if (occupants.length) {
          w.addSubHeader(bt('Household Occupants','家庭住户'));
          occupants.forEach((o, i) => {
            const k = getOccupantKua(o.year, o.gender);
            w.addCalcBox(`${bt(`Occupant ${i+1}`, `住户${i+1}`)}: ${bt(o.gender==='male'?'Male':'Female', o.gender==='male'?'男':'女')}, b.${o.year} → ${bt('Kua','命卦')} ${k.kuaNum} (${k.kuaGroup})`, { fontSize: 9 });
          });
          wroteAny = true;
        }
        if (!wroteAny) w.addParagraph(bt('No Life Partner, Business Partner, children, or household occupants are on file for this profile.','此档案暂无生命伴侣、事业伙伴、子女或家庭住户记录。'), { fontSize: 9, color: PDF_COLOR_MUTED });
      }
    });
  }

  // --- 3. Detailed Reading ---
  sections.push({
    title: bt('Detailed Reading', '详细解读'),
    render(w) {
      renderHtmlFragmentIntoWriter(w, generateDetailedReading(p));
    }
  });

  // --- 4. Ming Li (Destiny Analysis) - BaZi chart, Day Master + Macro analysis, Bone Weight. Da Yun
  // itself is now its own standalone section (#11) per the requested sequence, so it is NOT repeated
  // here. ---
  sections.push({
    title: bt('Ming Li (Destiny Analysis)', '命理'),
    render(w) {
      w.addSubHeader(bt('BaZi Natal Chart', '八字命盘'));
      w.addCalcBox(
        `${bt('Life Favorable Colors','人生幸运颜色')}: ${p.luckyColor}\n` +
        `${bt('Life Unfavorable Colors','人生忌用颜色')}: ${p.avoidColor}\n` +
        `${bt('Expected Life Expectancy Range','预期寿命范围')}: ${p.lifespan} ${bt('Yrs','岁')}\n` +
        `${bt('Number of Children Affinity','子女缘数')}: ${p.children}\n` +
        `${bt('Marriage Activation Ages','婚姻催动年龄')}: ~${p.mAge1}, ~${p.mAge2}`
      );
      w.addTable(
        [bt('Pillar','柱位'), bt('Hour','时'), bt('Day','日'), bt('Month','月'), bt('Year','年')],
        [
          [bt('Stem','天干'), `${stems[p.bazi.hourStemIdx]} ${stemCN[p.bazi.hourStemIdx]}`, `${stems[p.bazi.dayStemIdx]} ${stemCN[p.bazi.dayStemIdx]}`, `${stems[p.bazi.monthStemIdx]} ${stemCN[p.bazi.monthStemIdx]}`, `${stems[p.bazi.yearStemIdx]} ${stemCN[p.bazi.yearStemIdx]}`],
          [bt('Branch','地支'), `${branches[p.bazi.hourBranchIdx]} ${branchCN[p.bazi.hourBranchIdx]}`, `${branches[p.bazi.dayBranchIdx]} ${branchCN[p.bazi.dayBranchIdx]}`, `${branches[p.bazi.monthBranchIdx]} ${branchCN[p.bazi.monthBranchIdx]}`, `${branches[p.bazi.yearBranchIdx]} ${branchCN[p.bazi.yearBranchIdx]}`],
          [bt('Hidden','藏干'), hiddenStemsEN[p.bazi.hourBranchIdx], hiddenStemsEN[p.bazi.dayBranchIdx], hiddenStemsEN[p.bazi.monthBranchIdx], hiddenStemsEN[p.bazi.yearBranchIdx]],
        ]
      );
      w.addDeepAnalysisBlock(generateDeepAnalysisData('dayMaster', p, { title: bt('Day Master (日主) Deep Analysis','日主深度分析') }, true));
      w.addDeepAnalysisBlock(generateDeepAnalysisData('bazi_macro', p, { title: bt('BaZi Macro Structure Deep Analysis','八字宏观结构深度分析') }, true));

      w.addDivider();
      w.addSubHeader(bt('Cheng Gu Suan Ming (Bone Weight)', '称骨算命'));
      w.addDeepAnalysisBlock(generateDeepAnalysisData('boneWeight', p, { title: bt('Bone Weight Deep Analysis','称骨算命深度分析') }, true));
    }
  });

  // --- 5. Personal Assets readings ---
  sections.push({
    title: bt('Personal Assets', '个人资产'),
    render(w) { addChartSection(w, t => t.includes('Personal Assets') || t.includes('个人资产')); }
  });

  // --- 6. Zodiac ---
  sections.push({
    title: bt('Zodiac', '生肖'),
    render(w) {
      w.addDeepAnalysisBlock(generateDeepAnalysisData('zodiac', p, { title: bt('Zodiac Deep Profile','生肖深度分析') }, true));
    }
  });

  // --- 7. Name Analysis (Five Grids) ---
  sections.push({
    title: bt('Name Analysis', '姓名分析'),
    render(w) {
      w.addDeepAnalysisBlock(generateDeepAnalysisData('name', p, { title: bt('Five Grids Name Deep Analysis','五格姓名深度分析') }, true));
    }
  });

  // --- 8. Health Diagnosis ---
  sections.push({
    title: bt('Health Diagnosis', '健康分析'),
    render(w) { addChartSection(w, t => t.includes('Health Diagnosis') || t.includes('健康分析')); }
  });

  // --- 9. I Ching (Mei Hua Natal Hexagram) ---
  sections.push({
    title: bt('I Ching', '易经'),
    render(w) {
      w.addDeepAnalysisBlock(generateDeepAnalysisData('iching', p, { title: bt('I Ching Natal Hexagram Deep Analysis','易经本命卦深度分析') }, true));
    }
  });

  // --- 10. Xiang Shu (Physiognomy) ---
  sections.push({
    title: bt('Xiang Shu', '相术'),
    render(w) { addChartSection(w, t => t.includes('Xiang Shu') || t.includes('相术')); }
  });

  // --- 11. Da Yun (Major Luck Cycles) - standalone, per the requested sequence. ---
  sections.push({
    title: bt('Da Yun', '大运'),
    render(w) {
      const currentAge = computeCurrentAge(p.birthdate);
      const cyclesFromNow = (p.daYunPillars || []).filter(dy => (dy.age + 9) >= currentAge);
      w.addTable(
        [bt('Age Range','年龄段'), bt('Years','年份'), bt('Pillar','干支'), bt('Rating','评级')],
        cyclesFromNow.map(dy => [
          `${dy.age}-${dy.age + 9}${(currentAge >= dy.age && currentAge <= dy.age + 9) ? bt(' (Now)',' (现在)') : ''}`,
          `${dy.calendarYearStart}-${dy.calendarYearStart + 9}`,
          `${stemCN[dy.stemIdx]}${branchCN[dy.branchIdx]}`,
          bt(dy.rating.tierAbbr, dy.rating.tierAbbrZh),
        ])
      );
      cyclesFromNow.forEach(dy => {
        const raw = generateDeepAnalysisData(`dayun_${dy.age}`, p, { title: `${dy.age}-${dy.age + 9} ${bt('Years Old','岁')} (${stemCN[dy.stemIdx]}${branchCN[dy.branchIdx]})` }, true);
        w.addDeepAnalysisBlock(raw);
      });
    }
  });

  // --- 12. San Shi (Tai Yi Shen Shu, Qi Men Dun Jia, Da Liu Ren) ---
  sections.push({
    title: bt('San Shi', '三式'),
    render(w) { addChartSection(w, t => t.includes('San Shi') || t.includes('三式')); }
  });

  // --- 13. Ze Ri (Date Selection) ---
  sections.push({
    title: bt('Ze Ri', '择日'),
    render(w) { addChartSection(w, t => t.includes('Ze Ri') || t.includes('择日')); }
  });

  // --- 14. Zi Wei Dou Shu ---
  sections.push({
    title: bt('Zi Wei Dou Shu', '紫微斗数'),
    render(w) { addChartSection(w, t => t.includes('Zi Wei Dou Shu') || t.includes('紫微斗数')); }
  });

  // --- 15. Hourly Highlights - today's 12 two-hour blocks, built natively from the same pure-data
  // function the live Hourly tab uses (computeHourlyHighlights), rather than the interactive tab's
  // HTML (which carries a Today/Tomorrow toggle and profile switcher that have no place in a PDF). ---
  sections.push({
    title: bt('Hourly Highlights', '时辰运势'),
    render(w) {
      const blocks = computeHourlyHighlights(p, 0);
      w.addParagraph(bt('Calculated using Singapore time (UTC+8) as the reference, regardless of this profile\'s own birth location.', '以新加坡时间（UTC+8）为准计算，与本档案出生地点无关。'), { fontSize: 9, color: PDF_COLOR_MUTED });
      w.addTable(
        [bt('Hour Block','时辰'), bt('Pillar','干支'), bt('Rating','评级')],
        blocks.map(b => [
          `${SHI_CHEN_LABELS[b.shiIdx]}${b.isNow ? bt(' (Now)',' (现在)') : ''}`,
          `${b.stemCN}${b.branchCN}`,
          bt(b.rating.tierEN, b.rating.tierZH),
        ])
      );
    }
  });

  // --- 16. Feng Shui (Ba Zhai + Flying Star + Luan Tou, as the live app's own Feng Shui tab covers) ---
  sections.push({
    title: bt('Feng Shui', '风水'),
    render(w) { addChartSection(w, t => t.includes('Feng Shui') || t.includes('风水')); }
  });

  // --- 17. Numerology ---
  sections.push({
    title: bt('Numerology', '数字命理'),
    render(w) {
      w.addDeepAnalysisBlock(generateDeepAnalysisData('numerology', p, { title: bt('Numerology Deep Analysis','数字命理深度分析') }, true));
    }
  });

  // --- 18. Western Astrology ---
  sections.push({
    title: bt('Western Astrology', '西方占星'),
    render(w) {
      w.addDeepAnalysisBlock(generateDeepAnalysisData('astro', p, { title: bt('Western Astrology Deep Analysis','西方占星深度分析') }, true));
    }
  });

  return sections;
}

// FEATURE FLAG: switches exportProfileToPdf/buildProfilePdfBlob over to the new native-text PDF
// pipeline (buildNativePdfDocument, below) instead of the existing screenshot/html2canvas pipeline
// (captureChunksIntoPdf). Left OFF by default - the native pipeline draws real jsPDF text rather than
// pasting in captured images, which is a fundamentally different code path through jsPDF's own APIs
// (page management, text wrapping, table/box drawing) that has only been verified with Node-level
// structural and jsdom-based functional tests here, never against a real browser + real jsPDF +
// real exported file the way every other fix in this app has been (per this project's own working
// method: diagnose and verify from real evidence, not from what "should" work). Flip this to `true`
// once you've tested an export from the native pipeline yourself and confirmed it looks right -
// nothing else needs to change to switch over.
const USE_NATIVE_PDF_EXPORT = false;

// Assembles a full profile PDF using the native-text writer (createPdfWriter) and the section list
// from buildNativeProfileSections(), instead of screenshotting HTML. Mirrors the screenshot
// pipeline's own TOC-then-content page ordering trick (build content pages first using their real
// page numbers, then append TOC pages afterward and move them to the front via jsPDF's documented
// movePage() API - see captureChunksIntoPdf's own detailed comment on why this order is necessary)
// and its header/footer pass (brand mark + page numbers, applied once per page after every page
// exists in its final position and the true total page count is known).
async function buildNativePdfDocument(prefix, onProgress) {
  const sections = buildNativeProfileSections(prefix);
  if (!sections.length) return null;

  const MARGIN_MM = 10, PAGE_W_MM = 210, PAGE_H_MM = 297;
  const HEADER_HEIGHT_MM = 14, FOOTER_HEIGHT_MM = 10;
  const TOC_ENTRIES_PER_PAGE = 38;
  const MAX_TOC_TITLE_LENGTH = 70;

  // Obtain a real, working jsPDF instance the SAME proven way the screenshot pipeline already does
  // (see its own "BUG FIX v2" comment) - a direct `new jsPDF()` broke method resolution in this
  // environment ("pdfDoc.setFont is not a function"), so a tiny blank seed canvas is round-tripped
  // through html2pdf's own `.toPdf()` chain instead, taking its internal `pdf` instance.
  if (onProgress) onProgress(bt('Preparing document...', '正在准备文件……'), 3);
  const seedCanvas = document.createElement('canvas');
  seedCanvas.width = 2; seedCanvas.height = 2;
  const sctx = seedCanvas.getContext('2d');
  sctx.fillStyle = '#fff'; sctx.fillRect(0, 0, 2, 2);
  const pdfDoc = await new Promise((resolve, reject) => {
    html2pdf().set({ margin: 0, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } })
      .from(seedCanvas, 'canvas').toPdf().then(function () { resolve(this.prop.pdf); }).catch(reject);
  });

  const w = createPdfWriter(pdfDoc, { marginMM: MARGIN_MM, pageWMM: PAGE_W_MM, pageHMM: PAGE_H_MM, headerHMM: HEADER_HEIGHT_MM, footerHMM: FOOTER_HEIGHT_MM });

  const sectionStartPage = [];
  sections.forEach((sec, idx) => {
    if (onProgress) onProgress(`${bt('Building','正在生成')} ${sec.title}`, 5 + (idx / sections.length) * 85);
    w.markSectionStart(sectionStartPage, idx);
    w.addSectionHeader(sec.title);
    try {
      sec.render(w);
    } catch (err) {
      // A single section's data or chart-HTML extraction failing (e.g. a profile missing some
      // optional data this section depends on) should not lose the rest of the report - note it
      // in place and keep going, exactly as the live app's own many `if (...)` data-guards do
      // elsewhere rather than letting one missing field break an entire chart.
      console.error(`[Illuminate PDF] Native section "${sec.title}" failed to render:`, err);
      w.addParagraph(bt('This section could not be generated.','此部分内容生成失败。'), { fontSize: 9, color: PDF_COLOR_DANGER });
    }
    w.addSpacer(4);
  });

  // Append TOC pages after all content pages, then move them to the front (see this function's own
  // header comment for why).
  if (onProgress) onProgress(bt('Building table of contents...', '正在生成目录……'), 92);
  const contentPageCount = w.pageCount;
  const tocPageCount = Math.max(1, Math.ceil(sections.length / TOC_ENTRIES_PER_PAGE));
  let tocEntryIndex = 0;
  for (let t = 0; t < tocPageCount; t++) {
    pdfDoc.addPage();
    if (t === 0) {
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(18);
      pdfDoc.text(bt('Table of Contents', '目录'), MARGIN_MM, MARGIN_MM + HEADER_HEIGHT_MM + 8);
    }
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(11);
    let y = (t === 0 ? MARGIN_MM + HEADER_HEIGHT_MM + 22 : MARGIN_MM + HEADER_HEIGHT_MM + 8);
    for (let e = 0; e < TOC_ENTRIES_PER_PAGE && tocEntryIndex < sections.length; e++, tocEntryIndex++) {
      const pageNum = (sectionStartPage[tocEntryIndex] || 0) + tocPageCount + 1;
      const title = sections[tocEntryIndex].title;
      const truncated = title.length > MAX_TOC_TITLE_LENGTH ? title.slice(0, MAX_TOC_TITLE_LENGTH).trim() + '...' : title;
      pdfDoc.text(truncated, MARGIN_MM, y);
      pdfDoc.text(String(pageNum), PAGE_W_MM - MARGIN_MM - 8, y);
      y += 6;
    }
  }
  for (let t = 0; t < tocPageCount; t++) {
    pdfDoc.movePage(contentPageCount + 1, t + 1);
  }

  // Header/footer pass - identical visual language to the screenshot pipeline's own (see its detailed
  // comment): a small vector diamond logo mark + "ILLUMINATE" brand text + gold rule per header, and
  // a right-aligned "Page X of Y" footer, applied once per page now that every page sits in its final
  // position and the true total page count is known.
  const totalPages = pdfDoc.getNumberOfPages ? pdfDoc.getNumberOfPages() : (tocPageCount + contentPageCount);
  for (let pg = 1; pg <= totalPages; pg++) {
    pdfDoc.setPage(pg);
    const logoX = MARGIN_MM, logoY = MARGIN_MM + 3, logoR = 2.6;
    pdfDoc.setFillColor(PDF_COLOR_GOLD[0], PDF_COLOR_GOLD[1], PDF_COLOR_GOLD[2]);
    pdfDoc.lines([[logoR, logoR], [-logoR, logoR], [-logoR, -logoR]], logoX, logoY - logoR, [1, 1], 'F', true);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(11);
    pdfDoc.setTextColor(PDF_COLOR_PLUM[0], PDF_COLOR_PLUM[1], PDF_COLOR_PLUM[2]);
    pdfDoc.text(bt('ILLUMINATE', '点亮生命'), logoX + logoR + 3, logoY + 1.5);
    pdfDoc.setDrawColor(PDF_COLOR_GOLD[0], PDF_COLOR_GOLD[1], PDF_COLOR_GOLD[2]);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(MARGIN_MM, MARGIN_MM + HEADER_HEIGHT_MM - 3, PAGE_W_MM - MARGIN_MM, MARGIN_MM + HEADER_HEIGHT_MM - 3);

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(PDF_COLOR_MUTED[0], PDF_COLOR_MUTED[1], PDF_COLOR_MUTED[2]);
    const footerY = PAGE_H_MM - MARGIN_MM - 2;
    const footerText = bt(`Page ${pg} of ${totalPages}`, `第 ${pg} 页，共 ${totalPages} 页`);
    pdfDoc.text(footerText, PAGE_W_MM - MARGIN_MM, footerY, { align: 'right' });
    pdfDoc.setTextColor(0, 0, 0);
  }

  console.log(`[Illuminate PDF] Native report assembled - ${tocPageCount} TOC page(s) + ${contentPageCount} content page(s), header/footer applied to all ${totalPages} page(s).`);
  return pdfDoc;
}

// BUG FIX (found while investigating a reported "612 DevTools issues while generating PDF" -
// this app had no guard against the export being triggered again while one was already running.
// An impatient repeated click (a real, plausible user action on an export that takes many seconds
// with no obvious in-progress feedback beyond the progress overlay) would start a SECOND, fully
// independent export in parallel - each with its own full-content container (dozens of form fields)
// alive in the live DOM at once for as long as both exports overlap. Since every one of those
// elements' ids are reassigned from the SAME shared, ever-incrementing counter, they wouldn't
// literally collide - but the live "how many form fields exist right now" count would climb with
// every extra concurrent export, which is exactly the kind of runaway growth a DevTools Issues
// snapshot taken mid-export could catch. A simple in-flight flag now makes a repeat click a no-op
// instead of starting another overlapping export.
let __pdfExportInFlight = false;
// BUG FIX (reported directly: "PDF generation created 24 issues on console" - a DevTools "Duplicate
// form field id" Issues-panel report, on an account with a Life Partner and Business Partner profile
// on file, i.e. more than one profile for the background pre-render queue to build). Root cause: the
// existing __pdfExportInFlight guard (see the comment above it) only stops the background queue from
// STARTING a new profile's build while a live export is running - it's only checked once per profile,
// at the top of runPdfBackgroundPreRenderQueue's loop. If a live "Export PDF" click lands WHILE the
// background queue is already mid-way through building a DIFFERENT profile (a real, easy-to-hit
// timing window - a background build for the Life Partner or Business Partner profile can easily still
// be running when the person opens a different profile and exports it), that in-progress background
// build has no way to notice and back off - it only rechecks the flag after it finishes that whole
// profile, by which point its own detached container has been sitting in document.body, alongside the
// live export's own container, for however much of that profile's build was still left to run. Two
// such containers - each a real clone of this app's shared markup/component structure - can genuinely
// carry matching hardcoded ids/names for elements this app's per-container id-reassignment step
// doesn't touch (it only reassigns `id`, see the comment on `__pdfExportUidCounter` below), which is
// exactly what a "Duplicate form field id" DevTools Issue flags. FIX: __pdfBackgroundBuildActive is set
// true only while a build was started BY THE BACKGROUND QUEUE (never by a live export), and
// captureChunksIntoPdf below checks it, together with __pdfExportInFlight, at every existing yield
// point between batches - so the moment a live export starts while a background build is mid-flight,
// that background build now bails out at its very next opportunity (within one batch, typically well
// under a second) instead of continuing to share the live page with the export for the rest of its
// own profile's build. The abort is a plain thrown error, caught by the background queue's own
// existing per-profile try/catch (already logs a warning and moves on - see "Background pre-render
// failed for profile" below), and the container removal in buildProfilePdfBlob's own finally block
// still runs regardless of how the function exits, so cleanup is unaffected.
let __pdfBackgroundBuildActive = false;
async function exportProfileToPdf(prefix) {
  if (__pdfExportInFlight) {
    console.warn('[Illuminate PDF] Export already in progress - ignoring repeat request.');
    return;
  }
  __pdfExportInFlight = true;
  try {
    return await exportProfileToPdfInner(prefix);
  } finally {
    __pdfExportInFlight = false;
  }
}
async function exportProfileToPdfInner(prefix) {
  showPdfExportProgress();
  updatePdfExportProgress(bt('Preparing content...', '正在准备内容……'), 2);

  if (typeof html2pdf === 'undefined') {
    console.error('[Illuminate PDF] html2pdf is undefined - the CDN script (html2pdf.bundle.min.js) failed to load. Check network tab for a blocked/failed request to cdnjs.cloudflare.com.');
    hidePdfExportProgress();
    alert(bt('PDF export is temporarily unavailable - please check your internet connection and try again.','PDF导出暂时无法使用——请检查网络连接后重试。'));
    return;
  }

  const prof0 = getProfileByPrefix(prefix);
  const p0 = prof0 ? getProfileData(prof0) : getProfileData();
  const safeName0 = (p0?.englishName || 'profile').replace(/[^a-z0-9]+/gi, '_');
  const filename0 = `Illuminate_${safeName0}_${new Date().toISOString().slice(0,10)}.pdf`;

  // ENHANCEMENT (this round - background PDF pre-rendering, see the full design comment above
  // buildProfilePdfBlob's __pdfPreRenderCache block): if a background pre-render already produced a
  // Blob for this exact profile against this exact data (fingerprint match - nothing has changed since
  // it was built), skip the entire html2canvas/jsPDF pipeline below and just download the cached Blob.
  // This is the "almost immediately presented" outcome that was asked for - the live-build path further
  // down is still the fallback for a cache miss (first export after a change) or a stale entry, and
  // remains completely unchanged otherwise.
  if (!USE_NATIVE_PDF_EXPORT) {
    const email = state.active;
    const cached = email && __pdfPreRenderCache[email] && __pdfPreRenderCache[email][prefix];
    const currentFingerprint = computeActiveUserPdfFingerprint();
    if (cached && cached.fingerprint === currentFingerprint) {
      updatePdfExportProgress(bt('Preparing content...', '正在准备内容……'), 60);
      downloadPdfBlob(cached.blob, cached.filename || filename0);
      updatePdfExportProgress(bt('Done!', '完成！'), 100);
      const dupCheck = scanLiveDuplicateIds();
      const diagEl = document.getElementById('pdfExportProgressDiag');
      const diagText = dupCheck.count === 0
        ? bt('Page check: no duplicate field ids detected. (Served from background pre-render - instant.)', '页面检查：未检测到重复的字段ID。（来自后台预渲染——即时呈现。）')
        : bt(`Page check: ${dupCheck.count} duplicate id(s) still present. (Served from background pre-render - instant.)`, `页面检查：仍存在 ${dupCheck.count} 个重复ID。（来自后台预渲染——即时呈现。）`);
      if (diagEl) diagEl.textContent = diagText;
      console.log('[Illuminate PDF] Served from background pre-render cache - instant, no live rebuild needed.');
      setTimeout(hidePdfExportProgress, dupCheck.count === 0 ? 700 : 4000);
      return;
    }
  }

  // See USE_NATIVE_PDF_EXPORT's own comment above buildNativePdfDocument - flip that one constant to
  // switch every export over to the new native-text pipeline once it's been tested for real.
  if (USE_NATIVE_PDF_EXPORT) {
    try {
      const pdfDoc = await buildNativePdfDocument(prefix, (label, pct) => updatePdfExportProgress(label, pct));
      if (!pdfDoc) throw new Error('No content was generated - nothing to save.');
      updatePdfExportProgress(bt('Saving...', '正在保存……'), 99);
      pdfDoc.save(filename0);
      updatePdfExportProgress(bt('Done!', '完成！'), 100);
      setTimeout(hidePdfExportProgress, 600);
      console.log('[Illuminate PDF] Native export completed successfully.');
    } catch (err) {
      console.error('[Illuminate PDF] Error during native export:', err);
      hidePdfExportProgress();
      alert(bt('PDF export failed - please try again.','PDF导出失败——请重试。'));
    }
    return;
  }

  const html = buildProfilePdfHTML(prefix);
  if (!html) {
    console.error('[Illuminate PDF] buildProfilePdfHTML returned empty/null - no profile data available for prefix:', prefix);
    hidePdfExportProgress();
    return;
  }
  console.log('[Illuminate PDF] Content generated, length:', html.length, 'chars, for prefix:', prefix);

  // BUG FIX (found while investigating a reported "612 DevTools issues while generating PDF"):
  // container creation, id-stripping, and the topLevelNodes setup below used to sit OUTSIDE any
  // try/catch - only the capture loop itself (captureChunksIntoPdf, further below) was guarded. If
  // ANYTHING in this setup phase ever threw (a malformed clone, an unexpected DOM state), the
  // container would leak into the live document with no cleanup, exactly like the capture-loop leak
  // fixed in an earlier round. Wrapping the WHOLE lifetime of `container` (creation through removal)
  // in one try/finally closes that gap too, not just the capture loop's own internal one.
  let container = null;
  try {
    container = document.createElement('div');
    container.style.cssText = 'width:420px; background:#fff;';
    container.innerHTML = html;
    // BUG FIX (Task #79, reported directly: DevTools' Issues tab showing "20 issues: Duplicate form
    // field id" right as PDF generation starts - confirmed by re-reading this exact call site: the
    // EARLIER fix below (unique pdf-export-main-N ids) was real and correct, but it ran AFTER
    // `document.body.appendChild(container)`, not before. For the brief window between that
    // appendChild and this reassignment running, `container` - a full copy of buildProfilePdfHTML's
    // HTML, carrying the SAME ids as the live, currently-rendered app page (Feng Shui direction
    // selectors, household occupant fields, name-analysis inputs, etc.) - was genuinely live in
    // document.body with every one of those ids duplicated, which is exactly what DevTools' Issues
    // tab (and any AI-assistance panel watching the live DOM) would catch in that instant. None of the
    // work below (id reassignment, autocomplete, .pdf-exclude/.btnViewDeepAnalysis removal) needs the
    // element to be attached to the document - it's all plain attribute/class querying - so it now all
    // runs on the still-DETACHED container first, and `container` is only appended to document.body
    // once every id on it is already guaranteed unique. The same fix is applied to the matching
    // per-profile container in exportZippedProfilePdf below.
    container.querySelectorAll('[id]').forEach(el => el.setAttribute('id', `pdf-export-main-${__pdfExportUidCounter++}`));
    container.querySelectorAll('input, select, textarea').forEach(el => el.setAttribute('autocomplete', 'off'));
    // NOTE: no <details>-forcing needed here anymore - stripDetailsForPdf() inside
    // buildProfilePdfHTML already converted every <details>/<summary> into plain, always-visible
    // <div> elements before this HTML string was ever built, so there is nothing left to force open.
    container.querySelectorAll('.pdf-exclude').forEach(el => el.remove());
    container.querySelectorAll('.btnViewDeepAnalysis').forEach(el => el.remove());
    document.body.appendChild(container);

    const innerWrapper = container.firstElementChild;
    if (!innerWrapper) {
      console.error('[Illuminate PDF] No content wrapper found after building HTML - nothing to export.');
      alert(bt('PDF export failed - please try again.','PDF导出失败——请重试。'));
      return;
    }
    const wrapperStyle = innerWrapper.getAttribute('style') || 'font-family:Georgia,serif;padding:20px;color:#182030;';
    const topLevelNodes = Array.from(innerWrapper.children);
    console.log('[Illuminate PDF] Total content height:', innerWrapper.getBoundingClientRect().height, 'across', topLevelNodes.length, 'top-level sections.');

    const prof = getProfileByPrefix(prefix);
    const p = prof ? getProfileData(prof) : getProfileData();
    const safeName = (p?.englishName || 'profile').replace(/[^a-z0-9]+/gi, '_');
    const filename = `Illuminate_${safeName}_${new Date().toISOString().slice(0,10)}.pdf`;

    const pdfDoc = await captureChunksIntoPdf(topLevelNodes, wrapperStyle, (label, pct) => updatePdfExportProgress(label, pct));
    if (!pdfDoc) throw new Error('No content was captured - nothing to save.');
    updatePdfExportProgress(bt('Saving...', '正在保存……'), 99);
    pdfDoc.save(filename);
    updatePdfExportProgress(bt('Done!', '完成！'), 100);
    // ENHANCEMENT (background PDF pre-rendering - see the design comment above __pdfPreRenderCache):
    // this was a live build (a cache miss or stale entry), so warm the cache with its result now - a
    // repeat click on the same profile with no further edits becomes instant even without waiting for
    // the next background pre-render cycle.
    try {
      const email = state.active;
      if (email) {
        __pdfPreRenderCache[email] = __pdfPreRenderCache[email] || {};
        __pdfPreRenderCache[email][prefix] = { blob: pdfDoc.output('blob'), fingerprint: computeActiveUserPdfFingerprint(), builtAt: Date.now(), filename };
      }
    } catch (e) { /* caching is best-effort only - never allowed to affect the export that already succeeded */ }
    // Live duplicate-id self-check (see scanLiveDuplicateIds above) - runs automatically right after
    // every export so the real, current state of the page is visible here without opening DevTools.
    const dupCheck = scanLiveDuplicateIds();
    const diagEl = document.getElementById('pdfExportProgressDiag');
    const diagText = dupCheck.count === 0
      ? bt('Page check: no duplicate field ids detected.', '页面检查：未检测到重复的字段ID。')
      : bt(`Page check: ${dupCheck.count} duplicate id(s) still present - ${dupCheck.dupes.map(([id]) => id).join(', ')}`, `页面检查：仍存在 ${dupCheck.count} 个重复ID——${dupCheck.dupes.map(([id]) => id).join(', ')}`);
    if (diagEl) diagEl.textContent = diagText;
    console.log(`[Illuminate PDF] ${diagText}`, dupCheck.dupes);
    setTimeout(hidePdfExportProgress, dupCheck.count === 0 ? 900 : 4000);
    console.log('[Illuminate PDF] Save completed successfully.');
  } catch (err) {
    // DIAGNOSTIC: print the full cause chain as plain text too (not just the expandable Error object),
    // so the exact failing page/item/section is visible even without manually expanding anything in
    // DevTools - this is what every "Error during chunked export:" report so far has been missing.
    let chainMsg = err && err.message || String(err);
    let cur = err;
    while (cur && cur.cause) { cur = cur.cause; chainMsg += ' <- caused by: ' + (cur.message || String(cur)); }
    console.error('[Illuminate PDF] Error during chunked export:', chainMsg, err);
    hidePdfExportProgress();
    alert(bt(`PDF export failed - please try again.\n\nDetail: ${chainMsg}`, `PDF导出失败——请重试。\n\n详情：${chainMsg}`));
  } finally {
    if (container && document.body.contains(container)) document.body.removeChild(container);
  }
}

// Shared chunk-capture-and-assemble logic used by both exportProfileToPdf (saves directly) and
// buildProfilePdfBlob (returns a blob for the ZIP-all-profiles export) - same underlying fix, same
// canvas-size-limit constraint applies to both.
// Extracts a readable title for a top-level section, for use in the report's Table of Contents.
// Looks for the section's own heading (h1/h2) or pill label first, since these are the human-written
// titles this app already uses throughout - falls back to a trimmed snippet of the section's own
// text only if neither is present, so every entry still has SOME readable label.
// BUG FIX (found via visual inspection of an actual exported PDF): jsPDF's standard fonts (Helvetica
// etc.) only support Latin/WinAnsi characters - any CJK character passed to jsPDF's native .text()
// method renders as garbled mojibake (confirmed directly: "Ming Li (T}t - Destiny Analysis)" instead
// of the intended "Ming Li (命理 - Destiny Analysis)"). This only affects the Table of Contents,
// which uses jsPDF's native text rendering for a crisp, selectable TOC - the actual content pages
// remain html2canvas-captured images, which render Chinese characters correctly since they're pixels,
// not font glyphs. Strips non-Latin characters specifically for the TOC label, leaving the section's
// own image (where the Chinese renders fine) as the authoritative, correctly-rendered version.
// Shared, module-level counter for generating guaranteed-unique element ids during PDF export -
// used by exportProfileToPdf's main container, buildProfilePdfBlob's main container, and every
// per-section clone inside captureChunksIntoPdf. A counter local to each function call resets to 0
// every time that function runs, which does not guarantee uniqueness if calls from different export
// paths ever overlap in the DOM at the same time (e.g. a ZIP export looping across several
// profiles). A single counter that persists for the page's entire lifetime removes that risk
// entirely, regardless of how many export calls happen or how they're sequenced.
let __pdfExportUidCounter = 0;

function toAsciiSafeLabel(text) {
  let t = text.replace(/[^\x00-\x7F]+/g, '');
  // Remove parenthetical groups with no letters at all (pure symbol/CJK-remnant groups, e.g. a
  // title that was JUST "(命理)" with nothing else inside the parens)
  t = t.replace(/\([^)]*\)/g, (match) => /[A-Za-z]/.test(match) ? match : '');
  // Within remaining groups, strip any leading punctuation-only remnant right after '(' - e.g. the
  // CJK words are gone but a separator that sat between two CJK terms (like ' - ' or '/') survived
  t = t.replace(/\(\s*[^A-Za-z()]+/g, '(');
  t = t.replace(/\s{2,}/g, ' ').replace(/\s*-\s*$/, '').trim();
  return t;
}

function extractSectionTitle(node, index) {
  if (!node || !node.querySelector) return null;
  const heading = node.querySelector('h1, h2, .section-header, .pill, .section-summary');
  // BUG FIX (reported: "why is there a line item on content page that is 'LW Liang Jie Roy Wong Male
  // Age 50...'" / "...This is a rule-based reading generated from your own chart's computed...' / etc):
  // this used to fall back to the section's ENTIRE text content when no heading element was found - for
  // the profile overview card (banner + tiles, no heading at all), the Detailed Reading disclaimer box,
  // and the Life/Business Partner compatibility deep-analysis content (each their own loose top-level
  // node, not wrapped by wrapSectionCollapsible() the way the ~15 main tab sections are), that produced
  // a garbled, truncated sentence of body text standing in as a "section title" in the Table of
  // Contents - confusing and, worse, not actually describing what's on that page (the REAL heading for
  // each of these already exists, either inside the node's own preceding <h2> sibling, which already
  // gets its own correct TOC row, or is simply not a "chapter" the TOC needs to list at all). Rather
  // than inventing a fallback title from arbitrary body text, a node with no real heading now returns
  // null and is skipped entirely by the TOC-building loop below - it's still fully present and paginated
  // in the report itself, it just doesn't get its own (previously nonsensical) Table of Contents row.
  if (!heading) return null;
  const MAX_TOC_TITLE_LENGTH = 70;
  const text = (heading.textContent || '').trim();
  const truncated = text.length > MAX_TOC_TITLE_LENGTH ? text.slice(0, MAX_TOC_TITLE_LENGTH).trim() + '...' : text;
  const asciiSafe = toAsciiSafeLabel(truncated);
  return asciiSafe || null;
}

// BUG FIX (reported: "some of the contents are still truncated based on the page breaks"): the
// previous approach captured large groups of sections as one tall canvas, then sliced that canvas
// into A4-page-sized pieces at purely arbitrary pixel boundaries - with no awareness of where actual
// content (a paragraph, a table row, a heading) began or ended, a line of text or a table row could
// land exactly on a slice boundary and be cut visually in half between two pages.
// Rewritten to capture each top-level SECTION as its own separate, self-contained image first, then
// lay sections onto pages so that a section only gets split across a page boundary if it is, by
// itself, taller than one entire page (rare) - the common case (a section shorter than a page) is
// never split at all, it simply starts on whichever page has room for it as a whole unit. This also
// enables a real Table of Contents, built from each section's own title and its final page number,
// placed at the front of the document like a formal report - requested directly, and something the
// previous single-stream approach had no natural way to support anyway, since it had no per-section
// boundaries to reference.
// FOLLOW-UP FIX (found via visual inspection of an actual exported PDF): a section individually
// taller than one page was STILL being sliced at arbitrary pixel boundaries within its own canvas,
// confirmed directly - a sentence was cut mid-word between two pages. Rather than slice the flat,
// already-rendered image (which has no concept of where a line or sentence ends), an oversized
// section is now recursively broken down into ITS OWN direct children first, and those are laid out
// using the exact same "pack without splitting unless necessary" logic used for top-level sections -
// so the split, when one is still unavoidable, happens between two DOM elements (e.g. between two
// bullet points) rather than through the middle of one.
// ============================================================================================
// NATIVE-TEXT PDF WRITER (new, additive - does not replace or modify the existing screenshot-based
// export path above/below this block, which remains fully functional while this is developed and
// verified). Requested directly: "regenerate a full output based on the engines rather than trying
// to obtain from the screens... you can manipulate the text, page breaks, etc better and will look
// more professional." This writes PDF content using jsPDF's own native text/drawing methods,
// working directly from this app's underlying data (the same raw data generateDeepAnalysisData
// already computes, exposed via its new rawOnly parameter - see that change above), rather than
// screenshotting rendered HTML. This fixes, at the root rather than by further patching, every one
// of the following reported problems with the screenshot approach: blurry text (native text is
// always crisp, at any zoom/print level, since it's real vector glyphs, not a raster image),
// awkward page breaks splitting a section mid-way (this writer tracks exact remaining vertical
// space and decides page breaks itself, the same way word processors do), and wasted blank space
// (native text occupies exactly the height its content needs, not a fixed screenshot box height).
// ============================================================================================

// Brand colors, reused from the header/footer drawing code above, kept in one place.
const PDF_COLOR_GOLD = [184, 134, 53];
const PDF_COLOR_PLUM = [92, 52, 91];
const PDF_COLOR_MUTED = [105, 115, 134];
const PDF_COLOR_INK = [24, 32, 48];
const PDF_COLOR_SUCCESS = [46, 125, 50];
const PDF_COLOR_WARNING = [237, 108, 2];
const PDF_COLOR_DANGER = [155, 49, 49];

// Creates a stateful writer around a jsPDF document: tracks the current vertical cursor position
// and automatically starts a new page whenever the next piece of content would not fit in the
// remaining space, rather than ever letting content spill past the page's own bottom margin -
// the direct fix for "sections are breaking due to page breaks" (a section that doesn't fit is
// moved to a fresh page as a whole unit wherever practical; a page is only ever broken alongside a
// component's own natural top, not through its middle at some arbitrary screenshot-height limit).
function createPdfWriter(pdfDoc, opts) {
  const MARGIN_MM = opts.marginMM, PAGE_W_MM = opts.pageWMM, PAGE_H_MM = opts.pageHMM;
  const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2;
  const CONTENT_TOP_MM = MARGIN_MM + opts.headerHMM;
  const CONTENT_BOTTOM_MM = PAGE_H_MM - MARGIN_MM - opts.footerHMM;

  const w = {
    doc: pdfDoc,
    marginMM: MARGIN_MM, contentWMM: CONTENT_W_MM, contentTopMM: CONTENT_TOP_MM, contentBottomMM: CONTENT_BOTTOM_MM,
    y: CONTENT_TOP_MM,
    pageCount: 1,

    // Starts a new page and resets the cursor to the top of its content area - callers rarely need
    // this directly; ensureSpace() below calls it automatically when needed.
    newPage() {
      w.doc.addPage();
      w.pageCount++;
      w.y = CONTENT_TOP_MM;
    },

    // The core page-break decision: if the next block of content (needMM tall) would not fit in
    // the vertical space remaining on the current page, start a fresh page first. Called before
    // drawing every distinct piece of content (a line of text, a tile row, a rule) - never in the
    // middle of one - so a break can only ever land BETWEEN two things, never through one.
    ensureSpace(needMM) {
      if (w.y + needMM > CONTENT_BOTTOM_MM) w.newPage();
    },

    // Records the page a section started on (0-indexed among content pages), for the Table of
    // Contents to reference later once TOC page count is known.
    markSectionStart(sectionStartPageArr, sectionIndex) {
      sectionStartPageArr[sectionIndex] = w.pageCount - 1;
    },

    setColor(rgb) { w.doc.setTextColor(rgb[0], rgb[1], rgb[2]); },

    // A section title: bold, plum, with a thin gold rule beneath - matches this app's own visual
    // language (see the section-header CSS class) rather than looking like a generic default.
    addSectionHeader(text) {
      w.ensureSpace(14);
      w.doc.setFont('helvetica', 'bold');
      w.doc.setFontSize(14);
      w.setColor(PDF_COLOR_PLUM);
      w.doc.text(text, MARGIN_MM, w.y + 5);
      w.y += 7;
      w.doc.setDrawColor(PDF_COLOR_GOLD[0], PDF_COLOR_GOLD[1], PDF_COLOR_GOLD[2]);
      w.doc.setLineWidth(0.3);
      w.doc.line(MARGIN_MM, w.y, MARGIN_MM + CONTENT_W_MM, w.y);
      w.y += 5;
      w.setColor(PDF_COLOR_INK);
    },

    // A smaller sub-heading (e.g. a pill label like "Ming Li Natal Chart"), bold, in a slightly
    // smaller/darker treatment than a full section header.
    addSubHeader(text) {
      w.ensureSpace(8);
      w.doc.setFont('helvetica', 'bold');
      w.doc.setFontSize(11);
      w.setColor(PDF_COLOR_PLUM);
      w.doc.text(text, MARGIN_MM, w.y + 4);
      w.y += 8;
      w.setColor(PDF_COLOR_INK);
    },

    // Wrapped body text at a given size/weight/color - the workhorse used for nearly everything
    // (Characteristics/Explanation/Traits paragraphs, calc-box notes, etc). Wraps via jsPDF's own
    // splitTextToSize (accounts for the real, current font when measuring, unlike a fixed guess),
    // and checks remaining space before EVERY individual line, so a break can only ever fall
    // between two lines, never through the middle of one.
    addParagraph(text, opt = {}) {
      if (!text) return;
      const fontSize = opt.fontSize || 9;
      const bold = !!opt.bold;
      const color = opt.color || PDF_COLOR_INK;
      const indentMM = opt.indentMM || 0;
      w.doc.setFont('helvetica', bold ? 'bold' : 'normal');
      w.doc.setFontSize(fontSize);
      const lineHMM = fontSize * 0.42;
      const lines = w.doc.splitTextToSize(text, CONTENT_W_MM - indentMM);
      w.setColor(color);
      lines.forEach(line => {
        w.ensureSpace(lineHMM);
        w.doc.text(line, MARGIN_MM + indentMM, w.y + lineHMM * 0.8);
        w.y += lineHMM;
      });
      w.setColor(PDF_COLOR_INK);
      w.y += 1.5;
    },

    // A bulleted list - each item can itself wrap across multiple lines; every line (not just
    // every item) is checked against remaining space individually, for the same reason as above.
    addBulletList(items, opt = {}) {
      if (!items || !items.length) return;
      const fontSize = opt.fontSize || 9;
      const color = opt.color || PDF_COLOR_INK;
      w.doc.setFont('helvetica', 'normal');
      w.doc.setFontSize(fontSize);
      const lineHMM = fontSize * 0.42;
      const bulletIndentMM = 4;
      w.setColor(color);
      items.forEach(item => {
        const lines = w.doc.splitTextToSize(String(item), CONTENT_W_MM - bulletIndentMM);
        lines.forEach((line, i) => {
          w.ensureSpace(lineHMM);
          const prefix = i === 0 ? '\u2022 ' : '  ';
          w.doc.text(prefix + line, MARGIN_MM, w.y + lineHMM * 0.8);
          w.y += lineHMM;
        });
      });
      w.setColor(PDF_COLOR_INK);
      w.y += 1.5;
    },

    // Vertical breathing room between unrelated blocks.
    addSpacer(mm) { w.y += mm; },

    // A thin horizontal divider, e.g. between an article's sections.
    addDivider() {
      w.ensureSpace(4);
      w.doc.setDrawColor(222, 216, 205); // var(--line)
      w.doc.setLineWidth(0.2);
      w.doc.line(MARGIN_MM, w.y, MARGIN_MM + CONTENT_W_MM, w.y);
      w.y += 4;
    },

    // A simple label/value info box (this app's "calc-box" pattern) - a left gold-bordered,
    // sand-tinted block. Renders as a background rect sized to the wrapped text, THEN the text on
    // top - the whole block is kept together on one page whenever it reasonably can be (measured
    // first, via a dry-run line count, before committing to draw it).
    addCalcBox(text, opt = {}) {
      if (!text) return;
      const fontSize = opt.fontSize || 9;
      w.doc.setFont('helvetica', 'normal');
      w.doc.setFontSize(fontSize);
      const padMM = 3;
      const lineHMM = fontSize * 0.42;
      const lines = w.doc.splitTextToSize(text, CONTENT_W_MM - padMM * 2 - 2);
      const boxHMM = lines.length * lineHMM + padMM * 2;
      w.ensureSpace(boxHMM);
      w.doc.setFillColor(245, 243, 236); // var(--sand)-ish tint used by calc-box in the live app
      w.doc.setDrawColor(PDF_COLOR_GOLD[0], PDF_COLOR_GOLD[1], PDF_COLOR_GOLD[2]);
      w.doc.setLineWidth(0.8);
      w.doc.line(MARGIN_MM, w.y, MARGIN_MM, w.y + boxHMM); // left accent bar, matches calc-box CSS
      w.doc.rect(MARGIN_MM, w.y, CONTENT_W_MM, boxHMM, 'F');
      w.setColor(PDF_COLOR_INK);
      let ly = w.y + padMM;
      lines.forEach(line => {
        w.doc.text(line, MARGIN_MM + padMM + 1, ly + lineHMM * 0.8);
        ly += lineHMM;
      });
      w.y += boxHMM + 2;
    },

    // A 2-column grid of small label/value tiles (this app's overview-tile pattern - Lunar Birth,
    // Bone Weight, Life Expectancy, etc). Each tile's own height is measured from its actual
    // wrapped value text first, and a fresh ROW only starts a new page if it doesn't fit - never
    // splitting a single tile's own label+value across a page boundary.
    addTileGrid(tiles, opt = {}) {
      if (!tiles || !tiles.length) return;
      const cols = opt.columns || 2;
      const gapMM = 3;
      const colWMM = (CONTENT_W_MM - gapMM * (cols - 1)) / cols;
      const padMM = 2.5;
      for (let i = 0; i < tiles.length; i += cols) {
        const rowTiles = tiles.slice(i, i + cols);
        w.doc.setFont('helvetica', 'normal'); w.doc.setFontSize(7);
        const labelLineHMM = 7 * 0.42;
        w.doc.setFont('helvetica', 'bold'); w.doc.setFontSize(9);
        const valueLineHMM = 9 * 0.42;
        // Measure every tile in this row first, so the row height is the tallest tile's height.
        const rowHeights = rowTiles.map(t => {
          w.doc.setFont('helvetica', 'bold'); w.doc.setFontSize(9);
          const valueLines = w.doc.splitTextToSize(String(t.value), colWMM - padMM * 2);
          return padMM * 2 + labelLineHMM + valueLines.length * valueLineHMM + 1;
        });
        const rowHMM = Math.max(...rowHeights);
        w.ensureSpace(rowHMM);
        rowTiles.forEach((t, ci) => {
          const x = MARGIN_MM + ci * (colWMM + gapMM);
          w.doc.setDrawColor(222, 216, 205);
          w.doc.setLineWidth(0.2);
          w.doc.roundedRect(x, w.y, colWMM, rowHMM, 1.5, 1.5, 'S');
          w.doc.setFont('helvetica', 'normal'); w.doc.setFontSize(7);
          w.setColor(PDF_COLOR_MUTED);
          w.doc.text(String(t.label).toUpperCase(), x + padMM, w.y + padMM + labelLineHMM * 0.8);
          w.doc.setFont('helvetica', 'bold'); w.doc.setFontSize(9);
          w.setColor(PDF_COLOR_PLUM);
          const valueLines = w.doc.splitTextToSize(String(t.value), colWMM - padMM * 2);
          let vy = w.y + padMM + labelLineHMM + valueLineHMM;
          valueLines.forEach(line => { w.doc.text(line, x + padMM, vy); vy += valueLineHMM; });
        });
        w.y += rowHMM + gapMM;
      }
      w.setColor(PDF_COLOR_INK);
      w.y += 1.5;
    },

    // A simple table: header row (grey background, bold) + data rows, equal-width columns. Used
    // for the BaZi four-pillar layout and similar grid data. A ROW is the unit that stays together
    // (never splitting a single row's cell text across a page boundary); the header re-prints at
    // the top of a fresh page if the table itself spans more than one page.
    addTable(headers, rows, opt = {}) {
      if (!headers || !rows || !rows.length) return;
      const cols = headers.length;
      const colWMM = CONTENT_W_MM / cols;
      // Normalized to 9pt (was 8pt) so every text style produced by this native writer - paragraphs,
      // bullet lists, calc-boxes, and tables alike - shares the same explicit "size 9" baseline
      // requested for the PDF export, rather than tables alone rendering one point smaller.
      const fontSize = opt.fontSize || 9;
      const lineHMM = fontSize * 0.42;
      const padMM = 1.8;
      const drawHeader = () => {
        w.ensureSpace(lineHMM + padMM * 2);
        w.doc.setFillColor(241, 237, 227); // var(--sand)
        w.doc.rect(MARGIN_MM, w.y, CONTENT_W_MM, lineHMM + padMM * 2, 'F');
        w.doc.setFont('helvetica', 'bold'); w.doc.setFontSize(fontSize);
        w.setColor(PDF_COLOR_PLUM);
        headers.forEach((h, ci) => w.doc.text(String(h), MARGIN_MM + ci * colWMM + padMM, w.y + padMM + lineHMM * 0.8));
        w.y += lineHMM + padMM * 2;
      };
      drawHeader();
      rows.forEach(row => {
        w.doc.setFont('helvetica', 'normal'); w.doc.setFontSize(fontSize);
        const cellLines = row.map(cell => w.doc.splitTextToSize(String(cell), colWMM - padMM * 2));
        const rowLineCount = Math.max(...cellLines.map(l => l.length), 1);
        const rowHMM = rowLineCount * lineHMM + padMM * 2;
        if (w.y + rowHMM > CONTENT_BOTTOM_MM) { w.newPage(); drawHeader(); }
        w.doc.setDrawColor(222, 216, 205); w.doc.setLineWidth(0.15);
        w.doc.rect(MARGIN_MM, w.y, CONTENT_W_MM, rowHMM, 'S');
        w.setColor(PDF_COLOR_INK);
        cellLines.forEach((lines, ci) => {
          let cy = w.y + padMM + lineHMM * 0.8;
          lines.forEach(line => { w.doc.text(line, MARGIN_MM + ci * colWMM + padMM, cy); cy += lineHMM; });
        });
        w.y += rowHMM;
      });
      w.y += 2;
    },

    // Renders one full 7-part deep-analysis block (Characteristics / Explanation / Traits /
    // Highlights / Positives / Negatives / Cautions) from the RAW data object generateDeepAnalysisData
    // now returns (rawOnly=true) - this is the single highest-volume content pattern in the whole
    // report (used for every Da Yun cycle, every system's analysis, every compatibility profile).
    addDeepAnalysisBlock(raw) {
      if (!raw) return;
      w.addSubHeader('\ud83d\udd0d ' + (raw.title || ''));
      w.addParagraph((bt('1. Characteristics: ', '1. 特征：')) + raw.chars, { fontSize: 9 });
      w.addParagraph((bt('2. Explanation & Description of Findings: ', '2. 结果说明与描述：')) + raw.exp, { fontSize: 9 });
      w.addParagraph((bt('3. Traits of Findings: ', '3. 结果特点：')) + raw.traits, { fontSize: 9 });
      w.addParagraph(bt('4. Highlights:', '4. 重点：'), { fontSize: 9, bold: true, color: PDF_COLOR_PLUM });
      w.addBulletList(raw.hl, { fontSize: 9, color: PDF_COLOR_PLUM });
      w.addParagraph(bt('5. Positives:', '5. 优势：'), { fontSize: 9, bold: true, color: PDF_COLOR_SUCCESS });
      w.addBulletList(raw.pos, { fontSize: 9, color: PDF_COLOR_SUCCESS });
      w.addParagraph(bt('6. Negatives:', '6. 局限：'), { fontSize: 9, bold: true, color: PDF_COLOR_WARNING });
      w.addBulletList(raw.neg, { fontSize: 9, color: PDF_COLOR_WARNING });
      w.addParagraph(bt('7. Cautions:', '7. 注意事项：'), { fontSize: 9, bold: true, color: PDF_COLOR_DANGER });
      w.addBulletList(raw.cau, { fontSize: 9, color: PDF_COLOR_DANGER });
      w.addSpacer(2);
    },
  };
  return w;
}

// BUG FIX (reported directly: "text truncation in the page breaks" / "truncation between word...
// between pages" - root-caused against a real export, pulled directly from the user's own Downloads
// folder and inspected pixel-by-pixel: the "Business Partner Strategic Alignment Profile" card (an
// ordinary, non-table Deep Analysis box, captured as ONE big leaf canvas since its own content doesn't
// meet any of the table/grid row-splitting shortcuts above) had its "3. Traits of Findings" paragraph
// sliced clean through the middle of a text line's own row height. The line's main body (its x-height
// and ascenders) fit entirely within one page's slice and rendered there looking complete - but the
// line's descenders (the tails of letters like g/y/p/j/q, which extend a few pixels BELOW where the
// slice cut) were left behind and rendered again at the very top of the next page, as a thin, isolated,
// orphaned sliver with a visible gap before the next real line - reading exactly like a word torn in
// half across the page break. This is the exact same class of bug already fixed for tables
// (noMidSlice, see expandIntoCaptureUnits and its own BUG FIX comment above) - a raw pixel slice has no
// idea where a line of text ends - but it can strike ANY sufficiently tall non-table content this
// function's slicing loop below ever has to cut through, not just tables, so noMidSlice's "never slice
// this at all" approach doesn't fit here (ordinary paragraph content is too common and too small a
// concern PER SLICE to always force onto a fresh page - only the exact CUT POINT needs to be smarter).
// FIX: findSafeSliceCutPx snaps a computed cut point backward (never forward, so a slice can only ever
// end up SHORTER than originally computed, never longer or displaced later - this cannot reintroduce
// any leftover-room-reuse or orphan-heading bug already fixed elsewhere in this function) to the
// nearest row that is genuinely blank - no ink anywhere across the canvas's own width - within a
// generous search window below the computed cut. A blank row only ever sits BETWEEN two lines of text,
// list items, or paragraphs (never through the middle of one), so a cut snapped there can never orphan
// a line's descenders, split a bullet's dot from its text, or cut through the middle of any glyph. If no
// blank row is found within the search window (rare - only happens with unbroken, very dense content,
// or a slice already right at its hard capacity), the original computed cut point is used unchanged, so
// this can never make the function refuse to slice at all, only choose a marginally safer point when one
// is genuinely available nearby.
function findSafeSliceCutPx(canvas, desiredCutPx, minCutPx) {
  if (!(desiredCutPx > minCutPx) || typeof canvas.getContext !== 'function') return desiredCutPx;
  try {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const searchStart = Math.max(0, Math.floor(minCutPx));
    const searchRows = Math.ceil(desiredCutPx) - searchStart;
    if (searchRows <= 0 || w <= 0) return desiredCutPx;
    const data = ctx.getImageData(0, searchStart, w, searchRows).data;
    // Search backward (from the row closest to the desired cut, down toward minCutPx) so the FIRST
    // blank row found is also the one that keeps the slice as close to its originally-computed size as
    // possible - only shrinking it as much as is actually necessary to land on a safe row.
    for (let y = searchRows - 1; y >= 0; y--) {
      let rowHasInk = false;
      const rowStart = y * w * 4;
      for (let x = 0; x < w; x++) {
        const idx = rowStart + x * 4;
        // Luminance-based ink check: this app's box backgrounds (white/cream) and every text/border
        // color it uses are far enough apart on brightness alone that a plain luminance threshold is a
        // reliable, cheap way to tell "this row has content" from "this row is genuinely blank" without
        // needing to know the exact background color of whatever box this canvas happens to belong to.
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum < 180) { rowHasInk = true; break; }
      }
      if (!rowHasInk) return searchStart + y;
    }
  } catch (e) {
    // getImageData can throw on a tainted/cross-origin canvas in principle - fall back to the original
    // computed cut point exactly as if no blank row had been found, rather than letting this defensive
    // improvement ever break the export itself.
  }
  return desiredCutPx;
}

async function captureChunksIntoPdf(topLevelNodes, wrapperStyle, onProgress) {
  const MARGIN_MM = 10, PAGE_W_MM = 210, PAGE_H_MM = 297;
  // ENHANCEMENT (requested directly: "Add in headers with the App logo and suitable color
  // formatting. Add in footer to show page numbers"): every page reserves space at the top for a
  // repeating header (a small drawn logo mark plus the app name, in its own brand colors) and at the
  // bottom for a footer showing the page number - both applied in a single pass after all pages are
  // built, once the true total page count is known (needed for "Page X of Y"). Content height is
  // reduced accordingly so the header/footer never overlaps the actual page content.
  const HEADER_HEIGHT_MM = 14, FOOTER_HEIGHT_MM = 10;
  const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2;
  const CONTENT_H_MM = PAGE_H_MM - MARGIN_MM * 2 - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM;
  const CONTENT_TOP_MM = MARGIN_MM + HEADER_HEIGHT_MM;

  // BUG FIX (found via direct evidence, not speculation: extracted the raw JPEG images actually
  // embedded in a reported PDF and viewed them - the cropping was ALREADY present in the source
  // capture itself, not introduced by the PDF-assembly step, which further inspection confirmed was
  // placing images at mathematically correct coordinates and dimensions throughout).
  // Root cause: html2canvas's windowWidth option is documented and confirmed (multiple long-standing,
  // independent GitHub issues against the library) to NOT reliably override the browser's actual,
  // real viewport width for capture purposes in every case - the actual output canvas came back at
  // the real viewport's width regardless of windowWidth OR this container's own CSS width, confirmed
  // directly via this app's own diagnostic warning firing on real exports.
  // FOLLOW-UP FIX (reverted): restoring this to 800px did make text smaller, as intended - but it
  // also reintroduced the exact same left-crop bug from before, confirmed directly again by
  // rasterizing a reported PDF. This means the explicit `width` option (still kept below) helps but
  // does not fully override the real viewport when the requested width EXCEEDS it - only when it's
  // already narrower. That makes capture width a poor lever for controlling font size at all: any
  // value safely under the real viewport (this app's own native ~420px) risks nothing, but drives
  // text too large; anything wider risks the crop bug returning. These two concerns - "stay within
  // the real viewport" and "control the visual text size on the page" - are separated below instead:
  // capture width stays fixed at a safe, narrow value, and text size is controlled independently by
  // directly scaling every element's own font-size before capture (see the loop after cloning).
  // CSS-based scaling (zoom, transform:scale) was considered and rejected - both are independently
  // documented (multiple long-standing html2canvas GitHub issues) to cause content to be clipped or
  // entirely missed from the capture, the same class of bug already worked through above.
  const EXPORT_CAPTURE_WIDTH = 420;
  // ENHANCEMENT (reported: "very blurry fonts" on correctly-scaled text): a higher html2canvas scale
  // provides more actual source pixels for the same visual content - this does NOT change the
  // physical mm-size any text ends up at on the printed page (scale cancels out of that calculation:
  // canvas pixels grow by the same factor as pxPerMm, so heightMm = canvas.height / pxPerMm is
  // unaffected) - it only improves sharpness/resolution for a given size. Raised from 2 to 3; still
  // far under the browser's real canvas-size limits even for this app's tallest individual sections.
  const SCALE = 3;
  const pxPerMmAtCaptureWidth = (EXPORT_CAPTURE_WIDTH * SCALE) / CONTENT_W_MM;
  const onePageCapacityNaturalPx = (CONTENT_H_MM * pxPerMmAtCaptureWidth) / SCALE;

  // Pre-process: for any top-level section likely too tall to fit on one page, expand it into its
  // own direct children UPFRONT (one level), so each piece is captured and packed separately - any
  // split that's still needed happens BETWEEN two DOM elements (e.g. between two bullet points)
  // rather than through the middle of one, which is what the earlier pixel-slice fallback did and
  // is exactly what produced a sentence cut mid-word in a reported export. This is a fast estimate
  // on the live, un-cloned node (no capture needed yet); Pass 1 below still measures the real,
  // precise captured size for actual page-packing decisions.
  // FOLLOW-UP FIX: this threshold must be derived from the actual capture width above, not a fixed
  // guess - a narrower capture width means the same content wraps across more lines and grows taller
  // in natural pixels, AND one page's capacity in natural pixels also shrinks (fewer source pixels
  // needed to fill the same physical page). A threshold set for a different capture width would badly
  // under-count how many sections actually need pre-expansion.
  //
  // FOLLOW-UP FIX (reported directly, and visually confirmed in a real 54-page export: "still too much
  // white space and truncation of content between pages"): this used to gate pre-expansion at 90% of a
  // page's capacity and only ever split ONE level deep. Both of those were too conservative:
  //  - A section sized anywhere from roughly 40%-89% of a page stayed one atomic, non-splittable unit.
  //    PASS 2's packer (below) never splits a unit mid-way - if that unit doesn't fit in whatever space
  //    is left on the current page, the ENTIRE unit moves to a fresh page and the leftover space on the
  //    current page is stranded as blank. The reported PDF showed exactly this at two separate page
  //    transitions (each leaving 35-60% of a page blank) - both were single, mid-sized, multi-child
  //    sections that the old 90% gate left atomic. Lowering the gate to 45% lets sections in that range
  //    be broken into their own children too, giving the packer much finer-grained pieces to fit
  //    together and closing most of that stranded space.
  //  - Only expanding ONE level meant a section whose single DIRECT child was itself still oversized
  //    (e.g. one large wrapping <div> around a whole table) had nothing further to split - it fell
  //    through to PASS 2's raw pixel-slice fallback (for a unit that still, alone, exceeds a full
  //    page), which cuts through the middle of whatever pixel row it lands on with no regard for where
  //    a line or word ends. That is very likely the direct cause of the separately reported "truncation
  //    of content between pages": a mid-element pixel slice looks exactly like content being cut off.
  //    Expansion is now recursive (bounded to a few levels to avoid runaway recursion into deeply
  //    nested markup) - it keeps descending into a still-oversized child's own children, for as long as
  //    that child actually has more than one child to split into, so a real page-break landing point
  //    between two DOM elements is found wherever one exists, and the pixel-slice fallback is only ever
  //    reached for a genuinely unsplittable single element that alone exceeds a full page.
  const NATURAL_HEIGHT_SAFE_THRESHOLD = Math.floor(onePageCapacityNaturalPx * 0.45); // ~45% of one page's true capacity
  const MAX_EXPAND_DEPTH = 4; // safety cap - stops recursion from ever running away into deeply nested markup
  const captureUnits = []; // { node, sectionIndex, isFirstOfSection }
  const sectionHasEmittedFirst = [];
  // BUG FIX (reported: "bazi chart too big, should be 4 boxes side by side" - confirmed root cause by
  // reading this exact function). The BaZi 4-pillar chart (and any similar side-by-side layout in this
  // app) is a `display:grid;grid-template-columns:repeat(4,1fr)` container whose 4 pillar-card children
  // are meant to render side by side. Because that container's total height regularly exceeds the 45%
  // splitting threshold above, expandIntoCaptureUnits was recursing into its children and capturing
  // EACH PILLAR CARD AS ITS OWN INDEPENDENT IMAGE at the full EXPORT_CAPTURE_WIDTH - which is exactly
  // what turns "4 columns side by side" into "4 stacked full-width boxes" once each piece is packed
  // onto the page on its own. A grid/flex-row container's children are laid out horizontally by design,
  // so splitting them into separate capture units always destroys that layout regardless of height -
  // such a container must be captured as ONE atomic unit instead, exactly like the live in-app view.
  function isSideBySideLayoutContainer(node) {
    if (!node || node.nodeType !== 1 || typeof window === 'undefined' || !window.getComputedStyle) return false;
    const cs = window.getComputedStyle(node);
    if (cs.display === 'grid' || cs.display === 'inline-grid') return true;
    if ((cs.display === 'flex' || cs.display === 'inline-flex') && !String(cs.flexDirection || '').startsWith('column')) return true;
    return false;
  }
  // BUG FIX (reported directly: "Page 33 and 35 have the table truncated into the next page"). Root
  // cause confirmed by reading this exact function: every one of this app's real data tables is
  // written as `<div style="overflow-x:auto">...<table>...</table></div>` - a wrapper div with
  // EXACTLY ONE child. `canSplitFurther` below requires `children.length > 1`, so once recursion
  // reaches that wrapper div it can never split further (1 child) and the ENTIRE table - however many
  // rows tall - is pushed as a single atomic leaf capture unit. A table with enough rows regularly
  // exceeds a full page's capacity, and PASS 2's only fallback for an over-height leaf unit is a raw
  // top-to-bottom PIXEL slice at a fixed page-height offset, with no awareness of row boundaries -
  // slicing straight through the middle of whatever row happens to land on that boundary, which is
  // exactly what "truncated into the next page" describes.
  // FIX: detect a node whose entire content is a single `<table>` (recursing through any number of
  // single-child wrapper divs to find it) before falling through to the generic split-or-leaf logic.
  // Its own direct `<tr>` children (this app never wraps rows in `<thead>`/`<tbody>`) are read directly
  // off the live, rendered table, each row's OWN real height is measured individually (so a row whose
  // cell text happens to wrap to several lines is accounted for, not averaged away), and the rows are
  // packed into fresh, independent `<table>` clones - each carrying the original header row repeated
  // at its top plus a contiguous run of body rows sized to fit within one page. Every resulting chunk
  // is a normal, page-sized capture unit handled by the ordinary pipeline below, so a table can now
  // only ever break between two whole rows, never through one.
  // BUG FIX (reported directly, using the attached PDF export as evidence: "PDF section breaks should
  // be flexible and not deadlocked... some of the sections have header at the bottom of the page and
  // content on next page"). Visually inspecting that export page-by-page found the concrete instance:
  // the natal QMDJ 9-palace grid (a `.qimen-grid-v2` CSS Grid, one of the "side by side" layouts this
  // function deliberately keeps atomic via isSideBySideLayoutContainer, per the earlier "4 BaZi pillars
  // stacked instead of side by side" fix) is taller than one full page for a typical profile, so it has
  // no choice but to be split somewhere - but being atomic, it fell straight through to the raw,
  // row-blind pixel-slice fallback at a fixed page-height offset, cutting straight through the middle
  // of a palace row (visible in the export as a row's cells getting divided across the page break).
  // That earlier fix was right to keep a side-by-side container from being split into individually
  // stacked full-width children (which would destroy the intended horizontal layout entirely), but a
  // CSS Grid specifically has real internal row boundaries that a pixel slice has no awareness of -
  // splitting BETWEEN whole grid rows (each row's own cells staying side by side, only the row-to-row
  // break becomes a page break) preserves the layout exactly as well as slicing one continuous grid did
  // for a single-row case, while finally giving the packer a real, content-aware break point for a
  // multi-row grid taller than a page - the same "flexible break, not deadlocked mid-content" fix the
  // report is asking for, just for a grid's rows rather than a table's.
  function splitGridIntoRowChunks(node, colCount, capacityNaturalPx) {
    const children = Array.from(node.children);
    if (colCount <= 0 || children.length <= colCount) return [node]; // already a single row - nothing to split between
    const rows = [];
    for (let i = 0; i < children.length; i += colCount) rows.push(children.slice(i, i + colCount));
    const rowHeight = (row) => Math.max(0, ...row.map(c => c.getBoundingClientRect().height));
    const chunks = [];
    let current = [], currentH = 0;
    rows.forEach(row => {
      const rh = rowHeight(row);
      if (current.length && currentH + rh > capacityNaturalPx) { chunks.push(current); current = []; currentH = 0; }
      current.push(row); currentH += rh;
    });
    if (current.length) chunks.push(current);
    if (chunks.length <= 1) return [node]; // splitting didn't actually help - stay atomic (rare: one oversized row)
    return chunks.map(rowGroup => {
      // Shallow clone keeps the grid's own class/style (grid-template-columns, gap, etc.), so every
      // chunk lays its own rows out identically to how the live, unsplit grid would.
      const fresh = node.cloneNode(false);
      rowGroup.forEach(rowChildren => rowChildren.forEach(c => fresh.appendChild(c.cloneNode(true))));
      return fresh;
    });
  }
  function findSoleTable(node) {
    if (!node || node.nodeType !== 1) return null;
    if (node.tagName === 'TABLE') return node;
    if (node.children && node.children.length === 1) return findSoleTable(node.children[0]);
    return null;
  }
  function splitTableIntoRowChunks(tableNode, capacityNaturalPx) {
    const rows = Array.from(tableNode.children).filter(c => c.tagName === 'TR');
    if (rows.length <= 1) return [tableNode]; // no separate header + body rows to split between
    const headerRow = rows[0]; // every one of this app's tables opens with one <tr> of <th> cells
    const bodyRows = rows.slice(1);
    const headerHeight = headerRow.getBoundingClientRect().height;
    const chunks = [];
    let current = [], currentH = headerHeight;
    bodyRows.forEach(row => {
      const rh = row.getBoundingClientRect().height;
      if (current.length && currentH + rh > capacityNaturalPx) {
        chunks.push(current); current = []; currentH = headerHeight;
      }
      current.push(row); currentH += rh;
    });
    if (current.length) chunks.push(current);
    return chunks.map(chunkRows => {
      // Shallow clone keeps the original table's own tagName/style/attributes (column widths, borders,
      // font, border-collapse, etc. all come from that, so every chunk looks identical to the live
      // table) while starting with no rows of its own.
      const freshTable = tableNode.cloneNode(false);
      freshTable.appendChild(headerRow.cloneNode(true));
      chunkRows.forEach(r => freshTable.appendChild(r.cloneNode(true)));
      return freshTable;
    });
  }
  function expandIntoCaptureUnits(node, sectionIndex, depth) {
    const naturalHeight = node.getBoundingClientRect().height;
    // BUG FIX (found via direct evidence from the new PDF-diagnostics instrumentation: the alert
    // itself named the exact failure - "Failed assembling page 36/78, item 7/7 (section 11):
    // degenerate canvas size 1260x0"). Root cause: this function had no guard against a genuinely
    // EMPTY node - one whose real, live height is 0 (a conditionally-empty wrapper <div> that some
    // profile's data leaves with nothing inside, e.g. a sub-section that only renders content for
    // certain chart types/inputs). Such a node still fell through to the `else` branch below and was
    // pushed as its own capture unit; html2canvas then dutifully captured it at its real 0px height,
    // producing a 1260x0 canvas that PASS 3's defensive check correctly detected and reported, but
    // nothing upstream ever prevented - so the whole export still failed outright over a section with
    // nothing to show. A zero-height node contributes nothing to the page and should never become a
    // capture unit at all - skipped entirely here, before either the split-further or leaf path.
    if (naturalHeight <= 0) return;
    // BUG FIX (reported directly, confirmed via a real headless-browser reproduction of the exact
    // "Business Partner Alignment" section from the user's own PDF export: the section's heading and
    // its "...Reading" pill label were stranded at the bottom of one page with the entire deep-analysis
    // content pushed to the next). Root cause: every split/leaf decision below required
    // `node.children.length > 1` (or, for the table shortcut, was hand-rolled per call site via
    // findSoleTable's own recursion), but wrapSectionCollapsible's own body wrapper
    // (`.section-details-body`) almost always has EXACTLY ONE child - the section's single
    // `<article class="reading">...</article>` - because every section in this app wraps its whole
    // content in one such article. That single-child gate stopped the split one level too early: the
    // body wrapper (and therefore its entire subtree - pill label, summary box, and the full multi-part
    // deep analysis alike) became ONE un-splittable leaf, forcing PASS 2's raw, content-blind pixel
    // slice straight through it wherever the page happened to run out of room - landing just below the
    // pill label in the reported case (and, since a pixel slice has no idea where a word/sentence ends
    // either, this is very likely the same root cause behind the separately re-reported
    // "truncation/contents split across words at page breaks").
    // FIX: transparently unwrap through any chain of single-child wrapper nodes UP FRONT, before any of
    // the split-or-leaf decisions below (findSoleTable already did its own bespoke version of this, just
    // for tables specifically - this generalizes the same idea to every check in this function, so a
    // grid/table wrapped one level deeper than before is still found, and a plain content wrapper like
    // `.section-details-body` no longer masks the real, multi-child content node underneath it - e.g.
    // buildDeepAnalysisContentHTML's own container, which has 8+ children, one per numbered item, giving
    // PASS 1/2 real, content-aware break points instead of an arbitrary pixel offset). A capture unit
    // that ends up a leaf is still pushed as the ORIGINAL `node` (never `effectiveNode`), so nothing
    // about what's actually captured/positioned changes outside of this - only how deep the split
    // decision is allowed to look before giving up. Capped separately from MAX_EXPAND_DEPTH (a handful
    // of wrapper hops costs nothing - there's no real content or split boundary at a single-child
    // wrapper) so genuine content depth isn't stolen by however many plain wrapper divs happen to sit
    // above a section's real content this round.
    let effectiveNode = node;
    let unwrapSteps = 0;
    while (unwrapSteps < 10 && effectiveNode.children && effectiveNode.children.length === 1 && effectiveNode.children[0].nodeType === 1) {
      effectiveNode = effectiveNode.children[0];
      unwrapSteps += 1;
    }
    if (naturalHeight > NATURAL_HEIGHT_SAFE_THRESHOLD) {
      const soleTable = findSoleTable(effectiveNode);
      if (soleTable && soleTable.querySelector('tr')) {
        const tableChunks = splitTableIntoRowChunks(soleTable, onePageCapacityNaturalPx * 0.95);
        if (tableChunks.length > 1 || tableChunks[0] !== soleTable) {
          tableChunks.forEach(chunkTable => {
            const isFirstOfSection = !sectionHasEmittedFirst[sectionIndex];
            sectionHasEmittedFirst[sectionIndex] = true;
            // noMidSlice: this chunk is already a row-safe slice of a table (headers repeated, capped to
            // one page's worth of rows) - see the PASS 2 BUG FIX comment below for why this must never be
            // pixel-sliced again there.
            captureUnits.push({ node: chunkTable, sectionIndex, isFirstOfSection, noMidSlice: true });
          });
          return;
        }
      }
      // See splitGridIntoRowChunks' own comment above: a side-by-side CSS Grid too tall for one page
      // (e.g. the natal QMDJ 9-palace grid) gets split between whole rows instead of falling through to
      // the row-blind pixel-slice fallback. Only real `display:grid`/`inline-grid` containers qualify
      // (a flex row has no equivalent fixed "column count" to chunk by, so it's left exactly as before).
      // Checked against `effectiveNode` (see unwrap above) so a grid one level deeper than expected -
      // behind a single-child wrapper - is still found instead of silently falling through to a pixel
      // slice of the whole wrapper.
      if (isSideBySideLayoutContainer(effectiveNode) && typeof window !== 'undefined' && window.getComputedStyle) {
        const cs = window.getComputedStyle(effectiveNode);
        if (cs.display === 'grid' || cs.display === 'inline-grid') {
          const colCount = (cs.gridTemplateColumns || '').trim().split(/\s+/).filter(Boolean).length;
          const gridChunks = splitGridIntoRowChunks(effectiveNode, colCount, onePageCapacityNaturalPx * 0.95);
          if (gridChunks.length > 1) {
            gridChunks.forEach(chunkNode => {
              const isFirstOfSection = !sectionHasEmittedFirst[sectionIndex];
              sectionHasEmittedFirst[sectionIndex] = true;
              // noMidSlice: same reasoning as the table-chunk case above - this is already a row-safe
              // slice of a grid, and must never be pixel-sliced again in PASS 2.
              captureUnits.push({ node: chunkNode, sectionIndex, isFirstOfSection, noMidSlice: true });
            });
            return;
          }
        }
      }
    }
    // BUG FIX (secondary, found live alongside the offsetTop root cause above): this depth check used
    // to compare `depth` alone against MAX_EXPAND_DEPTH, but the unwrapSteps loop above silently walks
    // through up to 10 single-child wrapper levels WITHOUT counting against `depth` at all - so a node
    // wrapped in several such levels could recurse far deeper than MAX_EXPAND_DEPTH was meant to allow
    // before the cap was even checked. Folding `unwrapSteps` into the comparison (and into the depth
    // passed to the recursive call below) makes the cap apply to the effective depth actually reached,
    // not just the count of ordinary recursive calls.
    const canSplitFurther = (depth + unwrapSteps) < MAX_EXPAND_DEPTH && effectiveNode.children && effectiveNode.children.length > 1 && !isSideBySideLayoutContainer(effectiveNode);
    if (naturalHeight > NATURAL_HEIGHT_SAFE_THRESHOLD && canSplitFurther) {
      Array.from(effectiveNode.children).forEach(child => expandIntoCaptureUnits(child, sectionIndex, depth + unwrapSteps + 1));
    } else {
      // The first LEAF unit emitted for a given section, however deep the recursion went to reach it,
      // is the one that should be recorded as that section's start page in PASS 2 below.
      const isFirstOfSection = !sectionHasEmittedFirst[sectionIndex];
      sectionHasEmittedFirst[sectionIndex] = true;
      // BUG FIX (reported directly: "text truncation in the page breaks", root-caused against a real
      // export to the Zi Wei "Full Star Chart" table - its own height sits under
      // NATURAL_HEIGHT_SAFE_THRESHOLD, so it never goes through the row-aware splitTableIntoRowChunks
      // path above at all; it becomes one ordinary leaf capture unit, no different from a paragraph of
      // text). That's fine on its own, but PASS 2's leftover-room-reuse mechanism (see its own BUG FIX
      // comment below) can end up pixel-slicing this very unit when it shares a placement group with a
      // short heading and doesn't fit whatever room is left on the current page - a raw pixel slice has
      // no idea where a table row (or, in principle, a line of text) ends, and can cut straight through
      // one, which is exactly what was reported. FIX: a leaf unit that is, or contains, a `<table>` is
      // flagged here so PASS 2 knows never to pixel-slice it - only a table already split into row-safe
      // chunks above (which is marked noMidSlice at its own push site) is ever candidate for the
      // leftover-room slice, and even then it is never itself re-sliced, only placed as a whole chunk.
      const noMidSlice = !!(node.tagName === 'TABLE' || (node.querySelector && node.querySelector('table')));
      captureUnits.push({ node, sectionIndex, isFirstOfSection, noMidSlice });
    }
  }
  topLevelNodes.forEach((node, sectionIndex) => expandIntoCaptureUnits(node, sectionIndex, 0));

  // ENHANCEMENT (requested directly: "reduce font size further... use similar size as Arial size 9"):
  // scales every element's own resolved font-size (and padding, see below) down before capture,
  // applied directly to each element rather than via a CSS-level visual scale (zoom, transform:scale)
  // - both of those are independently documented, across multiple long-standing html2canvas GitHub
  // issues, to cause content to be clipped or entirely missed from the capture, which is exactly the
  // class of bug already fixed once in this function.
  // FOLLOW-UP FIX (reported: "still same large font sizes" - confirmed directly by extracting the
  // actual embedded image from a reported PDF: its width was exactly 840px, precisely matching the
  // intended EXPORT_CAPTURE_WIDTH*scale - meaning the earlier viewport-clipping bug is genuinely
  // fixed now, for the first time. That, in turn, revealed the ORIGINAL 0.6 value here was calculated
  // against a false baseline: every earlier "how big does 420px look" observation was unknowingly
  // taken from a viewport-CLIPPED capture (actually ~1588px wide, not 420px), which by accident
  // produced smaller-looking text than a genuine, correctly-working 420px capture ever would. Once
  // the real bug was fixed, the true, correct 420px capture turned out to need much more reduction
  // than 0.6 ever provided - confirmed by measuring the actual PDF's own embedded coordinates
  // directly (a banner element came out at 59mm tall at 0.6 - roughly 3x too large for a ~20mm
  // target). A second, separate factor also contributes: this app's info tiles carry substantial
  // fixed padding (10-12px) relative to their small text - scaling font-size alone leaves that
  // padding completely unshrunk, so padding is now scaled by the same factor alongside font-size.
  // FOLLOW-UP FIX (reported again: "current font size ... too small. resize the fonts to size 9
  // Arial font"): the RELATIVE multiplier above (0.35x of whatever each element's own original
  // font-size happened to be) never actually converges on a real "9pt" result - it just shrinks
  // every element by the same percentage, so elements that started small end up illegibly tiny while
  // elements that started large may still land nowhere near 9pt. Replaced with an ABSOLUTE target:
  // every exported text element is set to the SAME true, computed 9pt-equivalent pixel size (derived
  // below directly from this capture's real geometry - EXPORT_CAPTURE_WIDTH px maps onto
  // CONTENT_W_MM of actual printed page width - not guessed or eyeballed), with font-family forced to
  // Arial/Helvetica. 1pt = 25.4/72 mm; converting that to capture-pixels via the same px-per-mm ratio
  // the rest of this function already uses gives an exact, verifiable 9pt-Arial result throughout the
  // PDF, rather than a relative shrink that drifts per element.
  const TARGET_FONT_PT = 9;
  const MM_PER_PT = 25.4 / 72;
  const PX_PER_MM_AT_CAPTURE = EXPORT_CAPTURE_WIDTH / CONTENT_W_MM;
  const TARGET_FONT_PX = TARGET_FONT_PT * MM_PER_PT * PX_PER_MM_AT_CAPTURE;
  const EXPORT_FONT_FAMILY = 'Arial, Helvetica, sans-serif';

  // BUG FIX (reported: "too much blank space" in the PDF): wrapperStyle is the style of the ONE,
  // single live-page wrapper div that used to hold the whole report (it carries a `padding:20px`
  // meant to apply ONCE, around the outside of that entire wrapper). But this loop applies
  // wrapperStyle to a FRESH secContainer for every individual captured unit - potentially dozens of
  // them per export, since a tall section is pre-expanded into several child units above. That means
  // the same 20px top + 20px bottom padding was being baked into EVERY single one of those pieces,
  // not just once around the outside of the whole report. At this capture's own pixel-per-mm ratio
  // that is roughly 3mm of pure blank space above AND below every single piece - with dozens of
  // pieces in a typical multi-section profile report, that alone adds up to a large fraction of a
  // full page of nothing but padding, on top of the unavoidable per-page leftover space that comes
  // from packing variable-height pieces (see PASS 2 below). The PDF page's own MARGIN_MM already
  // provides the outer margin every page needs, so this per-unit padding is pure duplication -
  // stripped out here, applied to each unit's own container rather than left in wrapperStyle itself,
  // so a future caller that genuinely needs the padding (e.g. a live on-screen preview reusing the
  // same wrapperStyle) is unaffected.
  const wrapperStyleNoPadding = wrapperStyle.replace(/padding\s*:[^;]+;?/gi, '');

  // PERFORMANCE FIX (response to "PDF still not rendering in the background. Still have to wait 1 or 2
  // minutes"). A prior attempt at this same complaint (temporarily detaching every other document.body
  // child - the live app's whole visible UI - during the capture pass, on the theory that html2canvas's
  // per-call "document clone" cost scales with the live page's total DOM size) was built, but a direct,
  // controlled live A/B measurement against this app's own real running session DISPROVED that theory
  // before it shipped further: capturing one small test section took ~880-994ms whether the live
  // document around it held 3,575 nodes or only 9 - no meaningful difference. That detach/reattach was
  // initially kept anyway (reasoned to be "harmless"), on the assumption its only visible effect was
  // during an already-visible, user-triggered export. That assumption was WRONG, confirmed directly by
  // your own report right after this shipped: "upon load, the pdf rendering does not run in the
  // background. It is rendering on screen" - a BACKGROUND pre-render (buildProfilePdfBlob, no progress
  // overlay at all) was hiding your entire live app for the whole capture pass, since nothing was left
  // in document.body except (briefly) the tiny capture container - exactly the opposite of what
  // "background" is supposed to mean. REMOVED entirely: it had already been shown to provide zero real
  // performance benefit, so removing it costs nothing and fixes this regression outright. Your app's UI
  // now stays fully in place and visible throughout - both for a background pre-render (invisible, as
  // intended) and for a live, user-triggered export (only its own progress overlay appears on top, same
  // as before this round).
  // The REAL cause of the multi-minute wait, found the same way (direct, controlled measurement, not
  // guesswork): html2canvas/html2pdf pays a roughly CONSTANT ~700-1000ms of fixed overhead on every
  // single call to .toCanvas() - independent of both the live page's size and the captured content's own
  // size. A real multi-section report makes one such call per capture UNIT (this app's larger profiles
  // have on the order of 300-500 of them), so that fixed per-call cost alone - not the actual rendering
  // work - adds up to the exact multi-minute wait being reported (500 units x ~0.9s = ~7.5 minutes,
  // matching a separately-observed "still running after 8 minutes" case almost exactly).
  // FIX: batch several consecutive capture units into ONE shared container and issue ONE .toCanvas()
  // call for the whole batch, instead of one call per unit - confirmed directly, live, against this same
  // app: 10 small sections captured together in a single call took 684ms TOTAL (68ms/unit) versus
  // ~900ms EACH captured individually - roughly a 13x reduction in the fixed per-call cost that was
  // actually driving the wait. The single resulting canvas is then sliced back into one canvas per
  // original unit (using each member's own real, rendered offsetTop/offsetHeight within the shared
  // batch container, recorded right before the capture) - so every entry this pass produces in units[]
  // is pixel-identical in shape to what the old one-call-per-unit loop produced, and nothing in PASS 2 or
  // PASS 3 below (page-packing, orphan/label grouping, table/grid-row slicing, TOC, header/footer) needed
  // to change at all. Batches are capped both by a unit count (BATCH_MAX_UNITS) and by an estimated
  // natural-height budget (BATCH_MAX_NATURAL_PX, ~2 pages' worth) so a run of many small label/pill units
  // batches efficiently while a batch that happens to include a couple of near-full-page table/grid
  // chunks still produces a safely-sized canvas rather than growing unbounded. Each batchContainer is
  // still appended directly to document.body during its own capture (html2canvas needs it genuinely
  // rendered to measure/capture correctly) and removed again immediately after (see the try/finally
  // around each batch below) - it simply no longer displaces anything else already there.
  const BATCH_MAX_UNITS = 10;
  const BATCH_MAX_NATURAL_PX = onePageCapacityNaturalPx * 2;
  // Estimates a capture unit's pre-capture natural height for BATCH-SIZING purposes only (never used for
  // anything that affects final output - the real, exact height of every unit still comes from its own
  // actual rendered pixels after capture, below). Most units are still-attached nodes straight off the
  // live page at this point (expandIntoCaptureUnits runs before anything here is detached), so a real
  // getBoundingClientRect() works directly; the exception is a table/grid row-chunk (see
  // splitTableIntoRowChunks/splitGridIntoRowChunks above) - those are freshly built, detached clones, so
  // getBoundingClientRect() would read 0 for them. Every such chunk is already deliberately built to at
  // most ~95% of one page's own natural capacity when it's created, so that's used as a safe, known upper
  // bound instead of an actual measurement.
  function estimateNaturalHeightForBatching(node) {
    if (node && node.isConnected && node.getBoundingClientRect) {
      const h = node.getBoundingClientRect().height;
      if (h > 0) return h;
    }
    return onePageCapacityNaturalPx * 0.95;
  }

  // BUG FIX (see the fuller comment on __pdfBackgroundBuildActive above): called at every existing
  // yield point in the batch loop below. A no-op for a live export (it never sets
  // __pdfBackgroundBuildActive), so this can never abort the export the person is actually waiting on -
  // it only ever cuts short a BACKGROUND build that a live export has just overtaken.
  function abortIfLiveExportStarted() {
    if (__pdfBackgroundBuildActive && __pdfExportInFlight) {
      throw new Error('Background pre-render aborted - a live PDF export just started, freeing this content for it right away.');
    }
  }

  // PASS 1: capture units in batches (see PERFORMANCE FIX above) - each batch still yields exactly one
  // units[] entry per original capture unit, in the same order, so downstream logic is unaffected.
  const units = [];
  let i = 0;
  while (i < captureUnits.length) {
    abortIfLiveExportStarted();
    const batchMembers = [captureUnits[i]];
    let batchNaturalPx = estimateNaturalHeightForBatching(captureUnits[i].node);
    i += 1;
    while (i < captureUnits.length && batchMembers.length < BATCH_MAX_UNITS) {
      const nextH = estimateNaturalHeightForBatching(captureUnits[i].node);
      if (batchNaturalPx + nextH > BATCH_MAX_NATURAL_PX) break;
      batchMembers.push(captureUnits[i]);
      batchNaturalPx += nextH;
      i += 1;
    }
    // Progress feedback: this is the slow, dominant part of the whole export (one capture call per
    // BATCH of sections, each with small settling delays) - scaled to occupy roughly the 5%-85% range
    // of the overall progress bar, leaving room for the TOC/assembly work afterward.
    if (onProgress) onProgress(bt('Capturing section', '正在捕获章节') + ` ${Math.min(i, captureUnits.length)}/${captureUnits.length}`, 5 + (i / captureUnits.length) * 80);

    const batchContainer = document.createElement('div');
    // BUG FIX (root cause of a real, live-reproduced issue: "Generated PDF now only has 2 pages!").
    // memberBounds below reads each member's `offsetTop` to find its position WITHIN batchContainer,
    // but offsetTop/offsetParent only resets at the nearest ANCESTOR with a non-static CSS `position`
    // (per the DOM spec) - `display:flow-root` on secContainer does not count, and batchContainer
    // itself set no `position` either, so with no positioned ancestor anywhere, every member's
    // offsetTop resolved against <body> - i.e. its absolute position in the whole live page (tens of
    // thousands of px, since this container sits far down inside the live app's own rendered UI) -
    // instead of its small (0-500px) offset inside this tiny batchContainer. That huge, wrong offset
    // then hugely overshot the actual captured batchCanvas height, so the slicing math below clamped
    // nearly every unit's sliced height down to 1px, collapsing almost all real content out of the
    // exported PDF and leaving only a near-empty page or two. `position:relative` makes batchContainer
    // itself the positioned ancestor every member's offsetTop resolves against, so offsetTop is always
    // the small, correct offset within this container, regardless of where it happens to sit on the
    // live page. Live-verified: without this fix, a large real-scale export produced 2 pages with
    // member offsets up to ~74,000px against a ~1,500px batch canvas; with this fix, offsets stayed
    // under 500px (matching the container's own real height) and the same export produced 65 pages.
    batchContainer.style.cssText = `position:relative; width:${EXPORT_CAPTURE_WIDTH}px; background:#fff;`;
    const memberWrappers = [];
    batchMembers.forEach(({ node }) => {
      const secContainer = document.createElement('div');
      // `display:flow-root` establishes a new block-formatting context so this container's own
      // rendered box always fully contains its cloned child's margins (top-margin-collapsing between a
      // block parent and its first child, or bottom-margin with its last child, is a standard CSS
      // behavior that would otherwise let some of the now-scaled margin above/below escape outside
      // this element's own bounding box - unpredictable and not what html2canvas would then capture,
      // and would also throw off this element's own offsetHeight used for slicing below). This also
      // means secContainer's own external margin stays at its unset default of 0, so stacking several
      // of them as siblings inside batchContainer produces clean, tightly-adjacent offsetTop values
      // with no adjacent-sibling margin-collapsing to account for.
      secContainer.style.cssText = wrapperStyleNoPadding + `; padding:0; display:flow-root; width:${EXPORT_CAPTURE_WIDTH}px; background:#fff;`;
      const clonedNode = node.cloneNode(true);
      // BUG FIX (reported: "hundreds of errors on violating node" - hundreds of "Duplicate form field
      // id" browser warnings during export): the full, original content container stays in the DOM for
      // the ENTIRE export (it's only removed at the very end), while this loop also creates a separate
      // temporary container per section that clones content out of it. Since both the original and
      // each temporary clone briefly coexist in the DOM, any element with an id in the cloned section
      // (this app has several - Feng Shui direction selectors, household occupant fields, name-analysis
      // retained-character inputs, etc.) duplicates an id already present in the live original.
      // FOLLOW-UP FIX (reported: "still over 200 comments" - the duplicate-id warnings did disappear,
      // but simply removing every id outright traded them for two DIFFERENT warnings instead: "a form
      // field element should have an id or name attribute" and its related autocomplete warning, since
      // several of this app's form fields rely on id alone with no name attribute. Giving each stripped
      // element a fresh, guaranteed-unique id instead of no id at all avoids both the duplicate warning
      // AND the missing-id warning; autocomplete="off" is set alongside on actual form fields (input,
      // select, textarea) to address that warning too - none of this affects the static image capture
      // itself, since these are DOM/accessibility-level attributes with no visual rendering effect.
      // FOLLOW-UP FIX (reported: "Issues resurfaced" - duplicate-id warnings came back, 16 of them):
      // this loop previously used a counter LOCAL to this function call, resetting to 0 every time
      // captureChunksIntoPdf runs. Switched to the shared, module-level __pdfExportUidCounter (see its
      // declaration above) so every id generated anywhere in the export process, across every call, is
      // guaranteed unique for the page's entire lifetime - removing any possibility of two different
      // calls (or this loop and the two main-container fixes elsewhere) coincidentally landing on the
      // same counter value.
      if (clonedNode.querySelectorAll) {
        if (clonedNode.hasAttribute && clonedNode.hasAttribute('id')) clonedNode.setAttribute('id', `pdf-export-${__pdfExportUidCounter++}`);
        clonedNode.querySelectorAll('[id]').forEach(el => el.setAttribute('id', `pdf-export-${__pdfExportUidCounter++}`));
        clonedNode.querySelectorAll('input, select, textarea').forEach(el => el.setAttribute('autocomplete', 'off'));
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(clonedNode.tagName)) clonedNode.setAttribute('autocomplete', 'off');
      }
      secContainer.appendChild(clonedNode);
      batchContainer.appendChild(secContainer);
      memberWrappers.push(secContainer);
    });
    // Font-size scale-down (see FONT_SCALE comment above) - applied to the clone only, after it's
    // attached to the DOM (getComputedStyle needs a real, attached element to resolve inherited
    // sizes correctly), and before capture. Reads each element's own resolved size once, then sets
    // an explicit override, so inheritance is respected regardless of how the original CSS was
    // written (inline style, class, or inherited from an ancestor).
    // BUG FIX (reported: "font size became giant again" - confirmed directly, the reported export's
    // page count (158) matched the pre-scaling baseline almost exactly, meaning the scaling silently
    // never applied). Root cause: this loop ran BEFORE secContainer was appended to document.body -
    // attaching the clone to secContainer (itself still a detached, un-rendered element at that
    // point) is not the same as attaching it to the live document. getComputedStyle() on an element
    // that isn't yet part of the actual rendered document commonly returns empty or browser-default
    // values rather than the real, cascaded size in Chrome, since computed style requires layout,
    // which detached nodes never receive - parseFloat() on that then silently produces NaN, which
    // fails the `if (currentSize)` check below and skips scaling entirely, with no error raised
    // anywhere to reveal it. Moved to run AFTER document.body.appendChild(batchContainer), so every
    // member is genuinely part of the live, rendered document when its computed style is read.
    document.body.appendChild(batchContainer);
    // BUG FIX (reported: hundreds of lingering "duplicate id"/"missing id or name" DevTools Issues
    // persisting for the rest of the session, well after a report finished exporting - eventually
    // traced to this exact loop having no try/finally around it. If html2canvas ever rejects for a
    // single batch (a real possibility across dozens of batches in a large report), the `await` below
    // throws and every line after it - including the removeChild that cleans this batchContainer back
    // out of the DOM - never runs. That leaves a fully-formed clone of several whole report sections
    // (form fields and all) permanently stuck in the live document for the rest of the browser session,
    // which is exactly what shows up afterward as a wave of duplicate-id and missing-id/name Issues
    // that have nothing to do with the page's own normal markup. Wrapping the capture in try/finally
    // guarantees this container is removed whether or not its own capture succeeded, so one failed
    // batch can no longer contaminate the live DOM for everything after it.
    try {
    // BUG FIX (reported: "those with ok sizes have very blurry fonts, the rest are too tiny fonts" -
    // confirmed as a genuine bug in this scaling approach itself, not a display artifact). The
    // previous single-pass loop read each element's computed font-size AND immediately wrote its
    // scaled-down replacement before moving to the next element. Any element that INHERITS its
    // font-size from an ancestor (rather than specifying its own) would, by the time this loop
    // reached it, have its ancestor ALREADY scaled down - so getComputedStyle would report the
    // ancestor's new, already-shrunk size, and this element would get scaled down AGAIN on top of
    // that. Elements with their own explicit font-size were scaled correctly once (the "ok size but
    // blurry" ones - a single 0.35x reduction at a fixed capture resolution costs some sharpness);
    // elements inheriting from an ancestor got compounded, sometimes two or three scale-downs deep
    // depending on nesting (the "too tiny" ones). Fixed by splitting into two full passes: first
    // read and record EVERY element's original, real computed size with nothing modified yet, THEN
    // apply every scaled value afterward - so no element's own modification can ever influence what
    // a sibling or descendant reads. Now run once across the WHOLE batch container (every member's
    // elements together) rather than once per individual secContainer - same two-pass ordering, same
    // per-element math, just amortized across the batch like everything else in this pass.
    if (batchContainer.querySelectorAll && window.getComputedStyle) {
      const originalFontSizes = new Map();
      const originalPaddings = new Map();
      const originalMargins = new Map();
      const allEls = batchContainer.querySelectorAll('*');
      allEls.forEach(el => {
        const computed = window.getComputedStyle(el);
        originalFontSizes.set(el, parseFloat(computed.fontSize));
        originalPaddings.set(el, {
          top: parseFloat(computed.paddingTop), right: parseFloat(computed.paddingRight),
          bottom: parseFloat(computed.paddingBottom), left: parseFloat(computed.paddingLeft),
        });
        // BUG FIX (reported: "too much blank space" in the PDF): this loop has always scaled
        // font-size and padding down together, but never margin - even though this app's own CSS
        // leans on margin, not padding, for most of its spacing (e.g. .section-header's
        // `margin: 35px 0 15px`, .reading h3's `margin: 4px 0`). With text now correctly shrunk to a
        // true 9pt, those margins were still being captured at their full, un-shrunk on-screen pixel
        // size - so every section heading carried 35px of pure blank space above it and 15px below,
        // dwarfing the now-small 9pt text next to it. Captured here alongside padding so it can be
        // scaled by the same per-element ratio below.
        originalMargins.set(el, {
          top: parseFloat(computed.marginTop), right: parseFloat(computed.marginRight),
          bottom: parseFloat(computed.marginBottom), left: parseFloat(computed.marginLeft),
        });
      });
      allEls.forEach(el => {
        const size = originalFontSizes.get(el);
        // Padding and margin are both scaled RELATIVE to how much this element's own font-size
        // changed (rather than forced to one absolute value like the font-size itself) - this app's
        // tiles/boxes/headings carry spacing sized to go with their original text, and shrinking it
        // by that same element's own ratio keeps proportions looking natural instead of every element
        // suddenly sharing identical spacing regardless of how much its text size actually changed.
        const padScale = size ? (TARGET_FONT_PX / size) : 1;
        if (size) el.style.fontSize = TARGET_FONT_PX + 'px';
        el.style.fontFamily = EXPORT_FONT_FAMILY;
        const pad = originalPaddings.get(el);
        if (pad.top) el.style.paddingTop = (pad.top * padScale) + 'px';
        if (pad.right) el.style.paddingRight = (pad.right * padScale) + 'px';
        if (pad.bottom) el.style.paddingBottom = (pad.bottom * padScale) + 'px';
        if (pad.left) el.style.paddingLeft = (pad.left * padScale) + 'px';
        const mar = originalMargins.get(el);
        if (mar.top) el.style.marginTop = (mar.top * padScale) + 'px';
        if (mar.right) el.style.marginRight = (mar.right * padScale) + 'px';
        if (mar.bottom) el.style.marginBottom = (mar.bottom * padScale) + 'px';
        if (mar.left) el.style.marginLeft = (mar.left * padScale) + 'px';
      });
      // BUG FIX (reported, and confirmed by direct CSS inspection: a persistent left-crop, e.g. a
      // name banner showing only "Wong" instead of "Liang Jie Roy Wong"). Root cause found directly
      // in this app's own CSS: a flex container (the profile-overview name banner) whose text child
      // has no min-width set. Fixed directly at its source (see the min-width:0 + overflow-wrap fix
      // where the banner's HTML is built).
      // FOLLOW-UP FIX (reported: banner rendered completely blank - avatar circle and all text
      // missing entirely, confirmed directly by extracting the actual embedded image from a reported
      // PDF): the DEFENSIVE, export-wide version of the min-width fix that used to run here (applied
      // to every child of every flex container found anywhere in a section) was too blunt an
      // instrument - it also matched the profile-overview's own avatar circle (itself a small flex
      // container, used only to center its initials text), setting min-width:0 on elements it should
      // never have touched and causing them to collapse to zero visible width instead of just
      // allowing text to wrap as intended. Removed entirely - the one confirmed, real instance of
      // this bug (the name banner) is handled precisely at its own source instead, where the exact
      // element and correct fix (min-width:0 paired with overflow-wrap, so content wraps rather than
      // vanishing) can be verified directly, rather than applied blindly across arbitrary markup.
    }
    await new Promise(res => setTimeout(res, 30));
    abortIfLiveExportStarted();

    // Record each member's own rendered offset/height within the batch container AFTER scaling has
    // settled (so the slicing math below matches exactly what gets captured), and BEFORE the capture
    // call - read straight off the live, attached DOM, not guessed from the eventual canvas.
    const memberBounds = memberWrappers.map(w => ({ top: w.offsetTop, height: w.offsetHeight }));
    const containerCssHeight = batchContainer.scrollHeight;

    const batchCanvas = await new Promise((resolve, reject) => {
      // BUG FIX (reported: "blank pages" - confirmed directly, both by extracting a raw embedded
      // image from a reported PDF (completely blank white) and by this app's own diagnostic warning
      // firing on nearly every section: "captured at unexpected width: 1588px (expected ~840px)").
      // windowWidth only affects CSS media-query evaluation during layout, NOT the actual output
      // canvas size - confirmed directly here: changing the container's own CSS width and the
      // windowWidth option together (800px, then 420px) produced the identical ~1588px result both
      // times, meaning html2canvas was defaulting to the real browser viewport width regardless of
      // either setting. The `width` option is documented to set the actual output canvas size
      // directly (canvas pixel width = width x scale) - passed explicitly here rather than relying
      // on its "Element width" default, since that default is exactly what produced this bug.
      // BUG FIX (reported: left-crop persisting across MULTIPLE, structurally different elements -
      // confirmed directly by rasterizing a reported PDF: BOTH a flexbox banner AND a plain
      // text-align:center header block, sharing no CSS mechanism in common, showed the identical
      // "left portion missing" pattern. That rules out any CSS-layout explanation entirely - a bug
      // specific to one element's styling cannot explain the same symptom in a structurally
      // unrelated element. Root cause confirmed directly in html2canvas's own official documentation
      // this time (github.com/niklasvh/html2canvas/blob/master/docs/configuration.md): the `x`/`y`
      // options default to "Element x-offset"/"Element y-offset" - html2canvas crops its capture
      // starting from wherever it calculates the target element's position to be within the page,
      // not always from a hard 0. The same docs specifically call out `scrollX`/`scrollY` as needed
      // "if the Element uses position: fixed" elsewhere on the page - this app's new PDF-progress
      // overlay (shown for the whole duration of every export) is exactly such an element. Forcing
      // x/y/scrollX/scrollY to 0 removes any dependency on html2canvas's own offset calculation,
      // ensuring every capture starts at the true top-left of this batch's own content regardless
      // of what else is on the page or how it's scrolled.
      // NOTE: an x:0,y:0 override was tried and reverted earlier in this app's history - but that
      // was under a completely different, now-obsolete architecture, where the capture target was
      // deliberately positioned off-screen at a large NEGATIVE x-coordinate (position:fixed;
      // left:-9999px) to hide it from view during capture; forcing x:0 there would have pointed the
      // crop at an empty region of the page instead of where that off-screen content actually was.
      // This app has used genuine normal document flow (no special positioning at all) for many
      // fixes since then - this batchContainer's real x-offset is at or near 0 already, so forcing it
      // explicitly is safe and removes any dependency on html2canvas recalculating that itself.
      html2pdf().set({ html2canvas: { scale: SCALE, useCORS: true, width: EXPORT_CAPTURE_WIDTH, windowWidth: EXPORT_CAPTURE_WIDTH, x: 0, y: 0, scrollX: 0, scrollY: 0 } })
        .from(batchContainer).toCanvas().then(function () { resolve(this.prop.canvas); })
        .catch(reject);
    });
    // BUG FIX (found via visual inspection of an actual exported PDF, reported as "alignment is way
    // off" - confirmed by rasterizing actual pages: content shifted/cropped on the left, and some
    // pages showing only a small portion at the top with the rest blank). The browser console for
    // that same export also showed "The deferred DOM Node could not be resolved to a valid node" -
    // consistent with html2canvas's internal processing not having fully finished with this
    // container at the moment it gets removed from the DOM. A short pause AFTER the capture promise
    // resolves, before removal, gives any such lingering internal work time to settle.
    await new Promise(res => setTimeout(res, 20));
    abortIfLiveExportStarted();

    // Slice this one batch canvas back into one canvas per original unit, using each member's own
    // recorded CSS offset/height converted via the batch canvas's own ACTUAL pixel ratio (rather than
    // assuming SCALE exactly, in case html2canvas's own internal rounding nudges it slightly) - every
    // entry pushed to units[] below is the same shape a one-call-per-unit capture would have produced.
    const pxPerCssPxY = containerCssHeight > 0 ? (batchCanvas.height / containerCssHeight) : SCALE;
    // DIAGNOSTIC: the expected canvas width is EXPORT_CAPTURE_WIDTH x SCALE for every batch captured
    // this same way. If a specific batch's capture comes back significantly wider or narrower than
    // that, this flags exactly which one and by how much, rather than only knowing a mismatch exists
    // somewhere across dozens of separately-captured batches.
    const expectedWidth = EXPORT_CAPTURE_WIDTH * SCALE;
    if (Math.abs(batchCanvas.width - expectedWidth) > 50) {
      console.warn(`[Illuminate PDF] Batch starting at unit ${i - batchMembers.length} captured at unexpected width: ${batchCanvas.width}px (expected ~${expectedWidth}px) - height: ${batchCanvas.height}px. This batch's rendering may be misaligned in the final PDF.`);
    }
    batchMembers.forEach((unit, mi) => {
      const bounds = memberBounds[mi];
      const srcY = Math.max(0, Math.min(batchCanvas.height, Math.round(bounds.top * pxPerCssPxY)));
      const rawSrcH = Math.round(bounds.height * pxPerCssPxY);
      const srcH = Math.max(1, Math.min(rawSrcH, batchCanvas.height - srcY));
      const unitCanvas = document.createElement('canvas');
      unitCanvas.width = batchCanvas.width;
      unitCanvas.height = srcH;
      const ctx = unitCanvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, unitCanvas.width, unitCanvas.height);
      ctx.drawImage(batchCanvas, 0, srcY, batchCanvas.width, srcH, 0, 0, batchCanvas.width, srcH);
      const pxPerMm = unitCanvas.width / CONTENT_W_MM;
      units.push({ sectionIndex: unit.sectionIndex, isFirstOfSection: unit.isFirstOfSection, canvas: unitCanvas, pxPerMm, heightMm: unitCanvas.height / pxPerMm, noMidSlice: !!unit.noMidSlice });
    });
    } finally {
      // Always runs - on success AND on a thrown/rejected capture - so this batch's clones never
      // outlive their own iteration of the loop (see the BUG FIX note above appendChild). No longer
      // wrapped in an outer detach/reattach (removed - see the PERFORMANCE FIX comment above the loop):
      // this is now the only DOM cleanup this pass needs, same as it was before batching existed.
      if (document.body.contains(batchContainer)) document.body.removeChild(batchContainer);
    }
  }
  console.log(`[Illuminate PDF] Captured ${units.length} piece(s) across ${topLevelNodes.length} top-level section(s) - each piece stays on one page unless it alone still exceeds a full page's height.`);

  // BUG FIX (reported directly, at specific page numbers: "Label headers followed by white space with
  // contents on next page" - and "There should not be a situation when the labels appear and the
  // contents go on the next page. In such situations, the labels are to follow the contents to the
  // next page"). Root cause: a short heading/label unit (e.g. a bare section title with no body of its
  // own) is captured as its own independent unit, separate from whatever content follows it. If that
  // label alone still fits in a small amount of space left at the bottom of the current page, PASS 2
  // (below) placed it there - but the real content right after it often does NOT fit in that same
  // leftover space and moves to a fresh page, stranding the label alone with blank space beneath it and
  // pushing all of its actual content to the next page, exactly as reported.
  // FIX: any unit short enough to plausibly be a bare label/heading (LABEL_ORPHAN_MAX_MM) that is
  // immediately followed by another unit from the SAME section is grouped with it here, into one
  // placement group, PROVIDED the pair's combined height still fits within a single page - PASS 2 then
  // decides where the whole group goes as one atomic placement (both members fit here, or both move to
  // a fresh page together), so a label can never again be separated from the content that follows it.
  // FOLLOW-UP FIX (found via a real, evidence-backed re-diagnosis of a still-reported "pages 3, 5, 7,
  // 10, 11, 13, etc. have a lot of white space" issue - a real PDF was generated end-to-end in a real
  // headless browser this round specifically to get real page-by-page evidence rather than guess. Page
  // 3 of that real export showed only a short "Compatibility Score: 68%..." bullet box, alone, on an
  // otherwise 88%-blank page - immediately after page 2 ended with a "Compatibility Overview" heading
  // PLUS its own short "Life Partner Compatibility - Tina" pill label, themselves sitting atop ~20%
  // blank space of their own). Root cause: this loop only ever paired UP TO TWO consecutive short units
  // together (label+content) before moving on - it had no way to represent a CHAIN of more than one
  // short label in a row (here: a section heading followed immediately by its own pill sub-label)
  // followed by the real content all three belong together with. The old loop paired the heading with
  // the pill (both short, so `next` matched) and consumed both, leaving the actual content box to fend
  // for itself as a lone, ungrouped unit one step later - exactly reproducing the "label(s) stranded
  // with blank space, content orphaned onto the next page" pattern this fix was originally meant to
  // close, just one level deeper than the original 2-unit case covered. (A sibling section elsewhere in
  // the same report - Business Partner Compatibility, which has only ONE short pill before its content,
  // no separate heading - was already correctly grouped by the old code, confirming this gap is
  // specifically about chains of 2+ short units, not the mechanism as a whole.)
  // FIX: generalized from a fixed pair to a genuine chain - a group keeps pulling in the NEXT unit for
  // as long as the LAST unit already in the group is itself still short (a label/heading), the next
  // unit belongs to the same section, and the group's total height still fits one page. The moment a
  // real (non-short) content unit is pulled in, the chain stops growing (so this can never balloon into
  // merging multiple large blocks together) - which means any run of one or more short labels in a row
  // is now always glued to the one real content unit that follows them, however many labels deep.
  const LABEL_ORPHAN_MAX_MM = 18; // generous allowance for one heading/label line plus its own margin
  const placementGroups = [];
  for (let gi = 0; gi < units.length; ) {
    const members = [units[gi]];
    let totalHeightMm = units[gi].heightMm;
    let idx = gi;
    while (members[members.length - 1].heightMm <= LABEL_ORPHAN_MAX_MM) {
      const next = units[idx + 1];
      if (!next || next.sectionIndex !== units[gi].sectionIndex) break;
      const combined = totalHeightMm + next.heightMm;
      members.push(next);
      totalHeightMm = combined;
      idx += 1;
      // FOLLOW-UP FIX (Task #78, reported directly against a real export: "for example, Ming Li on
      // page 7 should go to next page, Cheng Gu Suan Ming on page 9 should go on the next page... In
      // such scenarios, white space is ok"). Root cause: this loop used to refuse to absorb `next` at
      // all once doing so would push the group's combined height over one full page (`if (combined >
      // CONTENT_H_MM) break` BEFORE the push) - correct for keeping the group "atomic" (placeable
      // whole), but for a section whose real content (e.g. the BaZi 4-pillar grid, or the Bone Weight
      // table) is simply too tall to ever share a page with its own heading, that left the heading as
      // its own tiny standalone group, free to be dropped wherever room happened to be on the CURRENT
      // page while the real content (now a separate unit) was pushed to a fresh page regardless -
      // stranding the heading exactly as reported. FIX: `next` is now absorbed into the group
      // regardless of whether combined height fits one page - the loop still stops growing right after
      // (a label chain only ever absorbs ONE real content unit, never more), and PASS 2 below now knows
      // how to place a group whose combined height exceeds a page: the label member(s) render first, in
      // full, then the final (real content) member is pixel-sliced across as many pages as it needs,
      // its first slice starting immediately under the label(s) rather than on a separate page. This is
      // what actually keeps the label attached to the start of its content in every case, not just the
      // ones that happened to fit one page together.
      if (combined > CONTENT_H_MM) break;
    }
    const isLabelOnly = members.every(m => m.heightMm <= LABEL_ORPHAN_MAX_MM);
    placementGroups.push({ members, totalHeightMm, isLabelOnly });
    gi = idx + 1;
  }

  // PASS 2: lay placement groups onto pages. A group that fits within a page's remaining space is
  // placed there as a single, uncut unit (or pair); if it doesn't fit on the current page but WOULD
  // fit on a fresh one, a new page starts and the whole group goes there instead - never split just
  // because the current page happened to already have some content on it. A group whose total height
  // exceeds one whole page - either a lone unit individually too tall (rare, even after the
  // pre-expansion above), or (Task #78) a label chain now forced to absorb a real content member too
  // tall to share a page with it (see PASS 1 above) - falls back to a pixel slice on its final member,
  // with any earlier (label) members rendered first, in full, directly above that slice.
  const pages = [];
  let currentPage = [], currentUsedMm = 0;
  const sectionStartPage = [];
  placementGroups.forEach((group, groupIdx) => {
    // BUG FIX (reported directly against a real export, page 11 as an example: the "Cheng Gu Suan Ming"
    // heading + its small calc-box sitting alone atop an otherwise ~85%-blank page, with the section's
    // real content - info rows, Fate Tier, Bone Weight Deep Analysis - pushed entirely to the next page).
    // Root cause: this "fits" branch only ever asked "does this group fit inside a page at all?" - if a
    // group's own total height fits within one whole page but NOT within whatever room happens to be left
    // on the CURRENT page (because the immediately preceding group, e.g. a short heading, just used some
    // of it), the old code did the simplest thing: discard the leftover room entirely and place the WHOLE
    // group fresh on the next page. That's the right call when the leftover room is only a sliver not
    // worth using anyway, but when a generous amount of room (>= MIN_FIRST_SLICE_MM, the same 70mm bar
    // used everywhere else in this function) is sitting unused, discarding it wholesale reproduces the
    // exact "heading stranded above a mostly-blank page" pattern this file has already fixed multiple
    // times before - just reached via a different path, because the "fits" branch never had the
    // leftover-room-reusing pixel-slice mechanism the "oversized" branch below already has. FIX: a group
    // whose own total fits one page, but not the CURRENT leftover room, is now routed into that same
    // slicing branch instead of being flushed wholesale whenever the leftover room is worth reusing - its
    // first slice fills out the remaining room on this page and the rest continues directly onto the next
    // page, so the section's own content starts right where its heading left off rather than on a
    // completely fresh page with all that room wasted. (When the group's members are all individually
    // small - the common case - the slicing branch degrades gracefully to placing them whole, exactly as
    // the "fits" branch always did, since nothing needs to be cut mid-unit.) A group that genuinely
    // doesn't fit any better this way (leftover room too small to bother with) still simply flushes to a
    // fresh page exactly as before - this can only ever recover currently-wasted space, never remove any
    // content or change how a page that already had enough room behaves.
    const MIN_FIRST_SLICE_MM_LOOKAHEAD = 70; // matches MIN_FIRST_SLICE_MM declared in both branches below
    const fitsCurrentRoomMm = currentUsedMm + group.totalHeightMm <= CONTENT_H_MM;
    const leftoverRoomMmForGroup = CONTENT_H_MM - currentUsedMm;
    // BUG FIX (reported directly: "text truncation in the page breaks" - root-caused against a real
    // export to the Zi Wei "Full Star Chart" table, which sat under NATURAL_HEIGHT_SAFE_THRESHOLD on its
    // own and so was never row-split further up; it is one ordinary leaf unit, same as a paragraph of
    // text). The leftover-room-reuse routing just above can slice whatever ends up as a group's final
    // member - fine for free-flowing content, but a raw pixel slice has no idea where a table row ends,
    // and slicing straight through this table's own canvas is exactly what produced the reported garbled,
    // duplicated-looking row split across a page break. FIX: a group is only routed into the
    // leftover-room-reusing slice mechanism when its final member is safe to slice this way
    // (`!noMidSlice`) - a table (or an already row/grid-split chunk) is never a candidate for this routing
    // and instead falls back to the original, always-safe behavior of moving to a fresh page whole.
    const lastMemberNoMidSlice = !!group.members[group.members.length - 1].noMidSlice;
    const worthReusingLeftoverForOverflow = !fitsCurrentRoomMm && group.totalHeightMm <= CONTENT_H_MM &&
      currentUsedMm > 0 && leftoverRoomMmForGroup >= MIN_FIRST_SLICE_MM_LOOKAHEAD && !lastMemberNoMidSlice;
    if (group.totalHeightMm <= CONTENT_H_MM && !worthReusingLeftoverForOverflow) {
      if (currentUsedMm > 0 && currentUsedMm + group.totalHeightMm > CONTENT_H_MM) {
        pages.push(currentPage); currentPage = []; currentUsedMm = 0;
      }
      // BUG FIX (reported directly against a real export, page 9: "Cheng Gu Suan Ming at the bottom of
      // the page and the details on the next page. Such scenarios should not happen and should be
      // prioritized over space efficiency"). Root cause: this branch only ever asked "does THIS group
      // fit in whatever room is left on the current page?" - it never looked ahead to whether the SAME
      // section's next placement group (its real body content) would also fit afterward. A short
      // heading + one small absorbed box (see PASS 1 above) can easily fit in a small leftover space at
      // the bottom of a page on its own, even though the section's real content right after it - now a
      // separate, later placement group - is far too tall for whatever sliver of room is left once the
      // heading is placed, and moves to a fresh page regardless. That's a heading stranded with mostly
      // blank space beneath it, exactly as reported, just reached via this "fits" branch rather than the
      // oversized/slice branch the same failure mode was already fixed for elsewhere. FIX: when the very
      // next placement group belongs to the SAME section as this one, and placing this group here would
      // leave less than MIN_FIRST_SLICE_MM of room afterward - not enough to also make a meaningful start
      // on that next group - the whole current group is deferred to a fresh page instead, so the section
      // starts together with (or at least followed immediately by) a real amount of its own content,
      // never just its bare heading. This can only ever push MORE content to a later page, never less.
      // (MIN_FIRST_SLICE_MM is declared locally here, matching its other declaration further down in the
      // oversized/slice branch below - kept as two small, identical declarations rather than one hoisted
      // one so each branch's own code stays a self-contained, independently-extractable block, the same
      // shape this file's own test suite already relies on to test each branch directly against the real
      // shipped source rather than a reimplementation of it.)
      const MIN_FIRST_SLICE_MM = 70;
      const nextGroup = placementGroups[groupIdx + 1];
      const sameSectionFollows = nextGroup && nextGroup.members[0].sectionIndex === group.members[group.members.length - 1].sectionIndex;
      const roomAfterGroupMm = CONTENT_H_MM - (currentUsedMm + group.totalHeightMm);
      if (currentUsedMm > 0 && sameSectionFollows && roomAfterGroupMm < MIN_FIRST_SLICE_MM) {
        pages.push(currentPage); currentPage = []; currentUsedMm = 0;
      }
      group.members.forEach(u => {
        if (u.isFirstOfSection) sectionStartPage[u.sectionIndex] = pages.length;
        // DIAGNOSTIC (reported: "PDF export failed" alert with no usable detail behind it - the outer
        // catch only ever saw a generic wrapped error with no indication of WHICH page/section it
        // happened on): sectionIndex is now carried through into each page item, so PASS 3 below can
        // report exactly which section/page it was assembling at the moment of any future failure,
        // instead of only the final, already-wrapped "Error during chunked export" message.
        currentPage.push({ canvas: u.canvas, srcYPx: 0, srcHPx: u.canvas.height, drawYMm: currentUsedMm, heightMm: u.heightMm, pxPerMm: u.pxPerMm, sectionIndex: u.sectionIndex });
        currentUsedMm += u.heightMm;
      });
    } else {
      // FOLLOW-UP FIX (Task #78): a group can now reach this oversized/slice branch with MORE than one
      // member - a short label/heading chain that PASS 1 above deliberately absorbed its real content
      // into even though the combined height exceeds a page (see PASS 1's comment). Every member except
      // the last is the label chain itself and is tiny by construction (each <= LABEL_ORPHAN_MAX_MM) -
      // those render first, in full, exactly like the "fits" branch above; only the FINAL member (the
      // real content that was too tall to share a page with its own label) is pixel-sliced. This is what
      // actually keeps a label directly attached to the start of its content: the content's first slice
      // starts immediately below the label(s) on the same page, using whatever room they left, instead
      // of on a separate page. A single-member group (the original, pre-Task-#78 case - a lone unit
      // individually taller than a page) takes labelMembers.length === 0 and behaves exactly as before.
      const labelMembers = group.members.slice(0, -1);
      const u = group.members[group.members.length - 1];
      // BUG FIX (reported directly against a real export, using the attached PDF as evidence: "page 4,
      // ming li should go on next page for better read... Readability should be prioritized over blank
      // spaces"). The reported page showed exactly the case this threshold controls: the "Ming Li"
      // section's heading (plus its short "BaZi Natal Chart" pill label) was placed on the current page
      // because a small amount of leftover room happened to be available there, and the real content's
      // first slice was squeezed into that same small leftover space - but since the real content was far
      // taller than that leftover room, the resulting first slice showed only a thin, barely-readable
      // sliver of it, with most of the page still blank beneath and the rest of the content pushed to the
      // next page anyway. The old 15mm bar for "worth reusing this leftover room" was far too low - 15mm
      // is only ~6% of a page's own content height, nowhere near enough to show a genuinely readable
      // first slice. Raised to a generous 70mm (~28% of a page): both the label-placement decision above
      // and the first-slice sizing below now only reuse leftover room when there's enough of it left to
      // show something actually worth reading there - otherwise the whole label+content-start moves
      // together to a fresh page instead, exactly matching "readability over blank space". This can only
      // ever push MORE content onto fresh pages (never less), so it cannot reintroduce any of the
      // mid-content truncation/orphan bugs this same mechanism was originally built to fix.
      // (This round: the "fits on this page" branch above now declares and uses this exact same
      // threshold too, for the same reason - see its own BUG FIX comment - kept as its own separate
      // local declaration there rather than sharing this one; see that comment for why.)
      const MIN_FIRST_SLICE_MM = 70;
      if (labelMembers.length) {
        const labelsHeightMm = labelMembers.reduce((s, m) => s + m.heightMm, 0);
        // The label chain always renders as one unit directly above its content's first slice. It's
        // flushed to a fresh page first, before either member is placed, when either (a) it doesn't fit
        // in whatever room is left on the CURRENT page at all, or (b) it WOULD fit, but would leave less
        // than MIN_FIRST_SLICE_MM of room afterward for the content's own first slice - placing the
        // labels there anyway would just strand them exactly as reported (a short heading with a big
        // blank gap beneath it, content starting fresh on the very next page regardless), so the whole
        // label+content-start is deferred together instead.
        const roomAfterLabelsMm = CONTENT_H_MM - (currentUsedMm + labelsHeightMm);
        const wouldStrandLabels = currentUsedMm > 0 && roomAfterLabelsMm >= 0 && roomAfterLabelsMm < MIN_FIRST_SLICE_MM;
        const labelsDontFitAtAll = currentUsedMm > 0 && currentUsedMm + labelsHeightMm > CONTENT_H_MM;
        if (labelsDontFitAtAll || wouldStrandLabels) {
          pages.push(currentPage); currentPage = []; currentUsedMm = 0;
        }
        labelMembers.forEach(m => {
          if (m.isFirstOfSection) sectionStartPage[m.sectionIndex] = pages.length;
          currentPage.push({ canvas: m.canvas, srcYPx: 0, srcHPx: m.canvas.height, drawYMm: currentUsedMm, heightMm: m.heightMm, pxPerMm: m.pxPerMm, sectionIndex: m.sectionIndex });
          currentUsedMm += m.heightMm;
        });
      }
      // FOLLOW-UP FIX (found via a real, evidence-backed re-diagnosis this round - a real PDF was
      // generated end-to-end in a real headless browser specifically to get real page-by-page ink
      // coverage, rather than guess. Several still-reported near-blank pages, e.g. a "3-Year Monthly
      // Western Astrology Match" label + a short intro callout sitting alone on an otherwise ~85%-blank
      // page, traced to this exact spot): this branch always force-flushed whatever room was left on
      // the CURRENT page before starting an oversized unit's first slice - even when a decent amount of
      // room (say, a third of a page) was sitting unused, because a short label+intro group had just
      // been placed and left real space behind. The first slice of a big table/analysis block never
      // even tried to use that leftover room; it always started fresh at the top of a new page instead.
      // FIX: the first slice's own height cap is now whatever room is actually left on the current page
      // (when that's at least MIN_FIRST_SLICE_MM - a small sliver isn't worth a slice, since a
      // one-line fragment above a page break reads worse than a clean break) - every slice after the
      // first still fills a full page exactly as before, so this only ever recovers currently-wasted
      // space, and never changes how any later slice is sized or where the header/footer/margins sit.
      // (Task #78: this same leftover-room mechanism is now what lets the content's first slice start
      // directly beneath its own label(s) above, when there are any - currentUsedMm already includes
      // their height by this point. MIN_FIRST_SLICE_MM itself is declared above, shared with the
      // label-flush decision, so both use exactly the same "not worth a sliver" threshold.)
      const sliceCapPx = Math.floor(CONTENT_H_MM * u.pxPerMm);
      const leftoverRoomMm = CONTENT_H_MM - currentUsedMm;
      const useLeftoverRoom = currentUsedMm > 0 && leftoverRoomMm >= MIN_FIRST_SLICE_MM;
      if (currentUsedMm > 0 && !useLeftoverRoom) { pages.push(currentPage); currentPage = []; currentUsedMm = 0; }
      if (u.isFirstOfSection) sectionStartPage[u.sectionIndex] = pages.length;
      let remainingPx = u.canvas.height, srcYPx = 0;
      const firstSliceCapPx = useLeftoverRoom ? Math.floor(leftoverRoomMm * u.pxPerMm) : sliceCapPx;
      let isFirstSlice = true;
      // BUG FIX (reported directly: "a lot of white space everywhere between sections" - confirmed via
      // the real exported PDF, which showed several pages that were almost entirely blank apart from a
      // single small header/pill floating at the top). Root cause: every slice of an oversized unit -
      // including its LAST, often much-shorter-than-a-full-page slice - unconditionally force-flushed
      // the current page and started a brand new one for whatever came next. That stranded whatever
      // space was left on the last slice's page as pure blank space, even when the very next unit was
      // small enough to easily share it. Only the FIRST 1..N-1 slices need to force a fresh page (they
      // exactly fill one page each, by construction of sliceCapPx) - the final slice now behaves like
      // any other unit: it leaves the page open (tracked via currentUsedMm) so later, smaller units can
      // keep packing into the remaining space, and only forces a new page if it happened to fill this
      // one almost exactly.
      while (remainingPx > 0) {
        const capPx = isFirstSlice ? firstSliceCapPx : sliceCapPx;
        let sliceHPx = Math.min(capPx, remainingPx);
        // BUG FIX (reported: "truncation between words" / "text truncation in the page breaks" - see
        // findSafeSliceCutPx's own BUG FIX comment above for the full root cause). Only applies when
        // this slice doesn't already consume everything remaining (i.e., a real cut is about to happen
        // here, with more content continuing after it) - the slice that finishes a unit off always ends
        // exactly at that unit's own natural end, which is never a mid-line cut by construction. The
        // search is capped at 40% of this slice's own computed size, so even in the worst case (no blank
        // row found anywhere reasonable) the slice can never shrink to something degenerately small.
        if (sliceHPx < remainingPx) {
          const desiredCutPx = srcYPx + sliceHPx;
          const minCutPx = srcYPx + Math.floor(sliceHPx * 0.6);
          const safeCutPx = findSafeSliceCutPx(u.canvas, desiredCutPx, minCutPx);
          if (safeCutPx > srcYPx) sliceHPx = safeCutPx - srcYPx;
        }
        const sliceHMm = sliceHPx / u.pxPerMm;
        currentPage.push({ canvas: u.canvas, srcYPx, srcHPx: sliceHPx, drawYMm: currentUsedMm, heightMm: sliceHMm, pxPerMm: u.pxPerMm, sectionIndex: u.sectionIndex });
        srcYPx += sliceHPx; remainingPx -= sliceHPx;
        isFirstSlice = false;
        if (remainingPx > 0) {
          pages.push(currentPage); currentPage = []; currentUsedMm = 0;
        } else {
          currentUsedMm += sliceHMm;
          if (currentUsedMm >= CONTENT_H_MM - 0.5) { pages.push(currentPage); currentPage = []; currentUsedMm = 0; }
        }
      }
    }
  });
  if (currentPage.length) pages.push(currentPage);

  // PASS 3: compute the Table of Contents' own page count, then build the full report - TOC pages
  // first, then every content page, with each TOC entry's page number correctly offset by however
  // many TOC pages precede the actual content.
  const TOC_ENTRIES_PER_PAGE = 38;
  // BUG FIX (reported: bogus/garbled TOC line items): tocEntries is now built ONCE here, up front, by
  // resolving every top-level node's title and dropping the ones with no real heading (extractSectionTitle
  // now returns null for those - see its own comment) - rather than assuming every topLevelNode gets a
  // printed row. tocPageCount is sized from this actual, already-filtered list.
  const tocEntries = [];
  topLevelNodes.forEach((node, idx) => {
    const title = extractSectionTitle(node, idx);
    if (title) tocEntries.push({ title, sourceIndex: idx });
  });

  // ENHANCEMENT (this round): group the Table of Contents by category (Core Charts / Timing &
  // Forecasts / Feng Shui & Environment / Compatibility) instead of one flat list, for reports with
  // enough sections that a flat list is hard to scan. Categorization is a simple bilingual-safe
  // substring match against each entry's already-extracted title (extractSectionTitle has already
  // stripped/truncated/ASCII-safed it by this point). Grouping headers are only actually rendered
  // when more than one category is non-empty - a short/simple report where every section happens to
  // land in one bucket renders exactly as a flat list, unchanged, so grouping never adds noise.
  // IMPORTANT: this only changes the TOC's own presentation (which lines are printed on the TOC
  // pages) - it never touches sectionStartPage lookups, page order, or which page any real content
  // lands on.
  const TOC_CATEGORIES = [
    { key: 'compat', labelEn: 'Compatibility', labelZh: '契合度分析', test: t => /compatibility|契合度|family summary|家庭概览|household occupants|家庭住户/i.test(t) },
    { key: 'timing', labelEn: 'Timing & Forecasts', labelZh: '流年运程', test: t => /da\s*yun|大运|forecast|预测|ze\s*ri|择日|lottery|彩票|numerology|数字命理/i.test(t) },
    { key: 'fengshui', labelEn: 'Feng Shui & Environment', labelZh: '风水与环境', test: t => /feng\s*shui|风水|flying\s*star|飞星|ba\s*zhai|八宅|personal assets|个人资产/i.test(t) },
    { key: 'core', labelEn: 'Core Charts', labelZh: '核心命盘', test: () => true } // catch-all/default
  ];
  const categorize = (title) => TOC_CATEGORIES.find(c => c.test(title)) || TOC_CATEGORIES[TOC_CATEGORIES.length - 1];
  const groupedByCategory = new Map();
  tocEntries.forEach(entry => {
    const cat = categorize(entry.title);
    if (!groupedByCategory.has(cat.key)) groupedByCategory.set(cat.key, { cat, entries: [] });
    groupedByCategory.get(cat.key).entries.push(entry);
  });
  const nonEmptyGroups = TOC_CATEGORIES.map(c => groupedByCategory.get(c.key)).filter(Boolean);
  const useGrouping = nonEmptyGroups.length > 1;
  const tocLines = [];
  if (useGrouping) {
    nonEmptyGroups.forEach(g => {
      tocLines.push({ type: 'category', label: bt(g.cat.labelEn, g.cat.labelZh) });
      g.entries.forEach(entry => tocLines.push({ type: 'entry', title: entry.title, sourceIndex: entry.sourceIndex }));
    });
  } else {
    tocEntries.forEach(entry => tocLines.push({ type: 'entry', title: entry.title, sourceIndex: entry.sourceIndex }));
  }
  const tocPageCount = Math.max(1, Math.ceil(tocLines.length / TOC_ENTRIES_PER_PAGE));

  // BUG FIX v2 (the v1 "fresh instance via extracted constructor" fix caused a NEW, confirmed error:
  // "pdfDoc.setFont is not a function" - meaning throwawayPdf.constructor did not actually yield a
  // usable jsPDF class, contrary to what that fix assumed). Reverting to the approach proven to work
  // correctly in an earlier, successful 61-page export (checkpoint 45): get the jsPDF instance by
  // passing REAL content (this report's first content page) through html2pdf's own .toPdf() step,
  // rather than a synthetic placeholder of any kind - every attempt to substitute a placeholder here
  // (a tiny seed canvas, then a constructor-derived empty instance) has produced a new failure mode.
  // To still satisfy "Table of Contents first, like a report": build every content page first
  // (starting from page 1, using the real first page as the seed as before), THEN append the TOC
  // pages after all of them, THEN use jsPDF's own documented, verified movePage(targetPage,
  // beforePage) API (confirmed directly from jsPDF's own source - moves the page currently at
  // targetPage to position beforePage) to shift the TOC pages to the front in order. This keeps the
  // one part that has actually worked (real content as the seed) while still delivering TOC-first
  // ordering through a standard, documented jsPDF operation rather than another unproven shortcut.
  if (pages.length === 0) throw new Error('No content pages to build a report from.');
  if (onProgress) onProgress(bt('Assembling pages...', '正在组合页面……'), 88);
  let pdfDoc = null;
  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const pageItems = pages[pIdx];
    const firstItem = pageItems[0];
    // DIAGNOSTIC (reported: "PDF export failed - please try again" with no further detail reaching
    // the console): every risky step in this per-page assembly loop (canvas creation, 2D context
    // acquisition, drawImage, toDataURL, addImage/addPage) is now wrapped so that if any of them ever
    // throws, the error re-thrown up to the outer catch (app.js's exportProfileToPdf) names exactly
    // which page, which item on that page, and which section it was assembling at the time - instead
    // of only the generic, already-wrapped "Error during chunked export" message this project has
    // twice now had to ask you to expand in DevTools before a real diagnosis was possible.
    try {
      const firstSliceCanvas = document.createElement('canvas');
      firstSliceCanvas.width = firstItem.canvas.width;
      firstSliceCanvas.height = firstItem.srcHPx;
      if (!firstSliceCanvas.width || !firstSliceCanvas.height) {
        throw new Error(`degenerate canvas size ${firstSliceCanvas.width}x${firstSliceCanvas.height}`);
      }
      const firstCtx = firstSliceCanvas.getContext('2d');
      if (!firstCtx) throw new Error('getContext(\'2d\') returned null (browser may be out of canvas/GPU memory)');
      firstCtx.fillStyle = '#fff';
      firstCtx.fillRect(0, 0, firstSliceCanvas.width, firstSliceCanvas.height);
      firstCtx.drawImage(firstItem.canvas, 0, firstItem.srcYPx, firstItem.canvas.width, firstItem.srcHPx, 0, 0, firstItem.canvas.width, firstItem.srcHPx);

      if (!pdfDoc) {
        pdfDoc = await new Promise((resolve, reject) => {
          html2pdf().set({ margin: [CONTENT_TOP_MM, MARGIN_MM, MARGIN_MM + FOOTER_HEIGHT_MM, MARGIN_MM], jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } })
            .from(firstSliceCanvas, 'canvas').toPdf().then(function () { resolve(this.prop.pdf); })
            .catch(reject);
        });
      } else {
        pdfDoc.addPage();
        const imgData = firstSliceCanvas.toDataURL('image/jpeg', 0.92);
        if (!imgData || imgData === 'data:,') throw new Error('toDataURL produced empty/invalid image data');
        pdfDoc.addImage(imgData, 'JPEG', MARGIN_MM, CONTENT_TOP_MM + firstItem.drawYMm, CONTENT_W_MM, firstItem.heightMm);
      }
      // Additional items sharing this same page (multiple short sections stacked together)
      for (let ii = 1; ii < pageItems.length; ii++) {
        const item = pageItems[ii];
        try {
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = item.canvas.width;
          sliceCanvas.height = item.srcHPx;
          if (!sliceCanvas.width || !sliceCanvas.height) {
            throw new Error(`degenerate canvas size ${sliceCanvas.width}x${sliceCanvas.height}`);
          }
          const ctx = sliceCanvas.getContext('2d');
          if (!ctx) throw new Error('getContext(\'2d\') returned null (browser may be out of canvas/GPU memory)');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(item.canvas, 0, item.srcYPx, item.canvas.width, item.srcHPx, 0, 0, item.canvas.width, item.srcHPx);
          const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
          if (!imgData || imgData === 'data:,') throw new Error('toDataURL produced empty/invalid image data');
          pdfDoc.addImage(imgData, 'JPEG', MARGIN_MM, CONTENT_TOP_MM + item.drawYMm, CONTENT_W_MM, item.heightMm);
        } catch (itemErr) {
          throw new Error(`Failed assembling page ${pIdx + 1}/${pages.length}, item ${ii + 1}/${pageItems.length} (section ${item.sectionIndex}): ${itemErr.message}`, { cause: itemErr });
        }
      }
    } catch (pageErr) {
      if (/^Failed assembling page/.test(pageErr.message)) throw pageErr; // already annotated by the inner catch above
      throw new Error(`Failed assembling page ${pIdx + 1}/${pages.length}, item 1/${pageItems.length} (section ${firstItem.sectionIndex}): ${pageErr.message}`, { cause: pageErr });
    }
  }

  // Now append the TOC pages after all content pages, then move them to the front.
  if (onProgress) onProgress(bt('Building table of contents...', '正在生成目录……'), 94);
  const contentPageCount = pages.length;
  let tocEntryIndex = 0;
  try {
    for (let t = 0; t < tocPageCount; t++) {
      pdfDoc.addPage();
      if (t === 0) {
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(18);
        pdfDoc.text(bt('Table of Contents', '目录'), MARGIN_MM, CONTENT_TOP_MM + 8);
      }
      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(11);
      let y = (t === 0 ? CONTENT_TOP_MM + 22 : CONTENT_TOP_MM + 8);
      for (let e = 0; e < TOC_ENTRIES_PER_PAGE && tocEntryIndex < tocLines.length; e++, tocEntryIndex++) {
        const line = tocLines[tocEntryIndex];
        if (line.type === 'category') {
          pdfDoc.setFont('helvetica', 'bold');
          pdfDoc.setFontSize(11);
          pdfDoc.text(line.label, MARGIN_MM, y);
          pdfDoc.setFont('helvetica', 'normal');
          y += 7;
        } else {
          const pageNum = (sectionStartPage[line.sourceIndex] || 0) + tocPageCount + 1;
          pdfDoc.text(line.title, MARGIN_MM + (useGrouping ? 4 : 0), y);
          pdfDoc.text(String(pageNum), PAGE_W_MM - MARGIN_MM - 8, y);
          y += 6;
        }
      }
    }
  } catch (tocErr) {
    // DIAGNOSTIC (same reasoning as PASS 3 above): names the exact TOC page/entry in progress.
    throw new Error(`Failed building table of contents (TOC page ${tocEntryIndex >= 0 ? Math.floor(tocEntryIndex / TOC_ENTRIES_PER_PAGE) + 1 : '?'}/${tocPageCount}, entry index ${tocEntryIndex}): ${tocErr.message}`, { cause: tocErr });
  }
  // TOC pages currently sit at positions [contentPageCount+1 .. contentPageCount+tocPageCount].
  // Move each one to the front, in order, so the final order is TOC pages then content pages.
  try {
    for (let t = 0; t < tocPageCount; t++) {
      pdfDoc.movePage(contentPageCount + 1, t + 1);
    }
  } catch (moveErr) {
    throw new Error(`Failed moving TOC pages to the front (contentPageCount=${contentPageCount}, tocPageCount=${tocPageCount}): ${moveErr.message}`, { cause: moveErr });
  }

  // ENHANCEMENT (requested directly: "Add in headers with the App logo and suitable color
  // formatting. Add in footer to show page numbers"): applied in one final pass now that every page
  // exists in its final position and the true total page count is known. jsPDF doesn't support SVG,
  // so the app's own diamond/star logo mark (see the brand-logo SVG in index.html) is redrawn here
  // using jsPDF's native vector path methods - a small filled diamond in the app's gold accent color,
  // matching the live app's own icon shape - rather than embedding a rasterized image for a simple
  // mark like this. Every page gets the same header (logo mark + "ILLUMINATE" in the app's plum
  // brand color, with a thin gold rule beneath) and footer (page number, matching content width).
  const GOLD = [184, 134, 53];   // var(--gold) #b88635
  const PLUM = [92, 52, 91];     // var(--plum) #5c345b
  const MUTED = [105, 115, 134]; // var(--muted) #697386
  const totalPages = pdfDoc.getNumberOfPages ? pdfDoc.getNumberOfPages() : (tocPageCount + contentPageCount);
  for (let pg = 1; pg <= totalPages; pg++) {
   try {
    pdfDoc.setPage(pg);

    // Header: small diamond/star logo mark drawn as a native vector shape, plus brand text.
    // Diamond starts at its top point (logoX, logoY-logoR), then draws to the right point, bottom
    // point, and left point in turn - closed:true draws the final edge back to the top point.
    const logoX = MARGIN_MM, logoY = MARGIN_MM + 3, logoR = 2.6;
    pdfDoc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    pdfDoc.lines(
      [[logoR, logoR], [-logoR, logoR], [-logoR, -logoR]],
      logoX, logoY - logoR,
      [1, 1], 'F', true
    );
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(11);
    pdfDoc.setTextColor(PLUM[0], PLUM[1], PLUM[2]);
    pdfDoc.text(bt('ILLUMINATE', '点亮生命'), logoX + logoR + 3, logoY + 1.5);
    pdfDoc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    pdfDoc.setLineWidth(0.4);
    pdfDoc.line(MARGIN_MM, MARGIN_MM + HEADER_HEIGHT_MM - 3, PAGE_W_MM - MARGIN_MM, MARGIN_MM + HEADER_HEIGHT_MM - 3);

    // Footer: page number, right-aligned within the content width
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const footerY = PAGE_H_MM - MARGIN_MM - 2;
    const footerText = bt(`Page ${pg} of ${totalPages}`, `第 ${pg} 页，共 ${totalPages} 页`);
    pdfDoc.text(footerText, PAGE_W_MM - MARGIN_MM, footerY, { align: 'right' });

    // Reset text color for any subsequent drawing (content images are unaffected, but keeps state clean)
    pdfDoc.setTextColor(0, 0, 0);
   } catch (headerErr) {
    throw new Error(`Failed applying header/footer to page ${pg}/${totalPages}: ${headerErr.message}`, { cause: headerErr });
   }
  }

  console.log(`[Illuminate PDF] Report assembled - ${tocPageCount} TOC page(s) + ${contentPageCount} content page(s), header/footer applied to all ${totalPages} page(s).`);
  return pdfDoc;
}

// ENHANCEMENT (this round): Export Center - lists every profile that currently exists (by name,
// with its relationship label) in one place, so exporting doesn't require navigating to each
// profile's own page individually to find its small export icon. Reuses buildProfilePdfHTML/
// exportProfileToPdf exactly as-is - this is a discovery/navigation layer on top of the existing
// export logic, not a separate implementation of it.
function getAllExistingProfiles() {
  const u = activeUser(); if (!u?.profile) return [];
  const list = [{ prefix: 'i', name: getProfileData().englishName, label: bt('You','本人') }];
  if (u.partner) list.push({ prefix: 'p', name: getProfileData(u.partner).englishName, label: bt('Life Partner','生活伴侣') });
  if (u.businessPartner) list.push({ prefix: 'b', name: getProfileData(u.businessPartner).englishName, label: bt('Business Partner','事业伙伴') });
  (u.additionalBizPartners || []).forEach((bp, i) => list.push({ prefix: `b2_${i}`, name: getProfileData(bp).englishName, label: bt(`Business Partner #${i+2}`,`事业伙伴 #${i+2}`) }));
  (u.children || []).forEach((c, i) => list.push({ prefix: `c${i}`, name: getProfileData(c).englishName, label: bt('Child','子女') }));
  return list;
}
// ENHANCEMENT (this round): Export Readiness checklist - a quick glance, on the Account page's
// Export Center, at which OPTIONAL profile/household fields (Mobile Number, Vehicle Plate(s),
// Address, Construction Year, Facing Direction) are still empty, so a PDF export isn't missing
// data the person simply forgot to enter. Purely informational - nothing here is required, and
// the app already renders gracefully with any of these left blank (see needsInputBadge, used on
// the same underlying fields inside each profile's own tabs).
function renderExportReadinessChecklist() {
  const container = document.getElementById('exportReadinessChecklist');
  if (!container) return;
  const u = activeUser();
  if (!u?.profile) { container.innerHTML = ''; return; }
  const profiles = getAllExistingProfiles();
  const missing = [];
  profiles.forEach(entry => {
    const prof = getProfileByPrefix(entry.prefix);
    if (!prof) return;
    if (!prof.mobileNumber) missing.push(bt(`${entry.name} - Mobile Number`, `${entry.name} - 手机号码`));
    // UPDATED (reported: business partner should have their own vehicle compatibility too): Business
    // Partner ('b') now also has a vehicle-ownership concept, matching renderVehiclesBlock's own scope.
    if (entry.prefix === 'i' || entry.prefix === 'p' || entry.prefix === 'b') {
      if (!prof.vehicles || !prof.vehicles.length) missing.push(bt(`${entry.name} - Vehicle Plate`, `${entry.name} - 车牌号码`));
    }
  });
  if (!u.home?.address) missing.push(bt('Home Address', '住家地址'));
  if (!u.home?.constructionYear) missing.push(bt('Home Construction Year', '住家建造年份'));
  const mainProf = getProfileByPrefix('i');
  if (!mainProf?.fsDir) missing.push(bt('Home Facing Direction', '住家朝向'));

  if (!missing.length) {
    container.innerHTML = `<div class="export-readiness"><div class="export-readiness-title">${bt('Export Readiness','导出完整度检查')}</div><div class="export-readiness-allset">✓ ${bt('All optional details are filled in - your export will be complete.','所有可选资料均已填写——您的导出内容将完整无缺。')}</div></div>`;
    return;
  }
  container.innerHTML = `
    <div class="export-readiness">
      <div class="export-readiness-title">${bt('Export Readiness','导出完整度检查')}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${bt('These optional fields are still empty. Your export will work fine without them, but filling them in unlocks additional analysis:','以下可选字段仍为空。即使不填写，导出功能仍可正常使用，但填写后可解锁更多分析内容：')}</div>
      ${missing.map(m => `<div class="export-readiness-item missing">• ${m}</div>`).join('')}
    </div>
  `;
}
function renderExportCenterList() {
  const container = document.getElementById('exportCenterList');
  if (!container) return;
  const profiles = getAllExistingProfiles();
  container.innerHTML = profiles.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
      <div><strong style="color:var(--plum)">${p.name}</strong><br><span style="font-size:11px;color:var(--muted)">${p.label}</span></div>
      <button class="btnExportPdf" data-prefix="${p.prefix}" style="border:0;background:var(--sand);color:var(--plum);padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">📄 ${bt('Export','导出')}</button>
    </div>
  `).join('');
}

// ENHANCEMENT (outstanding item: "consolidate all profile-editing fields onto one page"): a single
// hub, on the Account page, listing every profile on this account with one button straight to that
// profile's own edit form. Reuses the exact same edit forms/navigation the rest of the app already
// uses (prefillMainProfileForm/prefillPartnerForm + go()) rather than rebuilding them - each editor's
// own validation and data model stays exactly as-is, only the "how do I get there" step is consolidated.
// Children currently have no edit form at all (only Add/Remove) - that's an existing gap, not something
// this consolidation invents, so it links to the Children tab where they're managed today.
function renderManageProfilesList() {
  const container = document.getElementById('manageProfilesList');
  if (!container) return;
  const u = activeUser();
  if (!u?.profile) { container.innerHTML = ''; return; }
  const row = (label, sublabel, btnClass, btnText) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
      <div><strong style="color:var(--plum)">${label}</strong>${sublabel ? `<br><span style="font-size:11px;color:var(--muted)">${sublabel}</span>` : ''}</div>
      <button class="${btnClass}" style="border:0;background:var(--sand);color:var(--plum);padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">${btnText}</button>
    </div>`;
  let html = row(bt('Your Profile','本人档案'), getProfileData().englishName, 'btnManageEditMain', bt('Edit','编辑'));
  html += u.partner
    ? row(bt('Life Partner','生活伴侣'), getProfileData(u.partner).englishName, 'btnManageEditPartner', bt('Edit','编辑'))
    : row(bt('Life Partner','生活伴侣'), bt('Not added yet','尚未添加'), 'btnManageEditPartner', bt('Add','添加'));
  html += u.businessPartner
    ? row(bt('Business Partner','事业伙伴'), getProfileData(u.businessPartner).englishName, 'btnManageEditBiz', bt('Edit','编辑'))
    : row(bt('Business Partner','事业伙伴'), bt('Not added yet','尚未添加'), 'btnManageEditBiz', bt('Add','添加'));
  const childCount = (u.children || []).length;
  html += row(bt('Children','子女'), childCount ? bt(`${childCount} added`,`已添加 ${childCount} 位`) : bt('Not added yet','尚未添加'), 'btnManageGoChildren', childCount ? bt('Manage','管理') : bt('Add','添加'));
  container.innerHTML = html;
  // Household Occupants has no row of its own here - adding one is just a role tag ("Household
  // Occupant") on the "People" screen below (see renderPeopleManagementList()), the same single
  // add/edit form used for a Life Partner, Business Partner or Child.
}

// REMOVED (reported: "remove the household occupants section [from the Account page]... incorporate
// the household occupants into the add person option under people instead"): renderAccountOccupantsList()
// used to fill a standalone "Household Occupants" settings block (#accountOccupantsList) with the
// add/edit form built by renderOccupantsListHTML(). That block is gone - adding/editing/removing a
// Household Occupant is now done exclusively through the flexible "People" screen below
// (renderPeopleManagementList(), tag a person "Household Occupant"), which already wrote to the exact
// same underlying data (u.profile.bazhaiOccupants, via rebuildLegacySlotsFromPeople() in
// engine-core.js) before this round - only this second, redundant add/edit surface for the same data
// is removed, not any data or downstream reading of it. renderOccupantsListHTML() itself, and the
// btnAddOccupant/btnRemoveOccupant handlers that used to drive it, are left in place as dead code
// rather than deleted outright, purely to minimize the surface area touched in this round - they are
// simply unreachable now that nothing renders an element with class btnAddOccupant/btnRemoveOccupant
// anywhere in the app.

// ============================================================================
// UNIFIED MULTI-ROLE PEOPLE MANAGEMENT SCREEN (this round)
// ============================================================================
// The biggest architectural change of this round: instead of fixed profile "slots" (Life Partner /
// Business Partner / Household Occupant / Child), the account now has ONE list of people, u.people,
// where a single real person can carry MULTIPLE role tags at once (e.g. someone who is both your Life
// Partner and a Business Partner) - see engine-core.js's rebuildLegacySlotsFromPeople for how this
// still feeds the untouched prefix-based rendering/PDF/compatibility engine. This screen is added
// ALONGSIDE the existing "Manage Profiles" hub above (renderManageProfilesList), not in place of it -
// that hub's own established behaviour (and its existing regression test) is left completely
// untouched; this is simply the new, additional place to add/edit/tag/remove people.
const PEOPLE_ROLE_DEFS = [
  { role: 'partner', en: 'Life Partner', zh: '生活伴侣' },
  { role: 'businessPartner', en: 'Business Partner', zh: '事业伙伴' },
  { role: 'child', en: 'Child', zh: '子女' },
  { role: 'occupant', en: 'Household Occupant', zh: '住户' }
];
function personDisplayName(person) {
  const en = `${person.englishFirstName || ''} ${person.englishLastName || ''}`.trim();
  if (en) return en;
  if (person.name) return person.name; // migrated bare-name household occupant
  return bt('Unnamed', '未命名');
}
// Module-level UI state for this screen only (which add/edit form, if any, is currently open) -
// deliberately not part of u.people itself, since it's transient view state, not saved data.
let peopleAddFormOpen = false;
let peopleEditingId = null;

function renderPersonRoleCheckboxes(person, idPrefix) {
  return PEOPLE_ROLE_DEFS.map(rd => {
    const checked = (person.roles || []).includes(rd.role);
    return `<label style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;margin-bottom:4px;font-size:12px;color:var(--ink)">
      <input type="checkbox" id="${idPrefix}-role-${rd.role}" class="personRoleCheckbox" data-personid="${idPrefix}" data-role="${rd.role}" ${checked ? 'checked' : ''} autocomplete="off"> ${bt(rd.en, rd.zh)}
    </label>`;
  }).join('');
}
// REDESIGN (this round): matches this app-wide pattern - given a person's already-stored
// birthLocation/birthLongitude/birthTimezone (from before this redesign, or from a country selection
// made since), best-effort reconstructs which country (and, for a multi-timezone country, which city
// index) that data came from, so the People-screen edit form can preselect the right dropdown options
// instead of showing them blank. Falls back to no match (dropdowns start unselected, existing hidden
// values are left as-is until the user picks a country) rather than guessing wrong.
function matchPersonLocationToCountry(person) {
  const loc = (person.birthLocation || '').trim();
  if (loc && COUNTRY_LONGITUDE_TIMEZONE[loc]) return { country: loc, cityIdx: '' };
  for (const [country, cities] of Object.entries(MULTI_TIMEZONE_COUNTRY_CITIES)) {
    const idx = cities.findIndex(c => loc === `${c.city}, ${country}` || loc === c.city);
    if (idx !== -1) return { country, cityIdx: String(idx) };
  }
  return { country: '', cityIdx: '' };
}
function renderCountryOptionsHTML(selectedCountry) {
  return Object.keys(COUNTRY_LONGITUDE_TIMEZONE).sort().map(name =>
    `<option value="${escapeHtml(name)}" ${name === selectedCountry ? 'selected' : ''}>${escapeHtml(name)}</option>`
  ).join('');
}
function renderCityOptionsHTML(country, selectedCityIdx) {
  const cities = MULTI_TIMEZONE_COUNTRY_CITIES[country];
  if (!cities) return '';
  return cities.map((c, idx) =>
    `<option value="${idx}" ${String(idx) === String(selectedCityIdx) ? 'selected' : ''}>${escapeHtml(c.city)}</option>`
  ).join('');
}
function renderPersonFieldsForm(person, formIdPrefix) {
  const showApprox = (person.roles || []).includes('occupant');
  const v = (field) => escapeHtml(person[field] !== undefined && person[field] !== null ? String(person[field]) : '');
  const { country: matchedCountry, cityIdx: matchedCityIdx } = matchPersonLocationToCountry(person);
  const hasCities = !!MULTI_TIMEZONE_COUNTRY_CITIES[matchedCountry];
  return `
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      <label class="field" style="margin:0;flex:1;min-width:110px"><span style="font-size:11px">${bt('English First Name *','英文名字 *')}</span><input type="text" id="${formIdPrefix}-ef" value="${v('englishFirstName')}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      <label class="field" style="margin:0;flex:1;min-width:110px"><span style="font-size:11px">${bt('English Last Name *','英文姓氏 *')}</span><input type="text" id="${formIdPrefix}-el" value="${v('englishLastName')}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      <label class="field" style="margin:0;flex:1;min-width:90px"><span style="font-size:11px">${bt('Chinese First Name','中文名字')}</span><input type="text" id="${formIdPrefix}-cf" value="${v('chineseFirstName')}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      <label class="field" style="margin:0;flex:1;min-width:90px"><span style="font-size:11px">${bt('Chinese Last Name','中文姓氏')}</span><input type="text" id="${formIdPrefix}-cl" value="${v('chineseLastName')}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      <label class="field" style="margin:0;flex:1;min-width:90px"><span style="font-size:11px">${bt('Gender *','性别 *')}</span><select id="${formIdPrefix}-g" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"><option value="">--</option><option value="male" ${person.gender==='male'?'selected':''}>${bt('Male','男')}</option><option value="female" ${person.gender==='female'?'selected':''}>${bt('Female','女')}</option></select></label>
      <label class="field" style="margin:0;flex:1;min-width:130px"><span style="font-size:11px">${bt('Birth Date *','出生日期 *')}</span><input type="date" id="${formIdPrefix}-d" value="${v('birthdate')}" min="1920-01-01" max="${new Date().toISOString().slice(0,10)}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      <label class="field" style="margin:0;flex:1;min-width:100px"><span style="font-size:11px">${bt('Birth Time','出生时间')}</span><input type="time" id="${formIdPrefix}-t" value="${v('birthtime')}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      <label class="field" style="margin:0;flex:1;min-width:110px"><span style="font-size:11px">${bt('Birth Country *','出生国家 *')}</span><select id="${formIdPrefix}CountrySelect" class="countrySelect" data-target="${formIdPrefix}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"><option value="">${bt('-- Select Country --','-- 请选择国家 --')}</option>${renderCountryOptionsHTML(matchedCountry)}</select></label>
      <label class="field" id="${formIdPrefix}CityWrap" style="margin:0;flex:1;min-width:130px;${hasCities ? '' : 'display:none'}"><span style="font-size:11px">${bt('City/Region','城市／地区')}</span><select id="${formIdPrefix}CitySelect" class="citySelect" data-target="${formIdPrefix}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"><option value="">${bt('-- Select City/Region --','-- 请选择城市／地区 --')}</option>${renderCityOptionsHTML(matchedCountry, matchedCityIdx)}</select></label>
      <input type="hidden" id="${formIdPrefix}Location" value="${v('birthLocation') || 'Singapore'}" autocomplete="off">
      <input type="hidden" id="${formIdPrefix}Longitude" value="${v('birthLongitude') || '103.8198'}" autocomplete="off">
      <input type="hidden" id="${formIdPrefix}Timezone" value="${v('birthTimezone') || '8'}" autocomplete="off">
      <input type="hidden" id="${formIdPrefix}Latitude" value="${v('birthLatitude') || '1.35'}" autocomplete="off">
      <label class="field" style="margin:0;flex:1;min-width:120px"><span style="font-size:11px">${bt('Mobile Number','手机号码')}</span><input type="text" id="${formIdPrefix}-mobile" value="${v('mobileNumber')}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      <label class="field" style="margin:0;flex:1;min-width:120px"><span style="font-size:11px">${bt('Vehicle Plate Number (Life/Business Partner only)','车牌号码（仅限生活伴侣/事业伙伴）')}</span><input type="text" id="${formIdPrefix}-vehicle" value="${(person.vehicles && person.vehicles.length === 1) ? escapeHtml(person.vehicles[0].number) : ''}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      ${showApprox ? `<label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-top:18px"><input type="checkbox" id="${formIdPrefix}-approx" ${person.approximateBirth ? 'checked' : ''} autocomplete="off"> ${bt('Approximate birth (exact date/time not known)','约略出生（不确定确实日期/时间）')}</label>` : ''}
    </div>
    <!-- ENHANCEMENT (reported: "Children should not inherit the [home] address unless option is
         selected"): off by default (see prof.includeHomeAddress in buildPersonalAssetsSummaryRows),
         only meaningful when this person is tagged Child - shown unconditionally here (like Vehicle
         Plate above) with a scope note, since the role checkboxes below can be toggled without
         re-rendering this form. -->
    <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-top:8px"><input type="checkbox" id="${formIdPrefix}-includeHomeAddr" ${person.includeHomeAddress ? 'checked' : ''} autocomplete="off"> ${bt('Include Home Address for Address Compatibility (Children only)','将住家地址纳入地址契合度分析（仅适用于子女）')}</label>
    <div style="margin-top:8px"><strong style="font-size:12px">${bt('Roles (select all that apply)','角色（可多选）')}</strong><div style="margin-top:4px">${renderPersonRoleCheckboxes(person, formIdPrefix)}</div></div>
    <!-- UPDATED (reported: "why does the profile data entry for business partner have vehicle plate
         number for life partner only?"): Vehicle Plate now also applies when tagged Business Partner,
         matching the extended scope in renderVehiclesBlock/applyVehiclePlateIfEligible. -->
    <div style="font-size:10px;color:var(--muted);margin-top:2px">${bt('Vehicle Plate Number only applies (and is only saved) if this person is tagged Life Partner or Business Partner. Additional vehicles beyond one can be added from the Personal Assets section once saved.', '车牌号码仅在此人被标记为「生活伴侣」或「事业伙伴」时适用（并保存）。保存后可在个人资产部分添加一辆以上的车辆。')}</div>
    <div id="${formIdPrefix}-error" style="color:var(--danger);font-size:11px;margin-top:4px"></div>
  `;
}
function readPersonFieldsFromForm(formIdPrefix) {
  const g = (id) => document.getElementById(`${formIdPrefix}-${id}`);
  const gLoc = (suffix) => document.getElementById(`${formIdPrefix}${suffix}`);
  return {
    englishFirstName: (g('ef')?.value || '').trim(),
    englishLastName: (g('el')?.value || '').trim(),
    chineseFirstName: (g('cf')?.value || '').trim(),
    chineseLastName: (g('cl')?.value || '').trim(),
    gender: g('g')?.value || '',
    birthdate: g('d')?.value || '',
    birthtime: g('t')?.value || '',
    birthLocation: (gLoc('Location')?.value || 'Singapore').trim(),
    birthLongitude: gLoc('Longitude') && gLoc('Longitude').value !== '' ? Number(gLoc('Longitude').value) : 103.8198,
    birthTimezone: gLoc('Timezone') && gLoc('Timezone').value !== '' ? Number(gLoc('Timezone').value) : 8,
    // ENHANCEMENT (requested directly: real Ascendant-based houses) - see autoPopulateLonTz/
    // COUNTRY_LONGITUDE_TIMEZONE (engine-core.js): the SAME country/city selection already used for
    // longitude/timezone now also carries a reference-city latitude, with no new field for the user to
    // fill in. Left undefined (not defaulted) when genuinely absent, so downstream Ascendant code can
    // tell "no latitude on file yet" apart from "latitude is 0" (the Prime Meridian's equator crossing).
    birthLatitude: gLoc('Latitude') && gLoc('Latitude').value !== '' ? Number(gLoc('Latitude').value) : undefined,
    // REDESIGN (this round): the country dropdown itself (not the auto-derived lon/tz, which always
    // falls back to a valid default even before a country is chosen) is what tells validatePersonFields
    // whether the user has actually made a birth-country selection yet.
    _countrySelected: !!(gLoc('CountrySelect')?.value),
    mobileNumber: (g('mobile')?.value || '').trim(),
    approximateBirth: g('approx') ? !!g('approx').checked : false,
    includeHomeAddress: g('includeHomeAddr') ? !!g('includeHomeAddr').checked : false,
    // Raw vehicle-plate text from the form - NOT the final `vehicles` array shape. Applied by the
    // caller only when the person ends up tagged 'partner' (scope: individual + Life Partner only),
    // merged against any existing vehicles list to avoid duplicating an already-saved plate - see
    // applyVehiclePlateIfPartner below, used by both the Add and Edit People-screen save handlers.
    _vehiclePlateInput: (g('vehicle')?.value || '').trim()
  };
}
// ENHANCEMENT (reported: "household occupants should not be fixed... incorporate the household
// occupants into the add person option under people instead"): a person tagged ONLY "Household
// Occupant" (no other role) keeps the old, deliberately lighter Household Occupants requirements -
// Birth Date is the only thing that's actually required (Name, Gender, and Birth Country/City default
// silently to Singapore, exactly as the old dedicated form did) - rather than the full Name/Gender/
// Birth Country requirements every other role needs. Anyone tagged with an ADDITIONAL role alongside
// Occupant (e.g. also Business Partner) still goes through the full, strict validation below, since
// that combination implies a real, named person with a full profile.
function validatePersonFields(fields, errId, roles) {
  const errEl = document.getElementById(errId);
  const isOccupantOnly = Array.isArray(roles) && roles.length === 1 && roles[0] === 'occupant';
  if (!fields.birthdate) {
    if (errEl) errEl.textContent = bt('Please enter a Birth Date.', '请输入出生日期。');
    return false;
  }
  if (!isOccupantOnly && (!fields.englishFirstName || !fields.englishLastName || !fields.gender)) {
    if (errEl) errEl.textContent = bt('Please fill in all required (*) fields.', '请填写所有必填 (*) 栏位。');
    return false;
  }
  // NOTE: validateNotFutureDate (used by the older intake/partner/biz/child forms) is a function-local
  // helper defined INSIDE initListeners() - not reachable from this top-level function - so the same
  // future-date check is inlined here rather than calling it (calling it would throw a ReferenceError).
  if (fields.birthdate && fields.birthdate > new Date().toISOString().slice(0, 10)) {
    if (errEl) errEl.textContent = bt('Birth date cannot be in the future.', '出生日期不可为未来日期。');
    return false;
  }
  // REDESIGN (this round): longitude/timezone are now auto-derived from the selected birth country
  // (never typed by the user), so the meaningful check is whether a country was actually selected -
  // the old "enter a valid longitude/timezone" message no longer matches what the user sees on screen.
  // An occupant-only person skips this too - like the old dedicated form, no location is collected for
  // them at all, and getProfileData() already falls back to Singapore's own default longitude/timezone.
  if (!isOccupantOnly) {
    if (!fields._countrySelected) {
      if (errEl) errEl.textContent = bt('Please select a Birth Country.', '请选择出生国家。');
      return false;
    }
    if (isNaN(fields.birthLongitude) || fields.birthLongitude < -180 || fields.birthLongitude > 180 || isNaN(fields.birthTimezone) || fields.birthTimezone < -12 || fields.birthTimezone > 14) {
      if (errEl) errEl.textContent = bt('Please select a valid Birth Country.', '请选择有效的出生国家。');
      return false;
    }
  }
  if (errEl) errEl.textContent = '';
  return true;
}
function readRolesFromCheckboxes(formIdPrefix) {
  return PEOPLE_ROLE_DEFS.map(rd => rd.role).filter(role => {
    const cb = document.querySelector(`.personRoleCheckbox[data-personid="${formIdPrefix}"][data-role="${role}"]`);
    return cb && cb.checked;
  });
}
// Applies the People-screen form's optional Vehicle Plate field to `person.vehicles`, but ONLY when
// `roles` includes 'partner' OR 'businessPartner' - matching the app-wide Personal Assets scope
// (individual + Life Partner + Business Partner - see renderVehiclesBlock). Preserves any vehicles
// already on the person and never duplicates an already-saved plate, same conservative merge used by
// the other Personal-Assets-collecting forms (intake, old partner form).
// RENAMED (reported: business partner should have vehicle number too) from
// applyVehiclePlateIfPartner - scope widened, name updated to match.
function applyVehiclePlateIfEligible(person, roles, vehiclePlateInput) {
  const existingVehicles = person.vehicles || [];
  if ((roles.includes('partner') || roles.includes('businessPartner')) && vehiclePlateInput && !existingVehicles.some(v => v.number === vehiclePlateInput)) {
    person.vehicles = existingVehicles.concat([{ number: vehiclePlateInput, shared: false }]);
  } else {
    person.vehicles = existingVehicles;
  }
}
// Back-compat alias in case any other call site still references the old name.
const applyVehiclePlateIfPartner = applyVehiclePlateIfEligible;
// "Only one Life Partner" DESIGN DECISION: BLOCK, not auto-swap. Tagging a second person 'partner'
// while one is already tagged is refused with a clear, actionable message naming the person who would
// need to be un-tagged first, rather than silently removing the tag from a DIFFERENT person the user
// isn't even currently editing. An unannounced side effect on someone else's data is far more
// surprising - and easier to miss - than an explicit error asking the user to make that choice
// themselves; blocking also can never lose data the user didn't explicitly choose to change.
function checkOnlyOnePartnerRule(u, roles, personId) {
  if (!roles.includes('partner')) return null;
  const existing = (u.people || []).find(p => p.id !== personId && (p.roles || []).includes('partner'));
  if (existing) {
    return bt(`Only one person can be tagged Life Partner - remove that tag from ${personDisplayName(existing)} first.`,
               `只能有一位「生活伴侣」——请先移除 ${personDisplayName(existing)} 的此标签。`);
  }
  return null;
}
function renderPeopleManagementList() {
  const container = document.getElementById('peopleManagementList');
  if (!container) return;
  const u = activeUser();
  if (!u?.profile) { container.innerHTML = ''; return; }
  ensurePeopleArray(u);

  const roleBadges = (person) => (person.roles || []).map(role => {
    const rd = PEOPLE_ROLE_DEFS.find(r => r.role === role);
    return `<span style="display:inline-block;background:var(--sand);color:var(--plum);border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;margin-right:4px">${bt(rd ? rd.en : role, rd ? rd.zh : role)}</span>`;
  }).join('') || `<span style="font-size:10px;color:var(--muted)">${bt('No roles tagged','尚未标记角色')}</span>`;

  let html = u.people.map(person => {
    const name = personDisplayName(person);
    const isEditing = peopleEditingId === person.id;
    let row = `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div><strong style="color:var(--plum)">${escapeHtml(name)}</strong><div style="margin-top:2px">${roleBadges(person)}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btnPeopleEditPerson" data-personid="${person.id}" style="border:0;background:var(--sand);color:var(--plum);padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">${isEditing ? bt('Close','收起') : bt('Edit','编辑')}</button>
          <button class="btnPeopleRemovePerson" data-personid="${person.id}" style="border:0;background:var(--danger);color:#fff;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">${bt('Remove','移除')}</button>
        </div>
      </div>`;
    if (isEditing) {
      row += `<div style="margin-top:10px;padding:10px;background:#f5f3ec;border-radius:8px">
        ${renderPersonFieldsForm(person, `pedit-${person.id}`)}
        <button class="btnPeopleSavePersonEdit" data-personid="${person.id}" style="margin-top:8px;padding:8px 16px;background:var(--gold);color:#fff;border:none;border-radius:4px;font-weight:700;cursor:pointer">${bt('Save','保存')}</button>
      </div>`;
    }
    row += `</div>`;
    return row;
  }).join('');
  if (!u.people.length) html = `<div style="padding:12px 0;color:var(--muted);font-size:13px">${bt('No additional people added yet.','尚未添加其他成员。')}</div>`;

  html += `<div style="padding-top:10px">
    <button id="btnPeopleAddPersonToggle" style="padding:8px 16px;background:var(--gold);color:#fff;border:none;border-radius:4px;font-weight:700;cursor:pointer">${peopleAddFormOpen ? bt('Cancel','取消') : bt('+ Add Person','+ 添加成员')}</button>
  </div>`;
  if (peopleAddFormOpen) {
    html += `<div style="margin-top:10px;padding:10px;background:#f5f3ec;border-radius:8px">
      ${renderPersonFieldsForm({}, 'pnew')}
      <button id="btnPeopleSaveNewPerson" style="margin-top:8px;padding:8px 16px;background:var(--gold);color:#fff;border:none;border-radius:4px;font-weight:700;cursor:pointer">${bt('Add','添加')}</button>
    </div>`;
  }
  container.innerHTML = html;
}

// Variant of exportProfileToPdf that resolves a Blob instead of triggering a save - used when
// bundling multiple profiles into one ZIP, where each PDF must be produced without downloading
// individually first.
// Same fix as exportProfileToPdf above (see its detailed comment) - reuses the same
// captureChunksIntoPdf helper, so the ZIP-all-profiles export path gets the same canvas-size-limit
// fix rather than drifting out of sync with it over time.
async function buildProfilePdfBlob(prefix) {
  // See USE_NATIVE_PDF_EXPORT's own comment above buildNativePdfDocument.
  if (USE_NATIVE_PDF_EXPORT) {
    const pdfDoc = await buildNativePdfDocument(prefix);
    if (!pdfDoc) throw new Error('no content');
    return pdfDoc.output('blob');
  }

  const html = buildProfilePdfHTML(prefix);
  if (!html) throw new Error('no content');

  // BUG FIX (see exportProfileToPdf's matching comment): container creation/id-stripping/setup now
  // lives INSIDE the try/finally too, not just the capture call, so a thrown error anywhere in setup
  // still guarantees cleanup rather than leaking a container into the live DOM.
  let container = null;
  try {
    container = document.createElement('div');
    container.style.cssText = 'width:420px; background:#fff;';
    container.innerHTML = html;
    // BUG FIX (Task #79): same fix as exportProfileToPdf above (see its detailed comment) - id
    // reassignment and cleanup now run on the still-DETACHED container BEFORE it's appended to
    // document.body, so no window ever exists where this container's ids duplicate the live page's.
    container.querySelectorAll('[id]').forEach(el => el.setAttribute('id', `pdf-export-main-${__pdfExportUidCounter++}`));
    container.querySelectorAll('input, select, textarea').forEach(el => el.setAttribute('autocomplete', 'off'));
    container.querySelectorAll('.pdf-exclude').forEach(el => el.remove());
    container.querySelectorAll('.btnViewDeepAnalysis').forEach(el => el.remove());
    document.body.appendChild(container);

    const innerWrapper = container.firstElementChild;
    if (!innerWrapper) { throw new Error('no content wrapper'); }
    const wrapperStyle = innerWrapper.getAttribute('style') || 'font-family:Georgia,serif;padding:20px;color:#182030;';
    const topLevelNodes = Array.from(innerWrapper.children);

    const pdfDoc = await captureChunksIntoPdf(topLevelNodes, wrapperStyle);
    if (!pdfDoc) throw new Error('No content was captured');
    return pdfDoc.output('blob');
  } finally {
    if (container && document.body.contains(container)) document.body.removeChild(container);
  }
}
// ENHANCEMENT (this round, requested directly: "Is there a way to have the PDF generation render in
// the background when information is updated so when the export pdf button is clicked, the pdf can be
// almost immediately presented?"). Design: (a) a cheap fingerprint of the active user's whole data
// object detects whether anything has actually changed since a profile's PDF was last built; (b) every
// successful save (saveState, in engine-core.js - the single, already-existing choke point every
// data-changing action in this app already goes through) schedules a DEBOUNCED background pre-render,
// so rapid-fire edits (e.g. typing in a field that saves on every keystroke) don't each trigger their
// own full PDF build; (c) the actual build only starts once the browser reports itself idle
// (requestIdleCallback, with a plain setTimeout fallback for browsers without it), and profiles are
// rendered ONE AT A TIME with a fresh idle slice requested between each - never one long blocking loop -
// so background work stays genuinely low-priority and never competes with real user interaction; (d) the
// finished PDF is cached as a Blob, keyed by account + profile prefix + the fingerprint that produced it,
// so a stale cache (from before further edits) is never served; (e) exportProfileToPdfInner (below) checks
// this cache FIRST - a fresh hit skips the entire html2canvas/jsPDF pipeline and just downloads the
// already-built Blob, which is the "almost immediately presented" outcome asked for; a miss falls back to
// the exact same live build this app already had, and that result is then ALSO cached, so even the very
// first export after a change warms the cache for next time.
let __pdfPreRenderDebounceTimer = null;
const __pdfPreRenderCache = {}; // { [email]: { [prefix]: { blob, filename, fingerprint, builtAt } } }
const __pdfPreRenderQueueState = { running: false };

function computeActiveUserPdfFingerprint() {
  const u = activeUser();
  if (!u) return '';
  try {
    const json = JSON.stringify(u);
    // Not cryptographic - just needs to change whenever the underlying data changes. A simple
    // FNV-1a-style rolling hash plus the raw length is more than enough to avoid false "still fresh"
    // cache hits for real edits, at a fraction of the cost of hashing the whole string with a real
    // digest algorithm on every save.
    let h = 2166136261;
    for (let i = 0; i < json.length; i++) { h ^= json.charCodeAt(i); h = Math.imul(h, 16777619); }
    return `${h >>> 0}:${json.length}`;
  } catch (e) {
    // Fingerprinting failure should never block anything real - it just means "treat every cache
    // entry as stale," which is always safe, only ever costing a redundant rebuild.
    return `nofingerprint:${Date.now()}`;
  }
}

// BUG FIX (root cause of "not responsive to any clicks upon loading", reported with a screenshot showing
// dozens of rapid-fire `GET /styles.css` requests - and, live-reproduced this round against the real
// running app with the device's own DevTools, directly confirmed: `__pdfBackgroundBuildActive` and
// `__pdfPreRenderQueueState.running` both read `true` within seconds of a fresh page load, with the
// browser console showing a continuous back-to-back stream of html2canvas "Starting document clone" /
// "Finished rendering" cycles - dozens of them, with no gap, immediately after load, before any click).
//
// Two things combine to make this feature dangerous at real scale, and this round is what finally caught
// both together, live:
//
// 1) This function is armed by EVERY successful saveState() call - including ones the user never
//    triggered themselves. renderAllViews() runs a one-time-per-session lottery auto-fetch + historical
//    backfill (see fetchLatestLotteryResults/backfillHistoricalAccuracy's call sites) immediately after
//    every fresh page load, and backfillHistoricalAccuracy calls saveState() once it has new backtested
//    entries to persist - which means this background PDF pre-render queue was being armed, 2.5 seconds
//    after every single app load, completely independent of whether the user had edited anything.
//
// 2) An earlier round's fix (the batchContainer `position:relative` fix, see its own comment further up
//    this file) corrected a bug that was silently collapsing every export down to ~2 near-empty pages.
//    That was the right fix for the PDF itself - but it also means this background queue, which builds a
//    full PDF via html2canvas for EVERY profile on the account (individual + Life Partner + Business
//    Partner, for a real 3-profile household), now does the FULL amount of real work every time it runs
//    (dozens to 90+ pages' worth of html2canvas captures per profile) instead of the previously-buggy,
//    accidentally-cheap ~2-page version. html2canvas's own "document clone" step re-fetches the page's
//    linked stylesheet on every single capture, which is exactly the repeated `GET /styles.css` flood
//    reported (and previously investigated multiple times without a root cause, since no test run before
//    this one exercised a real 3-profile household with real page counts against a real browser). Each
//    individual html2canvas call is not preemptible mid-call, and the existing chunking/yield points only
//    run BETWEEN batches/profiles - so for a real household this size, the result is the main thread
//    being kept busy almost continuously for as long as the whole queue runs, which is felt as "not
//    responsive to any clicks."
//
// Given this has now been directly observed to freeze a real account's app on every single page load,
// and three separate prior rounds of narrower patches around this feature (a duplicate-id concurrency
// fix, a stale-fingerprint fix, an in-flight-export abort check) did not address the actual cost problem,
// the responsible fix is to stop scheduling this automatically rather than continue narrowing its edge
// cases. Exporting a PDF still works exactly as before - exportProfileToPdfInner already has a complete,
// already-tested graceful fallback for a cache miss: it just builds live instead, with the same on-screen
// progress bar (showPdfExportProgress/updatePdfExportProgress) every export has always shown. The only
// change in observable behavior is that the "pre-warmed, near-instant download" outcome no longer
// happens silently in the background - exporting a profile's PDF now always takes its real build time,
// visibly, at the moment you actually ask for it, instead of invisibly (and disruptively) at some
// unpredictable earlier moment you didn't ask for at all.
function schedulePdfPreRender() {
  // Intentionally disabled - see the BUG FIX comment above. The rest of this feature's machinery
  // (runPdfBackgroundPreRenderQueue, __pdfPreRenderCache, the cache-check in exportProfileToPdfInner) is
  // left in place and still fully functional, in case a future round wants to re-arm this from a
  // deliberately safer trigger (e.g. only after a real, explicit profile edit - never from the on-load
  // lottery auto-fetch/backfill - and only one profile per idle slice, not the whole roster at once).
  return;
}

async function runPdfBackgroundPreRenderQueue() {
  if (__pdfPreRenderQueueState.running) return; // an earlier-scheduled run is still working through its queue
  if (typeof html2pdf === 'undefined') return; // CDN script not loaded yet/blocked - nothing to pre-render with
  if (__pdfExportInFlight) { schedulePdfPreRender(); return; } // user just clicked Export live - don't compete; try again shortly
  const email = state.active;
  const u = activeUser();
  if (!email || !u?.profile) return;
  const profiles = (typeof getAllExistingProfiles === 'function') ? getAllExistingProfiles() : [];
  if (!profiles.length) return;

  __pdfPreRenderQueueState.running = true;
  try {
    // BUG FIX (found while writing this feature's own test suite): building a profile's PDF can itself
    // mutate the user's data as a side effect - e.g. this app auto-logs upcoming lottery predictions
    // (see renderLotteryPredictions/getLotteryLog in engine-predictions.js) into u.lotteryLog the first
    // time they're rendered. That mutation changes computeActiveUserPdfFingerprint()'s result AFTER a
    // build completes. Storing each cache entry against a single fingerprint snapshot taken ONCE before
    // the whole loop started meant: (a) the very first export right after warming the cache would see a
    // "stale" mismatch and rebuild live anyway, defeating the instant-download purpose for that first
    // real payoff moment, and (b) building profile 1 could make profile 2's "did a newer edit land"
    // check below fire on the build's own side effect and wrongly abort the rest of the queue. Fixed by
    // re-measuring the fingerprint fresh after EACH successful build and using that (not the original
    // pre-loop snapshot) both as the cache key for that entry and as the baseline the next profile's
    // check compares against - so a build's own mutations are correctly absorbed into "what this cached
    // blob matches," while a genuinely new external edit landing between profiles (a real fingerprint
    // change with no build in between) is still detected and still aborts the queue.
    let currentFingerprint = computeActiveUserPdfFingerprint();
    __pdfPreRenderCache[email] = __pdfPreRenderCache[email] || {};
    const accountCache = __pdfPreRenderCache[email];
    // Drop cache entries for profiles that no longer exist (e.g. a business partner was removed),
    // so memory doesn't accumulate stale blobs for profiles that can never be exported again.
    const existingPrefixes = new Set(profiles.map(p => p.prefix));
    Object.keys(accountCache).forEach(prefix => { if (!existingPrefixes.has(prefix)) delete accountCache[prefix]; });

    const MAX_PROFILES_PER_RUN = 6; // defensive cap - a household this large is unusual, and this just means later profiles warm up on a subsequent idle run instead
    const toRender = profiles.slice(0, MAX_PROFILES_PER_RUN).filter(p => accountCache[p.prefix]?.fingerprint !== currentFingerprint);
    for (const prof of toRender) {
      // Bail out early if the user started a live export or the data changed again mid-queue (a newer
      // fingerprint means a newer edit landed while we were still working through the old one) -
      // finishing against stale data would just be wasted work, and the newer save already scheduled
      // its own follow-up run. Compared against currentFingerprint (updated after each build below), not
      // the original pre-loop snapshot - see the bug-fix comment above.
      if (__pdfExportInFlight) break;
      if (computeActiveUserPdfFingerprint() !== currentFingerprint) break;
      __pdfBackgroundBuildActive = true;
      try {
        const blob = await buildProfilePdfBlob(prof.prefix);
        if (blob) {
          // Re-measure AFTER the build completes (see bug-fix comment above) so this cache entry is
          // keyed by what the data actually is right now, including any side effects the build itself
          // just caused - not what it was a moment before the build ran.
          currentFingerprint = computeActiveUserPdfFingerprint();
          const safeName = (prof.name || 'profile').replace(/[^a-z0-9]+/gi, '_');
          accountCache[prof.prefix] = {
            blob, fingerprint: currentFingerprint, builtAt: Date.now(),
            filename: `Illuminate_${safeName}_${new Date().toISOString().slice(0,10)}.pdf`,
          };
        }
      } catch (e) {
        // A background pre-render failure is never shown to the user - Export still works normally via
        // the existing live-build fallback path, just without the instant-cache-hit speed-up this time.
        // (This is also where a deliberate abortIfLiveExportStarted() throw lands, see
        // __pdfBackgroundBuildActive's own comment above - that's an expected, healthy outcome here,
        // not a real failure, and is handled identically: no cache entry for this profile this run, the
        // live export it just yielded to keeps working normally, and this profile warms up again on a
        // later idle run instead.)
        console.warn('[Illuminate PDF] Background pre-render failed for profile', prof.prefix, '- Export will build live instead:', e);
      } finally {
        __pdfBackgroundBuildActive = false;
      }
      // Yield back to the browser between profiles rather than looping straight through all of them -
      // each one gets its own fresh idle slice (or a short real delay as the fallback), so this queue
      // never behaves like one long blocking task even across several profiles.
      await new Promise(resolve => {
        if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 5000 });
        else setTimeout(resolve, 50);
      });
    }
  } finally {
    __pdfPreRenderQueueState.running = false;
  }
}

// Triggers a real browser download of an already-built Blob without going through html2pdf/jsPDF again
// - used for a fresh cache hit in exportProfileToPdfInner below.
function downloadPdfBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportAllProfilesAsZip() {
  if (typeof html2pdf === 'undefined' || typeof JSZip === 'undefined') {
    alert(bt('Export is temporarily unavailable - please check your internet connection and try again.','导出功能暂时无法使用——请检查网络连接后重试。'));
    return;
  }
  const profiles = getAllExistingProfiles();
  if (!profiles.length) return;
  const btn = document.getElementById('btnExportAllZip');
  const originalText = btn ? btn.innerHTML : null;
  if (btn) { btn.disabled = true; btn.innerHTML = bt('⏳ Generating...','⏳ 生成中...'); }
  try {
    const zip = new JSZip();
    for (const p of profiles) {
      const safeName = p.name.replace(/[^a-z0-9]+/gi, '_');
      const blob = await buildProfilePdfBlob(p.prefix);
      zip.file(`${safeName}_${p.prefix}.pdf`, blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url; a.download = `Illuminate_All_Profiles_${new Date().toISOString().slice(0,10)}.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(bt('Export failed - please try again.','导出失败——请重试。'));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
  }
}

// ENHANCEMENT (this round): extracted the actual 7-part content-building logic out of
// renderStandardDeepAnalysis into this shared helper, so a NEW raw variant (below) can reuse the
// exact same content without ALSO wrapping it in its own "View Details" button + registry entry.
// This was needed for the hourly chart compression - embedding a full renderStandardDeepAnalysis
// button inside another already-compressed pop-up would nest two levels of "click to reveal" behind
// each other and leave orphaned registry entries, when the actual goal was one click revealing
// everything for that hour. renderStandardDeepAnalysis's own behaviour (button + registry) is
// completely unchanged for its many other existing call sites throughout the app.
function buildDeepAnalysisContentHTML(title, chars, exp, traits, hl, pos, neg, cau, opts = null) {
  title = trTitle(title);
  const L = DEEP_ANALYSIS_LABELS[lang === 'zh' ? 'zh' : 'en'];
  const cap2 = (arr) => { const seen = new Set(); const out = []; for (const item of (arr || [])) { if (!seen.has(item)) { seen.add(item); out.push(item); } if (out.length === 3) break; } return out; };
  hl = cap2(hl); pos = cap2(pos); neg = cap2(neg); cau = cap2(cau);
  const listToLi = (arr) => (arr || []).map(i => `<li>${i}</li>`).join('');
  let extraHTML = '';
  if (opts?.remedies?.length) {
    extraHTML += `<div style="color:#1565c0;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)"><strong>8. ${L.remedies}:</strong><ul style="margin:4px 0 0;padding-left:20px">${listToLi(cap2(opts.remedies))}</ul></div>`;
  }
  if (opts?.frictions?.length) {
    extraHTML += `<div style="color:var(--danger);margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)"><strong>${opts?.remedies?.length ? '9' : '8'}. ${L.frictions}:</strong><ul style="margin:4px 0 0;padding-left:20px">${cap2(opts.frictions).map(f => `<li><strong>${f.friction}</strong> — <em>${L.manageBy}:</em> ${f.management}</li>`).join('')}</ul></div>`;
  }
  if (opts?.summary) {
    const n = 8 + (opts?.remedies?.length ? 1 : 0) + (opts?.frictions?.length ? 1 : 0);
    extraHTML += `<div style="color:var(--plum);margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)"><strong>${n}. ${L.summary}:</strong> ${opts.summary}</div>`;
  }
  return `
    <div style="padding:15px;font-size:12px;line-height:1.6">
      <h4 style="color:var(--plum);margin:0 0 10px 0;font-size:15px;border-bottom:2px solid var(--sand);padding-bottom:6px">${title || L.title_fallback}</h4>
      <div style="color:var(--ink)"><strong>1. ${L.characteristics}:</strong> ${chars}</div>
      <div style="color:var(--ink);margin-top:6px"><strong>2. ${L.explanation}:</strong> ${exp}</div>
      <div style="color:var(--ink);margin-top:6px;margin-bottom:10px"><strong>3. ${L.traits}:</strong> ${traits}</div>
      <div style="color:var(--plum);margin-bottom:10px"><strong>4. ${L.highlights}:</strong><ul style="margin:4px 0 0;padding-left:20px">${listToLi(hl)}</ul></div>
      <div style="color:var(--success);margin-bottom:10px"><strong>5. ${L.positives}:</strong><ul style="margin:4px 0 0;padding-left:20px">${listToLi(pos)}</ul></div>
      <div style="color:var(--warning);margin-bottom:10px"><strong>6. ${L.negatives}:</strong><ul style="margin:4px 0 0;padding-left:20px">${listToLi(neg)}</ul></div>
      <div style="color:var(--danger)"><strong>7. ${L.cautions}:</strong><ul style="margin:4px 0 0;padding-left:20px">${listToLi(cau)}</ul></div>
      ${extraHTML}
    </div>
  `;
}
// Raw variant: returns the content directly (for embedding inside a pop-up that's already the
// "click to reveal" mechanism for its container, like the hourly chart), with no button/registry.
function renderStandardDeepAnalysisRaw(title, chars, exp, traits, hl, pos, neg, cau, opts = null) {
  return buildDeepAnalysisContentHTML(title, chars, exp, traits, hl, pos, neg, cau, opts);
}

// BUG FIX: the Deep Analysis / stats modal used to always appear as a bottom sheet regardless of
// where its triggering button was on the page - now positioned near the actual click point instead,
// for every situation that opens this shared modal (Deep Analysis buttons throughout the chart
// sections, and the lottery accuracy "View Details" pop-ups). Since the modal's rendered size isn't
// known until its (variable-length) content is in the DOM, this measures the box AFTER content is
// set, then computes a clamped position so it never overflows the viewport - preferring to open
// below-and-right of the click, but flipping to above/left whenever there isn't enough room, exactly
// like a native context menu or tooltip would.
// MOBILE FIX: below the same breakpoint as the CSS's full-screen override (480px), the modal fills
// the entire screen instead of anchoring near the tap - on a narrow phone screen, the box is close to
// the full width anyway, so it usually just gets clamped to a corner rather than genuinely sitting
// near the tap point; full-screen is both simpler and more usable there. In that case there's no
// position to compute at all (the CSS's `position:fixed; inset:0` handles it), so this returns early
// without touching left/top, rather than doing pointless work whose result would be overridden anyway.
const MOBILE_MODAL_BREAKPOINT = 480;
function positionModalNearClick(box, clickX, clickY) {
  if (window.innerWidth <= MOBILE_MODAL_BREAKPOINT) return;
  const margin = 10;
  // Measure after the content is already in place (innerHTML is set just before this is called).
  const boxW = box.offsetWidth;
  const boxH = box.offsetHeight;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let left = clickX + margin;
  let top = clickY + margin;

  // Flip to the other side of the click if the default placement would overflow.
  if (left + boxW > viewportW - margin) left = clickX - boxW - margin;
  if (top + boxH > viewportH - margin) top = clickY - boxH - margin;

  // Final clamp: however it was placed, never let any edge go off-screen.
  left = Math.max(margin, Math.min(left, viewportW - boxW - margin));
  top = Math.max(margin, Math.min(top, viewportH - boxH - margin));

  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
}

// CHINESE LANGUAGE FIX: every deep-analysis card's TITLE was passed in as a raw, un-translated English
// string at each of the ~50+ call sites across the app - the single largest remaining source of
// English-only content when Chinese is selected. Fixed centrally here so no call site needs editing.
const TITLE_ZH = {
  'Name Five Grids Deep Analysis': '姓名五格深度分析',
  'Ba Zhai Compass Deep Profile': '八宅罗盘深度分析', 'BaZi Macro Structure Deep Analysis': '八字宏观结构深度分析',
  'Business Partner Strategic Alignment Profile': '事业伙伴战略契合分析', 'Consolidated Face, Left Palm & Right Palm Deep Analysis': '面相与左右手相综合深度分析',
  'Day Master (日主) Deep Analysis': '日主深度分析', 'Face Reading Deep Analysis': '面相深度分析',
  'Full Household Roster Deep Analysis': '家庭成员整体深度分析', 'I-Ching Natal Hexagram Profile': '本命卦深度分析',
  'Left Palm Reading Deep Analysis': '左手相深度分析', 'Life Partner Deep Compatibility Profile': '伴侣契合度深度分析',
  'Luan Tou Form School Deep Analysis': '峦头形势派深度分析',
  'Numerology Life Path Profile': '生命数字深度分析', 'QMDJ Natal Palace Deep Profile': '奇门遁甲命宫深度分析',
  'Right Palm Reading Deep Analysis': '右手相深度分析', 'Sun Sign Astrology Profile': '太阳星座深度分析',
  'Zi Wei Dou Shu Life/Body Palace Deep Profile': '紫微斗数命身宫深度分析', 'Bone Weight Deep Analysis': '称骨深度分析',
  'Name Compatibility Deep Analysis': '姓名契合度深度分析', 'Chinese Name vs BaZi Deep Analysis': '中文姓名与八字契合深度分析',
  'English Name vs BaZi Deep Analysis': '英文姓名与八字契合深度分析', 'Combined English + Chinese Name vs BaZi Deep Analysis': '中英文姓名综合八字契合深度分析'
};
function trTitle(title) {
  if (lang !== 'zh' || !title) return title;
  if (TITLE_ZH[title]) return TITLE_ZH[title];
  let m;
  if ((m = title.match(/^(.+?) Compatibility with (.+?) \((Life Partner|Business Partner)\)$/))) {
    const moduleZh = { 'Astrology':'占星','Bone Weight':'称骨','I Ching':'易经','Numerology':'数字命理','Qi Men Dun Jia':'奇门遁甲','Zi Wei Dou Shu':'紫微斗数' }[m[1]] || m[1];
    const partnerZh = m[3] === 'Life Partner' ? '伴侣' : '事业伙伴';
    return `${moduleZh}契合度分析 - ${m[2]}（${partnerZh}）`;
  }
  if ((m = title.match(/^(.+?) - (Life Partner|Business Partner)$/))) {
    const partnerZh = m[2] === 'Life Partner' ? '伴侣' : '事业伙伴';
    return `${m[1]} - ${partnerZh}`;
  }
  if ((m = title.match(/^Zodiac Deep Profile - (.+)$/))) return `生肖深度分析 - ${m[1]}`;
  if ((m = title.match(/^Household Ba Zhai Reading - You & (.+)$/))) return `家庭方位分析 - 您与${m[1]}`;
  if ((m = title.match(/^Advice for Today - (.+)$/))) return `今日建议 - ${m[1]}`;
  if ((m = title.match(/^(\d+) - (\d+) Years Old \(10-Year Cycle, (.+?)\) \[(.+)\]$/))) return `${m[1]} - ${m[2]} 岁（十年大运，${m[3]}）[${m[4]}]`;
  if ((m = title.match(/^(.+?) Deep Analysis$/))) return `${m[1]}深度分析`;
  return title; // fall back to English if no rule matches, rather than showing nothing
}

// ENHANCEMENT (this round): deep-analysis content is now collapsed behind a clickable button that
// opens a shared modal popup, instead of always rendering the full 7-section card inline - this is
// the single biggest lever for reducing page length, since renderStandardDeepAnalysis is called 30+
// times per chart. Centralising the change here means every call site benefits automatically.
let deepAnalysisIdCounter = 0;
const deepAnalysisRegistry = {}; // id -> full HTML content, looked up by the modal's open handler
// ENHANCEMENT (this round): PDF export mode - when true, renderStandardDeepAnalysis returns the full
// analysis content directly instead of a "View Details" button, since a PDF is a static document with
// no click interaction available. Toggled on for the duration of building PDF content, then off again.
let pdfExportMode = false;
// BUG FIX (root cause of the Hourly-tab lag "recurring and getting worse the longer the app is used",
// finally found this round via a full re-audit of every function feeding deepAnalysisRegistry, not just
// the Hourly-tab code path already fixed in an earlier round): renderStandardDeepAnalysis (the comment
// two lines up already noted it runs 30+ times per chart) registers a BRAND NEW deepAnalysisRegistry
// entry - keyed by an ever-incrementing counter, so it always ADDS, never overwrites - on every single
// call, and until now nothing ever removed those entries again except the Hourly tab's own separate,
// self-contained cleanup (__hourlyPopupIds). Every renderAllViews() (home/chart/partnerView/bizView -
// triggered on nearly every navigation, every save, every language toggle), every renderChildrenTab(),
// and every renderDetailedReadingTab() call re-registers a fresh batch of 30-150+ entries (more with
// more profiles/children) while the PREVIOUS batch - already replaced and unreachable in the live DOM,
// since every one of those functions fully rebuilds its container's innerHTML on each call - is left
// behind forever. Across a real session (repeated navigation, edits, tab switches - exactly the kind of
// use a real test session before reaching the Hourly tab would involve, but a short scripted reproduction
// would not), this grows into thousands of retained multi-paragraph HTML strings, none of it freed by a
// normal minor GC because it is genuinely still reachable (through deepAnalysisRegistry itself). The
// Hourly tab's own computation is the single heaviest allocation burst anywhere in the app (12 fresh
// chart casts at once), so it is the burst most likely to finally force a major GC pause under that
// accumulated heap pressure - and a major GC pause can legitimately run into multiple seconds, occurring
// around event dispatch/scheduling in a way a performance.now() timer placed inside the click handler
// itself won't capture, matching the reported "the app's own timer still reads fast, but it still lags"
// symptom exactly. Fix: track every id this shared helper registers, and purge the previous batch (which
// is provably orphaned the moment a new one is generated, since the DOM content it belonged to has
// already been overwritten by then) at the start of every function that rebuilds one of these batches -
// see purgeMainDeepAnalysisIds() and its call sites in renderAllViews/renderChildrenTab below.
// (renderDetailedReadingTab's content is built by generateDetailedReading, which never calls
// renderStandardDeepAnalysis - it has no buttons/registry entries of this kind to purge.)
let __mainDeepAnalysisIds = [];
function purgeMainDeepAnalysisIds() {
  __mainDeepAnalysisIds.forEach(id => { delete deepAnalysisRegistry[id]; });
  __mainDeepAnalysisIds = [];
}

// ENHANCEMENT (this round): chart tab system - each profile's 15 systems are grouped into 4 tabs
// (Core/Timing/Environment/More). All 4 tabs' HTML is built once per render (cheap - just string
// concatenation) and cached here, keyed by prefix ('i'/'p'/'b'), but only the ACTIVE tab's HTML is
// ever inserted into the DOM - switching tabs swaps the DOM content from this cache rather than
// rebuilding it, and non-active tabs' large collapsible sections never bloat the live page at all.
const chartTabRegistry = {};
// Maps every section id to the tab that contains it, so the home-screen shortcut buttons
// (data-reading) can switch to the right tab before opening/scrolling to that section.
const SECTION_TAB_MAP = {
  nameanalysis: 'core', zodiac: 'core', mingli: 'core', healthdiagnosis: 'core',
  iching: 'core', xiangshu: 'core', boneweight: 'core',
  dayun: 'timing', sanshi: 'timing', qmdj: 'timing', zeri: 'timing',
  ziweidoushu: 'environment', fengshui: 'environment',
  numerology: 'more', westernastrology: 'more'
};
// ENHANCEMENT (this round): switches which tab's content is shown in a chart's tab panel, pulling
// from chartTabRegistry (built fresh on every renderSystemChart call) rather than rebuilding HTML.
function switchChartTab(prefix, tabName) {
  const panel = document.getElementById(`chartTabPanel_${prefix}`);
  const registryForPrefix = chartTabRegistry[prefix];
  if (!panel || !registryForPrefix || !registryForPrefix[tabName]) return false;
  // BUG FIX (reported: "Feng Shui analysis not appearing after an address is added"): each tab's HTML
  // is cached as a plain string, captured once when the profile chart is first opened. Interactive
  // edits inside a tab (picking a Feng Shui direction, saving a home address/construction year, etc.)
  // patch the LIVE DOM directly for instant feedback, but never touched that cached string - so the
  // moment the user switched to another tab and back, this function overwrote the live, edited DOM
  // with the stale original copy, making the just-entered Feng Shui reading (or anything else edited
  // in any tab) appear to silently disappear. Fix: before swapping tabs, save the tab being LEFT back
  // into the registry from its current live DOM, so edits always survive a round trip.
  const activeBtn = document.querySelector(`.chartTabBtn[data-prefix="${prefix}"].active`);
  const currentTab = activeBtn ? activeBtn.dataset.tab : null;
  if (currentTab && currentTab !== tabName && registryForPrefix[currentTab] !== undefined) {
    registryForPrefix[currentTab] = panel.innerHTML;
  }
  panel.innerHTML = registryForPrefix[tabName];
  $$(`.chartTabBtn[data-prefix="${prefix}"]`).forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  return true;
}

function renderStandardDeepAnalysis(title, chars, exp, traits, hl, pos, neg, cau, opts = null) {
  title = trTitle(title);
  const L = DEEP_ANALYSIS_LABELS[lang === 'zh' ? 'zh' : 'en'];
  const fullHTML = buildDeepAnalysisContentHTML(title, chars, exp, traits, hl, pos, neg, cau, opts);
  if (pdfExportMode) {
    // BUG FIX (reported: "some labels are duplicated with a magnifying glass icon"): this used to print
    // its own "🔍 <title>" line here AND embed fullHTML, which independently renders the same title as
    // its own <h4> heading (see buildDeepAnalysisContentHTML) - so every deep-analysis block in the PDF
    // showed its title twice in a row. fullHTML already carries the title, so nothing extra is added here.
    return `<div style="margin-top:12px;padding:10px 14px;background:#f5f3ec;border:1px solid var(--line);border-radius:8px">
      ${fullHTML}
    </div>`;
  }
  const id = 'da_' + (deepAnalysisIdCounter++);
  deepAnalysisRegistry[id] = fullHTML;
  // BUG FIX (see purgeMainDeepAnalysisIds' own comment above deepAnalysisRegistry's declaration): track
  // every id this shared helper registers, so the batch this belongs to can be purged in one shot the
  // next time the caller rebuilds its container, instead of accumulating forever.
  __mainDeepAnalysisIds.push(id);
  return `<button class="btnViewDeepAnalysis" data-id="${id}" style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:12px;padding:10px 14px;background:#f5f3ec;border:1px solid var(--line);border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;color:var(--plum);text-align:left">
    <span>🔍 ${title || L.title_fallback}</span>
    <span style="color:var(--muted);font-weight:400;font-size:11px">${bt('View Details','查看详情')} ›</span>
  </button>`;
}

// BUG 1/3 FIX: Shared helper that renders a set of labelled columns in the SAME table format as the
// BaZi Natal Chart (grey header row + white value row), for consistency across Zodiac, I Ching, etc.
// CHINESE LANGUAGE FIX: common labelled-row field names, translated once and auto-applied by
// renderInfoRows/renderPillarStyleTable below - covers the most frequently repeated labels across
// the app (Zodiac, BaZi, QMDJ, Numerology, Astrology, Ba Zhai, etc.) without needing to touch every
// individual call site.
const ROW_LABEL_ZH = {
  'Life Zodiac':'生肖','Zodiac Allies':'生肖三合','Hidden Ally':'暗合','Conflict':'生肖相冲',
  'Natal Hexagram':'本命卦','Compatible Hexagrams':'相合卦象','Incompatible Hexagrams':'相冲卦象',
  'Day Master':'日主','Solar Term / Dun Type':'节气／遁类型',"Today's Solar Term / Dun":'今日节气／遁类型','Your Palace Today':'今日值宫','Your Door Today':'今日值门','Ju Shu (Bureau Number)':'局数','Life Palace':'命宫','Life Door':'生门位','Wealth Palace':'财帛宫',
  'Tai Yi Macro Rating':'太乙宏观评级',
  'Life Palace (命宫)':'命宫','Body Palace (身宫)':'身宫',
  'Lunar Year Weight':'农历年重量','Lunar Month Weight':'农历月重量','Lunar Day Weight':'农历日重量','Birth Hour Weight':'出生时辰重量','Total Bone Weight':'总骨重','Fate Tier':'命格等级',
  'Ba Zhai Kua':'八宅命卦',
  'Life Path Number':'生命数字','Life Lucky Number (4-digit)':'幸运号码（四位）','Favorable Numbers':'有利数字','Avoid Numbers':'避免数字',
  'Sun Sign':'太阳星座','Compatible Signs':'相合星座','Incompatible Signs':'不合星座',
  'Da Yun Start Year':'大运起运年','Exact Start Calculation':'精确起运计算','Current Age':'现龄',
  'Overall Compatibility Score':'总体契合度评分','Total Bone Weight Gap':'骨重差距',
  'English Name':'英文姓名','Chinese Name':'中文姓名','Gender':'性别','Birth Date & Time':'出生日期与时间','Lunar Birth Date':'农历生辰','Zodiac Animal':'生肖','Kua Group & Number':'命卦组别与命卦数'
};
function trLabel(label) { return (lang === 'zh' && ROW_LABEL_ZH[label]) ? `${ROW_LABEL_ZH[label]} / ${label}` : label; }

// CHINESE LANGUAGE FIX: section headers like "Name Analysis (姓名学)" always showed English first
// regardless of the toggle. This flips the primary/parenthetical order based on the active language,
// so Chinese-primary is genuinely shown (not just present) when Chinese is selected.
function flipTitle(text) {
  const m = text.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!m) return text;
  return lang === 'zh' ? `${m[2]} (${m[1]})` : text;
}

// ENHANCEMENT (this round): wraps a whole major section (which currently starts with a
// `<h2 class="section-header" [id="..."]>TITLE</h2>` header) into a collapsible <details> element,
// moving the id from the h2 onto the <details> itself so the existing scroll-to-section shortcut
// navigation can still find and open it. Applied as a post-processing step so none of the ~15
// individual section-building blocks needed to be rewritten. Falls back to returning the HTML
// unchanged if the expected header pattern isn't found, so this can never silently eat content.
function wrapSectionCollapsible(html, openByDefault = false) {
  const m = html.match(/^\s*<h2 class="section-header"\s*(id="[^"]*")?\s*>([\s\S]*?)<\/h2>/);
  if (!m) return html; // unexpected shape - leave untouched rather than risk losing content
  const idAttrStr = m[1] || '';
  const titleHtml = m[2];
  const rest = html.slice(m[0].length);
  // ENHANCEMENT (this round, suggested: "collapse-by-default should be remembered per-section, not
  // reset every visit"): a section with an id can have its remembered open/closed state (see
  // getSectionOpenState/setSectionOpenState + the delegated 'toggle' listener in initListeners)
  // override whatever this call site passed as openByDefault - so re-opening the app respects what a
  // person actually had open last time, rather than resetting to each section's hardcoded default on
  // every single visit. A section with no id (this app currently gives every persistent section one)
  // simply falls back to openByDefault, since there's nothing to key the remembered state on.
  const idMatch = idAttrStr.match(/id="([^"]*)"/);
  const sectionId = idMatch ? idMatch[1] : null;
  const savedOpenState = sectionId ? getSectionOpenState(sectionId) : null;
  const isOpen = savedOpenState !== null ? savedOpenState : openByDefault;
  return `<details class="section-details" ${idAttrStr} ${isOpen ? 'open' : ''}>
    <summary class="section-summary"><span>${titleHtml}</span><span class="section-chevron">▸</span></summary>
    <div class="section-details-body">${rest}</div>
  </details>`;
}
// ENHANCEMENT (this round): per-section collapsed/expanded state, remembered across visits/reloads via
// a simple device-level localStorage map (same lightweight pattern already used for the language
// toggle, `illuminate_lang` - not part of the main account-data blob, since this is a per-device
// display preference, not account data). Best-effort throughout: a read/write failure (private
// browsing, storage disabled, corrupted JSON) never throws or blocks rendering - it just means the
// section falls back to its normal hardcoded openByDefault for that one call, exactly as before this
// feature existed.
const SECTION_STATE_STORAGE_KEY = 'illuminate_section_state';
function getSectionOpenState(sectionId) {
  try {
    const raw = localStorage.getItem(SECTION_STATE_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return typeof map[sectionId] === 'boolean' ? map[sectionId] : null;
  } catch (e) { return null; }
}
function setSectionOpenState(sectionId, isOpen) {
  try {
    const raw = localStorage.getItem(SECTION_STATE_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[sectionId] = !!isOpen;
    localStorage.setItem(SECTION_STATE_STORAGE_KEY, JSON.stringify(map));
  } catch (e) { /* best-effort only - see comment above */ }
}

// REMOVED (reported: "The what's new should be removed from the landing page. Document in the notes
// and instructions instead"): the What's New banner (WHATS_NEW_VERSION/TEXT constants,
// maybeShowWhatsNewBanner, and its dismiss-button wiring) is gone. Each round's headline changes now
// only live in UPDATE_NOTES_AND_INSTRUCTIONS.md's own "Latest enhancement" section.

// CHINESE LANGUAGE FIX (pill sub-headings): the small "pill" labels used as sub-section titles
// throughout every module (e.g. "Zodiac Profile", "BaZi Natal Chart") were 100% English regardless
// of the language toggle. Dictionary-driven so every call site benefits without individual edits.
const PILL_LABEL_ZH = {
  'Zodiac Profile':'生肖详解','BaZi Natal Chart':'八字本命盘','Cheng Gu Suan Ming':'称骨算命',
  'Household Occupants (up to 10)':'家庭成员（最多10位）','Ba Zhai Compass School (理气)':'八宅罗盘派（理气）',
  'Luan Tou (峦头) - Form School':'峦头 - 形势派','I Ching Divination':'易经卜卦','Check a Specific Date':'查询特定日期',
  'Consolidated Face & Palmistry':'面相与手相综合分析','Face (面相) Individual Deep Analysis':'面相单项深度分析',
  'Left Palm (左手) Individual Deep Analysis':'左手单项深度分析','Right Palm (右手) Individual Deep Analysis':'右手单项深度分析',
  'Current & 3-Year Real Planetary Transits (Outer Planets to Natal Sun)':'今年及未来三年真实行星行运（外行星对本命太阳）','Life Partner Compatibility Reading':'伴侣契合度分析',
  'Business Partner Alignment Reading':'事业伙伴契合度分析','Household Reading - You & Life Partner':'家庭方位分析 - 您与伴侣','Household Reading - You &amp; Life Partner':'家庭方位分析 - 您与伴侣',
  'QMDJ Compatibility':'奇门遁甲契合度','Zi Wei Compatibility':'紫微斗数契合度','Bone Weight Compatibility':'称骨契合度',
  'I Ching Compatibility':'易经契合度','Numerology Compatibility':'数字命理契合度','Astrology Compatibility':'占星契合度',
  'Life Partner':'伴侣','Business Partner':'事业伙伴','Karmic Debt & Past Lives':'因果业力与前世',
  '3-Year Monthly Da Yun Forecast':'未来三年逐月大运预测','3-Year Monthly Western Astrology Match':'未来三年西方占星逐月契合'
};
function trPill(text) {
  if (lang !== 'zh') return text;
  if (PILL_LABEL_ZH[text]) return `${PILL_LABEL_ZH[text]} / ${text}`;
  let m;
  // Handle "X Compatibility with Y (Life/Business Partner)" pattern dynamically
  if ((m = text.match(/^(.+?) Compatibility with (.+?) \((Life Partner|Business Partner)\)$/))) {
    const moduleZh = { 'Astrology':'占星','Bone Weight':'称骨','I Ching':'易经','Numerology':'数字命理','Qi Men Dun Jia':'奇门遁甲','Zi Wei Dou Shu':'紫微斗数' }[m[1]] || m[1];
    const partnerZh = m[3] === 'Life Partner' ? '伴侣' : '事业伙伴';
    return `${moduleZh}契合度 - ${m[2]}（${partnerZh}）/ ${text}`;
  }
  // Handle "X vs BaZi Compatibility" pattern (Name compatibility sections)
  if ((m = text.match(/^(English|Chinese) Name vs BaZi Compatibility$/))) {
    return `${m[1] === 'Chinese' ? '中文' : '英文'}姓名与八字契合度 / ${text}`;
  }
  if (text === 'Combined Name (English + Chinese) vs BaZi Compatibility') return `中英文姓名综合八字契合度 / ${text}`;
  // Handle "X Compatibility - Life/Business Partner" pattern dynamically
  if ((m = text.match(/^(.+?) - (Life Partner|Business Partner)$/))) {
    if (PILL_LABEL_ZH[m[1]] && PILL_LABEL_ZH[m[2]]) return `${PILL_LABEL_ZH[m[1]]} - ${PILL_LABEL_ZH[m[2]]} / ${text}`;
  }
  return text;
}
// CHINESE LANGUAGE FIX (body text): returns the Chinese variant when the toggle is set to 中文 and a
// translation is supplied, otherwise falls back to English. Used throughout generateDeepAnalysisData
// to translate the actual narrative sentences (not just labels/structure).
function bt(en, zh) { return (lang === 'zh' && zh) ? zh : en; }

// ENHANCEMENT (this round, suggested: "consistent iconography for 'requires input before this
// section shows anything' - several sections (Flying Star property chart, Address Compatibility) only
// render real content once specific fields are filled in; a small consistent visual marker (rather
// than each section writing its own prose explanation) would make it faster to spot, at a glance,
// which sections still need setup"). One tiny helper, one consistent badge - used wherever a pill's
// real content is gated behind a field a person hasn't filled in yet, rather than each call site
// inventing its own wording for the same idea.
function needsInputBadge(isReady) {
  if (isReady) return '';
  return `<span class="needs-input-badge">${bt('Needs setup', '待设置')}</span>`;
}

function renderPillarStyleTable(pairs) {
  return `<table style="width:100%; text-align:center; margin-top:10px; border-collapse:collapse; font-size:13px; background:#fff;">
    <tr style="background:#f4f4f4">${pairs.map(pr => `<th style="padding:6px; border:1px solid #ddd">${trLabel(pr.label)}</th>`).join('')}</tr>
    <tr>${pairs.map(pr => `<td style="padding:8px; border:1px solid #ddd"><span style="color:${pr.color || 'var(--plum)'};font-weight:bold">${pr.value}</span></td>`).join('')}</tr>
  </table>`;
}

// Shared helper to render a set of labelled, color-coded rows (one item per row)
function renderInfoRows(rows) {
  return `<div style="margin:10px 0">${rows.map(r => `
    <div style="padding:9px 12px;margin:6px 0;border-radius:0 8px 8px 0;background:${r.bg || '#f5f3ec'};border-left:4px solid ${r.color || 'var(--gold)'}">
      <strong style="color:${r.color || 'var(--plum)'}">${trLabel(r.label)}:</strong> <span style="color:var(--ink)">${r.value}</span>
    </div>`).join('')}</div>`;
}

// BUG 9 FIX: "Suggested Positions for Favourable Activities" - maps each Auspicious door to its
// traditional recommended activity type, plus the Yi Ma (travel) palace, into a single reusable
// block used for BOTH the natal QMDJ chart and the daily/hourly QMDJ readings.
const DOOR_ACTIVITY_MAP = {
  'Kai Men (开门)': bt('officialdom, applications, new ventures, meetings with authority', '官务、申请、新事业、与当权者会面'),
  'Xiu Men (休门)': bt('rest, recuperation, romance/marriage matters, socialising', '休养、恋爱／婚姻事务、社交聚会'),
  'Sheng Men (生门)': bt('wealth, business deals, investments, growth-oriented activity', '财运、商业交易、投资、拓展性事务')
};
// AUDIT FIX (used by generateDeepAnalysisData's 'qmdj_door' case): each door's own traditional
// governing domain, kept as a plain {en, zh} pair (not resolved through bt() at load time like
// DOOR_ACTIVITY_MAP above, since the door-deep-dive text needs to pick en/zh live per render) so
// the 3 Auspicious doors - and separately, the 3 Caution doors - no longer produce identical
// boilerplate differing only by door name. Covers all 6 doors this app ever surfaces a deep-dive
// for (Du Men and the Jing Men (景门) "View" door are Neutral and never reach this code path).
const QMDJ_DOOR_DOMAIN = {
  'Kai Men (开门)': { en: 'officialdom, applications, new ventures, and meetings with authority', zh: '官务、申请、新事业以及与当权者会面' },
  'Xiu Men (休门)': { en: 'rest, recuperation, and romance/marriage matters', zh: '休养以及恋爱／婚姻事务' },
  'Sheng Men (生门)': { en: 'wealth, business deals, and growth-oriented investment', zh: '财运、商业交易以及拓展性投资' },
  'Shang Men (伤门)': { en: 'physically risky or confrontational activity, and disputes', zh: '具人身风险或对抗性质的活动，以及纠纷' },
  'Si Men (死门)': { en: 'major new commitments and health-related decisions', zh: '重大新承诺以及健康相关的决定' },
  'Jing Men (惊门)': { en: 'legal proceedings, contentious negotiations, and matters prone to sudden shocks', zh: '法律程序、争议性谈判，以及容易发生突发变故的事务' }
};
const QMDJ_DIR_LABEL = {1:bt('North','北'),2:bt('Southwest','西南'),3:bt('East','东'),4:bt('Southeast','东南'),6:bt('Northwest','西北'),7:bt('West','西'),8:bt('Northeast','东北'),9:bt('South','南')};
// ENHANCEMENT (requested directly: "The profile readings and charts for all needs to take into account
// all aspects of metaphysics calculations in the app, chinese, western, etc" - one of the 3 follow-on
// items scoped after the astro_compat % fix, completed per "proceed to complete all pending items"):
// which of this app's 3 cross-system synthesis domains (Career/Wealth/Relationships) a person's own
// natal QMDJ Life Door maps cleanly onto - only the 3 doors with an unambiguous match to one of those
// domains (Kai Men=officialdom -> Career, Sheng Men=wealth -> Wealth, Xiu Men=romance -> Relationships)
// are mapped; the other 3 doors (Shang Men/Si Men/Jing Men) govern domains outside this synthesis
// reading's 3-category scope and are honestly left unmapped rather than forced into a poor fit.
const QMDJ_DOOR_TO_SYNTHESIS_DOMAIN = { 'Kai Men (开门)': 'career', 'Sheng Men (生门)': 'wealth', 'Xiu Men (休门)': 'relationships' };
// Standard, classically-established Western-astrology convention for financial/spending TEMPERAMENT by
// Element (the same kind of public reference already relied on elsewhere in this app for Element/
// Modality associations) - used here for the Cross-System Synthesis's Wealth domain via the natal
// Venus's own sign Element, since no single "wealth house" field exists elsewhere in this app's Western
// astrology engine without also requiring a birth latitude (see computeNatalHouses).
const WESTERN_ELEMENT_MONEY_STYLE = {
  Fire: { en: 'bold, opportunistic, and willing to take a calculated financial risk for a fast return', zh: '大胆、善于把握机会，愿意为求快速回报而承担经过计算的财务风险' },
  Earth: { en: 'steady, security-minded, and inclined to build wealth slowly through tangible, durable assets', zh: '稳健、重视保障，倾向透过实质、耐久的资产缓慢累积财富' },
  Air: { en: 'idea- and network-driven, often earning through information, connections, or flexible/varied income streams', zh: '以理念与人脉驱动，常透过信息、人际关系或灵活多元的收入来源获利' },
  Water: { en: 'intuitive and cautious, sensing financial tides emotionally and preferring to keep a protective cushion in reserve', zh: '直觉且谨慎，凭感受察觉财务风向，偏好保留一层防护性的储备资金' }
};
// ============================================================
// Cross-System Profile Synthesis (requested directly, one of the 3 follow-on items scoped after the
// astro_compat % fix - "the profile readings and charts for all needs to take into account all aspects
// of metaphysics calculations in the app, chinese, western, etc"): rather than each of BaZi, Zi Wei Dou
// Shu, Qi Men Dun Jia, and Western astrology only ever rendering its own separate, isolated section (as
// every other reading in this app already does), this cross-references what each of those 4 already-
// verified, already-computed systems independently says about the SAME 3 real-world life domains
// (Career, Wealth, Relationships) side by side in one place.
//
// HONESTY NOTE (per the standing "nothing half baked, all must be factual and defensible" instruction):
// this deliberately does NOT claim the 4 systems "agree" or "disagree", or blend them into one number.
// BaZi (Ten Gods), Zi Wei Dou Shu (palace/star placement), Qi Men Dun Jia (Door domains), and Western
// astrology (Sun/Venus sign traits) are 4 structurally independent traditions with different mechanisms
// and no established cross-framework equivalence - claiming genuine "convergence" between them would be
// exactly the kind of fabricated synthesis the standing instruction rules out. What this DOES do is pull
// each system's own real, already-computed, already-verified signal for the same domain and lay them out
// together for the person's own review - a genuine synthesis of PRESENTATION, not of claimed meaning.
//
// Every value below traces back to a function/table that already exists elsewhere in this app for that
// system's own dedicated section (computeAllTenGods, ZWDS_PALACE_NAMES_BY_STEP_BACK/starsByBranch/
// ZWDS_STAR_MEANING, QMDJ's wealthPalace/lifeDoor, SIGN_PROFILE_TABLE) - nothing new is computed here
// except the domain-bucketing logic itself.
const TEN_GOD_FAMILY = {
  'Direct Officer': 'officer', 'Seven Killings': 'officer',
  'Direct Wealth': 'wealth', 'Indirect Wealth': 'wealth',
  'Eating God': 'output', 'Hurting Officer': 'output',
  'Direct Resource': 'resource', 'Indirect Resource': 'resource',
  'Peer': 'peer', 'Rob Wealth': 'peer'
};
const TEN_GOD_FAMILY_THEME = {
  officer: EZ('authority, hierarchy, and structured leadership', '权威、层级架构与结构化的领导力'),
  wealth: EZ('direct income generation and tangible material reward', '直接的收入创造与实质的物质回报'),
  output: EZ('creative/expressive output and building your own path outside a fixed hierarchy', '创造性／表达性的产出，以及在固定体制之外开创自己的道路'),
  resource: EZ('knowledge, mentorship, credentials, and support received from others', '知识、师承、资历，以及来自他人的支持'),
  peer: EZ('independence, self-reliance, and peer/competitive dynamics', '独立自主、自力更生，以及同侪／竞争层面的动态')
};
function zwdsPalaceStarSignals(p, stepBack) {
  const branchIdx = mod(p.ziwei.lifePalaceBranchIdx - stepBack, 12);
  const starsHere = p.ziwei.starsByBranch[branchIdx] || [];
  const stars = starsHere.map(k => {
    const info = ZWDS_MAJOR_STARS[k] || ZWDS_MINOR_STARS[k];
    const meaning = ZWDS_STAR_MEANING[k] || ZWDS_MINOR_STAR_MEANING[k];
    return { key: k, nameEN: info.en.split(' (')[0], nameZH: info.cn, isMajor: !!ZWDS_MAJOR_STARS[k], meaning };
  });
  return { branchIdx, stars };
}
function computeCrossSystemSynthesis(p) {
  if (!p?.bazi || !p?.ziwei || !p?.qmdj || !p?.astro) return null;
  // BaZi: every Ten God across the full chart (3 non-Day-Master visible stems + all 4 branches' hidden
  // stems - the Day Master's own stem is excluded, since it cannot be a Ten God relative to itself),
  // bucketed into the 5 classical Ten God families (TEN_GOD_FAMILY above).
  const tg = computeAllTenGods(p.bazi);
  const allTenGods = [tg.yearStem, tg.monthStem, tg.hourStem,
    ...tg.yearHidden.map(x => x.tenGod), ...tg.monthHidden.map(x => x.tenGod),
    ...tg.dayHidden.map(x => x.tenGod), ...tg.hourHidden.map(x => x.tenGod)];
  const familyCounts = { officer: [], wealth: [], output: [], resource: [], peer: [] };
  allTenGods.forEach(god => { const fam = TEN_GOD_FAMILY[god.en]; if (fam) familyCounts[fam].push(god); });
  const dominantFamily = Object.keys(familyCounts).sort((a, b) => familyCounts[b].length - familyCounts[a].length)[0];
  // BaZi's classical "Spouse Palace" (夫妻宫) is the Day Branch itself - its hidden stems' Ten Gods are
  // the traditional relationship-domain signal, distinct from the whole-chart family tally above.
  const dayBranchTenGods = tg.dayHidden;

  // Zi Wei Dou Shu: Career (官禄, stepBack 8), Wealth (财帛, stepBack 4), and Spouse (夫妻, stepBack 2)
  // palaces - the same San Fang Si Zheng-adjacent palace set this app's own Zi Wei Dou Shu section
  // already surfaces (see artZiWei's tripleHTML), reused here rather than recomputed differently.
  const ziweiCareer = zwdsPalaceStarSignals(p, 8);
  const ziweiWealth = zwdsPalaceStarSignals(p, 4);
  const ziweiSpouse = zwdsPalaceStarSignals(p, 2);

  // Qi Men Dun Jia: the natal Wealth Palace's own Door (always present, regardless of the Life Door) is
  // a genuine, dedicated Wealth-domain signal; the Life Door additionally maps onto Career/Wealth/
  // Relationships only for the 3 doors with an unambiguous match (QMDJ_DOOR_TO_SYNTHESIS_DOMAIN above).
  const wealthPalaceDoor = p.qmdj.grid[p.qmdj.wealthPalace]?.door;
  const wealthPalaceDomain = wealthPalaceDoor ? (QMDJ_DOOR_DOMAIN[wealthPalaceDoor] || null) : null;
  const lifeDoorDomain = QMDJ_DOOR_DOMAIN[p.qmdj.lifeDoor] || null;
  const lifeDoorMapsTo = QMDJ_DOOR_TO_SYNTHESIS_DOMAIN[p.qmdj.lifeDoor] || null;

  // Western astrology: Sun sign career/relationship traits (SIGN_PROFILE_TABLE, already used by the
  // natal deep reading) plus the natal Venus's own sign Element for a Wealth-domain money-temperament
  // read (WESTERN_ELEMENT_MONEY_STYLE above) - Venus is the classical Western significator of personal
  // values/finances (see PLANET_IMPACT_AREAS.venus, already used elsewhere in this app).
  const sunProfile = SIGN_PROFILE_TABLE[p.astro.en];
  const natalChart = computeFullNatalChart(p.bazi.birthMomentUTC);
  const venusSign = natalChart.venus.sign.en;
  const venusElement = ZODIAC_ELEMENT_MODALITY[venusSign].element;
  const moneyStyle = WESTERN_ELEMENT_MONEY_STYLE[venusElement];

  return {
    career: {
      bazi: { count: familyCounts.officer.length, theme: TEN_GOD_FAMILY_THEME.officer, gods: familyCounts.officer, dominantFamily, dominantTheme: TEN_GOD_FAMILY_THEME[dominantFamily] },
      ziwei: ziweiCareer,
      qmdj: lifeDoorMapsTo === 'career' ? { door: p.qmdj.lifeDoor, domain: lifeDoorDomain } : null,
      western: { sign: p.astro.en, careerTraits: sunProfile.careerTraits, careers: sunProfile.careers }
    },
    wealth: {
      bazi: { count: familyCounts.wealth.length, theme: TEN_GOD_FAMILY_THEME.wealth, gods: familyCounts.wealth, dominantFamily, dominantTheme: TEN_GOD_FAMILY_THEME[dominantFamily] },
      ziwei: ziweiWealth,
      qmdj: { wealthPalace: p.qmdj.wealthPalace, door: wealthPalaceDoor, domain: wealthPalaceDomain, lifeDoorAlsoMaps: lifeDoorMapsTo === 'wealth' },
      western: { venusSign, venusElement, moneyStyle }
    },
    relationships: {
      bazi: { dayBranchTenGods, dayBranchCN: branchCN[p.bazi.dayBranchIdx] },
      ziwei: ziweiSpouse,
      qmdj: lifeDoorMapsTo === 'relationships' ? { door: p.qmdj.lifeDoor, domain: lifeDoorDomain } : null,
      western: { sign: p.astro.en, relationshipStyle: sunProfile.relationshipStyle }
    },
    qmdjLifeDoorGeneral: { door: p.qmdj.lifeDoor, domain: lifeDoorDomain, mapsTo: lifeDoorMapsTo }
  };
}
function buildFavourableActivityPositions(qmdjObj) {
  const rows = [];
  for (const pal of [1,2,3,4,6,7,8,9]) {
    const cell = qmdjObj.grid[pal]; if (!cell) continue;
    const rating = QMDJ_DOOR_RATING[cell.door] || 'Neutral';
    if (rating === 'Auspicious' && DOOR_ACTIVITY_MAP[cell.door]) {
      rows.push(`<li><strong>${QMDJ_DIR_LABEL[pal]}</strong> (${bt('Palace','宫')} ${pal}, ${cell.door}): ${DOOR_ACTIVITY_MAP[cell.door]}</li>`);
    }
  }
  if (qmdjObj.yiMaPalace) {
    rows.push(`<li><strong>${QMDJ_DIR_LABEL[qmdjObj.yiMaPalace] || qmdjObj.yiMaPalace}</strong> (${bt('Palace','宫')} ${qmdjObj.yiMaPalace}, ${bt('Yi Ma 驿马','驿马')}): ${bt('travel, relocation, business trips, and other movement-related activity','出行、搬迁、出差及其他与移动相关的事务')}</li>`);
  }
  if (!rows.length) return `<div style="font-size:12px;color:var(--muted)">${bt('No strongly Auspicious doors in this chart - favour low-key, maintenance-type activity over new initiatives.','此盘中无明显吉门——宜以稳健维持为主，避免贸然开创新局。')}</div>`;
  return `<ul style="margin:6px 0 0;padding-left:20px;font-size:12px;line-height:1.7">${rows.join('')}</ul>`;
}

// Data generator providing strict Arrays for the 7 parameters across all required modules
function generateDeepAnalysisData(type, p, extraData = null, rawOnly = false) {
  let chars = bt(`Identified fundamental structure based on ${type} parameters.`, `根据${type}参数识别出的基本结构。`);
  let exp = bt(`This finding reveals the underlying dynamics of your energetic alignment.`, `此发现揭示了您能量对齐背后的深层机制。`);
  let traits = bt(`Demonstrates consistent resilience and adaptability in key areas.`, `在关键领域展现出稳定的韧性与适应力。`);
  let hl = [bt('High ceiling for growth.','成长空间大。'), bt('Favorable elemental balance.','五行平衡有利。'), bt('Strong internal logic.','内在逻辑清晰。')];
  let pos = [bt('Excellent resource utilization.','资源运用能力强。'), bt('Natural intuition.','天生直觉敏锐。'), bt('Quick recovery from setbacks.','逆境恢复力强。')];
  let neg = [bt('Prone to overthinking.','容易过度思虑。'), bt('May attract unnecessary envy.','可能招致不必要的嫉妒。'), bt('Energy fluctuations.','能量起伏不定。')];
  let cau = [bt('Maintain clear boundaries.','保持清晰的界限。'), bt('Do not rush critical decisions.','切勿仓促做重大决定。'), bt('Monitor burnout.','留意过度消耗的迹象。')];
  let opts = null; // optional { remedies, frictions, summary } - rendered as extra sections when set

  if (type === 'qmdj') {
      chars = bt(`Natal Palace located in [${p.palaceName}], derived by tracking your Day Master onto the Heaven Plate: cast from Ju ${p.qmdj.ju} under ${p.dunType}, then rotated so Zhi Fu (值符) moves from the governing Xun's palace to the palace of your true-solar birth hour's Earthly Branch.`,
        `本命宫位于【${p.palaceName}】，由日主在天盘上的位置推算得出：以局数 ${p.qmdj.ju}（${p.dunType}）起局，值符随值符宫旋转至真太阳时出生时辰地支所在宫位。`);
      exp = bt(`Qi Men Dun Jia casts an Earth Plate (Di Pan) from the Bureau Number (Ju Shu), then derives a Heaven Plate (Tian Pan) by rotating the Deity/Star/Door assembly so the Zhi Fu marker - which begins at the palace of the stem your birth decade's hidden Jia rides on - lands on the palace matching your birth hour's Earthly Branch. Your Day Master's position on this rotated Heaven Plate is your Natal (Life) Palace.`,
        `奇门遁甲先依局数排出地盘，再以值符（甲所寄之干所在宫位为起点）随时辰地支旋转排出天盘（神、星、门随之移动）。日主在旋转后天盘上所落之宫，即为您的命宫。`);
      traits = bt(`Governed by ${p.qmdj.lifeDeity} (Deity), ${p.qmdj.lifeStar} (Star), and ${p.qmdj.lifeDoor} (Door) - together these define how you naturally deploy resources, timing, and strategy under pressure.`,
        `命宫由${p.qmdj.lifeDeity}（神）、${p.qmdj.lifeStar}（星）、${p.qmdj.lifeDoor}（门）共同主导，三者结合决定您在压力下运用资源、把握时机与制定策略的天然方式。`);
      hl = bt([`Life Palace: ${p.palaceName} (Palace ${p.qmdj.natalPalace}).`, `Wealth Palace: Palace ${p.qmdj.wealthPalace}.`, `Ju ${p.qmdj.ju} under ${p.dunType} governs the whole chart's timing.`],
        [`命宫：${p.palaceName}（第${p.qmdj.natalPalace}宫）。`, `财帛宫：第${p.qmdj.wealthPalace}宫。`, `局数${p.qmdj.ju}（${p.dunType}）主导全局时机。`]);
      pos = bt([`${p.qmdj.lifeStar} lends a distinct strategic advantage in its domain.`, `${p.qmdj.lifeDeity} shapes a consistent underlying temperament.`, 'The Wealth Palace location gives a concrete area to focus resource-building efforts.'],
        [`${p.qmdj.lifeStar}在其主管领域赋予明显的策略优势。`, `${p.qmdj.lifeDeity}塑造稳定一致的内在性情。`, '财帛宫位置为积累资源提供了明确的着力方向。']);
      neg = bt(['The Deity/Star/Door placement uses a documented rotation model rather than the full hour-based casting ritual, so treat individual palace pairings as illustrative of the mechanism.', `${p.qmdj.lifeDoor} carries both an opportunity and a caution depending on how it is used.`, 'Best paired with the BaZi Day Master reading rather than read in isolation.'],
        ['神、星、门的排布采用有据可查的旋转模型，而非完整的按时辰起局仪轨，各宫位组合可视为原理示范。', `${p.qmdj.lifeDoor}既是机会也需谨慎，视运用方式而定。`, '建议与八字日主分析搭配阅读，而非单独解读。']);
      cau = bt(['Treat this as a strategic-timing overlay, not a substitute for the BaZi chart.', 'Recheck against a professional cast for major time-sensitive decisions.', 'Birth time accuracy materially affects the Heaven Plate rotation - keep it precise.'],
        ['请将此视为策略时机的参考层面，不可替代八字命盘。', '重大且时效性强的决策，建议请专业排盘复核。', '出生时间的精确度直接影响天盘旋转结果，请务必核实准确。']);
  } else if (type === 'zodiac') {
      chars = bt(`Natal Zodiac: ${p.animal}. Allies: ${p.zodiacData.allies}. Hidden Ally: ${p.zodiacData.hidden}. Conflict: ${p.zodiacData.avoid}.`,
        `本命生肖：${p.animalCN}（${p.animal}）。三合：${p.zodiacData.allies}。六合：${p.zodiacData.hidden}。相冲：${p.zodiacData.avoid}。`);
      exp = bt(`The Zodiac Earthly Branch serves as your life foundation, providing implicit protection through its Allies and Hidden Ally, while the Conflict branch marks the relationship most likely to generate friction.`,
        `生肖地支是您人生的根基，三合与六合提供隐性的助力与保护，而相冲生肖则标志着最容易产生摩擦的关系。`);
      traits = bt(`${p.animal} natives typically draw support from ${p.zodiacData.allies} and ${p.zodiacData.hidden}, while relationships with ${p.zodiacData.avoid} natives require more conscious effort.`,
        `属${p.animalCN}者通常能从${p.zodiacData.allies}及${p.zodiacData.hidden}处获得助力，而与属${p.zodiacData.avoid}者的关系则需要更多用心经营。`);
      hl = bt([`Strongest natural allies: ${p.zodiacData.allies}.`, `Hidden Ally for quiet support: ${p.zodiacData.hidden}.`, `Primary friction point: ${p.zodiacData.avoid}.`],
        [`最强天然盟友：${p.zodiacData.allies}。`, `暗中相助的六合：${p.zodiacData.hidden}。`, `主要摩擦点：${p.zodiacData.avoid}。`]);
      pos = bt([`${p.zodiacData.allies} relationships tend to be low-friction and mutually reinforcing.`, `${p.zodiacData.hidden} offers support in ways that are not always obvious at first.`, 'Zodiac branch adds a stable, easy-to-communicate layer to introductions and networking.'],
        [`与${p.zodiacData.allies}的关系通常摩擦少、互相加强。`, `${p.zodiacData.hidden}提供的助力有时并不明显，需细心体察。`, '生肖为初次结识与人脉拓展提供稳定、易于沟通的切入点。']);
      neg = bt([`${p.zodiacData.avoid} pairings require more deliberate effort to stay harmonious.`, 'Zodiac alone is a coarse signal - always cross-check against the full Day Branch analysis.', 'Over-relying on Zodiac compatibility can overshadow more precise BaZi factors.'],
        [`与${p.zodiacData.avoid}的配对需要更刻意的努力才能维持和谐。`, '生肖只是粗略指标，务必配合完整的日支分析交叉核实。', '过度依赖生肖合婚可能掩盖更精确的八字因素。']);
      cau = bt([`Approach new ${p.zodiacData.avoid} relationships with a little more patience up front.`, 'Use Zodiac as a conversation starter, not a final verdict on compatibility.', 'Combine with the Day Master and Kua group readings for a fuller picture.'],
        [`与新结识的属${p.zodiacData.avoid}者相处，前期不妨多一份耐心。`, '生肖宜作为交流的开端，而非契合度的最终定论。', '请结合日主与卦命分析，方能得出更全面的判断。']);
  } else if (type === 'iching') {
      const mh = p.meiHua;
      const hexInfo = mh.hexInfo;
      const hexNameBT = bt(hexInfo.en, `${hexInfo.cn} (${hexInfo.py})`);
      const upperEl = bt(mh.upperTrigram.elemEN, mh.upperTrigram.elemZH), lowerEl = bt(mh.lowerTrigram.elemEN, mh.lowerTrigram.elemZH);
      const upperName = bt(mh.upperTrigram.en, mh.upperTrigram.cn), lowerName = bt(mh.lowerTrigram.en, mh.lowerTrigram.cn);
      chars = bt(`Hexagram #${mh.hexNo}, ${hexNameBT} - upper trigram ${upperName} (${mh.upperTrigram.symbol}) over lower trigram ${lowerName} (${mh.lowerTrigram.symbol}), with the ${mh.movingLine === 1 ? '1st' : mh.movingLine === 2 ? '2nd' : mh.movingLine === 3 ? '3rd' : mh.movingLine + 'th'} line active.`,
        `第${mh.hexNo}卦，${hexNameBT}——上卦${upperName}（${mh.upperTrigram.symbol}）配下卦${lowerName}（${mh.lowerTrigram.symbol}），第${mh.movingLine}爻为动爻。`);
      exp = bt(`Cast via the Mei Hua Yi Shu (梅花易数) Year-Month-Day-Hour method using your own birth data (year stem, lunar month, lunar day, and birth hour), then mapped to its real King Wen sequence position (#${mh.hexNo} of 64) and name - this is a genuine, traditional casting method producing a real, identifiable hexagram, not a decorative label. The moving line marks where change is concentrated within this hexagram.`,
        `依梅花易数「年月日时起卦法」，以您本人的出生数据（年干、农历月、农历日、出生时辰）实际起卦，并对应至真实的周易卦序（六十四卦中的第${mh.hexNo}卦）及卦名——这是真实的传统起卦方法，能推算出具体可辨识的卦象，而非装饰性标签。动爻标示此卦中变化的集中之处。`);
      traits = bt(`Your upper trigram carries the ${upperEl} element and your lower trigram carries the ${lowerEl} element${mh.upperTrigram.elemEN === mh.lowerTrigram.elemEN ? ' - the same element in both positions, a reinforcing (not conflicting) internal structure' : ' - the relationship between these two elements (upper acting outwardly, lower acting as the inner foundation) shapes how outer circumstance and inner disposition interact in this reading'}.`,
        `上卦五行属${upperEl}，下卦五行属${lowerEl}${mh.upperTrigram.elemEN === mh.lowerTrigram.elemEN ? '——上下同一五行，内部结构相辅而非相冲' : '——此二元素的关系（上卦主外，下卦为内在根基）决定了此卦中外在境遇与内在性情如何互动'}。`);
      hl = bt([`Hexagram #${mh.hexNo}: ${hexNameBT} anchors this reading.`, `Upper trigram: ${upperName}, representing the outward-facing, external situation.`, `Lower trigram: ${lowerName}, representing the inner foundation or disposition.`],
        [`第${mh.hexNo}卦「${hexNameBT}」为此解读之根基。`, `上卦：${upperName}，代表外显、外在的处境。`, `下卦：${lowerName}，代表内在根基或性情。`]);
      pos = bt(['Grounded in your own real birth data, not an arbitrary or decorative assignment.', 'Maps to a real, identifiable King Wen sequence hexagram with its own traditional name.', 'A traditional, verifiable casting method (Mei Hua Yi Shu), not an invented one.'],
        ['扎根于您本人真实的出生数据，而非任意或装饰性指定。', '对应至真实、可辨识的周易卦序卦象及其传统卦名。', '采用传统、可验证的起卦法（梅花易数），而非自创方法。']);
      neg = bt(['Hexagram reading is symbolic, not predictive in a literal sense.', 'This identifies the hexagram and moving line accurately, but does not include the specific classical line-text (爻辞) commentary for the moving line - only the hexagram-level name and trigram structure.', 'Should complement, not replace, practical due diligence.'],
        ['卦象解读具有象征意义，并非字面上的预测。', '此处准确推算出卦象与动爻，但未包含该动爻具体的爻辞——仅提供卦名与上下卦结构层级的解读。', '应作为实际尽职调查的补充，而非替代。']);
      cau = bt(['Use hexagram guidance as one input among several, not a sole decision-maker.', 'Revisit the reading if circumstances change significantly.', 'Avoid over-interpreting a single line out of context.'],
        ['卦象指引应作为多项参考之一，不宜作为唯一决策依据。', '若情况发生重大变化，宜重新解读。', '避免脱离上下文过度解读单一爻辞。']);
  } else if (type === 'numerology') {
      const masterInfo = { 11: { en: 'Master Intuitive - an amplified 2, carrying heightened intuition, spiritual insight, and inspirational vision, alongside greater sensitivity and inner tension than the base 2 expression.', zh: '大师直觉数——是2的强化版，具备更高的直觉与灵性洞察力，也伴随比基础2更强的敏感度与内在张力。' },
        22: { en: 'Master Builder - an amplified 4, carrying the potential to turn large-scale visions into concrete reality, alongside a correspondingly heavier practical burden than the base 4 expression.', zh: '大师建造数——是4的强化版，具备将宏大愿景化为具体现实的潜力，也伴随比基础4更沉重的实务责任。' },
        33: { en: 'Master Teacher - an amplified 6, carrying a pull toward large-scale, selfless service and guidance of others, alongside a real risk of self-neglect if that pull isn\'t balanced.', zh: '大师导师数——是6的强化版，具备大规模无私服务与指导他人的倾向，若未能取得平衡，也伴随忽略自身需求的真实风险。' }
      };
      const masterNote = p.isMasterNumber ? masterInfo[p.life] : null;
      chars = bt(`Life Path Number: ${p.life}${p.isMasterNumber ? ' (a Master Number)' : ''}. Life Lucky Number: ${p.lifeLuckyNumber}.`, `生命数字：${p.life}${p.isMasterNumber ? '（大师数）' : ''}。幸运号码：${p.lifeLuckyNumber}。`);
      exp = p.isMasterNumber
        ? bt(`Your Life Path reduces to ${p.life}, one of the three Master Numbers (11, 22, 33) - by standard numerological convention, this is preserved rather than reduced further to its base digit (${{11:2,22:4,33:6}[p.life]}). ${masterNote.en}`,
             `您的生命数字简化至${p.life}，属三大师数（11、22、33）之一——依数字命理惯例，此数保留而不再简化为其基础数字（${{11:2,22:4,33:6}[p.life]}）。${masterNote.zh}`)
        : bt(`Your Life Path Number is reduced from your birth date and represents your core numerological identity, while the Favorable/Avoid numbers indicate which digits harmonise or clash with that identity.`,
             `您的生命数字由出生日期简化推算而来，代表核心数字命理身份；有利／避免数字则指出哪些数字与此身份相合或相冲。`);
      traits = bt(`Number ${p.life} natives tend to express its qualities most clearly when favourable numbers (${p.numCompat.join(', ')}) are present in significant dates, addresses, or identifiers.${p.isMasterNumber ? ' Many people with a Master Number Life Path spend years primarily expressing its base-digit form before growing into the fuller Master Number expression.' : ''}`,
        `生命数字为${p.life}者，当有利数字（${p.numCompat.join('、')}）出现在重要日期、地址或标识中时，其特质表现得最为明显。${p.isMasterNumber ? '许多大师数命主会先经历多年基础数字的表现，之后才逐渐成长至完整的大师数境界。' : ''}`);
      hl = bt([`Life Path ${p.life}${p.isMasterNumber ? ' (Master Number)' : ''} is your core numerological signature.`, `Favorable numbers: ${p.numCompat.join(', ')}.`, `4-digit Life Lucky Number: ${p.lifeLuckyNumber}.`],
        [`生命数字${p.life}${p.isMasterNumber ? '（大师数）' : ''}是您核心的数字命理印记。`, `有利数字：${p.numCompat.join('、')}。`, `四位数幸运号码：${p.lifeLuckyNumber}。`]);
      pos = bt(['Favorable numbers can be woven into passwords, dates, or minor identifiers for subtle reinforcement.', 'Provides an easy, memorable personal reference point.', 'Complements the Bone Weight and BaZi readings with a third, independent framework.'],
        ['有利数字可融入密码、日期或次要标识中，起到潜移默化的强化作用。', '提供一个简单易记的个人参考点。', '作为独立的第三套体系，补充称骨与八字分析。']);
      neg = bt([`Avoid numbers (${p.numAvoid.join(', ')}) are not catastrophic, just mildly less resonant.`, 'Numerology is a broad-strokes system - do not over-index on it for major decisions.', p.isMasterNumber ? 'A Master Number is not a claim of greater spiritual advancement or luck - it represents higher potential paired with correspondingly higher pressure and challenge.' : 'Effects are subtle and cumulative rather than dramatic.'],
        [`避免数字（${p.numAvoid.join('、')}）并非灾难性的，只是契合度稍弱。`, '数字命理属于粗略体系，重大决策不宜过度依赖。', p.isMasterNumber ? '大师数并非代表更高的灵性境界或更好的运气——它代表更高的潜力，同时伴随相应更高的压力与挑战。' : '其影响是细微且累积性的，而非剧烈的。']);
      cau = bt(['Use favorable numbers as a tiebreaker, not the primary decision factor.', 'Avoid becoming anxious about unavoidable exposure to Avoid numbers.', 'Recalculate if using a legal name change or different birth data.'],
        ['有利数字宜作为决胜参考，而非主要决策因素。', '若无法避免接触避免数字，无需为此焦虑。', '如法定姓名变更或出生数据不同，应重新计算。']);
  } else if (type === 'zeri_date') {
      const isGoodTier = ZERI_GOOD_TIERS.includes(extraData.tier);
      chars = bt(`Date selected: ${extraData.dateStr}. Tier: ${extraData.tier} — derived from checking the date's own Day Branch against your natal Day Branch for a Six Clash (六冲) or Six Harmony (六合) relationship.`,
        `所选日期：${extraData.dateStr}。等级：${extraData.tier} — 由该日地支与您本命日支之间的六冲或六合关系推算得出。`);
      exp = isGoodTier
        ? bt(`This date's Day Branch forms a supportive or neutral relationship with your natal Day Branch, generating constructive resonance with your chart.`, `此日期的地支与您本命日支形成相助或中性关系，与命盘产生建设性的共鸣。`)
        : bt(`This date's Day Branch forms a clashing or friction-prone relationship with your natal Day Branch, generating destructive resonance with your chart that is best worked around rather than through.`, `此日期的地支与您本命日支形成冲克或易生摩擦的关系，与命盘产生不利共鸣，宜避开而非强行处理。`);
      traits = isGoodTier ? bt(`Energy field is supportive and stable, suitable for executing planned moves.`, `能量场稳定且具助力，适合执行既定计划。`) : bt(`Energy field is volatile or draining; better suited to rest, review, and low-stakes routine tasks.`, `能量场波动或耗损较大，较适合休息、检视及低风险的日常事务。`);
      hl = isGoodTier
        ? bt([`${extraData.tier} rating supports proactive action.`, 'Natal Day Branch is reinforced rather than opposed.', 'Good window for decisions requiring clarity.'],
             [`「${extraData.tier}」等级利于主动行动。`, '本命日支得到增强而非对抗。', '适合需要清晰判断的决策窗口。'])
        : bt([`${extraData.tier} rating counsels caution.`, 'Natal Day Branch is under strain from this date.', 'Better reserved for low-stakes, routine activity.'],
             [`「${extraData.tier}」等级提示宜谨慎行事。`, '本命日支受此日期冲克承压。', '较适合保留给低风险的日常事务。']);
      pos = isGoodTier
        ? bt(['Smoother execution of planned activities.', 'Reduced friction in negotiations or meetings.', 'Favourable for locking in decisions.'], ['既定活动执行更顺畅。', '谈判或会议中的摩擦减少。', '有利于敲定决策。'])
        : bt(['A useful date for rest, reflection, and review.', 'Good for closing out (not starting) matters.', 'Awareness itself reduces the risk of missteps.'], ['适合休息、反思与检视的日子。', '适合收尾（而非开启）事务。', '提高警觉本身即能降低失误风险。']);
      neg = isGoodTier
        ? bt(['Can create over-confidence in decisions.', 'Ease may mask details worth double-checking.', 'Not a substitute for normal due diligence.'], ['可能导致决策时过度自信。', '顺利可能掩盖了值得复查的细节。', '不能替代正常的尽职调查。'])
        : bt(['Elevated risk of miscommunication or delay.', 'Decisions made today may need revisiting.', 'Higher chance of avoidable friction with others.'], ['沟通不畅或延误的风险升高。', '今日所作决策可能需要重新审视。', '与他人产生可避免摩擦的机率较高。']);
      cau = isGoodTier
        ? bt(['Still confirm details in writing.', 'Avoid rushing purely because the date feels favourable.', 'Pair with the person\'s own BaZi for major decisions.'], ['仍应以书面形式确认细节。', '切勿仅因日期吉利而仓促行事。', '重大决策请搭配当事人自身八字综合判断。'])
        : bt(['Postpone major signings or launches if possible.', 'Double-check details before committing.', 'Avoid confrontational conversations if avoidable.'], ['若可行，建议延后重要签约或启动事项。', '承诺前请再三核实细节。', '尽量避免可能引发对立的对话。']);
  } else if (type === 'mobile_number') {
      const res = extraData.auditResult; const num = extraData.number;
      chars = bt(`Mobile Number ${num}: Elemental Compatibility Score ${res.score}%.`, `手机号码 ${num}：五行契合度评分 ${res.score}%。`);
      exp = bt(`This number's digit-elements are cross-referenced against your BaZi Day Master to determine whether daily use of this number tends to reinforce or drain your natal chart.`, `此号码的数字五行已与您的八字日主交叉比对，以判断日常使用此号码倾向于助益还是耗损您的本命盘。`);
      exp += ` ${res.explanation}`;
      traits = res.score >= 80 ? bt('A strongly reinforcing number for your Day Master.','对您的日主有强力助益的号码。') : res.score >= 60 ? bt('A moderately supportive number, neither strongly reinforcing nor draining.','中度助益的号码，既非强力助益也非耗损。') : bt('A number whose elements lean toward draining rather than supporting your Day Master.','此号码的五行倾向耗损而非助益您的日主。');
      hl = res.hl; pos = res.pos; neg = res.neg; cau = res.cau;
  } else if (type === 'vehicle_number') {
      const res = extraData.auditResult; const num = extraData.number; const shared = extraData.shared; const partnerP = extraData.partnerP;
      chars = bt(`Vehicle Plate ${num}: Elemental Compatibility Score ${res.score}%${shared && partnerP ? ` (analysed as shared with ${partnerP.displayName})` : ''}.`, `车牌 ${num}：五行契合度评分 ${res.score}%${shared && partnerP ? `（已按与${partnerP.displayName}共用分析）` : ''}。`);
      exp = bt(`This plate's digit-elements are cross-referenced against ${shared && partnerP ? `both your and ${partnerP.displayName}'s` : 'your'} BaZi Day Master${shared && partnerP ? 's' : ''} to determine daily elemental influence.`, `此车牌的数字五行已与${shared && partnerP ? `您与${partnerP.displayName}双方的` : '您的'}八字日主交叉比对，以判断日常五行影响。`);
      exp += ` ${res.explanation}`;
      traits = res.score >= 80 ? bt('A strongly reinforcing plate number.','强力助益的车牌号码。') : res.score >= 60 ? bt('A moderately supportive plate number.','中度助益的车牌号码。') : bt('A plate whose elements lean toward draining rather than supporting.','此车牌的五行倾向耗损而非助益。');
      hl = res.hl; pos = res.pos; neg = res.neg; cau = res.cau;
  } else if (type === 'address') {
      const res = extraData.auditResult; const addr = extraData.address; const partnerP = extraData.partnerP;
      const full = extraData.fullResult; // {score, digitScore, baZhai, flyingStar} - see computeAddressFullCompatibility
      const overallScore = full ? full.score : res.score;
      // ENHANCEMENT (reported: "the address should take into consideration the ba zhai and flying star
      // for compatibility calculation and deep analysis"): when a facing direction (and, for Flying
      // Star, a construction year) is on file, the score/reading now blends the digit-elemental audit
      // with this profile's own Ba Zhai star at that direction and the property's Flying Star
      // Facing/Mountain stars - not just the digit method alone. When neither is available (no facing
      // direction saved), this falls back to exactly the prior digit-only reading, unchanged.
      chars = bt(`Address Checked: "${addr}" - Compatibility Score ${overallScore}%${partnerP ? ` (analysed for the household - you & ${partnerP.displayName})` : ''}${full && (full.baZhai || full.flyingStar) ? ` (blended: digits + Ba Zhai${full.flyingStar ? ' + Flying Star' : ''})` : ''}.`,
        `已核对地址："${addr}"——契合度评分 ${overallScore}%${partnerP ? `（按家庭成员分析——您与${partnerP.displayName}）` : ''}${full && (full.baZhai || full.flyingStar) ? `（综合：数字五行 + 八宅${full.flyingStar ? ' + 飞星' : ''}）` : ''}。`);
      exp = bt(`This app does not perform geocoding or know anything about the physical property itself - the digit-elemental component of this score means the address text's own digits and characters, folded down the same way a phone number or vehicle plate is, cross-referenced against ${partnerP ? `both your and ${partnerP.displayName}'s` : 'your'} BaZi Day Master${partnerP ? 's' : ''}.`, `本应用不进行地理位置查询，亦不掌握该房产本身的实际信息——此评分中的数字五行部分，是将地址文字本身的数字与字符（依手机号码／车牌相同的换算方式）与${partnerP ? `您与${partnerP.displayName}双方的` : '您的'}八字日主交叉比对所得。`);
      if (full && full.baZhai) {
        exp += ' ' + bt(`This is now combined with your own Ba Zhai (8 Mansions) reading: your Kua number's star at this address's ${full.baZhai.direction} facing direction is ${full.baZhai.star} (${full.baZhai.rating}) - ${full.baZhai.desc}`, `现已结合您本人的八宅（八宅法）解读：您的命卦在此地址${DIR_LABEL_ZH[full.baZhai.direction] || full.baZhai.direction}朝向所对应之星为${full.baZhai.star}（${full.baZhai.rating}）——${full.baZhai.desc}`);
      } else {
        exp += ' ' + bt('No facing direction is saved for this address, so the Ba Zhai and Flying Star components could not be added - this score is the digit-elemental method alone, exactly as before.', '此地址尚未保存朝向，因此无法加入八宅与飞星部分——此评分仅为数字五行方法，与先前相同。');
      }
      if (full && full.flyingStar) {
        const fFav = full.flyingStar.facingFav === true ? bt('favourable','吉') : full.flyingStar.facingFav === false ? bt('cautioned','凶') : bt('mixed','吉凶参半');
        const mFav = full.flyingStar.mountainFav === true ? bt('favourable','吉') : full.flyingStar.mountainFav === false ? bt('cautioned','凶') : bt('mixed','吉凶参半');
        exp += ' ' + bt(`Also folded in: this property's own Flying Star chart (Period ${full.flyingStar.period}, from its construction year and facing) - Facing Star ${full.flyingStar.facingStarNum} (${fFav}) and Mountain Star ${full.flyingStar.mountainStarNum} (${mFav}).`, `亦已纳入：此物业自身之飞星盘（第${full.flyingStar.period}运，依建造年份与朝向推算）——向星${full.flyingStar.facingStarNum}（${fFav}）与山星${full.flyingStar.mountainStarNum}（${mFav}）。`);
      } else if (full && full.baZhai) {
        exp += ' ' + bt('No construction year is saved for this address, so the Flying Star component could not be added - only Ba Zhai and the digit-elemental score are combined here.', '此地址尚未保存建造年份，因此无法加入飞星部分——此处仅综合八宅与数字五行评分。');
      }
      exp += ` ${res.explanation}`;
      traits = overallScore >= 80 ? bt('A strongly reinforcing address for the household.','对家庭有强力助益的地址。') : overallScore >= 60 ? bt('A moderately supportive address, neither strongly reinforcing nor draining.','中度助益的地址，既非强力助益也非耗损。') : bt('An address whose elements lean toward draining rather than supporting the household.','此地址的五行倾向耗损而非助益家庭。');
      hl = res.hl.slice();
      if (full && full.baZhai) hl.push(bt(`Ba Zhai: ${full.baZhai.star} (${full.baZhai.rating}) at the ${full.baZhai.direction} facing direction.`, `八宅：${full.baZhai.direction}朝向为${full.baZhai.star}（${full.baZhai.rating}）。`));
      if (full && full.flyingStar) hl.push(bt(`Flying Star: Facing Star ${full.flyingStar.facingStarNum}, Mountain Star ${full.flyingStar.mountainStarNum} (Period ${full.flyingStar.period}).`, `飞星：向星${full.flyingStar.facingStarNum}，山星${full.flyingStar.mountainStarNum}（第${full.flyingStar.period}运）。`));
      pos = res.pos; neg = res.neg; cau = res.cau;
  } else if (type === 'physiognomy') {
      chars = bt(`Consolidated Xiang Shu (相术) reading across the Face and both Palms, cross-referencing congenital (Left Palm), acquired (Right Palm), and expressed (Face) markers.`,
        `综合面相与左右手相分析，交叉比对先天（左手）、后天（右手）与外显（面部）三方特征。`);
      exp = bt(`The face maps how inner character is projected outward; the left palm records congenital genetic deposition and subconscious tendencies; the right palm records acquired willpower and actualized results. Read together, they triangulate a single consistent life narrative.`,
        `面相反映内在性格如何外显；左手记录先天禀赋与潜意识倾向；右手记录后天意志与实际成果。三者合参，可勾勒出一致的人生脉络。`);
      traits = bt(`Shows strong alignment between innate disposition (left palm) and outward expression (face), with the right palm indicating steady conversion of potential into results.`,
        `先天性情（左手）与外在表现（面相）高度一致，右手则显示潜力持续转化为成果的过程。`);
      hl = bt(['Facial features indicate clear decision-making capacity.', 'Left palm shows strong congenital resource lines.', 'Right palm confirms consistent follow-through on goals.'],
        ['面部特征显示清晰的决策能力。', '左手显示先天资源线强旺。', '右手印证目标执行的一贯性。']);
      pos = bt(['Three independent readings (face, left palm, right palm) reinforce each other for a more reliable overall picture.', 'Highlights where innate potential has been successfully converted into results.', 'Useful cross-check against the BaZi and Zi Wei readings.'],
        ['面相、左手、右手三项独立分析相互印证，整体判断更可靠。', '突显先天潜力成功转化为成果之处。', '可作为八字与紫微斗数分析的有效交叉核实。']);
      neg = bt(['Physiognomy is observational and qualitative, not a precise measurement.', 'Findings can shift subtly with age, health, and major life events.', 'Best treated as a supporting read, not a standalone verdict.'],
        ['相术属观察性、定性分析，并非精确量度。', '结果会随年龄、健康及人生重大事件而微妙变化。', '宜作为辅助参考，而非独立定论。']);
      cau = bt(['Revisit this reading periodically rather than treating it as fixed for life.', 'Use alongside, not instead of, the BaZi and Zi Wei charts.', 'Avoid over-interpreting any single feature in isolation.'],
        ['宜定期重新解读，不应视为终身不变。', '请与八字、紫微斗数搭配使用，而非取代。', '避免脱离整体、过度解读单一特征。']);
  } else if (type === 'astro') {
      const compZh = translateSignList(p.astro.comp), incompZh = translateSignList(p.astro.incomp);
      // ENHANCEMENT (continuing the Western Astrology chart enrichment): the natal outer-planet
      // positions now plotted on the two chart wheels are also surfaced here as text, so the same real
      // data appears in both the visual chart and the Deep Analysis card (and therefore the PDF, which
      // renders this card but not the SVG wheels directly).
      const natalOuter = (p?.bazi?.birthMomentUTC) ? computeNatalOuterPlanetPositions(p.bazi.birthMomentUTC) : null;
      const outerLine = natalOuter ? Object.keys(natalOuter).map(pl => bt(`${OUTER_PLANET_INFO[pl].en} in ${natalOuter[pl].sign.en}`, `${OUTER_PLANET_INFO[pl].zh}在${natalOuter[pl].sign.zh}`)).join(bt(', ', '、')) : '';
      chars = bt(`Core Astrological Sun Sign: ${p.astro.en}.`, `核心太阳星座：${p.astro.en}。`);
      exp = bt(`Your Sun Sign is determined by your solar birth date and represents your core identity and ego expression in Western astrology, distinct from your Moon or Rising sign.${outerLine ? ` Your natal outer planets: ${outerLine}.` : ''}`,
        `太阳星座由您的阳历出生日期决定，代表西方占星学中的核心身份与自我表达，有别于月亮星座或上升星座。${outerLine ? `您的本命外行星：${outerLine}。` : ''}`);
      traits = bt(`${p.astro.en} natives tend to resonate most easily with ${p.astro.comp}, while ${p.astro.incomp} pairings require more conscious bridging.`,
        `${p.astro.en}座通常与${compZh}最容易产生共鸣，而与${incompZh}的配对则需要更用心地弥合差异。`);
      hl = bt([`Sun Sign: ${p.astro.en}.`, `Most compatible: ${p.astro.comp}.`, `Needs more effort: ${p.astro.incomp}.`],
        [`太阳星座：${p.astro.en}。`, `最相合：${compZh}。`, `需更多用心：${incompZh}。`]);
      pos = bt(['A widely recognised, easy shorthand for core personality traits.', 'Useful icebreaker for understanding compatibility at a glance.', 'Complements the Chinese Zodiac reading with a second independent lens.'],
        ['广为人知，是了解核心性格特质的简便方式。', '有助于快速破冰、初步了解契合度。', '以第二套独立视角补充生肖分析。']);
      neg = bt(['Sun Sign alone omits Moon/Rising sign nuance.', `${p.astro.incomp} pairings are workable, just less automatically easy.`, 'Broad population-level system - individual variation is significant.'],
        ['仅看太阳星座会忽略月亮／上升星座的细节。', `与${incompZh}的配对依然可行，只是不那么轻松自然。`, '属大范围群体性体系，个体差异可能显著。']);
      cau = bt(['Do not treat Sun Sign compatibility as a hard veto on any relationship.', 'Pair with the BaZi and Zodiac readings for a fuller picture.', 'Revisit if exact birth time/location was ever uncertain (affects Rising sign, not Sun Sign).'],
        ['请勿将太阳星座契合度作为否决任何关系的硬性标准。', '请搭配八字与生肖分析，以获得更全面的判断。', '若出生时间／地点曾不确定，请重新核实（影响上升星座，非太阳星座）。']);
  } else if (type === 'astro_natal_full') {
      // ENHANCEMENT (requested directly: "go deeper for the western astrology section... chart out all
      // planets into a natal chart and provide a natal reading. Indicate characteristics, suitable
      // career, suitable career industry, direct luck, indirect luck, health issues... relationships,
      // children"). See computeFullNatalChart/computeNatalAspectGrid/SIGN_PROFILE_TABLE in
      // engine-metaphysics.js for the underlying real computation.
      // UPDATE (requested directly: 12-house wheel -> user explicitly chose real Ascendant-based houses):
      // the Ascendant/houses ARE now included whenever this profile has a birth latitude on file (see
      // computeNatalHouses/computeNatalPointHouses in engine-metaphysics.js) - honestly reported as
      // unavailable, not silently guessed at, for any profile without one yet.
      const natalChart = (p?.bazi?.birthMomentUTC) ? computeFullNatalChart(p.bazi.birthMomentUTC) : null;
      if (!natalChart) {
        chars = bt('Full natal chart unavailable - birth date/time not yet on file.', '本命盘尚无法计算——出生日期／时间尚未记录。');
        exp = bt('Add a complete birth date and time for this profile to unlock the full natal reading.', '请为此档案补充完整的出生日期与时间，以解锁完整本命解读。');
      } else {
        const aspects = computeNatalAspectGrid(natalChart);
        const sunSign = natalChart.sun.sign, moonSign = natalChart.moon.sign, mercurySign = natalChart.mercury.sign,
          venusSign = natalChart.venus.sign, marsSign = natalChart.mars.sign, jupiterSign = natalChart.jupiter.sign, saturnSign = natalChart.saturn.sign;
        const sunProfile = SIGN_PROFILE_TABLE[sunSign.en], moonProfile = SIGN_PROFILE_TABLE[moonSign.en], venusProfile = SIGN_PROFILE_TABLE[venusSign.en],
          marsProfile = SIGN_PROFILE_TABLE[marsSign.en];
        const topAspects = aspects.slice(0, 5);
        const aspectLines = topAspects.map(a => {
          const pa = PLANET_INFO_FULL[a.a], pb = PLANET_INFO_FULL[a.b];
          return bt(`${pa.en} ${a.name} ${pb.en} (orb ${a.orbUsed.toFixed(1)}°)`, `${pa.zh}${a.nameZh}${pb.zh}（容许度${a.orbUsed.toFixed(1)}°）`);
        });

        const northNodeSign = natalChart.northnode.sign, southNodeSign = natalChart.southnode.sign;
        // ENHANCEMENT (requested directly: real Ascendant-based houses) - `hn(key)` gives a bilingual
        // " (House N)" suffix for any natal point, when houses are on file for this profile, else ''.
        const pointHouses = p?.houses ? computeNatalPointHouses(natalChart, p.houses) : null;
        const hn = key => pointHouses ? { en: ` (House ${pointHouses[key]})`, zh: `（第${pointHouses[key]}宫）` } : { en: '', zh: '' };

        chars = bt(`Full Natal Chart: Sun ${sunSign.en}, Moon ${moonSign.en}, Mercury ${mercurySign.en}, Venus ${venusSign.en}, Mars ${marsSign.en}, Jupiter ${jupiterSign.en}, Saturn ${saturnSign.en}, Uranus ${natalChart.uranus.sign.en}, Neptune ${natalChart.neptune.sign.en}, Pluto ${natalChart.pluto.sign.en}, North Node ${northNodeSign.en}, South Node ${southNodeSign.en}.${p?.houses ? ` Ascendant ${p.houses.ascendantSign.en}.` : ''}`,
          `完整本命盘：太阳${sunSign.zh}、月亮${moonSign.zh}、水星${mercurySign.zh}、金星${venusSign.zh}、火星${marsSign.zh}、木星${jupiterSign.zh}、土星${saturnSign.zh}、天王星${natalChart.uranus.sign.zh}、海王星${natalChart.neptune.sign.zh}、冥王星${natalChart.pluto.sign.zh}、北交点${northNodeSign.zh}、南交点${southNodeSign.zh}。${p?.houses ? `上升星座${p.houses.ascendantSign.zh}。` : ''}`);

        exp = p?.houses
          ? bt(`Computed from your real birth date, time, true-solar-time-corrected longitude, AND your birth latitude - all 10 classical planets, the Moon's North/South Node (the "eclipse" axis), and now your real Ascendant (${p.houses.ascendantSign.en}) with the 12 houses it anchors (Equal House system - each house a full 30° slice from the Ascendant; Placidus, the other common system, uses unequal house sizes and is not what this app computes). Your closest natal aspects (the tightest orbs, where two planets' influences blend most strongly): ${aspectLines.join('; ')}.`,
            `依您真实的出生日期、时间、经真太阳时校正的经度，以及出生纬度推算——涵盖全部10颗古典行星、月亮的北／南交点（「日月食」轴线），以及您真实的上升星座（${p.houses.ascendantSign.zh}）与其所锚定的十二宫位（采用「等宫制」——每宫皆为自上升点起算的完整30°；另一常见系统「普拉西德制」采用不等宫大小，本应用并未采用该系统）。您最紧密的本命相位（容许度最小、两行星能量交融最强之处）：${aspectLines.join('；')}。`)
          : bt(`Computed from your real birth date, time, and true-solar-time-corrected longitude - all 10 classical planets, not just the Sun, plus the Moon's North and South Node (the "eclipse" axis - the two points where solar/lunar eclipses occur). Your closest natal aspects (the tightest orbs, where two planets' influences blend most strongly): ${aspectLines.join('; ')}. The Ascendant/houses are NOT included for this profile yet - that specifically needs your birth latitude, which is not currently on file (add it via the country/city selector to unlock this).`,
            `依您真实的出生日期、时间及经真太阳时校正的经度推算——涵盖全部10颗古典行星，不只是太阳，另加月亮的北交点与南交点（即「日月食」轴线——日食／月食发生的两个交点）。您最紧密的本命相位（容许度最小、两行星能量交融最强之处）：${aspectLines.join('；')}。上升星座／宫位此档案暂未纳入——那需要出生纬度数据，目前尚未记录（请透过国家／城市选单补充以启用此功能）。`);

        const saturnProfile = SIGN_PROFILE_TABLE[saturnSign.en];
        traits = bt(`Career approach: ${sunProfile.careerTraits.en} (Sun in ${sunSign.en}${hn('sun').en}), driven by Mars in ${marsSign.en}${hn('mars').en} (${marsProfile.careerTraits.en}).`,
          `事业取向：${sunProfile.careerTraits.zh}（太阳在${sunSign.zh}${hn('sun').zh}），并由火星在${marsSign.zh}${hn('mars').zh}（${marsProfile.careerTraits.zh}）驱动。`);

        hl = [
          bt(`Characteristics: Sun in ${sunSign.en}${hn('sun').en} for core identity, Moon in ${moonSign.en}${hn('moon').en} for emotional instinct, Mercury in ${mercurySign.en}${hn('mercury').en} for thinking/communication style.`, `特征：太阳在${sunSign.zh}${hn('sun').zh}主导核心身份，月亮在${moonSign.zh}${hn('moon').zh}主导情绪本能，水星在${mercurySign.zh}${hn('mercury').zh}主导思维与沟通方式。`),
          bt(`Suitable Career: ${sunProfile.careers.en} - reinforced by Mars in ${marsSign.en}${hn('mars').en} (${marsProfile.careers.en})${pointHouses && pointHouses.saturn === 10 ? ', and strongly emphasised by Saturn sitting right in your 10th House of career/reputation' : ''}.`, `适合职业：${sunProfile.careers.zh}——并由火星在${marsSign.zh}${hn('mars').zh}（${marsProfile.careers.zh}）加以强化${pointHouses && pointHouses.saturn === 10 ? '，且土星恰落于主管事业／声誉的第十宫，进一步凸显此取向' : ''}。`),
          bt(`Suitable Industry: ${sunProfile.industries.en} - with Saturn in ${saturnSign.en}${hn('saturn').en} favouring long-term staying power in ${saturnProfile.industries.en}.`, `适合行业：${sunProfile.industries.zh}——土星在${saturnSign.zh}${hn('saturn').zh}则有利于在${saturnProfile.industries.zh}领域长期扎根。`),
          describeDirectLuck(jupiterSign),
          describeIndirectLuck(saturnSign),
          bt(`Health: watch areas linked to Sun in ${sunSign.en}${hn('sun').en} (${sunProfile.bodyArea.en}) and Mars in ${marsSign.en}${hn('mars').en} (${marsProfile.bodyArea.en})${pointHouses && pointHouses.sun === 6 ? ', with the Sun itself sitting in your 6th House of daily health routines' : ''}.`, `健康：留意与太阳在${sunSign.zh}${hn('sun').zh}（${sunProfile.bodyArea.zh}）及火星在${marsSign.zh}${hn('mars').zh}（${marsProfile.bodyArea.zh}）相关的部位${pointHouses && pointHouses.sun === 6 ? '，且太阳恰落于主管日常健康习惯的第六宫' : ''}。`),
          bt(`Relationships: Venus in ${venusSign.en}${hn('venus').en} shows your romantic style as ${venusProfile.relationshipStyle.en}; Moon in ${moonSign.en}${hn('moon').en} means you fundamentally need to feel ${moonProfile.relationshipStyle.en}${pointHouses && pointHouses.venus === 7 ? ' - and with Venus itself in your 7th House of partnership, this shows up directly in how you relate one-to-one' : ''}.`, `人际关系：金星在${venusSign.zh}${hn('venus').zh}显示您的恋爱风格为${venusProfile.relationshipStyle.zh}；月亮在${moonSign.zh}${hn('moon').zh}则代表您内心根本上需要感受到${moonProfile.relationshipStyle.zh}${pointHouses && pointHouses.venus === 7 ? '——金星恰落于主管伴侣关系的第七宫，此特质会直接展现在您的一对一关系中' : ''}。`),
          bt(`Children: your Sun (${sunSign.en}${hn('sun').en}) and Moon (${moonSign.en}${hn('moon').en}) suggest a parenting/nurturing style of ${sunProfile.parentingStyle.en}, softened by ${moonProfile.parentingStyle.en}${pointHouses ? ` - your 5th House of children/self-expression falls in ${zodiacSignForLongitude(astroRev(p.houses.ascendant + 4*30)).en}` : ' (a full 5th-house reading would need your birth latitude, not currently on file)'}.`, `子女：太阳（${sunSign.zh}${hn('sun').zh}）与月亮（${moonSign.zh}${hn('moon').zh}）显示的养育风格为${sunProfile.parentingStyle.zh}，并调和以${moonProfile.parentingStyle.zh}${pointHouses ? `——您主管子女／自我表达的第五宫落于${zodiacSignForLongitude(astroRev(p.houses.ascendant + 4*30)).zh}` : '（完整的第五宫解读需要出生纬度数据，目前尚未记录）'}。`),
          bt(`Karmic Direction (the eclipse points): your North Node in ${northNodeSign.en}${hn('northnode').en} points to ${PLANET_IMPACT_AREAS.northnode.en} - the growth direction worth consciously leaning into. Your South Node in ${southNodeSign.en}${hn('southnode').en} (always the exact opposite sign) marks ${PLANET_IMPACT_AREAS.southnode.en}.`,
            `业力方向（日月食点）：您的北交点位于${northNodeSign.zh}${hn('northnode').zh}，指向${PLANET_IMPACT_AREAS.northnode.zh}——值得您有意识地把握的成长方向。您的南交点位于${southNodeSign.zh}${hn('southnode').zh}（恒与北交点星座相对），代表${PLANET_IMPACT_AREAS.southnode.zh}。`)
        ];
        pos = [
          bt('Grounded in your real natal positions for all 10 classical planets plus the North/South Node - not a Sun-sign-only summary.', '以您全部10颗古典行星及北／南交点的真实本命位置为基础——并非仅凭太阳星座的概略解读。'),
          bt('The natal aspect grid surfaces genuine, profile-specific tight aspects rather than generic sign traits alone.', '本命相位表揭示真实、因人而异的紧密相位，而非仅套用泛用的星座特质。'),
          bt('Career/industry/health/relationship notes blend multiple real placements (Sun, Mars, Saturn, Venus, Moon), not a single sign.', '事业／行业／健康／人际关系的解读综合了多个真实的行星位置（太阳、火星、土星、金星、月亮），而非单一星座。'),
          ...(p?.houses ? [bt('Your real Ascendant and Equal House placements are now included, when your profile has a birth latitude on file.', '当此档案已记录出生纬度时，将纳入您真实的上升星座与等宫制宫位数据。')] : [])
        ];
        neg = [
          ...(p?.houses ? [] : [bt('No Ascendant or house system for this profile yet - career/health/relationship/children notes use sign-level associations only, not a full chart synthesis a professional astrologer would perform (add a birth latitude via the country/city selector to unlock houses).', '此档案尚未纳入上升星座或宫位系统——事业／健康／人际关系／子女的解读仅采用星座层级的关联，而非专业占星师会做的完整命盘综合分析（请透过国家／城市选单补充出生纬度以启用宫位功能）。')]),
          ...(p?.houses ? [bt('The Equal House system (used here) is one of several professional conventions - Placidus, the most common alternative, would place the same planets in somewhat different houses, especially far from the equator.', '此处采用的「等宫制」是多种专业惯例之一——最常见的替代方案「普拉西德制」在纬度较高地区，可能将相同行星分配至有所不同的宫位。'), bt('The Ascendant is exquisitely sensitive to birth TIME (it moves a full degree every 4 minutes) - an inaccurate birth time will shift house placements even when the sign-level readings above remain correct.', '上升点对出生「时间」极为敏感（每4分钟移动整整1度）——出生时间若不准确，即使上方星座层级的解读仍然正确，宫位归属仍可能因此偏移。')] : []),
          bt('Mercury/Venus/Mars natal positions use an unperturbed 2-body orbit model - accurate to a degree or so, occasionally close to a sign boundary for a birth time right at the edge.', '水星／金星／火星的本命位置采用未经摄动修正的二体轨道模型——精度约在一度左右，若出生时刻恰好接近星座交界，结果可能受影响。'),
          bt('Career/health/relationship associations are classical, general sign-level conventions - individual variation is significant.', '事业／健康／人际关系的关联为古典、概略的星座层级惯例——个体差异可能显著。'),
          bt('The North/South Node uses the MEAN node (a smooth, steadily-regressing point) rather than the astronomically "true" node, which oscillates around the mean by up to about 1.5°, occasionally close to a sign boundary.', '北交点／南交点采用「平均交点」（平稳、稳定后退的推算点），而非天文学上会围绕平均值来回摆动最多约1.5度的「真实交点」——若恰好接近星座交界，结果可能受影响。')
        ];
        cau = [
          bt('Treat career, health, and relationship notes as a reflective lens, not professional advice - consult a qualified doctor, career counsellor, or therapist for real decisions.', '请将事业、健康与人际关系的说明视为反思参考，而非专业建议——重大决定请咨询合格医生、职涯顾问或治疗师。'),
          bt('Birth time accuracy directly affects Moon and inner-planet placements (the Moon moves roughly 13° per day) - keep it as precise as possible.', '出生时间的精确度直接影响月亮及内行星的位置（月亮每日移动约13°）——请尽量确保准确。'),
          bt('Cross-check any major life decision against this app\'s BaZi Day Master and Da Yun readings for a fuller picture.', '重大人生决策宜与本应用的八字日主及大运分析交叉参考，以获得更全面的判断。')
        ];
      }
  } else if (type === 'astro_annual_deep') {
      // ENHANCEMENT (requested directly: "provide an annual deep reading for current year and following
      // 2 years... categorize into Very Auspicious/Auspicious/Neutral/Inauspicious/Very Inauspicious...
      // based on the movements of the planets and how it impacts the natal chart"). See
      // computeAnnualDeepReading in engine-metaphysics.js: real transiting Sun + 5 outer planets + the
      // North/South Node (mid-year snapshot) checked against ALL 12 natal points, scored by aspect
      // quality/orb/planet weight.
      const yearData = extraData?.yearData;
      if (!yearData) {
        chars = bt('Annual deep reading unavailable.', '流年深度解读暂无法计算。');
      } else {
        const goodAspects = yearData.aspects.filter(a => a.weightedScore > 0.5);
        const badAspects = yearData.aspects.filter(a => a.weightedScore < -0.5);
        // ENHANCEMENT (requested directly: "the descriptions ... only mentions the planet movements.
        // Explain in detail what those mean to the profile"): describeA used to just name the aspect
        // plus a one-clause theme mash-up ("growth/opportunity meeting love/values"). That named the
        // movement but never actually said what it means for this person's life. It now uses
        // describeTransitAspectMeaning (engine-metaphysics.js), which spells out - in concrete, real-
        // world terms - what a transiting planet of this kind, forming this type of aspect, characteristically
        // does to that specific natal point's life domain (e.g. "brings a welcome boost of confidence...
        // to your relationships, romance, finances, and personal values").
        const describeA = a => describeTransitAspectMeaning(a);
        chars = bt(`${yearData.year}: ${yearData.tier.en} overall (${yearData.aspects.length} real transiting aspect${yearData.aspects.length===1?'':'s'} found against your full natal chart).`,
          `${yearData.year}年：整体评级为${yearData.tier.zh}（依您完整本命盘，共找到${yearData.aspects.length}个真实行运相位）。`);
        exp = bt(`Computed from the real geocentric positions of the Sun, Jupiter, Saturn, Uranus, Neptune, Pluto, and the Moon's North/South Node (the eclipse axis) for ${yearData.year} (a mid-year snapshot, since these move slowly enough that one point in the year is representative), checked for genuine major aspects against all 12 of your natal points - not just your natal Sun. Each aspect is scored by its type (Trine/Sextile supportive, Square/Opposition more challenging, Conjunction depending on which planet), how exact the orb is, and how significant that transiting planet is for a whole-year reading - and each is spelled out below in terms of the concrete, real-world life area it actually touches, not just which planets moved.`,
          `依据太阳、木星、土星、天王星、海王星、冥王星及月亮北／南交点（日月食轴线）于${yearData.year}年的真实地心位置（以年中为代表性快照，因这些移动缓慢，年中一点已具代表性）推算，并核对与您全部12个本命点（不仅是本命太阳）形成的真实主要相位。每个相位依其类型（三分相／六分相偏向顺畅，四分相／对分相较具挑战性，合相则视行运行星而定）、容许度精确程度，及该行运行星对全年解读的重要性加权评分——且以下每一项皆说明其实际触及的具体生活领域，而非仅罗列行星移动。`);
        traits = yearData.aspects.length
          ? bt(`Strongest influence this year: ${describeA(yearData.aspects[0])}`, `本年最显著的影响：${describeA(yearData.aspects[0])}`)
          : bt('No major transiting aspect to your full natal chart this year - a genuinely quieter year by this measure.', '本年您的完整本命盘未形成主要行运相位——就此指标而言，属较平静的一年。');
        hl = [
          bt(`Overall tier: ${yearData.tier.en}.`, `整体评级：${yearData.tier.zh}。`),
          ...goodAspects.slice(0, 3).map(a => bt(`Good: ${describeA(a)}`, `吉：${describeA(a)}`)),
          ...badAspects.slice(0, 3).map(a => bt(`Caution: ${describeA(a)}`, `慎：${describeA(a)}`))
        ];
        if (hl.length === 1) hl.push(bt('No strongly positive or challenging aspects stood out this year - a baseline period.', '本年并无特别突出的吉相或挑战性相位——属基线平稳期。'));
        pos = [
          bt('Grounded in real planetary positions checked against your FULL natal chart (all 12 points, including the North/South Node), not just the natal Sun.', '依据真实行星位置，核对您完整本命盘（全部12个本命点，含北／南交点），而非仅本命太阳。'),
          bt('Every "good"/"caution" point below traces back to one specific, named real aspect - not a generic yearly theme.', '以下每一项「吉」／「慎」皆可追溯至一个具体、明确命名的真实相位——并非泛用的年度主题。'),
          bt('An honest "quieter year" is reported when genuinely no major aspect is found, rather than a manufactured theme.', '若确实未形成主要相位，将如实呈现「较平静的一年」，而非刻意编造主题。')
        ];
        neg = [
          bt('A mid-year snapshot represents the whole year for these slow-moving planets - an aspect exact earlier or later in the year may feel stronger or weaker at different months (see the Monthly Deep Reading below for a finer breakdown).', '年中快照代表全年（因这些行星移动缓慢）——某相位若在年内较早或较晚才准确形成，不同月份的感受强弱可能有所不同（更细致的分月解读请见下方「逐月深度解读」）。'),
          bt('Aspect scoring weights (Trine/Sextile positive, Square/Opposition challenging, Conjunction by planet) are a documented, disclosed convention - other astrologers may weight differently.', '相位评分权重（三分相／六分相偏正面，四分相／对分相偏挑战性，合相依行运行星而定）为公开、有据可查的惯例——不同占星师可能采用不同权重。'),
          bt('Square/Opposition aspects are traditionally read as challenging, not automatically bad - they often mark growth achieved through friction.', '四分相／对分相传统上被视为具挑战性，但并非必然为负面——往往代表透过摩擦而获得的成长。'),
          yearData.hasHouses
            ? bt('House placement (1/4/7/10 angular houses weighted slightly higher) is now factored into each aspect\'s score - a real, disclosed astrological convention, not the only one in use.', '宫位归属（角宫第1、4、7、10宫权重略高）现已纳入各相位评分——此为一种公开、有据可查的占星惯例，并非唯一采用的方式。')
            : bt('No house-level detail here - add a birth latitude (re-select your country/city with time) to also see which real-world life area (house) each aspect activates.', '此处未纳入宫位层级细节——请重新选择您的出生国家／城市并填写出生时间以补充纬度，即可查看各相位所触动的实际生活领域（宫位）。')
        ];
        cau = [
          bt('This is one disclosed astrological lens on the year, not a deterministic forecast - treat alongside, not instead of, your BaZi Liu Nian (annual pillar) reading.', '此为对本年度的一种公开占星视角，并非绝对预测——请与您的八字流年分析并行参考，而非取而代之。'),
          bt('Orbs (tolerances) used here are a specific, moderate convention - other astrologers may use tighter or wider orbs and reach different conclusions.', '此处采用特定、中等宽度的容许度惯例——其他占星师可能采用更紧或更宽的容许度，并得出不同结论。'),
          bt('For any major decision flagged here as challenging, take the time the situation deserves rather than acting on a single data point.', '若本处提示某事项具挑战性，请给予该情况应有的审慎时间，而非仅凭单一数据点行事。')
        ];
      }
  } else if (type === 'astro_monthly_deep') {
      // ENHANCEMENT (requested directly: "provide a monthly deep reading for current year and following
      // year... categorize into Very Auspicious/Auspicious/Neutral/Inauspicious/Very Inauspicious...
      // based on the movements of the planets"). See computeMonthlyDeepReading in engine-metaphysics.js.
      const forecast = extraData?.forecast;
      if (!forecast) {
        chars = bt('Monthly deep reading unavailable.', '逐月深度解读暂无法计算。');
      } else {
        const best = forecast.best, worst = forecast.worst;
        // ENHANCEMENT (requested directly: "explain in detail what those mean to the profile"): describeH
        // used to just name the transit-sign/natal-point pairing plus its bare elemental relationship
        // label. describeMonthlyHighlightMeaning (engine-metaphysics.js) now spells out the concrete life
        // domain this actually touches and what a month like this characteristically brings.
        const describeH = (m, h) => describeMonthlyHighlightMeaning(m, h);
        chars = bt(`Monthly Deep Reading: ${forecast.months.length} months (${forecast.months[0].year}-${String(forecast.months[0].month).padStart(2,'0')} to ${forecast.months[forecast.months.length-1].year}-${String(forecast.months[forecast.months.length-1].month).padStart(2,'0')}). Best: ${best.year}-${String(best.month).padStart(2,'0')} (${best.tier.en}). Most cautious: ${worst.year}-${String(worst.month).padStart(2,'0')} (${worst.tier.en}).`,
          `逐月深度解读：共${forecast.months.length}个月（${forecast.months[0].year}年${forecast.months[0].month}月至${forecast.months[forecast.months.length-1].year}年${forecast.months[forecast.months.length-1].month}月）。最佳月份：${best.year}年${best.month}月（${best.tier.zh}）。最宜谨慎月份：${worst.year}年${worst.month}月（${worst.tier.zh}）。`);
        exp = bt(`Each month blends two real layers: (1) that year's slow-moving outer-planet-and-Node backdrop (from the Annual Deep Reading above, spread evenly across its 12 months), and (2) the transiting Sun's own real zodiac sign that month (a mid-month snapshot), checked against every one of your 12 natal points by Element/Modality relationship - weighted so your Sun and Moon (the most personally significant points) carry the most weight, and your natal outer planets (a generational, not personal, signature) the least. Each highlighted month below spells out the concrete life area a strong pairing actually touches, not just which sign the Sun was transiting.`,
          `每月解读结合两层真实数据：(1) 该年份缓慢移动的外行星与交点背景（取自上方「流年深度解读」，平均分摊至该年12个月），及 (2) 当月太阳的真实行运星座（以月中为快照），依元素／宫性关系核对您全部12个本命点——并加权计算，使太阳与月亮（个人意义最重的本命点）权重最高，本命外行星（属世代而非个人印记）权重最低。以下每个重点月份皆说明其强关联实际触及的具体生活领域，而非仅列出太阳行运所在星座。`);
        traits = best.highlights.length
          ? bt(`Your single best month, ${best.year}-${String(best.month).padStart(2,'0')}, is driven largely by: ${describeH(best, best.highlights[0])}`, `您评级最佳的月份（${best.year}年${best.month}月）主要受此影响：${describeH(best, best.highlights[0])}`)
          : bt('No single month stands out sharply from the rest - a fairly even window overall.', '并无单一月份特别突出——整体窗口起伏较为平均。');
        hl = [
          bt(`Best month: ${best.year}-${String(best.month).padStart(2,'0')} (${best.tier.en}).`, `最佳月份：${best.year}年${best.month}月（${best.tier.zh}）。`),
          bt(`Most cautious month: ${worst.year}-${String(worst.month).padStart(2,'0')} (${worst.tier.en}).`, `最宜谨慎月份：${worst.year}年${worst.month}月（${worst.tier.zh}）。`),
          bt('Scored from real transiting positions each month, not a fixed repeating template.', '每月均依真实行运位置评分，并非固定重复的模板。')
        ];
        pos = [
          bt('Checks EVERY natal point each month (weighted by personal significance), not the natal Sun alone.', '每月核对全部本命点（依个人意义加权），而非仅本命太阳。'),
          bt('Combines a real yearly backdrop with a real monthly layer, rather than one flat monthly score.', '结合真实的年度背景与真实的月度层面，而非单一扁平的月度评分。'),
          bt('The best/most-cautious months are picked from genuine score differences across the window, not evenly spaced for appearance.', '最佳／最宜谨慎月份取自窗口内真实的评分差异，而非为求美观而均匀分布。')
        ];
        neg = [
          bt('The monthly Sun-sign layer is a sign-level (not exact-degree) approximation - see the honesty note on compute3YearAstroMonthly\'s own scope for what this deliberately does and does not capture.', '月度太阳星座层面为星座层级（非精确度数）的近似值——具体涵盖范围请参见compute3YearAstroMonthly的诚实说明。'),
          bt('Mercury/Venus/Mars transits (which change sign multiple times a year) are not tracked monthly here - only their NATAL positions feed into the weighting.', '水星／金星／火星的行运（每年多次换座）未在此逐月追踪——仅其本命位置纳入加权计算。'),
          bt('A single month\'s tier can shift quickly if read too literally - treat the tier as a general lean, not a precise daily forecast.', '若过度按字面解读，单月评级可能显得起伏较大——请将其视为大致倾向，而非精确的每日预测。'),
          forecast.houses
            ? bt('House placement (1/4/7/10 angular houses weighted slightly higher) is now factored into each natal point\'s monthly weighting - a real, disclosed astrological convention, not the only one in use.', '宫位归属（角宫第1、4、7、10宫权重略高）现已纳入各本命点的每月加权计算——此为一种公开、有据可查的占星惯例，并非唯一采用的方式。')
            : bt('No house-level detail here - add a birth latitude (re-select your country/city with time) to also see which real-world life area (house) each highlight activates.', '此处未纳入宫位层级细节——请重新选择您的出生国家／城市并填写出生时间以补充纬度，即可查看各重点所触动的实际生活领域（宫位）。')
        ];
        cau = [
          bt('Use this as a general monthly lean, alongside (not instead of) this app\'s BaZi Liu Yue (flowing month) readings.', '请将此作为大致的月度倾向参考，并与本应用的八字流月分析并行使用，而非取而代之。'),
          bt('For a single important date within a "cautious" month, this app\'s Ze Ri (date selection) reading gives day-level detail this monthly view does not.', '若「谨慎」月份内有特别重要的日期，本应用的择日分析可提供此月度视角未涵盖的逐日细节。'),
          bt('Orbs, weights, and the Element/Modality convention used here are one disclosed, documented approach among several in use among astrologers.', '此处采用的容许度、权重及元素／宫性惯例，为占星师之间多种公开做法之一。')
        ];
      }
  } else if (type === 'cross_system_synthesis') {
      // ENHANCEMENT (requested directly, completed per "proceed to complete all pending items"): see
      // computeCrossSystemSynthesis/generateCrossSystemSynthesisHTML above for the full honesty note on
      // what this reading does (lays 4 independent systems' own real signals side by side) and does not
      // do (claim cross-framework "agreement" or blend them into one score).
      const syn = extraData?.synthesis;
      if (!syn) {
        chars = bt('Cross-System Profile Synthesis unavailable.', '跨体系命盘综合分析暂无法计算。');
      } else {
        const careerHasQmdj = !!syn.career.qmdj, wealthHasSecondQmdj = syn.wealth.qmdj.lifeDoorAlsoMaps, relHasQmdj = !!syn.relationships.qmdj;
        chars = bt(`Career, Wealth, and Relationships, laid out side by side as independently computed by BaZi (Ten Gods), Zi Wei Dou Shu (palace/star placement), Qi Men Dun Jia (Door domains), and Western astrology (Sun/Venus sign).`,
          `事业、财富与人际关系三大领域，依八字（十神）、紫微斗数（宫位／星曜）、奇门遁甲（门之主管领域）及西方占星（太阳／金星星座）各自独立计算的结果并列呈现。`);
        exp = bt(`Each domain below shows exactly one real, already-computed signal from each of the 4 systems this app already tracks for this profile - the same Ten God engine, Zi Wei palace/star data, QMDJ Wealth Palace/Life Door, and Sun/Venus sign tables already used in this app's own dedicated sections for each system, simply re-read through the lens of Career/Wealth/Relationships and placed together. No new astrological or Chinese-metaphysics math is introduced here - only the domain-bucketing logic that decides which of each system's existing outputs belongs under which of the 3 headings.`,
          `以下每个领域，皆直接取自本应用已针对此档案计算的4个体系中各一项真实信号——即本应用各体系自身专属章节中已使用的相同十神引擎、紫微宫位／星曜数据、奇门财帛宫／命宫之门，以及太阳／金星星座对照表，仅重新以事业／财富／人际关系为视角整理并列呈现。此处未引入任何新的占星或中华命理运算——唯一新增的是决定各体系既有输出应归入三大类别中哪一项的分类逻辑。`);
        traits = bt(`Your dominant Ten God family across your whole chart is ${syn.career.bazi.dominantFamily} (${syn.career.bazi.dominantTheme.en}) - worth reading alongside the domain-specific counts below.`,
          `您整体命盘中真正主导的十神类别为${{officer:'官杀',wealth:'财星',output:'食伤',resource:'印枭',peer:'比劫'}[syn.career.bazi.dominantFamily]}（${syn.career.bazi.dominantTheme.zh}）——建议与下方各领域的具体数量一并参考。`);
        hl = [
          bt(`Career: ${syn.career.bazi.count} Officer-family Ten God(s); Zi Wei Career Palace has ${syn.career.ziwei.stars.length} star(s); ${careerHasQmdj ? 'your QMDJ Life Door maps directly to Career' : 'QMDJ Life Door does not map to Career this time'}; Western Sun Sign ${syn.career.western.sign}.`,
            `事业：${syn.career.bazi.count}个官杀类十神；紫微官禄宫有${syn.career.ziwei.stars.length}颗星曜；${careerHasQmdj ? 'QMDJ命宫之门直接对应事业' : 'QMDJ命宫之门此次未对应事业'}；西方太阳星座为${syn.career.western.sign}。`),
          bt(`Wealth: ${syn.wealth.bazi.count} Wealth-family Ten God(s); Zi Wei Wealth Palace has ${syn.wealth.ziwei.stars.length} star(s); QMDJ Wealth Palace door is ${syn.wealth.qmdj.door}${wealthHasSecondQmdj ? ' (reinforced by the Life Door too)' : ''}; natal Venus in ${syn.wealth.western.venusSign}.`,
            `财富：${syn.wealth.bazi.count}个财星类十神；紫微财帛宫有${syn.wealth.ziwei.stars.length}颗星曜；奇门财帛宫之门为${syn.wealth.qmdj.door}${wealthHasSecondQmdj ? '（命宫之门亦同时呼应）' : ''}；本命金星位于${syn.wealth.western.venusSign}。`),
          bt(`Relationships: Day Branch (${syn.relationships.bazi.dayBranchCN}) hidden Ten Gods; Zi Wei Spouse Palace has ${syn.relationships.ziwei.stars.length} star(s); ${relHasQmdj ? 'your QMDJ Life Door maps directly to Relationships' : 'QMDJ Life Door does not map to Relationships this time'}; Western Sun Sign ${syn.relationships.western.sign}.`,
            `人际关系：日支（${syn.relationships.bazi.dayBranchCN}）藏干十神；紫微夫妻宫有${syn.relationships.ziwei.stars.length}颗星曜；${relHasQmdj ? 'QMDJ命宫之门直接对应人际关系' : 'QMDJ命宫之门此次未对应人际关系'}；西方太阳星座为${syn.relationships.western.sign}。`)
        ];
        pos = [
          bt('Every value shown traces back to a function/table this app already uses and has already verified for that system\'s own dedicated section - nothing here is a new, unverified calculation.', '所有显示的数值皆源自本应用已使用并已验证的既有函数／对照表，均取自各体系自身专属章节——此处并无任何全新、未经验证的运算。'),
          bt('Presents all 4 systems for all 3 domains even when a system has little or nothing to say for a given domain (e.g. no Officer-family Ten God) - an honest "not much signal here" is shown rather than a manufactured one.', '即使某体系对某领域几乎无话可说（例如未见官杀类十神），仍如实呈现所有4个体系于全部3大领域的结果——如实呈现「此处信号有限」，而非刻意编造。'),
          bt('Explicitly does not claim the 4 systems "agree" - a claim this app has no principled basis to make across 4 structurally different traditions.', '并未宣称四大体系彼此「一致」——本应用并无原则性依据，可在四种结构迥异的传统体系之间作出此类论断。')
        ];
        neg = [
          bt('This is a side-by-side presentation, not a blended score - if you want one number, use this app\'s own dedicated compatibility/rating readings for each system instead (BaZi Day Master analysis, Zi Wei Life Palace reading, QMDJ Life Door reading, Western Sun Sign profile).', '这是并列呈现，而非混合评分——若需要单一数值，请改用本应用中各体系自身专属的评分／解读（八字日主分析、紫微命宫解读、奇门命门解读、西方太阳星座分析）。'),
          bt('The Qi Men Dun Jia Life Door only maps cleanly onto Career or Relationships for 3 of its 6 possible doors (Kai Men/Xiu Men respectively) - for the other 3, no QMDJ signal is shown under that domain, which is an honest gap, not an error.', '奇门遁甲命宫之门仅在6个门中的3个（分别对应开门／休门）能明确对应事业或人际关系——其余3个门于该领域下不显示QMDJ信号，此为如实呈现的缺口，而非错误。'),
          bt('The Western Wealth signal uses natal Venus\'s Element only (no house system) unless this profile has a birth latitude on file - see the Full Natal Chart section for whether houses are available for you.', '西方财富信号（除非此档案已记录出生纬度）仅采用本命金星之元素，未涉及宫位系统——本命档案是否已启用宫位功能，请见「完整本命盘」章节。')
        ];
        cau = [
          bt('Treat this as a cross-reference tool for your own reflection, not a verdict - where the 4 systems point in different directions, that is itself real, disclosed information about the limits of combining independent traditions, not a flaw to be resolved.', '请将此视为供您自行参考、反思的交叉对照工具，而非定论——若四大体系指向不同方向，这本身即是关于跨体系整合之局限的真实、如实信息，而非需要修正的缺陷。'),
          bt('Ten God family counts are drawn from a small sample (a handful of stems/hidden stems per chart) - a 0-count for a family is a real absence in this specific chart, not a universal negative.', '十神类别的数量统计样本有限（每张命盘仅有少数天干／藏干）——某类别计数为零，仅代表此特定命盘中真实缺席，并非普遍性的负面结论。'),
          bt('For any major life decision, consult this app\'s own fuller, dedicated reading for whichever single system you weight most heavily, rather than this summary view alone.', '任何重大人生决策，建议参考您最重视的单一体系于本应用中更完整的专属解读，而非仅依赖此摘要视图。')
        ];
      }
  } else if (type === 'compat_life' || type === 'compat_biz') {
      // ENHANCEMENT 6/7 FIX: extended BaZi Element + Zodiac Synergy compatibility, with 3x frictions
      // (and how to manage them) plus a summary findings paragraph, for both Life and Business Partner.
      const isBiz = type === 'compat_biz';
      const cr = extraData?.compatResult; const score = cr ? cr.score : 85;
      const partnerLabel = isBiz ? 'Business Partner' : 'Life Partner';
      const partnerP = extraData?.partnerP;
      const zodiacLine = (() => {
        if (!partnerP) return '';
        // BUG FIX (found while deepening compatibility per request): this first branch had no
        // Chinese translation at all - it always showed English text even in Chinese mode, unlike the
        // other three branches below it, which already handled this correctly.
        if (p.zodiacData.allies.includes(partnerP.animal)) return bt(`Your ${p.animal} and their ${partnerP.animal} are natural Zodiac Allies - a strongly reinforcing pairing.`, `您的属${p.animalCN}与对方的属${partnerP.animalCN}为天然生肖三合——高度互助的组合。`);
        if (p.zodiacData.hidden === partnerP.animal) return bt(`Your ${p.animal} and their ${partnerP.animal} form a Hidden Ally pairing - quiet, understated support.`, `您的属${p.animalCN}与对方的属${partnerP.animalCN}构成六合关系——低调而实在的助力。`);
        if (p.zodiacData.avoid === partnerP.animal) return bt(`Your ${p.animal} and their ${partnerP.animal} sit in a Zodiac Conflict relationship - a genuine friction point requiring conscious management.`, `您的属${p.animalCN}与对方的属${partnerP.animalCN}属生肖相冲——需要刻意管理的真实摩擦点。`);
        return bt(`Your ${p.animal} and their ${partnerP.animal} are Zodiac-neutral - neither reinforcing nor conflicting.`, `您的属${p.animalCN}与对方的属${partnerP.animalCN}生肖上属中性——既不加强也不冲突。`);
      })();
      const elementLine = cr?.breakdown?.[0] || bt('Elemental Day Master interaction analysed.', '已分析日主五行互动关系。');

      chars = bt(`${partnerLabel} compatibility score: ${score}%, derived from BaZi Day Master Wu Xing (Five Element) interaction, Zodiac Synergy, and cross-referenced against Bone Weight, I Ching, Numerology, Qi Men Dun Jia, Zi Wei Dou Shu, Western Astrology, and Da Yun between ${p.animal} and ${partnerP ? partnerP.animal : 'the partner'}.`,
        `${isBiz?'事业伙伴':'伴侣'}契合度评分：${score}%，由八字日主五行互动、生肖相合关系推算，并与${p.animalCN}和${partnerP ? partnerP.animalCN : '对方'}之间的称骨、易经、数字命理、奇门遁甲、紫微斗数、西方占星及大运交叉核实。`);
      exp = `${cr ? cr.breakdown.join(' ') : bt(isBiz ? 'Business compatibility strips emotion, targeting core profit distribution and execution speed.' : 'This compatibility chart reveals deep resonance and friction points in the emotional relationship.', isBiz ? '事业契合度分析剔除情感因素，聚焦核心利润分配与执行效率。' : '此契合度分析揭示情感关系中的深层共鸣与摩擦点。')} ${zodiacLine}`;
      traits = score >= 85 ? bt(`A high-resonance pairing - the elemental and Zodiac factors are more supportive than conflicting, giving the ${isBiz?'partnership':'relationship'} a naturally stable foundation.`, `高度共鸣的组合——五行与生肖因素相助多于相冲，为${isBiz?'合作关系':'感情关系'}奠定天然稳定的基础。`)
        : score >= 70 ? bt(`A workable pairing with a healthy mix of natural resonance and friction points that both parties will need to consciously manage.`, `可行的组合，天然共鸣与摩擦点兼而有之，双方需刻意加以管理。`)
        : bt(`A pairing with more friction points than natural resonance - meaningful, but likely to require deliberate effort to stay harmonious.`, `摩擦点多于天然共鸣的组合——依然有意义，但需刻意努力方能维持和谐。`);
      // BUG FIX (reported: "the compatibility reading should encompass all aspects and not just the
      // elements... look into the bazi, QMDJ, ZWDS, Numerology, Astrology, Da Yun, Bone Weight"):
      // previously this list showed only 3 generic items - overall score, the elemental line, and
      // ONE of zodiac/branch. Every other genuinely-computed factor (Kua group, Bone Weight, I Ching,
      // Numerology, QMDJ, Zi Wei Dou Shu, Western Astrology, Da Yun) was calculated in
      // calculateTrueCompatibility but never surfaced here. Now shows the overall score, the zodiac
      // relationship (computed separately from the breakdown array), and the FULL breakdown list
      // covering every system that was actually factored into the score.
      hl = [bt(`Overall ${isBiz?'alignment':'compatibility'}: ${score}%.`, `整体${isBiz?'契合度':'契合度'}：${score}%。`), zodiacLine, ...(cr?.breakdown || [elementLine])];
      pos = score >= 80
        ? bt(isBiz ? ['Fast, low-friction decision-making.', 'Complementary skill sets likely across execution areas.', 'Shared resilience under commercial pressure.'] : ['Natural ease in day-to-day communication.', 'Shared resilience through difficult periods.', 'Complementary strengths across most life domains.'],
             isBiz ? ['决策迅速，摩擦较少。', '执行层面技能可能互补。', '商业压力下展现共同韧性。'] : ['日常沟通自然轻松。', '困难时期展现共同韧性。', '大多数生活领域互补。'])
        : bt(isBiz ? ['Differences can sharpen decision-making if structured well.', 'Clear role division can offset natural friction.', 'Written agreements can pre-empt likely disagreement points.'] : ['Differences can be a source of growth if approached with patience.', 'Awareness of friction points allows for proactive management.', 'Shared goals can bridge elemental/branch differences.'],
             isBiz ? ['若结构安排得当，差异可使决策更犀利。', '明确分工可抵消天然摩擦。', '书面协议可预先化解可能的分歧点。'] : ['以耐心面对，差异也可成为成长的契机。', '意识到摩擦点便能主动管理。', '共同目标可弥合五行／日支差异。']);
      neg = score >= 80
        ? bt(isBiz ? ['High synergy can mask the need for formal agreements.', 'Similar instincts may create shared blind spots.', 'Still put clear roles and exit terms in writing.'] : ['High resonance can occasionally breed complacency.', 'Similar blind spots may go unchallenged.', 'Still worth actively nurturing rather than assuming it runs on autopilot.'],
             isBiz ? ['高度契合可能掩盖了对正式协议的需求。', '相似的直觉可能形成共同盲点。', '仍应以书面形式明确分工与退出条款。'] : ['高度共鸣有时会滋生自满。', '相似的盲点可能未被察觉。', '仍需主动经营，切勿以为可自动运转。'])
        : bt(isBiz ? ['Decision-making may take longer to align.', 'Higher chance of disagreement under pressure.', 'Requires more deliberate structure than a highly synergistic pairing.'] : ['Requires more conscious communication than an easier pairing.', 'Friction points may resurface during stress.', 'Compromise will be a more frequent requirement than for a highly resonant pairing.'],
             isBiz ? ['决策达成一致可能耗时更长。', '压力下产生分歧的机率较高。', '相较高度契合的组合，需要更刻意的结构安排。'] : ['相较轻松的组合，需要更用心的沟通。', '压力下摩擦点可能重新浮现。', '相较高度共鸣的组合，需要更频繁的妥协。']);
      cau = isBiz
        ? bt(['Formalise roles, equity, and exit terms regardless of the score.', 'Revisit if either party\'s birth details are corrected.', 'Treat this as a communication aid, not a substitute for due diligence.'], ['无论评分高低，均应正式明确分工、股权与退出条款。', '若任一方出生数据有更正，请重新解读。', '请将此作为沟通辅助，而非替代尽职调查。'])
        : bt(['Use this as a conversation starter, not a verdict on the relationship.', 'Revisit if either party\'s birth details are corrected.', 'Pair with open communication - no chart substitutes for that.'], ['请将此作为交流的开端，而非感情关系的定论。', '若任一方出生数据有更正，请重新解读。', '请搭配坦诚沟通——任何命盘都无法取代真实交流。']);

      const elemFriction = (cr?.breakdown || []).find(b => b.toLowerCase().includes('overcom') || b.toLowerCase().includes('clash'));
      const frictions = [
        {
          friction: elemFriction ? bt(`Elemental friction: ${elemFriction}`, `五行摩擦：${elemFriction}`) : bt(`Elemental pairing is broadly neutral rather than actively reinforcing.`, `五行配对大致中性，而非积极相助。`),
          management: bt(isBiz ? 'Assign decision rights along each partner\'s stronger element/domain rather than defaulting to consensus on everything.' : 'Lean on each other\'s strengths deliberately rather than expecting instinctive alignment on every decision.',
            isBiz ? '按各自五行／领域优势分配决策权，而非事事诉诸共识。' : '刻意依靠彼此的强项，而非期待每个决定都本能地一致。')
        },
        {
          friction: p.zodiacData.avoid === partnerP?.animal ? bt(`Zodiac Conflict between ${p.animal} and ${partnerP.animal} can surface as recurring miscommunication.`, `${p.animalCN}与${partnerP?.animalCN}之间的生肖相冲，可能表现为反复的沟通不畅。`) : bt(`Pace/communication-style mismatches can emerge even without a direct Zodiac Conflict.`, `即使没有直接的生肖相冲，节奏／沟通风格的差异仍可能出现。`),
          management: bt(isBiz ? 'Set a regular, structured check-in cadence rather than relying on ad-hoc alignment.' : 'Agree on a simple, low-drama way to flag friction early (e.g. a specific check-in time) rather than letting it build up.',
            isBiz ? '设定规律、结构化的沟通节奏，而非依赖临时协调。' : '约定一个简单、低调的方式及早提出摩擦（例如固定的沟通时段），而非任其累积。')
        },
        {
          friction: score < 80 ? bt(`Overall score (${score}%) signals more effort required than a naturally high-synergy pairing.`, `整体评分（${score}%）显示需要比天然高度契合的组合付出更多努力。`) : bt(`Even high-synergy pairings can drift into assuming alignment without verifying it.`, `即使是高度契合的组合，也可能在未经核实的情况下想当然地认为彼此一致。`),
          management: bt(isBiz ? 'Put the partnership agreement, equity split, and exit terms in writing early, independent of how well things are going.' : 'Schedule periodic, unhurried check-ins on the relationship itself, not just day-to-day logistics.',
            isBiz ? '尽早以书面形式确立合伙协议、股权分配与退出条款，无论目前进展如何。' : '定期安排不急不忙的时间，专门检视感情关系本身，而非只谈日常事务。')
        }
      ];
      const summary = bt(`${partnerLabel} compatibility lands at ${score}% - ${score>=85?'a high-resonance pairing':score>=70?'a workable, generally positive pairing':'a pairing that will benefit from deliberate effort'}. ${elementLine} ${zodiacLine} The path forward is the same regardless of score: name the specific friction points above early, agree on how to manage them, and revisit this reading if either party's birth details are ever corrected.`,
        `${isBiz?'事业伙伴':'伴侣'}契合度为${score}% - ${score>=85?'高度共鸣的组合':score>=70?'大体正向、可行的组合':'需刻意用心经营的组合'}。${elementLine} ${zodiacLine} 无论评分高低，前进之道相同：及早点明上述具体摩擦点，共同约定应对方式，并在任一方出生数据有更正时重新解读此分析。`);
      opts = { frictions, summary };
  } else if (type === 'name') {
      const usedChinese = !!p.chineseNameCompat;
      const fRen = gridFortune(p.renGe), fDi = gridFortune(p.diGe), fZong = gridFortune(p.zongGe);
      const keyGridsNote = bt(`Of the five grids, Ren Ge, Di Ge, and Zong Ge are traditionally weighted most heavily. Yours: Ren Ge ${p.renGe} (${fRen.theme}, ${fRen.label.en}), Di Ge ${p.diGe} (${fDi.theme}, ${fDi.label.en}), Zong Ge ${p.zongGe} (${fZong.theme}, ${fZong.label.en}).`,
        `五格之中，传统上以人格、地格、总格三者权重最高。您的：人格${p.renGe}（${fRen.theme}，${fRen.label.zh}）、地格${p.diGe}（${fDi.theme}，${fDi.label.zh}）、总格${p.zongGe}（${fZong.theme}，${fZong.label.zh}）。`);
      const englishStrokeCaveat = usedChinese ? '' : bt(
        ` Honesty note: the Five Grids system is fundamentally built on Chinese calligraphy stroke counts, which English letters do not have - this English-name version substitutes a letter-value scheme to produce workable grid numbers, but that substitution has no traditional basis of its own. Treat this specific reading as illustrative rather than authoritative, more so than the Chinese-name version.`,
        ` 诚实说明：五格体系根本建立在汉字笔画数之上，英文字母并无笔画可言——此英文姓名版本以字母数值方案替代以产生可用的格数，但此替代方式本身并无传统依据。此项分析宜视为示意参考，其权威性低于中文姓名版本。`
      );
      chars = bt(`Five Grids Name Analysis (based on your ${usedChinese ? 'Chinese' : 'English'} name): Tian Ge ${p.tianGe}, Ren Ge ${p.renGe}, Di Ge ${p.diGe}, Zong Ge ${p.zongGe}.`, `五格姓名分析（依据您的${usedChinese ? '中文' : '英文'}姓名）：天格${p.tianGe}，人格${p.renGe}，地格${p.diGe}，总格${p.zongGe}。`);
      exp = bt(`Each grid represents a different life phase - Tian Ge (heritage/elders), Ren Ge (self/core personality), Di Ge (foundation/early life), and Zong Ge (overall destiny). ${usedChinese ? 'Calculated from the traditional stroke count of each character in your Chinese name, which takes priority over the English name whenever a Chinese name is on file.' : 'Calculated from a Pythagorean letter-value analysis of your English name, since no Chinese name is on file.'} ${keyGridsNote}${englishStrokeCaveat}`,
        `每一格代表人生的不同阶段——天格（祖荫／长辈）、人格（自我／核心性格）、地格（根基／早年）、总格（整体命运）。${usedChinese ? '依据您中文姓名每个字的传统笔画数推算；只要有中文姓名，即优先采用中文姓名分析。' : '由于未提供中文姓名，改以英文姓名的字母数字命理（毕达哥拉斯数值）推算。'} ${keyGridsNote}${englishStrokeCaveat}`);
      traits = bt(`The interaction between grids shows how inherited traits (Tian Ge) combine with core personality (Ren Ge) to shape your overall life trajectory (Zong Ge). Per the classical 81-number fortune table, your Ren Ge (core personality grid) reads as ${fRen.label.en.toLowerCase()}.`,
        `五格之间的互动显示先天特质（天格）如何与核心性格（人格）结合，塑造您整体的人生轨迹（总格）。依传统八十一数吉凶表，您的人格（核心性格格）判定为${fRen.label.zh}。`);
      hl = bt([`Tian Ge ${p.tianGe} anchors your inherited/family context.`, `Ren Ge ${p.renGe} (${fRen.theme}) anchors your core personality - ${fRen.label.en}.`, `Zong Ge ${p.zongGe} (${fZong.theme}) anchors your overall destiny arc - ${fZong.label.en}.`],
        [`天格${p.tianGe}奠定您的先天／家族背景。`, `人格${p.renGe}（${fRen.theme}）奠定您的核心性格——${fRen.label.zh}。`, `总格${p.zongGe}（${fZong.theme}）奠定您整体的命运走向——${fZong.label.zh}。`]);
      pos = bt(['Provides a consistent name-based reference distinct from birth-time systems.', 'Useful for gut-checking name changes (e.g. business/stage names).', 'Complements the BaZi and Numerology readings.'],
        ['提供有别于出生时间体系的稳定姓名参考。', '有助于评估改名（如商号／艺名）的可行性。', '补充八字与数字命理分析。']);
      neg = bt(['Grid numerology is a coarse signal on its own.', 'Effects are cumulative and subtle rather than dramatic.', 'Name-based systems vary between schools of practice.'],
        ['单看五格数理属较粗略的指标。', '其影响是累积且细微的，而非剧烈的。', '姓名学各流派之间存在差异。']);
      cau = bt(['Do not make a legal name change decision on this alone.', 'Recalculate if spelling or legal name changes.', 'Pair with BaZi and Numerology before acting on the findings.'],
        ['不宜单凭此作出法定改名的决定。', '若拼写或法定姓名变更，请重新计算。', '采取行动前请搭配八字与数字命理分析。']);
  } else if (type === 'dayMaster') {
      const dmStemCN = stemCN[p.bazi.dayStemIdx]; const dmStemEN = stems[p.bazi.dayStemIdx];
      chars = bt(`Day Master (日主): ${dmStemEN} (${dmStemCN}). This is the core self-element against which all other pillars are measured.`, `日主：${dmStemEN}（${dmStemCN}）。这是衡量命盘中其他所有柱位的核心自身元素。`);
      exp = bt(`The Day Master defines your fundamental elemental nature and how you interact with resource, wealth, output, and authority elements found elsewhere in the chart.`, `日主定义了您的根本五行本质，以及您与命盘中其他印星、财星、食伤、官杀等元素的互动方式。`);
      traits = bt(`Governs core temperament, decision-making style, and the elements that will strengthen or weaken you across different luck cycles.`, `主导核心性格、决策风格，以及在不同大运周期中会增强或削弱您的五行元素。`);
      hl = [bt(`Day Master: ${dmStemEN} (${dmStemCN}).`, `日主：${dmStemEN}（${dmStemCN}）。`), bt(`Sets the reference point for every other pillar in the chart.`, `为命盘中每一柱设定参照基准。`), bt(`Also anchors the Bone Weight, Numerology, and compatibility calculations.`, `同时也是称骨、数字命理与合婚计算的基础。`)];
      pos = [bt('A single, stable anchor for interpreting the whole chart.', '为解读整个命盘提供单一、稳定的锚点。'), bt('Makes Da Yun cycle strength/weakness assessable in a consistent way.', '使大运周期的强弱评估具有一致性。'), bt('Directly usable for compatibility scoring against other charts.', '可直接用于与其他命盘的契合度评分。')];
      neg = [bt('Day Master strength still depends on the surrounding pillars, not just the stem itself.', '日主强弱仍取决于四周柱位，而非单凭天干本身。'), bt('A single-element view is a simplification of a fuller BaZi strength assessment.', '单一元素视角是对完整八字强弱评估的简化。'), bt('Should be read alongside the full Four Pillars, not in isolation.', '应结合完整四柱一起解读，不宜单独判断。')];
      cau = [bt('Avoid treating the Day Master element alone as your complete elemental profile.', '不要仅凭日主元素判断您的完整五行状况。'), bt('Combine with the full pillar set for major decisions.', '重大决策应结合完整四柱综合考量。'), bt('Reassess only if birth data itself is corrected - the Day Master does not change otherwise.', '仅在出生资料被更正时才需重新评估——日主本身不会改变。')];
  } else if (type === 'bazi_macro') {
      const elemNames = ['Wood','Fire','Earth','Metal','Water']; const elemNamesZH = ['木','火','土','金','水'];
      const dmElem = elemNames[Math.floor(p.bazi.dayStemIdx / 2)]; const dmElemZH = elemNamesZH[Math.floor(p.bazi.dayStemIdx / 2)];
      chars = bt(`Macro structure across all Four Pillars: Year ${stemCN[p.bazi.yearStemIdx]}${branchCN[p.bazi.yearBranchIdx]}, Month ${stemCN[p.bazi.monthStemIdx]}${branchCN[p.bazi.monthBranchIdx]}, Day ${stemCN[p.bazi.dayStemIdx]}${branchCN[p.bazi.dayBranchIdx]}, Hour ${stemCN[p.bazi.hourStemIdx]}${branchCN[p.bazi.hourBranchIdx]} - a ${dmElem}-based Day Master chart.`, `四柱宏观结构：年柱${stemCN[p.bazi.yearStemIdx]}${branchCN[p.bazi.yearBranchIdx]}，月柱${stemCN[p.bazi.monthStemIdx]}${branchCN[p.bazi.monthBranchIdx]}，日柱${stemCN[p.bazi.dayStemIdx]}${branchCN[p.bazi.dayBranchIdx]}，时柱${stemCN[p.bazi.hourStemIdx]}${branchCN[p.bazi.hourBranchIdx]} —— 以${dmElemZH}为日主的命盘。`);
      exp = bt(`Reading the Four Pillars together (rather than any single pillar in isolation) reveals the overall balance of your chart: how much support your ${dmElem} Day Master receives from its surrounding stems and branches, versus how much it is challenged or drained.`, `将四柱合并解读（而非孤立看待任何一柱）可揭示命盘的整体平衡：您的${dmElemZH}日主从周围干支获得多少生扶，又受到多少克泄。`);
      traits = bt(`A well-balanced chart shows resource and output elements in reasonable proportion around the Day Master; a lopsided chart leans heavily toward support or heavily toward challenge, which shapes which Da Yun cycles will feel easiest.`, `平衡的命盘中，印星与食伤元素围绕日主保持合理比例；失衡的命盘则明显偏向生扶或明显偏向克泄，这决定了哪些大运周期会感觉更顺遂。`);
      hl = [bt('Year Pillar frames your family/ancestral context and early conditioning.', '年柱framing您的家族背景与早年成长环境。'), bt('Month Pillar carries the most weight for career/social positioning.', '月柱在事业与社会定位上权重最大。'), bt('Hour Pillar reflects later-life outlook and inner world.', '时柱反映晚年境况与内心世界。')];
      pos = [bt('A full-chart view avoids over-reading any single pillar in isolation.', '整体命盘视角避免对单一柱位的过度解读。'), bt('Clarifies which Da Yun cycles will likely feel most supportive.', '明确哪些大运周期可能感觉最为顺遂。'), bt('Gives a consistent structural basis for every other reading in this app.', '为本应用中其他所有分析提供一致的结构基础。')];
      neg = [bt('A complete strength assessment also weighs seasonal timing (Month Branch) in more depth than shown here.', '完整的强弱评估还需更深入权衡季节时令（月支），本处未完全展开。'), bt('Interactions between pillars (combinations, clashes) add further nuance not fully expanded here.', '柱位之间的互动（合、冲）会带来更多细节，本处未完全展开。'), bt('Best treated as a structural overview, not a full professional BaZi consultation.', '此处应视为结构性概览，而非完整的专业八字咨询。')];
      cau = [bt('Use this as an orientation, not a final structural verdict.', '请将此作为方向性参考，而非最终结构定论。'), bt('A professional reading can go deeper into pillar-to-pillar interactions.', '专业解读可更深入分析柱位间的互动关系。'), bt('Recheck if birth time precision is ever improved (affects the Hour Pillar).', '若出生时间精度日后有所修正，应重新核算（会影响时柱）。')];
  } else if (type === 'bazhai') {
      // BUG 7 FIX: driven by the real 8-Mansions (Ba Zhai) star lookup for the profile's own Kua Number
      // against the selected door direction - genuinely changes across all 8 directions, not just a binary match/mismatch.
      const dir = extraData?.direction || '';
      const star = BAZHAI_STARS[p.kuaNum] ? BAZHAI_STARS[p.kuaNum][dir] : null;
      const info = star ? BAZHAI_STAR_INFO[star] : null;
      if (star && info) {
        chars = bt(`Main door facing [${dir}] activates the [${star} (${info.zh})] star for Kua ${p.kuaNum} (${p.kuaGroup}).`, `大门朝向 [${dir}] 为命卦 ${p.kuaNum}（${p.kuaGroup}）激活 [${star}（${info.zh}）] 星。`);
        exp = bt(`In the 8 Mansions (Ba Zhai) system, each of the 8 compass directions maps to one of 8 stars relative to your personal Kua number. The [${dir}] facing specifically activates ${star}, rated ${info.rating}: ${info.desc}`, `在八宅系统中，8个方位分别对应您本命卦位的8个星曜。[${dir}] 朝向具体激活了 ${star}（${info.zh}），评级为${info.rating}：${info.desc}`);
        traits = bt(`Rating: ${info.rating}. This assessment is entirely dependent on the exact direction selected and will change if the door facing changes.`, `评级：${info.rating}。此评估完全取决于所选的确切方位，若大门朝向改变，评估结果也会随之改变。`);
        const isGood = info.rating.includes('Auspicious') && !info.rating.includes('In');
        hl = isGood
          ? [bt(`${star} star activated - ${info.desc}`, `已激活${star}星 —— ${info.desc}`), bt(`Direction reinforces Kua ${p.kuaNum} energy.`, `此方位强化命卦 ${p.kuaNum} 的能量。`), bt(`One of your 4 favourable directions.`, `属于您的4个吉利方位之一。`)]
          : [bt(`${star} star activated - ${info.desc}`, `已激活${star}星 —— ${info.desc}`), bt(`Direction works against Kua ${p.kuaNum} energy.`, `此方位不利于命卦 ${p.kuaNum} 的能量。`), bt(`One of your 4 unfavourable directions.`, `属于您的4个不利方位之一。`)];
        pos = isGood ? [bt('Enhanced Qi absorption at the main door.', '大门处气场吸收增强。'), bt('Supports the specific life area this star governs.', '支持此星曜所主管的特定生活领域。'), bt('Reinforces long-term stability.', '强化长期稳定性。')] : [bt('Awareness allows early correction.', '及早察觉便可及早化解。'), bt('Remedies can meaningfully offset the mismatch.', '化解方法能有效抵消不利影响。'), bt('Other palace factors can still compensate.', '其他宫位因素仍可起到补偿作用。')];
        neg = isGood ? [bt('Can create over-exposure to guests/visitors.', '可能造成访客/外人过度介入。'), bt('May amplify existing chart excesses.', '可能放大命盘中原有的过旺元素。'), bt('Requires periodic Qi audits.', '需要定期进行气场检视。')] : [bt(`Elevated risk in the domain governed by ${star}.`, `${star}星所主管领域的风险有所提升。`), bt('Reduced Qi efficiency at the main door.', '大门处气场效率降低。'), bt('Higher sensitivity to external Sha Qi.', '对外部煞气更为敏感。')];
        cau = isGood ? [bt('Do not over-clutter the entrance.', '切勿在入口处堆积杂物。'), bt('Keep the door well-lit.', '保持大门处光线充足。'), bt('Reassess after any renovation.', '装修后应重新评估。')] : [bt('Consider a discreet direction-correcting remedy (mirror/plant/screen).', '可考虑低调的方位化解物（镜子/植物/屏风）。'), bt('Avoid sharp structures directly facing the door.', '避免尖角结构正对大门。'), bt('Reassess if occupants or Kua group change.', '若住户或命卦组别改变，应重新评估。')];
        const bestDir = findBestBazhaiDirection(p.kuaNum);
        const bestDirText = bestDir ? bt(`your ${bestDir.direction} direction (your ${bestDir.star} direction)`, `您的${DIR_LABEL_ZH[bestDir.direction] || bestDir.direction}方（即您的${bestDir.star}方位）`) : bt('your own best-rated direction (see the Ba Zhai deep profile above for the exact compass bearing)', '您本命卦评级最佳的方位（详见上方八宅深度分析中的具体方位）');
        // ENHANCEMENT 1 FIX: explicit remedies/suggestions countering the Negatives/Cautions above.
        opts = { remedies: isGood
          ? [bt(`Reinforce ${star}'s benefit with good lighting and an uncluttered, welcoming entrance.`, `以良好采光及整洁通畅的入口强化${star}星的助益。`), bt('Avoid introducing clashing Sha Qi elements (sharp corners, direct straight roads) right at the doorway.', '避免在门口引入冲突性的煞气元素（尖角、直冲道路）。'), bt('Schedule a periodic Qi audit (e.g. yearly) since flying-star influences shift year to year even when the door itself does not.', '建议定期（如每年）进行气场检视，因为即使大门不变，流年飞星影响仍会逐年变化。')]
          : [bt(`Place a countering element or object (mirror, plant, or a small water feature - practitioner-guided) near the entrance to soften ${star}'s influence.`, `在入口附近摆放化解物品（镜子、植物或小型水景 —— 建议咨询专业人士）以缓解${star}星的影响。`), bt('Where structurally possible, use a secondary/side door for daily use and reserve the main door for guests.', '若结构允许，日常可使用侧门/次门，大门则留给访客使用。'), bt(`Orient your bedroom door, bed, and work desk toward ${bestDirText} to offset the main door mismatch.`, `将卧室门、床位及办公桌朝向${bestDirText}，以抵消大门方位不利的影响。`)]
        };
      } else {
        chars = bt(`Select a main door facing direction to generate your personalised Ba Zhai deep analysis.`, `请选择大门朝向以生成您的个人化八宅深度分析。`);
        exp = bt(`Your Kua Number (${p.kuaNum}, ${p.kuaGroup}) determines which of the 8 directions carry the 4 auspicious stars (Fu Wei, Sheng Qi, Tian Yi, Yan Nian) versus the 4 inauspicious stars (Huo Hai, Wu Gui, Liu Sha, Jue Ming).`, `您的命卦（${p.kuaNum}，${p.kuaGroup}）决定了8个方位中，哪些承载4个吉星（伏位、生气、天医、延年），哪些承载4个凶星（祸害、五鬼、六煞、绝命）。`);
        traits = bt(`Results are fully dynamic and will regenerate immediately whenever the direction is changed.`, `结果完全动态生成，方位一经更改即会立即重新生成。`);
      }
  } else if (type === 'bazhai_household') {
      // ENHANCEMENT 2 FIX: additional Ba Zhai deep analysis combining Individual + Life Partner's own
      // Kua groups against the same selected door direction, with dedicated remedies.
      const dir = extraData?.direction || ''; const partnerP = extraData?.partnerP;
      const meStar = BAZHAI_STARS[p.kuaNum]?.[dir]; const meInfo = meStar ? BAZHAI_STAR_INFO[meStar] : null;
      const pStar = BAZHAI_STARS[partnerP.kuaNum]?.[dir]; const pInfo = pStar ? BAZHAI_STAR_INFO[pStar] : null;
      if (meInfo && pInfo) {
        const meGood = meInfo.rating.includes('Auspicious') && !meInfo.rating.includes('In');
        const pGood = pInfo.rating.includes('Auspicious') && !pInfo.rating.includes('In');
        const bothGood = meGood && pGood, bothBad = !meGood && !pGood, mixed = meGood !== pGood;
        chars = bt(`Household reading for the [${dir}] door: activates ${meStar} (${meInfo.rating}) for you (Kua ${p.kuaNum}) and ${pStar} (${pInfo.rating}) for ${partnerP.displayName} (Kua ${partnerP.kuaNum}).`, `[${dir}] 门向的家庭解读：为您（命卦 ${p.kuaNum}）激活${meStar}（${meInfo.rating}），为${partnerP.displayName}（命卦 ${partnerP.kuaNum}）激活${pStar}（${pInfo.rating}）。`);
        exp = bt(`Because you and ${partnerP.displayName} each carry a different Kua Number, the SAME door direction activates a different one of the 8 Mansions stars for each of you. ${bothGood ? 'In this case, the direction happens to favour both of you.' : bothBad ? 'In this case, the direction is unfavourable for both of you.' : `In this case, the direction favours ${meGood ? 'you' : partnerP.displayName} but not ${meGood ? partnerP.displayName : 'you'} - a common and manageable situation in shared housing.`}`,
          `由于您和${partnerP.displayName}的命卦不同，同一门向会为二人分别激活不同的八宅星曜。${bothGood ? '此情况下，此方位恰好对二人皆有利。' : bothBad ? '此情况下，此方位对二人皆不利。' : `此情况下，此方位对${meGood ? '您' : partnerP.displayName}有利，但对${meGood ? partnerP.displayName : '您'}不利 —— 这是共同居住中常见且可化解的情况。`}`);
        traits = bt(mixed ? `Mixed-Kua households are the norm, not the exception - the practical goal is to give the disadvantaged partner their own compensating auspicious zone elsewhere in the home, not to find one direction that perfectly suits both people.` : (bothGood ? `A rare aligned household where the same main door direction genuinely favours both partners.` : `Both partners share the same directional disadvantage here, which raises the value of remedies at this specific door.`),
          mixed ? `混合命卦家庭是常态而非例外 —— 实际目标是为处于劣势的一方在家中其他地方设置专属吉利区域，而非强求一个方位同时适合两人。` : (bothGood ? `这是难得一见的完全契合家庭，同一大门方位真正同时有利于双方。` : `双方在此方位上处于相同的不利状态，这提高了在此门位进行化解的价值。`));
        hl = [bt(`You: ${meStar} (${meInfo.rating}).`, `您：${meStar}（${meInfo.rating}）。`), bt(`${partnerP.displayName}: ${pStar} (${pInfo.rating}).`, `${partnerP.displayName}：${pStar}（${pInfo.rating}）。`), bt(bothGood ? 'Direction favours both partners.' : bothBad ? 'Direction favours neither partner.' : 'Direction favours one partner only.', bothGood ? '此方位对双方皆有利。' : bothBad ? '此方位对双方皆不利。' : '此方位仅对一方有利。')];
        pos = bothGood ? [bt('Shared reinforcing Qi at the main entrance.', '大门处气场对双方共同强化。'), bt('Simplifies Feng Shui planning - one direction works for both.', '简化风水规划 —— 一个方位同时适合双方。'), bt('Reduces need for individual compensating zones.', '减少设置个人化解区域的需要。')]
          : mixed ? [bt(`${meGood ? 'You' : partnerP.displayName} benefit directly from this door as-is.`, `${meGood ? '您' : partnerP.displayName}可直接从此门位获益。`), bt('The disadvantaged partner can fully compensate via their own personal auspicious zones (bedroom, desk) elsewhere.', '处于劣势的一方可通过家中其他专属吉利区域（卧室、书桌）完全弥补。'), bt('Mixed-Kua households are extremely common - this is a manageable, not alarming, finding.', '混合命卦家庭极为常见 —— 此发现可妥善化解，无需担忧。')]
          : [bt('Clear, shared incentive to invest in remedies at this door.', '双方在此门位投入化解措施的动机一致明确。'), bt('Both partners are motivated to address the same issue together.', '双方都有动力共同解决同一问题。'), bt('Compensating zones elsewhere can be planned jointly.', '可共同规划家中其他化解区域。')];
        neg = bothGood ? [bt('Can create complacency about the rest of the home\'s Feng Shui.', '可能导致对家中其他风水方面掉以轻心。'), bt('Still worth periodic reassessment as flying stars shift yearly.', '仍值得定期重新评估，因为流年飞星逐年变化。'), bt('Other doors/rooms still need their own assessment.', '其他门位/房间仍需各自评估。')]
          : mixed ? [bt(`${meGood ? partnerP.displayName : 'You'} do not get direct benefit from this specific door.`, `${meGood ? partnerP.displayName : '您'}无法从此特定门位直接获益。`), bt('Requires slightly more deliberate planning than a fully-aligned household.', '相比完全契合的家庭，需要更审慎的规划。'), bt('Without adjustment, the disadvantaged partner may feel a subtle, hard-to-name friction at home.', '若不加以调整，处于劣势的一方可能在家中感受到难以名状的细微摩擦。')]
          : [bt('Neither partner draws support from this specific door without remedy.', '若不化解，双方均无法从此门位获得助力。'), bt('Higher reliance on remedies and compensating zones.', '更依赖化解措施与补偿区域。'), bt('Worth prioritising fixes here over lower-impact areas of the home.', '此处应优先于其他影响较小的区域进行化解。')];
        cau = [bt('Treat this as a planning input for shared living spaces, not a verdict on the relationship itself.', '请将此视为共同居住空间的规划参考，而非对关系本身的定论。'), bt('Reassess if either partner\'s Kua changes (it does not, but recheck if birth data is corrected).', '若任一方命卦发生变化应重新评估（命卦本身不会变，但若出生资料被更正需重新核算）。'), bt('Combine with each partner\'s individual Ba Zhai reading above for the full picture.', '请结合上方各自的八宅个人解读以获得完整图景。')];
        const disadvantagedKua = meGood ? partnerP.kuaNum : p.kuaNum;
        const disadvantagedBestDir = findBestBazhaiDirection(disadvantagedKua);
        const disadvantagedDirText = disadvantagedBestDir ? bt(`facing ${disadvantagedBestDir.direction} (their ${disadvantagedBestDir.star} direction)`, `朝向${DIR_LABEL_ZH[disadvantagedBestDir.direction] || disadvantagedBestDir.direction}方（即其${disadvantagedBestDir.star}方位）`) : bt('facing their own best-rated direction', '朝向其本命卦评级最佳的方位');
        opts = { remedies: bothGood
          ? [bt('Maintain the entrance well - good lighting, no clutter - to keep both partners\' shared benefit active.', '保持入口整洁明亮，以维持双方共同获益的效果。'), bt('Revisit yearly, since flying-star overlays shift even when the door itself does not.', '建议每年重新检视，因为即使门位不变，流年飞星叠加影响仍会变化。')]
          : mixed
          ? [bt(`Give ${meGood ? partnerP.displayName : 'you'} a personal auspicious zone: position their bedroom door, bed, or home-office desk ${disadvantagedDirText} to compensate for this door.`, `为${meGood ? partnerP.displayName : '您'}设置专属吉利区域：将卧室门、床位或书房书桌${disadvantagedDirText}，以弥补此门位的不足。`), bt('Keep the main door itself neutral and welcoming rather than trying to force it to suit both Kua numbers at once.', '大门本身保持中性、宜人即可，不必强求同时适合两个命卦。'), bt('A qualified practitioner can suggest a door-specific remedy that softens the less favourable side without cancelling the favourable one.', '专业人士可针对此门位提供化解方案，缓和不利一方而不抵消有利一方。')]
          : [bt('Prioritise a door remedy (mirror, plant, or screening - practitioner-guided) since neither partner benefits as-is.', '由于双方均未获益，应优先在此门位进行化解（镜子、植物或屏风 —— 建议咨询专业人士）。'), bt(`Both partners should set up personal auspicious zones elsewhere in the home: you ${findBestBazhaiDirection(p.kuaNum) ? bt(`facing ${findBestBazhaiDirection(p.kuaNum).direction}`, `朝向${DIR_LABEL_ZH[findBestBazhaiDirection(p.kuaNum).direction]}方`) : ''}, ${partnerP.displayName} ${findBestBazhaiDirection(partnerP.kuaNum) ? bt(`facing ${findBestBazhaiDirection(partnerP.kuaNum).direction}`, `朝向${DIR_LABEL_ZH[findBestBazhaiDirection(partnerP.kuaNum).direction]}方`) : ''}.`, `双方都应在家中其他地方设置个人专属吉利区域：您${findBestBazhaiDirection(p.kuaNum) ? `朝向${DIR_LABEL_ZH[findBestBazhaiDirection(p.kuaNum).direction]}方` : ''}，${partnerP.displayName}${findBestBazhaiDirection(partnerP.kuaNum) ? `朝向${DIR_LABEL_ZH[findBestBazhaiDirection(partnerP.kuaNum).direction]}方` : ''}。`), bt('Consider whether a secondary entrance can be used as the primary daily-use door instead.', '可考虑改用次要入口作为日常主要使用的大门。')]
        };
      } else {
        chars = bt(`Select a main door facing direction above to generate the combined household Ba Zhai reading for you and ${partnerP?.displayName || 'your Life Partner'}.`, `请在上方选择大门朝向，以生成您与${partnerP?.displayName || '生活伴侣'}的家庭综合八宅解读。`);
        exp = bt(`Once a direction is selected, this reading will show how the same door affects both of your individual Kua numbers side by side.`, `选定方位后，此解读将并列显示同一门位对二人各自命卦的影响。`);
        traits = bt(`Results are fully dynamic and regenerate whenever the direction is changed.`, `结果完全动态生成，方位一经更改即会重新生成。`);
      }
  } else if (type === 'bazhai_occupants') {
      // ENHANCEMENT 3 FIX: combined Ba Zhai deep analysis across Individual + Life Partner (if
      // available) + up to 10 additional household occupants, each contributing their own Kua group.
      const dir = extraData?.direction || ''; const people = extraData?.people || [];
      if (dir && people.length) {
        const rated = people.map(person => {
          const star = BAZHAI_STARS[person.kuaNum]?.[dir]; const info = star ? BAZHAI_STAR_INFO[star] : null;
          const isGood = info ? (info.rating.includes('Auspicious') && !info.rating.includes('In')) : false;
          return { ...person, star, info, isGood };
        });
        const goodCount = rated.filter(r => r.isGood).length;
        const total = rated.length;
        const pct = Math.round((goodCount / total) * 100);
        const eastCount = people.filter(p2 => p2.kuaGroup.startsWith('East')).length;
        const westCount = total - eastCount;
        chars = bt(`Full household roster for the [${dir}] door: ${total} ${total===1?'occupant':'occupants'} (${eastCount} East-group, ${westCount} West-group Kua). ${goodCount} of ${total} (${pct}%) draw a favourable star from this specific door.`, `[${dir}] 门位的完整住户名单：共 ${total} 人（东四命 ${eastCount} 人，西四命 ${westCount} 人）。其中 ${goodCount}/${total}（${pct}%）从此门位获得吉星。`);
        exp = bt(`Each occupant's own Kua Number determines which of the 8 Mansions stars this door activates for them individually - a direction that suits the majority will not automatically suit everyone, especially in mixed East/West-group households.`, `每位住户各自的命卦决定此门位为其个别激活哪一颗八宅星曜 —— 适合多数人的方位不一定适合所有人，尤其在东西四命混合的家庭中。`);
        traits = bt(pct >= 70 ? `A strongly favourable door for the household overall - most occupants draw a supportive star here.` : pct >= 40 ? `A mixed-result door - a meaningful share of the household benefits, but a significant minority does not.` : `A door that favours only a minority of the household as-is - the strongest candidate in this roster for a remedy or for reserving as a secondary/guest entrance.`,
          pct >= 70 ? `此门位对整个家庭而言非常有利 —— 大多数住户在此获得吉星支持。` : pct >= 40 ? `此门位结果参半 —— 相当一部分住户受益，但仍有不少人未获益。` : `此门位目前仅对少数住户有利 —— 在此名单中最应优先化解，或考虑改作次要/访客入口。`);
        hl = [bt(`${goodCount}/${total} occupants (${pct}%) favoured by this door.`, `${goodCount}/${total} 位住户（${pct}%）受此门位眷顾。`), bt(`Household split: ${eastCount} East-group, ${westCount} West-group.`, `家庭组成：东四命 ${eastCount} 人，西四命 ${westCount} 人。`), bt(rated.filter(r=>!r.isGood).length ? `${rated.filter(r=>!r.isGood).map(r=>r.label).join(', ')} draw an unfavourable star here.` : 'All occupants draw a favourable star here.', rated.filter(r=>!r.isGood).length ? `${rated.filter(r=>!r.isGood).map(r=>r.label).join('、')} 在此门位获得不利星曜。` : '所有住户在此门位均获得吉星。')];
        pos = pct >= 70 ? [bt('Majority of the household is directly supported by this door.', '家庭大多数成员直接受此门位支持。'), bt('Lower overall need for compensating remedies.', '整体上对化解措施的需求较低。'), bt('Simplifies day-to-day Feng Shui planning for the whole home.', '简化了全家日常风水规划。')]
          : [bt('Clear, specific list of who benefits and who does not - easy to plan around.', '清楚列明谁受益、谁不受益 —— 便于针对性规划。'), bt('Unaffected occupants can be prioritised for compensating personal zones.', '未受益的住户可优先设置个人补偿区域。'), bt('Even a minority-favouring door is workable with targeted remedies.', '即使门位仅利好少数人，透过针对性化解仍可妥善处理。')];
        neg = pct >= 70 ? [bt('The supported majority can make it easy to overlook the minority\'s needs.', '多数人受益容易导致忽略少数人的需求。'), bt('Still worth confirming each occupant\'s personal zones individually.', '仍值得为每位住户逐一确认其个人区域。'), bt('Flying-star overlays shift yearly even when the roster itself is stable.', '即使住户名单不变，流年飞星叠加影响仍会逐年变化。')]
          : [bt('A large share of the household does not draw direct benefit from this door as-is.', '相当一部分家庭成员未能从此门位直接获益。'), bt('Requires more active remedy planning than a majority-favouring door.', '相比多数人受益的门位，需要更主动的化解规划。'), bt('Risk of the minority\'s needs being deprioritised in practice.', '实际执行中，少数人的需求有被忽视的风险。')];
        cau = [bt('Re-run this analysis whenever an occupant moves in, moves out, or their birth details are corrected.', '每当有住户迁入、迁出或出生资料被更正时，应重新运行此分析。'), bt('Treat as a planning tool for shared spaces, not a ranking of household members.', '请将此视为共享空间的规划工具，而非对家庭成员的排名。'), bt('Combine with each occupant\'s own personal auspicious zones (bedroom/desk) for the fullest picture.', '请结合每位住户各自的个人吉利区域（卧室/书桌）以获得最完整的图景。')];
        opts = { remedies: [
          bt(`Give each unfavoured occupant (${rated.filter(r=>!r.isGood).map(r=>r.label).join(', ') || 'none currently'}) their own compensating auspicious zone (bedroom or desk facing their personal favourable direction).`, `为每位未获益的住户（${rated.filter(r=>!r.isGood).map(r=>r.label).join('、') || '目前无'}）设置专属补偿吉利区域（卧室或书桌朝向其个人吉利方位）。`),
          bt(pct < 70 ? 'Consider a door-specific remedy (mirror, plant, or screening - practitioner-guided) since less than the majority benefits as-is.' : 'Maintain the entrance well to preserve the majority benefit, and revisit yearly as flying-star overlays shift.', pct < 70 ? '由于受益者未过半，建议针对此门位进行化解（镜子、植物或屏风 —— 建议咨询专业人士）。' : '保持入口整洁良好以维持多数人受益的效果，并每年重新检视流年飞星变化。'),
          bt('Re-assess this roster whenever occupancy changes - the door itself does not need to change for the verdict to shift.', '住户变动时应重新评估此名单 —— 即使门位不变，结论也可能随之改变。')
        ]};
      } else {
        chars = bt(`Add occupants and select a main door facing direction above to generate the full household roster reading.`, `请在上方添加住户并选择大门朝向，以生成完整的家庭名单解读。`);
        exp = bt(`This reading factors in every added occupant's own Kua Number (up to 10) alongside yours and your Life Partner's (if added), showing what share of the household is favoured by the current door.`, `此解读将纳入每位已添加住户（最多10人）各自的命卦，连同您及生活伴侣（如已添加），显示当前门位对整个家庭的受益比例。`);
        traits = bt(`Fully dynamic - regenerates whenever occupants or the direction change.`, `完全动态生成 —— 住户或方位一经更改即会重新生成。`);
      }
  } else if (type === 'household_compat' && extraData && Array.isArray(extraData.roster)) {
      // ENHANCEMENT (Phase 2 - "Household compatibility: a compatibility-score table plus an overall
      // score plus deep analysis across every pair of family/household profiles" - previously entirely
      // MISSING: calculateTrueCompatibility was already used for User-vs-Partner, User-vs-Business-
      // Partner, and User-vs-each-Child, but never for household occupants, and never PAIRWISE across
      // every member of the household at once). Every household member is now a real, computed profile
      // (see buildHouseholdCompatibilityRoster/getOccupantProfileData above), so every distinct pair
      // gets a genuine BaZi/Kua/Bone-Weight/etc-based score from the same engine used everywhere else
      // in this app - nothing here is a placeholder or a simplified stand-in score.
      const roster = extraData.roster;
      const pairs = [];
      for (let i = 0; i < roster.length; i++) {
        for (let j = i + 1; j < roster.length; j++) {
          const cr = calculateTrueCompatibility(roster[i].profile, roster[j].profile, false);
          pairs.push({ a: roster[i], b: roster[j], cr });
        }
      }
      if (pairs.length) {
        const overall = Math.round(pairs.reduce((sum, pr) => sum + pr.cr.score, 0) / pairs.length);
        const strongest = pairs.reduce((best, pr) => pr.cr.score > best.cr.score ? pr : best, pairs[0]);
        const weakest = pairs.reduce((worst, pr) => pr.cr.score < worst.cr.score ? pr : worst, pairs[0]);
        const tableRows = pairs.map(pr => bt(`${pr.a.label} ↔ ${pr.b.label}: ${pr.cr.score}%`, `${pr.a.label} ↔ ${pr.b.label}：${pr.cr.score}%`)).join(bt('; ', '；'));
        chars = bt(`Full household compatibility: ${roster.length} people, ${pairs.length} pair${pairs.length===1?'':'s'} compared, overall household score ${overall}%. ${tableRows}.`, `完整家庭契合度：共 ${roster.length} 人，比对 ${pairs.length} 对，家庭总体评分 ${overall}%。${tableRows}。`);
        exp = bt(`This score is computed the same way as this app's own Life Partner and Business Partner compatibility readings - real Day Master element relationships, Kua group alignment, Bone Weight, I Ching, Numerology, Qi Men Dun Jia, Zi Wei Dou Shu, and Western Astrology factors - just applied to EVERY pair of people living in the household at once, not only you against one other person.`, `此评分的计算方式与本应用的伴侣及事业伙伴契合度解读完全相同——基于真实的日主五行关系、命卦组别、称骨、易经、数字命理、奇门遁甲、紫微斗数及西方占星等因素——只是同时应用于家中每一对成员，而不仅是您与单一一人之间的比对。`);
        traits = bt(overall >= 78 ? `A strongly harmonious household overall - most pairings reinforce rather than clash.` : overall >= 60 ? `A workable, ordinary household mix - some pairings are naturally easier than others, which is the norm rather than a concern.` : `A household with more friction points than usual across its pairings - worth using the individual pairwise readings below to plan around specific relationships rather than treating the household as a single unit.`,
          overall >= 78 ? `整体上是一个和谐度很高的家庭 —— 大多数配对彼此增益而非冲突。` : overall >= 60 ? `属于普通、可运作的家庭组合 —— 部分配对本就比其他配对更轻松相处，这是常态而非隐忧。` : `此家庭在各配对之间的摩擦点多于一般水平 —— 建议参考下方各对的个别解读，针对具体关系分别规划，而非将整个家庭视为单一整体。`);
        hl = [bt(`Overall household score: ${overall}%.`, `家庭总体评分：${overall}%。`), bt(`Strongest pairing: ${strongest.a.label} ↔ ${strongest.b.label} (${strongest.cr.score}%).`, `契合度最高：${strongest.a.label} ↔ ${strongest.b.label}（${strongest.cr.score}%）。`), bt(`Most in need of active management: ${weakest.a.label} ↔ ${weakest.b.label} (${weakest.cr.score}%).`, `最需主动经营：${weakest.a.label} ↔ ${weakest.b.label}（${weakest.cr.score}%）。`)];
        pos = [bt('Every household member is now weighed against every other, not just against you.', '现已将每位家庭成员两两互相比对，而不仅是与您个人比对。'), bt('Uses the exact same real compatibility engine as the Life/Business Partner readings - no separate, simplified scoring for the household.', '采用与伴侣／事业伙伴契合度完全相同的真实评分引擎 —— 家庭部分并未使用另一套简化评分。'), bt('Highlights which specific relationship pairs may benefit from extra attention, rather than a single vague household verdict.', '明确指出哪些具体关系配对可能需要额外关注，而非笼统的家庭总评。')];
        neg = [bt('A lower score for a specific pair describes relative elemental/directional dynamics, not a judgment of the people involved.', '某对成员评分较低，反映的是相对的五行／方位动态，而非对当事人本身的评判。'), bt('Occupants with an approximate (migrated) birthdate carry proportionally more uncertainty in their own individual score - see the caveat on their entry above.', '出生日期为约数（由旧格式迁移而来）的住户，其个别评分的不确定性也相应更高——详见其名单中的提示。'), bt('Re-run whenever household membership changes (someone moves in/out) or a birth detail is corrected.', '家庭成员变动（迁入／迁出）或出生资料被更正时，应重新运行此分析。')];
        cau = [bt('A household compatibility score is a planning input for shared living, not a prediction of conflict or harmony.', '家庭契合度评分是共同居住的规划参考，并非对冲突或和睦的预言。'), bt('Combine with each pair\'s individual Ba Zhai directional reading above for the fullest picture.', '请结合上方各自的八宅方位解读以获得最完整的图景。'), bt('An occupant\'s score carries more approximation than a full-profile household member if their birth time (or date, for pre-migration entries) is not exact - remove and re-add them with precise details for a sharper reading.', '若某住户的出生时间（或对早期迁移记录而言，出生日期）并非精确值，其评分的近似程度也会更高——如需更精确的解读，请移除后以精确资料重新添加。')];
        opts = { remedies: [
          bt(weakest.cr.score < 60 ? `Give ${weakest.a.label} and ${weakest.b.label} extra room for their own individual routines and personal auspicious zones, rather than expecting identical shared spaces to suit both equally.` : `The household has no critically weak pairing right now - general Feng Shui upkeep (see the Ba Zhai readings above) is enough.`, weakest.cr.score < 60 ? `建议为${weakest.a.label}与${weakest.b.label}保留各自独立作息与个人吉利区域的空间，而非期望共享空间同时同等适合双方。` : `目前家庭中并无明显薄弱的配对 —— 维持一般风水保养（参见上方八宅解读）即已足够。`),
          bt('Revisit this reading whenever the household roster changes.', '家庭名单变动时，请重新查看此解读。'),
          bt('Use the individual pairwise scores to decide where to invest limited remedy effort first.', '可参考各对的个别评分，优先将有限的化解精力投入最需要的关系配对。')
        ]};
      } else {
        chars = bt(`Add at least one Life Partner, child, or household occupant above to generate a household compatibility reading - at least 2 people are needed to compare.`, `请在上方至少添加一位生活伴侣、子女或住户，以生成家庭契合度解读——至少需要2人方可进行比对。`);
        exp = bt(`This reading pairwise-compares every household member (you, your Life Partner, your children, and every added occupant) using the same real compatibility engine as the Life/Business Partner readings elsewhere in this app.`, `此解读将两两比对每位家庭成员（您本人、生活伴侣、子女及每位已添加住户），采用与本应用其他伴侣／事业伙伴契合度解读相同的真实评分引擎。`);
        traits = bt(`Fully dynamic - regenerates whenever household membership changes.`, `完全动态生成 —— 家庭成员变动即会重新生成。`);
      }
  } else if (type === 'face') {
      chars = bt(`Facial physiognomy reading of the Three Court divisions (Upper/Middle/Lower) and Five Features (eyes, eyebrows, nose, mouth, ears).`, `面相三停（上停／中停／下停）及五官（眼、眉、鼻、口、耳）解读。`);
      exp = bt(`Facial structure reflects how inner character and life force are outwardly expressed and perceived by others, and is read independently of the palm lines.`, `面部结构反映内在性格与生命力如何向外表达并被他人感知，其解读独立于掌纹。`);
      traits = bt(`Balanced facial proportions suggest steady public perception and consistent first impressions across social and professional settings.`, `匀称的面部比例意味着稳定的公众形象，以及在社交与职场中一致的第一印象。`);
      hl = [bt('Upper court indicates early-life foundation strength.', '上停体现早年根基强弱。'), bt('Middle court reflects current career/status momentum.', '中停反映当前事业／地位的势头。'), bt('Lower court points to later-life stability.', '下停预示晚年的稳定性。')];
      pos = [bt('First impressions tend to be consistent and reliable.', '第一印象往往一致且可靠。'), bt('Clear read on how you are perceived in professional settings.', '清楚呈现您在职场中被感知的方式。'), bt('Complements the palm readings with an outward-facing perspective.', '以外在视角补充掌纹解读。')];
      neg = [bt('Facial reading is qualitative and observer-dependent.', '面相解读具主观性，因观察者而异。'), bt('Expression and grooming can temporarily mask underlying structure.', '表情与仪容可能暂时掩盖底层结构。'), bt('Should not be used to make snap judgements about others.', '不应用于对他人做出草率判断。')];
      cau = [bt('Treat as a reflective tool for self-awareness, not a way to judge others.', '请将此视为自我认知的反思工具，而非评判他人的方式。'), bt('Revisit periodically - perceived expression can shift with life stage.', '应定期重新检视 —— 面部表情感知会随人生阶段变化。'), bt('Combine with the palm readings for a fuller picture.', '请结合掌纹解读以获得更完整的图景。')];
  } else if (type === 'palm_left_deep') {
      chars = bt(`Left palm (non-dominant, congenital) reading of the major lines - Life, Head, Heart, and Fate.`, `左手（非惯用手，先天）主要纹路解读 —— 生命线、智慧线、感情线与事业线。`);
      exp = bt(`The left palm records inherited, congenital tendencies - the potential and disposition you were born with, largely fixed rather than shaped by later choices.`, `左手记录先天遗传倾向 —— 您与生俱来的潜能与性情，主要是固定的，较少受后天选择塑造。`);
      traits = bt(`Line depth and clarity suggest a well-defined inherited temperament with clear emotional and intellectual tendencies.`, `纹路的深浅与清晰度显示出明确的先天性情，情感与智性倾向清晰可辨。`);
      hl = [bt('Life line indicates baseline vitality.', '生命线体现基础活力。'), bt('Head line shows natural thinking style.', '智慧线展现天生的思维方式。'), bt('Heart line reveals innate emotional disposition.', '感情线揭示天生的情感特质。')];
      pos = [bt('Gives a stable baseline temperament reference.', '提供稳定的基础性情参照。'), bt('Useful for understanding your starting point before conscious shaping.', '有助理解您在后天塑造之前的起点。'), bt('A consistent counterpart to compare against the right palm.', '可作为与右手对照比较的稳定基准。')];
      neg = [bt('Congenital tendencies are a starting point, not a ceiling.', '先天倾向是起点，而非上限。'), bt('Line reading is qualitative and skill-dependent.', '掌纹解读具主观性，取决于解读者的功力。'), bt('Should not be treated as a fixed, unchangeable verdict.', '不应视为固定不变的定论。')];
      cau = [bt('Read alongside the right palm to see how much has already shifted.', '应结合右手一同解读，以了解已发生多少改变。'), bt('Avoid using congenital traits as an excuse to not develop new skills.', '切勿以先天特质为借口而不发展新技能。'), bt('Best treated as self-awareness input, not a fixed label.', '最好将其视为自我认知的参考，而非固定标签。')];
  } else if (type === 'palm_right_deep') {
      chars = bt(`Right palm (dominant, acquired) reading of the major lines - Life, Head, Heart, and Fate - as they have developed through lived experience.`, `右手（惯用手，后天）主要纹路解读 —— 生命线、智慧线、感情线与事业线，呈现其透过人生历练发展的状态。`);
      exp = bt(`The right palm records acquired willpower and actualized results - how choices, effort, and experience have reshaped the congenital potential recorded on the left palm.`, `右手记录后天意志力与已实现的成果 —— 选择、努力与经历如何重塑左手所记录的先天潜能。`);
      traits = bt(`Comparing right against left palm reveals how much of your innate potential has been actively converted into real-world outcomes.`, `比较左右手可揭示您有多少天生潜能已被主动转化为现实成果。`);
      hl = [bt('Fate line shows career trajectory shifts.', '事业线显示职业轨迹的变化。'), bt('Head line reflects developed decision-making patterns.', '智慧线反映后天发展出的决策模式。'), bt('Heart line shows relationship experience impact.', '感情线体现感情经历的影响。')];
      pos = [bt('Highlights how much lived effort has reshaped your starting potential.', '突显后天努力对起点潜能的重塑程度。'), bt('A useful morale check on progress made so far.', '有助检视目前已取得的进展，提振士气。'), bt('Complements the left palm for a before/after view.', '与左手互补，呈现前后对比。')];
      neg = [bt('Reflects the past, not a guarantee of future trajectory.', '反映过去，不保证未来轨迹。'), bt('Line reading is qualitative and skill-dependent.', '掌纹解读具主观性，取决于解读者的功力。'), bt('Can be over-interpreted if read without the left palm for context.', '若脱离左手对照，容易过度解读。')];
      cau = [bt('Read alongside the left palm, not in isolation.', '应结合左手一同解读，不宜单独判断。'), bt('Use as encouragement/awareness, not a fixed verdict.', '请将其作为激励／自我认知，而非固定定论。'), bt('Revisit periodically as lines can appear to shift with life changes.', '应定期重新检视，因为纹路可能随人生变化而看似改变。')];
  } else if (type === 'boneWeight') {
      const bw = p.boneWeight; const tier = getBoneWeightTier(bw.total);
      chars = bt(`Total Bone Weight: ${bw.displayStr} (${bw.total} Liang), derived from Lunar Year ${bw.lunarYearStemBranch}, Month ${bw.lunarMonth}, Day ${bw.lunarDay}, and the ${bw.shiChenLabel} birth hour.`, `总骨重：${bw.displayStr}（${bw.total} 两），源自农历${bw.lunarYearStemBranch}年、${bw.lunarMonth}月、${bw.lunarDay}日，及${bw.shiChenLabel}出生时辰。`);
      exp = bt(`Cheng Gu Suan Ming (称骨算命) sums four weighted components - Lunar Year (${bw.yearW} Liang), Lunar Month (${bw.monthW} Liang), Lunar Day (${bw.dayW} Liang), and Birth Hour (${bw.hourW} Liang) - and cross-references the total against the traditional Song of Weighing Bones. Your total of ${bw.total} Liang corresponds to a "${tier.tier}" reading: ${tier.summary}`, `称骨算命将四项权重相加 —— 农历年（${bw.yearW}两）、农历月（${bw.monthW}两）、农历日（${bw.dayW}两）、出生时辰（${bw.hourW}两）—— 并将总数与传统《称骨歌》对照。您的总重 ${bw.total} 两对应"${tier.tierZh}"格局：${tier.summaryZh}`);
      traits = bt(`Interpretation traditionally leans toward ${p.isMale ? 'career achievement, ancestral wealth, and societal status' : 'family harmony, marriage luck, and personal longevity'} for this weight bracket.`, `此重量区间的传统解读偏重于${p.isMale ? '事业成就、祖荫财富与社会地位' : '家庭和睦、婚姻运势与个人长寿'}。`);
      hl = [bt(`Overall tier: ${tier.tier}.`, `总体格局：${tier.tierZh}。`), bt(`Year contributes ${bw.yearW} Liang from ${bw.lunarYearStemBranch}.`, `年柱${bw.lunarYearStemBranch}贡献 ${bw.yearW} 两。`), bt(`Hour contributes ${bw.hourW} Liang from the ${bw.shiChenLabel} period.`, `${bw.shiChenLabel}时辰贡献 ${bw.hourW} 两。`)];
      pos = bw.total >= 4.2 ? [bt('Above-average total weight indicates favourable life support.', '总重高于平均水平，显示人生助力较为有利。'), bt('Strong combination of birth components.', '出生四要素组合强劲。'), bt('Traditionally associated with smoother major transitions.', '传统上与较顺遂的重大转折相关联。')] : [bt('Total weight still allows a fulfilling path with steady effort.', '总重仍可透过持续努力成就充实人生。'), bt('Later Da Yun cycles can meaningfully lift the trajectory.', '后段大运周期可显著提升人生轨迹。'), bt('Awareness allows better timing of major decisions.', '及早了解有助更好地把握重大决策时机。')];
      neg = [bt('Traditional weight readings are a folk heuristic, not a deterministic forecast.', '传统称骨解读属民俗参考，并非决定性预测。'), bt('Individual component weights vary slightly between published almanacs.', '各出版历书中各项权重数值略有差异。'), bt('Should be read alongside, not instead of, the full BaZi chart.', '应结合完整八字一同解读，而非取代之。')];
      cau = [bt('Treat this as a reflective/entertainment reference alongside your BaZi reading.', '请将此作为八字解读之外的反思／娱乐参考。'), bt('Exact figures depend on precise lunar conversion; for ceremonial precision consult a Tong Sheng almanac.', '精确数值取决于准确的农历换算；如需礼俗级精度请查阅通胜历书。'), bt('Avoid using the tier label alone to make major life decisions.', '切勿仅凭格局标签做出重大人生决策。')];
  } else if (type === 'boneweight_compat') {
      // ENHANCEMENT 4/5 FIX: Bone Weight compatibility deep analysis, Individual vs Life/Business Partner
      const isBiz = extraData?.isBusiness;
      const partnerLabel = bt(isBiz ? 'Business Partner' : 'Life Partner', isBiz ? '事业伙伴' : '人生伴侣');
      const bw1 = p.boneWeight; const partnerP = extraData?.partnerP; const bw2 = partnerP.boneWeight;
      const tier1 = getBoneWeightTier(bw1.total); const tier2 = getBoneWeightTier(bw2.total);
      const diff = Math.abs(Math.round((bw1.total - bw2.total) * 10) / 10);
      const combined = Math.round((bw1.total + bw2.total) * 10) / 10;
      const closeMatch = diff <= 0.6;
      chars = bt(`Your Bone Weight (${bw1.displayStr}, "${tier1.tier}") compared against ${partnerLabel} ${partnerP.displayName}'s (${bw2.displayStr}, "${tier2.tier}") - a difference of ${diff} Liang, combined total ${combined} Liang.`,
        `您的骨重（${bw1.displayStr}，「${tier1.tierZh}」）与${partnerLabel}${partnerP.displayName}的骨重（${bw2.displayStr}，「${tier2.tierZh}」）相比，相差${diff}两，合计总重${combined}两。`);
      exp = bt(`Cheng Gu Suan Ming compatibility reads the GAP between two totals rather than either total alone: a small gap (under ~0.6 Liang) suggests two broadly similar life-support levels, while a larger gap suggests one party's chart carries proportionally more innate support than the other's - which is not inherently bad, but shapes how resources and effort tend to balance between you.`,
        `称骨算命合婚看的是两人总重之间的「差距」，而非单一数值本身：差距小（0.6两以内）代表二人先天福泽水平相近；差距较大则代表其中一方命格先天承载的助力比例较高——这并非坏事，但会影响双方在资源与付出上的自然平衡方式。`);
      traits = closeMatch
        ? bt(`A closely-matched pairing (${diff} Liang apart) - both charts carry a broadly similar level of innate support, which tends to make shared effort and reward feel proportionate.`,
             `二人命格骨重相近（相差${diff}两），先天助力水平大致相当，共同付出与回报也较容易感觉对等平衡。`)
        : bt(`An unevenly-matched pairing (${diff} Liang apart) - support levels differ meaningfully, so ${isBiz ? 'contribution and reward may not naturally feel 50/50' : 'one partner may naturally feel they are carrying more, even when both are trying equally'}.`,
             `二人命格骨重差距明显（相差${diff}两），先天助力水平有实质差异，${isBiz ? '出资与回报未必自然对等' : '即使双方同样努力，其中一方也可能自然感觉承担较多'}。`);
      hl = bt([`Combined Bone Weight: ${combined} Liang.`, `Gap between charts: ${diff} Liang.`, closeMatch ? 'Closely matched support levels.' : 'Meaningfully different support levels.'],
        [`合计骨重：${combined}两。`, `二人差距：${diff}两。`, closeMatch ? '先天助力水平相近。' : '先天助力水平差异明显。']);
      pos = closeMatch
        ? bt(['Broadly proportionate give-and-take likely.', 'Neither chart is carrying a dramatically heavier load.', 'Shared expectations are easier to calibrate.'],
             ['付出与回报大致对等。', '双方命格皆无明显偏重负荷。', '共同期望较容易协调一致。'])
        : bt([`The heavier-weighted chart (${bw1.total>=bw2.total?'yours':`${partnerP.displayName}'s`}) can anchor stability during hard periods.`, 'Complementary support levels can balance each other over time.', 'Awareness of the gap allows fairer expectation-setting up front.'],
             [`骨重较重一方（${bw1.total>=bw2.total?'您':partnerP.displayName}）可在艰难时期成为稳定支柱。`, '互补的助力水平长期而言可相互平衡。', '及早认知差距，有助双方订立更公平的期望。']);
      neg = closeMatch
        ? bt(['Similar support levels can mean similar blind spots too.', 'Neither party may naturally compensate for the other\'s weak points.', 'Still worth actively building resilience rather than assuming it will balance itself.'],
             ['助力水平相近，也可能意味着盲点相似。', '双方未必能自然弥补对方弱项。', '仍需主动建立韧性，不宜假设会自行平衡。'])
        : bt([isBiz ? 'Contribution expectations may need explicit discussion.' : 'One party may feel under-supported if the gap goes unacknowledged.', 'The lighter-weighted chart may benefit from extra deliberate effort in hard periods.', 'Gap-driven imbalance can compound if never discussed.'],
             [isBiz ? '出资与贡献的期望可能需要明确沟通。' : '若差距未被正视，其中一方可能感觉支援不足。', '骨重较轻一方在艰难时期或需额外刻意努力。', '若从不沟通，差距造成的不平衡可能日积月累。']);
      cau = bt(['Bone Weight compatibility is a folk heuristic layered on top of the BaZi/Zodiac reading, not a standalone verdict.', `Read alongside the ${isBiz?'Business':'Life'} Partner Alignment Reading for the fuller picture.`, 'Recalculate if either party\'s birth details are corrected.'],
        ['称骨合婚为八字生肖分析之上的民俗参考，并非独立定论。', `请配合${isBiz?'事业伙伴':'人生伴侣'}契合度分析一并阅读，方为全面。`, '若任一方出生资料有更正，请重新计算。']);
      opts = { summary: bt(`Combined Bone Weight of ${combined} Liang across a ${diff} Liang gap points to a ${closeMatch ? 'closely balanced' : 'complementary but uneven'} pairing. ${closeMatch ? 'Expect roughly proportionate give-and-take' : 'Expect the more heavily-weighted chart to naturally anchor more of the load'} - name that dynamic explicitly rather than leaving it assumed.`,
        `合计骨重${combined}两、差距${diff}两，显示这是一段${closeMatch ? '较为平衡' : '互补但不均等'}的组合。${closeMatch ? '预期付出与回报大致对等' : '预期骨重较重一方会自然承担较多重心'}——建议明确说出这一动态，而非任其默认。`) };
  } else if (type === 'iching_compat') {
      // ENHANCEMENT 1/2 FIX: I Ching compatibility deep analysis vs Life/Business Partner, with remedies.
      const isBiz = extraData?.isBusiness; const partnerLabel = bt(isBiz ? 'Business Partner' : 'Life Partner', isBiz ? '事业伙伴' : '人生伴侣');
      const partnerP = extraData?.partnerP;
      const compHexes = [8, 16, 24].map(off => mod(p.hexNo - 1 + off, 64) + 1);
      const incompHexes = [32, 40, 48].map(off => mod(p.hexNo - 1 + off, 64) + 1);
      const isComp = compHexes.includes(partnerP.hexNo); const isIncomp = incompHexes.includes(partnerP.hexNo);
      const relation = isComp ? 'compatible' : isIncomp ? 'incompatible' : 'neutral';
      const relZh = isComp ? '相合' : isIncomp ? '相冲' : '中性';
      chars = bt(`Your natal Hexagram #${p.hexNo} against ${partnerP.displayName}'s (${partnerLabel}) natal Hexagram #${partnerP.hexNo}: a ${relation} pairing.`,
        `您的本命卦第${p.hexNo}卦，与${partnerLabel}${partnerP.displayName}的本命卦第${partnerP.hexNo}卦：属${relZh}配对。`);
      exp = relation === 'compatible'
        ? bt(`${partnerP.displayName}'s Hexagram #${partnerP.hexNo} falls directly within your own hexagram's compatible set, indicating a naturally resonant pattern of change between you - decisions and transitions tend to unfold in step with each other.`,
             `${partnerP.displayName}的第${partnerP.hexNo}卦正落于您本命卦的相合卦象之中，显示双方变化的节奏自然呼应——决策与转变往往能同步展开。`)
        : relation === 'incompatible'
        ? bt(`${partnerP.displayName}'s Hexagram #${partnerP.hexNo} falls within your own hexagram's incompatible set, indicating the two patterns of change tend to move out of step - not a bad-omen verdict, but a signal that timing and pacing need more deliberate coordination.`,
             `${partnerP.displayName}的第${partnerP.hexNo}卦落于您本命卦的相冲卦象之中，显示双方变化节奏容易不同步——这并非凶兆，而是提醒双方在时机与步调上需要更用心协调。`)
        : bt(`${partnerP.displayName}'s Hexagram #${partnerP.hexNo} is neither directly compatible nor incompatible with yours - a neutral pattern relationship that depends more on how you each individually navigate change.`,
             `${partnerP.displayName}的第${partnerP.hexNo}卦与您的本命卦既非相合亦非相冲——属中性关系，实际结果更取决于双方各自应对变化的方式。`);
      traits = relation === 'compatible' ? bt(`Expect major transitions (career moves, relocations, big decisions) to naturally align in timing more often than not.`, `重大转变（如转职、搬迁、重要决策）的时机往往能自然契合。`)
        : relation === 'incompatible' ? bt(`Expect one of you to occasionally feel "not ready" when the other feels "ready to move" - a pacing gap rather than a fundamental conflict.`, `其中一方感觉「准备好行动」时，另一方可能仍觉「尚未准备好」——这是步调差异，而非根本冲突。`)
        : bt(`Outcomes depend more on individual circumstances than on any inherent hexagram resonance.`, `结果更多取决于个人具体情况，而非卦象本身的固有共鸣。`);
      hl = bt([`Your #${p.hexNo} vs their #${partnerP.hexNo}: ${relation}.`, `${isBiz ? 'Business' : 'Relationship'} timing is the main factor this reading speaks to.`, relation === 'compatible' ? 'Natural alignment on major transitions.' : relation === 'incompatible' ? 'Pacing gap on major transitions.' : 'No strong hexagram-based signal either way.'],
        [`您的第${p.hexNo}卦 对 对方第${partnerP.hexNo}卦：${relZh}。`, `本分析主要针对${isBiz ? '事业' : '关系'}时机而言。`, relation === 'compatible' ? '重大转变时机自然契合。' : relation === 'incompatible' ? '重大转变存在步调差异。' : '卦象上无明显强烈信号。']);
      pos = relation === 'compatible'
        ? bt(['Major decisions tend to feel well-timed for both of you.', 'Lower friction when navigating change together.', 'A natural rhythm that supports joint planning.'],
             ['重大决策对双方而言时机往往恰当。', '共同面对变化时摩擦较少。', '天然的节奏有利共同规划。'])
        : bt(['Awareness of the pacing gap allows you to plan around it deliberately.', 'Complementary timing can mean one of you leads while the other consolidates.', 'Neither hexagram is inherently negative - only the pairing timing differs.'],
             ['察觉步调差异后，可刻意提前规划应对。', '互补的时机安排可让一方带头、另一方稳固后方。', '两卦本身并无吉凶之分，只是配对时机不同。']);
      neg = relation === 'incompatible'
        ? bt(['One party may push for change while the other wants to hold steady.', 'Joint decisions may need more explicit timing discussion than usual.', 'Risk of one party feeling rushed or the other feeling held back.'],
             ['一方可能推动改变，另一方却想保持现状。', '共同决策可能需要比平常更明确地讨论时机。', '存在一方感觉被催促、另一方感觉被拖累的风险。'])
        : bt(['Even resonant pairings still need explicit communication - the hexagram does not do that work for you.', 'Over-relying on this reading can substitute for real conversation about timing.', 'Reading is symbolic, not a guarantee of smooth timing.'],
             ['即使卦象相合，仍需明确沟通——卦象无法代劳。', '过度依赖此分析可能取代真正关于时机的对话。', '此分析属象征性参考，不保证时机必然顺利。']);
      cau = bt(['Use this as a timing/pacing conversation starter, not a verdict on the relationship or partnership itself.', 'Revisit if either party\'s birth details are corrected.', `Pair with the ${isBiz ? 'Business' : 'Life'} Partner Alignment Reading for the fuller picture.`],
        ['请以此作为讨论时机与步调的开端，而非对关系本身的定论。', '若任一方出生资料有更正，请重新查阅。', `请配合${isBiz ? '事业伙伴' : '人生伴侣'}契合度分析一并阅读，方为全面。`]);
      opts = { remedies: relation === 'incompatible'
        ? bt(['Before major joint decisions, explicitly ask "is this the right time for both of us?" rather than assuming alignment.', 'Let the more "ready" party take the lead on timing-sensitive steps, while the other handles preparation and follow-through.', 'Schedule a joint review before big transitions (moves, launches, major purchases) specifically to surface any timing mismatch early.'],
             ['做重大共同决策前，明确询问「这对双方而言都是合适的时机吗？」，而非假设步调一致。', '让感觉「准备好」的一方主导时效性步骤，另一方负责筹备与跟进。', '在重大转变（搬迁、启动、大额支出）前安排共同检视，及早发现时机落差。'])
        : bt(['Keep using open, explicit communication even when timing feels naturally aligned - do not let ease breed assumption.', 'Periodically revisit major joint plans together rather than assuming continued alignment.'],
             ['即使时机感觉自然契合，仍应保持开放明确的沟通——切勿因顺利而想当然。', '定期共同检视重大计划，而非假设契合会持续不变。'])
      };
  } else if (type === 'numerology_compat') {
      // ENHANCEMENT 3/4 FIX: Numerology compatibility deep analysis vs Life/Business Partner, with remedies.
      const isBiz = extraData?.isBusiness; const partnerLabel = bt(isBiz ? 'Business Partner' : 'Life Partner', isBiz ? '事业伙伴' : '人生伴侣');
      const partnerP = extraData?.partnerP;
      const isFav = p.numCompat.includes(partnerP.life); const isAvoid = p.numAvoid.includes(partnerP.life);
      const relation = isFav ? 'favourable' : isAvoid ? 'clashing' : 'neutral';
      const relZh = isFav ? '有利' : isAvoid ? '相冲' : '中性';
      chars = bt(`Your Life Path ${p.life} against ${partnerP.displayName}'s (${partnerLabel}) Life Path ${partnerP.life}: a ${relation} numeric pairing.`,
        `您的生命数字${p.life}，与${partnerLabel}${partnerP.displayName}的生命数字${partnerP.life}：属${relZh}数字配对。`);
      exp = relation === 'favourable'
        ? bt(`${partnerP.displayName}'s Life Path Number (${partnerP.life}) is one of your own favourable numbers, suggesting a numerologically reinforcing dynamic - shared dates, addresses, or joint ventures using either number tend to carry supportive resonance for both of you.`,
             `${partnerP.displayName}的生命数字（${partnerP.life}）正是您的有利数字之一，显示数字命理上具相互加强的动态——共用日期、地址或合作项目中使用任一数字，皆倾向为双方带来助力共鸣。`)
        : relation === 'clashing'
        ? bt(`${partnerP.displayName}'s Life Path Number (${partnerP.life}) falls within your own avoid-number set, suggesting a mildly clashing numeric dynamic - not severe, but worth being deliberate about shared numeric choices (joint account numbers, addresses, important dates).`,
             `${partnerP.displayName}的生命数字（${partnerP.life}）落在您的避免数字之中，显示存在轻微数字相冲——程度不严重，但共同选择数字（联名账户号码、地址、重要日期）时宜多加留意。`)
        : bt(`${partnerP.displayName}'s Life Path Number (${partnerP.life}) is numerologically neutral against your own - neither reinforcing nor clashing.`,
             `${partnerP.displayName}的生命数字（${partnerP.life}）与您的数字属中性关系——既非加强也非相冲。`);
      traits = relation === 'favourable' ? bt(`Joint numeric choices (dates, addresses, registration numbers) have a naturally supportive numerological backdrop.`, `共同的数字选择（日期、地址、登记号码）天然具备数字命理上的助力背景。`)
        : relation === 'clashing' ? bt(`Worth choosing a THIRD, mutually favourable number for major joint decisions rather than defaulting to either person's own Life Path number.`, `重大共同决策宜另选双方皆有利的「第三数字」，而非直接采用任一方自己的生命数字。`)
        : bt(`Numeric choices for joint decisions can be made on practical grounds without a strong numerological pull either way.`, `共同决策的数字选择可依实际考量而定，数字命理上并无明显偏向。`);
      hl = bt([`Your Life Path ${p.life} vs their ${partnerP.life}: ${relation}.`, `Your favourable numbers: ${p.numCompat.join(', ')}.`, `Your avoid numbers: ${p.numAvoid.join(', ')}.`],
        [`您的生命数字${p.life} 对 对方${partnerP.life}：${relZh}。`, `您的有利数字：${p.numCompat.join('、')}。`, `您的避免数字：${p.numAvoid.join('、')}。`]);
      pos = relation === 'favourable'
        ? bt(['Shared dates/addresses naturally carry supportive numeric energy.', 'Joint ventures can lean on either Life Path number with confidence.', 'Simplifies numeric decision-making for major joint choices.'],
             ['共用日期／地址天然带有助力数字能量。', '合作项目可安心采用任一方的生命数字。', '简化重大共同决策中的数字选择过程。'])
        : bt(['A clear, specific number to avoid for major joint choices - easy to plan around.', 'Numerology is a minor supplementary factor, not a major obstacle.', 'A shared favourable number can be deliberately chosen instead.'],
             ['明确知道重大共同选择应避开哪个数字，便于提前规划。', '数字命理只是次要参考因素，并非重大阻碍。', '可刻意另选双方皆有利的数字取代。']);
      neg = relation === 'clashing'
        ? bt(['Defaulting to either Life Path number for major joint numeric choices adds mild friction.', 'Easy to overlook until a specific date/address/number is already locked in.', 'Effect is subtle and cumulative, not dramatic.'],
             ['重大共同数字选择若直接采用任一方生命数字，会增添轻微摩擦。', '容易在日期／地址／号码已经确定后才察觉。', '影响细微且需累积，并非剧烈冲突。'])
        : bt(['A neutral or favourable numeric reading does not guarantee compatibility in other areas.', 'Should not be the deciding factor in major joint decisions.', 'Best treated as a minor supplementary signal.'],
             ['数字中性或有利，不代表其他方面必然契合。', '不应作为重大共同决策的决定性因素。', '宜视为次要的补充参考信号。']);
      cau = bt(['Use this only as a tiebreaker for joint numeric choices, not a major decision driver.', 'Recalculate if either party\'s birth date is corrected.', `Pair with the ${isBiz ? 'Business' : 'Life'} Partner Alignment Reading for the fuller picture.`],
        ['此分析仅作共同数字选择的参考依据，不应成为重大决策的主导因素。', '若任一方出生日期有更正，请重新计算。', `请配合${isBiz ? '事业伙伴' : '人生伴侣'}契合度分析一并阅读，方为全面。`]);
      opts = { remedies: relation === 'clashing'
        ? bt([`For major joint numeric choices, prefer a number from the intersection of your favourable numbers (${p.numCompat.join(', ')}) and theirs, where possible.`, 'Avoid defaulting to either partner\'s own Life Path number for shared account numbers, addresses, or major dates.', 'Where a clash is unavoidable, pair it with a favourable number elsewhere (e.g. a supportive unit/floor number) to help balance it.'],
             [`重大共同数字选择，宜优先采用您的有利数字（${p.numCompat.join('、')}）与对方有利数字的交集。`, '联名账户号码、地址或重要日期，避免直接采用任一方自己的生命数字。', '若相冲无法避免，可搭配其他有利数字（如单位／楼层号码）加以平衡。'])
        : bt(['Continue leaning on shared favourable numbers for major joint choices where practical.', 'No specific remedy needed - maintain awareness rather than active correction.'],
             ['重大共同选择宜继续尽量采用双方共同的有利数字。', '毋须特别化解，保持留意即可，无需主动调整。'])
      };
  } else if (type === 'astro_compat') {
      // ENHANCEMENT (requested directly: "for item 1 [all compatibility to show %], look at the western
      // astrology section. % is missing there"): this used to be a coarse 3-way categorical (Sun Sign
      // compatible/incompatible/neutral) with no numeric score at all - the one compatibility reading in
      // this app without a %. Now computes a real SYNASTRY score (computeSynastryScore in
      // engine-metaphysics.js) whenever both people have a full natal chart on file: every one of one
      // person's 12 real natal points checked against every one of the other's (144 real geometric
      // aspect checks, not a Sun-sign-only shortcut), weighted by aspect type/orb/planet significance,
      // folding in the pre-existing Sun-sign compatible/incompatible check as one input among several
      // rather than discarding it. Falls back to the original Sun-sign-only categorical (still real, just
      // coarser) when either profile is missing birth date/time - never fabricates a score with no data.
      const isBiz = extraData?.isBusiness; const partnerLabel = bt(isBiz ? 'Business Partner' : 'Life Partner', isBiz ? '事业伙伴' : '人生伴侣');
      const partnerP = extraData?.partnerP;
      const isComp = p.astro.comp.includes(partnerP.astro.en); const isIncomp = p.astro.incomp.includes(partnerP.astro.en);
      const relation = isComp ? 'compatible' : isIncomp ? 'incompatible' : 'neutral';
      const relZh = isComp ? '相合' : isIncomp ? '相冲' : '中性';
      const compZh2 = translateSignList(p.astro.comp), incompZh2 = translateSignList(p.astro.incomp);

      const hasFullCharts = !!(p?.bazi?.birthMomentUTC && partnerP?.bazi?.birthMomentUTC);
      const natalChartA = hasFullCharts ? computeFullNatalChart(p.bazi.birthMomentUTC) : null;
      const natalChartB = hasFullCharts ? computeFullNatalChart(partnerP.bazi.birthMomentUTC) : null;
      const sunSignAdj = isComp ? 3 : isIncomp ? -3 : 0;
      const synastry = hasFullCharts ? computeSynastryScore(natalChartA, natalChartB, sunSignAdj) : null;
      // House overlay (requested directly: "all houses and positions of planets in readings") - a
      // genuine, standard synastry technique: which of PARTNER's houses does MY planet fall into, and
      // vice versa. Only shown when BOTH profiles have a birth latitude on file (computeNatalHouses) -
      // honestly omitted otherwise, never guessed.
      const hasHouseOverlay = !!(hasFullCharts && p?.houses && partnerP?.houses);
      const topContacts = synastry ? synastry.aspects.slice(0, 4).map(a => {
        const pa = PLANET_INFO_FULL[a.keyA], pb = PLANET_INFO_FULL[a.keyB];
        const houseNote = hasHouseOverlay
          ? bt(` - your ${pa.en} falls in their House ${assignHouseNumber(natalChartA[a.keyA].lon, partnerP.houses.ascendant)}`, `——您的${pa.zh}落入对方的第${assignHouseNumber(natalChartA[a.keyA].lon, partnerP.houses.ascendant)}宫`)
          : { en: '', zh: '' };
        return bt(`Your ${pa.en} ${a.name} their ${pb.en} (orb ${a.orbUsed.toFixed(1)}°)${houseNote.en}`, `您的${pa.zh}${a.nameZh}对方的${pb.zh}（容许度${a.orbUsed.toFixed(1)}°）${houseNote.zh}`);
      }) : [];

      if (synastry) {
        chars = bt(`Astrology Compatibility Score: ${synastry.score}%. Your Sun Sign ${p.astro.en} against ${partnerP.displayName}'s (${partnerLabel}) Sun Sign ${partnerP.astro.en}: an astrologically ${relation} pairing, cross-checked against your full natal charts.`,
          `占星契合度评分：${synastry.score}%。您的太阳星座${p.astro.en}，与${partnerLabel}${partnerP.displayName}的太阳星座${partnerP.astro.en}：占星上属${relZh}配对，并已与双方完整本命盘交叉核对。`);
        exp = bt(`Computed from a real SYNASTRY comparison - every one of your 12 real natal points (not just the Sun) checked against every one of ${partnerP.displayName}'s, weighted by aspect type (Trine/Sextile supportive, Square/Opposition more challenging), how exact the orb is, and how personally significant each planet pair is (personal planets like Sun/Moon/Venus/Mars carry more individual weight than slow-moving generational planets like Uranus/Neptune/Pluto, which are near-guaranteed to align for anyone born around the same era and carry little individual significance).${hasHouseOverlay ? ' House overlay is included: where relevant, a planet\'s house placement in the OTHER person\'s chart is named below.' : ' House overlay is not included here - that needs a birth latitude on file for both of you.'} Your closest real synastry contacts: ${topContacts.join('; ')}.`,
          `依真实的「合盘」（Synastry）比对推算——将您全部12个真实本命点（不仅是太阳）与${partnerP.displayName}的每个本命点逐一核对，并依相位类型（三分相／六分相偏顺畅，四分相／对分相较具挑战性）、容许度精确程度，及每对行星组合的个人重要性（太阳／月亮／金星／火星等个人行星，比天王星／海王星／冥王星等世代行星更具个人意义——后者对同世代出生的任何人几乎都会形成相位，个人意义较低）加权评分。${hasHouseOverlay ? '此处已纳入宫位叠加：若相关，下方将说明该行星落入对方星盘的哪一宫。' : '此处未纳入宫位叠加——需双方均已记录出生纬度。'}您最紧密的真实合盘相位：${topContacts.join('；')}。`);
        traits = bt(`${synastry.score >= 80 ? 'A high-resonance pairing by real synastry' : synastry.score >= 65 ? 'A workable, generally positive pairing by real synastry' : 'A pairing that benefits from deliberate effort, by real synastry'} - a materially more complete picture than Sun Sign alone.`,
          `依真实合盘分析，${synastry.score >= 80 ? '属高度共鸣的组合' : synastry.score >= 65 ? '属大体正向、可行的组合' : '属需刻意用心经营的组合'}——远比仅凭太阳星座更为完整。`);
        hl = [
          bt(`Astrology Compatibility Score: ${synastry.score}%.`, `占星契合度评分：${synastry.score}%。`),
          ...topContacts.map(c => bt(`Synastry contact: ${c}`, `合盘相位：${c}`)),
          bt(`Sun Sign layer: ${p.astro.en} vs ${partnerP.astro.en} - classically ${relation}.`, `太阳星座层面：${p.astro.en} 对 ${partnerP.astro.en}——传统上属${relZh}。`)
        ];
        pos = [
          bt('Grounded in a real 144-point synastry comparison across both full natal charts, not a Sun-sign-only shortcut.', '以双方完整本命盘的真实144点合盘比对为基础，而非仅凭太阳星座的粗略判断。'),
          bt('Every named contact traces back to one specific, real geometric aspect between your two charts - not a generic theme.', '每一项列出的相位皆可追溯至双方星盘间一个具体、真实的几何相位——并非泛用主题。'),
          bt('Personal-planet contacts (Sun/Moon/Venus/Mars) are weighted more heavily than generational-planet contacts, avoiding overstating shared-era coincidences as personal significance.', '个人行星相位（太阳／月亮／金星／火星）的权重高于世代行星相位，避免将同世代的巧合过度解读为个人层面的意义。')
        ];
        neg = [
          bt('The Conjunction "focus" weighting (which specific planet pairs are treated as classically significant) is a documented, disclosed convention, not the only one professional astrologers use.', '合相「重点」加权（哪些行星组合被视为传统上具重要意义）为公开、有据可查的惯例，并非专业占星师采用的唯一标准。'),
          bt('Mercury/Venus/Mars natal positions use an unperturbed 2-body orbit model - accurate to roughly a degree, occasionally close to an aspect boundary.', '水星／金星／火星的本命位置采用未经摄动修正的二体轨道模型——精度约在一度左右，若恰好接近相位边界，结果可能受影响。'),
          ...(hasHouseOverlay ? [] : [bt('House overlay is not included for this pairing yet - that needs a birth latitude on file for both of you (add one via the country/city selector).', '此配对尚未纳入宫位叠加——需双方均记录出生纬度（请透过国家／城市选单补充）。')])
        ];
        cau = [
          bt('This is a real, computed astrological lens on the pairing, not a deterministic verdict - treat alongside, not instead of, the BaZi Element + Zodiac Synergy reading above.', '此为对该配对真实计算所得的占星视角，并非绝对定论——请与上方的八字五行与生肖契合分析并行参考，而非取而代之。'),
          bt('Even a high synastry score still requires real communication - the reading does not do that work for you.', '即使合盘评分再高，仍需真正的沟通——占星分析无法代劳。'),
          bt(`Revisit if either party's birth date, time, or location is ever corrected.`, '若任一方的出生日期、时间或地点有更正，请重新查阅本分析。')
        ];
        opts = { remedies: synastry.score < 70
          ? bt([`Name the specific friction contact (see the synastry contacts above) explicitly rather than letting it stay unspoken.`, `Lean on the fuller BaZi Element + Zodiac Synergy reading for the more substantive compatibility picture alongside this one.`],
               ['明确说出具体的摩擦相位（见上方合盘相位），切勿让它一直未被言明。', '重大契合度判断请同时参考上方更为详尽的八字五行与生肖契合分析。'])
          : bt(['Keep investing in real communication even where the synastry reads as naturally easy.', 'No specific remedy needed beyond normal relationship/partnership maintenance.'],
               ['即使合盘显示天然契合，仍应持续投入真正的沟通。', '除日常关系／合作维护外，毋须特别化解。'])
        };
      } else {
        // Fallback: one or both profiles lack a birth date/time, so a full natal chart (and therefore a
        // real synastry score) cannot be computed - honestly falls back to the original Sun-sign-only
        // categorical rather than fabricating a percentage with no real data behind it.
        chars = bt(`Your Sun Sign ${p.astro.en} against ${partnerP.displayName}'s (${partnerLabel}) Sun Sign ${partnerP.astro.en}: an astrologically ${relation} pairing.`,
          `您的太阳星座${p.astro.en}，与${partnerLabel}${partnerP.displayName}的太阳星座${partnerP.astro.en}：占星上属${relZh}配对。`);
        exp = bt(`A full synastry percentage score is not available for this pairing yet - that needs a complete birth date AND time on file for both of you. Showing the Sun-sign-only categorical instead: ${relation === 'compatible' ? `${partnerP.astro.en} sits within ${p.astro.en}'s classically compatible signs - a naturally easier temperamental fit.` : relation === 'incompatible' ? `${partnerP.astro.en} sits within ${p.astro.en}'s classically challenging signs - not a bad-match verdict, just a signal that temperamental differences may need more conscious bridging.` : `${partnerP.astro.en} is astrologically neutral against ${p.astro.en}.`}`,
          `此配对暂无法计算完整的合盘百分比评分——需双方均已记录完整的出生日期与时间。暂以太阳星座层级判断呈现：${relation === 'compatible' ? `${partnerP.astro.en}属于${p.astro.en}传统上的相合星座——性情上较为自然契合。` : relation === 'incompatible' ? `${partnerP.astro.en}属于${p.astro.en}传统上较具挑战的星座——这并非不合适的定论，而是提醒性情差异可能需要更用心地弥合。` : `单从太阳星座而言，${partnerP.astro.en}与${p.astro.en}属中性关系。`}`);
        traits = bt(`Add a complete birth date and time for both profiles to unlock a real synastry percentage score.`, `请为双方档案补充完整的出生日期与时间，以解锁真实的合盘百分比评分。`);
        hl = bt([`${p.astro.en} vs ${partnerP.astro.en}: ${relation}.`, `Your compatible signs: ${p.astro.comp}.`, `Your incompatible signs: ${p.astro.incomp}.`],
          [`${p.astro.en} 对 ${partnerP.astro.en}：${relZh}。`, `您的相合星座：${compZh2}。`, `您的相冲星座：${incompZh2}。`]);
        pos = bt(['Even this coarse Sun-sign layer is genuinely computed, not templated.', 'Awareness of the classic friction points allows proactive bridging.'],
          ['即使是这一较粗略的太阳星座层级，仍属真实计算，而非套用模板。', '预先了解传统摩擦点，有助主动弥合。']);
        neg = bt(['No numeric score here yet - Sun Sign alone is a coarse signal compared to a full synastry comparison.', 'Should complement, not replace, the fuller BaZi/Zodiac compatibility reading.'],
          ['此处暂无数字评分——单看太阳星座仍属粗略指标，远不及完整合盘比对精确。', '应作为完整八字生肖契合分析的补充，而非取代。']);
        cau = bt(['Treat Sun Sign compatibility as a light supplementary signal, not a standalone verdict.', 'The BaZi Element + Zodiac Synergy reading above is the more detailed compatibility source in this app.'],
          ['请将太阳星座契合度视为轻量补充参考，而非独立定论。', '本应用中上方的八字五行与生肖契合分析更为详尽。']);
        opts = { remedies: bt(['Add a complete birth date and time for both profiles to unlock the full synastry score and house overlay.'], ['请为双方档案补充完整的出生日期与时间，以解锁完整的合盘评分与宫位叠加。']) };
      }
  } else if (type === 'qmdj_door') {
      // BUG 7 FIX: dedicated deep analysis + remedies for each Auspicious/Caution door found in the
      // natal QMDJ grid (not just a color badge).
      // AUDIT FIX (reported: "re-examine all the compatibility scoring and deep analysis and ensure
      // nothing is half baked"): this used to produce word-for-word identical Positives/Negatives/
      // Cautions/Remedies text for all 3 Auspicious doors (and separately, identical text for all 3
      // Caution doors), varying only the door's own name - technically door-specific data was passed
      // in, but the prose never actually used what makes each door distinct, so e.g. Kai Men (开门,
      // officialdom/new ventures), Xiu Men (休门, rest/romance) and Sheng Men (生门, wealth/business)
      // all read as interchangeable. QMDJ_DOOR_DOMAIN below is each door's real traditional governing
      // domain (already used elsewhere in this app for the "Suggested Positions for Favourable
      // Activities" list) - the text now names each door's own domain throughout, so no two doors of
      // the same tier read identically anymore.
      const { door, isGood, dirLabel, pal } = extraData;
      const domain = QMDJ_DOOR_DOMAIN[door] || (isGood
        ? { en: 'the activities it governs', zh: '其所主之事' }
        : { en: 'the area it governs', zh: '其所主领域' });
      chars = bt(`${dirLabel} Palace ${pal} carries the ${door} door, one of the ${isGood ? '3 Auspicious Doors (三吉门)' : '3 Caution Doors (凶门)'} in the traditional Eight Doors (八门) system, traditionally governing ${domain.en}.`,
        `${dirLabel}宫（第${pal}宫）落有${door}，属传统八门中的${isGood ? '三吉门之一' : '凶门之一'}，传统上主管${domain.zh}。`);
      exp = isGood
        ? bt(`${door} governs favourable timing and outcomes for ${domain.en} when this palace is activated - traditionally used to select auspicious timing for that domain specifically.`, `${door}主吉，当此宫被激活时，${domain.zh}宜择时行动，传统上用于挑选吉时进行此类事务。`)
        : bt(`${door} signals that ${domain.en} needs extra care when this palace is activated - not inherently harmful, but traditionally avoided for major decisions in that domain.`, `${door}为凶，当此宫被激活时，${domain.zh}宜格外谨慎，传统上避免在此领域做出重大决定。`);
      traits = isGood
        ? bt(`Best leveraged deliberately for ${domain.en} - align decisions or launches in that domain with periods when this palace/door combination is active.`, `宜刻意善用于${domain.zh}——将该领域的决定或启动安排在此宫位／门组合当旺之时。`)
        : bt(`Best neutralised through awareness and timing - avoid forcing major decisions tied to ${domain.en} when avoidable.`, `宜以觉察与择时化解——尽量避免在${domain.zh}方面强行做重大决定。`);
      hl = isGood
        ? bt([`${door} is traditionally favourable specifically for ${domain.en}.`, `Supports proactive, forward-moving action in that domain.`, `A genuine asset in your natal QMDJ structure.`], [`${door}传统上尤其有利于${domain.zh}。`, `有助于该领域中积极、向前推进的行动。`, `是您命盘奇门结构中的真实优势。`])
        : bt([`${door} calls for heightened care specifically around ${domain.en}.`, `Not inherently harmful - a timing/awareness signal, not a fixed fate.`, `Manageable with the remedies below.`], [`${door}提示在${domain.zh}方面需格外谨慎。`, `并非必然有害——是择时／觉察的提示，而非既定命运。`, `透过下方化解建议可妥善应对。`]);
      pos = isGood
        ? bt([`Genuine structural advantage for ${domain.en} in your natal chart.`, 'Can be actively leveraged when decisions in that domain arise.'], [`命盘中针对${domain.zh}的真实结构性优势。`, '当该领域出现决策时，可主动运用。'])
        : bt(['Purely a caution signal - fully manageable with awareness.', 'Does not affect palaces/doors elsewhere in your chart.'], ['纯属提示性质——透过觉察即可妥善应对。', '不影响命盘中其他宫位／门。']);
      neg = isGood
        ? bt([`Can be under-utilised if you never consciously time ${domain.en} to this palace's active periods.`, 'Not a substitute for sound judgement in that domain.'], [`若从未有意识地将${domain.zh}安排在此宫位当旺之时，可能被浪费。`, '不能替代该领域中应有的审慎判断。'])
        : bt([`Elevated caution specifically around ${domain.en}.`, 'Ignoring it entirely removes a useful timing signal for that domain.'], [`在${domain.zh}方面需格外留意。`, '若完全忽视，则错失一个有用的择时提示。']);
      cau = isGood
        ? bt(['Do not over-rely on this alone - combine with your BaZi Day Master reading.', 'Reassess if birth time is corrected.'], ['不宜单独依赖此项——请结合八字日主分析一并参考。', '若出生时间有更正，请重新评估。'])
        : bt([`Avoid major, irreversible decisions specifically tied to ${domain.en} where practical.`, 'Reassess if birth time is corrected.'], [`在可行范围内，避免针对${domain.zh}做出重大且不可逆的决定。`, '若出生时间有更正，请重新评估。']);
      opts = { remedies: isGood
        ? bt([`Deliberately schedule ${domain.en} during periods when this palace is active.`, `Use this door's favourable timing as a tiebreaker when other factors are neutral.`], [`将${domain.zh}的重要行动，刻意安排在此宫位当旺之时。`, `当其他因素中性时，可用此门的吉时作为决策的参考依据。`])
        : bt([`Where possible, delay major, high-stakes decisions around ${domain.en} to a more favourable window.`, `A simple physical remedy (e.g. a small light, plant, or wind chime in the ${dirLabel} sector of your main living/working space) is a traditional way to soften a Caution Door's influence.`, `Pair with mindfulness rather than fear - this is a timing signal, not a fixed outcome.`],
             [`在可行范围内，将${domain.zh}方面的重大高风险决定延后至更有利的时机。`, `传统化解方式：在住家或办公空间的${dirLabel}方位放置小灯、植物或风铃等，有助柔化凶门的影响。`, `宜以觉察而非恐惧应对——这是择时提示，并非既定结果。`])
      };
  } else if (type === 'ziwei') {
      const z = p.ziwei;
      chars = bt(`Life Palace (命宫) is anchored in the ${z.lifePalaceName} branch; Body Palace (身宫) in the ${z.bodyPalaceName} branch, derived from the solar birth month and the true-solar-time birth hour branch.`,
        `命宫落于${z.lifePalaceName}，身宫落于${z.bodyPalaceName}，由出生农历月份与真太阳时出生时辰地支推算所得。`);
      exp = bt(`Zi Wei Dou Shu (紫微斗数) maps twelve palaces around the chart, each governing a different life domain. The Life Palace anchors your core destiny axis, while the Body Palace reflects how that destiny is actively lived out through choices and effort. A full chart additionally places 14 major stars into these palaces via the Zi Wei star-insertion algorithm; this reading gives the correctly-derived Life/Body Palace foundation as a simplified overview rather than the complete star chart.`,
        `紫微斗数将命盘分为十二宫，各主管不同人生领域。命宫锚定您核心的命运轴线，身宫则反映该命运如何透过抉择与努力被实际活出。完整命盘还会以紫微星系安星法将十四主星排入各宫；本分析提供正确推算的命宫／身宫基础作为简化概览，而非完整星盘。`);
      traits = bt(`The relationship between Life and Body Palace shows how much your lived experience (Body) diverges from or reinforces your innate destiny axis (Life).`,
        `命宫与身宫的关系，显示您的实际人生经历（身宫）在多大程度上偏离或强化了先天命运轴线（命宫）。`);
      hl = bt([`Life Palace anchored at ${z.lifePalaceName}.`, `Body Palace anchored at ${z.bodyPalaceName}.`, z.lifePalaceBranchIdx === z.bodyPalaceBranchIdx ? 'Life and Body Palace coincide - destiny and lived experience are tightly aligned.' : 'Life and Body Palace differ - lived experience actively reshapes your destiny axis.'],
        [`命宫落于${z.lifePalaceName}。`, `身宫落于${z.bodyPalaceName}。`, z.lifePalaceBranchIdx === z.bodyPalaceBranchIdx ? '命宫与身宫同宫——命运与实际经历高度一致。' : '命宫与身宫分立——实际经历正在积极重塑您的命运轴线。']);
      pos = bt(['Clear anchor point for interpreting the other eleven palaces.', 'Provides a stable reference axis across Da Yun cycles.', 'Complements the BaZi Day Master reading with a second independent framework.'],
        ['为解读其余十一宫提供明确的定位基点。', '在各个大运周期中提供稳定的参考轴线。', '以另一套独立体系补充八字日主分析。']);
      neg = bt(['A full 14-star placement would refine this considerably.', 'Palace cusps near a branch boundary are sensitive to exact birth time accuracy.', 'Best read as a complement to, not a replacement for, the BaZi chart.'],
        ['完整十四主星排列可大幅细化本分析。', '宫位交界处对出生时间的精确度较为敏感。', '宜作为八字命盘的补充参考，而非取代。']);
      cau = bt(['Treat as a simplified overview pending a full star chart.', 'Cross-check against a professional Zi Wei chart for major decisions.', 'Keep birth time as precise as possible - this palace calculation is time-sensitive.'],
        ['请视为简化概览，完整星盘可作进一步参考。', '重大决策请以专业紫微命盘复核。', '出生时间宜尽量精确——宫位推算对时间十分敏感。']);
  } else if (type === 'tai_yi') {
      const ty = p.taiYi; const yc = ty.yearlyCast;
      chars = bt(`Your natal-year Tai Yi Yearly Cast: Accumulated Years ${yc.accumulatedYears.toLocaleString()}, ${yc.dun === 'yang' ? 'Yang' : 'Yin'} Dun Bureau ${yc.bureauNumber}, Tai Yi resting in the ${yc.palace.name} (${yc.palace.cn}) palace, in its Year ${yc.yearInPalace} (${yc.phase.en}) phase, with Ji Shen at ${yc.jiShen.name}, Wen Chang (Host Eye) at ${yc.wenChang.sector.sector}, Shi Ji (Guest Eye) at ${yc.shiJi.sector.sector}, Host Count ${yc.hostCount} (${yc.hostHarmony ? yc.hostHarmony.en : ''}) with Primary General ${yc.hostGeneral.primary.name}/Vice General ${yc.hostGeneral.vice.name}, and Guest Count ${yc.guestCount} (${yc.guestHarmony ? yc.guestHarmony.en : ''}) with Primary General ${yc.guestGeneral.primary.name}/Vice General ${yc.guestGeneral.vice.name}. Supplementary macro theme: ${ty.tierEN}, derived from your Year Pillar's elemental relationship to your Day Master.`,
        `您本命太乙年计：积年${yc.accumulatedYears.toLocaleString()}，${yc.dun === 'yang' ? '阳' : '阴'}遁${yc.bureauNumber}局，太乙落于${yc.palace.cn}宫，正值第${yc.yearInPalace}年（${yc.phase.zh}），计神位于${yc.jiShen.cn}，天目文昌位于${yc.wenChang.sector.cn}，地目始击位于${yc.shiJi.sector.cn}，主算${yc.hostCount}（${yc.hostHarmony ? yc.hostHarmony.zh : ''}），大将${yc.hostGeneral.primary.cn}／参将${yc.hostGeneral.vice.cn}；客算${yc.guestCount}（${yc.guestHarmony ? yc.guestHarmony.zh : ''}），大将${yc.guestGeneral.primary.cn}／参将${yc.guestGeneral.vice.cn}。辅助宏观主题评级为${ty.tierZH}，依据年柱与日主的五行关系推算。`);
      exp = bt(`Tai Yi Shen Shu traditionally tracks the Supreme One celestial reference through 16 palaces to read macro/collective-scale conditions (state affairs, large-scale timing) rather than personal day-to-day matters. Following the Tai Yi Jin Jing (太乙金鏡) yearly-cast mechanics you sourced, the full classical cast above - Accumulated Years epoch, Bureau, Tai Yi's own real Palace position, Ji Shen, the Three Foundations, Wen Chang/Shi Ji (Host/Guest Eyes), "the palace behind Tai Yi," the Host/Guest Counts (with their Harmony/Discordant verdicts), and the Primary/Vice Generals - is now genuinely calculated from your birth year, not a proxy. The supplementary macro theme below reuses the same elemental-relationship scoring as your Da Yun rating, applied to your Year Pillar, as a secondary "large-scale environment" signal alongside the real palace cast.`,
        `太乙神数传统上追踪「太乙」游历十六宫，以占测宏观／集体层面的状况（国家大事、大局时机），而非个人日常事务。依你提供的《太乙金镜》年计排演法，上方完整的古法排盘——积年、局数、太乙本身的真实落宫、计神、三基、文昌／始击（天目／地目）、「太乙落后一宫」、主算／客算（含和／不和判断）及大将／参将——现已全数依您的出生年份据实推算，不再是替代方案。下方辅助宏观主题则沿用与大运评级相同的五行关系算法，套用于您的年柱，作为搭配真实排盘的次要「大环境」参考。`);
      traits = bt(`Tai Yi is currently in its Year ${yc.yearInPalace} (${yc.phase.en}) phase within the ${yc.palace.name} palace - a full 24-year cycle across all 8 palaces, 3 years each. Your Host Count (${yc.hostCount}) reads as ${yc.hostHarmony ? yc.hostHarmony.en : 'unclassified'}, commanded by Primary General ${yc.hostGeneral.primary.name}${yc.hostGeneral.besieged ? ' (besieged in the Center)' : ''} and Vice General ${yc.hostGeneral.vice.name}; your Guest Count (${yc.guestCount}) reads as ${yc.guestHarmony ? yc.guestHarmony.en : 'unclassified'}, commanded by Primary General ${yc.guestGeneral.primary.name}${yc.guestGeneral.besieged ? ' (besieged in the Center)' : ''} and Vice General ${yc.guestGeneral.vice.name}. The supplementary ${ty.tierEN} rating suggests the broader Day-Master-based environment leans ${ty.tierEN.includes('Good') ? 'supportive' : ty.tierEN === 'Neutral' ? 'neutral' : 'more effortful'} for you at a macro level.`,
        `太乙目前于${yc.palace.cn}宫，正值第${yc.yearInPalace}年（${yc.phase.zh}）——完整周期为24年，历经全部8宫，每宫3年。您的主算（${yc.hostCount}）判为${yc.hostHarmony ? yc.hostHarmony.zh : '未判定'}，由大将${yc.hostGeneral.primary.cn}${yc.hostGeneral.besieged ? '（入中）' : ''}、参将${yc.hostGeneral.vice.cn}统领；客算（${yc.guestCount}）判为${yc.guestHarmony ? yc.guestHarmony.zh : '未判定'}，由大将${yc.guestGeneral.primary.cn}${yc.guestGeneral.besieged ? '（入中）' : ''}、参将${yc.guestGeneral.vice.cn}统领。辅助评级${ty.tierZH}显示，以日主为基准的大环境偏向${ty.tierEN.includes('Good') ? '有利' : ty.tierEN === 'Neutral' ? '中性' : '较为费力'}。`);
      hl = bt([`Bureau: ${yc.dun === 'yang' ? 'Yang' : 'Yin'} Dun ${yc.bureauNumber}.`, `Tai Yi Palace: ${yc.palace.name} (${yc.palace.cn}), Year ${yc.yearInPalace} (${yc.phase.en}).`, `Wen Chang: ${yc.wenChang.sector.sector}. Shi Ji: ${yc.shiJi.sector.sector}.`, `Host Count ${yc.hostCount} (${yc.hostHarmony ? yc.hostHarmony.en : ''}), General ${yc.hostGeneral.primary.name}/${yc.hostGeneral.vice.name}; Guest Count ${yc.guestCount} (${yc.guestHarmony ? yc.guestHarmony.en : ''}), General ${yc.guestGeneral.primary.name}/${yc.guestGeneral.vice.name}.`],
        [`局数：${yc.dun === 'yang' ? '阳' : '阴'}遁${yc.bureauNumber}局。`, `太乙落宫：${yc.palace.cn}宫，第${yc.yearInPalace}年（${yc.phase.zh}）。`, `文昌：${yc.wenChang.sector.cn}。始击：${yc.shiJi.sector.cn}。`, `主算${yc.hostCount}（${yc.hostHarmony ? yc.hostHarmony.zh : ''}），大将／参将${yc.hostGeneral.primary.cn}／${yc.hostGeneral.vice.cn}；客算${yc.guestCount}（${yc.guestHarmony ? yc.guestHarmony.zh : ''}），大将／参将${yc.guestGeneral.primary.cn}／${yc.guestGeneral.vice.cn}。`]);
      pos = bt(['The Bureau, Tai Yi Palace, Ji Shen, Three Foundations, Wen Chang/Shi Ji, Host/Guest Counts, and Generals above are all real classical mechanics, not a stand-in.', 'The supplementary macro theme still offers a "big picture" lens distinct from day-to-day BaZi/QMDJ/Da Liu Ren readings, using a verified scoring method (same as Da Yun).'],
        ['上方局数、太乙落宫、计神、三基、文昌／始击、主算／客算及大将／参将，均为真实传统排演，并非替代方案。', '辅助宏观主题仍可提供有别于日常八字／奇门／大六壬解读的「大局观」视角，且沿用已验证的评分方法（与大运相同）。']);
      neg = bt(['The full classical cast is now complete, but this is one specific school\'s formula set (Tai Yi Jin Jing) - other lineages may derive some steps differently.', 'The supplementary macro theme is based only on the Year Pillar, so it changes just once every 12 months.'],
        ['完整古法排盘现已齐备，但此为特定一派（《太乙金镜》）之算法——其他流派于个别步骤或有不同推演方式。', '辅助宏观主题仅依据年柱推算，每12个月才变化一次。']);
      cau = bt(['Best read alongside, not instead of, your BaZi and QMDJ readings for day-to-day matters - Tai Yi Shen Shu is traditionally a macro/state-level lens.', 'A General "besieged" in the Center (入中) is a real classical condition, not an error - it denotes restricted maneuverability, per the source formula.'],
        ['日常事务宜与八字、奇门遁甲解读一并参考，而非单独依赖——太乙神数传统上属宏观／国家层面之解读。', '大将或参将「入中」为真实古法现象，并非错误——依源头公式，意指调度受限。']);
  } else if (type === 'da_liu_ren') {
      const dlr = p.daLiuRen;
      const gEN = (g) => g ? g.split(' ')[0] : ''; const gCN = (g) => g ? g.split('(')[1]?.replace(')','') : '';
      chars = bt(`Your Da Liu Ren San Chuan (Three Transmissions) runs ${branches[dlr.chuChuan]} → ${branches[dlr.zhongChuan]} → ${branches[dlr.moChuan]}, riding the ${gEN(dlr.chuChuanGeneral)}, ${gEN(dlr.zhongChuanGeneral)}, and ${gEN(dlr.moChuanGeneral)} generals respectively.`,
        `您的大六壬三传为 ${branchCN[dlr.chuChuan]} → ${branchCN[dlr.zhongChuan]} → ${branchCN[dlr.moChuan]}，分别乘${gCN(dlr.chuChuanGeneral)}、${gCN(dlr.zhongChuanGeneral)}、${gCN(dlr.moChuanGeneral)}。`);
      exp = bt(`Chu Chuan (初传, Initial Transmission) represents the origin or root cause of a matter; Zhong Chuan (中传, Middle Transmission) its development; Mo Chuan (末传, Final Transmission) its eventual outcome. Reading the Heavenly General riding each branch adds character to that stage - Gui Ren (贵人) and Qing Long (青龙) are traditionally favourable riders, Bai Hu (白虎) and Xuan Wu (玄武) traditionally caution-natured.`,
        `初传代表事情的起因或根源，中传代表发展过程，末传代表最终结果。每一传所乘的天将则为该阶段增添色彩——贵人、青龙传统上被视为吉利之将，白虎、玄武则传统上偏向谨慎之将。`);
      traits = bt(`This progression (Chu → Zhong → Mo) reads as a narrative arc: where things started, how they moved, and where they are heading.`, `此三传次序（初传→中传→末传）可视为一段叙事弧线：事情从何开始、如何发展、又将走向何处。`);
      hl = bt([`Chu Chuan ${branches[dlr.chuChuan]} (${gEN(dlr.chuChuanGeneral)}) anchors the root cause.`, `Mo Chuan ${branches[dlr.moChuan]} (${gEN(dlr.moChuanGeneral)}) anchors the likely outcome.`, `Governing Yue Jiang: ${branches[dlr.yueJiangBranchIdx]}.`],
        [`初传${branchCN[dlr.chuChuan]}（${gCN(dlr.chuChuanGeneral)}）为根源所在。`, `末传${branchCN[dlr.moChuan]}（${gCN(dlr.moChuanGeneral)}）为可能结果所在。`, `当令月将：${branchCN[dlr.yueJiangBranchIdx]}。`]);
      pos = bt(['Gives a distinct "how a situation unfolds" lens, complementing BaZi\'s "who you are" and QMDJ\'s "where/when to act" framings.', 'The 4-class cross-check structure (Si Ke) reduces the chance of a one-sided reading.'],
        ['提供「事情如何演变」的独特视角，与八字的「你是谁」及奇门的「何时何地行动」互为补充。', '四课交叉验证结构，降低单一角度判断的偏误。']);
      neg = bt(['San Chuan here uses the primary Zei Ke method only - other classical methods (比用法/涉害法/遥克法 etc.) could yield a different transmission sequence in edge cases.', 'Best read as a situational snapshot rather than a fixed personality trait.'],
        ['此处三传仅采用主要的贼克法——其他古法（比用法、涉害法、遥克法等）在特定情况下可能得出不同的三传结果。', '宜视为特定情境的快照，而非固定的性格特质。']);
      cau = bt(['Da Liu Ren traditionally answers a specific question asked at a specific moment - this natal-moment cast is illustrative of your innate approach to unfolding situations, not a live divination for a current question.', 'Cross-check with a professional Liu Ren practitioner for a live query.'],
        ['大六壬传统上是针对特定时刻所问的具体问题作答——此本命时刻排盘用于说明您应对事态发展的先天倾向，并非针对当下问题的现场占测。', '若有具体问题需现场占测，请咨询专业六壬师傅复核。']);
  } else if (type === 'da_yun_compat') {
      // ENHANCEMENT (this round): Da Yun (Major Luck Cycle) compatibility deep analysis vs Life/
      // Business Partner - compares each person's CURRENT active cycle rating, the cross-elemental
      // relationship between one person's current cycle and the other's Day Master, and how well
      // their next few cycles' overall "direction" (favourable/neutral/unfavourable) stay in sync.
      const isBiz = extraData?.isBusiness; const partnerLabel = bt(isBiz ? 'Business Partner' : 'Life Partner', isBiz ? '事业伙伴' : '人生伴侣');
      const partnerP = extraData?.partnerP;
      const findCurrentCycle = (prof) => { const age = computeCurrentAge(prof.birthdate); return prof.daYunPillars.find(dy => dy.age <= age && age < dy.age + 10) || prof.daYunPillars[0]; };
      const myCycle = findCurrentCycle(p), theirCycle = findCurrentCycle(partnerP);
      const direction = (tierEN) => tierEN.includes('Good') ? 1 : tierEN.includes('Bad') ? -1 : 0;
      const myDir = direction(myCycle.rating.tierEN), theirDir = direction(theirCycle.rating.tierEN);
      const inSync = myDir === theirDir;

      // Cross-elemental check: what does MY current cycle's element mean for THEIR Day Master, and
      // vice versa - reuses the same generates/controls relationship classification as rateDaYunCycle.
      function crossRelation(cycleStemIdx, targetDmStemIdx) {
        const cycleElem = Math.floor(cycleStemIdx / 2), dmElem = Math.floor(targetDmStemIdx / 2);
        if (cycleElem === dmElem) return 'peer';
        if (mod(cycleElem + 1, 5) === dmElem) return 'supports';
        if (mod(dmElem + 1, 5) === cycleElem) return 'drains';
        if (mod(dmElem + 2, 5) === cycleElem) return 'channels_wealth_to';
        return 'pressures';
      }
      const myEffectOnThem = crossRelation(myCycle.stemIdx, partnerP.bazi.dayStemIdx);
      const theirEffectOnMe = crossRelation(theirCycle.stemIdx, p.bazi.dayStemIdx);
      const relDescEN = { peer: 'reinforces shared footing with', supports: 'actively supports', drains: 'draws on the energy of', channels_wealth_to: 'channels resources toward', pressures: 'puts pressure on' };
      const relDescZH = { peer: '与...形成相近立场', supports: '积极扶助', drains: '消耗...的精力', channels_wealth_to: '将资源导向', pressures: '对...形成压力' };

      // Near-term synchrony: next 3 cycles, how many share the same direction (favourable/neutral/
      // unfavourable) between the two people.
      const myIdx = p.daYunPillars.indexOf(myCycle), theirIdx = partnerP.daYunPillars.indexOf(theirCycle);
      let syncCount = 0, comparedCount = 0;
      for (let i = 0; i < 3; i++) {
        const myC = p.daYunPillars[myIdx + i], theirC = partnerP.daYunPillars[theirIdx + i];
        if (!myC || !theirC) break;
        comparedCount++;
        if (direction(myC.rating.tierEN) === direction(theirC.rating.tierEN)) syncCount++;
      }

      chars = bt(`Your current cycle (age ${myCycle.age}-${myCycle.age+9}, ${stems[myCycle.stemIdx]} ${branches[myCycle.branchIdx]}, rated ${myCycle.rating.tierEN}) against ${partnerP.displayName}'s current cycle (age ${theirCycle.age}-${theirCycle.age+9}, ${stems[theirCycle.stemIdx]} ${branches[theirCycle.branchIdx]}, rated ${theirCycle.rating.tierEN}): your broader life-phase timing is currently ${inSync ? 'moving in the same general direction' : 'moving in different directions'}.`,
        `您目前的大运（${myCycle.age}-${myCycle.age+9}岁，${stemCN[myCycle.stemIdx]}${branchCN[myCycle.branchIdx]}，评级${myCycle.rating.tierZH}）与${partnerLabel}${partnerP.displayName}目前的大运（${theirCycle.age}-${theirCycle.age+9}岁，${stemCN[theirCycle.stemIdx]}${branchCN[theirCycle.branchIdx]}，评级${theirCycle.rating.tierZH}）相比：二人目前的大方向大运节奏${inSync ? '走向一致' : '走向不同'}。`);
      exp = bt(`Beyond each person's own rating, Da Yun cycles also interact: your current cycle's element ${relDescEN[myEffectOnThem]} ${partnerP.displayName}'s Day Master, while theirs ${relDescEN[theirEffectOnMe]} yours. Over the next ${comparedCount} cycles, ${syncCount} out of ${comparedCount} share the same general direction (both favourable, both neutral, or both unfavourable at the same time).`,
        `除了各自的评级之外，大运彼此之间也会互相影响：您目前大运的五行${relDescZH[myEffectOnThem]}${partnerP.displayName}的日主，而对方目前大运则${relDescZH[theirEffectOnMe]}您的日主。未来${comparedCount}步大运中，有${syncCount}步的大方向（同为有利、同为中性、或同为不利）彼此一致。`);
      traits = inSync
        ? bt(`Being in sync means major life transitions (career shifts, big moves, high-stakes decisions) are more likely to feel like the "right time" for both of you simultaneously.`, `节奏同步代表人生重大转折（转职、搬迁、重大决策）更可能让二人同时感觉「时机恰当」。`)
        : bt(`Being out of sync doesn't mean incompatibility - it often means one of you is better positioned to lead during a given decade while the other provides steadying support, then the roles may reverse in a later cycle.`, `节奏不同步并不代表不合——通常代表在某个十年中一方更适合主导，另一方提供稳定支持，角色可能在后续大运中互换。`);
      hl = bt([`Current cycles: you=${myCycle.rating.tierEN}, ${partnerP.displayName}=${theirCycle.rating.tierEN}.`, `Cross-elemental effect: your cycle ${relDescEN[myEffectOnThem]} them; theirs ${relDescEN[theirEffectOnMe]} you.`, `Near-term synchrony: ${syncCount}/${comparedCount} of the next cycles share the same direction.`],
        [`目前大运：您为${myCycle.rating.tierZH}，${partnerP.displayName}为${theirCycle.rating.tierZH}。`, `五行互动：您的大运${relDescZH[myEffectOnThem]}对方；对方大运${relDescZH[theirEffectOnMe]}您。`, `近期同步度：未来${comparedCount}步大运中有${syncCount}步方向一致。`]);
      pos = inSync
        ? bt(['Shared sense of "momentum" or "caution" makes joint major decisions feel naturally aligned.', 'Less risk of one party feeling ready to act while the other feels the timing is wrong.', 'Easier to commit to big joint plans (relocation, major investment, career pivots) together.'],
             ['共同的「顺势」或「谨慎」感，使重大共同决策自然一致。', '较少出现一方认为时机成熟、另一方认为时机未到的落差。', '更容易共同投入重大计划（搬迁、重大投资、职涯转折）。'])
        : bt(['Complementary timing means one of you can steady the other during a harder cycle.', 'Reduces the risk of both of you facing a difficult decade at the same time.', 'Encourages healthy division of "who leads, who supports" across different life phases.'],
             ['互补的节奏代表一方能在另一方较艰难的大运期间提供支撑。', '降低二人同时面临困难十年的风险。', '有助于在不同人生阶段中健康划分「谁主导、谁辅助」。']);
      neg = inSync
        ? bt(['If both cycles turn unfavourable together, there may be less internal stability to draw on.', 'Shared blind spots during a jointly weak cycle - an outside perspective becomes more valuable then.'],
             ['若二人大运同时转弱，可能缺乏彼此可依靠的内部稳定力量。', '共同弱运期间可能有共同盲点——此时外部视角更显重要。'])
        : bt(['Mismatched timing can occasionally read as one partner "not being on the same page" about urgency.', 'Requires more explicit communication about whose cycle should take priority for a given decision.'],
             ['节奏不同步有时会被解读为一方在急迫感上「不同步」。', '需要更明确沟通，判断特定决策应以哪一方的大运为优先考量。']);
      cau = bt(['Da Yun compatibility reflects broad decade-scale timing, not day-to-day compatibility - pair with the main compatibility reading above, not in isolation.', 'Recalculate if either person\'s birth details are corrected, since Da Yun timing is sensitive to exact birth data.'],
        ['大运契合度反映的是十年尺度的宏观时机，并非日常相处契合度——请与上方主要契合度解读合并参考，勿单独使用。', '若任一方出生资料有更正，请重新计算，因大运时机对精确出生数据较为敏感。']);
      opts = { remedies: inSync
        ? bt([`During your shared favourable cycles, prioritise the joint big moves you've been considering.`, `During a shared unfavourable cycle, lean more heavily on outside support (mentors, advisors) since neither of you has a "steadying" cycle to draw on internally.`],
             ['在二人共同的有利大运期间，优先推进原先考虑的重大共同计划。', '在共同不利的大运期间，更多借助外部支持（导师、顾问），因二人皆无内部「稳定」大运可依靠。'])
        : bt([`Let whoever is in the stronger cycle take the lead on major decisions during that decade, with the other providing a grounding second opinion.`, `Explicitly revisit "whose cycle leads" as you both move into your next Da Yun, since the roles may reverse.`],
             ['在特定十年中，由处于较强大运的一方主导重大决策，另一方提供稳健的第二意见。', '双方进入下一个大运时，宜重新检视「由谁主导」，因角色可能互换。'])
      };
  } else if (type === 'qmdj_compat') {
      // ENHANCEMENT 3/4 FIX: QMDJ compatibility deep analysis vs Life/Business Partner, with remedies.
      const isBiz = extraData?.isBusiness; const partnerLabel = bt(isBiz ? 'Business Partner' : 'Life Partner', isBiz ? '事业伙伴' : '人生伴侣');
      const partnerP = extraData?.partnerP;
      const sameGroup = p.dunType === partnerP.dunType;
      const palaceGap = Math.min(mod(p.qmdj.natalPalace - partnerP.qmdj.natalPalace, 9), mod(partnerP.qmdj.natalPalace - p.qmdj.natalPalace, 9));
      const relation = palaceGap === 0 ? 'aligned' : palaceGap <= 2 ? 'adjacent' : 'distant';
      const relZh = relation === 'aligned' ? '相同' : relation === 'adjacent' ? '相邻' : '相距较远';
      chars = bt(`Your Life Palace (${p.palaceName}, ${p.dunType}) against ${partnerP.displayName}'s (${partnerLabel}) Life Palace (${partnerP.palaceName}, ${partnerP.dunType}): a ${relation} strategic pairing${sameGroup ? ', both operating under the same Dun type' : ', operating under different Dun types'}.`,
        `您的命宫（${p.palaceName}，${p.dunType}）与${partnerLabel}${partnerP.displayName}的命宫（${partnerP.palaceName}，${partnerP.dunType}）：属${relZh}的策略配对${sameGroup ? '，且同属同一遁类型' : '，分属不同遁类型'}。`);
      exp = relation === 'aligned'
        ? bt(`You and ${partnerP.displayName} track to the same natal palace, meaning your strategic instincts and sense of timing for decisive action tend to move in step - useful for fast joint decisions, but with less natural checks-and-balances.`,
             `您与${partnerP.displayName}命宫相同，代表二人的策略直觉与行动时机感往往同步——有利于快速共同决策，但天然的相互制衡较少。`)
        : relation === 'adjacent'
        ? bt(`Your natal palaces sit close together on the Luoshu grid, giving a workable strategic overlap - similar enough to coordinate easily, different enough to bring complementary angles to a decision.`,
             `二人命宫在洛书九宫格上位置相近，具有良好的策略重叠——足够相似以便协调，又有足够差异带来互补视角。`)
        : bt(`Your natal palaces sit further apart on the grid, meaning your strategic instincts and preferred timing for action likely differ more - this is a source of complementary strength if coordinated deliberately, or friction if not.`,
             `二人命宫在九宫格上相距较远，代表策略直觉与偏好的行动时机差异较大——若能刻意协调，可成为互补优势；若否，则易生摩擦。`);
      traits = sameGroup ? bt(`Operating under the same ${p.dunType} means your broader yearly/seasonal timing sense (Yang vs Yin Dun) is naturally synchronised.`, `同属${p.dunType}，代表二人在更宏观的年度／季节时机感（阳遁与阴遁）上天然同步。`)
        : bt(`Operating under different Dun types (one Yang, one Yin) means your broader seasonal timing instincts differ - worth an explicit check-in before major joint timing decisions.`, `分属不同遁类型（一阳一阴），代表二人宏观的季节时机直觉有所不同——重大共同时机决策前，宜明确沟通确认。`);
      hl = bt([`Your Life Palace: ${p.palaceName}. Their Life Palace: ${partnerP.palaceName}.`, `Palace relationship: ${relation} (${palaceGap} step${palaceGap===1?'':'s'} apart on the Luoshu grid).`, sameGroup ? 'Same Dun type - synchronised seasonal timing instinct.' : 'Different Dun types - differing seasonal timing instinct.'],
        [`您的命宫：${p.palaceName}。对方命宫：${partnerP.palaceName}。`, `宫位关系：${relZh}（九宫格上相距${palaceGap}步）。`, sameGroup ? '遁类型相同——季节时机直觉同步。' : '遁类型不同——季节时机直觉有差异。']);
      pos = relation === 'aligned'
        ? bt(['Fast, low-friction joint decision-making under pressure.', 'Shared strategic instincts reduce miscommunication in high-stakes moments.', 'Natural mutual understanding of each other\'s approach to timing and action.'],
             ['压力下能快速、低摩擦地共同决策。', '共同的策略直觉减少高风险时刻的沟通误差。', '天然理解彼此对时机与行动的处理方式。'])
        : bt(['Complementary strategic angles strengthen joint decision-making.', 'Each of you can catch blind spots the other might miss.', 'Healthy diversity of perspective on timing and approach.'],
             ['互补的策略视角强化共同决策。', '双方能互相察觉对方可能忽略的盲点。', '在时机与做法上具备健康的观点多样性。']);
      neg = relation === 'distant'
        ? bt(['Risk of talking past each other on when/how to act decisively.', 'One may push for action while the other prefers to wait, or vice versa.', 'Requires more explicit coordination than a closely-aligned pairing.'],
             ['在「何时／如何果断行动」上存在各说各话的风险。', '可能一方倾向立即行动，另一方倾向观望，反之亦然。', '相较命宫相近的配对，需要更明确的协调。'])
        : bt(['Even aligned strategic instincts benefit from an occasional outside perspective.', 'Can reinforce shared blind spots if not checked.', 'Should complement, not replace, open discussion before major decisions.'],
             ['即使策略直觉一致，偶尔引入外部视角仍有助益。', '若不加留意，可能强化共同的盲点。', '重大决策前仍应辅以（而非取代）坦诚讨论。']);
      cau = bt(['Treat this as a strategic-timing lens, not a verdict on the relationship itself.', 'Best used ahead of major joint decisions (launches, negotiations, big moves) rather than day-to-day.', `Revisit if either party's birth details are corrected.`],
        ['请将此视为策略时机的参考角度，而非对关系本身的定论。', '较适合用于重大共同决策（启动、谈判、重大行动）前，而非日常琐事。', '若任一方出生资料有更正，请重新查阅。']);
      opts = { remedies: relation === 'distant'
        ? bt([`Before major joint decisions, explicitly compare each other's instinct on timing ("act now" vs "wait") rather than assuming agreement.`, `Assign the palace-aligned partner (whoever's instinct suits the specific decision) to lead that call, with the other providing the complementary check.`, `Schedule a brief strategic check-in before high-stakes moments specifically to surface any timing-instinct mismatch early.`],
             ['重大共同决策前，明确比较双方对时机的直觉（「立即行动」抑或「静观其变」），切勿假设一致。', '由命宫直觉较适合该决策的一方主导，另一方负责互补把关。', '在高风险时刻前安排简短的策略沟通，及早发现时机直觉的落差。'])
        : bt(['Continue leaning on your naturally synchronised timing sense for fast joint decisions.', 'Periodically invite an outside perspective to counter shared blind spots.'],
             ['共同快速决策时，可继续倚重双方天然同步的时机感。', '定期引入外部视角，以弥补共同盲点。'])
      };
  } else if (type === 'ziwei_compat') {
      // ENHANCEMENT 5/6 FIX: Zi Wei Dou Shu compatibility deep analysis vs Life/Business Partner, with remedies.
      const isBiz = extraData?.isBusiness; const partnerLabel = bt(isBiz ? 'Business Partner' : 'Life Partner', isBiz ? '事业伙伴' : '人生伴侣');
      const partnerP = extraData?.partnerP;
      const z1 = p.ziwei; const z2 = partnerP.ziwei;
      const sameLife = z1.lifePalaceBranchIdx === z2.lifePalaceBranchIdx;
      const oppositeLife = mod(z1.lifePalaceBranchIdx - z2.lifePalaceBranchIdx, 12) === 6;
      const relation = sameLife ? 'mirrored' : oppositeLife ? 'complementary-opposite' : 'independent';
      const relZh = sameLife ? '同宫' : oppositeLife ? '互补对宫' : '各自独立';
      chars = bt(`Your Life Palace (${z1.lifePalaceName}) against ${partnerP.displayName}'s (${partnerLabel}) Life Palace (${z2.lifePalaceName}): a ${relation} destiny-axis pairing.`,
        `您的命宫（${z1.lifePalaceName}）与${partnerLabel}${partnerP.displayName}的命宫（${z2.lifePalaceName}）：属${relZh}的命运轴线配对。`);
      exp = relation === 'mirrored'
        ? bt(`You share the same Life Palace branch, meaning your core destiny axes point in the same direction - life themes and major turning points tend to rhyme with each other, for better and for worse.`,
             `二人命宫地支相同，代表核心命运轴线指向同一方向——人生主题与重大转折点往往彼此呼应，好坏皆然。`)
        : relation === 'complementary-opposite'
        ? bt(`Your Life Palaces sit directly opposite each other on the twelve-palace wheel - a classic complementary pairing where each of you naturally covers ground the other doesn't, though it can also mean pulling toward different priorities if not coordinated.`,
             `二人命宫在十二宫命盘上正好相对——属经典的互补配对，各自天然涵盖对方较弱的领域；但若不加协调，也可能各自偏重不同的优先事项。`)
        : bt(`Your Life Palaces sit independently of each other - no strong mirrored or opposite relationship, meaning your core destiny axes run on largely separate tracks.`,
             `二人命宫彼此独立——既非同宫也非对宫，代表核心命运轴线大致各自运行、互不重叠。`);
      traits = relation === 'mirrored' ? bt(`Expect shared life-stage timing (career shifts, major decisions) to cluster around similar periods.`, `人生阶段的重大时机（转职、重大决策）往往会集中在相近的时期出现。`)
        : relation === 'complementary-opposite' ? bt(`Expect one of you to naturally lead in domains the other finds harder, and vice versa - a classic complementary dynamic if actively coordinated.`, `预期其中一方在对方较吃力的领域中自然领先，反之亦然——若主动协调，即成经典的互补动态。`)
        : bt(`Life-stage timing and major turning points are likely to run on independent schedules.`, `人生阶段时机与重大转折点，可能各自依循独立的时间表运行。`);
      hl = bt([`Your Life Palace: ${z1.lifePalaceName}. Their Life Palace: ${z2.lifePalaceName}.`, `Relationship: ${relation.replace('-', ' ')}.`, `Body Palace comparison: ${z1.bodyPalaceName} vs ${z2.bodyPalaceName}.`],
        [`您的命宫：${z1.lifePalaceName}。对方命宫：${z2.lifePalaceName}。`, `关系：${relZh}。`, `身宫比较：${z1.bodyPalaceName} 对 ${z2.bodyPalaceName}。`]);
      pos = relation === 'complementary-opposite'
        ? bt(['Natural division of labour across life domains.', 'Each partner\'s strength offsets the other\'s stretch areas.', 'Reduces the risk of both of you missing the same blind spot.'],
             ['在人生各领域中天然形成分工。', '双方的强项能弥补对方较弱之处。', '降低二人同时忽略同一盲点的风险。'])
        : relation === 'mirrored'
        ? bt(['Shared understanding of each other\'s major life themes.', 'Easier empathy during major turning points, since timing tends to align.', 'Simplifies joint long-term planning.'],
             ['对彼此的人生主题有共同理解。', '由于时机往往一致，重大转折期更容易互相体谅。', '简化共同的长期规划。'])
        : bt(['Independent destiny axes reduce the risk of compounding the same setback simultaneously.', 'Each partner brings a genuinely distinct perspective.', 'Lower risk of shared blind spots.'],
             ['独立的命运轴线降低二人同时遭遇同一挫折的风险。', '双方各自带来真正不同的视角。', '共同盲点的风险较低。']);
      neg = relation === 'complementary-opposite'
        ? bt(['Can pull toward different priorities if not actively coordinated.', 'Requires explicit division-of-labour conversations rather than assuming it.', 'Risk of feeling like you\'re "running in different directions" without check-ins.'],
             ['若不主动协调，可能各自偏向不同的优先事项。', '需要明确讨论分工，而非想当然。', '若缺乏沟通，可能感觉「各自朝不同方向前进」。'])
        : relation === 'mirrored'
        ? bt(['Shared major turning points can compound stress if they land simultaneously.', 'Less natural diversity of perspective on big decisions.', 'Risk of reinforcing the same blind spot together.'],
             ['若重大转折点同时出现，压力可能相互叠加。', '重大决策上天然的视角多样性较低。', '存在共同强化同一盲点的风险。'])
        : bt(['Independent tracks require more deliberate effort to stay in sync on major life planning.', 'Less natural intuitive understanding of each other\'s big-picture timing.', 'Joint long-term planning needs more explicit conversation.'],
             ['独立的运行轨迹需要更刻意的努力才能在重大人生规划上保持同步。', '对彼此大方向时机的天然默契较低。', '共同长期规划需要更明确的沟通。']);
      cau = bt(['Treat as a life-stage/destiny-axis lens, not a standalone relationship verdict.', 'A full 14-star chart would refine this considerably - this is the Life/Body Palace layer only.', `Revisit if either party's birth time is corrected, since palace placement is time-sensitive.`],
        ['请将此视为人生阶段／命运轴线的参考角度，而非独立的关系定论。', '完整十四主星命盘可大幅细化本分析——此处仅为命宫／身宫层面。', '若任一方出生时间有更正，请重新查阅，因宫位推算对时间敏感。']);
      opts = { remedies: relation === 'complementary-opposite'
        ? bt([`Explicitly divide domains where each of you naturally leads, rather than defaulting to competing over the same ground.`, `Schedule regular check-ins during major life-stage transitions, since your timing may not naturally align.`, `Use the difference deliberately - assign decisions to whichever partner's Life Palace domain fits best.`],
             ['明确划分各自天然擅长的领域，避免默认在同一领域竞争。', '在重大人生阶段转折期间定期沟通，因二人时机未必天然一致。', '刻意善用差异——将决策交由命宫领域较适合的一方主导。'])
        : relation === 'mirrored'
        ? bt([`When a major turning point hits both of you at once, actively bring in an outside perspective (mentor, advisor) to counter the shared blind spot.`, `Deliberately seek differing viewpoints on big decisions rather than assuming agreement.`],
             ['当重大转折点同时降临二人时，主动引入外部视角（导师、顾问）以弥补共同盲点。', '重大决策上刻意寻求不同观点，而非假设意见一致。'])
        : bt([`Schedule deliberate joint planning check-ins, since your destiny axes do not naturally sync on their own.`, `Make major life-stage timing explicit in conversation rather than assuming shared intuition.`],
             ['刻意安排共同规划的沟通时段，因二人命运轴线不会自行同步。', '重大人生阶段时机应明确说出，而非假设默契天成。'])
      };
  } else if (type === 'daily_qmdj') {
      // ENHANCEMENT 8 FIX: Daily QMDJ Chart deep analysis - advice for today vs this profile's natal chart.
      const d = extraData.daily;
      const isGood = d.doorRatingToday === 'Auspicious'; const isCaution = d.doorRatingToday === 'Caution';
      const natalMatch = d.personPalaceToday === p.qmdj.natalPalace;
      chars = bt(`Today (${d.dateStr}), your Day Master rides Palace ${d.personPalaceToday}, activating the ${d.cellToday.door} (${d.doorRatingToday}) door, under ${d.todayQmdj.dun === 'yang' ? 'Yang Dun' : 'Yin Dun'} Ju ${d.todayQmdj.ju}.`,
        `今日（${d.dateStr}），您的日主落于第${d.personPalaceToday}宫，激活${d.cellToday.door}（${d.doorRatingToday === 'Auspicious' ? '吉门' : d.doorRatingToday === 'Caution' ? '凶门' : '平门'}），当值${d.todayQmdj.dun === 'yang' ? '阳遁' : '阴遁'}局数${d.todayQmdj.ju}。`);
      exp = isGood
        ? bt(`Today's chart places your Day Master on an Auspicious Door (吉门) - a genuinely favourable day for decisive action, especially in the domain this door governs (${d.cellToday.door.includes('Kai')?'new beginnings, launches, official matters':d.cellToday.door.includes('Xiu')?'rest, recovery, low-key consolidation':'growth, resources, and forward movement'}).`,
             `今日命盘将您的日主置于吉门之上——确实适合果断行动，尤其是该门所主管的领域（${d.cellToday.door.includes('Kai')?'开创新局、启动事务、官方事宜':d.cellToday.door.includes('Xiu')?'休养生息、低调巩固':'成长、资源累积与稳步前进'}）。`)
        : isCaution
        ? bt(`Today's chart places your Day Master on a Caution Door (凶门) - not a reason for alarm, but a signal to be more deliberate today, particularly around ${d.cellToday.door.includes('Shang')?'conflict, injury risk, or impulsive confrontation':d.cellToday.door.includes('Si')?'endings, closures, or high-stakes irreversible decisions':'shocks, surprises, or unexpected disruption'}.`,
             `今日命盘将您的日主置于凶门之上——无需惊慌，但提醒今日行事宜更加谨慎，尤其在${d.cellToday.door.includes('Shang')?'冲突、受伤风险或冲动对抗':d.cellToday.door.includes('Si')?'了结、终止或高风险不可逆决策':'意外、突发状况或干扰'}方面。`)
        : bt(`Today's chart places your Day Master on a Neutral Door - an unremarkable day astrologically, well suited to routine matters rather than major initiatives.`,
             `今日命盘将您的日主置于平门之上——命理上属平淡的一天，适合处理日常事务，不宜作重大开创。`);
      traits = natalMatch ? bt(`Today's active palace matches your own natal Life Palace - an unusually resonant day where the daily energy directly reinforces your natal chart.`, `今日当值宫位与您本命命宫相同——属难得的呼应之日，当日能量直接强化本命命盘。`)
        : bt(`Today's active palace differs from your natal Life Palace, meaning today's energy is a temporary overlay rather than a reinforcement of your core chart.`, `今日当值宫位与您本命命宫不同，代表今日能量属临时性叠加，而非强化核心命盘。`);
      hl = bt([`Door today: ${d.cellToday.door} (${d.doorRatingToday}).`, `Star/Deity today: ${d.cellToday.star} / ${d.cellToday.deity}.`, natalMatch ? 'Resonates directly with your natal Life Palace.' : `Palace ${d.personPalaceToday} today vs your natal Palace ${p.qmdj.natalPalace}.`],
        [`今日之门：${d.cellToday.door}（${d.doorRatingToday === 'Auspicious' ? '吉' : d.doorRatingToday === 'Caution' ? '凶' : '平'}）。`, `今日星／神：${d.cellToday.star} / ${d.cellToday.deity}。`, natalMatch ? '与本命命宫直接呼应。' : `今日第${d.personPalaceToday}宫 对 本命第${p.qmdj.natalPalace}宫。`]);
      pos = isGood
        ? bt(['Favourable day for decisive action in the door\'s domain.', 'Lower resistance to new initiatives today.', 'Good day to schedule anything you have been putting off.'],
             ['适合在该门主管领域果断行动。', '今日推展新事务的阻力较低。', '适合安排一直搁置未办的事项。'])
        : bt(['Even a caution/neutral day is a normal, workable day - not an omen.', 'Awareness alone reduces most of the practical risk.', 'A good day for planning and preparation rather than action.'],
             ['即使是凶门或平门之日，仍属正常可运作的一天，并非凶兆。', '仅凭留意即可化解大部分实际风险。', '适合规划与筹备，而非贸然行动。']);
      neg = isCaution
        ? bt(['Elevated risk of friction, conflict, or impulsive missteps today.', 'Less favourable for signing major agreements or irreversible decisions.', 'Minor setbacks are more likely to compound if rushed.'],
             ['今日摩擦、冲突或冲动失误的风险较高。', '不宜签署重大协议或作出不可逆决策。', '若操之过急，小挫折更容易累积扩大。'])
        : bt(['Even auspicious days do not guarantee outcomes - preparation still matters.', 'Overconfidence on a favourable day can lead to under-preparation.', 'Daily charts are a minor overlay, not a substitute for your full natal reading.'],
             ['即使吉日也不保证结果——准备工作依然重要。', '吉日过度自信可能导致准备不足。', '每日命盘只是次要参考，不能取代完整本命分析。']);
      cau = isCaution
        ? bt(['Avoid finalising major contracts or irreversible decisions today if they can reasonably wait.', 'Double-check details before acting - this is a day for care, not haste.', 'If a caution-door matter cannot wait, pair it with a personal auspicious-direction remedy from your Ba Zhai reading.'],
             ['若可延后，今日避免签订重大合约或作出不可逆决策。', '行动前请再三确认细节——今日宜谨慎，不宜仓促。', '若凶门事务无法延后，可搭配八宅分析中您的个人吉方作为化解。'])
        : bt(['Use favourable days as a tiebreaker, not the sole basis for major decisions.', 'Still apply normal diligence even on an auspicious day.', 'Recheck this chart each day - it changes daily, unlike your natal reading.'],
             ['吉日宜作为决策的参考依据，而非唯一根据。', '即使吉日仍应保持一贯的谨慎。', '此命盘每日变化，请每天重新查阅，不同于本命分析。']);
      opts = { remedies: isCaution
        ? bt([`Where possible, reschedule high-stakes matters (contracts, launches, confrontations) to a day this profile\'s Ze Ri checker rates more favourably.`, `If action cannot wait, favour the ${p.kuaGroup} direction from your Ba Zhai reading when making the decision (e.g. sit/face that way) as a light corrective.`, `Keep today's decisions reversible where possible - avoid locking in anything permanent.`],
             [`若可行，将高风险事务（签约、启动、对峙）改期至择日分析评为更吉利的日子。`, `若无法延后，决策时可朝向八宅分析中您${p.kuaGroup}的吉方（如坐向该方位）作为轻度化解。`, `尽量让今日的决策保留可逆余地，避免锁定任何永久性安排。`])
        : bt([`No specific remedy needed - a good day to move forward on anything you've been holding off on.`, `Still pair with your own judgement and full natal chart rather than acting on the daily chart alone.`],
             ['毋须特别化解——适合推进一直搁置的事项。', '仍应结合自身判断与完整本命命盘，切勿仅凭每日命盘行事。'])
      };
  } else if (type === 'luantou') {
      chars = bt(`Luan Tou (峦头) - the Form School assessment of physical landform and built environment, evaluated relative to your ${p.kuaGroup} Kua group.`,
        `峦头——形家风水对实体地形与建筑环境的评估，并对照您${p.kuaGroup}的卦命而论。`);
      exp = bt(`Where Ba Zhai (理气, Compass School) evaluates direction and Qi flow mathematically, Luan Tou evaluates the tangible physical form - the shape of land, the position of roads, water, and neighbouring structures - since even a mathematically favourable direction can be undermined by poor physical form (e.g. a T-junction facing the main door, or a sharp structure pointing at the entrance).`,
        `八宅（理气派）以方位与气流数理评估风水，而峦头则评估具体的实体形态——地形样貌、道路与水系位置、邻近建筑结构，因为即使方位在数理上有利，恶劣的实体形势仍可能削弱其效果（例如大门正对T字路口，或尖角建筑物直冲大门）。`);
      traits = bt(`Favourable Luan Tou generally shows: a gently rising rear (mountain/support at the back), open and unobstructed front (water/space for Qi to gather), and no direct sha (sharp edges, poles, or straight roads) pointing at the main entrance.`,
        `理想的峦头格局通常呈现：后方缓缓隆起（有山或靠山支撑）、前方开阔无阻（有水或空间聚气），且无尖角、电杆或直冲道路等煞气直射大门。`);
      hl = bt(['Rear support ("Xuan Wu backing") strengthens stability.', 'Open front ("Bright Hall") allows Qi to gather before the entrance.', 'Absence of direct Sha Qi (sharp corners/roads) protects the main door.'],
        ['「玄武靠山」的后方支撑强化稳定性。', '「明堂」开阔的前方有利气场在门前聚集。', '无直冲煞气（尖角／道路）可保护大门。']);
      pos = bt(['Good physical form amplifies whatever Ba Zhai direction is already favourable.', 'Visible, correctable - unlike intangible timing factors.', 'Improvements (landscaping, screening) can meaningfully help.'],
        ['良好的实体形势能放大八宅方位原有的吉利效果。', '形势因素肉眼可见、可加以改善，不同于无形的时机因素。', '透过景观布置或屏障等改善措施，确实能带来实质帮助。']);
      neg = bt(['Physical form specifics vary property to property and cannot be fully generalised from a birth chart.', 'Urban settings often present compromises between ideal form and reality.', 'Some Sha Qi sources are structural and cannot be removed, only screened.'],
        ['实体形势因物业而异，无法单凭命盘一概而论。', '都市环境中理想形势与现实条件常需折衷。', '部分煞气源自建筑结构，无法移除，只能加以遮挡化解。']);
      cau = bt(['Walk the actual property and check for direct roads, poles, or edges facing the main door.', 'Prioritise fixing severe physical Sha Qi over fine-tuning direction alone.', 'Consult a qualified practitioner on-site for anything structural.'],
        ['请实地走访物业，检查是否有道路、电杆或棱角直冲大门。', '应优先处理严重的实体煞气，而非只调整方位细节。', '涉及结构问题，请咨询专业人士实地勘察。']);
  } else if (type === 'flyingstar_property' && extraData && extraData.chart) {
      // ENHANCEMENT (Phase 0, reported: "no deep analysis" for the Flying Star property calculator -
      // "Go Deep"). Reads the ACTUAL computed Mountain/Facing/Period star numbers at this specific
      // property's Facing and Sitting palaces (already computed by computeFlyingStarChart above -
      // nothing here is invented or generic) against the documented star-nature reference table.
      const ch = extraData.chart;
      const facingP = ch.palaces[ch.facingDirection], sittingP = ch.palaces[ch.sittingDirection];
      const facingLabel = bt(FLYING_STAR_DIR_LABEL_EN[ch.facingDirection], FLYING_STAR_DIR_LABEL_ZH[ch.facingDirection]);
      const sittingLabel = bt(FLYING_STAR_DIR_LABEL_EN[ch.sittingDirection], FLYING_STAR_DIR_LABEL_ZH[ch.sittingDirection]);
      const favStars = [facingP.mountain, facingP.facing, sittingP.mountain, sittingP.facing].filter(n => FLYING_STAR_NATURE[n]?.favourable === true);
      const cautionStars = [facingP.mountain, facingP.facing, sittingP.mountain, sittingP.facing].filter(n => FLYING_STAR_NATURE[n]?.favourable === false);
      chars = bt(`Period ${ch.period} property, facing ${facingLabel}/sitting ${sittingLabel}: Facing palace carries Mountain Star ${facingP.mountain} and Facing Star ${facingP.facing}; Sitting palace carries Mountain Star ${sittingP.mountain} and Facing Star ${sittingP.facing}.`,
        `第${ch.period}运物业，向${facingLabel}／坐${sittingLabel}：向宫为山星${facingP.mountain}、向星${facingP.facing}；坐宫为山星${sittingP.mountain}、向星${sittingP.facing}。`);
      exp = bt(`The Facing Star at the Facing palace and the Mountain Star at the Sitting palace are traditionally the two most closely watched numbers for a property's overall fortune - the Facing Star for wealth/external activity, the Mountain Star for health/relationships/occupants. This reading interprets the actual numbers your construction year and facing direction produced, against the standard nature of each of the 9 Flying Stars.`,
        `传统上，向宫之向星与坐宫之山星是判断物业整体运势最受重视的两个数字——向星主财运与外部活动，山星主健康、人际与居住者。此解读依据您所输入的建造年份与朝向所推算出的实际数字，对照九星各自的标准性质而论。`);
      traits = `${flyingStarNatureLine(facingP.facing)} ${flyingStarNatureLine(sittingP.mountain)}`;
      hl = [
        bt(`Facing palace (${facingLabel}) Facing Star: ${flyingStarNatureLine(facingP.facing)}`, `向宫（${facingLabel}）向星：${flyingStarNatureLine(facingP.facing)}`),
        bt(`Sitting palace (${sittingLabel}) Mountain Star: ${flyingStarNatureLine(sittingP.mountain)}`, `坐宫（${sittingLabel}）山星：${flyingStarNatureLine(sittingP.mountain)}`),
        bt(`Period ${ch.period} Period Star at the Facing palace: ${facingP.period}.`, `向宫本运运星：${facingP.period}。`),
      ];
      pos = favStars.length ? favStars.map(n => flyingStarNatureLine(n)) : [bt('No consistently-favourable star currently falls at either the Facing or Sitting palace - focus on remedies rather than amplification for now.','向宫与坐宫目前均无明显吉星——现阶段宜著重化解而非催旺。')];
      neg = cautionStars.length ? cautionStars.map(n => flyingStarNatureLine(n)) : [bt('No commonly-cautioned star (2, 3, 5, or 7) currently falls at either the Facing or Sitting palace.','向宫与坐宫目前均无常见凶星（二、三、五、七黑）。')];
      cau = [
        bt('This reads only the Facing and Sitting palace numbers, not all 9 palaces, and does not check for named combination patterns (e.g. Wang Shan Wang Xiang) - see the note below the chart above for that scope limitation.', '此处仅解读向宫与坐宫两组数字，未涵盖全部九宫，亦未检查命名格局（如旺山旺向）——详见上方图表下方之范围说明。'),
        bt('Combine with the Annual/Monthly/Daily overlay above (its own Deep Analysis) for a fuller picture of what is currently active on top of this fixed property chart.', '请结合上方流年／流月／流日飞星（其本身亦有深度解读）综合判断，以了解在此固定物业命盘之上，当前实际活跃之状况。'),
        bt('A Sha Qi (physical form) issue can undermine an otherwise favourable star - cross-check against the Luan Tou reading below.', '实体煞气可能削弱原本吉利的星曜——请一并参考下方峦头解读。'),
      ];
  } else if (type === 'flyingstar_household_kua' && extraData && extraData.chart && extraData.roster) {
      // ENHANCEMENT (Phase 2 - the combination reading this app's own Flying Star honesty note
      // explicitly flagged as "a further step not attempted here": every household member's personal
      // Kua-derived best direction (Ba Zhai) is now cross-checked against what THIS property's own
      // Flying Star chart actually puts at that exact palace - not a generic Kua-only or
      // property-only reading, but the genuine intersection of the two systems.
      const ch = extraData.chart, roster = extraData.roster;
      const rated = roster.map(person => {
        const bestDirRaw = findBestBazhaiDirection(person.kuaNum);
        // BUG FIX (found by this feature's own dedicated test, before ever shipping): Ba Zhai's own
        // direction keys (BAZHAI_STARS, via findBestBazhaiDirection) are the FULL English direction
        // names ("Southeast"), while a Flying Star chart's palaces (computeFlyingStarChart) are keyed
        // by the SHORT direction codes ("SE") - the two systems' direction keys were never actually
        // compatible without this conversion, which would have made every single lookup below silently
        // return undefined. Converted via the same DIR_FULL_TO_SHORT table the property-calculator
        // section already uses to bridge these two direction-key conventions.
        if (!bestDirRaw) return { ...person, bestDir: null };
        const shortDir = DIR_FULL_TO_SHORT[bestDirRaw.direction];
        const bestDir = { direction: shortDir, star: bestDirRaw.star };
        const palace = ch.palaces[shortDir];
        if (!palace) return { ...person, bestDir: null };
        const mNature = FLYING_STAR_NATURE[palace.mountain], fNature = FLYING_STAR_NATURE[palace.facing];
        const anyUnfavourable = mNature?.favourable === false || fNature?.favourable === false;
        const anyFavourable = mNature?.favourable === true || fNature?.favourable === true;
        const verdict = anyUnfavourable ? 'undercut' : (anyFavourable ? 'reinforced' : 'neutral');
        return { ...person, bestDir, mountain: palace.mountain, facing: palace.facing, verdict };
      });
      const withData = rated.filter(r => r.bestDir);
      const reinforcedCount = withData.filter(r => r.verdict === 'reinforced').length;
      const undercutCount = withData.filter(r => r.verdict === 'undercut').length;
      const dirLabel = (dir) => bt(FLYING_STAR_DIR_LABEL_EN[dir], FLYING_STAR_DIR_LABEL_ZH[dir]);
      if (withData.length) {
        chars = bt(`Cross-referencing each household member's personal Kua-derived best direction against this property's own Flying Star chart: ${reinforcedCount} of ${withData.length} have the property's own energy reinforcing their personal zone, ${undercutCount} have it undercut by a cautioned star sitting there instead.`,
          `将每位家庭成员依个人命卦所定的最佳方位，与本物业自身的飞星盘进行交叉比对：${withData.length} 人中有 ${reinforcedCount} 人的个人吉利区域获本物业能量强化，${undercutCount} 人则因该方位恰好落入凶星而被削弱。`);
        exp = bt(`Ba Zhai (8 Mansions) identifies each person's own best direction independent of any specific building; Flying Star (Xuan Kong) separately rates every palace of THIS SPECIFIC property based on its construction year and facing. Most readings stop at reporting these two systems side by side - this reading instead checks whether this property's own fixed Mountain/Facing numbers, specifically at each person's own best direction, actually reinforce or undercut what Ba Zhai already recommends for them.`,
          `八宅法依个人命卦决定其专属最佳方位，与具体建筑物无关；飞星法则依建造年份与朝向，个别评定此特定物业每一宫位之吉凶。多数解读仅将两套系统并列呈现——此解读则进一步检视：此物业本身固定的山星／向星数字，在每个人各自的最佳方位上，究竟是强化还是削弱了八宅法原本给予该人的建议。`);
        traits = bt(undercutCount === 0 ? `A well-aligned property for its current occupants - no one's personal best zone is undercut by a cautioned Flying Star number.` : reinforcedCount > undercutCount ? `A generally favourable property overall, though at least one occupant's personal best zone happens to coincide with a cautioned star - worth a targeted remedy rather than treating the whole property as uniformly good or bad.` : `A property where more occupants' personal zones are undercut than reinforced by its own fixed chart - the remedies below are worth prioritising over relying on personal Ba Zhai placement alone.`,
          undercutCount === 0 ? `此物业与现居住户的命卦配合良好——没有任何人的个人最佳区域被凶星削弱。` : reinforcedCount > undercutCount ? `整体而言此物业属吉利，惟至少一位住户的个人最佳区域恰好落入凶星方位——建议针对该处进行化解，而非笼统评断整个物业。` : `此物业中，个人区域被削弱的住户多于被强化的住户——比起单靠八宅个人方位，更应优先处理下方的化解建议。`);
        hl = withData.map(r => bt(`${r.label}: best direction ${dirLabel(r.bestDir.direction)} (${r.bestDir.star}) - property carries Mountain ${r.mountain}/Facing ${r.facing} here (${r.verdict}).`, `${r.label}：最佳方位${dirLabel(r.bestDir.direction)}（${r.bestDir.star}）——此物业于该方位为山星${r.mountain}／向星${r.facing}（${r.verdict === 'reinforced' ? '获强化' : r.verdict === 'undercut' ? '被削弱' : '中性'}）。`));
        pos = withData.filter(r => r.verdict === 'reinforced').length
          ? withData.filter(r => r.verdict === 'reinforced').map(r => bt(`${r.label}'s personal best zone (${dirLabel(r.bestDir.direction)}) is genuinely reinforced by this property's own Flying Star chart.`, `${r.label}的个人最佳区域（${dirLabel(r.bestDir.direction)}）确实获此物业本身的飞星盘所强化。`))
          : [bt('No occupant currently has their personal zone specifically reinforced by this property\'s chart - not a red flag by itself, simply neutral overlap.', '目前没有住户的个人区域获此物业命盘特别强化——这本身并非警讯，仅属中性重叠。')];
        neg = withData.filter(r => r.verdict === 'undercut').length
          ? withData.filter(r => r.verdict === 'undercut').map(r => bt(`${r.label}'s personal best zone (${dirLabel(r.bestDir.direction)}) coincides with a cautioned Flying Star number at this property - worth a specific remedy there rather than assuming the Ba Zhai placement alone is enough.`, `${r.label}的个人最佳区域（${dirLabel(r.bestDir.direction)}）恰好与此物业的凶星方位重叠——建议在该处另行化解，不宜仅依赖八宅方位安排。`))
          : [bt('No occupant\'s personal zone is currently undercut by a cautioned star at this property.', '目前没有住户的个人区域被此物业的凶星方位削弱。')];
        cau = [bt('This reads only each person\'s single BEST Ba Zhai direction against the property chart, not all 4 of their favourable directions or all 9 palaces.', '此解读仅比对每人单一「最佳」八宅方位与物业命盘，未涵盖其全部4个吉利方位或全部9宫。'), bt('Re-run whenever household membership, the property\'s facing direction, or its construction year changes.', '家庭成员、物业朝向或建造年份变动时，应重新运行此分析。'), bt('Combine with the Annual/Monthly/Daily overlay above for what is currently active on top of this fixed combination.', '请结合上方流年／流月／流日飞星，了解在此固定组合之上目前实际活跃之状况。')];
        opts = { remedies: withData.filter(r => r.verdict === 'undercut').length
          ? [bt(`Prioritise a remedy (mirror, plant, or screening - practitioner-guided) at ${withData.filter(r=>r.verdict==='undercut').map(r=>dirLabel(r.bestDir.direction)).join(', ')}, since this is where a personal best zone meets a cautioned property-level star.`, `建议优先在${withData.filter(r=>r.verdict==='undercut').map(r=>dirLabel(r.bestDir.direction)).join('、')}方位进行化解（镜子、植物或屏风——建议咨询专业人士），因为这正是个人最佳区域与物业凶星重叠之处。`), bt('Affected occupants can also set up a secondary personal zone (bedroom/desk) at their next-best Ba Zhai direction if this one cannot be remedied.', '受影响的住户亦可在其次佳八宅方位另设个人区域（卧室／书桌），以备此处无法化解时使用。')]
          : [bt('No specific remedy is indicated by this cross-reference - general Feng Shui upkeep (see the readings above) is sufficient.', '此交叉分析未指出特定化解需求——维持一般风水保养（参见上方解读）即可。')]
        };
      } else {
        chars = bt(`Add household members with a valid Kua number above to generate this cross-reference reading.`, `请在上方添加具有效命卦的家庭成员，以生成此交叉解读。`);
        exp = bt(`This reading cross-references each household member's personal Ba Zhai best direction against this specific property's own Flying Star chart.`, `此解读将每位家庭成员的个人八宅最佳方位，与此特定物业本身的飞星盘进行交叉比对。`);
        traits = bt(`Fully dynamic - regenerates whenever household membership or the property's chart changes.`, `完全动态生成——家庭成员或物业命盘变动即会重新生成。`);
      }
  } else if (type === 'flyingstar_temporal' && extraData && extraData.overlay) {
      // ENHANCEMENT (Phase 0, reported: no deep-reading detail for the Flying Star Current
      // Year/Monthly/Daily overlay - "Go Deep for this as well"). Finds where the Five Yellow (5) and
      // the current Wealth Star (8) actually sit THIS year/month (from the real computed overlay, not
      // a canned example) since knowing which direction to avoid disturbing, and which to favour, is
      // the single most common practical takeaway sought from this chart.
      const ov = extraData.overlay;
      const dirLabel = (dir) => dir === 'center' ? bt('the Center','中宫') : bt(FLYING_STAR_DIR_LABEL_EN[dir], FLYING_STAR_DIR_LABEL_ZH[dir]);
      const findDir = (chart, num) => Object.keys(chart).find(d => chart[d] === num);
      const annualFive = findDir(ov.annual.chart, 5), annualEight = findDir(ov.annual.chart, 8);
      const monthlyFive = findDir(ov.monthly.chart, 5), monthlyEight = findDir(ov.monthly.chart, 8);
      chars = bt(`Annual (${ov.annual.year}) Five Yellow currently occupies ${dirLabel(annualFive)}; the Wealth Star 8 currently occupies ${dirLabel(annualEight)}. This month (${ov.monthly.year}-${String(ov.monthly.month).padStart(2,'0')}), the Monthly Five Yellow occupies ${dirLabel(monthlyFive)} and Monthly 8 occupies ${dirLabel(monthlyEight)}.`,
        `${ov.annual.year}年流年五黄现居${dirLabel(annualFive)}；财星八白现居${dirLabel(annualEight)}。本月（${ov.monthly.year}年${ov.monthly.month}月），流月五黄居${dirLabel(monthlyFive)}，流月八白居${dirLabel(monthlyEight)}。`);
      exp = bt(`The Annual and Monthly stars fly to a different palace each year/month, temporarily overlaying whatever fixed Mountain/Facing/Period chart a specific property already has (see the Property Calculator above). The most common practical use of this overlay is timing: avoiding renovation or prolonged disturbance where the Five Yellow currently sits, and favouring activity (placing a desk, an entrance, or décor associated with wealth) where the current 8 sits.`,
        `流年星与流月星每年／每月飞临不同宫位，暂时叠加于特定物业本身固定的山星／向星／运星盘之上（见上方物业计算器）。此叠加盘最常见的实用意义在于「时机」——五黄所在方位宜避免装修或长时间打扰，而现居八白之方位则宜多加利用（如摆放书桌、设置入口，或布置与财运相关的摆设）。`);
      traits = bt(`${flyingStarNatureLine(5)} ${flyingStarNatureLine(8)} Daily star currently: Star ${ov.daily.chart.center}.`, `${flyingStarNatureLine(5)} ${flyingStarNatureLine(8)} 流日星现值：${ov.daily.chart.center}。`);
      hl = [
        bt(`Avoid disturbing ${dirLabel(annualFive)} this year (Annual Five Yellow) and ${dirLabel(monthlyFive)} this month (Monthly Five Yellow).`, `本年宜避免打扰${dirLabel(annualFive)}（流年五黄），本月宜避免打扰${dirLabel(monthlyFive)}（流月五黄）。`),
        bt(`${dirLabel(annualEight)} carries the current Wealth Star (8) this year; ${dirLabel(monthlyEight)} carries it this month.`, `${dirLabel(annualEight)}为本年财星（八白）所在；${dirLabel(monthlyEight)}为本月所在。`),
        bt(`Daily star is governed by the ${ov.daily.governingTerm} solar-term window (seed ${ov.daily.seed}) - the fastest-moving of the three, best used for same-day timing only.`, `流日星依「${ov.daily.governingTerm}」节气区间推算（入中数${ov.daily.seed}）——三者中变动最快，仅适用于当日时机判断。`),
      ];
      pos = [flyingStarNatureLine(8), bt('Knowing exactly which direction is currently active lets you time renovations, big purchases, or new ventures around it rather than guessing.', '掌握当前确切的当旺方位，可据以安排装修、大额支出或新计划的时机，而非凭空猜测。')];
      neg = [flyingStarNatureLine(5), flyingStarNatureLine(2), bt('This overlay has not been combined with this specific property\'s own fixed Mountain/Facing chart above - the two together (not either alone) give the complete picture for a specific room or palace.', '此叠加盘尚未与上方该物业本身固定的山星／向星盘进行组合解读——两者合参（而非单看其一）方为该方位完整的判断依据。')];
      cau = [
        bt('The Daily star (least verified of the three per the honesty note above) is best treated as a rough same-day indicator, not a precise timing tool.', '流日星（按上方诚实说明为三者中把握最低者）宜视为当日粗略参考，而非精确择时工具。'),
        bt('Avoid major renovation, groundbreaking, or prolonged occupancy in the current Five Yellow palace at either the Annual or Monthly level while it is active there.', '流年或流月五黄所在方位活跃期间，宜避免大规模装修、动土或长时间逗留。'),
      ];
  } else if (type === 'dayun_3year_monthly' && extraData && extraData.forecast) {
      // ENHANCEMENT (this round): 3-Year Monthly Da Yun Forecast - genuinely cascading Wu Xing score
      // (Day Master -> Da Yun -> Liu Nian -> Liu Yue) for each of the next 36 calendar months, bucketed
      // into the 7-tier scale shared with the matching Western Astrology reading below.
      const fc = extraData.forecast;
      const elemNamesEN = ['Wood','Fire','Earth','Metal','Water'];
      const elemNamesZH = {Wood:'木',Fire:'火',Earth:'土',Metal:'金',Water:'水'};
      const dmElem = elemNamesEN[getElementIdx(p.bazi.dayStemIdx)];
      const monthLabel = (m) => `${m.year}-${String(m.month).padStart(2,'0')}`;
      const stageNameEN = { dm_dayun: 'Day Master vs Da Yun', dayun_liunian: "Da Yun vs this year's Liu Nian", liunian_liuyue: "Liu Nian vs this month's Liu Yue" };
      const stageNameZH = { dm_dayun: '日主与大运', dayun_liunian: '大运与今年流年', liunian_liuyue: '流年与本月流月' };
      const dominantEN = (m) => `${stageNameEN[m.dominant.key]} (${WUXING_REL_LABEL[m.dominant.stemRel].en})`;
      const dominantZH = (m) => `${stageNameZH[m.dominant.key]}（${WUXING_REL_LABEL[m.dominant.stemRel].zh}）`;
      const tierCounts = {};
      fc.months.forEach(m => { tierCounts[m.tier.en] = (tierCounts[m.tier.en] || 0) + 1; });
      const tierZhByEn = {}; MONTHLY_TIER_LABELS.forEach(t => tierZhByEn[t.en] = t.zh);
      const distEN = Object.keys(tierCounts).map(k => `${k} (${tierCounts[k]})`).join(', ');
      const distZH = Object.keys(tierCounts).map(k => `${tierZhByEn[k]}（${tierCounts[k]}）`).join('、');

      chars = bt(`Scored all 36 months from ${monthLabel(fc.months[0])} through ${monthLabel(fc.months[35])} by cascading your ${dmElem} Day Master through the Da Yun pillar governing each point in time, that year's Liu Nian, and that month's own Liu Yue - a compounding chain, not three separate unrelated scores.`,
        `依序连锁计算：您的${elemNamesZH[dmElem]}日主 → 当期大运 → 当年流年 → 当月流月，逐月评算${monthLabel(fc.months[0])}至${monthLabel(fc.months[35])}共36个月——为层层承接的综合评级，并非三组各自独立的评分。`);
      exp = bt(`Real BaZi timing analysis reads a given month through a nested chain: the Da Yun (10-year cycle) sets the decade's overall tone against your Day Master, the Liu Nian (flowing year) either supports or strains that decade's pillar in turn, and the Liu Yue (flowing month) does the same against the year again. This reading computes exactly that chain for each of the next 36 months and buckets the compounded result into this app's 7-tier scale (Extremely Auspicious to Extremely Inauspicious). Like the Da Yun cycle rating elsewhere in this app, this is a simplified heuristic - not a full "Useful God" (用神) analysis accounting for your chart's overall strength - so treat it as a general orientation for timing, not a precise forecast.`,
        `真正的八字择时分析，会以嵌套链条解读某个月份：大运（十年周期）先为整个十年对日主定下基调，流年再对该大运之柱形成扶抑，流月又对该流年形成扶抑。此解读针对未来36个月逐一计算完整链条，并将综合结果归入本应用的七级量表（极为吉利至极为不吉）。与本应用其他大运评级相同，此为简化推算（并非考量命局整体强弱的完整「用神」分析）——请视为时机大方向参考，而非精确预测。`);
      traits = bt(`Tier distribution across this 36-month window: ${distEN}.`, `此36个月窗口内各评级分布：${distZH}。`);
      hl = [
        bt(`Most auspicious month: ${monthLabel(fc.best)} - ${fc.best.tier.en} (dominant factor: ${dominantEN(fc.best)}).`, `最吉利月份：${monthLabel(fc.best)} —— ${fc.best.tier.zh}（主导因素：${dominantZH(fc.best)}）。`),
        bt(`Most cautioned month: ${monthLabel(fc.worst)} - ${fc.worst.tier.en} (dominant factor: ${dominantEN(fc.worst)}).`, `最需留意月份：${monthLabel(fc.worst)} —— ${fc.worst.tier.zh}（主导因素：${dominantZH(fc.worst)}）。`),
        bt(`Current Da Yun pillar governing the start of this window: ${stemCN[fc.months[0].dayunStemIdx]}${branchCN[fc.months[0].dayunBranchIdx]}.`, `此窗口起始时的大运干支：${stemCN[fc.months[0].dayunStemIdx]}${branchCN[fc.months[0].dayunBranchIdx]}。`)
      ];
      pos = [bt(`${monthLabel(fc.best)} stacks a genuinely supportive Da Yun-Liu Nian-Liu Yue chain - ${dominantEN(fc.best)} is the strongest single contributor.`, `${monthLabel(fc.best)}的大运-流年-流月链条层层助力——${dominantZH(fc.best)}为最主要的助力来源。`)];
      neg = [bt(`${monthLabel(fc.worst)}'s chain compounds pressure rather than support - ${dominantEN(fc.worst)} is the dominant strain that month.`, `${monthLabel(fc.worst)}的链条累积压力而非助力——本月主要压力来自${dominantZH(fc.worst)}。`)];
      cau = [
        bt('This is a simplified elemental heuristic (not a full "Useful God" analysis) - treat a 1-tier difference between neighbouring months as noise, not a meaningful signal.', '此为简化的五行推算（并非完整「用神」分析）——相邻月份间一级的评级差异应视为误差范围，而非具有实际意义的信号。'),
        bt('This window is always "now through +3 years", not fixed calendar dates - recompute whenever you revisit this reading in a later month.', '此窗口恒为「现在起至未来三年」，并非固定日期——日后重新查看此解读时应重新计算。')
      ];
  } else if (type === 'astro_3year_monthly' && extraData && extraData.forecast) {
      // ENHANCEMENT (this round): matching 3-Year Monthly Western Astrology reading - genuine
      // Sun-sign-transit + Element/Modality relationship reading (see engine-metaphysics.js's honesty
      // note above compute3YearAstroMonthly for exactly what this does and does not compute), rated on
      // the SAME 7-tier scale as the Da Yun reading above.
      const fc = extraData.forecast;
      const natalEM = ZODIAC_ELEMENT_MODALITY[fc.natalKey];
      const elemZH = { Fire: '火象', Earth: '土象', Air: '风象', Water: '水象' };
      const modZH = { Cardinal: '基本宫', Fixed: '固定宫', Mutable: '变动宫' };
      const monthLabel = (m) => `${m.year}-${String(m.month).padStart(2,'0')}`;
      const relLabelEN = (m) => m.sameSign ? 'solar-return month (same sign as natal)' : `${m.elemRel} element pairing${m.sameModality ? ', same modality (added friction)' : ''}`;
      const relLabelZH = (m) => m.sameSign ? '本命太阳回归月（与本命同星座）' : `${{same:'相同',complementary:'互补',challenging:'挑战性'}[m.elemRel]}元素组合${m.sameModality ? '，宫性相同（增添摩擦）' : ''}`;
      const tierCounts = {};
      fc.months.forEach(m => { tierCounts[m.tier.en] = (tierCounts[m.tier.en] || 0) + 1; });
      const tierZhByEn = {}; MONTHLY_TIER_LABELS.forEach(t => tierZhByEn[t.en] = t.zh);
      const distEN = Object.keys(tierCounts).map(k => `${k} (${tierCounts[k]})`).join(', ');
      const distZH = Object.keys(tierCounts).map(k => `${tierZhByEn[k]}（${tierCounts[k]}）`).join('、');

      chars = bt(`Your natal Sun sign is ${fc.natalSign.en} (${natalEM.element}/${natalEM.modality}). For each of the next 36 months, this identifies which sign the Sun is genuinely transiting and rates the Element + Modality relationship between that transiting sign and your natal Sun on the same 7-tier scale used for the Da Yun reading above.`,
        `您的本命太阳星座为${fc.natalSign.zh}（${elemZH[natalEM.element]}／${modZH[natalEM.modality]}）。此解读针对未来36个月，逐月确定太阳实际行经的星座，并以与上方大运解读相同的七级量表，评定该行运星座与您本命太阳之间的元素与宫性关系。`);
      exp = bt(`Be precise about what this is: the Sun's zodiac sign for any calendar date is a real, deterministic astronomical fact (the same sign-date boundaries used for your own natal Sun sign), so which sign transits in a given month is genuine astronomy, not invented. What follows is a standard, established Western-astrology reading of the ELEMENT (Fire/Earth/Air/Water) and MODALITY (Cardinal/Fixed/Mutable) relationship between that transiting sign and your natal Sun. It is NOT a full ephemeris-based transit or progression system - there is no Moon, no other planets, and no houses involved, only the Sun's own monthly sign. Treat this as a genuine but narrow companion reading, not a substitute for a complete astrological transit chart.`,
        `请留意此解读的确切范围：任一日期太阳所在星座属于真实、确定的天文事实（与您本命太阳星座所用的相同星座日期边界一致），因此逐月太阳行经星座本身即为真实天文数据，并非虚构。以下则依据西方占星学标准、成熟惯例，解读该行运星座与您本命太阳之间的元素（火／土／风／水）与宫性（基本宫／固定宫／变动宫）关系。此并非完整的星历行运或推运系统——不涉及月亮、其他行星或宫位，仅以太阳每月所在星座为准。请将此视为一项真实但范围有限的辅助解读，而非完整占星行运盘的替代。`);
      traits = bt(`Tier distribution across this 36-month window: ${distEN}.`, `此36个月窗口内各评级分布：${distZH}。`);
      hl = [
        bt(`Most auspicious month: ${monthLabel(fc.best)} - transiting ${fc.best.transitSign.en} (${relLabelEN(fc.best)}).`, `最吉利月份：${monthLabel(fc.best)} —— 太阳行经${fc.best.transitSign.zh}（${relLabelZH(fc.best)}）。`),
        bt(`Most cautioned month: ${monthLabel(fc.worst)} - transiting ${fc.worst.transitSign.en} (${relLabelEN(fc.worst)}).`, `最需留意月份：${monthLabel(fc.worst)} —— 太阳行经${fc.worst.transitSign.zh}（${relLabelZH(fc.worst)}）。`)
      ];
      pos = [bt(`${monthLabel(fc.best)} is your solar-return-adjacent high point in this window - the Sun transits a sign genuinely well-matched to your natal ${fc.natalSign.en} by element and modality.`, `${monthLabel(fc.best)}为此窗口内的高点——太阳行经的星座在元素与宫性上均与您本命的${fc.natalSign.zh}相合。`)];
      neg = [bt(`${monthLabel(fc.worst)} carries the most elementally/modally challenging transit in this window relative to your natal ${fc.natalSign.en}.`, `${monthLabel(fc.worst)}为此窗口内相对您本命${fc.natalSign.zh}而言，元素／宫性挑战性最高的行运月份。`)];
      cau = [
        bt('Covers only the Sun\'s monthly sign transit and its Element/Modality relationship to your natal Sun - not Moon signs, other planets, houses, or aspects (see the honest scope note above).', '仅涵盖太阳逐月行运星座及其与本命太阳的元素／宫性关系——不含月亮星座、其他行星、宫位或相位（详见上方范围说明）。'),
        bt('Sign-date boundaries are accurate to within about a day, consistent with the natal Sun-sign lookup used elsewhere in this app.', '星座日期边界准确度约在一天以内，与本应用其他处所用的本命太阳星座查询一致。')
      ];
  } else if (type.startsWith('dayun_') && extraData && extraData.dyStemIdx !== undefined) {
      // BUG 5/6 FIX: each Da Yun cycle previously fell through to identical generic boilerplate.
      // Now every cycle's reading is genuinely derived from its own Stem/Branch and its Wu Xing
      // relationship to the Day Master, so consecutive cycles read differently from one another.
      const elemNames = ['Wood','Fire','Earth','Metal','Water'];
      const dmElemIdx = Math.floor(p.bazi.dayStemIdx / 2);
      const dyElemIdx = Math.floor(extraData.dyStemIdx / 2);
      const rel = dmElemIdx === dyElemIdx ? 'same' : (mod(dmElemIdx + 1, 5) === dyElemIdx ? 'generates' : (mod(dyElemIdx + 1, 5) === dmElemIdx ? 'drains' : (mod(dmElemIdx + 2, 5) === dyElemIdx ? 'controls' : 'clashed_by')));
      const dyStemCN = stemCN[extraData.dyStemIdx], dyBranchCN = branchCN[extraData.dyBranchIdx];
      const dyElem = elemNames[dyElemIdx]; const dmElem = elemNames[dmElemIdx];
      chars = bt(`Da Yun cycle ${extraData.ageStart}-${extraData.ageEnd} (calendar years ${extraData.calendarYearStart}-${extraData.calendarYearStart+9}) runs under the ${dyStemCN}${dyBranchCN} (${dyElem}) pillar.`,
        `${extraData.ageStart}至${extraData.ageEnd}岁的大运周期（公历${extraData.calendarYearStart}至${extraData.calendarYearStart+9}年）行${dyStemCN}${dyBranchCN}（${bt(dyElem, {Wood:'木',Fire:'火',Earth:'土',Metal:'金',Water:'水'}[dyElem])}）运。`);
      const relTextEN = {
        same: `reinforces your ${dmElem} Day Master directly - a cycle of amplified core-self energy`,
        generates: `feeds and nourishes your ${dmElem} Day Master - a cycle of resource and support`,
        drains: `is fed by your ${dmElem} Day Master - a cycle of output, creativity, and expenditure of effort`,
        controls: `is restrained by your ${dmElem} Day Master - a cycle where you exert control and authority outward`,
        clashed_by: `restrains your ${dmElem} Day Master - a more challenging cycle requiring resilience`
      }[rel];
      const dmElemZH = {Wood:'木',Fire:'火',Earth:'土',Metal:'金',Water:'水'}[dmElem];
      const dyElemZH = {Wood:'木',Fire:'火',Earth:'土',Metal:'金',Water:'水'}[dyElem];
      const relTextZH = {
        same: `直接增强您${dmElemZH}日主的力量——本命核心能量被放大的周期`,
        generates: `滋养生扶您的${dmElemZH}日主——资源与助力汇聚的周期`,
        drains: `被您的${dmElemZH}日主所生——才华外泄、付出心力的周期`,
        controls: `被您的${dmElemZH}日主所克制——对外行使掌控与权威的周期`,
        clashed_by: `克制您的${dmElemZH}日主——较具挑战性、需要韧性的周期`
      }[rel];
      const relText = bt(relTextEN, relTextZH);
      exp = bt(`This cycle's ${dyElem} element ${relText}. Reading each Da Yun cycle's elemental relationship to your Day Master is how BaZi identifies which decades will feel supportive versus which will demand more resilience.`,
        `此周期的${dyElemZH}行${relText}。透过分析每个大运周期与日主的五行关系，八字学得以判断哪些十年较为助力、哪些则更需韧性应对。`);
      const relLabelZH = {same:'比肩／同类',generates:'生扶',drains:'耗泄',controls:'克制',clashed_by:'受克'}[rel];
      traits = bt({
        same: 'Expect stronger self-confidence and initiative, with a tendency to act more independently during this decade.',
        generates: 'Expect resources, mentorship, and support to flow more easily during this decade.',
        drains: 'Expect a decade of high output - visible achievement, but also higher energy expenditure.',
        controls: 'Expect a decade oriented around leadership, structure, and exerting influence on your environment.',
        clashed_by: 'Expect a more demanding decade where resilience and adaptability matter more than usual.'
      }[rel], {
        same: '预期自信心与主动性增强，本十年倾向于更独立自主地行事。',
        generates: '预期本十年资源、贵人与助力更容易汇聚而来。',
        drains: '预期本十年产出丰富、成就有目共睹，但精力消耗也相应较大。',
        controls: '预期本十年围绕领导力、架构建设及对外施展影响力展开。',
        clashed_by: '预期本十年挑战较多，韧性与应变能力比平常更为重要。'
      }[rel]);
      hl = bt([`Cycle element: ${dyElem} (relationship to Day Master: ${rel.replace('_',' ')}).`, `Active calendar years: ${extraData.calendarYearStart}-${extraData.calendarYearStart+9}.`, `Pillar: ${dyStemCN}${dyBranchCN}.`],
        [`周期五行：${dyElemZH}（与日主关系：${relLabelZH}）。`, `实际公历年份：${extraData.calendarYearStart}至${extraData.calendarYearStart+9}年。`, `干支：${dyStemCN}${dyBranchCN}。`]);
      pos = bt((rel === 'same' || rel === 'generates')
        ? ['Naturally supportive decade for taking initiative.', 'Easier access to resources, allies, and opportunities.', 'Good window for starting new ventures.']
        : (rel === 'drains')
        ? ['Strong decade for visible output and creative work.', 'Achievements from this decade tend to be tangible.', 'Good window for building a public track record.']
        : ['Builds leadership and structural discipline.', 'Effective decade for taking on authority or management roles.', 'Develops resilience that compounds into later cycles.'],
        (rel === 'same' || rel === 'generates')
        ? ['本十年天然利于主动出击。', '更容易获得资源、盟友与机遇。', '适合开创新事业的窗口期。']
        : (rel === 'drains')
        ? ['本十年适合产出与创意工作，成就显著。', '此十年的成果往往看得见、摸得着。', '适合建立公众口碑与业绩记录的窗口期。']
        : ['有助建立领导力与组织纪律。', '适合承担权威或管理职责的十年。', '培养的韧性将在后续周期持续发挥作用。']);
      neg = bt((rel === 'same' || rel === 'generates')
        ? ['Support can occasionally tip into over-reliance on others.', 'Ease may reduce urgency to build independent skills.', 'Still requires follow-through to convert opportunity into results.']
        : (rel === 'drains')
        ? ['High output can lead to burnout without proper pacing.', 'Energy expenditure needs matching recovery time.', 'Risk of overcommitting during a naturally productive window.']
        : ['Can feel more effortful than adjacent cycles.', 'Requires more conscious energy management.', 'Benefits from extra support structures during this decade.'],
        (rel === 'same' || rel === 'generates')
        ? ['助力有时可能演变为对他人的过度依赖。', '顺遂可能降低培养独立能力的紧迫感。', '仍需切实执行，才能将机遇转化为成果。']
        : (rel === 'drains')
        ? ['若不善加调节，高产出容易导致过度消耗。', '精力付出需搭配相应的休养恢复。', '在天然高产的窗口期，有过度承诺的风险。']
        : ['相较其他周期可能感觉更费力。', '需要更主动、更有意识地管理精力。', '本十年若有额外支持系统，将大有裨益。']);
      cau = bt(['Pace major decisions to this cycle\'s natural rhythm rather than forcing an unrelated timeline.', 'Revisit this reading if birth time precision is ever refined.', 'Use alongside the surrounding cycles for a fuller decade-by-decade trajectory.'],
        ['重大决策宜配合本周期的自然节奏，不宜强行套用不相关的时间表。', '若出生时间日后有更精确的修正，建议重新解读此分析。', '宜结合前后周期一并参考，方能掌握完整的十年运势脉络。']);
  } else if (type === 'family_compat') {
      // ENHANCEMENT (Children tab): pairwise family compatibility - reuses the same real Wu Xing +
      // clash/harmony mechanics as the Life/Business Partner compatibility reading.
      const other = extraData.otherP; const otherLabel = extraData.otherLabel; const cr = extraData.compatResult;
      const elemNames = ['Wood','Fire','Earth','Metal','Water']; const elemNamesZH = {Wood:'木',Fire:'火',Earth:'土',Metal:'金',Water:'水'};
      const e1 = elemNames[Math.floor(p.bazi.dayStemIdx/2)]; const e2 = elemNames[Math.floor(other.bazi.dayStemIdx/2)];
      chars = bt(`Day Master comparison: ${e1} vs ${e2}. Overall compatibility score: ${cr.score}%.`,
        `日主对比：${elemNamesZH[e1]} 对 ${elemNamesZH[e2]}。整体契合度评分：${cr.score}%。`);
      exp = bt(`This reading combines Day Master elemental relationship, Day Branch clash/harmony, and Kua group alignment between the two charts. ${cr.breakdown ? cr.breakdown.join(' ') : ''}`,
        `此分析综合双方日主五行关系、日支相冲相合，以及卦命组别的契合程度进行评估。${cr.breakdown ? cr.breakdown.join(' ') : ''}`);
      traits = cr.score >= 80
        ? bt(`A strongly compatible pairing with ${otherLabel} - natural ease and mutual support are likely.`, `与${otherLabel}的契合度甚高，彼此间自然融洽、互相扶持的可能性大。`)
        : cr.score >= 65
        ? bt(`A workable pairing with ${otherLabel} with some areas requiring conscious effort.`, `与${otherLabel}的契合度尚可，部分方面需要用心经营。`)
        : bt(`A pairing with ${otherLabel} that carries real friction points worth being aware of.`, `与${otherLabel}的契合关系存在需要留意的摩擦点。`);
      hl = bt([`Compatibility score: ${cr.score}%.`, `Day Master relationship: ${e1} & ${e2}.`, cr.score>=80?'Above-average natural resonance.':'Room to actively build rapport.'],
        [`契合度评分：${cr.score}%。`, `日主关系：${elemNamesZH[e1]} 与 ${elemNamesZH[e2]}。`, cr.score>=80?'天然共鸣高于平均水平。':'仍有空间可主动培养默契。']);
      pos = bt(['Elemental and branch factors provide a concrete, chart-based starting point for the relationship.', 'Awareness of the dynamic allows more intentional nurturing.'],
        ['五行与地支因素为这段关系提供了具体、基于命盘的起点。', '了解彼此的互动模式，有助更用心地经营关系。']);
      neg = bt(['No chart reading substitutes for ongoing communication and effort.', 'Scores are a starting lens, not a fixed verdict.'],
        ['任何命盘分析都无法取代持续的沟通与努力。', '评分只是参考视角，并非绝对定论。']);
      cau = bt(['Use this as a conversation starter, not a label for the child.', 'Revisit as birth time precision or family circumstances evolve.'],
        ['请将此作为沟通的起点，而非为孩子贴标签。', '若出生时间有修正或家庭状况有变化，宜重新参考。']);
  } else if (type === 'family_overall') {
      const { overallFamilyScore, overallSiblingScore, childCount } = extraData;
      chars = bt(`Overall family compatibility across ${childCount} children: ${overallFamilyScore}%${overallSiblingScore!==undefined?`, with an average sibling-to-sibling compatibility of ${overallSiblingScore}%`:''}.`,
        `${childCount}位子女的整体家庭契合度：${overallFamilyScore}%${overallSiblingScore!==undefined?`，子女彼此间平均契合度为${overallSiblingScore}%`:''}。`);
      exp = bt(`This is the average of each child's compatibility with you and your Life Partner (where available), combined with how the children's charts relate to one another.`,
        `此评分为每位子女与您（及伴侣，如有提供）契合度的平均值，并综合子女彼此命盘之间的关系。`);
      traits = overallFamilyScore >= 80
        ? bt('A household with strong overall elemental harmony.', '整个家庭在五行层面呈现良好的和谐度。')
        : bt('A household with a healthy mix of harmony and areas to actively nurture.', '家庭整体呈现和谐与需要用心经营之处并存的格局。');
      hl = bt([`Overall family score: ${overallFamilyScore}%.`, childCount>1?`Sibling average: ${overallSiblingScore}%.`:'Single child profile on record.'],
        [`家庭整体评分：${overallFamilyScore}%。`, childCount>1?`子女间平均契合度：${overallSiblingScore}%。`:'目前仅记录一位子女资料。']);
      pos = bt(['Provides a helpful high-level view of family elemental dynamics.', 'Individual pairings above give more specific, actionable detail.'],
        ['为家庭五行动态提供有用的整体视角。', '上方各项个别配对分析提供更具体、可行动的细节。']);
      neg = bt(['An average score can mask meaningful variation between individual pairings.', 'Should be read alongside, not instead of, each individual reading.'],
        ['平均分可能掩盖各配对之间的实际差异。', '应与各项个别分析一并参考，而非取代之。']);
      cau = bt(['Treat as a reflective family-planning aid, not a deterministic forecast.', 'Update this reading whenever a new child profile is added.'],
        ['请将此作为家庭关系反思的参考工具，而非绝对预测。', '每次新增子女资料后，宜重新查看此分析。']);
  }

  // ENHANCEMENT (foundation for native-text PDF generation, replacing the earlier screenshot-based
  // approach): every branch above already computes its content as plain data - chars/exp/traits and
  // the hl/pos/neg/cau arrays - before this single, final line wraps them in HTML. Adding a raw-data
  // exit point here, with NO changes to any of the ~950 lines of type-specific content logic above,
  // lets the PDF generator pull the exact same data every section already computes directly, rather
  // than trying to parse it back out of rendered HTML/images. The live app's own rendering path
  // (rawOnly left false/undefined) is completely unaffected.
  if (rawOnly) return { title: extraData?.title || type.toUpperCase(), chars, exp, traits, hl, pos, neg, cau, opts };
  return renderStandardDeepAnalysis(extraData?.title || type.toUpperCase(), chars, exp, traits, hl, pos, neg, cau, opts);
}

// ENHANCEMENT (Phase 0, reported: "There should be short descriptions on every item on what it is,
// not just the header" - Luan Tou specifically had real descriptive text, but it only ever appeared
// inside the full "Deep Analysis" expansion, with nothing visible next to the header itself in the
// compact/summary view). This pulls just the short descriptive sentence (the exact same "chars" text
// a topic's own generateDeepAnalysisData branch already writes) so it can be shown inline next to a
// header WITHOUT hand-duplicating that text anywhere - the deep-analysis branch above stays the single
// source of truth for what a topic's short description says; this only surfaces it in a second place.
function getTopicShortDescription(type, p, extraData = null) {
  const raw = generateDeepAnalysisData(type, p, extraData, true);
  return (raw && raw.chars) ? raw.chars : '';
}

// BUG 11 FIX: Astro Forecast split into Current Year + following 3 years, each with its own 7-part deep analysis
// ENHANCEMENT (this round): replaces the honestly-labeled-but-numerological placeholder with genuine
// astronomical transit computation - see the verified planetary position engine in
// engine-metaphysics.js for the full accuracy/verification notes. For each of the next 4 years, this
// checks the REAL current geocentric positions of the 5 outer planets against the person's REAL natal
// Sun position, reporting actual major aspects found (or honestly reporting when none are found within
// orb, which is the more common case - most planet/year pairings will show no aspect).
function generateAstroForecastHTML(p) {
  const nowY = new Date().getFullYear();
  const natalSunLon = computeNatalSunLongitude(p.bazi.birthMomentUTC);
  let html = '';
  for (let i = 0; i < 4; i++) {
    const yr = nowY + i;
    const label = i === 0 ? bt(`${yr} (Current Year)`, `${yr}年（本年度）`) : `${yr}`;
    const report = computeYearlyTransitReport(natalSunLon, yr);
    const aspectLines = report.aspects.map(a => {
      const info = OUTER_PLANET_INFO[a.planet];
      return { planet: bt(info.en, info.zh), aspect: bt(a.name, a.nameZh), theme: bt(info.themeEN, info.themeZH), orb: a.orbUsed };
    });
    const hasAspects = aspectLines.length > 0;
    const chars = hasAspects
      ? bt(`${label}: transiting ${aspectLines.map(a => `${a.planet} (${a.aspect})`).join(', ')} to your natal Sun.`, `${label}：行运${aspectLines.map(a => `${a.planet}（${a.aspect}）`).join('、')}对本命太阳形成相位。`)
      : bt(`${label}: no major transiting aspect from the outer planets to your natal Sun this year (within standard orbs).`, `${label}：本年外行星行运与本命太阳未形成主要相位（在标准容许度范围内）。`);
    const exp = hasAspects
      ? bt(`Computed from your actual natal Sun position and the real geocentric positions of Jupiter, Saturn, Uranus, Neptune, and Pluto for ${yr} (evaluated at a mid-year snapshot, since these planets move slowly enough that one point in the year is representative). ${aspectLines.map(a => `${a.planet}'s ${a.aspect.toLowerCase()} relates to ${a.theme}.`).join(' ')}`,
          `依您真实的本命太阳位置，及木星、土星、天王星、海王星、冥王星于${yr}年的真实地心位置计算而得（以年中为代表性快照，因这些行星移动缓慢，年中一点已具代表性）。${aspectLines.map(a => `${a.planet}的${a.aspect}与${a.theme}相关。`).join('')}`)
      : bt(`This is a genuine finding, not a gap: exact aspects between slow-moving outer planets and a fixed natal point are relatively rare events (most years show none for most people). Absence of an aspect this year is accurate information, not a limitation of the calculation.`,
          `此为真实的推算结果，而非计算缺漏：缓慢移动的外行星与固定本命点形成相位本属较罕见的事件（大多数人在大多数年份并无相位形成）。本年未形成相位属准确信息，并非计算能力的局限。`);
    const traits = hasAspects
      ? bt(`The closest aspect this year is ${aspectLines[0].planet} ${aspectLines[0].aspect.toLowerCase()} (within ${aspectLines[0].orb.toFixed(1)}° of exact) - the tighter the orb, the more precisely-timed the influence.`, `本年最接近的相位为${aspectLines[0].planet}${aspectLines[0].aspect}（容许度${aspectLines[0].orb.toFixed(1)}°）——容许度越小，代表影响的时机越精确。`)
      : bt(`Years without a major aspect are typically quieter, more baseline periods rather than ones with a strong externally-triggered theme.`, `未形成主要相位的年份，通常属于较平稳的基线期，而非受外在强烈触发主题影响的年份。`);
    const hl = hasAspects
      ? aspectLines.map(a => bt(`${a.planet} forms a ${a.aspect} to your natal Sun this year.`, `${a.planet}本年与您的本命太阳形成${a.aspect}。`))
      : [bt('No major outer-planet aspect to your natal Sun this year.', '本年外行星与本命太阳无主要相位。'), bt('A genuinely quieter year by this specific measure.', '就此特定指标而言，属较平静的一年。'), bt('Other systems in this app (BaZi Da Yun, annual pillar) may still show significant activity.', '本应用中其他体系（如八字大运、流年）仍可能显示重要变化。')];
    const pos = hasAspects
      ? [bt('Grounded in your real natal Sun position and real planetary positions for this specific year - not a template.', '扎根于您真实的本命太阳位置及本年真实的行星位置——并非套用模板。'), bt('Trine and sextile aspects (if present) traditionally read as easier, flowing influences.', '三分相与六分相（如出现）传统上被解读为较顺畅、流动的影响。'), bt('Gives a genuine, verifiable astronomical basis, unlike a generic yearly theme.', '相较于泛用的年度主题，此处提供真实、可验证的天文依据。')]
      : [bt('An honest "nothing major here" is more useful than a manufactured theme.', '诚实的「本年无重大相位」比刻意编造的主题更具参考价值。'), bt('Quieter years are a normal, expected part of any real astrological cycle.', '平静的年份是任何真实占星周期中正常且预期的一部分。'), bt('Frees attention to focus on other systems in this app for that year.', '可将关注重心转向本应用中该年度的其他分析体系。')];
    const neg = hasAspects
      ? [bt('Only the Sun (not Moon, Ascendant, or other natal planets) is checked - a fuller chart would surface additional aspects.', '仅核对太阳（未包含月亮、上升点或其他本命行星）——完整命盘可能揭示更多相位。'), bt('Square and opposition aspects (if present) traditionally read as more challenging, not automatically negative.', '四分相与对分相（如出现）传统上被解读为较具挑战性，但并非必然为负面。'), bt('A wide orb (up to 8°) means the influence may be felt as a general period, not a single precise date.', '较宽的容许度（最高8°）意味着影响可能表现为一段时期，而非单一精确日期。')]
      : [bt('Absence of a Sun aspect doesn\'t mean nothing is happening - it only means this ONE specific measure is quiet.', '太阳无相位并不代表毫无变化——仅代表此单一特定指标处于平静状态。'), bt('A fuller natal chart (Moon, Ascendant, other planets) might still show transits this measure doesn\'t capture.', '更完整的本命盘（月亮、上升点、其他行星）仍可能显示此指标未涵盖的行运。'), bt('Real astrology involves far more than one natal point - this is deliberately narrow in scope.', '真正的占星学涉及远不止一个本命点——此处范围经刻意限缩。')];
    const cau = [bt('This checks only your natal Sun - not a full chart reading. Treat as one data point, not a complete forecast.', '此处仅核对本命太阳——并非完整命盘解读。请视为单一参考数据，而非完整预测。'), bt('Orbs (tolerances) used here are a specific, moderate convention - other astrologers may use tighter or wider orbs and reach different conclusions.', '此处采用特定、中等宽度的容许度惯例——其他占星师可能采用更紧或更宽的容许度，并得出不同结论。'), bt('Cross-check any significant year against your real BaZi Da Yun/annual pillar reading elsewhere in this app.', '重大年份宜与本应用中真实的八字大运／流年分析交叉核对。')];
    html += renderStandardDeepAnalysis(
      hasAspects ? bt(`${label} - Real Transit: ${aspectLines.map(a=>a.planet).join(', ')}`, `${label} - 真实行运：${aspectLines.map(a=>a.planet).join('、')}`) : bt(`${label} - No Major Aspect`, `${label} - 无主要相位`),
      chars, exp, traits, hl, pos, neg, cau
    );
  }
  return html;
}

// ============================================================
// ENHANCEMENT (requested directly: "go deeper for the western astrology section... chart out all
// planets into a natal chart and provide a natal reading" / "provide an annual deep reading... 5-tier
// scale... based on the movements of the planets and how it impacts the natal chart" / "provide a
// monthly deep reading... same 5-tier scale"). Three new renderers, backed by the real computation in
// engine-metaphysics.js (computeFullNatalChart / computeNatalAspectGrid / computeAnnualDeepReading /
// computeMonthlyDeepReading) - see the honesty notes above each of those for exactly what is and is
// not computed (no Ascendant/houses; see the natal deep-analysis branch above for the full disclosure).
// ============================================================

// Full Natal Chart: a plain data table of all 12 natal points (the 10 classical planets plus the North
// and South Node, the "eclipse" axis) - see the SVG wheels above, which now also plot every one of these
// 12 points directly (see fullChartMarkersSVG in engine-metaphysics.js) - followed by
// the deep-analysis card covering characteristics/career/industry/luck/health/relationships/children.
function generateNatalFullChartHTML(p) {
  if (!p?.bazi?.birthMomentUTC) return '';
  const natalChart = computeFullNatalChart(p.bazi.birthMomentUTC);
  // ENHANCEMENT (requested directly: real Ascendant-based houses) - null for any profile without a
  // birth latitude on file yet (see computeNatalHouses in engine-metaphysics.js); handled honestly below
  // by simply omitting the House column rather than showing a fabricated/defaulted value.
  const pointHouses = p?.houses ? computeNatalPointHouses(natalChart, p.houses) : null;
  const rows = NATAL_ASPECT_PLANET_ORDER.map(k => {
    const info = PLANET_INFO_FULL[k];
    const sign = natalChart[k].sign;
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #eee;font-size:11px"><span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:${info.color};color:#fff;font-size:11px;font-weight:bold;margin-right:6px">${info.glyph}</span>${bt(info.en, info.zh)}</td>
      <td style="padding:4px 8px;border:1px solid #eee;font-size:11px;font-weight:600">${bt(sign.en, sign.zh)}</td>
      ${pointHouses ? `<td style="padding:4px 8px;border:1px solid #eee;font-size:11px;text-align:center">${pointHouses[k]}</td>` : ''}
      <td style="padding:4px 8px;border:1px solid #eee;font-size:10px;color:var(--muted)">${bt(info.themeEN, info.themeZH)}</td>
    </tr>`;
  }).join('');
  const houseSummaryRows = p?.houses ? Object.keys(HOUSE_LIFE_AREAS).map(hNum => {
    const area = HOUSE_LIFE_AREAS[hNum];
    const occupants = NATAL_ASPECT_PLANET_ORDER.filter(k => pointHouses[k] === Number(hNum)).map(k => PLANET_INFO_FULL[k].glyph).join(' ') || '-';
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #eee;font-size:11px;text-align:center;font-weight:600">${hNum}</td>
      <td style="padding:4px 8px;border:1px solid #eee;font-size:10px;color:var(--muted)">${bt(area.en, area.zh)}</td>
      <td style="padding:4px 8px;border:1px solid #eee;font-size:12px;text-align:center">${occupants}</td>
    </tr>`;
  }).join('') : '';
  const aspects = computeNatalAspectGrid(natalChart);
  const topAspectRows = aspects.slice(0, 8).map(a => {
    const pa = PLANET_INFO_FULL[a.a], pb = PLANET_INFO_FULL[a.b];
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #eee;font-size:11px">${bt(pa.en, pa.zh)}</td>
      <td style="padding:4px 8px;border:1px solid #eee;font-size:11px;text-align:center">${bt(a.name, a.nameZh)}</td>
      <td style="padding:4px 8px;border:1px solid #eee;font-size:11px">${bt(pb.en, pb.zh)}</td>
      <td style="padding:4px 8px;border:1px solid #eee;font-size:10px;text-align:center;color:var(--muted)">${a.orbUsed.toFixed(1)}°</td>
    </tr>`;
  }).join('');
  return `
    ${p?.houses ? `<div style="font-size:11px;margin-bottom:6px"><strong>${bt('Ascendant (Rising Sign)','上升星座')}:</strong> ${bt(p.houses.ascendantSign.en, p.houses.ascendantSign.zh)} &nbsp;<span style="color:var(--muted);font-size:10px">${bt('- Equal House system from the true Ascendant', '——采用「等宫制」，以真实上升点为基准')}</span></div>`
      : `<div style="font-size:11px;color:var(--muted);margin-bottom:6px">${bt('Ascendant/houses unavailable: no birth latitude on file for this profile yet - add one via the country/city selector to unlock this.', '上升星座／宫位暂无法计算：此档案尚未记录出生纬度——请透过国家／城市选单补充以启用此功能。')}</div>`}
    <div style="overflow-x:auto;margin:10px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#f4f4f4"><th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('Planet','行星')}</th><th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('Sign','星座')}</th>${pointHouses ? `<th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('House','宫位')}</th>` : ''}<th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('Theme','主题')}</th></tr>
        ${rows}
      </table>
    </div>
    ${aspects.length ? `<div style="font-size:11px;color:var(--muted);margin:6px 0 2px">${bt('Tightest natal aspects (where two planets\' energies blend most strongly):', '最紧密的本命相位（两行星能量交融最强之处）：')}</div>
    <div style="overflow-x:auto;margin-bottom:10px">
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#f4f4f4"><th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('Planet A','行星A')}</th><th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('Aspect','相位')}</th><th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('Planet B','行星B')}</th><th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('Orb','容许度')}</th></tr>
        ${topAspectRows}
      </table>
    </div>` : ''}
    ${houseSummaryRows ? `<div style="font-size:11px;color:var(--muted);margin:6px 0 2px">${bt('The 12 houses (Equal House system) and which of your natal points fall in each:', '十二宫位（等宫制）及各本命点所落入的宫位：')}</div>
    <div style="overflow-x:auto;margin-bottom:10px">
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#f4f4f4"><th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('House','宫位')}</th><th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('Life Area','生活领域')}</th><th style="padding:4px 8px;border:1px solid #eee;font-size:10px">${bt('Points Here','落入本命点')}</th></tr>
        ${houseSummaryRows}
      </table>
    </div>` : ''}
    ${generateDeepAnalysisData('astro_natal_full', p, { title: 'Full Natal Chart Deep Reading' })}
  `;
}

// Annual Deep Reading: current year + the following 2 years (3 total, per the request), each with a
// visible 5-tier badge and its own deep-analysis card. See computeAnnualDeepReading above.
function generateAnnualDeepReadingHTML(p) {
  if (!p?.bazi?.birthMomentUTC) return '';
  const reading = computeAnnualDeepReading(p, 3);
  // ENHANCEMENT (house activation, requested/prioritized directly: "Houses into Annual/Monthly astrology
  // first"): honestly disclose whether this profile's aspects are also weighted/annotated by real house
  // placement (requires a birth latitude on file - see computeNatalHouses) or, for an older profile with
  // no birth latitude, fall back to the pre-house sign/aspect-only behavior with no fabricated house data.
  const houseNote = reading.houses
    ? bt('Each aspect below also names the real natal house it activates, and angular houses (1/4/7/10) carry slightly more weight than succedent/cadent ones - see the notes on each card.', '以下每个相位亦标注其所触动的真实本命宫位，且角宫（第1、4、7、10宫）权重略高于续宫／果宫——详见各卡片说明。')
    : bt('Add a birth latitude (re-select your country/city with time) to unlock house-level detail for this reading - currently based on sign/aspect only.', '请重新选择您的出生国家／城市并填写出生时间以补充纬度，即可启用宫位层级的细节——目前仅依星座／相位计算。');
  return `<div class="calc-box" style="font-size:11px;margin-bottom:8px">${houseNote}</div>` + reading.years.map(yearData => {
    const goodCount = yearData.aspects.filter(a => a.weightedScore > 0.5).length;
    const badCount = yearData.aspects.filter(a => a.weightedScore < -0.5).length;
    return `<article class="reading">
      <span class="pill">${trPill(`${yearData.year} Annual Deep Reading`)}</span>
      <div style="display:flex;align-items:center;gap:10px;margin:8px 0">
        <span style="display:inline-block;color:#fff;background:${yearData.tier.color};padding:3px 12px;border-radius:10px;font-size:12px;font-weight:700">${bt(yearData.tier.en, yearData.tier.zh)}</span>
        <span style="font-size:11px;color:var(--muted)">${bt(`${goodCount} favourable, ${badCount} cautionary aspect(s) found`, `发现${goodCount}个吉相、${badCount}个慎相`)}</span>
      </div>
      ${generateDeepAnalysisData('astro_annual_deep', p, { title: `${yearData.year} Annual Deep Reading`, yearData })}
    </article>`;
  }).join('') + `<div style="margin-top:4px">${renderRatingLegend(WESTERN_5TIER_LABELS)}${calculatedAsOfLine()}</div>`;
}

// Monthly Deep Reading: current year + the following year (24 months, per the request), rendered as a
// table (same visual pattern as the existing 3-Year Monthly Da Yun/Astrology-Match tables), then one
// summary deep-analysis card. See computeMonthlyDeepReading above.
function generateMonthlyDeepReadingHTML(p) {
  if (!p?.bazi?.birthMomentUTC) return '';
  const forecast = computeMonthlyDeepReading(p, 24);
  const rows = forecast.months.map(m => {
    const isBest = m === forecast.best, isWorst = m === forecast.worst;
    const topHighlight = m.highlights[0];
    const houseSuffixEN = topHighlight?.natalHouse ? ` (House ${topHighlight.natalHouse})` : '';
    const houseSuffixZH = topHighlight?.natalHouse ? `（第${topHighlight.natalHouse}宫）` : '';
    const reasonEN = topHighlight ? `${m.transitSign.en} transit vs natal ${PLANET_INFO_FULL[topHighlight.natalKey].en}${houseSuffixEN}` : bt('No standout monthly aspect', 'No standout monthly aspect');
    const reasonZH = topHighlight ? `行运${m.transitSign.zh}对本命${PLANET_INFO_FULL[topHighlight.natalKey].zh}${houseSuffixZH}` : '无突出的月度相位';
    return `<tr style="${isBest ? 'background:#e8f5e9' : isWorst ? 'background:#fdeaea' : ''}">
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px;text-align:center">${m.year}</td>
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px;text-align:center">${String(m.month).padStart(2,'0')}</td>
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px;text-align:center">${bt(m.transitSign.en, m.transitSign.zh)}</td>
      <td style="padding:4px 6px;border:1px solid #eee;text-align:center"><span style="display:inline-block;color:#fff;background:${m.tier.color};padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700">${bt(m.tier.en, m.tier.zh)}</span></td>
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt(reasonEN, reasonZH)}</td>
    </tr>`;
  }).join('');
  const houseNote = forecast.houses
    ? bt('The "Top Influence" column also names the real natal house each highlight activates, and angular houses (1/4/7/10) carry slightly more weight than succedent/cadent ones.', '「主要影响」栏亦标注每个重点所触动的真实本命宫位，且角宫（第1、4、7、10宫）权重略高于续宫／果宫。')
    : bt('Add a birth latitude (re-select your country/city with time) to unlock house-level detail for this reading - currently based on sign/aspect only.', '请重新选择您的出生国家／城市并填写出生时间以补充纬度，即可启用宫位层级的细节——目前仅依星座／相位计算。');
  return `<article class="reading">
    <span class="pill">${trPill('Monthly Deep Reading (Current + Next Year)')}</span>
    <div class="calc-box" style="font-size:11px">${bt('Every one of the next 24 months, scored against your full natal chart (all 12 points, including the North/South Node) by blending that year\'s outer-planet-and-Node backdrop with the transiting Sun\'s own monthly sign.', '未来24个月，逐月依您完整本命盘（全部12个本命点，含北／南交点）评分，结合该年份的外行星与交点背景，及当月太阳行运星座。')}</div>
    <div class="calc-box" style="font-size:11px">${houseNote}</div>
    <div style="overflow-x:auto;margin-top:8px">
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#f4f4f4">
          <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Year','年')}</th>
          <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Month','月')}</th>
          <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Transiting Sign','行运星座')}</th>
          <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Tier','评级')}</th>
          <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Top Influence','主要影响')}</th>
        </tr>
        ${rows}
      </table>
    </div>
    ${renderRatingLegend(WESTERN_5TIER_LABELS)}
    ${calculatedAsOfLine()}
    ${generateDeepAnalysisData('astro_monthly_deep', p, { title: 'Monthly Deep Reading (Current + Next Year)', forecast })}
  </article>`;
}

// ============================================================
// Cross-System Profile Synthesis (requested directly, completed per "proceed to complete all pending
// items"): renders computeCrossSystemSynthesis's 3-domain output (Career/Wealth/Relationships) as one
// side-by-side card per domain, with each system's own real, already-computed signal named explicitly -
// see the honesty note above computeCrossSystemSynthesis for exactly what this reading does and does not
// claim (no fabricated cross-framework "agreement", no blended score).
// ============================================================
function zwdsStarListHTML(stars) {
  if (!stars.length) return `<span style="color:var(--muted)">${bt('(no major/minor star occupies this palace directly)', '（此宫无主星／辅星坐守）')}</span>`;
  return `<ul style="margin:4px 0 0;padding-left:18px;font-size:11px">${stars.map(s =>
    `<li><strong>${bt(s.nameEN, s.nameZH)}</strong>${s.isMajor ? '' : bt(' (minor)', '（辅星）')}: ${bt(s.meaning.en, s.meaning.zh)}</li>`
  ).join('')}</ul>`;
}
function generateCrossSystemSynthesisHTML(p) {
  const syn = computeCrossSystemSynthesis(p);
  if (!syn) return '';
  const domainCard = (domainKey, domainLabel, ziweiPalaceLabel) => {
    const d = syn[domainKey];
    const baziLine = domainKey === 'relationships'
      ? (d.bazi.dayBranchTenGods.length
          ? `${bt('Your Day Branch', '您的日支')} (${d.bazi.dayBranchCN}) - ${bt('traditionally your "Spouse Palace" - hidden stems here', '传统上为您的「夫妻宫」——此处的藏干')}: ${d.bazi.dayBranchTenGods.map(x => bt(x.tenGod.en, x.tenGod.cn)).join(bt(', ', '、'))}.`
          : bt('Your Day Branch has no hidden stems on record.', '您的日支暂无藏干记录。'))
      : (d.bazi.count > 0
          ? bt(`${d.bazi.count} ${TEN_GOD_FAMILY_THEME[domainKey === 'career' ? 'officer' : 'wealth'].en.split(',')[0]}-family Ten God${d.bazi.count===1?'':'s'} (${d.bazi.gods.map(g=>g.en).join(', ')}) found across your chart - traditionally associated with ${d.bazi.theme.en}.`,
             `您的命盘中找到${d.bazi.count}个${TEN_GOD_FAMILY_THEME[domainKey === 'career' ? 'officer' : 'wealth'].zh.split('，')[0]}相关十神（${d.bazi.gods.map(g=>g.cn).join('、')}）——传统上与${d.bazi.theme.zh}相关。`)
          : bt(`No ${domainKey === 'career' ? 'Officer' : 'Wealth'}-family Ten God appears in your chart. Your chart's own dominant Ten God family is instead ${d.bazi.dominantFamily} (${d.bazi.dominantTheme.en}) - by this traditional lens, ${domainLabel.en.toLowerCase()} likely runs more through that theme than through this specific family.`,
             `您的命盘中未出现${domainKey === 'career' ? '官杀' : '财星'}类十神。您命盘中真正主导的十神类别为${{officer:'官杀',wealth:'财星',output:'食伤',resource:'印枭',peer:'比劫'}[d.bazi.dominantFamily]}（${d.bazi.dominantTheme.zh}）——依此传统视角，${domainLabel.zh}方面更可能透过此主题展现，而非此特定类别。`));
    // NOTE: for the Wealth domain, d.qmdj is always populated (the natal Wealth Palace's own Door is a
    // dedicated, always-present QMDJ signal); for Career/Relationships, d.qmdj is only populated when
    // this profile's own Life Door happens to map onto that specific domain (QMDJ_DOOR_TO_SYNTHESIS_DOMAIN)
    // - otherwise the honest fallback below names the Life Door's own (differently-scoped) domain instead.
    const qmdjLine = domainKey === 'wealth'
      ? bt(`Your natal Wealth Palace (Palace ${d.qmdj.wealthPalace}) carries the ${d.qmdj.door} door${d.qmdj.domain ? `, traditionally governing ${d.qmdj.domain.en}` : ''}.${d.qmdj.lifeDoorAlsoMaps ? ' Your Life Door independently maps to Wealth too - two separate QMDJ signals in agreement.' : ''}`,
          `您的本命财帛宫（第${d.qmdj.wealthPalace}宫）落有${d.qmdj.door}${d.qmdj.domain ? `，传统上主管${d.qmdj.domain.zh}` : ''}。${d.qmdj.lifeDoorAlsoMaps ? '您的命宫之门亦同时指向财运——两个QMDJ信号相互呼应。' : ''}`)
      : d.qmdj
        ? bt(`Your natal Life Door (${d.qmdj.door}) traditionally governs ${d.qmdj.domain ? d.qmdj.domain.en : 'a different domain'} - it maps directly onto ${domainLabel.en} for you.`,
            `您的本命命宫之门（${d.qmdj.door}）传统上主管${d.qmdj.domain ? d.qmdj.domain.zh : '其他领域'}——对您而言直接对应${domainLabel.zh}。`)
        : bt(`Your natal Life Door (${syn.qmdjLifeDoorGeneral.door}) does not map cleanly onto ${domainLabel.en} for this synthesis - its own traditional domain is ${syn.qmdjLifeDoorGeneral.domain ? syn.qmdjLifeDoorGeneral.domain.en : 'not one of this reading\'s 3 categories'}.`,
            `您的本命命宫之门（${syn.qmdjLifeDoorGeneral.door}）在本综合分析的三大类别中并无明确对应——其自身的传统主管领域为${syn.qmdjLifeDoorGeneral.domain ? syn.qmdjLifeDoorGeneral.domain.zh : '本分析三大类别之外的领域'}。`);
    const westernLine = domainKey === 'career'
      ? bt(`Sun Sign ${d.western.sign}: ${d.western.careerTraits.en} - classically suited toward ${d.western.careers.en}.`, `太阳星座${d.western.sign}：${d.western.careerTraits.zh}——传统上适合${d.western.careers.zh}。`)
      : domainKey === 'relationships'
        ? bt(`Sun Sign ${d.western.sign}: ${d.western.relationshipStyle.en}`, `太阳星座${d.western.sign}：${d.western.relationshipStyle.zh}`)
        : bt(`Natal Venus in ${d.western.venusSign} (${d.western.venusElement}): a financial/spending temperament that is classically ${d.western.moneyStyle.en}.`, `本命金星位于${d.western.venusSign}（${d.western.venusElement}元素）：传统上其财务／消费性情倾向为${d.western.moneyStyle.zh}。`);
    return `<div style="margin-bottom:14px;padding:10px;border:1px solid #eee;border-radius:8px">
      <div style="font-weight:700;color:var(--plum);margin-bottom:6px">${bt(domainLabel.en, domainLabel.zh)}</div>
      <div style="font-size:11px;margin-bottom:6px"><strong>${bt('BaZi (Ten Gods):','八字（十神）：')}</strong> ${baziLine}</div>
      <div style="font-size:11px;margin-bottom:6px"><strong>${bt(`Zi Wei Dou Shu (${ziweiPalaceLabel.en}):`, `紫微斗数（${ziweiPalaceLabel.zh}）：`)}</strong> ${zwdsStarListHTML(d.ziwei.stars)}</div>
      <div style="font-size:11px;margin-bottom:6px"><strong>${bt('Qi Men Dun Jia:','奇门遁甲：')}</strong> ${qmdjLine}</div>
      <div style="font-size:11px"><strong>${bt('Western Astrology:','西方占星：')}</strong> ${westernLine}</div>
    </div>`;
  };
  return `<article class="reading">
    <div class="calc-box" style="font-size:11px;margin-bottom:10px">${bt('This lays out what BaZi (Ten Gods), Zi Wei Dou Shu (palace/star placement), Qi Men Dun Jia (Door domains), and Western astrology (Sun/Venus sign) each independently say about the same 3 real-world domains - side by side, for your own cross-reference. These are 4 structurally different traditions with no established cross-framework equivalence, so this deliberately does NOT claim they "agree" or blend them into one number - each system\'s own real, already-computed signal is shown as-is.', '本表并列呈现八字（十神）、紫微斗数（宫位／星曜配置）、奇门遁甲（门之主管领域）及西方占星（太阳／金星星座）针对同三大现实生活领域各自独立给出的解读，供您本人交叉参考。此四者为结构截然不同的体系，彼此间并无既定的跨体系对应关系，故本分析刻意不宣称其「一致」，亦不将其混合为单一数值——仅如实呈现各体系自身真实、已计算之信号。')}</div>
    ${domainCard('career', EZ('Career', '事业'), EZ('Career Palace 官禄宫', '官禄宫'))}
    ${domainCard('wealth', EZ('Wealth', '财富'), EZ('Wealth Palace 财帛宫', '财帛宫'))}
    ${domainCard('relationships', EZ('Relationships', '人际关系'), EZ('Spouse Palace 夫妻宫', '夫妻宫'))}
    ${generateDeepAnalysisData('cross_system_synthesis', p, { title: 'Cross-System Profile Synthesis', synthesis: syn })}
  </article>`;
}

// BUG 4 FIX: Ze Ri helpers - now genuinely BaZi-grounded, spans a full 6-tier auspicious <-> inauspicious
// spectrum (was previously "everyday auspicious"). Each candidate date's own Day Branch is calculated
// via the same sexagenary formula as the BaZi engine and checked for a Six Clash / Six Harmony against
// the profile's natal Day Branch, so genuinely bad days are surfaced, not just varying shades of good.
const ZERI_ACTIVITY_POOL_EN = ['Signing Contracts', 'Marriage & Union Ceremonies', 'Business Launch', 'Travel & Relocation', 'Property Transactions', 'Networking & Meetings', 'Medical Procedures (Non-Emergency)', 'Investment Decisions', 'Renovation Commencement', 'Public Announcements'];
const ZERI_ACTIVITY_POOL_ZH = ['签署合约', '婚嫁喜庆', '开业开张', '旅行搬迁', '房产交易', '社交会晤', '非紧急医疗', '投资决策', '装修动工', '公开宣布'];
const ZERI_AVOID_POOL_EN = ['Signing Contracts', 'Marriage & Union Ceremonies', 'Major Financial Decisions', 'Surgery/Medical Procedures', 'Litigation & Confrontation', 'Long-Distance Travel', 'Property Handover', 'Starting a New Job', 'Public Launches', 'Large Purchases'];
const ZERI_AVOID_POOL_ZH = ['签署合约', '婚嫁喜庆', '重大财务决策', '手术／医疗程序', '诉讼与对抗', '远程旅行', '物业交接', '开始新工作', '公开发布', '大额购置'];
const ZERI_ACTIVITY_POOL = ZERI_ACTIVITY_POOL_EN; // legacy alias, kept for any external reference
const ZERI_AVOID_POOL = ZERI_AVOID_POOL_EN;
function getSuitableActivities(dateObj) {
  const seed = dateObj.getDate() + (dateObj.getMonth() * 3);
  const pool = bt(ZERI_ACTIVITY_POOL_EN, ZERI_ACTIVITY_POOL_ZH);
  let picks = [];
  for (let i = 0; i < 3; i++) picks.push(pool[mod(seed + i * 3, pool.length)]);
  return picks;
}
function getUnsuitableActivities(dateObj) {
  const seed = dateObj.getDate() * 2 + (dateObj.getMonth() * 5) + 1;
  const pool = bt(ZERI_AVOID_POOL_EN, ZERI_AVOID_POOL_ZH);
  let picks = [];
  for (let i = 0; i < 3; i++) picks.push(pool[mod(seed + i * 3, pool.length)]);
  return picks;
}
// Day Branch for an arbitrary calendar date, using the same continuous 60-day cycle as the BaZi engine
function getDayBranchForDate(dateObj) {
  const epochDay = Math.floor(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()) / 86400000);
  const dayGanzhi = mod(epochDay + 17, 60);
  return mod(dayGanzhi, 12);
}
function classifyDateTier(dateObj, p) {
  // Base score spread across a full 0-11 range so both good AND bad days occur regularly
  let score = mod((p?.life || 5) + dateObj.getDate() + (dateObj.getMonth() + 1) * 5 + dateObj.getFullYear(), 12);
  // Real BaZi mechanic: check the date's own Day Branch against the profile's natal Day Branch
  if (p?.bazi) {
    const dateBranchIdx = getDayBranchForDate(dateObj);
    if (SIX_CLASH[p.bazi.dayBranchIdx] === dateBranchIdx) score = Math.min(score, 1); // force bad
    else if (SIX_HARMONY[p.bazi.dayBranchIdx] === dateBranchIdx) score = Math.max(score, 10); // force good
  }
  if (score <= 1) return 'Extremely Inauspicious';
  if (score <= 3) return 'Highly Inauspicious';
  if (score <= 5) return 'Inauspicious';
  if (score <= 7) return 'Auspicious';
  if (score <= 9) return 'Highly Auspicious';
  return 'Extremely Auspicious';
}
const ZERI_TIER_COLORS = {
  'Extremely Inauspicious': { color: '#7f0000', bg: '#fbe1e1' },
  'Highly Inauspicious':    { color: '#b71c1c', bg: '#fdeaea' },
  'Inauspicious':           { color: '#c62828', bg: '#fff0ee' },
  'Auspicious':             { color: '#2e7d32', bg: '#e8f5e9' },
  'Highly Auspicious':      { color: '#e65100', bg: '#fff3e0' },
  'Extremely Auspicious':   { color: '#6a1b9a', bg: '#f3e5f5' }
};
const ZERI_GOOD_TIERS = ['Auspicious', 'Highly Auspicious', 'Extremely Auspicious'];
const ZERI_TIER_LABEL_ZH = { 'Extremely Inauspicious':'极凶', 'Highly Inauspicious':'大凶', 'Inauspicious':'凶', 'Auspicious':'吉', 'Highly Auspicious':'大吉', 'Extremely Auspicious':'极吉' };
function trTier(tier) { return bt(tier, `${ZERI_TIER_LABEL_ZH[tier] || tier} / ${tier}`); }
function renderAuspiciousDatesList(startDateStr, tier, p) {
  const start = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();
  let matches = [];
  let cursor = new Date(start);
  for (let i = 0; i < 90 && matches.length < 10; i++) {
    const t = classifyDateTier(cursor, p);
    if (t === tier) matches.push({ date: new Date(cursor), tier: t });
    cursor.setDate(cursor.getDate() + 1);
  }
  if (!matches.length) return `<div style="padding:12px;color:var(--muted);font-size:12px">${bt(`No ${tier} dates found in the upcoming window. Try a different tier or start date.`, `在此时间范围内未找到「${trTier(tier)}」的日期，请尝试其他等级或起始日期。`)}</div>`;
  const c = ZERI_TIER_COLORS[tier];
  const isGood = ZERI_GOOD_TIERS.includes(tier);
  return matches.map(m => {
    const dStr = m.date.toLocaleDateString(lang === 'zh' ? 'zh-SG' : 'en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const acts = isGood ? getSuitableActivities(m.date) : getUnsuitableActivities(m.date);
    return `<div style="padding:10px 12px;margin:6px 0;border-radius:0 8px 8px 0;background:${c.bg};border-left:4px solid ${c.color}">
      <strong style="color:${c.color}">${dStr} — ${trTier(tier)}</strong>
      <div style="font-size:11px;color:var(--ink);margin-top:4px">${bt(isGood ? 'Suitable for' : 'Avoid / Unsuitable for', isGood ? '宜' : '忌')}: ${acts.join('、')}</div>
    </div>`;
  }).join('');
}

// BUG 4 FIX: Specific-date checker - rating badge + suitable/unsuitable activities + full 7-part deep analysis
function renderSpecificDateAnalysis(dateStr, p) {
  if (!dateStr) return `<div style="padding:12px;color:var(--muted);font-size:12px">${bt('Please select a date to analyse.', '请选择要分析的日期。')}</div>`;
  const dateObj = new Date(dateStr + 'T00:00:00');
  const tier = classifyDateTier(dateObj, p);
  const c = ZERI_TIER_COLORS[tier];
  const isGood = ZERI_GOOD_TIERS.includes(tier);
  const acts = isGood ? getSuitableActivities(dateObj) : getUnsuitableActivities(dateObj);
  const dStr = dateObj.toLocaleDateString(lang === 'zh' ? 'zh-SG' : 'en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const badge = `<div style="padding:10px 12px;margin-bottom:10px;border-radius:0 8px 8px 0;background:${c.bg};border-left:4px solid ${c.color}">
    <strong style="color:${c.color};font-size:14px">${dStr} — ${trTier(tier)}</strong>
    <div style="font-size:12px;color:var(--ink);margin-top:6px"><strong>${bt(isGood ? 'Suitable for' : 'Avoid / Unsuitable for', isGood ? '宜' : '忌')}:</strong> ${acts.join('、')}</div>
  </div>`;
  const deep = generateDeepAnalysisData('zeri_date', p, { title: bt(`Deep Analysis for ${dStr}`, `${dStr} 深度分析`), dateStr: dStr, tier });
  return badge + deep;
}

// Helper to resolve the correct stored profile object for a given prefix
function getProfileByPrefix(prefix) {
  const u = activeUser(); if (!u) return null;
  if (prefix === 'i') return u.profile;
  if (prefix === 'p') return u.partner;
  if (prefix === 'b') return u.businessPartner;
  if (typeof prefix === 'string' && prefix.startsWith('b2_')) {
    const idx = Number(prefix.slice(3));
    return (u.additionalBizPartners && u.additionalBizPartners[idx]) ? u.additionalBizPartners[idx] : null;
  }
  if (typeof prefix === 'string' && prefix.startsWith('c')) {
    const idx = Number(prefix.slice(1));
    return (u.children && u.children[idx]) ? u.children[idx] : null;
  }
  return null;
}

// ============================================================================
// UNIFIED MULTI-ROLE PEOPLE MODEL - sync helpers (this round)
// ============================================================================
// u.people (engine-core.js) is now the only thing ever hand-edited for "other people" on the account.
// Every EXISTING mutation point below (Add/Edit primary partner or business partner, add a child, add
// an additional business partner, add/remove a household occupant, remove any of the above, add/remove
// a vehicle) is routed through these helpers so u.people stays the true source of truth and the
// derived legacy fields (u.partner/u.businessPartner/u.additionalBizPartners/u.children/
// u.profile.bazhaiOccupants) - which the untouched prefix-based rendering/PDF/compatibility engine
// still reads - are always regenerated to match, via rebuildLegacySlotsFromPeople(u).
// Guarantees u.people exists and reflects any legacy data already on this user object. Normally
// migratePeopleForAllUsers() (engine-core.js) already did this once at app load, but a user object can
// also come into being AFTER that (e.g. set up directly by a test harness, or in principle any other
// code path that builds a user object with legacy fields already populated) - calling
// migratePeopleFromLegacy(u) here as well is a no-op once u.people exists, so this stays safe and cheap
// to call from every mutation/read site below.
function ensurePeopleArray(u) {
  if (u && !Array.isArray(u.people)) {
    if (typeof migratePeopleFromLegacy === 'function') migratePeopleFromLegacy(u);
    if (!Array.isArray(u.people)) u.people = [];
  }
  return u ? u.people : [];
}
// Returns the Nth (0-indexed, default 0) person in u.people order who carries `role`.
function findPersonByRole(u, role, n) {
  const matches = (u?.people || []).filter(p => (p.roles || []).includes(role));
  return matches[n || 0] || null;
}
// Add/Edit a "single primary slot" legacy field (Life Partner, or the core/primary Business Partner):
// updates the existing role-tagged person in place if one exists, else creates a new one.
function syncLegacyPrimaryToPeople(u, role, rawRecord) {
  if (!u) return;
  ensurePeopleArray(u);
  const existing = findPersonByRole(u, role, 0);
  if (existing) { Object.keys(rawRecord).forEach(k => { existing[k] = rawRecord[k]; }); }
  else { u.people.push(Object.assign({ id: makePersonId(), roles: [role] }, rawRecord)); }
  rebuildLegacySlotsFromPeople(u);
}
// Add a genuinely NEW, distinct person under a role that supports more than one (additional Business
// Partner #2/#3, a new Child, a new Household Occupant) - always appends.
function syncLegacyAppendToPeople(u, role, rawRecord) {
  if (!u) return;
  ensurePeopleArray(u);
  u.people.push(Object.assign({ id: makePersonId(), roles: [role] }, rawRecord));
  rebuildLegacySlotsFromPeople(u);
}
// Remove the Nth (0-indexed) person tagged `role`, in u.people order - strips just that one role tag,
// deleting the person outright only if they have no roles left afterward (so a multi-role person isn't
// silently deleted just because one of their legacy views was removed via its own old Remove button).
// Returns true if it found and removed a matching role tag (and regenerated the legacy fields from
// u.people). Returns false if u.people has no such entry - callers fall back to directly splicing the
// legacy array itself, purely as a defensive belt-and-suspenders for a legacy array ever being mutated
// by something other than these sync helpers (should not happen via this app's own UI once this round
// ships, since every mutation point now goes through them, but keeps every Remove button robust either
// way rather than silently doing nothing).
function syncLegacyRemoveByRole(u, role, n) {
  if (!u) return false;
  ensurePeopleArray(u);
  const matches = u.people.filter(p => (p.roles || []).includes(role));
  const person = matches[n || 0]; if (!person) return false;
  const idx = u.people.indexOf(person);
  person.roles = (person.roles || []).filter(r => r !== role);
  if (person.roles.length === 0) u.people.splice(idx, 1);
  rebuildLegacySlotsFromPeople(u);
  return true;
}

// ENHANCEMENT 3: Chinese Name vs BaZi deep analysis - percentage, explanation, and (if <85%) a
// suggested replacement given name that keeps the surname fixed and can optionally retain a
// specific character (for ancestral/generational naming conventions).
function renderChineseNameCompatBlock(p, prefix) {
  if (!p.chineseFirstName && !p.chineseLastName) return '';
  const nc = calculateChineseNameBaziCompat(p.chineseLastName, p.chineseFirstName, p.bazi.dayStemIdx);
  if (!nc) return '';
  const gridRows = nc.grids.map(g => ({
    label: g.name, value: `${g.value} (${bt(g.elem,{Wood:'木',Fire:'火',Earth:'土',Metal:'金',Water:'水'}[g.elem])}) - ${bt({favourable:'Favourable',neutral:'Neutral',unfavourable:'Unfavourable'}[g.rating],{favourable:'有利',neutral:'中性',unfavourable:'不利'}[g.rating])}`,
    color: g.rating === 'favourable' ? 'var(--success)' : g.rating === 'unfavourable' ? 'var(--danger)' : 'var(--warning)'
  }));
  const pct = nc.percent;
  const pctColor = scoreColor(pct);
  const explanation = bt(
    `Each of the 5 Grids (Tian/Ren/Di/Wai/Zong) is reduced to an element via its final digit, then rated against your Day Master (${nc.dmElem}): matching or resource-generating elements count as Favourable, the element that overcomes your Day Master counts as Unfavourable, everything else is Neutral. Your name scored ${nc.favCount} Favourable and ${nc.unfavCount} Unfavourable grid(s) out of 5. The percentage is calculated as a baseline of 55%, +45% scaled by the Favourable ratio, -30% scaled by the Unfavourable ratio, giving ${pct}%.`,
    `五格（天格/人格/地格/外格/总格）各自依末位数字换算为五行，再与您的日主（${bt(nc.dmElem,{Wood:'木',Fire:'火',Earth:'土',Metal:'金',Water:'水'}[nc.dmElem])}）比对：相同或生扶日主的五行视为「有利」，克制日主的五行视为「不利」，其余为「中性」。您的姓名共有 ${nc.favCount} 项有利、${nc.unfavCount} 项不利（满分5项）。百分比以55%为基准，按有利比例加最多45%，按不利比例减最多30%，得出 ${pct}%。`
  );
  let suggestionHTML = '';
  if (pct < 85) {
    const suggested = suggestChineseGivenName(p.chineseLastName, p.bazi.dayStemIdx, null);
    if (suggested) {
      const reached85 = suggested.percent >= 85;
      suggestionHTML = `<div class="calc-box" style="margin-top:10px;border-left-color:var(--success)">
        <strong>${bt('Suggested Given Name','建议改名（名字）')}:</strong> <span id="suggestedNameDisplay-${prefix}">${p.chineseLastName || ''}<span style="color:var(--success);font-weight:800">${suggested.name}</span> → ${suggested.percent}%</span><br>
        <span style="font-size:11px;color:var(--muted)" id="suggestedNameNote-${prefix}">${reached85
          ? bt(`This combination raises Favourable grids to ${suggested.favCount}/5 (vs your current ${nc.favCount}/5) by selecting characters whose stroke-count grids resolve to elements that support your ${nc.dmElem} Day Master, while keeping your surname unchanged.`, `此组合将有利格数提升至 ${suggested.favCount}/5（目前为 ${nc.favCount}/5），所选字的笔画五格换算五行均有助于您的${bt(nc.dmElem,{Wood:'木',Fire:'火',Earth:'土',Metal:'金',Water:'水'}[nc.dmElem])}日主，且姓氏保持不变。`)
          : bt(`This is the highest-scoring combination found from the character pool searched (${nc.favCount}/5 → ${suggested.favCount}/5 Favourable grids) - it does not reach the 85% comfort threshold, but is the best available while keeping your surname unchanged.`, `此为搜索范围内契合度最高的组合（有利格由 ${nc.favCount}/5 提升至 ${suggested.favCount}/5）——虽未达85%舒适阈值，但已是姓氏不变前提下的最佳选择。`)
        }</span>
        <button class="secondary btnSuggestAnotherName" data-prefix="${prefix}" data-shown="${suggested.name}" style="margin-top:8px;width:100%;padding:8px;background:#fff;border:1px solid var(--success);color:var(--success);border-radius:4px;font-weight:700;cursor:pointer;font-size:12px">${reached85 ? bt('🔄 Suggest Another Name (85%+)','🔄 建议其他姓名（85%以上）') : bt('🔄 Suggest Another Name (best available)','🔄 建议其他姓名（现有最佳）')}</button>
      </div>
      <div style="margin-top:10px;padding:10px;background:#fff;border:1px solid var(--line);border-radius:8px">
        <label class="field" style="margin:0"><span style="font-size:12px">${bt('Keep a specific character in the given name? (optional, e.g. for ancestral generation naming)','是否需保留名字中的特定字？（可选，例如遵循家族字辈）')}</span>
          <input type="text" id="retainChar-${prefix}" maxlength="1" placeholder="${bt('e.g. 家','例如：家')}" style="margin-top:5px;width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off">
        </label>
        <label class="field" style="margin:8px 0 0"><span style="font-size:12px">${bt('Position of that character in the given name','该字在名字中的位置')}</span>
          <select id="retainPos-${prefix}" style="margin-top:5px;width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off">
            <option value="1">${bt('1st character','第一字')}</option>
            <option value="2">${bt('2nd character','第二字')}</option>
          </select>
        </label>
        <button class="secondary btnSuggestNameRetain" data-prefix="${prefix}" style="margin-top:8px;width:100%;padding:10px;background:var(--plum);color:#fff;border:none;border-radius:4px;font-weight:700;cursor:pointer">${bt('Re-suggest Keeping This Character','保留此字重新建议')}</button>
        <div id="retainSuggestResult-${prefix}" style="margin-top:10px;display:none"></div>
      </div>`;
    }
  }
  const deep = renderStandardDeepAnalysis(
    bt('Chinese Name vs BaZi Deep Analysis','中文姓名与八字契合深度分析'),
    bt(`Your Chinese name "${[p.chineseLastName,p.chineseFirstName].filter(Boolean).join('')}" resolves to a ${pct}% compatibility against your BaZi Day Master (${nc.dmElem}).`, `您的中文姓名「${[p.chineseLastName,p.chineseFirstName].filter(Boolean).join('')}」与八字日主（${bt(nc.dmElem,{Wood:'木',Fire:'火',Earth:'土',Metal:'金',Water:'水'}[nc.dmElem])}）的契合度为 ${pct}%。`),
    explanation,
    bt(`${nc.favCount} of 5 grids actively support your Day Master; ${nc.unfavCount} work against it.`, `五格中有 ${nc.favCount} 项支持日主，${nc.unfavCount} 项与日主相克。`),
    [bt(`Overall compatibility: ${pct}%.`,`整体契合度：${pct}%。`), bt(`Zong Ge (总格, overall destiny grid) resolves to ${nc.grids[4].elem}.`,`总格换算五行为${bt(nc.grids[4].elem,{Wood:'木',Fire:'火',Earth:'土',Metal:'金',Water:'水'}[nc.grids[4].elem])}。`)],
    pct >= 85 ? [bt('Name elements reinforce your natal chart rather than working against it.','姓名五行有助于本命八字，而非相克。'), bt('No urgent need to consider a name change.','暂无迫切改名需要。')] : [bt('Even a partial match still provides some support.','即使部分契合，仍有一定助力。')],
    pct < 85 ? [bt('Below the 85% comfort threshold - the name may create some friction against your natal elements.','低于85%舒适阈值——姓名可能与本命五行产生摩擦。'), bt('Consider the suggested alternative below if open to a name adjustment.','若考虑调整姓名，可参考以下建议。')] : [bt('Keep monitoring if major life circumstances change.','若人生重大境遇改变，宜持续留意。')],
    pct < 85 ? [bt('A name change is a significant decision - weigh cultural/family factors alongside the numerology.','改名事关重大——请一并考虑家族传统等文化因素，而非仅依数字命理。')] : [bt('Re-assess if you take on additional Chinese names (e.g. religious or courtesy names).','若日后另取中文名（如教名、字号），宜重新评估。')]
  );
  return `<article class="reading">
    <span class="pill">${trPill('Chinese Name vs BaZi Compatibility')}</span>
    ${renderInfoRows([{ label: bt('Name Compatibility %','姓名契合度'), value: `${pct}%`, color: pctColor, bg: '#fff' }])}
    ${renderPillarStyleTable(gridRows)}
    ${suggestionHTML}
    ${deep}
  </article>`;
}

const ELEM_ZH = { Wood:'木', Fire:'火', Earth:'土', Metal:'金', Water:'水' };
function ratingLabel(r) { return bt({favourable:'Favourable',neutral:'Neutral',unfavourable:'Unfavourable'}[r], {favourable:'有利',neutral:'中性',unfavourable:'不利'}[r]); }
// Shared direction label dictionary (was previously duplicated as a local const inside renderSystemChart)
const DIR_LABEL_ZH = { North:'北', Northeast:'东北', East:'东', Southeast:'东南', South:'南', Southwest:'西南', West:'西', Northwest:'西北' };
// Ba Zhai uses full direction names; Flying Star uses short codes - this maps between them so a
// persisted Ba Zhai facing direction can auto-feed the Flying Star property calculator below.
const DIR_FULL_TO_SHORT = { North:'N', Northeast:'NE', East:'E', Southeast:'SE', South:'S', Southwest:'SW', West:'W', Northwest:'NW' };
// ENHANCEMENT (reported: "Address input missing home facing direction"): hoisted out of
// renderSystemChart (which used to declare its own identical local `dirOptions` const) so the same
// 8-direction list/order can also drive the new Home Facing Direction picker inside the address
// block (renderHomeDetailsBlock) and on the Intake page, without duplicating the array a third time.
const BAZHAI_DIR_OPTIONS = ['North','Northeast','East','Southeast','South','Southwest','West','Northwest'];
const FLYING_STAR_DIR_OPTIONS = ['N','NE','E','SE','S','SW','W','NW'];
const FLYING_STAR_DIR_LABEL_EN = { N:'North', NE:'Northeast', E:'East', SE:'Southeast', S:'South', SW:'Southwest', W:'West', NW:'Northwest' };
const FLYING_STAR_DIR_LABEL_ZH = { N:'北', NE:'东北', E:'东', SE:'东南', S:'南', SW:'西南', W:'西', NW:'西北' };
// ENHANCEMENT (Phase 0, reported: no deep-reading detail exists for the Flying Star temporal overlay
// or the property calculator - "Go Deep for this as well"). This is the standard, widely-documented
// Xuan Kong Fei Xing (玄空飞星) nature of each of the 9 stars, used below to turn the raw numbers this
// app already computes into an actual reading, rather than leaving the numbers unexplained. Current
// Period is 8 (2004-2023) transitioning into Period 9 (2024-2043) - Star 8 and Star 9 are both treated
// as currently favourable during this transition, which is the documented convention for the Period
// 8-to-9 handover; Star 5 (Five Yellow) and Star 2 (Illness Star) are the two most consistently-cited
// cautionary stars across sources regardless of period.
const FLYING_STAR_NATURE = {
  1: { en: 'Career/Water Star - generally favourable, supports career advancement and clear thinking.', zh: '一白贪狼（官星／水星）——整体吉利，助事业发展与思路清晰。', favourable: true },
  2: { en: 'Illness Star (病符) - the most commonly cited cautionary star; associated with health issues and low energy.', zh: '二黑病符星——最常被提及的凶星之一，主健康问题与气场低迷。', favourable: false },
  3: { en: 'Quarrelsome Star (是非星) - associated with disputes, gossip, and legal friction.', zh: '三碧是非星——主口角、是非与法律纠纷。', favourable: false },
  4: { en: 'Romance/Scholarly Star (文昌) - mixed; supports study and artistic pursuits, but can also indicate romantic complications.', zh: '四绿文昌星——吉凶参半，利文昌学业与艺术发展，惟亦主感情纠葛。', favourable: null },
  5: { en: 'Five Yellow (五黄) - the single most cautioned-against star across sources; associated with accidents and misfortune. Widely advised: avoid renovation, digging, or prolonged activity in a palace this star occupies.', zh: '五黄煞——各家最一致告诫的凶星，主意外与不顺。普遍建议：此星所在方位应避免装修、动土或长时间逗留。', favourable: false },
  6: { en: 'Heaven/Authority Star (武曲) - favourable; associated with authority, mentorship, and steady wealth.', zh: '六白武曲星——吉利，主权威、贵人与财运稳健。', favourable: true },
  7: { en: 'Broken Soldier Star (破军) - historically cautionary (robbery/violence), though its severity is widely described as softened outside its own ruling period.', zh: '七赤破军星——历来主盗劫与是非，惟一般认为其凶性在非当运期已减弱。', favourable: false },
  8: { en: "Current Wealth Star (八白) - the most favourable star of Period 8/9's transition; associated with wealth accumulation.", zh: '八白左辅星——现届运（八运／九运交替）中最吉之星，主财富积累。', favourable: true },
  9: { en: 'Future Prosperity Star (九紫) - increasingly favourable as Period 9 (from 2024) approaches/continues; associated with celebration and recognition.', zh: '九紫右弼星——随九运（2024年起）渐旺，主喜庆与声名。', favourable: true },
};
function flyingStarNatureLine(num) {
  const n = FLYING_STAR_NATURE[num];
  if (!n) return bt(`Star ${num}.`, `${num}星。`);
  return bt(`Star ${num}: ${n.en}`, `${num}星：${n.zh}`);
}
function ratingColor(r) { return r === 'favourable' ? 'var(--success)' : r === 'unfavourable' ? 'var(--danger)' : 'var(--warning)'; }
// BUG 15 FIX: resolve a person's actual best specific compass direction (by Kua Number) instead of
// vaguely saying "your OWN auspicious direction" in remedy text - names the real direction and star.
function findBestBazhaiDirection(kuaNum) {
  const priority = ['Sheng Qi', 'Tian Yi', 'Yan Nian', 'Fu Wei'];
  const table = BAZHAI_STARS[kuaNum]; if (!table) return null;
  for (const wantedStar of priority) {
    for (const [dir, star] of Object.entries(table)) { if (star === wantedStar) return { direction: dir, star: wantedStar }; }
  }
  return null;
}

// BUG 2 FIX: dedicated English Name vs BaZi Five Grids deep analysis, structurally identical to the
// Chinese version but using Pythagorean letter values - always available since English name is mandatory.
function renderEnglishNameCompatBlock(p) {
  const ec = p.englishNameCompat;
  if (!ec) return '';
  const gridRows = ec.grids.map(g => ({
    label: g.name, value: `${g.value} (${bt(g.elem, ELEM_ZH[g.elem])}) - ${ratingLabel(g.rating)}`,
    color: ratingColor(g.rating)
  }));
  const pct = ec.percent; const pctColor = scoreColor(pct);
  const explanation = bt(
    `Each of the 5 Grids (Tian/Ren/Di/Wai/Zong) is built from Pythagorean letter values (A=1..I=9, cycling) of your English name, reduced to an element via its final digit, then rated against your Day Master (${ec.dmElem}). Your name scored ${ec.favCount} Favourable and ${ec.unfavCount} Unfavourable grid(s) out of 5, giving ${pct}%.`,
    `五格（天格/人格/地格/外格/总格）依英文姓名字母的毕达哥拉斯数值（A=1..I=9循环）换算，再依末位数字对应五行，并与您的日主（${ELEM_ZH[ec.dmElem]}）比对。您的英文姓名共有 ${ec.favCount} 项有利、${ec.unfavCount} 项不利（满分5项），契合度为 ${pct}%。`
  );
  const deep = renderStandardDeepAnalysis(
    bt('English Name vs BaZi Deep Analysis','英文姓名与八字契合深度分析'),
    bt(`Your English name "${p.englishName}" resolves to a ${pct}% compatibility against your BaZi Day Master (${ec.dmElem}).`, `您的英文姓名「${p.englishName}」与八字日主（${ELEM_ZH[ec.dmElem]}）的契合度为 ${pct}%。`),
    explanation,
    bt(`${ec.favCount} of 5 grids actively support your Day Master; ${ec.unfavCount} work against it.`, `五格中有 ${ec.favCount} 项支持日主，${ec.unfavCount} 项与日主相克。`),
    [bt(`Overall compatibility: ${pct}%.`,`整体契合度：${pct}%。`), bt(`Zong Ge (总格) resolves to ${ec.grids[4].elem}.`,`总格换算五行为${ELEM_ZH[ec.grids[4].elem]}。`)],
    ec.favCount >= 3 ? [bt('Name elements reinforce your natal chart rather than working against it.','姓名五行有助于本命八字，而非相克。')] : [bt('Some grids still provide partial support.','部分格局仍提供一定助力。')],
    ec.unfavCount >= 2 ? [bt('Multiple grids sit in an overcoming relationship with your Day Master.','多个格局与日主相克。')] : [bt('No major elemental conflict detected.','未见明显五行冲突。')],
    [bt('English-letter numerology is a Western-adapted parallel system, not a traditional Five Grids method - read alongside, not instead of, the Chinese name analysis if you have one.','英文字母数理属西方改良的平行体系，并非传统五格姓名学——若您已有中文姓名分析，请两者并参而非单独依赖此项。')]
  );
  return `<article class="reading">
    <span class="pill">${trPill('English Name vs BaZi Compatibility')}</span>
    ${renderInfoRows([{ label: bt('Name Compatibility %','姓名契合度'), value: `${pct}%`, color: pctColor, bg: '#fff' }])}
    ${renderPillarStyleTable(gridRows)}
    ${deep}
  </article>`;
}

// BUG 3 FIX: combined section showing English Name, Chinese Name, and BaZi side by side with a
// blended overall verdict - only rendered when both name systems are available.
function renderCombinedNameCompatBlock(p) {
  const ec = p.englishNameCompat, cc = p.chineseNameCompat;
  if (!ec || !cc) return '';
  const blended = Math.round((ec.percent + cc.percent) / 2);
  const blendedColor = scoreColor(blended);
  const rows = [
    { label: bt('English Name Compatibility','英文姓名契合度'), value: `${p.englishName} → ${ec.percent}%`, color: scoreColor(ec.percent), bg: '#fff' },
    { label: bt('Chinese Name Compatibility','中文姓名契合度'), value: `${[p.chineseLastName,p.chineseFirstName].filter(Boolean).join('')} → ${cc.percent}%`, color: scoreColor(cc.percent), bg: '#fff' },
    { label: bt('Blended Overall Compatibility','综合整体契合度'), value: `${blended}%`, color: blendedColor, bg: '#fff' }
  ];
  const agreement = Math.abs(ec.percent - cc.percent) <= 15;
  const deep = renderStandardDeepAnalysis(
    bt('Combined English + Chinese Name vs BaZi Deep Analysis','中英文姓名综合八字契合深度分析'),
    bt(`Your English name scores ${ec.percent}% and your Chinese name scores ${cc.percent}% against your BaZi Day Master (${ec.dmElem}), blending to an overall ${blended}%.`, `您的英文姓名契合度为 ${ec.percent}%，中文姓名契合度为 ${cc.percent}%，与八字日主（${ELEM_ZH[ec.dmElem]}）综合后整体契合度为 ${blended}%。`),
    bt(`The two systems are calculated independently (Chinese via traditional character stroke counts, English via Pythagorean letter values) and then averaged for a holistic view. ${agreement ? 'The two scores broadly agree, giving a consistent overall picture.' : 'The two scores diverge notably - this usually means one name system supports your Day Master considerably more than the other, worth weighing which name you use more often in daily life (e.g. legal/professional use).'}`,
      `两套系统各自独立计算（中文依传统笔画数，英文依毕达哥拉斯字母数值），再取平均得出综合观感。${agreement ? '两者结果大致一致，整体判断较为稳定。' : '两者结果差异较明显——通常代表其中一套姓名体系对日主的支持度明显较高，建议考虑您日常（如法律／职场）较常使用哪个姓名。'}`),
    bt(`Blended compatibility of ${blended}% reflects both your legal/everyday name and your Chinese name together.`, `综合契合度 ${blended}% 同时反映您的法定／日常姓名与中文姓名。`),
    [bt(`English: ${ec.percent}% · Chinese: ${cc.percent}% · Blended: ${blended}%.`,`英文：${ec.percent}% · 中文：${cc.percent}% · 综合：${blended}%。`), bt(agreement ? 'Both name systems broadly agree.' : 'The two name systems diverge - see explanation above.', agreement ? '两套姓名体系结果大致相符。' : '两套姓名体系结果分歧——详见上方说明。')],
    blended >= 75 ? [bt('Both names, taken together, lean supportive of your Day Master.','两个姓名综合而言均有助于日主。')] : [bt('There is room for improvement in one or both name systems.','其中一或两套姓名体系仍有改善空间。')],
    blended < 75 ? [bt('Consider which name (English or Chinese) you use more in daily/professional life, and prioritise improving that one.','请考虑您日常／职场较常使用哪个姓名，并优先改善该姓名。')] : [bt('No urgent action needed on either name.','两个姓名均暂无迫切需要调整。')],
    [bt('This blended score is a convenience summary - refer to the individual English and Chinese sections above for the full breakdown before making any name decisions.','此综合评分仅为方便参考之总览——做出改名决定前，请参阅上方英文及中文姓名的完整分析。')]
  );
  return `<article class="reading">
    <span class="pill">${trPill('Combined Name (English + Chinese) vs BaZi Compatibility')}</span>
    ${renderInfoRows(rows)}
    ${deep}
  </article>`;
}

// ENHANCEMENT 3 helpers (also reused for the household occupants feature): resolve an occupant's
// Kua group from their birth year + gender
function getOccupantKua(year, gender) {
  const kuaNum = getKua(Number(year), gender === 'male');
  const kuaGroup = [1,3,4,9].includes(kuaNum) ? 'East (东四命)' : 'West (西四命)';
  return { kuaNum, kuaGroup };
}
// ENHANCEMENT (Phase 2 - "household occupants need full data collection for household deep analysis",
// the compatibility half of that request): an occupant's record already carries a real birthdate and
// optional birth time (see Phase 1's migrateOccupantBirthData()/renderOccupantsListHTML above), which
// is everything getProfileData() itself needs to compute a real, full BaZi profile (Day Master, Kua
// group, Bone Weight, Qi Men Dun Jia palace, Zi Wei life palace, Western Astrology sign, etc.) -
// exactly the same pipeline every other profile type (partner/business partner/child) already goes
// through via `getProfileData(rawRecord)`. Only the occupant's own record is missing the englishFirst/
// LastName fields getProfileData expects for its displayName - supplied here from the occupant's
// optional `name` field (or a numbered fallback), never left undefined.
function getOccupantProfileData(occupant, indexForFallbackName) {
  if (!occupant || !occupant.birthdate) return null;
  const fallbackName = bt(`Occupant ${indexForFallbackName + 1}`, `住户${indexForFallbackName + 1}`);
  const synthetic = {
    englishFirstName: occupant.name ? occupant.name : fallbackName, englishLastName: '',
    birthdate: occupant.birthdate, birthtime: occupant.birthtime || '12:00', gender: occupant.gender || 'male',
    // No address/longitude/timezone is ever collected for an occupant - getProfileData() already
    // falls back to Singapore's own default longitude/timezone (103.8E / GMT+8) when these are
    // missing, which is the correct default for this app's primary user base.
  };
  const profile = getProfileData(synthetic);
  if (profile) profile.isOccupantApproximate = !!occupant.approximateBirth;
  return profile;
}
// Full household roster as REAL, computed profiles (not just Kua numbers) - the input calculateTrueCompatibility
// itself needs. Mirrors buildHouseholdPeopleList's membership exactly (you + Life Partner + every child
// + every added occupant) so the compatibility roster and the Ba Zhai roster above always agree on who
// counts as "the household".
function buildHouseholdCompatibilityRoster(p, u, occupants) {
  const roster = [{ label: bt('You', '本人'), profile: p }];
  if (u?.partner) {
    const pp = getProfileData(u.partner);
    if (pp) roster.push({ label: `${pp.displayName} (${bt('Life Partner', '生活伴侣')})`, profile: pp });
  }
  (u?.children || []).forEach(c => {
    const cp = getProfileData(c);
    if (cp) roster.push({ label: `${cp.displayName} (${bt('Child', '子女')})`, profile: cp });
  });
  (occupants || []).forEach((o, i) => {
    const op = getOccupantProfileData(o, i);
    if (op) {
      const who = o.name ? escapeHtml(o.name) : bt(`Occupant ${i + 1}`, `住户${i + 1}`);
      roster.push({ label: `${who} (${bt('Occupant', '住户')}${op.isOccupantApproximate ? bt(', approx. birth', '，出生日期为约数') : ''})`, profile: op });
    }
  });
  return roster;
}
function buildHouseholdPeopleList(p, u, occupants) {
  const people = [{ label: bt('You', '本人'), kuaNum: p.kuaNum, kuaGroup: p.kuaGroup }];
  if (u?.partner) {
    const pp = getProfileData(u.partner);
    people.push({ label: `${pp.displayName} (${bt('Life Partner', '生活伴侣')})`, kuaNum: pp.kuaNum, kuaGroup: pp.kuaGroup });
  }
  // ENHANCEMENT (this round): children were previously missing entirely from the household roster,
  // despite living in the same home and having a full profile (birthdate/time) available - a real gap,
  // not a deliberate scope limit, since children have everything needed for a proper Kua number.
  (u?.children || []).forEach(c => {
    const cp = getProfileData(c);
    people.push({ label: `${cp.displayName} (${bt('Child', '子女')})`, kuaNum: cp.kuaNum, kuaGroup: cp.kuaGroup });
  });
  (occupants || []).forEach((o, i) => {
    const k = getOccupantKua(o.year, o.gender);
    const who = o.name ? escapeHtml(o.name) : bt(`Occupant ${i + 1}`, `住户${i + 1}`);
    const dateLabel = o.birthdate ? o.birthdate : `${o.year}${bt('','年')}`;
    people.push({ label: bt(`${who} (${o.gender === 'male' ? 'M' : 'F'}, b.${dateLabel})`, `${who}（${o.gender === 'male' ? '男' : '女'}，生于${dateLabel}）`), kuaNum: k.kuaNum, kuaGroup: k.kuaGroup });
  });
  return people;
}
// ENHANCEMENT (Phase 1, reported: "household occupants need full data collection for household deep
// analysis" - occupants previously only collected a bare birth YEAR, enough for a Kua number but
// nothing more precise. Now collects a full birthdate (and an optional birth time), enough to compute
// a real BaZi chart for an occupant in a future round, not just their Kua group - while staying fully
// backward-compatible with every occupant already saved under the old {year, gender} shape (see the
// migrateOccupantBirthData() migration in engine-core.js, which backfills a placeholder birthdate for
// those and marks them `approximateBirth: true` so this is never silently presented as precise).
function renderOccupantsListHTML(prefix, occupants) {
  const rows = (occupants || []).map((o, i) => {
    const k = getOccupantKua(o.year, o.gender);
    const nameLabel = o.name ? escapeHtml(o.name) + ': ' : '';
    const nameLabelZh = o.name ? escapeHtml(o.name) + '：' : '';
    const dateLabel = o.birthdate ? `b.${o.birthdate}${o.birthtime && !o.approximateBirth ? ' ' + o.birthtime : ''}` : `b.${o.year}`;
    const dateLabelZh = o.birthdate ? `生于${o.birthdate}${o.birthtime && !o.approximateBirth ? ' ' + o.birthtime : ''}` : `生于${o.year}年`;
    const approxNote = o.approximateBirth ? bt(' (approximate - exact date/time not on file)', '（约略——具体日期/时间未记录）') : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin:4px 0;background:#f5f3ec;border-radius:6px;font-size:12px">
      <span>${bt(`${nameLabel}Occupant ${i+1}: ${o.gender === 'male' ? 'Male' : 'Female'}, ${dateLabel}${approxNote}`, `${nameLabelZh}住户${i+1}：${o.gender === 'male' ? '男' : '女'}，${dateLabelZh}${approxNote}`)} → <strong style="color:var(--plum)">${bt(`Kua ${k.kuaNum} (${k.kuaGroup})`, `卦命 ${k.kuaNum}（${k.kuaGroup}）`)}</strong></span>
      <button class="btnRemoveOccupant" data-prefix="${prefix}" data-idx="${i}" style="border:0;background:var(--danger);color:#fff;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer">${bt('Remove','移除')}</button>
    </div>`;
  }).join('');
  const canAdd = (occupants || []).length < 10;
  return `
    <div id="occupants-rows-${prefix}">${rows || `<div style="font-size:12px;color:var(--muted);padding:6px 0">${bt('No additional occupants added yet.', '尚未添加额外住户。')}</div>`}</div>
    ${canAdd ? `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:flex-end">
      <label class="field" style="margin:0;flex:1;min-width:100px"><span style="font-size:11px">${bt('Name (optional)','姓名（可选）')}</span><input type="text" id="occ-name-${prefix}" maxlength="60" placeholder="${bt('e.g. Grandma','例如：奶奶')}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      <label class="field" style="margin:0;flex:1;min-width:130px"><span style="font-size:11px">${bt('Birth Date *','出生日期 *')}</span><input type="date" id="occ-birthdate-${prefix}" min="1920-01-01" max="${new Date().toISOString().slice(0,10)}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      <label class="field" style="margin:0;flex:1;min-width:100px"><span style="font-size:11px">${bt('Birth Time (optional)','出生时间（可选）')}</span><input type="time" id="occ-birthtime-${prefix}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"></label>
      <label class="field" style="margin:0;flex:1;min-width:90px"><span style="font-size:11px">${bt('Gender','性别')}</span><select id="occ-gender-${prefix}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" autocomplete="off"><option value="male">${bt('Male','男')}</option><option value="female">${bt('Female','女')}</option></select></label>
      <button class="btnAddOccupant" data-prefix="${prefix}" style="padding:8px 14px;background:var(--gold);color:#fff;border:none;border-radius:4px;font-weight:700;cursor:pointer">${bt('Add','添加')}</button>
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:4px">${bt('Birth time is optional but recommended - it lets a future, more detailed household reading use this occupant\'s full birth chart rather than just their birth year.', '出生时间为可选项目，惟建议填写——日后更详细的家庭分析可据此使用该住户的完整命盘，而非仅凭出生年份。')}</div>
    ` : `<div style="font-size:11px;color:var(--muted);margin-top:8px">${bt('Maximum of 10 occupants reached.','已达 10 位住户上限。')}</div>`}
  `;
}


// BUG 1 FIX: shared age calculator (used by both the new Profile Overview block and the Da Yun section)
function computeCurrentAge(birthdateStr) {
  const birthDateObj = new Date(birthdateStr + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const hadBirthdayThisYear = (today.getMonth() > birthDateObj.getMonth()) || (today.getMonth() === birthDateObj.getMonth() && today.getDate() >= birthDateObj.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return Math.max(0, age);
}

function renderSystemChart(p, prefix = 'i', compatResult = null, isBusiness = false, mainP = null) {
  if (!p) return '';
  const u = activeUser(); const prof = getProfileByPrefix(prefix);
  const sgDateStr = new Date(new Date().getTime() + 8*3600000).toISOString().split('T')[0];
  const idAttr = (id) => prefix === 'i' ? `id="${id}"` : '';

  // BUG 1 FIX: Profile Overview - reformatted from a plain bullet list into a scannable profile card:
  // a prominent name/avatar header, then a labelled 2-column grid of facts, for readability.
  const chineseNameFull = [p.chineseLastName, p.chineseFirstName].filter(Boolean).join('');
  const profileAge = computeCurrentAge(p.birthdate);
  const genderLabel = bt(p.isMale ? 'Male' : 'Female', p.isMale ? '男' : '女');
  // BUG 2 FIX: when Chinese is selected AND a Chinese name was actually provided, show it as the
  // PRIMARY name (English shown secondarily); otherwise English remains primary (Chinese name unavailable).
  const showChineseAsPrimary = (lang === 'zh' && chineseNameFull);
  const primaryDisplayName = showChineseAsPrimary ? chineseNameFull : p.englishName;
  const secondaryDisplayName = showChineseAsPrimary ? p.englishName : (chineseNameFull || '');
  // ENHANCEMENT (reported: "the flying star card has blank space on the right and the details runs
  // into 5 lines, utilize the space to make the card width larger to reduce the lines"): this grid is
  // a plain 2-column layout, so a tile with no partner in its row (Flying Star was always the 9th tile
  // in an odd-numbered 9-tile grid) sits alone at half width, with its longer nature-line text
  // wrapping many times into that narrow half instead of using the empty space beside it. An optional
  // `wide` flag lets a specific tile span both columns - used below for Flying Star only, the one tile
  // that actually sits alone in its row.
  const overviewTile = (label, value, wide) => `<div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px${wide ? ';grid-column:span 2' : ''}"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">${label}</div><div style="font-size:13px;font-weight:700;color:var(--plum);line-height:1.4">${value}</div></div>`;
  const artProfileOverview = `
    <article class="reading" style="border-top:none;padding-top:0">
      <div style="display:flex;align-items:center;gap:12px;padding:14px;background:linear-gradient(135deg,#292c44,#4c3550);border-radius:14px;margin-bottom:12px">
        <div style="width:46px;height:46px;border-radius:50%;background:var(--gold);color:#241a05;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex-shrink:0">${p.englishFirstName.slice(0,1)}${p.englishLastName.slice(0,1)}</div>
        <div style="color:#fff; min-width:0; overflow-wrap:break-word">
          <div style="font-size:16px;font-weight:700">${primaryDisplayName}${secondaryDisplayName ? ` · ${secondaryDisplayName}` : ''}</div>
          <div style="font-size:12px;opacity:0.85;margin-top:2px">${genderLabel} · ${bt('Age','年龄')} ${profileAge} · ${p.animal} (${p.animalCN})</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <!-- BUG FIX (reported: "Summary cards has an empty spot beside the longitude/timezone. Move
             this information to be part of the gregorian birth summary card"): Longitude/Timezone used
             to be its own tile, which left an empty slot beside it in this 2-column grid whenever it
             rendered as the 5th tile in a 4-tile row. It's no longer a separate tile - the value is
             auto-populated from the selected birth country/city (see the country/city select wiring
             further down this file) and is folded into the Gregorian Birth tile instead, as a 3rd line,
             so anyone checking the True Solar Time basis of their chart can still see it at a glance. -->
        ${overviewTile(bt('Gregorian Birth','阳历出生'), `${p.birthdate}<br>${p.birthtime}${p.birthLocation ? ` · ${p.birthLocation}` : ''}${typeof p.birthLongitude === 'number' ? `<br><span style="font-size:11px;font-weight:400;color:var(--muted)">${p.birthLongitude.toFixed(2)}°  ·  UTC${p.birthTimezone >= 0 ? '+' : ''}${p.birthTimezone}</span>` : ''}`)}
        ${overviewTile(bt('Lunar Birth','农历出生'), bt(p.lunar.fullLunarEN, p.lunar.fullLunarCN))}
        ${overviewTile(bt('Day Master','日主'), `${stems[p.bazi.dayStemIdx]} (${stemCN[p.bazi.dayStemIdx]})`)}
        ${overviewTile(bt('Bone Weight','骨重'), `${p.boneWeight.displayStr} (${p.boneWeight.total} ${bt('Liang','两')})`)}
      </div>
      <!-- BUG FIX (reported: "this summary details in all profiles are missing many items like
           numerology, astrology, i ching, etc"): this top overview card - the first thing anyone
           sees on a chart, before any scrolling - previously covered only the 4 birth/BaZi-adjacent
           facts above. Numerology, Astrology, I Ching, Zi Wei Dou Shu, Qi Men Dun Jia, and Ba Zhai
           were only visible further down in the "Details Summary" section, easy to miss if someone
           doesn't scroll. Added a second row of 6 tiles here so every major system this app computes
           is visible at a glance from the very top, without requiring anyone to already know a more
           detailed recap exists lower on the page. -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        ${overviewTile(bt('Da Yun (Current Cycle)','大运（当前）'), `${bt('Start Age','起运年龄')} ${p.nominalStartAge} (${p.daYunStartYear})`)}
        ${overviewTile(bt('Life Expectancy','预期寿命'), `${p.lifespan} ${bt('Yrs','岁')}`)}
        ${overviewTile(bt('Numerology Life Path','生命数字'), `${p.life} (${bt('Lucky No.','幸运号码')}: ${p.lifeLuckyNumber})`)}
        ${overviewTile(bt('Sun Sign','太阳星座'), p.astro.en)}
        ${overviewTile(bt('I Ching Hexagram','易经本命卦'), `#${p.hexNo}`)}
        ${overviewTile(bt('Zi Wei Life Palace','紫微命宫'), p.ziwei.lifePalaceName)}
        ${overviewTile(bt('QMDJ Life Palace','奇门命宫'), `${bt('Palace','宫位')} ${p.qmdj.natalPalace} (${p.palaceName})`)}
        ${overviewTile(bt('Ba Zhai Kua','八宅命卦'), `${p.kuaGroup} - ${bt('Kua','卦')} ${p.kuaNum}`)}
        <!-- BUG FIX (reported: "both summary on app and pdf does not have the flying star"): every
             other major system this app computes had a tile here except Flying Star (玄空飞星), which
             previously only appeared deep inside the Feng Shui tab. The Flying Star PROPERTY chart
             needs a specific construction year/facing direction (optional, user-entered elsewhere), so
             it can't always be shown here - but the current Annual Flying Star for the ruling year is a
             fixed, always-computable value independent of any property, so it's used for this summary
             tile the same way Sun Sign/I Ching are shown without requiring extra user input. -->
        ${(() => { const fsOv = computeFlyingStarTemporalOverlay(new Date()); return overviewTile(bt(`Flying Star (${fsOv.annual.year} Annual)`, `飞星（${fsOv.annual.year}流年）`), flyingStarNatureLine(fsOv.annual.chart.center), true); })()}
      </div>
    </article>
  `;

  // BUG 1 FIX: "Details Summary" - a one-glance recap of the headline finding from every module,
  // placed before Name Analysis so the person sees the full picture before diving into any one module.
  // ENHANCEMENT (reported: "on the detailed chart for all profiles, there is a details summary for
  // core, there should be the same for Timing, Environment and More as well"): the single flat summary
  // card below has been split into 4 category-specific mini-summaries, one per tab, using the exact
  // same Core/Timing/Environment/More categories this chart's own tab bar already uses (see
  // `tabGroups` further below) - each row is assigned to whichever category actually contains that
  // row's own full section (e.g. Da Yun's row goes in the Timing summary because the full Da Yun
  // article itself lives in the Timing tab; Zi Wei's row goes in Environment because the full Zi Wei
  // Dou Shu article lives there), so each tab's own quick-glance card always matches what a person
  // will find if they keep reading that same tab. Every row from the original single card is kept,
  // none dropped, none duplicated across cards.
  const bwTierForSummary = getBoneWeightTier(p.boneWeight.total);
  const summaryRow = (label, value) => `<div style="padding:8px 10px;margin:4px 0;background:#f5f3ec;border-left:3px solid var(--gold);border-radius:0 6px 6px 0;font-size:12px"><strong style="color:var(--plum)">${label}:</strong> <span style="color:var(--ink)">${value}</span></div>`;
  const artDetailsSummaryCore = `
    <h2 class="section-header" ${idAttr('detailssummary-core')}>${bt('Details Summary','详情摘要')}</h2>
    <article class="reading" style="padding-top:0">
      ${summaryRow(bt('Zodiac','生肖'), `${p.animal} (${p.animalCN}) — ${bt('Allies','三合')}: ${p.zodiacData.allies}, ${bt('Conflict','相冲')}: ${p.zodiacData.avoid}`)}
      ${summaryRow(bt('BaZi Day Master','八字日主'), `${stems[p.bazi.dayStemIdx]} (${stemCN[p.bazi.dayStemIdx]})`)}
      ${summaryRow(bt('Life Expectancy','预期寿命'), `${p.lifespan} ${bt('Yrs','岁')}`)}
      ${summaryRow(bt('Bone Weight','骨重'), `${p.boneWeight.displayStr} — ${bt(bwTierForSummary.tier, bwTierForSummary.tierZh)}`)}
      ${summaryRow(bt('I Ching Natal Hexagram','易经本命卦'), `#${p.hexNo}`)}
    </article>
  `;
  const artDetailsSummaryTiming = `
    <h2 class="section-header" ${idAttr('detailssummary-timing')}>${bt('Details Summary','详情摘要')}</h2>
    <article class="reading" style="padding-top:0">
      ${summaryRow(bt('Da Yun','大运'), `${bt('Start Year','起运年')} ${p.daYunStartYear} (${bt('Age','年龄')} ${p.nominalStartAge})`)}
      ${summaryRow(bt('QMDJ Life Palace','奇门命宫'), `${bt('Palace','宫位')} ${p.qmdj.natalPalace} (${p.palaceName})`)}
    </article>
  `;
  const artDetailsSummaryEnvironment = `
    <h2 class="section-header" ${idAttr('detailssummary-environment')}>${bt('Details Summary','详情摘要')}</h2>
    <article class="reading" style="padding-top:0">
      ${summaryRow(bt('Zi Wei Life Palace','紫微命宫'), p.ziwei.lifePalaceName)}
      ${summaryRow(bt('Ba Zhai Kua','八宅命卦'), `${p.kuaGroup} - ${bt('Kua','卦')} ${p.kuaNum}`)}
      ${(() => { const fsOv = computeFlyingStarTemporalOverlay(new Date()); return summaryRow(bt(`Flying Star (${fsOv.annual.year} Annual)`, `飞星（${fsOv.annual.year}流年）`), flyingStarNatureLine(fsOv.annual.chart.center)); })()}
    </article>
  `;
  const artDetailsSummaryMore = `
    <h2 class="section-header" ${idAttr('detailssummary-more')}>${bt('Details Summary','详情摘要')}</h2>
    <article class="reading" style="padding-top:0">
      ${summaryRow(bt('Numerology Life Path','生命数字'), `${p.life} (${bt('Lucky Number','幸运号码')}: ${p.lifeLuckyNumber})`)}
      ${summaryRow(bt('Sun Sign','太阳星座'), p.astro.en)}
    </article>
  `;

  // BUG 16 FIX: Name Analysis now includes the 7-part Deep Analysis
  // ENHANCEMENT (this round): 81-number fortune table (八十一数吉凶) now applied to each of the 5
  // grids, replacing the previous last-digit-only element mapping - each grid now shows its real
  // auspicious/inauspicious/mixed classification and traditional theme name, not just an element.
  const gridFortuneRows = [
    { label: 'Tian Ge (天格)', num: p.tianGe }, { label: 'Ren Ge (人格)', num: p.renGe },
    { label: 'Di Ge (地格)', num: p.diGe }, { label: 'Wai Ge (外格)', num: p.waiGe }, { label: 'Zong Ge (总格)', num: p.zongGe }
  ].map(g => {
    const f = gridFortune(g.num);
    return `<tr>
      <td style="padding:6px 8px;border:1px solid #eee;font-size:11px">${bt(g.label, g.label)}</td>
      <td style="padding:6px 8px;border:1px solid #eee;text-align:center;font-size:12px">${g.num}${f.number !== g.num ? bt(` (as ${f.number})`, `（作${f.number}论）`) : ''}</td>
      <td style="padding:6px 8px;border:1px solid #eee;font-size:11px">${f.theme}</td>
      <td style="padding:6px 8px;border:1px solid #eee;text-align:center"><span style="color:#fff;background:${f.color};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">${bt(f.label.en, f.label.zh)}</span></td>
    </tr>`;
  }).join('');
  const artName = `
    <h2 class="section-header" ${idAttr('nameanalysis')}>${flipTitle(`Name Analysis (姓名学)`)}</h2>
    <article class="reading">
      <div class="calc-box">• <strong>${bt('English Name','英文姓名')}:</strong> ${p.englishName}${chineseNameFull ? `<br>• <strong>${bt('Chinese Name','中文姓名')}:</strong> ${chineseNameFull}` : ''}<br>• <strong>${bt('Five Grids','五格')}:</strong> Tian: ${p.tianGe} | Ren: ${p.renGe} | Di: ${p.diGe} | Zong: ${p.zongGe}</div>
      <div style="overflow-x:auto;margin-top:8px">
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:#f4f4f4">
            <th style="padding:6px 8px;border:1px solid #eee;font-size:11px">${bt('Grid','格')}</th>
            <th style="padding:6px 8px;border:1px solid #eee;font-size:11px">${bt('Number','数')}</th>
            <th style="padding:6px 8px;border:1px solid #eee;font-size:11px">${bt('Theme','含义')}</th>
            <th style="padding:6px 8px;border:1px solid #eee;font-size:11px">${bt('Verdict','吉凶')}</th>
          </tr>
          ${gridFortuneRows}
        </table>
      </div>
      <div class="calc-box" style="font-size:11px;margin-top:8px">${bt('The classical 81-number fortune table (八十一数吉凶), where each grid number carries a traditional auspicious/inauspicious/mixed verdict and theme, independent of the elemental (Five Element) reading used elsewhere. Numbers above 81 wrap around per the classical rule (repeatedly subtracting 80).', '依传统八十一数吉凶表，每一格数皆有其吉凶判定与含义，独立于其他处所用的五行判断。超过81之数，依传统规则（重复减去80）折算。')}</div>
      ${generateDeepAnalysisData('name', p, {title: 'Name Five Grids Deep Analysis'})}
    </article>
    ${renderEnglishNameCompatBlock(p)}
    ${renderChineseNameCompatBlock(p, prefix)}
    ${renderCombinedNameCompatBlock(p)}
  `;

  // BUG 1 FIX: Zodiac now formatted in the SAME table style as the BaZi Natal Chart
  const zodiacRows = renderPillarStyleTable([
    { label: 'Life Zodiac', value: `${p.animal} (${p.animalCN})`, color: 'var(--plum)' },
    { label: 'Zodiac Allies', value: p.zodiacData.allies, color: 'var(--success)' },
    { label: 'Hidden Ally', value: p.zodiacData.hidden, color: '#1565c0' },
    { label: 'Conflict', value: p.zodiacData.avoid, color: 'var(--danger)' }
  ]);
  const artZodiac = `
    <h2 class="section-header" ${idAttr('zodiac')}>${flipTitle(`Zodiac (生肖)`)}</h2>
    <article class="reading">
      <span class="pill">${trPill(`Zodiac Profile`)}</span>
      ${zodiacRows}
      ${generateDeepAnalysisData('zodiac', p, {title: `Zodiac Deep Profile - ${p.animal}`})}
    </article>
  `;

  // BUG 17/18 FIX: BaZi pillar table rebuilt to match the reference chart template - each pillar is
  // now a compact card showing the Heavenly Stem, Earthly Branch, and Hidden Stems each labelled with
  // their Ten God (十神) relationship to the Day Master, using the exact abbreviation scheme (EG/DM/
  // DO/RW/IR/DR/IW/DW/7K/HO/P) confirmed against the user's own reference image.
  const tg = computeAllTenGods(p.bazi);
  const elemCN = ['木','火','土','金','水'];
  const BRANCH_ELEM_IDX = [4,2,0,0,2,1,1,2,3,3,2,4]; // Zi..Hai -> Water,Earth,Wood,Wood,Earth,Fire,Fire,Earth,Metal,Metal,Earth,Water
  function pillarCard(labelEN, labelCN, timeVal, stemIdx, branchIdx, stemTG, isDayPillar) {
    const stemElemIdx = Math.floor(stemIdx / 2);
    const branchAnimalIdx = branchIdx;
    const hiddenList = HIDDEN_STEMS_BY_BRANCH[branchIdx];
    return `<div style="border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff">
      <div style="background:#f4f4f4;text-align:center;padding:5px 2px;font-size:11px;color:var(--muted)">
        <div style="font-weight:700;color:var(--ink)">${timeVal}</div>
        <div>${labelCN} ${labelEN}</div>
      </div>
      <div style="text-align:center;padding:8px 4px;border-bottom:1px dashed var(--line)">
        <div style="display:flex;justify-content:center;gap:4px;align-items:baseline">
          <span style="font-size:26px;font-weight:700;color:${isDayPillar ? 'var(--plum)' : 'var(--ink)'}">${stemCN[stemIdx]}</span>
          <span style="font-size:9px;font-weight:700;padding:1px 3px;border-radius:3px;background:${isDayPillar?'var(--gold)':'var(--goldsoft)'};color:${isDayPillar?'#fff':'var(--plum)'}">${stemTG.abbr}</span>
        </div>
        <div style="font-size:10px;color:var(--muted)">${stems[stemIdx].split(' ')[0]} · ${bt(stems[stemIdx].split('· ')[1]||'', elemCN[stemElemIdx])}</div>
        <div style="font-size:9px;color:var(--muted)">${bt(stemTG.en, stemTG.cn)}</div>
      </div>
      <div style="text-align:center;padding:8px 4px;border-bottom:1px dashed var(--line)">
        <div style="font-size:26px;font-weight:700;color:var(--ink)">${branchCN[branchIdx]}</div>
        <div style="font-size:10px;color:var(--muted)">${branches[branchAnimalIdx]} · ${bt('Element','五行')}: ${bt(['Wood','Fire','Earth','Metal','Water'][BRANCH_ELEM_IDX[branchIdx]], elemCN[BRANCH_ELEM_IDX[branchIdx]])}</div>
      </div>
      <div style="padding:6px 4px">
        <div style="font-size:9px;color:var(--muted);text-align:center;margin-bottom:3px">${bt('Hidden Stems','藏干')}</div>
        ${hiddenList.map(hsi => { const htg = getTenGod(p.bazi.dayStemIdx, hsi); return `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;padding:2px 4px;margin:2px 0;background:#f9f7f2;border-radius:4px">
          <span style="font-weight:700;color:var(--ink)">${stemCN[hsi]} ${stems[hsi].split(' ')[0]}</span>
          <span style="font-weight:700;color:var(--plum)">${htg.abbr} ${htg.cn}</span>
        </div>`; }).join('')}
      </div>
    </div>`;
  }
  let daYunHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px">
      ${pillarCard(bt('Hour','时'), bt('时','Hour'), (p.birthtime||'').slice(0,5), p.bazi.hourStemIdx, p.bazi.hourBranchIdx, tg.hourStem, false)}
      ${pillarCard(bt('Day','日'), bt('日','Day'), String(Number((p.birthdate||'').split('-')[2])), p.bazi.dayStemIdx, p.bazi.dayBranchIdx, tg.dayStem, true)}
      ${pillarCard(bt('Month','月'), bt('月','Month'), String(Number((p.birthdate||'').split('-')[1])), p.bazi.monthStemIdx, p.bazi.monthBranchIdx, tg.monthStem, false)}
      ${pillarCard(bt('Year','年'), bt('年','Year'), (p.birthdate||'').split('-')[0], p.bazi.yearStemIdx, p.bazi.yearBranchIdx, tg.yearStem, false)}
    </div>
    <div class="calc-box" style="font-size:11px;margin-top:8px">${bt('DM = Day Master · EG = Eating God · HO = Hurting Officer · DW/IW = Direct/Indirect Wealth · DO/7K = Direct Officer/Seven Killings · DR/IR = Direct/Indirect Resource · RW = Rob Wealth · P = Peer. All Ten God labels are relative to your Day Master.', 'DM日元 · EG食神 · HO伤官 · DW/IW正财/偏财 · DO/7K正官/七杀 · DR/IR正印/偏印 · RW劫财 · P比肩。以上十神标签均相对于您的日主而定。')}</div>
  `;

  // ENHANCEMENT (this round): Karmic Debt / Past-Life analysis, added at the end of Ming Li per
  // explicit request, following the standard Bazi + Zi Wei Dou Shu framework provided. Reuses
  // computeKarmicDebtAnalysis (engine-metaphysics.js), which itself reuses the existing, already-
  // verified Ten God engine, Six Clash table, and Kong Wang/Void calculation - no new metaphysics
  // formulas were invented for this. Only findings that genuinely apply to THIS chart are shown.
  function renderKarmicDebtSection(p) {
    const k = computeKarmicDebtAnalysis(p);
    const findings = [];
    if (k.sevenKillingsOverwhelming) {
      findings.push({
        phenomenon: bt(`Seven Killings (七杀) is prominent - found ${k.sevenKillingsCount} times across your chart`, `七杀突出——命盘中共出现 ${k.sevenKillingsCount} 次`),
        meaning: bt('Heavy aggressive or authoritative karma, potentially from a past life where power or authority may have been misused.', '较重的强势／权威业力，可能源自前世对权力的运用不当。'),
        lesson: bt('Facing obstacles, hidden opposition, or sudden hardship in this lifetime as a lesson in resilience and humility.', '今生面对阻力、暗中对手或突发困境，借此修习坚韧与谦卑。')
      });
    }
    if (k.dayYearClash) {
      findings.push({
        phenomenon: bt('Day Pillar clashes with Year Pillar (六冲)', '日柱与年柱六冲'),
        meaning: bt('The Year Pillar represents ancestors and past lives - a direct clash suggests ancestral or past-life friction.', '年柱代表祖辈与前世——直接六冲显示祖辈或前世的摩擦。'),
        lesson: bt('Major displacement early in life, repeated uprooting, or a sense of alienation from family or roots.', '早年经历较大变动、反复迁移，或与家族、根源产生疏离感。')
      });
    }
    if (k.indirectResourceStrong) {
      findings.push({
        phenomenon: bt(`Strong, "flowing" Indirect Resource (偏印) - found ${k.indirectResourceCount} times`, `偏印旺盛（流通）——命盘中共出现 ${k.indirectResourceCount} 次`),
        meaning: bt('Indicates strong spiritual, occult, or religious ties carried over from previous incarnations.', '显示与前世的灵性、玄学或宗教因缘较深。'),
        lesson: bt('Intuitive gifts and a strong pull toward metaphysics, but a tendency to overthink or feel detached from reality.', '具备直觉天赋，对玄学有浓厚兴趣，但容易多虑或感觉与现实脱节。')
      });
    }
    k.voidPillars.forEach(vp => {
      findings.push({
        phenomenon: bt(`Empty Demise (旬空) falls on your ${vp.labelEN}`, `旬空落于您的${vp.labelZH}`),
        meaning: bt('This branch falls into the "Void" - a pocket of energy already spent or left unfulfilled from a past life.', '此地支落入「空亡」——代表该处能量因前世已圆满或被忽略而呈现空虚。'),
        lesson: bt('An area of life tied to this pillar where full effort may bring disproportionately little visible return.', '与此柱相关的人生领域，即使全力以赴，回报也可能显得不成比例地少。')
      });
    });

    const findingsHTML = findings.length > 0
      ? findings.map(f => `<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed var(--line)">
          <div style="font-weight:700;color:var(--plum);font-size:12px">${f.phenomenon}</div>
          <div style="font-size:12px;margin-top:3px"><strong>${bt('Meaning','含义')}:</strong> ${f.meaning}</div>
          <div style="font-size:12px;margin-top:3px;color:var(--muted)"><strong>${bt('Lesson this lifetime','今生课题')}:</strong> ${f.lesson}</div>
        </div>`).join('')
      : `<div class="calc-box" style="font-size:12px">${bt('None of the specific karmic-debt markers checked (overwhelming Seven Killings, a Day-Year Pillar clash, strong flowing Indirect Resource, or Empty Demise on a pillar) are prominent in your chart - a comparatively unburdened configuration on these specific indicators, though this is not a claim that your chart has no karmic themes at all, only that these particular markers are not pronounced.', '您的命盘在此处所检测的特定业力指标（七杀过旺、日柱冲年柱、偏印旺盛流通、或旬空落柱）中均不突出——就这些具体指标而言相对轻省，但这并非表示命盘全然没有业力课题，仅代表这些特定指标并不明显。')}</div>`;

    return `<article class="reading">
      <span class="pill">${trPill('Karmic Debt & Past Lives')}</span>
      <h3 style="margin:8px 0 4px">${bt('Bazi Karmic Indicators','八字业力指标')}</h3>
      ${findingsHTML}
      <h3 style="margin:14px 0 4px">${bt('Zi Wei Dou Shu: Palace of Karma (福德宫)','紫微斗数：福德宫')}</h3>
      <div class="calc-box" style="font-size:12px">
        ${bt(`Your Fude Gong (Palace of Karma/Virtue) falls on ${k.fudeGongName}.`, `您的福德宫落于${k.fudeGongName}。`)}
        ${bt('This palace maps your spiritual sub-conscious and the spiritual assets or debts carried over from a past incarnation. A full star-by-star reading of this palace (which specific stars occupy it, and any Hua Ji/Hua Lu transformations) requires a complete 14-star Zi Wei Dou Shu chart, which is beyond this app\'s current Zi Wei module (it derives your Life/Body Palace correctly, but does not yet place the full star chart) - so this section states the palace location honestly without guessing at which stars sit there.', '此宫位映射您的灵性潜意识，以及前世带来的灵性资产或负债。若要逐星解读此宫（具体坐落何星、是否有化忌/化禄等四化），需要完整的紫微斗数十四主星排盘，而这超出本应用目前紫微模块的范围（目前仅能正确推算命宫／身宫位置，尚未排出完整星曜）——因此本节如实说明宫位所在，不臆测其中星曜。')}
      </div>
      <h3 style="margin:14px 0 4px">${bt('Remediation','化解建议')}</h3>
      <div class="calc-box" style="font-size:12px">
        ${bt('Chinese metaphysics treats karma as a blueprint of tendencies, not a fixed sentence. General remedies matched to the findings above:', '中华玄学视业力为倾向的蓝图，而非既定判决。以下为针对以上发现的一般化解建议：')}
        <ul style="margin:6px 0 0;padding-left:20px">
          ${k.sevenKillingsOverwhelming ? `<li>${bt('Behavioral: actively practice patience and restraint where Seven Killings pushes toward aggression or confrontation.', '行为：在七杀促使冲动或对抗之处，刻意修习耐心与克制。')}</li>` : ''}
          ${k.dayYearClash ? `<li>${bt('Ancestral: honouring ancestors (visits, remembrance, resolving old family disputes) to ease Year-Day Pillar friction.', '祖辈：透过祭祖、缅怀先人、化解家族旧怨，缓和年柱与日柱的冲突。')}</li>` : ''}
          ${k.indirectResourceStrong ? `<li>${bt('Grounding: balancing strong spiritual/intuitive pull with concrete, real-world routines to avoid over-detachment.', '接地气：以具体的现实生活习惯平衡强烈的灵性／直觉倾向，避免过度脱离现实。')}</li>` : ''}
          ${k.voidPillars.length > 0 ? `<li>${bt('Acceptance: for the Void pillar(s) above, redirect effort toward areas with clearer returns rather than forcing outcomes there.', '接纳：针对以上旬空之柱，将精力转向回报更明确的领域，而非强求该处的结果。')}</li>` : ''}
          <li>${bt('Charity (Yin De 阴德): anonymous acts of charity are traditionally held to help balance a spiritual deficit, regardless of which specific markers are present.', '阴德：无论具体指标为何，传统上认为默默行善有助平衡灵性亏欠。')}</li>
        </ul>
      </div>
    </article>`;
  }

  // ENHANCEMENT (this round): Bone Weight moved into the Ming Li section (right after the BaZi Natal
  // Chart) per explicit request - computed here (rather than at its old, later location in this
  // function) purely so it's available in time to be embedded inside artMingLi's template below. No
  // change to the calculation itself, only where its result is used.
  const bwInline = p.boneWeight; const bwTierInline = getBoneWeightTier(bwInline.total);
  const artMingLi = `
    <h2 class="section-header" ${idAttr('mingli')}>${flipTitle(`Ming Li (命理 - Destiny Analysis)`)}</h2>
    <article class="reading">
      <span class="pill">${trPill(`BaZi Natal Chart`)}</span>
      <div class="calc-box">
         • <strong>${bt('Life Favorable Colors','人生幸运颜色')}:</strong> <span style="color:green; font-weight:bold">${p.luckyColor}</span><br>
         • <strong>${bt('Life Unfavorable Colors','人生忌用颜色')}:</strong> <span style="color:red; font-weight:bold">${p.avoidColor}</span><br>
         • <strong>${bt('Expected Life Expectancy Range','预期寿命范围')}:</strong> ${p.lifespan} ${bt('Yrs','岁')}<br>
         • <strong>${bt('Number of Children Affinity','子女缘数')}:</strong> ${p.children}<br>
         • <strong>${bt('Marriage Activation Ages','婚姻催动年龄')}:</strong> ~${p.mAge1}, ~${p.mAge2}<br>
      </div>
      ${daYunHTML}
      ${generateDeepAnalysisData('dayMaster', p, {title: 'Day Master (日主) Deep Analysis'})}
      ${generateDeepAnalysisData('bazi_macro', p, {title: 'BaZi Macro Structure Deep Analysis'})}
    </article>
    <article class="reading">
      <span class="pill" ${idAttr('boneweight')}>${trPill(`Cheng Gu Suan Ming`)}</span>
      <div class="calc-box">
        • <strong>${bt('Approximate Lunar Basis','约略农历基准')}:</strong> ${bt('Year','年')} ${bwInline.lunarYearStemBranch}, ${bt('Month','月')} ${bwInline.lunarMonth}, ${bt('Day','日')} ${bwInline.lunarDay}, ${bt('Hour','时辰')} ${bwInline.shiChenLabel}<br>
        <span style="font-size:11px;color:var(--muted)">${bt('(Lunar Day computed via true synodic-month astronomy; Month/Year offset remains an algorithmic approximation - for ceremonial precision, cross-reference a Tong Sheng almanac)','（农历日期以真实朔望月天文算法推算；月／年份仍为演算法近似值 —— 如需礼俗级精确度，请查阅通胜历书）')}</span>
      </div>
      ${renderInfoRows([
        { label: 'Lunar Year Weight', value: `${bwInline.yearW} ${bt('Liang','两')}`, color: 'var(--plum)', bg: 'var(--goldsoft)' },
        { label: 'Lunar Month Weight', value: `${bwInline.monthW} ${bt('Liang','两')}`, color: 'var(--plum)', bg: 'var(--goldsoft)' },
        { label: 'Lunar Day Weight', value: `${bwInline.dayW} ${bt('Liang','两')}`, color: 'var(--plum)', bg: 'var(--goldsoft)' },
        { label: 'Birth Hour Weight', value: `${bwInline.hourW} ${bt('Liang','两')}`, color: 'var(--plum)', bg: 'var(--goldsoft)' },
        { label: 'Total Bone Weight', value: `${bwInline.displayStr} (${bwInline.total} ${bt('Liang','两')})`, color: bwTierInline.color, bg: '#fff' },
        { label: 'Fate Tier', value: bt(bwTierInline.tier, bwTierInline.tierZh), color: bwTierInline.color, bg: '#fff' }
      ])}
      ${generateDeepAnalysisData('boneWeight', p, {title: bt('Bone Weight Deep Analysis','称骨算命深度分析')})}
    </article>
    ${(() => {
      // ENHANCEMENT 4/5 FIX: Bone Weight compatibility vs Life/Business Partner, shown on the
      // Individual's own chart (where both other profiles are available to compare against).
      if (prefix !== 'i') return '';
      let blocks = '';
      if (u?.partner) {
        const partnerP = getProfileData(u.partner);
        blocks += `<article class="reading"><span class="pill">${trPill(`Bone Weight Compatibility - Life Partner`)}</span>${generateDeepAnalysisData('boneweight_compat', p, {title: `Bone Weight Compatibility with ${partnerP.displayName} (Life Partner)`, partnerP, isBusiness: false})}</article>`;
      }
      if (u?.businessPartner) {
        const bizP = getProfileData(u.businessPartner);
        blocks += `<article class="reading"><span class="pill">${trPill(`Bone Weight Compatibility - Business Partner`)}</span>${generateDeepAnalysisData('boneweight_compat', p, {title: `Bone Weight Compatibility with ${bizP.displayName} (Business Partner)`, partnerP: bizP, isBusiness: true})}</article>`;
      }
      return blocks;
    })()}
    ${renderKarmicDebtSection(p)}
  `;

  // BUG 3/5 FIX: Da Yun now its own section - shows the explicit calendar Start Year, and only the
  // cycles from the CURRENT age's cycle onward through age 100 (never everything from birth).
  const currentAge = profileAge;

  // ENHANCEMENT 4 FIX: Da Yun Summary Table - the current cycle through age 100, each tagged with its
  // 7-tier rating (Extremely Good..Extremely Bad), placed before the detailed cycle-by-cycle breakdown.
  const daYunSummaryRows = p.daYunPillars.filter(dy => (dy.age + 9) >= currentAge).map(dy => {
    const ageStart = dy.age, ageEnd = dy.age + 9;
    const isCurrent = currentAge >= ageStart && currentAge <= ageEnd;
    const tierLabel = bt(dy.rating.tierEN, dy.rating.tierZH);
    const tierAbbrLabel = bt(dy.rating.tierAbbr, dy.rating.tierAbbrZh);
    return `<tr style="${isCurrent ? 'background:var(--goldsoft);font-weight:700' : ''}">
      <td style="padding:6px 8px;border:1px solid #eee;text-align:center">${ageStart}-${ageEnd}${isCurrent ? bt(' (Now)',' (现在)') : ''}</td>
      <td style="padding:6px 8px;border:1px solid #eee;text-align:center">${dy.calendarYearStart}-${dy.calendarYearStart+9}</td>
      <td style="padding:6px 8px;border:1px solid #eee;text-align:center">${stemCN[dy.stemIdx]}${branchCN[dy.branchIdx]}</td>
      <td style="padding:6px 8px;border:1px solid #eee;text-align:center"><span style="display:inline-block;min-width:22px;color:#fff;background:${dy.rating.tierColor};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700" title="${tierLabel}">${tierAbbrLabel}</span></td>
    </tr>`;
  }).join('');
  const daYunSummaryTable = `
    <div style="margin-top:12px;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:#f4f4f4">
          <th style="padding:6px 8px;border:1px solid #eee">${bt('Ages','年龄')}</th>
          <th style="padding:6px 8px;border:1px solid #eee">${bt('Years','年份')}</th>
          <th style="padding:6px 8px;border:1px solid #eee">${bt('Pillar','干支')}</th>
          <th style="padding:6px 8px;border:1px solid #eee">${bt('Rating','评级')}</th>
        </tr>
        ${daYunSummaryRows}
      </table>
      ${renderRatingLegend(DAYUN_TIER_LABELS)}
    </div>
    <div class="calc-box" style="font-size:10px;margin-top:8px">${bt('This rating is a simplified heuristic based on each cycle\'s elemental relationship to your Day Master and Six Clash/Harmony against your natal Day Branch - not a full "Useful God" (用神) analysis, which requires determining your chart\'s overall strength. Treat this as a general orientation, not a precise forecast.', '此评级为简化推算，依据每个大运与您日主的五行关系及与本命日支的六冲/六合而定——并非完整的「用神」分析（需先判断命局强弱）。请将此视为大方向参考，而非精确预测。')}</div>
  `;
  let daYunBreakdown = `<div style="margin-top:15px">`;
  p.daYunPillars.forEach(dy => {
      let ageStart = dy.age; let ageEnd = dy.age + 9;
      if (ageStart <= 100 && ageEnd >= currentAge) {
          daYunBreakdown += generateDeepAnalysisData(`dayun_${ageStart}`, p, {title: `${ageStart} - ${ageEnd} Years Old (10-Year Cycle, ${dy.calendarYearStart}-${dy.calendarYearStart+9}) [${stems[dy.stemIdx].split(' ')[0]} ${branches[dy.branchIdx]}]`, dyStemIdx: dy.stemIdx, dyBranchIdx: dy.branchIdx, ageStart, ageEnd, calendarYearStart: dy.calendarYearStart});
      }
  });
  daYunBreakdown += `</div>`;

  // ENHANCEMENT (this round): 3-Year Monthly Da Yun Forecast (36 months, current calendar month
  // forward) - the current Da Yun content above only shows the 10-year PILLARS themselves, with no
  // monthly forward-looking auspiciousness scoring. See compute3YearDaYunMonthly (engine-metaphysics.js)
  // for the genuine cascading Day-Master/Da-Yun/Liu-Nian/Liu-Yue Wu Xing computation behind this table.
  const dayun3yr = compute3YearDaYunMonthly(p);
  const monthlyTierZhByEn = {}; MONTHLY_TIER_LABELS.forEach(t => monthlyTierZhByEn[t.en] = t.zh);
  const dayunStageNameEN = { dm_dayun: 'Day Master vs Da Yun', dayun_liunian: 'Da Yun vs Liu Nian', liunian_liuyue: 'Liu Nian vs Liu Yue' };
  const dayunStageNameZH = { dm_dayun: '日主与大运', dayun_liunian: '大运与流年', liunian_liuyue: '流年与流月' };
  const dayun3yrRows = dayun3yr.months.map(m => {
    const isBest = m === dayun3yr.best, isWorst = m === dayun3yr.worst;
    const reasonEN = `${dayunStageNameEN[m.dominant.key]}: ${WUXING_REL_LABEL[m.dominant.stemRel].en}`;
    const reasonZH = `${dayunStageNameZH[m.dominant.key]}：${WUXING_REL_LABEL[m.dominant.stemRel].zh}`;
    return `<tr style="${isBest ? 'background:#e8f5e9' : isWorst ? 'background:#fdeaea' : ''}">
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px;text-align:center">${m.year}</td>
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px;text-align:center">${String(m.month).padStart(2,'0')}</td>
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px;text-align:center">${stemCN[m.liuNianStemIdx]}${branchCN[m.liuNianBranchIdx]}</td>
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px;text-align:center">${stemCN[m.liuYueStemIdx]}${branchCN[m.liuYueBranchIdx]}</td>
      <td style="padding:4px 6px;border:1px solid #eee;text-align:center"><span style="display:inline-block;color:#fff;background:${m.tier.color};padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700">${bt(m.tier.en, m.tier.zh)}</span></td>
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt(reasonEN, reasonZH)}</td>
    </tr>`;
  }).join('');
  const artDaYun3YearMonthly = `
    <article class="reading">
      <span class="pill">${trPill('3-Year Monthly Da Yun Forecast')}</span>
      <div class="calc-box" style="font-size:11px">${bt('Every one of the next 36 months, scored by cascading your Day Master through its currently-governing Da Yun pillar, that year\'s Liu Nian, and that month\'s Liu Yue.', '未来36个月逐一评分，依序连锁计算您的日主、当期大运、当年流年及当月流月。')}</div>
      <div style="overflow-x:auto;margin-top:8px">
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:#f4f4f4">
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Year','年')}</th>
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Month','月')}</th>
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Liu Nian','流年')}</th>
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Liu Yue','流月')}</th>
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Tier','评级')}</th>
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Reason','原因')}</th>
          </tr>
          ${dayun3yrRows}
        </table>
      </div>
      ${renderRatingLegend(MONTHLY_TIER_LABELS)}
      ${calculatedAsOfLine()}
      ${generateDeepAnalysisData('dayun_3year_monthly', p, {title: '3-Year Monthly Da Yun Forecast', forecast: dayun3yr})}
    </article>
  `;

  // ENHANCEMENT (this round): matching 3-Year Monthly Western Astrology reading, rendered right
  // alongside the Da Yun 3-year reading above. See compute3YearAstroMonthly (engine-metaphysics.js)
  // for the honest scope note on exactly what this reading does and does not compute.
  const astro3yr = compute3YearAstroMonthly(p);
  const astro3yrRows = astro3yr.months.map(m => {
    const isBest = m === astro3yr.best, isWorst = m === astro3yr.worst;
    const relEN = m.sameSign ? 'solar-return month' : `${m.elemRel} element${m.sameModality ? ', same modality' : ''}`;
    const relZH = m.sameSign ? '本命回归月' : `${{same:'相同',complementary:'互补',challenging:'挑战性'}[m.elemRel]}元素${m.sameModality ? '，宫性相同' : ''}`;
    return `<tr style="${isBest ? 'background:#e8f5e9' : isWorst ? 'background:#fdeaea' : ''}">
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px;text-align:center">${m.year}</td>
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px;text-align:center">${String(m.month).padStart(2,'0')}</td>
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px;text-align:center">${bt(m.transitSign.en, m.transitSign.zh)}</td>
      <td style="padding:4px 6px;border:1px solid #eee;text-align:center"><span style="display:inline-block;color:#fff;background:${m.tier.color};padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700">${bt(m.tier.en, m.tier.zh)}</span></td>
      <td style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt(relEN, relZH)}</td>
    </tr>`;
  }).join('');
  const artAstro3YearMonthly = `
    <article class="reading">
      <span class="pill">${trPill('3-Year Monthly Western Astrology Match')}</span>
      <div class="calc-box" style="font-size:11px">${bt('A genuine Sun-sign-transit + Element/Modality reading for the same 36-month window as the Da Yun forecast above - not a full ephemeris-based transit system (no Moon, other planets, or houses). See the deep analysis below for the full honesty note.', '与上方大运预测同一36个月窗口的真实太阳行运星座＋元素／宫性解读——并非完整的星历行运系统（不含月亮、其他行星或宫位）。完整诚实说明请见下方深度分析。')}</div>
      <div style="overflow-x:auto;margin-top:8px">
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:#f4f4f4">
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Year','年')}</th>
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Month','月')}</th>
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Transiting Sign','行运星座')}</th>
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Tier','评级')}</th>
            <th style="padding:4px 6px;border:1px solid #eee;font-size:10px">${bt('Reason','原因')}</th>
          </tr>
          ${astro3yrRows}
        </table>
      </div>
      ${renderRatingLegend(MONTHLY_TIER_LABELS)}
      ${calculatedAsOfLine()}
      ${generateDeepAnalysisData('astro_3year_monthly', p, {title: '3-Year Monthly Western Astrology Match', forecast: astro3yr})}
    </article>
  `;

  const artDaYun = `
    <h2 class="section-header" ${idAttr('dayun')}>${flipTitle(`Da Yun (大运 - Major Luck Cycles)`)}</h2>
    <article class="reading">
      ${renderInfoRows([
        { label: 'Da Yun Start Year', value: `${p.daYunStartYear} (${bt('Age','年龄')} ${p.nominalStartAge})`, color: 'var(--plum)', bg: 'var(--goldsoft)' },
        { label: 'Exact Start Calculation', value: p.exactDaYunCalcStr, color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Current Age', value: `${currentAge}`, color: 'var(--success)', bg: '#e8f5e9' }
      ])}
      <div class="calc-box" style="font-size:11px">Showing Da Yun cycles from the present cycle through age 100. Calculated from your true-solar-time birth moment (longitude + timezone corrected) and the nearest governing solar term - fully dynamic per profile.</div>
      ${daYunSummaryTable}
      ${daYunBreakdown}
    </article>
    ${artDaYun3YearMonthly}
    ${artAstro3YearMonthly}
    ${(() => {
      // ENHANCEMENT (this round): Da Yun compatibility vs Life/Business Partner.
      if (prefix !== 'i') return '';
      let blocks = '';
      if (u?.partner) {
        const partnerP = getProfileData(u.partner);
        blocks += `<article class="reading"><span class="pill">${trPill(`Da Yun Compatibility - Life Partner`)}</span>${generateDeepAnalysisData('da_yun_compat', p, {title: `Da Yun Compatibility with ${partnerP.displayName} (Life Partner)`, partnerP, isBusiness: false})}</article>`;
      }
      if (u?.businessPartner) {
        const bizP = getProfileData(u.businessPartner);
        blocks += `<article class="reading"><span class="pill">${trPill(`Da Yun Compatibility - Business Partner`)}</span>${generateDeepAnalysisData('da_yun_compat', p, {title: `Da Yun Compatibility with ${bizP.displayName} (Business Partner)`, partnerP: bizP, isBusiness: true})}</article>`;
      }
      return blocks;
    })()}
  `;

  // BUG 2 FIX (round 4): full QMDJ Natal Matrix - Day Master, Deity, Star, Door, Stems, Ju Shu,
  // Wealth Palace, Life Palace, Life Door - all colour-coded.
  // UI FIX: the previous version crammed 5 lines of dense text into small 3x3 grid cells, which
  // wrapped unpredictably on narrow screens and broke the layout ("scrambled UI"). Replaced with a
  // simple, safe 3x3 direction/highlight grid (unchanged sizing) plus a clean per-palace detail list
  // below it, matching the row style used throughout the rest of the app.
  const q = p.qmdj;
  // BUG 17/18 FIX: QMDJ grid rebuilt to match the reference chart template's layout - an outer ring of
  // 8 directions (each showing its Bagua trigram name and representative zodiac branch) wrapping a
  // dense 3x3 inner grid where each cell shows both stems (Di Pan fixed + Tian Pan travelled), the
  // Deity, Star and Door, plus Yi Ma/Kong Wang/Life/Wealth markers - all from real computed data.
  const PALACE_DIR_INFO = {
    4: { dir:'SE', trigram:'Xun 巽', animal:'Snake', animalCN:'巳' }, 9: { dir:'S', trigram:'Li 离', animal:'Horse', animalCN:'午' }, 2: { dir:'SW', trigram:'Kun 坤', animal:'Goat', animalCN:'未' },
    3: { dir:'E', trigram:'Zhen 震', animal:'Rabbit', animalCN:'卯' }, 5: { dir:'', trigram:'', animal:'', animalCN:'' }, 7: { dir:'W', trigram:'Dui 兑', animal:'Rooster', animalCN:'酉' },
    8: { dir:'NE', trigram:'Gen 艮', animal:'Ox', animalCN:'丑' }, 1: { dir:'N', trigram:'Kan 坎', animal:'Rat', animalCN:'子' }, 6: { dir:'NW', trigram:'Qian 乾', animal:'Pig', animalCN:'亥' }
  };
  function qmdjCell(pal) {
    if (pal === 5) {
      return `<div class="qimen-cell-v2" style="background:#20273b;color:#fff">
        <div style="font-size:9px;opacity:0.85">${bt('Hour','时辰')}</div>
        <div style="font-size:10px;font-weight:700">${p.birthdate} ${p.birthtime}</div>
        <div style="font-size:9px;margin-top:4px;opacity:0.85">${bt('Day Master','日主')}</div>
        <div style="font-size:13px;font-weight:800;color:#f2c98a">${q.dayMasterStemCN} ${stems[p.bazi.dayStemIdx]}</div>
      </div>`;
    }
    const cell = q.grid[pal];
    const info = PALACE_DIR_INFO[pal];
    const isNatal = pal === q.natalPalace, isWealth = pal === q.wealthPalace;
    const isYiMa = pal === q.yiMaPalace, isKong = q.kongWangPalaces.includes(pal);
    const doorRating = QMDJ_DOOR_RATING[cell.door] || 'Neutral';
    const doorColor = doorRating === 'Auspicious' ? '#2e7d32' : doorRating === 'Caution' ? '#c62828' : '#757575';
    const tags = [isNatal ? bt('LIFE','命宫') : '', isWealth ? bt('WEALTH','财宫') : '', isYiMa ? '🐎' : '', isKong ? '◌空' : ''].filter(Boolean).join(' ');
    // ENHANCEMENT (reported directly: "Why is the QMDJ chart simplified. I remembered I asked to follow
    // attached sample QMDJ Chart with the full deep reading?" - the attached reference sample shows every
    // cell's Deity/Star/Door in FULL, including their Chinese characters, plus the Star's own 2nd
    // character rendered large as the cell's visual anchor). Root cause: this cell used to truncate Deity
    // and Star to `.split(' ').slice(0,2)`, which for a value like "Tian Peng (天蓬)" keeps only "Tian
    // Peng" and SILENTLY DROPS the Chinese characters entirely (the same truncation also stripped Door's
    // own Chinese) - stripping the very characters that make this a Chinese-metaphysics chart in the
    // first place, which is very likely what read as "simplified" against the reference. Fixed: Deity,
    // Star and Door now always show their FULL text (English + Chinese), and the Star's own second
    // Chinese character (its traditional single-glyph short name, e.g. 天蓬→蓬, 天心→心) is pulled out and
    // shown large and centered, exactly matching the reference sample's layout of one big central
    // character per palace. `.qimen-cell-v2` grew a little taller (see styles.css) to fit this without
    // reintroducing the earlier "5 lines crammed into a tiny box" scrambled-UI bug - overflow stays
    // hidden as a safety net either way.
    const starCJK = (cell.star.match(/\(([^)]+)\)/) || [])[1] || '';
    const starGlyph = starCJK.length >= 2 ? starCJK.slice(-1) : starCJK;
    return `<div class="qimen-cell-v2" style="${isNatal ? 'background:var(--goldsoft);border-color:var(--gold)' : isWealth ? 'background:#e3f2fd;border-color:#1565c0' : ''}">
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted)">
        <span>${bt('Di','地')} ${cell.diPanStem}</span>
        <span style="font-weight:700;color:var(--plum)">${bt('Tian','天')} ${cell.tianPanStem}</span>
      </div>
      <div style="font-size:9px;color:#7a4f00;margin-top:2px;line-height:1.25">${bt('Deity','神')}: ${cell.deity}</div>
      <div style="display:flex;align-items:center;gap:4px;margin:2px 0">
        ${starGlyph ? `<span style="font-size:20px;font-weight:800;color:#1565c0;line-height:1">${starGlyph}</span>` : ''}
        <span style="font-size:9px;color:#1565c0;line-height:1.25">${bt('Star','星')}: ${cell.star}</span>
      </div>
      <div style="font-size:10px;font-weight:700;color:${doorColor};line-height:1.25">${cell.door}</div>
      ${tags ? `<div style="font-size:8px;font-weight:800;margin-top:2px">${tags}</div>` : ''}
    </div>`;
  }
  function ringLabel(pal) {
    const info = PALACE_DIR_INFO[pal];
    return `<div class="qimen-ring-label">${info.dir} ${info.trigram}<br><span style="opacity:0.75">${bt(info.animal, info.animalCN)}</span></div>`;
  }
  const qmdjGridHTML = `<div class="qimen-grid-v2">
    <div></div>${ringLabel(4)}${ringLabel(9)}${ringLabel(2)}<div></div>
    <div></div>${qmdjCell(4)}${qmdjCell(9)}${qmdjCell(2)}<div></div>
    ${ringLabel(3)}${qmdjCell(3)}${qmdjCell(5)}${qmdjCell(7)}${ringLabel(7)}
    <div></div>${qmdjCell(8)}${qmdjCell(1)}${qmdjCell(6)}<div></div>
    <div></div>${ringLabel(8)}${ringLabel(1)}${ringLabel(6)}<div></div>
  </div>`;
  // BUG 7 FIX: Life Palace and Wealth Palace are pulled to the very top of the list (regardless of
  // their door rating), followed by the remaining palaces ordered Auspicious -> Neutral -> Caution.
  const doorOrderRank = { 'Auspicious': 0, 'Neutral': 1, 'Caution': 2 };
  const palacesForDoorList = [4,9,2,3,7,8,1,6].map(pal => ({ pal, cell: q.grid[pal], rating: QMDJ_DOOR_RATING[q.grid[pal].door] || 'Neutral' }))
    .sort((a, b) => {
      const rankOf = (x) => x.pal === q.natalPalace ? -2 : x.pal === q.wealthPalace ? -1 : doorOrderRank[x.rating];
      return rankOf(a) - rankOf(b);
    });
  const qmdjDetailListHTML = palacesForDoorList.map(({ pal, cell, rating: doorRating }) => {
      const isNatal = pal === q.natalPalace, isWealth = pal === q.wealthPalace;
      const dirLabel = {1:bt('North (坎)','北 (坎)'),2:bt('Southwest (坤)','西南 (坤)'),3:bt('East (震)','东 (震)'),4:bt('Southeast (巽)','东南 (巽)'),6:bt('Northwest (乾)','西北 (乾)'),7:bt('West (兑)','西 (兑)'),8:bt('Northeast (艮)','东北 (艮)'),9:bt('South (离)','南 (离)')}[pal];
      const tag = isNatal ? bt(' — Life Palace',' — 命宫') : (isWealth ? bt(' — Wealth Palace',' — 财帛宫') : '');
      const doorBadgeColor = doorRating === 'Auspicious' ? 'var(--success)' : doorRating === 'Caution' ? 'var(--danger)' : 'var(--muted)';
      const doorBadgeBg = doorRating === 'Auspicious' ? '#e8f5e9' : doorRating === 'Caution' ? '#fdeaea' : '#eee';
      const doorRatingLabel = bt(doorRating, doorRating === 'Auspicious' ? '吉门' : doorRating === 'Caution' ? '凶门' : '中性');
      const isYiMa = pal === q.yiMaPalace, isKong = q.kongWangPalaces.includes(pal);
      const specialTags = [isYiMa ? bt('🐎 Yi Ma (驿马, Travel-favourable)','🐎 驿马（宜出行）') : '', isKong ? bt('◌ Kong Wang (空亡, Void)','◌ 空亡') : ''].filter(Boolean).join(' &nbsp; ');
      return `<div style="padding:8px 10px;margin:5px 0;border-radius:0 8px 8px 0;background:${isNatal?'var(--goldsoft)':(isWealth?'#e3f2fd':'#f5f3ec')};border-left:4px solid ${isNatal?'var(--gold)':(isWealth?'#1565c0':'var(--line)')};font-size:12px">
        <strong style="color:var(--plum)">${bt('Palace','宫位')} ${pal} - ${dirLabel}${tag}</strong><br>
        <span style="color:var(--ink)">${bt('八神 Deity','八神')}: ${cell.deity} &nbsp;·&nbsp; ${bt('天盘 Star','天盘星')}: ${cell.star} &nbsp;·&nbsp; ${bt('人盘 Door','人盘门')}: ${cell.door} <span style="background:${doorBadgeBg};color:${doorBadgeColor};font-weight:700;padding:1px 6px;border-radius:8px;font-size:10px;margin-left:2px">${doorRatingLabel}</span></span><br>
        <span style="color:var(--muted);font-size:11px">${bt('地盘 Di Pan Stem (fixed)','地盘干（固定）')}: ${cell.diPanStem} &nbsp;·&nbsp; ${bt('天盘 Tian Pan Stem (rotated)','天盘干（旋转后）')}: ${cell.tianPanStem}</span>
        ${specialTags ? `<div style="margin-top:3px;font-size:11px;color:#7a4f00">${specialTags}</div>` : ''}
      </div>`;
  }).join('');
  // BUG 7 FIX: dedicated deep analysis with remedies for every Auspicious and Caution door found
  const doorDeepDives = palacesForDoorList.filter(x => x.rating !== 'Neutral').map(({ pal, cell, rating }) => {
      const dirLabel = {1:bt('North','北'),2:bt('Southwest','西南'),3:bt('East','东'),4:bt('Southeast','东南'),6:bt('Northwest','西北'),7:bt('West','西'),8:bt('Northeast','东北'),9:bt('South','南')}[pal];
      const isGood = rating === 'Auspicious';
      return generateDeepAnalysisData('qmdj_door', p, {
        title: `${bt('Palace','宫位')} ${pal} (${dirLabel}) - ${cell.door} ${bt(isGood ? 'Auspicious Door Deep Analysis' : 'Caution Door Deep Analysis', isGood ? '吉门深度分析' : '凶门深度分析')}`,
        door: cell.door, isGood, dirLabel, pal
      });
  }).join('');

  // ENHANCEMENT 8 FIX: Daily QMDJ Chart - cast fresh for today, with advice for the day vs this profile
  const daily = getDailyQmdjForProfile(p);
  const dailyGridHTML = `<div class="qimen-grid">
    ${[4,9,2,3,5,7,8,1,6].map(pal => {
      const isPersonal = pal === daily.personPalaceToday;
      const dirLabel = {1:'N 坎',2:'SW 坤',3:'E 震',4:'SE 巽',5:'Center 中',6:'NW 乾',7:'W 兑',8:'NE 艮',9:'S 离'}[pal];
      return `<div class="qimen-cell ${isPersonal?'active-palace':''}">
        <div>${dirLabel}</div>
        <div style="font-size:9px;opacity:0.8">Palace ${pal}</div>
        ${isPersonal ? `<div style="font-weight:800;font-size:9px;margin-top:2px">YOU TODAY</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
  const dailyQmdjHTML = `
    <article class="reading">
      <span class="pill">${bt('Daily QMDJ Chart', '每日奇门遁甲盘')} - ${daily.dateStr}</span>
      ${renderInfoRows([
        { label: 'Today\'s Solar Term / Dun', value: `${daily.todayQmdj.termName} · ${daily.todayQmdj.dun === 'yang' ? 'Yang Dun (阳遁)' : 'Yin Dun (阴遁)'}`, color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Today\'s Ju Shu', value: `${daily.todayQmdj.ju} (${daily.todayQmdj.yuanLabel})`, color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Your Palace Today', value: `Palace ${daily.personPalaceToday}`, color: 'var(--plum)', bg: 'var(--goldsoft)' },
        { label: 'Your Door Today', value: `${daily.cellToday.door} (${daily.doorRatingToday})`, color: daily.doorRatingToday === 'Auspicious' ? 'var(--success)' : daily.doorRatingToday === 'Caution' ? 'var(--danger)' : 'var(--muted)', bg: daily.doorRatingToday === 'Auspicious' ? '#e8f5e9' : daily.doorRatingToday === 'Caution' ? '#fdeaea' : '#eee' },
        { label: 'Yi Ma (Traveling Horse)', value: `${bt('Palace','宫')} ${daily.todayQmdj.yiMaPalace} (${QMDJ_DIR_LABEL[daily.todayQmdj.yiMaPalace] || ''})`, color: '#7a4f00', bg: '#fff3e0' },
        { label: 'Kong Wang (Void)', value: daily.todayQmdj.kongWangPalaces.map(pal => `${bt('Palace','宫')} ${pal} (${QMDJ_DIR_LABEL[pal] || ''})`).join(bt(' & ',' 及 ')), color: '#7a4f00', bg: '#fff3e0' }
      ])}
      ${dailyGridHTML}
      <div style="margin-top:12px;padding:10px;background:#fffaf0;border:1px solid #f0e0c0;border-radius:8px">
        <strong style="color:#7a4f00;font-size:13px">${bt('Suggested Positions for Favourable Activities Today','今日有利方位活动建议')}</strong>
        ${buildFavourableActivityPositions(daily.todayQmdj)}
      </div>
      ${generateDeepAnalysisData('daily_qmdj', p, { title: `Advice for Today - ${daily.dateStr}`, daily })}
      ${(() => {
        // ENHANCEMENT (reported: "QMDJ hourly forecast is missing" - a per-2-hour-block breakdown
        // within today's QMDJ chart itself, not the full detail already available on the separate
        // Hourly tab, which the PDF export never captures since it's a different screen). This reuses
        // the SAME computeHourlyHighlights engine already powering the Hourly tab, condensed into a
        // compact 12-row table that sits directly inside this section - so it's visible in-app right
        // next to today's chart, AND flows into the PDF export automatically (this whole article is
        // part of the profile's own chart, unlike the Hourly tab).
        const hourlyBlocks = computeHourlyHighlights(p, 0);
        const rowsHTML = hourlyBlocks.map(b => `
          <tr style="${b.isNow ? 'background:var(--goldsoft);font-weight:700' : ''}">
            <td style="padding:5px 6px;border:1px solid #eee;text-align:center">${b.label}${b.isNow ? bt(' (Now)',' (现在)') : ''}</td>
            <td style="padding:5px 6px;border:1px solid #eee;text-align:center">${b.stemCN}${b.branchCN}</td>
            <td style="padding:5px 6px;border:1px solid #eee;text-align:center">${bt('Palace','宫')} ${b.palace}</td>
            <td style="padding:5px 6px;border:1px solid #eee;text-align:center">${b.cell.door}</td>
            <td style="padding:5px 6px;border:1px solid #eee;text-align:center"><span style="display:inline-block;min-width:20px;color:#fff;background:${b.rating.tierColor};padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700" title="${bt(b.rating.tierEN, b.rating.tierZH)}">${bt(b.rating.tierAbbr, b.rating.tierAbbrZh)}</span></td>
          </tr>`).join('');
        return `
          <div style="margin-top:14px">
            <strong style="color:var(--plum);font-size:13px">${bt('Today\'s Hourly (Shi Chen) Breakdown','今日十二时辰速览')}</strong>
            <div style="font-size:11px;color:var(--muted);margin:4px 0 8px">${bt('A per-2-hour-block summary of today\'s QMDJ door and rating for your profile - see the Hourly tab in the app for the full detail (San Shi, suitable/avoid activities) behind each block.', '每两小时一个时辰的今日奇门遁甲门位与评级速览——完整细节（三式、宜忌活动）请见应用内「每小时」分页。')}</div>
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:11px">
                <tr style="background:#f4f4f4">
                  <th style="padding:5px 6px;border:1px solid #eee">${bt('Shi Chen','时辰')}</th>
                  <th style="padding:5px 6px;border:1px solid #eee">${bt('Hour Pillar','时柱')}</th>
                  <th style="padding:5px 6px;border:1px solid #eee">${bt('Palace','宫位')}</th>
                  <th style="padding:5px 6px;border:1px solid #eee">${bt('Door','门')}</th>
                  <th style="padding:5px 6px;border:1px solid #eee">${bt('Rating','评级')}</th>
                </tr>
                ${rowsHTML}
              </table>
            </div>
          </div>
        `;
      })()}
    </article>
  `;
  // BUG 1 FIX: artQmdj is no longer a standalone section - its content is now embedded directly
  // inside artSanShi below, since QMDJ moved into the San Shi (三式) category.

  // ENHANCEMENT 5 FIX: San Shi (三式) category - Tai Yi Shen Shu, Qi Men Dun Jia, and Da Liu Ren,
  // presented together as the traditional "Three Supreme Arts". QMDJ is now fully embedded here
  // (see BUG 1 FIX above) rather than being its own top-level section.
  const dlr = p.daLiuRen;
  const generalNameOnly = (g) => g ? g.split(' ')[0] : '';
  const siKeLabels = [bt('1st Class','第一课'), bt('2nd Class','第二课'), bt('3rd Class','第三课'), bt('4th Class','第四课')];
  const siKeRows = dlr.siKe.map((k, i) => ({
    label: siKeLabels[i],
    value: `${bt('Tian','天')} ${branchCN[k.tian]} (${branches[k.tian]}) / ${bt('Di','地')} ${branchCN[k.di]} (${branches[k.di]})`,
    color: 'var(--plum)', bg: '#f5f3ec'
  }));
  const artSanShi = `
    <h2 class="section-header" ${idAttr('sanshi')}>${flipTitle(`San Shi (三式 - Three Supreme Arts)`)}</h2>
    <article class="reading">
      <div class="calc-box" style="font-size:11px">${bt(
        'San Shi (三式) is the collective term for the three most sophisticated traditional Chinese divination systems, modelling the interaction of Heaven, Earth, and Man: Tai Yi Shen Shu (太乙神數, Heaven - macro/cosmic events), Qi Men Dun Jia (奇門遁甲, Earth - spatial/tactical timing, detailed in its own section above), and Da Liu Ren (大六壬, Man - day-to-day human affairs). An old saying holds: "He who understands the San Shi can converse with the gods" (精通三式，可與神明通).',
        '三式，是中国传统命理中最精深的三套占测体系的合称，分别对应天、地、人三才：太乙神数（天盘－宏观宇宙事件）、奇门遁甲（地盘－空间战术时机，详见上方专节）、大六壬（人盘－日常人事）。古语云：「精通三式，可与神明通」。'
      )}</div>
      <span class="pill">${trPill('Tai Yi Shen Shu (太乙神數)')}</span>
      <div class="calc-box" style="font-size:11px;margin-top:8px">${bt(
        'Tai Yi\'s traditional method tracks the Supreme One through 16 palaces to divine macro/national-scale events, and was historically restricted to court astrologers. Following the Tai Yi Jin Jing (太乙金鏡) yearly-cast mechanics you sourced, the full classical cast below - Accumulated Years, Bureau (Yang/Yin Dun), Tai Yi\'s own real Palace position, Ji Shen, the Three Foundations, Host Eye/Wen Chang, Guest Eye/Shi Ji, "the palace behind Tai Yi," the Host/Guest Counts (with their Harmony/Discordant verdicts), and now the Primary/Vice Generals - is genuinely calculated, not a proxy. The Macro Theme further below remains a supplementary, Day-Master-based reading alongside the real palace cast, not a replacement for it.',
        '太乙神数传统方法追踪「太乙」游历十六宫以占测宏观／国家级事件，历史上仅限宫廷星官使用。依你提供的《太乙金镜》年计排演法，下方完整的古法排盘——积年、局数（阳遁／阴遁）、太乙本身的真实落宫、计神、三基、天目文昌、地目始击、「太乙落后一宫」、主算／客算（含和／不和判断），以及现已纳入的大将／参将——现已全数据实推算，不再是替代性简化指标。下方的宏观主题解读，则作为搭配真实排盘的辅助参考（以日主为基准），而非取代排盘本身。'
      )}</div>
      ${(() => {
        const yc = p.taiYi.yearlyCast;
        return `
        <div style="font-size:12px;font-weight:700;color:var(--plum);margin-top:10px">${bt('Yearly Cast (年计) - Natal Year','年计——本命年份')}</div>
        ${renderInfoRows([
          { label: 'Accumulated Years (太乙积年)', value: `${yc.accumulatedYears.toLocaleString()}`, color: 'var(--plum)', bg: 'var(--goldsoft)' },
          { label: 'Bureau (太乙局)', value: `${bt(yc.dun === 'yang' ? 'Yang Dun' : 'Yin Dun', yc.dun === 'yang' ? '阳遁' : '阴遁')} ${yc.bureauNumber}`, color: 'var(--plum)', bg: 'var(--goldsoft)' },
          { label: 'Tai Yi Palace (太乙落宫)', value: `${yc.palace.name} (${yc.palace.cn}) ${yc.palace.num}`, color: 'var(--plum)', bg: '#fff' },
          { label: 'Year in Palace', value: `${bt(`Year ${yc.yearInPalace} - ${yc.phase.en}`, `第${yc.yearInPalace}年——${yc.phase.zh}`)}`, color: 'var(--plum)', bg: '#fff' },
          { label: 'Ji Shen (计神)', value: `${yc.jiShen.name} (${yc.jiShen.cn})`, color: 'var(--plum)', bg: '#fff' }
        ])}
        <div style="font-size:12px;font-weight:700;color:var(--plum);margin-top:10px">${bt('The Three Foundations (三基)','三基')}</div>
        ${renderInfoRows([
          { label: 'Jun Ji (君基 - Emperor)', value: `${yc.threeFoundations.junJi.name} (${yc.threeFoundations.junJi.cn})`, color: 'var(--plum)', bg: '#fff' },
          { label: 'Chen Ji (臣基 - Minister)', value: `${yc.threeFoundations.chenJi.name} (${yc.threeFoundations.chenJi.cn})`, color: 'var(--plum)', bg: '#fff' },
          { label: 'Min Ji (民基 - Citizen)', value: `${yc.threeFoundations.minJi.name} (${yc.threeFoundations.minJi.cn})`, color: 'var(--plum)', bg: '#fff' }
        ])}
        <div style="font-size:12px;font-weight:700;color:var(--plum);margin-top:10px">${bt('Host/Guest Eyes and Counts (文昌／始击 · 主算／客算)','文昌／始击・主算／客算')}</div>
        ${renderInfoRows([
          { label: 'Wen Chang (天目文昌 - Host Eye)', value: `${yc.wenChang.sector.sector} (${yc.wenChang.sector.cn})`, color: 'var(--plum)', bg: '#fff' },
          { label: 'Shi Ji (地目始击 - Guest Eye)', value: `${yc.shiJi.sector.sector} (${yc.shiJi.sector.cn})`, color: 'var(--plum)', bg: '#fff' },
          { label: 'Palace Behind Tai Yi (太乙落后一宫)', value: `${yc.behindPalace.name} (${yc.behindPalace.cn}) ${yc.behindPalace.num}`, color: 'var(--plum)', bg: '#fff' },
          { label: 'Host Count (主算)', value: `${yc.hostCount} - ${bt(yc.hostHarmony ? yc.hostHarmony.en : '', yc.hostHarmony ? yc.hostHarmony.zh : '')}`, color: 'var(--plum)', bg: yc.hostHarmony && yc.hostHarmony.code === 'he_ju' ? 'var(--goldsoft)' : '#fff' },
          { label: 'Guest Count (客算)', value: `${yc.guestCount} - ${bt(yc.guestHarmony ? yc.guestHarmony.en : '', yc.guestHarmony ? yc.guestHarmony.zh : '')}`, color: 'var(--plum)', bg: yc.guestHarmony && yc.guestHarmony.code === 'he_ju' ? 'var(--goldsoft)' : '#fff' }
        ])}
        <div style="font-size:12px;font-weight:700;color:var(--plum);margin-top:10px">${bt('Primary/Vice Generals (大将／参将)','大将／参将')}</div>
        ${renderInfoRows([
          { label: 'Host Primary General (主算大将)', value: `${bt(yc.hostGeneral.primary.name, yc.hostGeneral.primary.cn)} (${yc.hostGeneral.primary.num})${yc.hostGeneral.besieged ? ' - ' + bt('Besieged (入中)','入中') : ''}`, color: 'var(--plum)', bg: yc.hostGeneral.besieged ? '#f8e6e6' : '#fff' },
          { label: 'Host Vice General (主算参将)', value: `${bt(yc.hostGeneral.vice.name, yc.hostGeneral.vice.cn)} (${yc.hostGeneral.vice.num})`, color: 'var(--plum)', bg: '#fff' },
          { label: 'Guest Primary General (客算大将)', value: `${bt(yc.guestGeneral.primary.name, yc.guestGeneral.primary.cn)} (${yc.guestGeneral.primary.num})${yc.guestGeneral.besieged ? ' - ' + bt('Besieged (入中)','入中') : ''}`, color: 'var(--plum)', bg: yc.guestGeneral.besieged ? '#f8e6e6' : '#fff' },
          { label: 'Guest Vice General (客算参将)', value: `${bt(yc.guestGeneral.vice.name, yc.guestGeneral.vice.cn)} (${yc.guestGeneral.vice.num})`, color: 'var(--plum)', bg: '#fff' }
        ])}
        `;
      })()}
      ${renderInfoRows([
        { label: 'Tai Yi Macro Rating (supplementary theme)', value: bt(p.taiYi.tierEN, p.taiYi.tierZH), color: p.taiYi.tierColor, bg: '#fff' }
      ])}
      <div style="padding:10px;background:#f5f3ec;border-left:3px solid var(--gold);border-radius:0 8px 8px 0;font-size:12px;margin-top:6px">${bt(p.taiYi.themeEN, p.taiYi.themeZH)}</div>
      ${generateDeepAnalysisData('tai_yi', p, {title: 'Tai Yi Shen Shu Macro Deep Analysis'})}

      <span class="pill" style="margin-top:14px;display:inline-block">${trPill('Qi Men Dun Jia (奇門遁甲)')}</span>
      <div ${idAttr('qmdj')}></div>
      <div class="calc-box" style="font-size:11px;margin-top:8px">${bt('This chart is a 九宫八卦图 (Nine Palace, Eight Trigram chart): 地盘 Di Pan (Earth Plate) holds the 十天干 10 Heavenly Stems; 天盘 Tian Pan (Heaven Plate) carries the 9 Stars; 人盘 Ren Pan (Human Plate) carries the 8 Doors; 八神 Ba Shen (8 Gods) ride alongside on the Heaven Plate.', '本命盘为九宫八卦图：地盘承载十天干；天盘承载九星；人盘承载八门；八神则随天盘一同排布。')}</div>
      ${renderInfoRows([
        { label: 'Day Master', value: `${q.dayMasterStemCN} (${stems[p.bazi.dayStemIdx]})`, color: 'var(--plum)', bg: 'var(--goldsoft)' },
        { label: 'Solar Term / Dun Type', value: `${q.termName} · ${p.dunType}`, color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Ju Shu (Bureau Number)', value: `${q.ju} (${q.yuanLabel})`, color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Life Palace', value: `Palace ${q.natalPalace} (${p.palaceName})`, color: 'var(--success)', bg: '#e8f5e9' },
        { label: 'Life Door', value: q.lifeDoor, color: 'var(--success)', bg: '#e8f5e9' },
        { label: 'Wealth Palace', value: `Palace ${q.wealthPalace}`, color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Yi Ma (Traveling Horse)', value: `${bt('Palace','宫')} ${q.yiMaPalace} (${QMDJ_DIR_LABEL[q.yiMaPalace] || ''})`, color: '#7a4f00', bg: '#fff3e0' },
        { label: 'Kong Wang (Void)', value: q.kongWangPalaces.map(pal => `${bt('Palace','宫')} ${pal} (${QMDJ_DIR_LABEL[pal] || ''})`).join(bt(' & ',' 及 ')), color: '#7a4f00', bg: '#fff3e0' }
      ])}
      <details class="subsection-toggle">
        <summary class="subsection-toggle-summary">${bt('Show Full 9-Palace Chart & Details','显示完整九宫盘及详情')} <span class="section-chevron">▸</span></summary>
        <div class="subsection-toggle-body">
          ${qmdjGridHTML}
          <div style="margin-top:12px">${qmdjDetailListHTML}</div>
          <div style="margin-top:14px;padding:10px;background:#fffaf0;border:1px solid #f0e0c0;border-radius:8px">
            <strong style="color:#7a4f00;font-size:13px">${bt('Suggested Positions for Favourable Activities','有利方位活动建议')}</strong>
            ${buildFavourableActivityPositions(q)}
          </div>
          <div style="margin-top:10px">${doorDeepDives}</div>
          <div class="calc-box" style="font-size:11px">Day Pillar JiaZi Index #${p.bazi.dayGanzhi + 1} of 60 · Earth Plate cast from Ju ${q.ju} under ${p.dunType} · Heaven Plate (Deity/Star/Door) rotates with the same Luoshu stepping, so this entire matrix changes with your true-solar birth moment.</div>
        </div>
      </details>
      ${generateDeepAnalysisData('qmdj', p, {title: 'QMDJ Natal Palace Deep Profile'})}

      <span class="pill" style="margin-top:14px;display:inline-block">${trPill('Da Liu Ren (大六壬)')}</span>
      <div class="calc-box" style="font-size:11px;margin-top:8px">${bt(
        'Da Liu Ren addresses day-to-day human affairs via a Heaven Plate rotated from your natal true-solar Hour Branch against the governing Yue Jiang (月将, the Sun\'s zodiacal position). The Si Ke (四课, Four Classes) and San Chuan (三传, Three Transmissions) below were verified against a complete traditional worked example matching exactly across all four classes. San Chuan uses the primary Zei Ke (贼克) derivation method - the most common of several classical methods, not a full multi-method resolution.',
        '大六壬以您本命真太阳时的时支，配合当令月将（太阳所在黄道宫位）旋转出天盘，用以占测日常人事。以下四课与三传已对照一份完整的传统例题验证，四课结果完全吻合。三传采用主要的「贼克法」推演——为多种古法中最常用的一种，并非完整的多法综合判断。'
      )}</div>
      ${renderInfoRows([
        { label: 'Yue Jiang (月将)', value: `${branchCN[dlr.yueJiangBranchIdx]} (${branches[dlr.yueJiangBranchIdx]})`, color: '#1565c0', bg: '#e3f2fd' },
        ...siKeRows,
        { label: 'Chu Chuan (初传)', value: `${branchCN[dlr.chuChuan]} (${branches[dlr.chuChuan]}) - ${dlr.chuChuanGeneral}`, color: 'var(--success)', bg: '#e8f5e9' },
        { label: 'Zhong Chuan (中传)', value: `${branchCN[dlr.zhongChuan]} (${branches[dlr.zhongChuan]}) - ${dlr.zhongChuanGeneral}`, color: 'var(--success)', bg: '#e8f5e9' },
        { label: 'Mo Chuan (末传)', value: `${branchCN[dlr.moChuan]} (${branches[dlr.moChuan]}) - ${dlr.moChuanGeneral}`, color: 'var(--success)', bg: '#e8f5e9' }
      ])}
      ${generateDeepAnalysisData('da_liu_ren', p, {title: 'Da Liu Ren San Chuan Deep Analysis'})}
    </article>
    ${(() => {
      // BUG 1 FIX: QMDJ compatibility vs Life/Business Partner, now nested here since QMDJ moved
      // into the San Shi section (previously its own top-level section).
      if (prefix !== 'i') return '';
      let blocks = '';
      if (u?.partner) {
        const partnerP = getProfileData(u.partner);
        blocks += `<article class="reading"><span class="pill">${trPill(`QMDJ Compatibility - Life Partner`)}</span>${generateDeepAnalysisData('qmdj_compat', p, {title: `Qi Men Dun Jia Compatibility with ${partnerP.displayName} (Life Partner)`, partnerP, isBusiness: false})}</article>`;
      }
      if (u?.businessPartner) {
        const bizP = getProfileData(u.businessPartner);
        blocks += `<article class="reading"><span class="pill">${trPill(`QMDJ Compatibility - Business Partner`)}</span>${generateDeepAnalysisData('qmdj_compat', p, {title: `Qi Men Dun Jia Compatibility with ${bizP.displayName} (Business Partner)`, partnerP: bizP, isBusiness: true})}</article>`;
      }
      return blocks;
    })()}
    ${prefix === 'i' ? dailyQmdjHTML : ''}
  `;

  // ENHANCEMENT (this round): Health Diagnosis - traditional Wu Xing (Five Element) body-system
  // correspondence based on BaZi elemental balance, with a light San Shi cross-check. Framed strictly
  // as traditional/cultural reflection, never as medical diagnosis - see the prominent disclaimer.
  const health = computeHealthDiagnosis(p);
  const elemNameLocal = (i) => bt(health.systems[i].elemEN, health.systems[i].elemZH);
  const bodySystemRow = (i, kind) => {
    const sys = health.systems[i];
    const color = kind === 'deficient' ? '#c62828' : '#ef6c00';
    const bg = kind === 'deficient' ? '#fdeaea' : '#fff3e0';
    const kindLabel = kind === 'deficient' ? bt('Deficient','偏弱') : bt('Excessive','偏旺');
    // BUG 4 FIX: laterality (left/right) shown ONLY for Wood (Liver, classically "left") and Metal
    // (Lungs, classically "right") - see the WUXING_BODY_SYSTEMS comment in engine-metaphysics.js for
    // why the other three elements deliberately have no left/right claim attached.
    const lat = sys.laterality;
    const latHTML = lat
      ? `<div style="font-size:10px;color:${color};margin-top:3px;font-style:italic">${bt(`Classical qi-flow association: ${lat.en} (see note below on what this does and doesn't mean)`, `传统气机方位：${lat.zh}（详见下方说明，此非解剖学定位）`)}</div>`
      : `<div style="font-size:10px;color:var(--muted);margin-top:3px;font-style:italic">${bt('No left/right association exists in classical sources for this system.', '此系统在传统典籍中并无左右方位之说。')}</div>`;
    return `<div style="padding:9px 12px;margin:6px 0;border-radius:0 8px 8px 0;background:${bg};border-left:4px solid ${color}">
      <strong style="color:${color}">${elemNameLocal(i)} ${kindLabel}</strong> → ${bt(sys.en, sys.zh)}
      ${latHTML}
    </div>`;
  };
  const healthRows = [...health.deficient.map(i => bodySystemRow(i, 'deficient')), ...health.excessive.map(i => bodySystemRow(i, 'excessive'))].join('');
  const hasAnyLaterality = [...health.deficient, ...health.excessive].some(i => health.systems[i].laterality);
  const artHealthDiagnosis = `
    <h2 class="section-header" ${idAttr('healthdiagnosis')}>${flipTitle(`Health Diagnosis (健康分析)`)}</h2>
    <article class="reading">
      <div class="calc-box" style="font-size:11px;border-left-color:var(--danger);background:#fdeaea">${bt(
        '⚠️ This is a traditional Chinese Wu Xing (Five Element) reflection based on your BaZi chart\'s elemental balance - a cultural framework, NOT a medical diagnosis. It cannot detect, diagnose, or predict any actual health condition. For any real health concern, please consult a qualified healthcare professional - this section is not a substitute for medical advice.',
        '⚠️ 本节为基于您八字五行平衡状态的传统中华五行文化反思，并非医学诊断，无法检测、诊断或预测任何实际健康状况。如有任何真实健康疑虑，请咨询合格医疗专业人员——本节内容不能替代医疗建议。'
      )}</div>
      <div style="margin-top:10px;font-size:12px;color:var(--muted)">${bt(
        'Traditional Chinese Medicine associates each of the Five Elements with specific body systems: Wood-Liver/Gallbladder, Fire-Heart/Small Intestine, Earth-Spleen/Stomach, Metal-Lungs/Large Intestine, Water-Kidneys/Bladder. This reading looks at which elements are notably scarce or overrepresented across your Four Pillars (including hidden stems), since both extremes are traditionally considered to place more strain on the associated system.',
        '中医传统将五行分别对应特定身体系统：木－肝胆、火－心与小肠、土－脾胃、金－肺与大肠、水－肾与膀胱。本分析检视您四柱（含藏干）中哪些五行明显偏少或偏多，因为传统上两种极端皆被认为会为对应系统带来较大负担。'
      )}</div>
      ${healthRows || `<div class="calc-box" style="font-size:12px;border-left-color:var(--success);background:#e8f5e9;margin-top:10px">${bt('Your chart shows a relatively balanced elemental distribution across all Five Elements - traditionally a favourable sign, with no single system flagged as under particular strain.', '您的命盘五行分布较为均衡——传统上被视为吉象，未有单一系统被特别标注需留意。')}</div>`}
      ${hasAnyLaterality ? `<div class="calc-box" style="font-size:11px;margin-top:10px">${bt(
        'On the left/right notes above: classical Chinese medicine (Huangdi Neijing) describes Liver qi as rising on the left and Lung qi as descending on the right - but this describes a functional direction of qi movement, not a literal claim about which physical side of your body an issue would appear on. This specific pairing is also debated among practitioners, and no equivalent left/right teaching exists for Heart, Spleen, or Kidney in the same source, so those are correctly shown without one rather than an invented pairing.',
        '关于上方左右方位说明：中医典籍（《黄帝内经》）将肝气描述为从左侧升发、肺气从右侧肃降——但这指的是气机运行的功能方向，并非声称身体不适会实际出现在哪一侧。此说法本身在医家之间亦有争议，且心、脾、肾在同一典籍中并无对应的左右方位之说，因此这三者如实呈现为无方位标注，而非另行编造。'
      )}</div>` : ''}
      ${health.sanShiEcho !== null ? `<div class="calc-box" style="font-size:11px;margin-top:10px">${bt(`Supplementary San Shi note: today's Da Liu Ren natal Chu Chuan element (${elemNameLocal(health.sanShiEcho)}) echoes one of the flagged elements above - a minor corroborating signal, not an independent finding.`, `三式补充说明：本命大六壬初传五行（${elemNameLocal(health.sanShiEcho)}）与上方标注的五行相呼应——属次要佐证信号，非独立判断依据。`)}</div>` : ''}
      <div class="calc-box" style="font-size:11px;margin-top:10px">${bt(
        'General wellness basics apply regardless of any traditional reading: adequate rest, balanced nutrition, regular movement, and routine health check-ups with a qualified professional.',
        '无论传统命理如何解读，基本养生之道皆适用：充足休息、均衡饮食、规律运动，以及定期由合格专业人员进行健康检查。'
      )}</div>
    </article>
  `;
  // ENHANCEMENT (this round): full star-by-star Zi Wei Dou Shu reading, replacing the previous
  // Life/Body-Palace-only display - uses the newly-implemented 14-star placement engine and Si Hua
  // table (see engine-metaphysics.js for the cross-verified formulas behind this). Every palace/star
  // combination shown here is genuinely computed for this specific chart, not decorative.
  const yearStemIdx = p.bazi.yearStemIdx;
  const siHua = SI_HUA_TABLE[yearStemIdx];
  const siHuaLabels = { lu: bt('Hua Lu (化祿) - Prosperity','化祿 - 顺遂丰盈'), quan: bt('Hua Quan (化權) - Power','化權 - 权柄魄力'), ke: bt('Hua Ke (化科) - Recognition','化科 - 名声声望'), ji: bt('Hua Ji (化忌) - Obstacles','化忌 - 阻滞牵绊') };
  const siHuaByStarKey = {};
  Object.keys(siHua).forEach(kind => { if (siHua[kind]) siHuaByStarKey[siHua[kind]] = kind; });
  const uncoveredSiHua = Object.keys(siHua).filter(kind => !siHua[kind]);
  // Unified star metadata lookup across both major and minor star dictionaries, since starsByBranch
  // now contains both kinds of keys together.
  const zwdsStarInfo = (k) => ZWDS_MAJOR_STARS[k] || ZWDS_MINOR_STARS[k];
  const MINOR_KIND_BADGE = { auspicious: { symbol: '☆', color: '#1565c0' }, lucky: { symbol: '◆', color: '#2e7d32' }, malefic: { symbol: '▲', color: '#b71c1c' }, void: { symbol: '✕', color: '#6a1b9a' } };

  const palaceTableRows = ZWDS_PALACE_NAMES_BY_STEP_BACK.map((pname, stepBack) => {
    const branchIdx = mod(p.ziwei.lifePalaceBranchIdx - stepBack, 12);
    const starsHere = p.ziwei.starsByBranch[branchIdx];
    const starLabels = starsHere.map(k => {
      const info = zwdsStarInfo(k);
      const kind = siHuaByStarKey[k];
      const badge = kind ? ` <span style="color:#b8860b;font-weight:700">[${bt({lu:'Lu',quan:'Quan',ke:'Ke',ji:'Ji'}[kind], {lu:'祿',quan:'權',ke:'科',ji:'忌'}[kind])}]</span>` : '';
      const isMajor = !!ZWDS_MAJOR_STARS[k];
      const nameLabel = bt(info.en.split(' (')[0], info.cn);
      if (isMajor) return `${nameLabel}${badge}`;
      const mb = MINOR_KIND_BADGE[ZWDS_MINOR_STARS[k].kind];
      return `<span style="color:${mb.color};font-size:11px">${mb.symbol} ${nameLabel}</span>${badge}`;
    });
    return `<tr style="${stepBack===0?'background:var(--goldsoft);font-weight:700':''}">
      <td style="padding:6px 8px;border:1px solid #eee;font-size:11px">${bt(pname.en, pname.zh)}</td>
      <td style="padding:6px 8px;border:1px solid #eee;text-align:center;font-size:11px">${branchCN[branchIdx]}</td>
      <td style="padding:6px 8px;border:1px solid #eee;font-size:12px">${starLabels.length ? starLabels.join(', ') : `<span style="color:var(--muted)">${bt('(empty)','空宫')}</span>`}</td>
    </tr>`;
  }).join('');

  // Triple Alignment (San Fang Si Zheng, 三方四正): Life, Career, Wealth, and the opposite Travel
  // palace - per the standard method, these 4 together are read as the core indicator of identity,
  // talent, and financial capacity.
  const triplePalaces = [
    { name: bt('Life','命宫'), stepBack: 0 }, { name: bt('Career','官禄宫'), stepBack: 8 },
    { name: bt('Wealth','财帛宫'), stepBack: 4 }, { name: bt('Travel (opposite Life)','迁移宫（对宫）'), stepBack: 6 }
  ];
  const tripleHTML = triplePalaces.map(tp => {
    const branchIdx = mod(p.ziwei.lifePalaceBranchIdx - tp.stepBack, 12);
    const starsHere = p.ziwei.starsByBranch[branchIdx];
    const meanings = starsHere.map(k => {
      const info = zwdsStarInfo(k);
      const meaning = ZWDS_STAR_MEANING[k] || ZWDS_MINOR_STAR_MEANING[k];
      const nameLabel = bt(info.en.split(' (')[0], info.cn);
      return `<strong>${nameLabel}</strong>${ZWDS_MAJOR_STARS[k] ? '' : bt(' (minor)',' (辅星)')}: ${bt(meaning.en, meaning.zh)}`;
    });
    return `<div style="margin-bottom:8px"><strong style="color:var(--plum)">${tp.name}</strong> (${branchCN[branchIdx]})${meanings.length ? '<ul style="margin:4px 0 0;padding-left:20px;font-size:12px">' + meanings.map(m=>`<li>${m}</li>`).join('') + '</ul>' : `<div style="font-size:12px;color:var(--muted)">${bt('No major star occupies this palace directly - traditionally read via its Triple Alignment influences rather than in isolation.','此宫无主星坐守——传统上需参看三方四正的影响，而非单独解读。')}</div>`}</div>`;
  }).join('');

  const artZiWei = `
    <h2 class="section-header" ${idAttr('ziweidoushu')}>${flipTitle(`Zi Wei Dou Shu (紫微斗数)`)}</h2>
    <article class="reading">
      ${renderInfoRows([
        { label: 'Life Palace (命宫)', value: p.ziwei.lifePalaceName, color: 'var(--plum)', bg: 'var(--goldsoft)' },
        { label: 'Body Palace (身宫)', value: p.ziwei.bodyPalaceName, color: '#1565c0', bg: '#e3f2fd' }
      ])}
      <div class="calc-box" style="font-size:12px;margin-top:8px">${bt(`Five Element Bureau (五行局): ${['','','Water 2','Wood 3','Metal 4','Earth 5','Fire 6'][p.ziwei.bureau]} - derived from your Life Palace's NaYin element, this sets the mathematical basis for your Da Yun timing and star placement.`, `五行局：${['','','水二局','木三局','金四局','土五局','火六局'][p.ziwei.bureau]}——依您命宫纳音五行而定，是推算大限起运及主星排布的数理基础。`)}</div>
      ${generateDeepAnalysisData('ziwei', p, {title: 'Zi Wei Dou Shu Life/Body Palace Deep Profile'})}
    </article>
    <article class="reading">
      <span class="pill">${bt('Full Star Chart - 14 Major + 14 Minor Stars','全盘 - 十四主星与十四辅星')}</span>
      <div style="overflow-x:auto;margin-top:8px">
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:#f4f4f4">
            <th style="padding:6px 8px;border:1px solid #eee;font-size:11px">${bt('Palace','宫位')}</th>
            <th style="padding:6px 8px;border:1px solid #eee;font-size:11px">${bt('Branch','地支')}</th>
            <th style="padding:6px 8px;border:1px solid #eee;font-size:11px">${bt('Stars','星曜')}</th>
          </tr>
          ${palaceTableRows}
        </table>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px">${bt('☆ Six Auspicious Stars · ◆ Lu Cun/Tian Ma · ▲ Yang/Tuo malefics · ✕ Di Kong/Di Jie (void)','☆ 六吉星 · ◆ 禄存/天马 · ▲ 羊陀煞星 · ✕ 地空/地劫（空亡）')}</div>
      <div class="calc-box" style="font-size:11px;margin-top:8px">${bt('Covers the 14 major stars plus 14 of the most-referenced minor stars (the Six Auspicious Stars, Lu Cun, Tian Ma, Qing Yang/Tuo Luo, Di Kong/Di Jie, and Huo Xing/Ling Xing - the last two placed per Wang Tingzhi\'s Zhongzhou School formula). Not included: dozens of lesser auxiliary stars, and star brightness ratings (庙旺陷平).', '涵盖十四主星，另加十四颗最常参照的辅星（六吉星、禄存、天马、擎羊/陀罗、地空/地劫，以及火星/铃星——后两者按王亭之中州派安法排定）。未涵盖：数十颗次要辅星，以及星曜庙旺陷平评级。')}</div>
    </article>
    <article class="reading">
      <span class="pill">${bt('Full 12-Palace Chart Grid (紫微斗数命盘)','紫微斗数十二宫命盘')}</span>
      <div style="font-size:11px;color:var(--muted);margin-top:6px">${bt('The traditional square layout: each Earthly Branch always sits in the same fixed position on the grid, and which Palace name and stars fall into it are what differ from person to person.', '传统方形排盘：十二地支的位置固定不变，因人而异的是每个位置对应的宫位名称与所坐星曜。')}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,minmax(64px,auto));gap:2px;margin-top:10px;background:#ddd;border:1px solid #ddd">
        ${ZWDS_GRID_LAYOUT.map((branchIdx, gridPos) => {
          if (branchIdx === null) return ''; // the 2x2 center area is filled once, separately, below
          const stepBack = mod(p.ziwei.lifePalaceBranchIdx - branchIdx, 12);
          const pname = ZWDS_PALACE_NAMES_BY_STEP_BACK[stepBack];
          const isLifePalace = stepBack === 0;
          const isBodyPalace = branchIdx === p.ziwei.bodyPalaceBranchIdx;
          const starsHere = p.ziwei.starsByBranch[branchIdx];
          const starLabels = starsHere.map(k => {
            const info = zwdsStarInfo(k);
            const kind = siHuaByStarKey[k];
            const badge = kind ? ` <span style="color:#b8860b;font-weight:700">[${bt({lu:'Lu',quan:'Quan',ke:'Ke',ji:'Ji'}[kind], {lu:'祿',quan:'權',ke:'科',ji:'忌'}[kind])}]</span>` : '';
            const isMajor = !!ZWDS_MAJOR_STARS[k];
            const nameLabel = bt(info.en.split(' (')[0], info.cn);
            if (isMajor) return `<span style="font-weight:700">${nameLabel}</span>${badge}`;
            const mb = MINOR_KIND_BADGE[ZWDS_MINOR_STARS[k].kind];
            return `<span style="color:${mb.color}">${mb.symbol}${nameLabel}</span>${badge}`;
          });
          return `<div style="grid-column:${(gridPos % 4) + 1};grid-row:${Math.floor(gridPos / 4) + 1};background:${isLifePalace ? 'var(--goldsoft)' : '#fff'};padding:4px 5px;font-size:9px;line-height:1.4;min-height:64px">
            <div style="display:flex;justify-content:space-between;font-weight:700;color:var(--plum);border-bottom:1px solid #eee;padding-bottom:2px;margin-bottom:2px">
              <span>${bt(pname.en, pname.zh)}${isLifePalace ? ' ★' : ''}${isBodyPalace ? ' (身)' : ''}</span>
              <span style="color:var(--muted);font-weight:400">${branchCN[branchIdx]}</span>
            </div>
            <div>${starLabels.length ? starLabels.join('<br>') : `<span style="color:var(--muted)">${bt('(empty)','空宫')}</span>`}</div>
          </div>`;
        }).join('')}
        <div style="grid-column:2 / span 2;grid-row:2 / span 2;background:#faf8f2;padding:8px;font-size:10px;line-height:1.6;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
          <div style="font-weight:700;color:var(--plum);font-size:11px;margin-bottom:4px">${p.englishName}</div>
          <div>${p.birthdate}</div>
          <div style="margin-top:4px">${bt('Bureau','五行局')}: ${['','','Water 2 (水二局)','Wood 3 (木三局)','Metal 4 (金四局)','Earth 5 (土五局)','Fire 6 (火六局)'][p.ziwei.bureau]}</div>
          <div style="margin-top:2px">${bt('Life Palace','命宫')}: ${p.ziwei.lifePalaceName}</div>
          <div>${bt('Body Palace','身宫')}: ${p.ziwei.bodyPalaceName}</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px">★ ${bt('Life Palace','命宫')} · (身) ${bt('Body Palace','身宫')} · ${bt('bold = major star','粗体 = 主星')}</div>
    </article>
    <article class="reading">
      <span class="pill">${bt('Four Transformations (四化) This Lifetime','本命四化')}</span>
      <div style="font-size:12px;margin-top:8px">
        ${Object.keys(siHua).filter(kind => siHua[kind]).map(kind => {
          const starKey = siHua[kind];
          const branchIdx = p.ziwei.placements[starKey];
          const pname = zwdsPalaceNameForBranch(p.ziwei.lifePalaceBranchIdx, branchIdx);
          const starInfo = zwdsStarInfo(starKey);
          return `<div style="margin-bottom:6px"><strong style="color:#b8860b">${siHuaLabels[kind]}</strong>: ${bt(starInfo.en.split(' (')[0], starInfo.cn)} ${bt('in your','位于您的')} ${bt(pname.en, pname.zh)} (${branchCN[branchIdx]})</div>`;
        }).join('')}
        ${uncoveredSiHua.length > 0 ? `<div class="calc-box" style="font-size:11px">${bt(`Your birth-year stem also carries a ${uncoveredSiHua.join('/').toUpperCase()} transformation onto an auxiliary star outside this app's chart - not shown, rather than misapplied.`, `您的出生年干另有转化落于本应用命盘之外的辅星——此处不予显示，而非错误套用。`)}</div>` : ''}
      </div>
    </article>
    <article class="reading">
      <span class="pill">${bt('Triple Alignment (三方四正) - Life, Career, Wealth, Travel','三方四正——命、官、财、迁')}</span>
      <div style="font-size:12px;margin-top:8px;color:var(--muted)">${bt('The standard method for reading core identity, talent, and financial capacity: these four palaces together, not any single one in isolation.', '解读核心性格、才能与财力的标准方法：需综合此四宫，而非单看一宫。')}</div>
      <div style="margin-top:10px">${tripleHTML}</div>
    </article>
    ${(() => {
      // ENHANCEMENT 5/6 FIX: Zi Wei Dou Shu compatibility vs Life/Business Partner, with remedies.
      if (prefix !== 'i') return '';
      let blocks = '';
      if (u?.partner) {
        const partnerP = getProfileData(u.partner);
        blocks += `<article class="reading"><span class="pill">${trPill(`Zi Wei Compatibility - Life Partner`)}</span>${generateDeepAnalysisData('ziwei_compat', p, {title: `Zi Wei Dou Shu Compatibility with ${partnerP.displayName} (Life Partner)`, partnerP, isBusiness: false})}</article>`;
      }
      if (u?.businessPartner) {
        const bizP = getProfileData(u.businessPartner);
        blocks += `<article class="reading"><span class="pill">${trPill(`Zi Wei Compatibility - Business Partner`)}</span>${generateDeepAnalysisData('ziwei_compat', p, {title: `Zi Wei Dou Shu Compatibility with ${bizP.displayName} (Business Partner)`, partnerP: bizP, isBusiness: true})}</article>`;
      }
      return blocks;
    })()}
  `;

  // ENHANCEMENT 1: Chinese Bone Weight (称骨算命), fully dynamic per profile
  // Bone Weight (Cheng Gu Suan Ming) is now rendered inline within artMingLi, right after the BaZi
  // Natal Chart, per explicit request - see bwInline/bwTierInline near artMingLi's definition above.

  // BUG 7/17 FIX: Ba Zhai is ALWAYS computed fresh from the current profile + stored direction at
  // render time, and now includes a Luan Tou (峦头, Form School) subsection.
  const fsDirVal = prof?.fsDir || '';
  const dirOptions = BAZHAI_DIR_OPTIONS;
  let fsResultHTML = fsDirVal ? generateDeepAnalysisData('bazhai', p, { title: 'Ba Zhai Compass Deep Profile', direction: fsDirVal }) : '';

  // ENHANCEMENT 2/3: household (Individual + Life Partner) and full-roster (+ occupants) readings,
  // shown on the Individual's own chart where the full household context is available.
  const occupants = prefix === 'i' ? (prof?.bazhaiOccupants || []) : [];
  let householdBlock = '';
  if (prefix === 'i') {
    if (u?.partner) {
      const partnerP = getProfileData(u.partner);
      const householdHTML = fsDirVal ? generateDeepAnalysisData('bazhai_household', p, { title: `Household Ba Zhai Reading - You & ${partnerP.displayName}`, direction: fsDirVal, partnerP }) : generateDeepAnalysisData('bazhai_household', p, { title: `Household Ba Zhai Reading - You & ${partnerP.displayName}`, direction: '', partnerP });
      householdBlock += `<article class="reading"><span class="pill">${trPill(`Household Reading - You &amp; Life Partner`)}</span><div id="bazhai-household-analysis-i">${householdHTML}</div></article>`;
    }
    const people = buildHouseholdPeopleList(p, u, occupants);
    const occupantsHTML = generateDeepAnalysisData('bazhai_occupants', p, { title: 'Full Household Roster Deep Analysis', direction: fsDirVal, people: (occupants.length ? people : []) });
    // ENHANCEMENT (reported: "move the add occupants to be at the account page. the link from the feng
    // shui [tab points here]"): the actual add/edit roster UI (renderOccupantsListHTML) has moved to
    // its own dedicated section on the Account page (see renderAccountOccupantsList) - this reverses
    // an earlier round's decision, which only linked FROM Account TO here. What stays here is a short,
    // read-only summary (so the reading below still makes sense at a glance) plus a link that jumps to
    // the Account page's own Household Occupants section, the mirror image of the old Account-to-Feng-
    // Shui jump this replaces. The reading itself (occupantsHTML, based on the real saved roster) is
    // completely unaffected - only the add/edit form moved, not the data or the analysis of it.
    const occSummaryLine = occupants.length
      ? bt(`${occupants.length} occupant(s) on file - managed on the Account page's People section.`, `已登记 ${occupants.length} 位住户——于「账户」页面「成员」部分管理。`)
      : bt('No additional occupants added yet - add one on the Account page\'s People section.', '尚未添加额外住户——请于「账户」页面「成员」部分添加。');
    householdBlock += `
      <article class="reading">
        <span class="pill">${trPill(`Household Occupants (up to 10)`)}</span>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">${bt('For household members WITHOUT their own full profile - your Life Partner and children are already included in the roster above automatically. Adding them again here would double-count them.', '适用于尚未建立完整档案的家庭成员——您的生活伴侣与子女已自动纳入上方名单，请勿在此重复添加，以免重复计算。')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;background:#f5f3ec;border-radius:8px;margin-top:8px">
          <span style="font-size:12px;color:var(--ink)">${occSummaryLine}</span>
          <button class="btnGoAccountOccupants pdf-exclude" style="border:0;background:var(--gold);color:#fff;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0">${bt('Manage','管理')} →</button>
        </div>
        <div id="bazhai-occupants-analysis-${prefix}">${occupantsHTML}</div>
      </article>
    `;
    // ENHANCEMENT (Phase 2 - "Household compatibility: a compatibility-score table plus an overall
    // score plus deep analysis across every pair of family/household profiles" - see the
    // 'household_compat' branch above for why this was genuinely missing until now, not merely
    // under-surfaced). Unlike the Ba Zhai roster reading above, this does not depend on the selected
    // door direction at all - it's a pure person-to-person compatibility reading - so it's always
    // shown once at least 2 household members exist, direction selected or not.
    const compatRoster = buildHouseholdCompatibilityRoster(p, u, occupants);
    const compatHTML = generateDeepAnalysisData('household_compat', p, { title: 'Household Compatibility Deep Analysis', roster: compatRoster });
    householdBlock += `
      <article class="reading">
        <span class="pill">${trPill(`Household Compatibility`)}</span>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">${bt('Every household member above is compared pairwise using the same real compatibility engine as the Life/Business Partner readings elsewhere in this app.', '上方每位家庭成员均使用与本应用伴侣／事业伙伴契合度解读相同的真实评分引擎进行两两比对。')}</div>
        <div id="household-compat-analysis-${prefix}">${compatHTML}</div>
      </article>
    `;
  }

  const artFengShui = `
    <h2 class="section-header" ${idAttr('fengshui')}>${flipTitle(`Feng Shui (风水)`)}</h2>
    <article class="reading">
      <span class="pill">${trPill(`Ba Zhai Compass School (理气)`)}</span>
      <div class="calc-box">• <strong>Ba Zhai Kua:</strong> <strong>${p.kuaGroup} - Kua ${p.kuaNum}</strong></div>
      <div class="pdf-exclude">
        <label class="field" style="margin-top:10px"><span>Main Door Facing Direction * (Auto-updates Deep Assessment)</span>
          <select class="fs-dir-select" data-prefix="${prefix}" id="fs-dir-${prefix}" style="width:100%; padding:10px; margin-top:5px" autocomplete="off">
            <option value="" disabled ${!fsDirVal?'selected':''}>${bt('Select Direction','请选择方向')}</option>
            ${dirOptions.map(d => `<option value="${d}" ${fsDirVal===d?'selected':''}>${d} (${DIR_LABEL_ZH[d]})</option>`).join('')}
          </select>
        </label>
      </div>
      <div id="fs-result-${prefix}" style="margin-top:12px; ${fsResultHTML ? 'display:block' : 'display:none'}">${fsResultHTML}</div>
    </article>
    ${prefix === 'i' ? renderHomeDetailsBlock(u, fsDirVal) : ''}
    ${householdBlock}
    <article class="reading">
      <span class="pill">${trPill(`Flying Star (玄空飞星) - Current Annual/Monthly/Daily Stars`)}</span>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">${bt('Computed automatically from today\'s date - shows which numbers currently occupy each of the 9 palaces, independent of any specific property.', '依今日日期自动推算——显示当前各宫所值之数字，不涉及任何特定建筑物。')}</div>
      ${renderFlyingStarTemporalOverlay(p)}
    </article>
    <article class="reading">
      <span class="pill">${trPill(`Flying Star (玄空飞星) - Optional Property Calculator`)}</span>${needsInputBadge(!!(u?.home?.constructionYear && fsDirVal))}
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">${bt('A different Feng Shui school from Ba Zhai above - based on a SPECIFIC property\'s construction period and facing direction, not your personal Kua number. Enter a property\'s details to see its chart.', '与上方八宅法不同的风水流派——依据特定建筑物的建造年代与朝向而定，而非您个人的命卦。输入建筑物资料即可查看其飞星盘。')}</div>
      <div class="calc-box" style="font-size:11px;margin-bottom:10px;border-left-color:var(--danger)">${bt('Floor plan analysis is not offered by this app at all, deliberately - assigning the 9 palaces to actual rooms, doors, and interior features requires a physical site visit and a precise compass reading of your specific unit, which cannot be done from a description alone. If you want room-by-room guidance (which room to use as a bedroom, where to place a desk, etc.), that requires an in-person or video consultation with a qualified Feng Shui master who can assess your actual floor plan - the readings on this page are whole-property, not room-level.', '本应用完全不提供户型图分析——这属刻意的范围限定：将九宫对应至实际房间、门户及室内特征，需要实地勘察及针对您特定单位的精确罗盘测量，无法仅凭描述完成。若您需要逐房间的具体建议（如哪个房间适合作卧室、书桌应如何摆放等），需请合资格的风水师亲自到场或透过视像会诊评估您实际的户型图——本页面的解读均属整体建筑物层级，而非房间层级。')}</div>
      <div class="pdf-exclude">
        <div class="field-row">
          <label class="field" style="margin:0"><span style="font-size:12px">${bt('Construction Year','建造年份')}</span>
            <input type="number" id="fsYearInput_${prefix}" placeholder="e.g. 2015" min="1864" max="2043" value="${u?.home?.constructionYear || ''}" style="margin-top:5px; width:100%; padding:10px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
          </label>
          <label class="field" style="margin:0"><span style="font-size:12px">${bt('Facing Direction','朝向')}</span>
            <select id="fsFacingInput_${prefix}" style="margin-top:5px; width:100%; padding:10px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
              <option value="" disabled ${!fsDirVal?'selected':''}>${bt('Select','请选择')}</option>
              ${FLYING_STAR_DIR_OPTIONS.map(d => `<option value="${d}" ${DIR_FULL_TO_SHORT[fsDirVal]===d?'selected':''}>${bt(FLYING_STAR_DIR_LABEL_EN[d], FLYING_STAR_DIR_LABEL_ZH[d])}</option>`).join('')}
            </select>
          </label>
        </div>
        <button class="secondary btnCalcFlyingStar" data-prefix="${prefix}" style="width:100%; padding:12px; background:var(--gold); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; margin-top:8px">${bt('Calculate Flying Star Chart','计算飞星盘')}</button>
      </div>
      <div id="fsFlyingStarResult_${prefix}" style="margin-top:15px; ${(u?.home?.constructionYear && fsDirVal) ? 'display:block' : 'display:none'}">${(u?.home?.constructionYear && fsDirVal) ? renderFlyingStarResult(u.home.constructionYear, DIR_FULL_TO_SHORT[fsDirVal], p) : ''}</div>
    </article>
    ${prefix === 'i' && u?.home?.constructionYear && fsDirVal ? (() => {
      // ENHANCEMENT (Phase 2 - "House/Feng-Shui compatibility... driven off the address and birth
      // data collected in Phase 1" - closing the gap this app's OWN Flying Star honesty note flagged
      // directly above the Annual/Monthly/Daily overlay: "None of these charts have yet been read
      // against any specific property's own Mountain/Facing chart above - that combination reading is
      // a further step not attempted here." This is that further step: every household member's own
      // Kua-derived personal auspicious direction (Ba Zhai, above) is now cross-checked against what
      // this SPECIFIC property's own Flying Star chart (Mountain/Facing numbers) actually puts at
      // that exact direction - i.e. does the property's own fixed energy reinforce or undercut each
      // person's individual best zone, rather than the two systems being reported side by side with
      // no link between them.
      const fsHouseholdChart = computeFlyingStarChart(u.home.constructionYear, DIR_FULL_TO_SHORT[fsDirVal]);
      const fsRoster = buildHouseholdPeopleList(p, u, occupants);
      const kuaFsHTML = generateDeepAnalysisData('flyingstar_household_kua', p, { title: 'Household Kua x Flying Star Deep Analysis', chart: fsHouseholdChart, roster: fsRoster });
      return `
    <article class="reading">
      <span class="pill">${trPill(`Flying Star (玄空飞星) - Household Kua Cross-Reference`)}</span>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${bt('Combines this property\'s own Flying Star chart above with each household member\'s personal Kua-derived best direction, showing whether the property itself currently reinforces or undercuts that person\'s individual auspicious zone.', '将上方本物业的飞星盘与每位家庭成员依个人命卦所定的最佳方位相结合，显示此物业本身目前是强化还是削弱该成员的个人吉利区域。')}</div>
      <div id="fs-household-kua-analysis-${prefix}">${kuaFsHTML}</div>
    </article>
      `;
    })() : ''}
    <article class="reading">
      <span class="pill">${trPill(`Luan Tou (峦头) - Form School`)}</span>
      <div style="font-size:12px;color:var(--muted);margin:6px 0 10px">${getTopicShortDescription('luantou', p, {title: 'Luan Tou Form School Deep Analysis'})}</div>
      ${generateDeepAnalysisData('luantou', p, {title: 'Luan Tou Form School Deep Analysis'})}
    </article>
  `;

  // BUG 5 FIX: I Ching hexagram - all 3 compatible grouped into a single row, all 3 incompatible into a single row
  const compHexes = [8, 16, 24].map(off => mod(p.hexNo - 1 + off, 64) + 1);
  const incompHexes = [32, 40, 48].map(off => mod(p.hexNo - 1 + off, 64) + 1);
  const mhUpperName = bt(p.meiHua.upperTrigram.en, p.meiHua.upperTrigram.cn), mhLowerName = bt(p.meiHua.lowerTrigram.en, p.meiHua.lowerTrigram.cn);
  const ichingRows = renderPillarStyleTable([
    { label: 'Natal Hexagram', value: `#${p.hexNo} ${bt(p.meiHua.hexInfo.en, `${p.meiHua.hexInfo.cn} (${p.meiHua.hexInfo.py})`)} - ${mhUpperName} ${p.meiHua.upperTrigram.symbol} / ${mhLowerName} ${p.meiHua.lowerTrigram.symbol} (${bt('Line','爻')} ${p.meiHua.movingLine} ${bt('moving','动')})`, color: 'var(--plum)' },
    { label: 'Compatible Hexagrams', value: compHexes.map(h => `#${h}`).join(', '), color: 'var(--success)' },
    { label: 'Incompatible Hexagrams', value: incompHexes.map(h => `#${h}`).join(', '), color: 'var(--danger)' }
  ]);
  const artIChing = `
    <h2 class="section-header" ${idAttr('iching')}>${flipTitle(`I Ching (易经)`)}</h2>
    <article class="reading">
      <span class="pill">${trPill(`I Ching Divination`)}</span>
      <div style="margin:12px 0">${getHexagramSVG(p.meiHua.upperTrigramNum, p.meiHua.lowerTrigramNum, p.meiHua.movingLine)}</div>
      <div style="font-size:10px;color:var(--muted);margin:-8px 0 8px">${bt('Gold line marks the moving line (动爻).','金色爻线为动爻。')}</div>
      ${ichingRows}
      <div class="calc-box" style="font-size:11px">${bt('Cast via the Mei Hua Yi Shu (梅花易数) Year-Month-Day-Hour method using your own birth data, then mapped to its genuine King Wen sequence position and traditional name (verified against the classical inner/outer trigram record for all 64 hexagrams, not reconstructed from memory) - see the Deep Analysis below for how this was calculated. The "#N" compatible/incompatible references below are real King Wen sequence numbers.', '依梅花易数「年月日时起卦法」，以您本人的出生数据实际起卦，并对应至真实的周易卦序及传统卦名（依六十四卦完整的上下卦记录逐一核实，而非凭记忆重建）——详细推算方式见下方深度分析。以下「#N」相合／相冲编号均为真实的周易卦序编号。')}</div>
      ${generateDeepAnalysisData('iching', p, {title: 'I-Ching Natal Hexagram Profile'})}
    </article>
    ${(() => {
      // ENHANCEMENT 1/2 FIX: I Ching compatibility vs Life/Business Partner, shown on the
      // Individual's own chart where both other profiles are available to compare against.
      if (prefix !== 'i') return '';
      let blocks = '';
      if (u?.partner) {
        const partnerP = getProfileData(u.partner);
        blocks += `<article class="reading"><span class="pill">${trPill(`I Ching Compatibility - Life Partner`)}</span>${generateDeepAnalysisData('iching_compat', p, {title: `I Ching Compatibility with ${partnerP.displayName} (Life Partner)`, partnerP, isBusiness: false})}</article>`;
      }
      if (u?.businessPartner) {
        const bizP = getProfileData(u.businessPartner);
        blocks += `<article class="reading"><span class="pill">${trPill(`I Ching Compatibility - Business Partner`)}</span>${generateDeepAnalysisData('iching_compat', p, {title: `I Ching Compatibility with ${bizP.displayName} (Business Partner)`, partnerP: bizP, isBusiness: true})}</article>`;
      }
      return blocks;
    })()}
  `;

  // BUG 6 FIX: Ze Ri Date Checker - tier finder + a dedicated specific-date deep analysis checker
  // PAGINATION FIX (reported: "Ze Ri date selection is not required as there is no information unless
  // user initiated"): this whole section is two interactive pickers (a date-checker and a tier-search)
  // with no persisted result - both articles below are already 'pdf-exclude' and get stripped before
  // capture, but the <h2> heading above them was NOT, so the PDF still carried the "Ze Ri" heading (and
  // a Table of Contents entry) pointing at an empty page. In PDF export mode the entire section is now
  // skipped outright, since there is never any static content for it to show.
  const artZeRi = pdfExportMode ? '' : `
    <h2 class="section-header" ${idAttr('zeri')}>${flipTitle(`Ze Ri (择日 - Date Selection)`)}</h2>
    <article class="reading pdf-exclude">
      <span class="pill">${trPill(`Check a Specific Date`)}</span>
      <div style="padding:12px; background:#fff; border-radius:10px; border:1px solid var(--line); margin-top:10px">
        <label class="field" style="margin:0"><span style="font-size:12px">${bt('Date to Analyse','选择日期')}</span>
            <input type="date" id="zrCheckDate_${prefix}" value="${sgDateStr}" style="margin-top:5px; margin-bottom:10px; width:100%; padding:10px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
        </label>
        <button class="secondary btnCheckSpecificDate" data-prefix="${prefix}" style="width:100%; padding:12px; background:var(--plum); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer">${bt('Run Deep Analysis on This Date','对此日期进行深度分析')}</button>
        <div id="zrCheckResult_${prefix}" style="margin-top:15px; display:none"></div>
      </div>
    </article>
    <article class="reading pdf-exclude">
      <div style="padding:12px; background:#fff; border-radius:10px; border:1px solid var(--line);">
        <label class="field" style="margin:0"><span style="font-size:12px">${bt('Start Searching From Date','起始搜寻日期')}</span>
            <input type="date" id="zrStart_${prefix}" min="${sgDateStr}" value="${sgDateStr}" style="margin-top:5px; margin-bottom:10px; width:100%; padding:10px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
        </label>
        <label class="field" style="margin:0 0 10px"><span style="font-size:12px">${bt('Auspicious / Inauspicious Tier','吉凶等级')}</span>
            <select id="zrTier_${prefix}" style="margin-top:5px; width:100%; padding:10px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
              <option value="Extremely Auspicious">${bt('Extremely Auspicious','大吉')}</option>
              <option value="Highly Auspicious">${bt('Highly Auspicious','颇吉')}</option>
              <option value="Auspicious" selected>${bt('Auspicious','吉')}</option>
              <option value="Inauspicious">${bt('Inauspicious','凶')}</option>
              <option value="Highly Inauspicious">${bt('Highly Inauspicious','颇凶')}</option>
              <option value="Extremely Inauspicious">${bt('Extremely Inauspicious','大凶')}</option>
            </select>
        </label>
        <button class="secondary btnFindDates" data-prefix="${prefix}" style="width:100%; padding:12px; background:var(--gold); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer">${bt('Find Dates in This Tier','查询此等级日期')}</button>
        <div id="zrResults_${prefix}" style="margin-top:15px; display:none"></div>
      </div>
    </article>
  `;

  // BUG 8 FIX: Consolidated + separate Face/Left Palm/Right Palm deep analyses
  const artXiangShu = `
    <h2 class="section-header" ${idAttr('xiangshu')}>${flipTitle(`Xiang Shu (相术 - Physiognomy)`)}</h2>
    <article class="reading pdf-exclude">
      <span class="pill">${trPill(`Face Reading (面相) - Self-Report Calculator`)}</span>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">${bt('This app has no photo analysis capability, so the generic sections below cannot reference your actual features. Select what best matches your own face for a genuinely personalized reading instead.', '本应用不具备照片分析功能，因此下方一般性内容无法参照您的实际五官。请选择最符合您面容的选项，以获得真正个人化的解读。')}</div>
      <div class="field-row">
        <label class="field" style="margin:0"><span style="font-size:12px">${bt('Face Shape','脸型')}</span>
          <select id="xsFaceInput_${prefix}" style="margin-top:5px; width:100%; padding:10px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
            <option value="" disabled selected>${bt('Select','请选择')}</option>
            ${Object.keys(XIANG_SHU_FACE_SHAPE_OPTIONS).map(k => `<option value="${k}">${bt(XIANG_SHU_FACE_SHAPE_OPTIONS[k].en, XIANG_SHU_FACE_SHAPE_OPTIONS[k].zh)}</option>`).join('')}
          </select>
        </label>
        <label class="field" style="margin:0"><span style="font-size:12px">${bt('Eyes','眼睛')}</span>
          <select id="xsEyesInput_${prefix}" style="margin-top:5px; width:100%; padding:10px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
            <option value="" disabled selected>${bt('Select','请选择')}</option>
            ${Object.keys(XIANG_SHU_EYES_OPTIONS).map(k => `<option value="${k}">${bt(XIANG_SHU_EYES_OPTIONS[k].en, XIANG_SHU_EYES_OPTIONS[k].zh)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="field-row">
        <label class="field" style="margin:0"><span style="font-size:12px">${bt('Nose','鼻子')}</span>
          <select id="xsNoseInput_${prefix}" style="margin-top:5px; width:100%; padding:10px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
            <option value="" disabled selected>${bt('Select','请选择')}</option>
            ${Object.keys(XIANG_SHU_NOSE_OPTIONS).map(k => `<option value="${k}">${bt(XIANG_SHU_NOSE_OPTIONS[k].en, XIANG_SHU_NOSE_OPTIONS[k].zh)}</option>`).join('')}
          </select>
        </label>
        <label class="field" style="margin:0"><span style="font-size:12px">${bt('Mouth','嘴巴')}</span>
          <select id="xsMouthInput_${prefix}" style="margin-top:5px; width:100%; padding:10px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
            <option value="" disabled selected>${bt('Select','请选择')}</option>
            ${Object.keys(XIANG_SHU_MOUTH_OPTIONS).map(k => `<option value="${k}">${bt(XIANG_SHU_MOUTH_OPTIONS[k].en, XIANG_SHU_MOUTH_OPTIONS[k].zh)}</option>`).join('')}
          </select>
        </label>
      </div>
      <label class="field"><span style="font-size:12px">${bt('Chin','下巴')}</span>
        <select id="xsChinInput_${prefix}" style="margin-top:5px; width:100%; padding:10px; border:1px solid #ccc; border-radius:4px" autocomplete="off">
          <option value="" disabled selected>${bt('Select','请选择')}</option>
          ${Object.keys(XIANG_SHU_CHIN_OPTIONS).map(k => `<option value="${k}">${bt(XIANG_SHU_CHIN_OPTIONS[k].en, XIANG_SHU_CHIN_OPTIONS[k].zh)}</option>`).join('')}
        </select>
      </label>
      <button class="secondary btnCalcXiangShu" data-prefix="${prefix}" style="width:100%; padding:12px; background:var(--gold); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; margin-top:8px">${bt('Generate My Reading','生成我的解读')}</button>
      <div id="xsResult_${prefix}" style="margin-top:15px; display:none"></div>
    </article>
    <article class="reading">
      <span class="pill">${trPill(`Consolidated Face & Palmistry`)}</span>
      ${generateDeepAnalysisData('physiognomy', p, {title: 'Consolidated Face, Left Palm & Right Palm Deep Analysis'})}
    </article>
    <article class="reading">
      <span class="pill">${trPill(`Face (面相) Individual Deep Analysis`)}</span>
      ${generateDeepAnalysisData('face', p, {title: 'Face Reading Deep Analysis'})}
    </article>
    <article class="reading">
      <span class="pill">${trPill(`Left Palm (左手) Individual Deep Analysis`)}</span>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${bt('Honesty note: unlike the Face Reading above, this app does not yet collect palm line features (e.g. life, head, and heart line characteristics), so the section below remains general rather than personalized to your specific palm.', '诚实说明：与上方面相解读不同，本应用尚未收集掌纹特征（如生命线、智慧线、感情线等特点），因此以下内容仍属一般性说明，未针对您个人掌纹作个人化解读。')}</div>
      ${generateDeepAnalysisData('palm_left_deep', p, {title: 'Left Palm Reading Deep Analysis'})}
    </article>
    <article class="reading">
      <span class="pill">${trPill(`Right Palm (右手) Individual Deep Analysis`)}</span>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${bt('Honesty note: same limitation as the Left Palm section above - palm line features are not yet collected, so this remains general.', '诚实说明：与上方左手部分相同的限制——尚未收集掌纹特征，故此处内容仍属一般性说明。')}</div>
      ${generateDeepAnalysisData('palm_right_deep', p, {title: 'Right Palm Reading Deep Analysis'})}
    </article>
  `;

  // Numerology, now its own section
  const artNumerology = `
    <h2 class="section-header" ${idAttr('numerology')}>${flipTitle(`Numerology (数字命理)`)}</h2>
    <article class="reading">
      ${renderInfoRows([
        { label: 'Life Path Number', value: p.life, color: 'var(--plum)', bg: 'var(--goldsoft)' },
        { label: 'Life Lucky Number (4-digit)', value: p.lifeLuckyNumber, color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Favorable Numbers', value: p.numCompat.join(', '), color: 'var(--success)', bg: '#e8f5e9' },
        { label: 'Avoid Numbers', value: p.numAvoid.join(', '), color: 'var(--danger)', bg: '#fdeaea' }
      ])}
      ${generateDeepAnalysisData('numerology', p, {title: 'Numerology Life Path Profile'})}
    </article>
    ${renderWesternNameNumerologyBlock(p)}
    ${(() => {
      // ENHANCEMENT 3/4 FIX: Numerology compatibility vs Life/Business Partner.
      if (prefix !== 'i') return '';
      let blocks = '';
      if (u?.partner) {
        const partnerP = getProfileData(u.partner);
        blocks += `<article class="reading"><span class="pill">${trPill(`Numerology Compatibility - Life Partner`)}</span>${generateDeepAnalysisData('numerology_compat', p, {title: `Numerology Compatibility with ${partnerP.displayName} (Life Partner)`, partnerP, isBusiness: false})}</article>`;
      }
      if (u?.businessPartner) {
        const bizP = getProfileData(u.businessPartner);
        blocks += `<article class="reading"><span class="pill">${trPill(`Numerology Compatibility - Business Partner`)}</span>${generateDeepAnalysisData('numerology_compat', p, {title: `Numerology Compatibility with ${bizP.displayName} (Business Partner)`, partnerP: bizP, isBusiness: true})}</article>`;
      }
      return blocks;
    })()}
  `;

  // Western Astrology, now its own section (with the current + 3-year forecast)
  const artWesternAstrology = `
    <h2 class="section-header" ${idAttr('westernastrology')}>${flipTitle(`Western Astrology (占星术)`)}</h2>
    <article class="reading">
      <div style="display:flex; gap:14px; margin:12px 0; flex-wrap:wrap; align-items:center;">${getCalculatedAstrologyChartHTML(p)}${getNatalChartDiagramHTML(p)}${getNatalOuterPlanetsLegendHTML(p)}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${bt(`The two wheels above plot all 12 natal points: your real natal Sun (its own large marker), the Moon, Mercury, Venus, Mars, the 5 outer planets (Jupiter, Saturn, Uranus, Neptune, Pluto), and the Moon's North/South Node (the "eclipse" axis - the two points where solar/lunar eclipses occur) - each a real computed position, spread across 3 rings purely to keep the glyphs legible.${p?.houses ? ` They also now draw your real 12 houses (thin lines radiating from the Ascendant, labelled 1-12, Equal House system) - your Ascendant is ${p.houses.ascendantSign.en}.` : ' House lines are not drawn for this profile yet - that needs a birth latitude, which is not currently on file (add one via the country/city selector).'} The Full Natal Chart table below lists every one of these 12 points with its sign${p?.houses ? ' and house' : ''}.`,
        `以上两个星盘标示全部12个本命点：您真实的本命太阳（以独立的大型标记显示）、月亮、水星、金星、火星、五颗外行星（木星、土星、天王星、海王星、冥王星），以及月亮的北／南交点（即「日月食」轴线——日食／月食发生的两个交点）——每一点均为真实计算所得的位置，并分布于3层圆环中，纯粹为保持图标清晰可辨。${p?.houses ? `星盘现亦绘出您真实的十二宫位（自上升点放射而出的细线，标示1至12，采用等宫制）——您的上升星座为${p.houses.ascendantSign.zh}。` : '此档案暂未绘制宫位线——需要出生纬度数据，目前尚未记录（请透过国家／城市选单补充）。'}下方「完整本命盘」表格列出全部12个本命点及其所在星座${p?.houses ? '与宫位' : ''}。`)}</div>
      ${renderInfoRows([
        { label: 'Sun Sign', value: p.astro.en, color: 'var(--plum)', bg: 'var(--goldsoft)' },
        { label: 'Compatible Signs', value: bt(p.astro.comp, translateSignList(p.astro.comp)), color: 'var(--success)', bg: '#e8f5e9' },
        { label: 'Incompatible Signs', value: bt(p.astro.incomp, translateSignList(p.astro.incomp)), color: 'var(--danger)', bg: '#fdeaea' }
      ])}
      ${generateDeepAnalysisData('astro', p, {title: 'Sun Sign Astrology Profile'})}
    </article>
    <article class="reading">
      <span class="pill">${trPill('Full Natal Chart Deep Reading (All Planets)')}</span>
      ${generateNatalFullChartHTML(p)}
    </article>
    ${(() => {
      // ENHANCEMENT 2 FIX: Astrology Compatibility now shown BEFORE the Current & 3-Year Forecast
      // (previously the Forecast came first).
      if (prefix !== 'i') return '';
      // ENHANCEMENT (requested directly: "% is missing" from the Western Astrology section) - a visible
      // score box ahead of the "View Details" button, matching how every other compatibility reading in
      // this app (BaZi/Zodiac, Mobile Number, Vehicle Plate, Address) already shows its score at a glance
      // rather than only inside the collapsed deep-analysis card. Reuses the exact same computeSynastryScore
      // engine the deep-analysis card itself calls (engine-metaphysics.js) - not a second source of truth.
      const astroSynastryBox = (targetP) => {
        if (!(p?.bazi?.birthMomentUTC && targetP?.bazi?.birthMomentUTC)) return '';
        const chartA = computeFullNatalChart(p.bazi.birthMomentUTC), chartB = computeFullNatalChart(targetP.bazi.birthMomentUTC);
        const sunAdj = p.astro.comp.includes(targetP.astro.en) ? 3 : p.astro.incomp.includes(targetP.astro.en) ? -3 : 0;
        const syn = computeSynastryScore(chartA, chartB, sunAdj);
        return `<div class="calc-box" style="margin-bottom:10px"><strong>${bt('Astrology Compatibility Score','占星契合度评分')}: <span style="font-size:18px;color:var(--plum)">${syn.score}%</span></strong></div>`;
      };
      let blocks = '';
      if (u?.partner) {
        const partnerP = getProfileData(u.partner);
        blocks += `<article class="reading"><span class="pill">${trPill(`Astrology Compatibility - Life Partner`)}</span>${astroSynastryBox(partnerP)}${generateDeepAnalysisData('astro_compat', p, {title: `Astrology Compatibility with ${partnerP.displayName} (Life Partner)`, partnerP, isBusiness: false})}</article>`;
      }
      if (u?.businessPartner) {
        const bizP = getProfileData(u.businessPartner);
        blocks += `<article class="reading"><span class="pill">${trPill(`Astrology Compatibility - Business Partner`)}</span>${astroSynastryBox(bizP)}${generateDeepAnalysisData('astro_compat', p, {title: `Astrology Compatibility with ${bizP.displayName} (Business Partner)`, partnerP: bizP, isBusiness: true})}</article>`;
      }
      return blocks;
    })()}
    <h3 style="margin:16px 0 4px">${flipTitle(`Annual Deep Reading - Current Year + Next 2 Years (流年深度解读)`)}</h3>
    ${generateAnnualDeepReadingHTML(p)}
    ${generateMonthlyDeepReadingHTML(p)}
  `;

  // Bug 6/7/14/15/20/22: Partner Compatibility Deep Profiles, grounded in the real Wu Xing/Clash/Harmony breakdown
  // BUG FIX (reported: "no summary on the compatibility... only a link to view the deep analysis"):
  // previously this section showed ONLY a pill label followed immediately by the collapsed "View
  // Details" button - no score, no takeaway visible without clicking. Added a visible summary box
  // (score + top finding) ahead of that button, reusing the same compatResult already computed for
  // this page - matching how the home-page summary cards already show this info without a click.
  let compatHTML = '';
  // BUG FIX (reported: "compatibility reading should encompass all aspects... not just the
  // elements"): this summary box previously showed only breakdown[0], which is always the elemental
  // Day Master line (added first in calculateTrueCompatibility) - every other computed factor (Day
  // Branch clash/harmony, Kua group, Bone Weight, I Ching, Numerology, QMDJ, Zi Wei Dou Shu, Western
  // Astrology, Da Yun) was silently dropped from view even though it was genuinely calculated. Now
  // shows the full breakdown list, so what's displayed matches what was actually computed.
  const compatSummaryBox = (cr) => cr ? `<div class="calc-box" style="margin-bottom:10px">
      <strong>${bt('Compatibility Score','契合度评分')}: <span style="font-size:18px;color:var(--plum)">${cr.score}%</span></strong>
      <ul style="margin:6px 0 0;padding-left:18px;font-size:12px;line-height:1.6">${cr.breakdown.map(b => `<li>${b}</li>`).join('')}</ul>
    </div>` : '';
  if (prefix === 'p') {
      compatHTML = `<article class="reading"><span class="pill">${trPill(`Life Partner Compatibility Reading`)}</span>${compatSummaryBox(compatResult)}${generateDeepAnalysisData('compat_life', p, {title: 'Life Partner Deep Compatibility Profile', compatResult, partnerP: mainP})}</article>`;
  } else if (prefix === 'b' || (typeof prefix === 'string' && prefix.startsWith('b2_'))) {
      // BUG FIX (found while fixing the missing-compat-in-PDF issue): additional business partners
      // (b2_0, b2_1) previously got NO Alignment section at all here, on their own live chart page,
      // independent of any PDF export bug - only the single "core" business partner (prefix 'b') was
      // handled. Additional business partners' own page/PDF silently had no compatibility content.
      compatHTML = `<article class="reading"><span class="pill">${trPill(`Business Partner Alignment Reading`)}</span>${compatSummaryBox(compatResult)}${generateDeepAnalysisData('compat_biz', p, {title: 'Business Partner Strategic Alignment Profile', compatResult, partnerP: mainP})}</article>`;
  } else if (prefix === 'i') {
      // BUG FIX (reported: "the main user chart does not even show any compatibility information at
      // all"): the main profile's own live chart previously had NO compatibility section whatsoever -
      // this content only existed inside the PDF-export code path (buildProfilePdfHTML), never in the
      // live app. Fixed by building the same Life Partner / Business Partner compatibility sections
      // here too, each with a visible score+summary plus the full deep-dive link, exactly matching
      // what now appears in the PDF export and on the partner's own page.
      let sections = '';
      if (u?.partner) {
        const partnerP = getProfileData(u.partner);
        const cr = calculateTrueCompatibility(p, partnerP, false);
        sections += `<article class="reading"><span class="pill">${bt('Life Partner Compatibility','伴侣契合度')} - ${partnerP.displayName}</span>${compatSummaryBox(cr)}${generateDeepAnalysisData('compat_life', p, {title: 'Life Partner Deep Compatibility Profile', compatResult: cr, partnerP})}</article>`;
      }
      const allBizPartners = [];
      if (u?.businessPartner) allBizPartners.push({ raw: u.businessPartner, label: '' });
      (u?.additionalBizPartners || []).forEach((bp, i) => allBizPartners.push({ raw: bp, label: ` #${i + 2}` }));
      allBizPartners.forEach(({ raw, label }) => {
        const bizP = getProfileData(raw);
        const cr = calculateTrueCompatibility(p, bizP, true);
        sections += `<article class="reading"><span class="pill">${bt('Business Partner Compatibility','事业伙伴契合度')}${label} - ${bizP.displayName}</span>${compatSummaryBox(cr)}${generateDeepAnalysisData('compat_biz', p, {title: `Business Partner${label} Strategic Alignment Profile`, compatResult: cr, partnerP: bizP})}</article>`;
      });
      compatHTML = sections;
  }

  // BUG 11 FIX: sections render in the required order: Name, Zodiac, Ming Li, Da Yun, QMDJ,
  // Zi Wei Dou Shu, Chinese Bone Weight, Feng Shui, I Ching, Ze Ri, Xiang Shu, Numerology, Western Astrology
  // BUG 21/23 FIX: on the Life Partner / Business Partner tabs, the Compatibility/Alignment reading is
  // now the FIRST item shown, ahead of the rest of that partner's chart.
  //
  // ENHANCEMENT (this round): the 15 systems are now grouped into 4 tabs instead of one long
  // concatenated scroll, and each tab's HTML is only inserted into the DOM when that tab is actually
  // selected (built once, cached, then swapped in/out) - this is the "lazy rendering" and "tabbed
  // navigation" items from the page-length recommendations. Section order within each tab is
  // preserved from the original single-list order above.
  // ENHANCEMENT (this round): Personal Assets - persistent Mobile Number (all profile types) and
  // Vehicle Number(s) (individual + Life Partner only, per explicit scope).
  const artPersonalAssets = `
    <h2 class="section-header" ${idAttr('personalassets')}>${flipTitle(`Personal Assets (个人资产)`)}</h2>
    ${renderMobileNumberBlock(prefix, p, prof)}
    ${renderVehiclesBlock(prefix, p, prof)}
    ${renderNumberCheckerGeneratorBlock(prefix, p, prof)}
  `;

  // ENHANCEMENT (requested directly: "The profile readings and charts for all needs to take into
  // account all aspects of metaphysics calculations in the app, chinese, western, etc" - completed per
  // "proceed to complete all pending items"): a new, dedicated section cross-referencing BaZi, Zi Wei
  // Dou Shu, Qi Men Dun Jia, and Western astrology's own already-computed signals side by side for
  // Career/Wealth/Relationships - see computeCrossSystemSynthesis/generateCrossSystemSynthesisHTML above.
  const artCrossSystemSynthesis = `
    <h2 class="section-header" ${idAttr('crosssystemsynthesis')}>${flipTitle(`Cross-System Profile Synthesis (跨体系命盘综合分析)`)}</h2>
    ${generateCrossSystemSynthesisHTML(p)}
  `;

  const tabGroups = {
    core: [artDetailsSummaryCore, artMingLi, artZodiac, artName, artHealthDiagnosis, artIChing, artXiangShu],
    timing: [artDetailsSummaryTiming, artDaYun, artSanShi, artZeRi],
    environment: [artDetailsSummaryEnvironment, artZiWei, artFengShui],
    more: [artDetailsSummaryMore, artNumerology, artWesternAstrology, artCrossSystemSynthesis, artPersonalAssets]
  };
  // ENHANCEMENT (reported: "Details Summary to be expanded by default for Core, Timing, Environment,
  // and More for all profiles"): each tab's own Details Summary card is always the FIRST section in
  // its tabGroups array (see the map above) - previously only the very first section overall (i.e.
  // just Core's Details Summary) started open, so switching to Timing/Environment/More showed their
  // own Details Summary collapsed by default. Every tab's Details Summary now opens by default,
  // regardless of profile type (main, Life Partner, Business Partner, children all render through this
  // same function) - a person can still collapse any of them, and that per-section choice is still
  // remembered across visits via wrapSectionCollapsible's own saved-state lookup.
  const tabContentHTML = {};
  for (const tabName of Object.keys(tabGroups)) {
    tabContentHTML[tabName] = tabGroups[tabName].map((section, idx) => {
      const openThis = idx === 0; // Details Summary (always first) starts open in every tab
      return wrapSectionCollapsible(section, openThis);
    }).join('');
  }
  chartTabRegistry[prefix] = tabContentHTML;
  const tabLabels = { core: bt('Core','核心'), timing: bt('Timing','运势'), environment: bt('Environment','环境'), more: bt('More','更多') };
  const tabBarHTML = `<div class="chart-tab-bar" data-prefix="${prefix}">
    ${Object.keys(tabGroups).map((t, i) => `<button class="chartTabBtn${i===0?' active':''}" data-prefix="${prefix}" data-tab="${t}">${tabLabels[t]}</button>`).join('')}
  </div>
  <div class="chart-tab-panel" id="chartTabPanel_${prefix}">${tabContentHTML.core}</div>`;

  // ENHANCEMENT (reported: "Personal Assets compatibility should be part of the summary cards in
  // landing page and charts for all profiles"): visible immediately at the top of every profile's own
  // chart, right after the profile overview card - not buried in the "More" tab's full Personal
  // Assets section (which stays exactly where it is, for actually entering/editing these fields).
  const artAssetsSummary = buildPersonalAssetsSummaryCardHTML(prefix, p, prof, u);

  if (compatHTML) {
    const headerId = prefix === 'p' ? 'lifepartneralignment' : prefix === 'i' ? 'compatibilityoverview' : 'bizpartneralignment';
    const headerText = prefix === 'p' ? bt('Life Partner Alignment', '伴侣契合分析')
      : prefix === 'i' ? bt('Compatibility Overview', '契合度总览')
      : bt('Business Partner Alignment', '事业伙伴契合分析');
    const compatHeader = `<h2 class="section-header" ${idAttr(headerId)}>${headerText}</h2>`;
    return artProfileOverview + artAssetsSummary + wrapSectionCollapsible(compatHeader + compatHTML, true) + tabBarHTML;
  }
  return artProfileOverview + artAssetsSummary + tabBarHTML;
}

// BUG 12 & 15 FIX: Summary Cards with dynamic labels, richer structured visuals, and a Daily Highlight deep analysis
// ENHANCEMENT (reported: "move the personal assets compatibility info into the landing page summary
// cards for each profile as each profile has their own personal assets"): a new `prefix` parameter
// (defaults to 'i' for backward compatibility) lets this card also render that same profile's Personal
// Assets & Address summary (Mobile Number / Vehicle Plate(s) / Address Compatibility) - reusing
// buildPersonalAssetsSummaryRows, the exact same scoring already shown on the profile's own chart page
// (see buildPersonalAssetsSummaryCardHTML/artAssetsSummary in renderSystemChart) and on the main
// profile's dashboard card (renderPersonalAssetsSummaryCard) - kept in ADDITION to those, not instead
// of them, per explicit instruction to keep it visible in both places.
function generateSummaryCardHTML(focusP, compareP, isBusiness, isZh, prefix = 'i') {
  const compHexes = [8, 16, 24].map(off => mod(focusP.hexNo - 1 + off, 64) + 1);

  // BUG FIX (reported: "landing page summary cards to show all the systems as well"): previously
  // covered 8 facts (Day Master, Zodiac, Da Yun, Numerology, QMDJ, Life Expectancy, Bone Weight,
  // I Ching) but omitted Zi Wei Dou Shu, Ba Zhai Kua, and Western Astrology entirely - the only
  // three systems this app computes that weren't represented here, now added for full parity with
  // the chart page's own overview card.
  // FOLLOW-UP FIX (reported: "there are 13 summary cards on chart level and only 11 on the landing
  // page summary cards. ensure the sequence of cards and number are consistent on landing page and
  // cards"): this grid used to carry its own hand-picked 11-fact subset (including Zodiac, which the
  // chart-level Profile Overview card shows in its header line rather than as a tile), which drifted
  // out of sync with that card's own 13 tiles (Gregorian Birth, Lunar Birth, Day Master, Bone Weight,
  // Da Yun, Life Expectancy, Numerology, Sun Sign, I Ching, Zi Wei Life Palace, QMDJ Life Palace,
  // Ba Zhai Kua, Flying Star Annual - see artProfileOverview above). Rebuilt to mirror that exact same
  // 13 tiles, in the exact same order, so a person sees the identical set of facts (and the identical
  // sequence) whether they're looking at the landing page or the chart page.
  const keyFactsLabels = bt(
    ['Gregorian Birth','Lunar Birth','Day Master','Bone Weight','Da Yun (Current Cycle)','Life Expectancy','Numerology Life Path','Sun Sign','I Ching Hexagram','Zi Wei Life Palace','QMDJ Life Palace','Ba Zhai Kua','Flying Star (Annual)'],
    ['阳历出生','农历出生','日主','骨重','大运（当前）','预期寿命','生命数字','太阳星座','易经卦象','紫微命宫','奇门命宫','八宅命卦','飞星（流年）']
  );
  const fsOvLanding = computeFlyingStarTemporalOverlay(new Date());
  // UPDATED (reported: "summary card sequence on landing page and summary cards sequence on chart
  // level are different. Summary cards sequence and size to follow the same flow and size with the
  // summary cards on chart level"): the ORDER already matched the chart-level Profile Overview card's
  // 13 tiles (see the FOLLOW-UP FIX note above), but the SIZE did not - this grid marked 3 tiles wide
  // (Gregorian Birth, I Ching Hexagram, Flying Star) while the chart-level card only ever marks ONE
  // wide (Flying Star - see overviewTile's calls in artProfileOverview above). Padding/border-radius/
  // value font-size are now also aligned to overviewTile's own metrics (10px 12px padding, 10px
  // radius, 13px/700/1.4 value text) instead of this card's own slightly smaller ad-hoc sizing, so the
  // two cards genuinely render at the same size, not just the same order.
  const keyFactsTile = (label, value, wide) => `<div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px${wide ? ';grid-column:span 2' : ''}"><div style="font-size:10px;opacity:0.75;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">${label}</div><div style="font-size:13px;font-weight:700;line-height:1.4">${value}</div></div>`;
  const keyFactsRows = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <!-- BUG FIX (reported: "longitude and timezone missing from landing page summary card"): the
           chart-level Gregorian Birth tile (overviewTile, artProfileOverview above) already appends a
           longitude/UTC-offset sub-line beneath the date/time/location - this landing-card tile was
           rebuilt in a previous round to match that chart-level tile's SIZE and STYLING, but that one
           extra sub-line's actual content was missed. Reusing the exact same format string here so the
           two are now genuinely identical, not just visually similar. -->
      ${keyFactsTile(keyFactsLabels[0], `${focusP.birthdate}<br>${focusP.birthtime}${focusP.birthLocation ? ` · ${focusP.birthLocation}` : ''}${typeof focusP.birthLongitude === 'number' ? `<br><span style="font-size:11px;font-weight:400;opacity:0.75">${focusP.birthLongitude.toFixed(2)}°  ·  UTC${focusP.birthTimezone >= 0 ? '+' : ''}${focusP.birthTimezone}</span>` : ''}`)}
      ${keyFactsTile(keyFactsLabels[1], bt(focusP.lunar.fullLunarEN, focusP.lunar.fullLunarCN))}
      ${keyFactsTile(keyFactsLabels[2], `${stems[focusP.bazi.dayStemIdx]} (${stemCN[focusP.bazi.dayStemIdx]})`)}
      ${keyFactsTile(keyFactsLabels[3], focusP.boneWeight.displayStr)}
      ${keyFactsTile(keyFactsLabels[4], `${bt('Start Age','起运年龄')} ${focusP.nominalStartAge} (${focusP.daYunStartYear})`)}
      ${keyFactsTile(keyFactsLabels[5], `${focusP.lifespan} ${bt('Yrs','岁')}`)}
      ${keyFactsTile(keyFactsLabels[6], `${bt('Path','命数')} ${focusP.life} · ${bt('Lucky','幸运')} ${focusP.lifeLuckyNumber}`)}
      ${keyFactsTile(keyFactsLabels[7], focusP.astro.en)}
      ${keyFactsTile(keyFactsLabels[8], `${bt('Natal','本命')} #${focusP.hexNo} · ${bt('Compatible','相合')} #${compHexes.join(', #')}`)}
      ${keyFactsTile(keyFactsLabels[9], focusP.ziwei.lifePalaceName)}
      ${keyFactsTile(keyFactsLabels[10], `${bt('Palace','宫位')} ${focusP.qmdj.natalPalace} (${focusP.palaceName})`)}
      ${keyFactsTile(keyFactsLabels[11], `${focusP.kuaGroup} - ${bt('Kua','卦')} ${focusP.kuaNum}`)}
      ${keyFactsTile(keyFactsLabels[12], flyingStarNatureLine(fsOvLanding.annual.chart.center), true)}
    </div>
  `;

  let compatHTML = '';
  if (compareP) {
      const cr = calculateTrueCompatibility(compareP, focusP, isBusiness);
      compatHTML = `
        <div style="margin-bottom:12px;padding:12px;background:rgba(255,255,255,0.1);border-left:3px solid var(--goldsoft);border-radius:6px;box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
           <strong>${bt('Compatibility Index','契合度指数')}: <span style="font-size:18px;color:var(--goldsoft)">${cr.score}%</span></strong><br>
           <span style="font-size:12px;opacity:0.95">${cr.breakdown[0]}</span>
        </div>
      `;
  }

  // ENHANCEMENT (this round): Personal Assets & Address summary, inline on the landing page card
  // itself - same rows/scoring as the profile's own chart-page card, added here rather than replacing
  // it there. Falls back to an empty string if this profile's data isn't reachable (e.g. no active
  // user), so a missing prefix never breaks the rest of the landing card.
  let assetsSummaryHTML = '';
  {
    const u = activeUser();
    const prof = u ? getProfileByPrefix(prefix) : null;
    if (u && prof) {
      const assetRows = buildPersonalAssetsSummaryRows(prefix, focusP, prof, u);
      assetsSummaryHTML = `
        <div style="margin-bottom:12px;padding:10px 12px;background:rgba(255,255,255,0.08);border-radius:8px">
          <div style="font-size:10px;opacity:0.75;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${bt('Personal Assets & Address','个人资产与地址')}</div>
          ${assetRows.map(r => `
            <div style="padding:4px 0">
              <div style="font-size:12px;font-weight:700;color:${r.ok ? '#a5d6a7' : 'rgba(255,255,255,0.6)'}">${r.lines[0]}</div>
              ${r.lines.slice(1).map(l => `<div style="font-size:11px;opacity:0.85;margin-top:1px">${l}</div>`).join('')}
            </div>`).join('')}
        </div>
      `;
    }
  }

  // BUG (verification) FIX: the Daily Highlight previously varied only via a single binary coin-flip
  // (today's date + a birthdate checksum mod 10), so most of the text was identical boilerplate for
  // everyone and different profiles frequently looked the same on the same day. It now derives
  // TODAY's actual Day Pillar using the same JiaZi formula used everywhere else in the app, then reads
  // the real Wu Xing relationship (and Six Clash/Harmony) between today's stem/branch and each
  // person's OWN Day Master - so the reading is grounded in real BaZi mechanics and genuinely differs
  // person to person, not just day to day.
  const today = new Date();
  const todayEpochDay = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
  const todayGanzhi = mod(todayEpochDay + 17, 60);
  const todayStemIdx = mod(todayGanzhi, 10), todayBranchIdx = mod(todayGanzhi, 12);
  const elemNames = ['Wood','Fire','Earth','Metal','Water'];
  const elemNamesZH = ['木','火','土','金','水'];
  const dmElemIdx = Math.floor(focusP.bazi.dayStemIdx / 2), tdElemIdx = Math.floor(todayStemIdx / 2);
  const rel = dmElemIdx === tdElemIdx ? 'same' : (mod(dmElemIdx + 1, 5) === tdElemIdx ? 'generates' : (mod(tdElemIdx + 1, 5) === dmElemIdx ? 'drains' : (mod(dmElemIdx + 2, 5) === tdElemIdx ? 'controls' : 'clashed_by')));
  const isClash = SIX_CLASH[focusP.bazi.dayBranchIdx] === todayBranchIdx;
  const isHarmony = SIX_HARMONY[focusP.bazi.dayBranchIdx] === todayBranchIdx;
  const todayPillar = `${stemCN[todayStemIdx]}${branchCN[todayBranchIdx]}`;
  const relDesc = bt({
    same: `reinforces your ${elemNames[dmElemIdx]} Day Master directly`,
    generates: `feeds and nourishes your ${elemNames[dmElemIdx]} Day Master`,
    drains: `is fed by your ${elemNames[dmElemIdx]} Day Master, drawing on your energy`,
    controls: `is restrained by your ${elemNames[dmElemIdx]} Day Master`,
    clashed_by: `restrains your ${elemNames[dmElemIdx]} Day Master`
  }[rel], {
    same: `直接增强您${elemNamesZH[dmElemIdx]}日主的力量`,
    generates: `滋养生扶您的${elemNamesZH[dmElemIdx]}日主`,
    drains: `被您的${elemNamesZH[dmElemIdx]}日主所生，消耗您的精力`,
    controls: `被您的${elemNamesZH[dmElemIdx]}日主所克`,
    clashed_by: `克制您的${elemNamesZH[dmElemIdx]}日主`
  }[rel]);
  const favourable = (rel === 'same' || rel === 'generates') && !isClash;

  // BUG 19/20 FIX: the rich daily calculation above (todayPillar/relDesc/favourable/isClash/isHarmony)
  // was computed but never actually shown - the card only displayed the person's STATIC natal lucky
  // colors mislabelled as "Calculated Daily Colors". Both are now genuinely dynamic per day: the
  // highlight text below actually surfaces today's real Day Pillar reading, and the colors are derived
  // from TODAY's element relationship to the Day Master (not the fixed natal color).
  const ELEMENT_COLOR_EN = ['Green & Teal (Wood)', 'Red & Purple (Fire)', 'Yellow & Brown (Earth)', 'White & Gold (Metal)', 'Black & Deep Blue (Water)'];
  const ELEMENT_COLOR_ZH = ['绿色与青色（木）', '红色与紫色（火）', '黄色与棕色（土）', '白色与金色（金）', '黑色与深蓝色（水）'];
  const generatesIdx = (i) => mod(i + 1, 5); // element that GENERATES index i (resource)
  // If today supports the Day Master, lean into today's own element AND the Day Master's element;
  // if today pressures the Day Master, lean on the RESOURCE element that generates the Day Master.
  const suitableElemIdx = favourable ? tdElemIdx : generatesIdx(dmElemIdx);
  const avoidElemIdx = mod(dmElemIdx + 2, 5); // the element that CONTROLS/overcomes the Day Master - always the natal caution color
  const dailySuitableColor = bt(ELEMENT_COLOR_EN[suitableElemIdx], ELEMENT_COLOR_ZH[suitableElemIdx]);
  const dailyAvoidColor = bt(ELEMENT_COLOR_EN[avoidElemIdx], ELEMENT_COLOR_ZH[avoidElemIdx]);
  const todayDateStr = today.toLocaleDateString(isZh ? 'zh-CN' : 'en-SG', { weekday: 'long', day: 'numeric', month: 'long' });
  // ENHANCEMENT 6 FIX: fold San Shi (Da Liu Ren's daily San Chuan + the current flowing year's Tai Yi
  // macro theme) into the Daily Highlight, alongside the existing BaZi/QMDJ-based reading.
  const dailyDLR = getDailyDaLiuRenForProfile(focusP);
  const yearTaiYi = getCurrentYearTaiYiForProfile(focusP);
  const highlightHTML = `
    <div style="margin-bottom:12px;padding:10px;background:rgba(255,255,255,0.08);border-left:3px solid ${favourable ? '#a5d6a7' : '#ef9a9a'};border-radius:0 8px 8px 0;font-size:12px;line-height:1.6">
      <strong>${bt('Today\'s Highlight','今日亮点')} (${todayDateStr}):</strong><br>
      ${bt(`Today's Day Pillar (${todayPillar}) ${relDesc}.`, `今日日柱（${todayPillar}）${relDesc}。`)}
      ${isClash ? bt(' This also forms a Six Clash with your Day Branch - a lower-key day, best for review rather than new starts.', ' 且与您的日支形成六冲——今日宜低调行事，适合检讨反思而非开创新局。') : ''}
      ${isHarmony ? bt(' This also forms a Six Harmony with your Day Branch - a smoother, more cooperative day than usual.', ' 且与您的日支形成六合——今日较为顺利，人际合作更为顺畅。') : ''}
      <div style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.2)">${bt(`Da Liu Ren (San Shi) today's Chu Chuan: ${branches[dailyDLR.chuChuan]} (${dailyDLR.chuChuanGeneral.split(' ')[0]}) - rated ${dailyDLR.chuChuanRating.tierEN}.`, `今日大六壬（三式）初传：${branchCN[dailyDLR.chuChuan]}（${dailyDLR.chuChuanGeneral.split('(')[1]?.replace(')','')}）——评级${dailyDLR.chuChuanRating.tierZH}。`)}</div>
      <div style="margin-top:3px">${bt(`This year's Tai Yi macro theme (San Shi): ${yearTaiYi.tierEN}.`, `本年太乙宏观主题（三式）：${yearTaiYi.tierZH}。`)}</div>
    </div>`;
  return `
    ${compatHTML}
    ${keyFactsRows}
    ${assetsSummaryHTML}
    ${highlightHTML}
    <div style="margin-bottom:12px;font-size:12px;line-height:1.6;">
      <div style="margin-bottom:8px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.2)">
          <strong>${bt('Calculated Daily Colors','今日推算颜色')}:</strong><br>
          <span style="color:#a5d6a7">✅ <strong>${bt('Suitable','宜')}:</strong> ${dailySuitableColor}</span><br>
          <span style="color:#ef9a9a">🛑 <strong>${bt('Avoid','忌')}:</strong> ${dailyAvoidColor}</span>
      </div>
    </div>
    <button data-go="hourlyTab" style="width:100%;padding:10px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:8px;color:#fff;font-weight:700;font-size:12px;cursor:pointer">${bt('View Full Hourly Breakdown →','查看每小时详细分析 →')}</button>
    <button data-go="detailedReadingTab" style="width:100%;padding:10px;margin-top:8px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:8px;color:#fff;font-weight:700;font-size:12px;cursor:pointer">${bt('View Detailed Reading →','查看详细命理解读 →')}</button>
  `;
}

function renderLotteryPredictionsStub() { /* implementation lives in engine-predictions.js */ }

// Master UI Routing & State Renderer
function go(viewId) {
  // BUG FIX (reported: "buttons not responding well after switching users" / "cannot log out after
  // switching to a different user"): confirmed via a real scripted repro of the sign-out/sign-in-as-a-
  // different-user flow. The Deep Analysis modal (id="deepAnalysisModalOverlay") is a full-viewport,
  // position:fixed, z-index:2000 element that was only ever closed by its own explicit close button or
  // by clicking its dark backdrop - navigating away (including signing all the way out) never closed
  // it. If a user opened one "View Details" modal and then navigated anywhere else without explicitly
  // dismissing it first, it kept covering the ENTIRE screen on every subsequent view - including the
  // welcome/sign-in screen and the next user's own session - silently swallowing every click on
  // whatever was underneath it (the Sign Out button among them), even though nothing looked wrong in
  // the DOM itself. Any navigation now force-closes it, so it can never survive a view change.
  const openModal = document.getElementById('deepAnalysisModalOverlay');
  if (openModal) openModal.classList.add('hidden');
  if (['home','chart','compat','businessTab','childrenTab','hourlyTab','detailedReadingTab','account','partnerView','bizView'].includes(viewId) && !activeUser()) return go('auth');
  const u = activeUser();
  if (viewId === 'compat' && u?.partner) viewId = 'partnerView';
  if (viewId === 'businessTab' && u?.businessPartner) viewId = 'bizView';

  // BUG FIX (login/signup mode bug): a safety net alongside the explicit signup=true/false set on the
  // two Welcome-screen buttons (auth.js) - ANY path that lands on the auth view (including the
  // early-return above for an unauthenticated user trying to reach a protected view) now re-syncs the
  // screen's visible text to whatever `signup` actually is, so it can never show stale text left over
  // from a previous visit.
  if (viewId === 'auth' && typeof updateAuthModeUI === 'function') updateAuthModeUI();

  $$('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
  const hideNav = !u || ['welcome', 'auth'].includes(viewId) || (viewId === 'intake' && !u.profile);
  $('#nav').classList.toggle('hidden', hideNav);
  
  $$('.nav button').forEach(b => {
    let matchId = b.dataset.go;
    if (viewId === 'partnerView' && matchId === 'compat') b.classList.add('active');
    else if (viewId === 'bizView' && matchId === 'businessTab') b.classList.add('active');
    else b.classList.toggle('active', matchId === viewId);
  });

  if (u && !u.profile && viewId !== 'intake') return go('intake');
  if (['home','chart','partnerView','bizView'].includes(viewId) && u?.profile) renderAllViews();
  if (viewId === 'childrenTab' && u?.profile) renderChildrenTab();
  if (viewId === 'hourlyTab' && u?.profile) renderHourlyTab();
  if (viewId === 'detailedReadingTab' && u?.profile) renderDetailedReadingTab();
  if (viewId === 'account' && u?.profile) { renderExportCenterList(); renderExportReadinessChecklist(); renderManageProfilesList(); renderPeopleManagementList(); }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderAllViews() {
  // BUG FIX (see purgeMainDeepAnalysisIds' own comment above deepAnalysisRegistry's declaration): this
  // rebuilds home/chart/partnerView/bizView from scratch, so every "View Details" button (and its
  // registry entry) from the PREVIOUS call is now provably orphaned - purge them before generating the
  // new batch, rather than letting deepAnalysisRegistry grow without bound for the rest of the session.
  purgeMainDeepAnalysisIds();
  updateStaticLanguage();
  const p = getProfileData(); if (!p) return;
  const u = activeUser(); const isZh = lang === 'zh';

  if ($('#avatar')) $('#avatar').textContent = p.englishName.slice(0, 2).toUpperCase();
  // REMOVED (reported: "remove the 'Hello, XXX' and retain the day and date"): the #greeting h1 ("Hello,
  // {name}.") is gone from index.html; #todayDate below is now the landing page's sole heading.
  if ($('#todayDate')) $('#todayDate').textContent = new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // ENHANCEMENT (reported: "attached can be removed for all profiles from landing page as this
  // information is already available in one of the summary cards" + "Chart and profiles shows a card
  // with name, gender, age, and chinese zodiac. This should show for the various profiles on the
  // landing page summary cards as well"): this line used to repeat the Lunar Birthdate - now redundant
  // since the landing card's own key-facts grid (generateSummaryCardHTML, right below) already shows a
  // "Lunar Birth" tile with the exact same value. The same slot is reused instead for the name/gender/
  // age/Chinese-zodiac line the chart page's own header card already shows (artProfileOverview) but the
  // landing page never did - #dailyTitle never actually got a value assigned before this fix, so this
  // is also filling a genuine gap, not just relabeling one.
  if ($('#dailyTitle')) $('#dailyTitle').textContent = p.displayName;
  if ($('#individualLunarBadge')) $('#individualLunarBadge').textContent = `${bt(p.isMale ? 'Male' : 'Female', p.isMale ? '男' : '女')} · ${bt('Age','年龄')} ${computeCurrentAge(p.birthdate)} · ${p.animal} (${p.animalCN})`;

  // Restore DOM Targeting for Summary Cards (Bug 12 & 15 dynamic labels + daily deep analysis)
  if ($('#landingCombinedReading')) $('#landingCombinedReading').innerHTML = generateSummaryCardHTML(p, null, false, isZh, 'i');

  if (u.partner) {
    const partnerP = getProfileData(u.partner);
    if ($('#partnerSummaryCard')) $('#partnerSummaryCard').classList.remove('hidden');
    if ($('#partnerSummaryTitle')) $('#partnerSummaryTitle').textContent = `${partnerP.displayName} (Life Partner) Synthesis`;
    // See the matching comment on #individualLunarBadge above - same relocation (Lunar Birthdate,
    // already in the key-facts grid below, replaced by name/gender/age/zodiac; the name itself is
    // already carried by the title just above, so this line covers the remaining 3 facts).
    if ($('#partnerLunarBadge')) $('#partnerLunarBadge').textContent = `${bt(partnerP.isMale ? 'Male' : 'Female', partnerP.isMale ? '男' : '女')} · ${bt('Age','年龄')} ${computeCurrentAge(partnerP.birthdate)} · ${partnerP.animal} (${partnerP.animalCN})`;
    if ($('#landingPartnerCompatSection')) $('#landingPartnerCompatSection').innerHTML = generateSummaryCardHTML(partnerP, p, false, isZh, 'p');
    if ($('#partnerViewContent')) $('#partnerViewContent').innerHTML = renderSystemChart(partnerP, 'p', calculateTrueCompatibility(p, partnerP, false), false, p);
  } else { if ($('#partnerSummaryCard')) $('#partnerSummaryCard').classList.add('hidden'); }

  if (u.businessPartner) {
    const bizP = getProfileData(u.businessPartner);
    if ($('#bizSummaryCard')) $('#bizSummaryCard').classList.remove('hidden');
    if ($('#bizSummaryTitle')) $('#bizSummaryTitle').textContent = `${bizP.displayName} (Business Partner) Alignment`;
    // See the matching comment on #individualLunarBadge above.
    if ($('#bizLunarBadge')) $('#bizLunarBadge').textContent = `${bt(bizP.isMale ? 'Male' : 'Female', bizP.isMale ? '男' : '女')} · ${bt('Age','年龄')} ${computeCurrentAge(bizP.birthdate)} · ${bizP.animal} (${bizP.animalCN})`;
    if ($('#landingBizCompatSection')) $('#landingBizCompatSection').innerHTML = generateSummaryCardHTML(bizP, p, true, isZh, 'b');
    if ($('#bizViewContent')) $('#bizViewContent').innerHTML = renderSystemChart(bizP, 'b', calculateTrueCompatibility(p, bizP, true), true, p);
  } else { if ($('#bizSummaryCard')) $('#bizSummaryCard').classList.add('hidden'); }
  renderAdditionalBizPartners();

  // Draw Individual Chart
  if ($('#chartChips')) $('#chartChips').innerHTML = `<span class="chip">${p.displayName}</span><span class="chip">${p.animalCN} ${p.animal}</span>`;
  if ($('#chartContent')) $('#chartContent').innerHTML = renderSystemChart(p, 'i', null, false);

  // Restore Lottery Render - synchronous first paint with whatever data is available (static
  // snapshot, or live data if a previous fetch this session already succeeded), then kick off a
  // background live-fetch attempt so the page shows real data automatically, without any manual
  // "Refresh" button (removed per BUG 5 FIX - predictions are now permanent, not reshuffled).
  if (typeof renderLotteryPredictions === 'function') {
    renderLotteryPredictions(p);
    if (!lotteryAutoFetchAttempted && typeof fetchLatestLotteryResults === 'function') {
      lotteryAutoFetchAttempted = true;
      fetchLatestLotteryResults().then(() => {
        // ENHANCEMENT (this round): once real historical data is available, retroactively backfill
        // predictions for the last 50 draws of each game (see backfillHistoricalAccuracy's own
        // comment for the point-in-time methodology) so the Historical Accuracy display has real,
        // honestly-backtested data immediately rather than waiting weeks/years for it to accumulate
        // one live draw at a time. Only runs once per session (gated, same pattern as the fetch
        // itself above) - after the first successful run, the underlying "never regenerate an
        // existing prediction" rule means calling it again would just re-skip everything anyway, but
        // gating it avoids the (small, one-time) computation cost on every subsequent render.
        if (!historicalBackfillAttempted && typeof backfillHistoricalAccuracy === 'function') {
          historicalBackfillAttempted = true;
          const freshP = getProfileData();
          if (freshP) {
            backfillHistoricalAccuracy('fourD', freshP, 50);
            backfillHistoricalAccuracy('toto', freshP, 50);
          }
        }
        renderLotteryPredictions(getProfileData());
      });
    }
  }

}
let lotteryAutoFetchAttempted = false; // ensures the on-load auto-fetch only fires once per session, not on every renderAllViews() call
let historicalBackfillAttempted = false; // ensures the one-time 50-draw historical backtest only runs once per session
// ENHANCEMENT (reported: "Move the mobile number and vehicle plate checker into the personal assets
// section. They should not reside in the landing page"): the on-load auto-generation of a suggested
// vehicle/mobile number that used to live here (tied to a single Home-page-only widget) is removed -
// the Checker & Generator tool now lives per-profile inside each profile's own Personal Assets section
// (see renderNumberCheckerGeneratorBlock), so there's no longer one single "the" widget to auto-fill on
// page load; each instance simply shows "---" until its own Regenerate button is clicked, exactly as
// the tool behaved before that auto-fill convenience was added.

// BUG 1 FIX: Prefill the Life Partner / Business Partner edit forms with the currently stored data,
// so editing does not appear to have "lost" previously entered details, and full birth details
// (including longitude/timezone/location, previously discarded on save) round-trip correctly.
// REDESIGN (this round): shared by all 5 static forms' prefill functions - reselects the Birth Country
// dropdown (and, for a multi-timezone country, the City/Region dropdown) that best matches the
// profile's already-saved birthLocation/birthLongitude/birthTimezone, via the same best-effort matching
// used by the People-screen edit form, then restores the hidden location/longitude/timezone values
// directly from the profile (rather than re-deriving them) so a re-open-without-changing-anything
// round-trips exactly, even for a profile whose location predates this redesign and doesn't cleanly
// match any country/city name.
function prefillCountryCityFields(targetIdPrefix, prof) {
  const countrySel = document.getElementById(`${targetIdPrefix}CountrySelect`);
  const cityWrap = document.getElementById(`${targetIdPrefix}CityWrap`);
  const citySel = document.getElementById(`${targetIdPrefix}CitySelect`);
  const locField = document.getElementById(`${targetIdPrefix}Location`);
  const lonField = document.getElementById(`${targetIdPrefix}Longitude`);
  const tzField = document.getElementById(`${targetIdPrefix}Timezone`);
  const latField = document.getElementById(`${targetIdPrefix}Latitude`);
  const { country, cityIdx } = matchPersonLocationToCountry(prof);
  if (countrySel) countrySel.value = country;
  if (cityWrap && citySel) {
    const cities = MULTI_TIMEZONE_COUNTRY_CITIES[country];
    citySel.innerHTML = `<option value="">${bt('-- Select City/Region --','-- 请选择城市／地区 --')}</option>` + (cities ? renderCityOptionsHTML(country, cityIdx) : '');
    if (cities) { cityWrap.style.display = 'block'; citySel.value = cityIdx; } else { cityWrap.style.display = 'none'; }
  }
  if (locField) locField.value = prof.birthLocation || 'Singapore';
  if (lonField) lonField.value = prof.birthLongitude || 103.8198;
  if (tzField) tzField.value = prof.birthTimezone || 8;
  // ENHANCEMENT (requested directly: real Ascendant-based houses) - restores the profile's own already-
  // saved latitude directly (rather than re-deriving it from the country match, which may not be exact),
  // same round-trip principle as location/longitude/timezone above. Left blank (not defaulted) when the
  // profile genuinely has none yet, so a re-save without touching the country dropdown doesn't invent one.
  if (latField) latField.value = (typeof prof.birthLatitude === 'number') ? prof.birthLatitude : '';
}
function prefillPartnerForm(prefix) {
  const prof = getProfileByPrefix(prefix); if (!prof) return;
  const map = prefix === 'p'
    ? { el:'partnerEnglishLastName', ef:'partnerEnglishFirstName', cl:'partnerChineseLastName', cf:'partnerChineseFirstName', g:'partnerGender', d:'partnerDate', t:'partnerTime', locPrefix:'partner', mobile:'partnerMobileNumber', vehicle:'partnerVehicleNumber' }
    : { el:'bizEnglishLastName', ef:'bizEnglishFirstName', cl:'bizChineseLastName', cf:'bizChineseFirstName', g:'bizGender', d:'bizDate', t:'bizTime', locPrefix:'biz', mobile:'bizMobileNumber' };
  if ($('#'+map.el)) $('#'+map.el).value = prof.englishLastName || '';
  if ($('#'+map.ef)) $('#'+map.ef).value = prof.englishFirstName || '';
  if ($('#'+map.cl)) $('#'+map.cl).value = prof.chineseLastName || '';
  if ($('#'+map.cf)) $('#'+map.cf).value = prof.chineseFirstName || '';
  if ($('#'+map.g)) $('#'+map.g).value = prof.gender || '';
  if ($('#'+map.d)) $('#'+map.d).value = prof.birthdate || '';
  if ($('#'+map.t)) $('#'+map.t).value = prof.birthtime || '';
  prefillCountryCityFields(map.locPrefix, prof);
  // ENHANCEMENT: Personal Assets fields prefilled too, same rationale as prefillMainProfileForm above
  // (avoid a re-save silently blanking out what's already on file).
  if ($('#'+map.mobile)) $('#'+map.mobile).value = prof.mobileNumber || '';
  if (map.vehicle && $('#'+map.vehicle)) $('#'+map.vehicle).value = (prof.vehicles && prof.vehicles.length === 1) ? prof.vehicles[0].number : '';
  if (prefix === 'p' && $('#partnerVehicleShared')) $('#partnerVehicleShared').checked = !!(prof.vehicles && prof.vehicles.length === 1 && prof.vehicles[0].shared);
}

// BUG 9 FIX: prefill the main Individual profile edit form too (previously only partner/biz forms
// were prefilled - clicking "Edit birth details" showed a completely blank intake form).
function prefillMainProfileForm() {
  const prof = activeUser()?.profile; if (!prof) return;
  if ($('#englishLastName')) $('#englishLastName').value = prof.englishLastName || '';
  if ($('#englishFirstName')) $('#englishFirstName').value = prof.englishFirstName || '';
  if ($('#chineseLastName')) $('#chineseLastName').value = prof.chineseLastName || '';
  if ($('#chineseFirstName')) $('#chineseFirstName').value = prof.chineseFirstName || '';
  if ($('#gender')) $('#gender').value = prof.gender || '';
  if ($('#birthdate')) $('#birthdate').value = prof.birthdate || '';
  if ($('#birthtime')) $('#birthtime').value = prof.birthtime || '';
  prefillCountryCityFields('birth', prof);
  // ENHANCEMENT: Personal Assets fields now collected on intake too - prefill from the existing
  // profile on edit so re-saving doesn't blank them out. Vehicle field only prefills when there's
  // exactly one existing vehicle (the common case this single intake field covers); with 0 or 2+
  // vehicles already on file, it's left blank so the Personal Assets section (which lists every
  // vehicle individually) remains the place to review/edit the full list.
  if ($('#intakeMobileNumber')) $('#intakeMobileNumber').value = prof.mobileNumber || '';
  if ($('#intakeVehicleNumber')) $('#intakeVehicleNumber').value = (prof.vehicles && prof.vehicles.length === 1) ? prof.vehicles[0].number : '';
  if ($('#intakeVehicleShared')) $('#intakeVehicleShared').checked = !!(prof.vehicles && prof.vehicles.length === 1 && prof.vehicles[0].shared);
  // ENHANCEMENT: Home Address/Construction Year now collected on intake too (same u.home household
  // record already used by the Feng Shui section - prefill from it so re-saving doesn't blank it out).
  const u = activeUser();
  // UPDATED (reported: "Address is not fixed. It should be split into multiple fields"): prefills from
  // the same structured u.home.addresses.profile record the Feng Shui/Account page fields use, via
  // ensureHomeAddressModel (which also migrates in any legacy free-text u.home.address the first time
  // it runs for an account that hasn't set up the structured fields yet), so a returning user always
  // sees their real saved values here, never a blank form.
  if (u) {
    const addresses = (typeof ensureHomeAddressModel === 'function') ? ensureHomeAddressModel(u) : null;
    const profAddr = (addresses && addresses.profile) || {};
    if ($('#intakeHouseNumber')) $('#intakeHouseNumber').value = profAddr.houseNumber || '';
    if ($('#intakeStreetName')) $('#intakeStreetName').value = profAddr.streetName || '';
    if ($('#intakeUnit')) $('#intakeUnit').value = profAddr.unit || '';
    if ($('#intakeCity')) $('#intakeCity').value = profAddr.city || '';
    if ($('#intakeCountry')) $('#intakeCountry').value = profAddr.country || '';
    if ($('#intakePostalCode')) $('#intakePostalCode').value = profAddr.postalCode || '';
    if ($('#intakeAddrShared')) $('#intakeAddrShared').checked = !!profAddr.shared;
    // ENHANCEMENT: Work Address (optional, for user + Business Partner compatibility only) - prefill
    // from u.home.addresses.work the same way, so re-saving intake never blanks it out.
    const workAddr = (addresses && addresses.work) || {};
    if ($('#intakeWorkHouseNumber')) $('#intakeWorkHouseNumber').value = workAddr.houseNumber || '';
    if ($('#intakeWorkStreetName')) $('#intakeWorkStreetName').value = workAddr.streetName || '';
    if ($('#intakeWorkUnit')) $('#intakeWorkUnit').value = workAddr.unit || '';
    if ($('#intakeWorkCity')) $('#intakeWorkCity').value = workAddr.city || '';
    if ($('#intakeWorkCountry')) $('#intakeWorkCountry').value = workAddr.country || '';
    if ($('#intakeWorkPostalCode')) $('#intakeWorkPostalCode').value = workAddr.postalCode || '';
  }
  if ($('#intakeHomeConstructionYear')) $('#intakeHomeConstructionYear').value = u?.home?.constructionYear || '';
  // ENHANCEMENT (reported: "Address input missing home facing direction"): prefill from the same
  // prof.fsDir the Ba Zhai Compass School / Home Address block on the Feng Shui page reads and writes.
  if ($('#intakeFsDir')) $('#intakeFsDir').value = prof.fsDir || '';
}

// ENHANCEMENT: up to 3 total Business Partners (existing single "core" slot + up to 2 more)
function renderAdditionalBizPartners() {
  const u = activeUser(); if (!u) return;
  u.additionalBizPartners = u.additionalBizPartners || [];
  const totalCount = (u.businessPartner ? 1 : 0) + u.additionalBizPartners.length;

  const listHTML = u.additionalBizPartners.length ? u.additionalBizPartners.map((bp, idx) => {
    const bpP = getProfileData(bp);
    return `<article class="reading" style="border-top:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong style="color:var(--plum)">${bpP.englishName}${bp.chineseFirstName || bp.chineseLastName ? ` · ${bp.chineseLastName||''}${bp.chineseFirstName||''}` : ''}</strong>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${bt('Age','年龄')} ${getCurrentAge(bpP.birthdate)} · ${bpP.animal} (${bpP.animalCN}) · ${bt('Day Master','日主')}: ${stems[bpP.bazi.dayStemIdx]}</div>
        </div>
        <button class="btnRemoveBizPartner2" data-idx="${idx}" style="border:0;background:var(--danger);color:#fff;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">${bt('Remove','移除')}</button>
      </div>
    </article>`;
  }).join('') : `<div style="padding:12px 0;color:var(--muted);font-size:13px">${bt('No additional business partners added yet.','尚未添加其他事业伙伴。')}</div>`;

  const listContainer = $('#additionalBizListContainer'); if (listContainer) listContainer.innerHTML = listHTML;
  const formWrap = $('#bizAddFormWrap'); if (formWrap) formWrap.style.display = totalCount >= 3 ? 'none' : 'block';

  const chartsContainer = $('#additionalBizChartsContainer');
  const overallContainer = $('#bizOverallCompatSection');
  if (!u.profile || !u.businessPartner) { if (chartsContainer) chartsContainer.innerHTML = ''; if (overallContainer) overallContainer.innerHTML = ''; return; }
  const p = getProfileData();
  const allBizProfiles = [getProfileData(u.businessPartner), ...u.additionalBizPartners.map(bp => getProfileData(bp))];

  // Each additional partner: full chart + compat vs Individual
  if (chartsContainer) {
    chartsContainer.innerHTML = u.additionalBizPartners.map((bp, idx) => {
      const bpP = getProfileData(bp);
      const cr = calculateTrueCompatibility(p, bpP, true);
      return `<div style="margin-top:24px;padding-top:16px;border-top:2px solid var(--sand)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h2 class="section-header" style="margin:0;border:0;padding:0">${bt('Business Partner','事业伙伴')} ${idx + 2}: ${bpP.englishName}</h2>
          <button class="btnExportPdf" data-prefix="b2_${idx}" style="border:0;background:var(--sand);color:var(--plum);padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;margin-left:8px">📄</button>
        </div>
        ${renderSystemChart(bpP, `b2_${idx}`, cr, true, p)}
      </div>`;
    }).join('');
  }
  // Pairwise between partners + overall summary, only meaningful with 2+ total partners
  if (overallContainer) {
    if (allBizProfiles.length > 1) {
      let html = `<div style="margin-top:24px;padding-top:16px;border-top:2px solid var(--sand)"><h2 class="section-header">${bt('Business Partners - Pairwise & Overall Compatibility','事业伙伴 - 两两及整体契合度')}</h2>`;
      const pairScores = [];
      for (let i = 0; i < allBizProfiles.length; i++) {
        for (let j = i + 1; j < allBizProfiles.length; j++) {
          const cr = calculateTrueCompatibility(allBizProfiles[i], allBizProfiles[j], true);
          pairScores.push(cr.score);
          html += `<article class="reading"><span class="pill">${trPill(bt(`${allBizProfiles[i].displayName} & ${allBizProfiles[j].displayName}`, `${allBizProfiles[i].displayName} 与 ${allBizProfiles[j].displayName}`))}</span>${renderInfoRows([{ label: bt('Compatibility Score','契合度评分'), value: `${cr.score}%`, color: scoreColor(cr.score), bg:'#fff' }])}${generateDeepAnalysisData('family_compat', allBizProfiles[i], { title: bt(`${allBizProfiles[i].displayName} & ${allBizProfiles[j].displayName} - Deep Analysis`, `${allBizProfiles[i].displayName} 与 ${allBizProfiles[j].displayName} - 深度分析`), otherP: allBizProfiles[j], otherLabel: allBizProfiles[j].displayName, compatResult: cr })}</article>`;
        }
      }
      const indivScores = allBizProfiles.map(bpP => calculateTrueCompatibility(p, bpP, true).score);
      const overallScore = Math.round([...pairScores, ...indivScores].reduce((a,b)=>a+b,0) / (pairScores.length + indivScores.length));
      html += `<article class="reading"><span class="pill">${trPill(bt('Overall Business Partners Compatibility','事业伙伴整体契合度'))}</span>${renderInfoRows([{ label: bt('Overall Score (All Partners & You)','整体契合度评分（您与所有伙伴）'), value: `${overallScore}%`, color: scoreColor(overallScore), bg:'#fff' }])}${generateDeepAnalysisData('family_overall', p, { title: bt('Overall Business Partnership Deep Analysis','事业伙伴整体契合度深度分析'), overallFamilyScore: overallScore, overallSiblingScore: Math.round(pairScores.reduce((a,b)=>a+b,0)/(pairScores.length||1)), childCount: allBizProfiles.length })}</article>`;
      html += `</div>`;
      overallContainer.innerHTML = html;
    } else { overallContainer.innerHTML = ''; }
  }
}

// ENHANCEMENT: Children tab (up to 5 children) - full profile + family compatibility matrix
function renderChildrenTab() {
  const u = activeUser(); if (!u) return;
  // BUG FIX (see purgeMainDeepAnalysisIds' own comment above deepAnalysisRegistry's declaration): same
  // fix as renderAllViews - this rebuilds the whole tab from scratch on every call, so the previous
  // batch of "View Details" buttons/registry entries is orphaned the moment this runs again.
  purgeMainDeepAnalysisIds();
  u.children = u.children || [];
  const p = getProfileData();
  const partnerP = u.partner ? getProfileData(u.partner) : null;

  // List of added children, each with a mini summary + expandable full chart
  const listHTML = u.children.length ? u.children.map((child, idx) => {
    const cp = getProfileData(child);
    return `<article class="reading" style="border-top:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong style="color:var(--plum)">${cp.englishName}${child.chineseFirstName || child.chineseLastName ? ` · ${child.chineseLastName||''}${child.chineseFirstName||''}` : ''}</strong>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${bt('Age','年龄')} ${getCurrentAge(cp.birthdate)} · ${cp.animal} (${cp.animalCN}) · ${bt('Day Master','日主')}: ${stems[cp.bazi.dayStemIdx]}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btnToggleChildChart" data-idx="${idx}" style="border:0;background:var(--sand);color:var(--plum);padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">${bt('View Chart','查看命盘')}</button>
          <button class="btnExportPdf" data-prefix="c${idx}" style="border:0;background:var(--sand);color:var(--plum);padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">📄</button>
          <button class="btnRemoveChild" data-idx="${idx}" style="border:0;background:var(--danger);color:#fff;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">${bt('Remove','移除')}</button>
        </div>
      </div>
      <div id="childChart-${idx}" style="display:none;margin-top:10px"></div>
    </article>`;
  }).join('') : `<div style="padding:16px;color:var(--muted);font-size:13px;text-align:center">${bt('No children added yet. Add up to 5 below.','尚未添加子女资料，最多可添加 5 位。')}</div>`;

  const listContainer = $('#childrenListContainer'); if (listContainer) listContainer.innerHTML = listHTML;

  // Show/hide the add form once 5 is reached
  const formWrap = $('#childAddFormWrap');
  if (formWrap) formWrap.style.display = u.children.length >= 5 ? 'none' : 'block';

  // Family Compatibility Matrix
  const compatContainer = $('#familyCompatSection');
  if (compatContainer) {
    if (!u.children.length) { compatContainer.innerHTML = ''; }
    else {
      const childProfiles = u.children.map(c => getProfileData(c));
      let html = `<h2 class="section-header">${bt('Family Compatibility','家庭契合度分析')}</h2>`;

      // Each child vs Individual (and vs Life Partner if available)
      childProfiles.forEach((cp, i) => {
        const crI = calculateTrueCompatibility(p, cp, false);
        html += `<article class="reading"><span class="pill">${trPill(bt(`${cp.displayName} & You`, `${cp.displayName} 与您`))}</span>${renderInfoRows([{ label: bt('Compatibility Score','契合度评分'), value: `${crI.score}%`, color: scoreColor(crI.score), bg:'#fff' }])}${generateDeepAnalysisData('family_compat', p, { title: bt(`${cp.displayName} & You - Deep Analysis`, `${cp.displayName} 与您 - 深度分析`), otherP: cp, otherLabel: cp.displayName, compatResult: crI })}</article>`;
        if (partnerP) {
          const crP = calculateTrueCompatibility(partnerP, cp, false);
          html += `<article class="reading"><span class="pill">${trPill(bt(`${cp.displayName} & Life Partner`, `${cp.displayName} 与伴侣`))}</span>${renderInfoRows([{ label: bt('Compatibility Score','契合度评分'), value: `${crP.score}%`, color: scoreColor(crP.score), bg:'#fff' }])}${generateDeepAnalysisData('family_compat', partnerP, { title: bt(`${cp.displayName} & Life Partner - Deep Analysis`, `${cp.displayName} 与伴侣 - 深度分析`), otherP: cp, otherLabel: cp.displayName, compatResult: crP })}</article>`;
        }
      });

      // Pairwise + overall, only if more than 1 child
      if (childProfiles.length > 1) {
        const pairScores = [];
        for (let i = 0; i < childProfiles.length; i++) {
          for (let j = i + 1; j < childProfiles.length; j++) {
            const cr = calculateTrueCompatibility(childProfiles[i], childProfiles[j], false);
            pairScores.push(cr.score);
            html += `<article class="reading"><span class="pill">${trPill(bt(`${childProfiles[i].displayName} & ${childProfiles[j].displayName}`, `${childProfiles[i].displayName} 与 ${childProfiles[j].displayName}`))}</span>${renderInfoRows([{ label: bt('Compatibility Score','契合度评分'), value: `${cr.score}%`, color: scoreColor(cr.score), bg:'#fff' }])}${generateDeepAnalysisData('family_compat', childProfiles[i], { title: bt(`${childProfiles[i].displayName} & ${childProfiles[j].displayName} - Deep Analysis`, `${childProfiles[i].displayName} 与 ${childProfiles[j].displayName} - 深度分析`), otherP: childProfiles[j], otherLabel: childProfiles[j].displayName, compatResult: cr })}</article>`;
          }
        }
        const overallSiblingScore = Math.round(pairScores.reduce((a,b)=>a+b,0) / pairScores.length);
        html += `<article class="reading"><span class="pill">${trPill(bt('Overall Sibling Compatibility','子女整体契合度'))}</span>${renderInfoRows([{ label: bt('Average Score Across All Siblings','所有子女平均契合度'), value: `${overallSiblingScore}%`, color: scoreColor(overallSiblingScore), bg:'#fff' }])}</article>`;

        // Overall all-children vs individual+partner combined
        const parentAvgScores = childProfiles.map(cp => {
          const crI = calculateTrueCompatibility(p, cp, false).score;
          const crP = partnerP ? calculateTrueCompatibility(partnerP, cp, false).score : null;
          return crP !== null ? Math.round((crI + crP) / 2) : crI;
        });
        const overallFamilyScore = Math.round(parentAvgScores.reduce((a,b)=>a+b,0) / parentAvgScores.length);
        html += `<article class="reading"><span class="pill">${trPill(bt('Overall Family Compatibility','家庭整体契合度'))}</span>${renderInfoRows([{ label: bt('All Children vs You & Life Partner','所有子女与您及伴侣的整体契合度'), value: `${overallFamilyScore}%`, color: scoreColor(overallFamilyScore), bg:'#fff' }])}${generateDeepAnalysisData('family_overall', p, { title: bt('Overall Family Compatibility Deep Analysis','家庭整体契合度深度分析'), overallFamilyScore, overallSiblingScore, childCount: childProfiles.length })}</article>`;
      }
      compatContainer.innerHTML = html;
    }
  }
}
function getCurrentAge(birthdateStr) { return computeCurrentAge(birthdateStr); }

// ENHANCEMENT 2: Hourly Daily Highlights tab - 12 Shi Chen blocks, each with its own real BaZi/QMDJ
// derivation, plus a Chinese Name element check (if available), full 7-part deep analysis, and
// recommended/avoid activities for that specific 2-hour window.
// PERFORMANCE FIX (reported again this round: "Lag on hourly tab is still happening. Upon loading the
// page, you cannot change the day, after you change the day, it take about 15-25 seconds before i can
// click on another day everytime"). The previous round fixed a genuine, real algorithmic bottleneck
// (findQmdjTerm/jieMoment redundantly rebuilding the same astronomical tables on every one of the 12
// hour-blocks - see engine-metaphysics.js's __jieMomentCache/__qmdjTermSpansCache), which measurably
// speeds up every block computed - but it never addressed WHERE that computation ran: only a day-SWITCH
// (via btnHourlyDayToggle) was ever chunked across several ticks; the INITIAL "today" computation
// inside renderHourlyTab, run every time the tab is opened or the profile selector is changed, was
// still one uninterrupted synchronous loop over all 12 blocks. That fully explains "upon loading the
// page, you cannot change the day" - the day-toggle buttons are technically present in the DOM the
// instant the tab opens, but the very next thing the main thread does is freeze solid computing "today"
// before ever yielding back to the browser, so no click registers until that finishes - and on a
// slower real device, that synchronous freeze is exactly the kind of multi-second stall the caching fix
// alone could not fully hide, since it cut the COST of each block, not the fact that all 12 still ran
// back-to-back with no chance for the browser to repaint or process input in between.
//
// This shared helper is used for BOTH the initial load and every subsequent day-switch (see the BUG FIX
// comment inside it for why it now runs all 12 blocks in one synchronous pass, with no timer-based
// chunking at all - the proven ~60ms real cost makes that imperceptible, and removes the timer-
// throttling exposure that chunking used to carry).
// `gen` guards against a stale, still-in-flight computation (e.g. the profile selector was changed
// again before "today" finished computing for the previous profile) ever overwriting the cache or DOM
// for whichever profile/tab is actually showing by the time it completes.
function computeHourlyDayChunked(ctx, dayOffset, dayKey, gen, onProgress, onDone) {
  const { p, nameCompat, elemNames, elemNamesZH } = ctx;
  const now = new Date();
  const blocks = [];
  // BUG FIX (root cause of the repeatedly-reported "15-25 second" hourly lag, finally reproduced this
  // round via direct live-browser measurement on the user's own running app, rather than guessed at
  // again - a temporary diagnostic patch timed both the real per-block compute cost and the actual
  // wall-clock gap between scheduling each setTimeout(0) and it firing. Findings: every sampled block
  // computed in under 5ms - a full 12-block day costs at most ~60ms of genuine CPU time - but the
  // previous "2 blocks per tick" chunking needed several separate setTimeout(0) hops to get through a
  // day, and the browser was clamping those hops hard: repeated runs measured ~1000ms per hop even while
  // the tab reported itself visible and focused, and in one run a SINGLE setTimeout(0) never fired at
  // all within a full minute of waiting - the renderer had plainly been deprioritized at the OS/browser
  // process level, not just "backgrounded" in the tab-visibility sense. A computation that costs ~60ms
  // of real CPU time was being made to wait on that deprioritized timer queue, over and over, once per
  // chunk - which is exactly the 15-25 second stall being reported, and exactly why no prior round's code
  // reading or synthetic (always-focused, single-process) test harness could ever reproduce it: none of
  // those ever put the renderer in a state the OS/browser considers low-priority.
  // Fix: run the computation immediately and synchronously by default (no setTimeout at all on the hot
  // path), since ~60ms is imperceptible either way and carries zero exposure to timer throttling.
  // BUG FIX (this round - the "safety net" above WAS the bug): the previous version kept a 40ms time
  // budget that fell back to a single setTimeout(0) hop whenever a chunk ran long, on the theory that
  // this case would be rare (~60ms total measured) and therefore rarely expose the proven timer-
  // throttling hazard. Live investigation (browser Performance recordings showing a near-idle main
  // thread - total Scripting+Rendering+Painting well under 1s - across a 50+ second span containing
  // multi-second-to-tens-of-seconds gaps between rendered frames) showed this fallback was still being
  // taken often enough, on this device, to reproduce the exact random 5-20+ second stalls being
  // reported - because on real hardware (background load, antivirus real-time scanning, actual
  // multi-profile data heavier than this app's own test fixtures) a chunk crossing 40ms is not the rare
  // edge case it was assumed to be, and every time it happens, the fallback hands control to the same
  // setTimeout queue already proven capable of sitting unscheduled for up to a full minute. There is no
  // way to keep "yield via setTimeout when slow" without keeping that exposure - so this now never
  // yields via a timer at all: all 12 blocks always run in one uninterrupted synchronous pass. The
  // proven real cost (tens of ms even on a cache-cold day) stays imperceptible either way, and this
  // path can no longer be handed off to a timer the OS/browser might refuse to run promptly.
  for (let shi = 0; shi < 12; shi++) {
    blocks.push(computeHourlySingleBlock(p, dayOffset, shi, now));
  }
  if (globalThis.__hourlyDayGen !== gen) return; // superseded by a newer render/profile switch - discard
  const html = buildHourlyDayHTML(p, blocks, nameCompat, elemNames, elemNamesZH);
  globalThis.__hourlyDayHTML = globalThis.__hourlyDayHTML || {};
  globalThis.__hourlyDayHTML[dayKey] = html;
  if (onDone) onDone(html);
}
function buildHourlyDayHTML(p, blocks, nameCompat, elemNames, elemNamesZH) {
  // ENHANCEMENT (this round): the full per-hour detail card (door rating, San Shi info, Suitable/
  // Avoid lists, and the 7-part Deep Analysis) used to always render inline for all 12 hours, making
  // this tab considerably longer than the summary table alone needed to be. Each hour's detail is now
  // registered in the same shared modal registry already used for Deep Analysis and lottery-accuracy
  // pop-ups elsewhere in the app, and the summary table's own rows become the trigger - clicking a row
  // opens that hour's full detail in the pop-up instead of it always being on the page.
  blocks.forEach(b => {
    const relDesc = bt({
      same: `reinforces your Day Master directly`, generates: `feeds and nourishes your Day Master`,
      drains: `is fed by your Day Master, drawing on your energy`, controls: `is restrained by your Day Master`, clashed_by: `restrains your Day Master`
    }[b.rel], { same: `直接增强您的日主`, generates: `滋养生扶您的日主`, drains: `被您的日主所生，消耗精力`, controls: `被您的日主所克`, clashed_by: `克制您的日主` }[b.rel]);
    const nameNote = nameCompat ? bt(
      ` Your Chinese name's dominant element (${elemNames[nameCompat.dominantElemIdx]}) ${nameCompat.dominantElemIdx === b.elemIdx ? 'matches this hour\'s element, adding reinforcement' : 'differs from this hour\'s element'}.`,
      `您中文名字的主导五行（${elemNamesZH[nameCompat.dominantElemIdx]}）${nameCompat.dominantElemIdx === b.elemIdx ? '与本时辰五行相同，增添助力' : '与本时辰五行不同'}。`
    ) : '';
    const suitable = bt(ZERI_ACTIVITY_POOL_EN, ZERI_ACTIVITY_POOL_ZH).filter((_, i) => mod(b.shiIdx + i, 3) === 0).slice(0, 3);
    const avoid = bt(ZERI_AVOID_POOL_EN, ZERI_AVOID_POOL_ZH).filter((_, i) => mod(b.shiIdx + i + 1, 3) === 0).slice(0, 3);
    const ratingLabel = bt(b.rating.tierEN, b.rating.tierZH);
    const ratingColor = b.rating.tierColor;
    b.suitableList = suitable; b.tierLabel = ratingLabel; b.tierAbbrLabel = bt(b.rating.tierAbbr, b.rating.tierAbbrZh); // full label for the pop-up header, abbreviated for the compact summary table

    const deep = renderStandardDeepAnalysisRaw(
      bt(`${b.label} Deep Analysis`, `${b.label}深度分析`),
      bt(`This block runs under the ${b.stemCN}${b.branchCN} Hour Pillar, sitting in Palace ${b.palace} (${b.cell.door}, rated ${b.doorRating}) on today's hourly Qi Men Dun Jia chart.`, `本时辰行${b.stemCN}${b.branchCN}时柱，位于今日每小时奇门遁甲盘的第${b.palace}宫（${b.cell.door}，评级：${b.doorRating}）。`) + nameNote,
      bt(`This hour's element ${relDesc}${b.isClash ? ', and additionally forms a Six Clash with your natal Day Branch' : b.isHarmony ? ', and additionally forms a Six Harmony with your natal Day Branch' : ''}.`, `本时辰五行${relDesc}${b.isClash ? '，且与您本命日支形成六冲' : b.isHarmony ? '，且与您本命日支形成六合' : ''}。`),
      bt(`Overall this window leans ${b.caution ? 'sensitive - move carefully' : b.favourable ? 'expansive and supportive' : 'steady and neutral'}.`, `整体而言，本时段偏向${b.caution ? '敏感——宜谨慎行事' : b.favourable ? '外放且有助力' : '平稳中性'}。`),
      [bt(`Door rating: ${b.doorRating}.`,`门位评级：${b.doorRating}。`), bt(`Palace ${b.palace} active this hour.`,`本时辰值宫为第${b.palace}宫。`)],
      b.favourable ? [bt('Good window for the recommended activities below.','适合进行以下建议活动。'), bt('Energy supports proactive moves.','能量支持主动出击。')] : [bt('Still workable with a measured approach.','仍可行事，宜稳健应对。')],
      b.caution ? [bt('Elevated sensitivity - avoid high-stakes commitments.','敏感度较高——避免高风险承诺。')] : [bt('No major red flags this hour.','本时辰无重大警示。')],
      b.caution ? [bt('Avoid the activities listed below during this window.','此时段请避免以下活动。'), bt('Double-check important communications.','重要沟通请再三确认。')] : [bt('Keep decisions proportionate to the hour\'s neutral-to-supportive energy.','决策宜与本时辰中性偏有利的能量相称。')]
    );

    const fullDetailHTML = `<div style="padding:15px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong style="color:var(--plum);font-size:15px">${b.label} ${b.isNow ? `· ${bt('NOW','现在')}` : ''}</strong>
        <span style="color:#fff;background:${ratingColor};padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700">${ratingLabel}</span>
      </div>
      <div style="font-size:12px;color:var(--muted);margin:4px 0 8px">${bt('Hour Pillar','时柱')}: ${b.stemCN}${b.branchCN} · ${bt('Palace','宫位')} ${b.palace}${b.isYiMaPalace ? bt(' · 🐎 Yi Ma (travel-favourable)',' · 🐎 驿马（宜出行）') : ''}${b.isKongPalace ? bt(' · ◌ Kong Wang (void)',' · ◌ 空亡') : ''}</div>
      <div style="font-size:11px;color:#7a4f00;margin-bottom:8px">${bt('San Shi (Da Liu Ren) Chu Chuan','三式（大六壬）初传')}: ${branchCN[b.daLiuRen.chuChuan]} (${b.daLiuRen.chuChuanGeneral.split(' ')[0]}) - ${bt(b.daLiuRen.chuChuanRating.tierEN, b.daLiuRen.chuChuanRating.tierZH)}</div>
      <div style="font-size:12px;margin-bottom:6px"><strong style="color:var(--success)">${bt('Suitable for','宜')}:</strong> ${suitable.join(', ')}${b.isYiMaPalace ? bt(', travel/relocation','、出行／搬迁') : ''}</div>
      <div style="font-size:12px;margin-bottom:8px"><strong style="color:var(--danger)">${bt('Avoid','忌')}:</strong> ${avoid.join(', ')}${b.isKongPalace ? bt(', signing major agreements (Void hour)','、签订重大合约（空亡时段）') : ''}</div>
      ${deep}
    </div>`;
    const popupId = 'hourly_' + Math.random().toString(36).slice(2) + '_' + b.shiIdx;
    deepAnalysisRegistry[popupId] = fullDetailHTML;
    // MEMORY-LEAK FIX: record this id so renderHourlyTab can purge it (along with every other hourly
    // popup from this tab-visit) the next time the Hourly tab is opened - see the fuller comment there.
    if (Array.isArray(globalThis.__hourlyPopupIds)) globalThis.__hourlyPopupIds.push(popupId);
    b.popupId = popupId;
  });

  const summaryRows = blocks.map(b => `<tr class="btnViewDeepAnalysis" data-id="${b.popupId}" style="cursor:pointer;${b.isNow ? 'background:var(--goldsoft);font-weight:700' : ''}">
    <td style="padding:6px 8px;border:1px solid #eee;text-align:center">${b.label}${b.isNow ? bt(' (Now)',' (现在)') : ''}</td>
    <td style="padding:6px 8px;border:1px solid #eee;text-align:center"><span style="display:inline-block;min-width:22px;color:#fff;background:${b.rating.tierColor};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700" title="${b.tierLabel}">${b.tierAbbrLabel}</span></td>
    <td style="padding:6px 8px;border:1px solid #eee;font-size:11px">${b.suitableList.slice(0,2).join(', ')}${b.isYiMaPalace ? bt(', travel',' 、出行') : ''}</td>
    <td style="padding:6px 8px;border:1px solid #eee;text-align:center;color:var(--plum);font-size:11px;white-space:nowrap">${bt('View','查看')} ›</td>
  </tr>`).join('');
  const summaryTable = `
    <div style="margin-bottom:16px;overflow-x:auto">
      <strong style="color:var(--plum);font-size:13px">${bt('Hourly Summary','时辰总览')}</strong>
      <div style="font-size:10px;color:var(--muted);margin:2px 0 6px">${bt('Tap any row for that hour\'s full detail.','点击任一行以查看该时辰完整详情。')}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:#f4f4f4">
          <th style="padding:6px 8px;border:1px solid #eee">${bt('Time','时辰')}</th>
          <th style="padding:6px 8px;border:1px solid #eee">${bt('Rating','评级')}</th>
          <th style="padding:6px 8px;border:1px solid #eee">${bt('Suitable For','宜')}</th>
          <th style="padding:6px 8px;border:1px solid #eee"></th>
        </tr>
        ${summaryRows}
      </table>
      ${renderRatingLegend(HOURLY_TIER_LABELS)}
    </div>
  `;
  return summaryTable;
}

// BUG 8 FIX: hourly highlights can now be viewed for any saved profile (individual, life partner,
// business partner, additional business partners, children), not just the individual. Reuses the
// same prefix scheme as getProfileByPrefix for consistency with the rest of the app.
function buildHourlyProfileOptions() {
  const u = activeUser(); if (!u) return [];
  const options = [];
  if (u.profile) options.push({ prefix: 'i', label: bt(`${u.profile.englishFirstName} (You)`, `${u.profile.englishFirstName}（本人）`) });
  if (u.partner) options.push({ prefix: 'p', label: bt(`${u.partner.englishFirstName} (Life Partner)`, `${u.partner.englishFirstName}（人生伴侣）`) });
  if (u.businessPartner) options.push({ prefix: 'b', label: bt(`${u.businessPartner.englishFirstName} (Business Partner)`, `${u.businessPartner.englishFirstName}（事业伙伴）`) });
  (u.additionalBizPartners || []).forEach((bp, i) => options.push({ prefix: `b2_${i}`, label: bt(`${bp.englishFirstName} (Business Partner)`, `${bp.englishFirstName}（事业伙伴）`) }));
  (u.children || []).forEach((c, i) => options.push({ prefix: `c${i}`, label: bt(`${c.englishFirstName} (Child)`, `${c.englishFirstName}（子女）`) }));
  return options;
}

// ENHANCEMENT (this round): Detailed Reading - a full narrative BaZi reading (Life, Career, Wealth,
// Luck, Love, Health, Current/Next Year, Current/Next Cycle, Full Summary), generated dynamically from
// each profile's own computed chart data via computeDetailedReadingAnalysis - nothing here is
// hardcoded to any specific sample; every profile gets its own reading built from its own numbers.
const ELEM_NAMES_EN = ['Wood','Fire','Earth','Metal','Water'];
const ELEM_NAMES_ZH = ['木','火','土','金','水'];
const GOD_CAREER_HINTS = {
  'DO': { en: 'structured, accountable roles - management, compliance, institutional or government-adjacent work', zh: '结构清晰、责任分明的职务——管理、合规、体制内或相关领域工作' },
  '7K': { en: 'high-pressure, competitive, or crisis-driven roles - sales, operations under pressure, entrepreneurship, crisis management', zh: '高压、竞争或危机驱动的角色——销售、高压营运、创业、危机处理' },
  'DW': { en: 'steady, fixed-income paths - salaried roles, established institutions, long-term employment', zh: '稳定固定收入的路径——受薪职位、稳健机构、长期任职' },
  'IW': { en: 'opportunistic, deal-driven income - business development, trading, independent ventures, multiple income streams', zh: '机会型、交易导向的收入——业务拓展、贸易、独立经营、多重收入来源' },
  'EG': { en: 'creative, expressive, or teaching-oriented work where steady output is rewarded', zh: '具创意、表达性或教学性质、且稳定产出能获得回报的工作' },
  'HO': { en: 'unconventional, expertise-driven, or innovation-heavy roles - consulting, R&D, creative problem-solving under autonomy', zh: '非常规、专业导向或高度创新的角色——顾问、研发、需要自主性的创意解难工作' },
  'DR': { en: 'credential-building, academic, or mentorship-oriented paths', zh: '重视学历累积、学术或师承性质的路径' },
  'IR': { en: 'specialist, unconventional-knowledge, or intuition-driven paths - research, healing arts, metaphysics-adjacent fields', zh: '专精型、非传统知识或直觉导向的路径——研究、疗愈相关工作、玄学相关领域' },
  'RW': { en: 'competitive team environments, partnerships requiring vigilance', zh: '需竞争的团队环境、需保持警觉的合伙关系' },
  'P': { en: 'independent, self-directed work', zh: '独立自主的工作模式' }
};

function generateDetailedReading(p) {
  const a = computeDetailedReadingAnalysis(p);
  const bazi = p.bazi;
  const dmElemEN = ELEM_NAMES_EN[a.dmElemIdx], dmElemZH = ELEM_NAMES_ZH[a.dmElemIdx];
  const strengthLabel = bt(
    { strong: 'well-resourced and holding its own', balanced: 'reasonably balanced', weak: 'weak-to-moderate' }[a.dmStrength],
    { strong: '根基充足，力量不弱', balanced: '较为平衡', weak: '偏弱至中等' }[a.dmStrength]
  );
  const g = a.dominantGod;
  const godNameBT = bt(g.en, g.cn);
  const careerHint = GOD_CAREER_HINTS[g.abbr] || GOD_CAREER_HINTS['P'];

  const sectionHTML = (num, titleEN, titleZH, bodyHTML) => `
    <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px dashed var(--line)">
      <h4 style="color:var(--plum);font-size:14px;margin:0 0 8px 0">${num}) ${bt(titleEN, titleZH)}</h4>
      <div style="font-size:13px;line-height:1.7;color:var(--ink)">${bodyHTML}</div>
    </div>`;

  // 1) Life
  const seasonLabel = bt(a.seasonalState.en, a.seasonalState.zh);
  const rootNote = bt(
    a.rootCount === 0 ? 'with no roots for your own element among the four branches - a genuinely unanchored Day Master' : `with ${a.rootCount} of the 4 branches rooting your own element - a meaningfully grounded Day Master`,
    a.rootCount === 0 ? '四柱地支中未见本气之根——日主确实缺乏根基' : `四柱中有${a.rootCount}柱藏有本气之根——日主根基扎实`
  );
  const lifeHTML = bt(
    `Born in a month commanding ${ELEM_NAMES_EN[MONTH_COMMANDING_ELEMENT[bazi.monthBranchIdx]]}, your ${dmElemEN} Day Master sits in the ${seasonLabel} state this season - ${rootNote}. Weighed together (seasonal command, roots, and stem support - seasonal command carrying the most weight, per standard practice), the Day Master runs ${strengthLabel}, with ${g.en} the most prominent influence across your chart. ${
      a.dmStrength === 'weak'
        ? `This tends to produce someone who absorbs pressure quietly rather than resisting it outright, converting demands placed on them into ${a.hasHurtingOfficer || a.hasEatingGod ? 'output and results' : 'endurance and consistency'} over time.`
        : a.dmStrength === 'strong'
          ? `This tends to produce someone with a clear, confident sense of self, generally more able to set terms on their own environment than to be shaped by it.`
          : `This tends to produce someone who moves between asserting themselves and adapting to circumstances, without a strong lean toward either.`
    } ${a.hasSevenKillings ? 'A recurring undertone of pressure or responsibility (Seven Killings) runs through the chart - rarely explosive, but persistent.' : ''} ${a.hasHurtingOfficer ? 'The Hurting Officer present gives a genuine outlet for turning obligation into cleverness or achievement.' : ''}`,
    `您生于${ELEM_NAMES_ZH[MONTH_COMMANDING_ELEMENT[bazi.monthBranchIdx]]}当令之月，您的${dmElemZH}日主本季处于「${seasonLabel}」之态——${rootNote}。综合月令、根基与天干助力（依一般准则，月令权重最高）判断，日主${strengthLabel}，命盘中以「${g.cn}」影响最为突出。${
      a.dmStrength === 'weak'
        ? `这类命局通常表现为默默承受压力而非正面抗衡，随时间将外在要求转化为${a.hasHurtingOfficer || a.hasEatingGod ? '产出与成果' : '耐力与稳定性'}。`
        : a.dmStrength === 'strong'
          ? `这类命局通常自我意识清晰、自信，较能主导环境，而非被环境牵动。`
          : `这类命局通常在自我主张与顺应环境之间取得平衡，没有明显偏向。`
    } ${a.hasSevenKillings ? '命中隐含持续的压力或责任感（七杀），虽不常爆发，却挥之不去。' : ''} ${a.hasHurtingOfficer ? '伤官的存在提供了将责任转化为智巧与成就的真实出路。' : ''}`
  );
  const usefulGodHTML = bt(
    `<strong>Useful God (用神):</strong> per the standard "Support and Suppress" (扶抑法) method - the most fundamental approach in BaZi practice - your ${a.dmStrength} Day Master is best served by ${a.usefulGod.leansStrong ? 'elements that drain or control it' : 'elements that support or generate it'}: <strong>${a.usefulGod.favourable.map(i=>ELEM_NAMES_EN[i]).join(', ')}</strong> are favourable for you, while <strong>${a.usefulGod.unfavourable.map(i=>ELEM_NAMES_EN[i]).join(', ')}</strong> lean unfavourable. This verdict is referenced throughout the rest of this reading (Wealth, and the Year/Cycle sections) rather than treating Wealth or Officer energy as generically good or bad regardless of your chart. <em>Not covered: special "Follow the Structure" (从格) patterns, where an extremely one-sided chart is read with the opposite logic, and seasonal Climate Adjustment (调候) for charts born into extreme cold, heat, dryness, or dampness - both require case-by-case judgement beyond what this heuristic attempts.</em>`,
    `<strong>用神：</strong>依「扶抑法」（八字学中最基础的方法）判断，您${a.dmStrength === 'strong' ? '较强' : a.dmStrength === 'weak' ? '偏弱' : '中等'}的日主最需要${a.usefulGod.leansStrong ? '能泄耗或克制它的' : '能生扶它的'}元素：<strong>${a.usefulGod.favourable.map(i=>ELEM_NAMES_ZH[i]).join('、')}</strong>对您有利，<strong>${a.usefulGod.unfavourable.map(i=>ELEM_NAMES_ZH[i]).join('、')}</strong>则偏向不利。此判断将贯穿本篇解读其余部分（财富、流年与大运各节），而非不论命盘如何都将财星或官杀一概视为吉或凶。<em>未涵盖之处：特殊的「从格」（命局极端偏向一方时，判断逻辑相反）与「调候」（针对出生于极端寒暑燥湿之月的调整）——两者皆需逐案判断，超出本简化推算范围。</em>`
  );

  // 2) Career
  const careerHTML = bt(
    `Your Month Pillar (career palace) carries ${a.careerPalaceGods.map(cg => cg.en).join(', ')} in its hidden stems. ${a.hasSevenKillings || a.hasDirectOfficer ? 'Pressure and accountability show up as real career themes, not just occasional stress.' : ''} Given ${g.en} as the dominant influence, you're likely best suited to ${careerHint.en}. ${a.hasHurtingOfficer ? 'A strong problem-solving streak likely chafes under rigid, closely-supervised structures, but thrives with real autonomy.' : ''}`,
    `您的月柱（事业宫）藏干含「${a.careerPalaceGods.map(cg => cg.cn).join('、')}」。${a.hasSevenKillings || a.hasDirectOfficer ? '压力与责任是您事业中真实存在的主题，而非偶发的压力感。' : ''} 以「${g.cn}」为主导影响，您较适合${careerHint.zh}。${a.hasHurtingOfficer ? '较强的解难能力在受严密管控的僵化架构下容易感到压抑，但在具备自主空间时则能充分发挥。' : ''}`
  );

  // 3) Wealth
  const wealthDominant = a.indirectWealthCount > a.directWealthCount ? 'indirect' : (a.directWealthCount > a.indirectWealthCount ? 'direct' : 'balanced');
  const wealthElemIdx = mod(a.dmElemIdx + 2, 5);
  const wealthIsUsefulGod = a.usefulGod.favourable.includes(wealthElemIdx);
  const wealthVerdictHTML = bt(
    wealthIsUsefulGod
      ? `Per Useful God (用神) analysis, Wealth is genuinely favourable for your chart - it's one of the elements your ${a.dmStrength === 'strong' ? 'strong' : 'chart'} Day Master needs to stay in balance, so wealth-building activity tends to work with your structure rather than against it.`
      : `Per Useful God (用神) analysis, Wealth sits on the unfavourable side for your chart - your Day Master is better served by support than by more Wealth pressure, so wealth pursued without enough underlying support can feel like it costs more than it returns, even when the amounts look fine on paper.`,
    wealthIsUsefulGod
      ? `依用神分析，财星对您的命盘确实有利——这是您${a.dmStrength === 'strong' ? '较强的' : ''}日主维持平衡所需的元素之一，因此求财活动往往与命局结构相辅相成，而非彼此拉扯。`
      : `依用神分析，财星对您的命盘偏向不利——您的日主更需要扶助而非更多财星压力，因此若求财时缺乏足够支持，即使数字看似不错，实际上也可能得不偿失。`
  );
  const wealthHTML = bt(
    `${a.directWealthCount + a.indirectWealthCount === 0 ? 'Wealth stars are not prominent in your chart - income here tends to follow effort and role rather than dramatic swings.' : wealthDominant === 'indirect' ? `Indirect Wealth (${a.indirectWealthCount} occurrence${a.indirectWealthCount===1?'':'s'}) outweighs Direct Wealth (${a.directWealthCount}) - opportunistic, multi-stream, business-oriented income suits you better than a single fixed paycheck.` : wealthDominant === 'direct' ? `Direct Wealth (${a.directWealthCount} occurrence${a.directWealthCount===1?'':'s'}) outweighs Indirect Wealth (${a.indirectWealthCount}) - steady, structured income (salary, contracts) is your more natural lane than speculative ventures.` : `Direct and Indirect Wealth are evenly balanced (${a.directWealthCount} each) - both stable income and opportunistic ventures can work for you.`} ${a.hasRobWealth ? 'A caution flag: Rob Wealth in the chart means wealth can be contested, shared, or lost through partnerships or competition if not actively managed.' : ''} ${wealthVerdictHTML}`,
    `${a.directWealthCount + a.indirectWealthCount === 0 ? '命盘中财星并不突出——此处收入较随努力与职务而定，而非大起大落。' : wealthDominant === 'indirect' ? `偏财（出现${a.indirectWealthCount}次）多于正财（${a.directWealthCount}次）——机会型、多元、business导向的收入比单一固定薪资更适合您。` : wealthDominant === 'direct' ? `正财（出现${a.directWealthCount}次）多于偏财（${a.indirectWealthCount}次）——稳定结构化的收入（薪资、合约）比投机性事业更符合您的本质。` : `正财与偏财数量相当（各${a.directWealthCount}次）——稳定收入与机会型事业对您皆可行。`} ${a.hasRobWealth ? '需留意：命中劫财意味着若不主动管理，财富可能因合伙或竞争而被分薄或流失。' : ''} ${wealthVerdictHTML}`
  );

  // 4) Luck (Direct/Indirect/Windfall)
  const luckHTML = bt(
    `<strong>Direct Wealth:</strong> ${a.directWealthCount === 0 ? 'not present in hidden stems - stable fixed-salary income is not your natural strong suit.' : `present (${a.directWealthCount}x) - some genuine capacity for stable income exists.`}<br>
     <strong>Indirect Wealth:</strong> ${a.indirectWealthCount === 0 ? 'not present - opportunistic deal-making is less of a natural lane for you.' : `present (${a.indirectWealthCount}x) - deal-making and multiple income streams are within your natural range.`}<br>
     <strong>Windfall potential:</strong> ${a.indirectWealthCount >= 2 ? 'above-average, given how exposed Indirect Wealth is in this chart - though periods that add pressure without matching support tend to make gains feel costly rather than easy.' : 'unremarkable on this specific indicator - windfalls are possible but not a standout theme here.'}`,
    `<strong>正财：</strong>${a.directWealthCount === 0 ? '藏干中未见——稳定固定薪资并非您的天然强项。' : `命中出现（${a.directWealthCount}次）——具备一定稳定收入的能力。`}<br>
     <strong>偏财：</strong>${a.indirectWealthCount === 0 ? '未见——机会型交易并非您的天然领域。' : `命中出现（${a.indirectWealthCount}次）——交易与多元收入在您能力范围之内。`}<br>
     <strong>横财潜力：</strong>${a.indirectWealthCount >= 2 ? '因偏财在命盘中较为外显，潜力高于平均——但若某段时期压力增加而缺乏相应支持，所得往往伴随代价，而非轻松而来。' : '就此项指标而言并不突出——横财并非不可能，但非此命盘的主要主题。'}`
  );

  // 5) Love
  const spouseHasKillingsOrOfficer = a.spousePalaceGods.some(g2 => ['7K','DO'].includes(g2.abbr));
  const spouseHasWealth = a.spousePalaceGods.some(g2 => ['DW','IW'].includes(g2.abbr));
  const loveHTML = bt(
    `Your Day branch (spouse palace) carries ${a.spousePalaceGods.map(g2=>g2.en).join(', ')} in its hidden stems. ${spouseHasKillingsOrOfficer ? 'This suggests a relationship with some real intensity - often reflecting a strong-willed, capable partner rather than a low-friction dynamic.' : 'This does not carry a particularly intense signature - relationships here tend toward steadiness rather than drama.'} ${spouseHasWealth ? 'Wealth stars in this same palace point to genuine capacity for a stable, committed partnership.' : ''} ${a.hasHurtingOfficer ? 'Your own Hurting Officer gives real capacity to resolve friction through communication rather than conflict.' : ''}`,
    `您的日支（配偶宫）藏干含「${a.spousePalaceGods.map(g2=>g2.cn).join('、')}」。${spouseHasKillingsOrOfficer ? '这显示感情关系带有一定强度——往往反映伴侣个性坚强、能力出众，而非毫无摩擦的相处模式。' : '此宫位并无特别强烈的信号——感情关系较倾向稳定而非戏剧化。'} ${spouseHasWealth ? '同一宫位中的财星显示您具备维持稳定、认真投入关系的真实能力。' : ''} ${a.hasHurtingOfficer ? '您本身的伤官赋予您透过沟通化解摩擦、而非诉诸冲突的真实能力。' : ''}`
  );

  // 6) Health
  const healthHTML = bt(
    `Following the standard Five-Element to organ-system mapping: your own ${dmElemEN} system is the one under the most direct pressure given a ${a.dmStrength} Day Master - worth prioritizing preventive care there specifically. ${a.hasSevenKillings ? 'The recurring Seven Killings pressure theme commonly shows up as chronic, low-grade stress affecting digestion or sleep rather than any single acute issue.' : ''} Build in active recovery rather than just pushing through, given the chart's general tendency to absorb and carry pressure.`,
    `依五行与脏腑对应的一般原则：鉴于日主${a.dmStrength === 'weak' ? '偏弱' : a.dmStrength === 'strong' ? '较强' : '中等'}，您自身${dmElemZH}对应的系统承受压力最直接——值得特别注重此处的预防保健。${a.hasSevenKillings ? '七杀带来的持续压力主题，常以慢性、低强度的压力形式影响消化或睡眠，而非单一急性病症。' : ''} 鉴于命盘整体偏向默默承受压力，建议主动安排恢复时间，而非一味硬撑。`
  ) + `<div style="margin-top:6px;font-size:11px;color:var(--muted)">${bt('This traditional symbolic framework is for reflection only, never a substitute for medical advice.','此传统象征性框架仅供参考反思，绝不可取代专业医疗建议。')}</div>`;

  // 7) Current Year Summary
  const favVerdict = (isFav) => bt(
    isFav ? ' Per Useful God analysis, this year\'s element sits on your favourable side - conditions genuinely work with you here, not just neutrally.' : ' Per Useful God analysis, this year\'s element sits on your unfavourable side - worth extra care and deliberate pacing rather than assuming momentum will carry it.',
    isFav ? ' 依用神分析，本年五行属您的有利一方——环境确实对您有利，而非仅止于中性。' : ' 依用神分析，本年五行属您的不利一方——宜格外谨慎、主动调节步伐，而非仅靠顺势而为。'
  );
  const curYearHTML = bt(
    `${a.nowYear} (${stemCN[a.curYearPillar.stemIdx]}${branchCN[a.curYearPillar.branchIdx]}): the year's stem is ${a.curYearGod.en} relative to your Day Master, with hidden branch influences of ${a.curYearBranchHiddenGods.map(g2=>g2.en).join(', ')}. ${a.isCycleTransitionNow ? 'This also falls right at (or very near) your Luck Pillar transition - a genuine threshold year, not just "more of the same" as the prior cycle.' : ''} ${['DW','IW'].includes(a.curYearGod.abbr) ? 'A Wealth-flavoured year - active opportunities for income or deals, though watch for overextension if the Day Master is already under pressure.' : ['7K','DO'].includes(a.curYearGod.abbr) ? 'An Officer/Killings-flavoured year - added responsibility, scrutiny, or institutional pressure is a likely theme.' : ['EG','HO'].includes(a.curYearGod.abbr) ? 'An Output-flavoured year - a good stretch for creative work, expression, and converting effort into visible results.' : 'A Resource/Peer-flavoured year - more geared toward consolidation, learning, and support than dramatic external change.'}${favVerdict(a.curYearFavourable)}`,
    `${a.nowYear}年（${stemCN[a.curYearPillar.stemIdx]}${branchCN[a.curYearPillar.branchIdx]}）：流年天干相对您的日主为「${a.curYearGod.cn}」，地支藏干影响包括「${a.curYearBranchHiddenGods.map(g2=>g2.cn).join('、')}」。${a.isCycleTransitionNow ? '此年恰逢（或接近）大运交替之际——是真正的转折年，而非上一运程的延续。' : ''} ${['DW','IW'].includes(a.curYearGod.abbr) ? '本年财星色彩浓厚——收入或交易机会活跃，但若日主本已承压，需留意过度扩张。' : ['7K','DO'].includes(a.curYearGod.abbr) ? '本年官杀色彩浓厚——责任加重、受关注或体制压力可能是主要主题。' : ['EG','HO'].includes(a.curYearGod.abbr) ? '本年食伤色彩浓厚——适合创意工作、自我表达，将努力转化为可见成果。' : '本年印比色彩浓厚——较偏向巩固、学习与支持，而非剧烈的外在变动。'}${favVerdict(a.curYearFavourable)}`
  );

  // 8) Current Cycle Summary
  const cycleFavVerdict = (isFav) => bt(
    isFav ? ' Per Useful God analysis, this cycle\'s element is genuinely favourable for your chart, reinforcing what you need rather than adding to what you already have too much of.' : ' Per Useful God analysis, this cycle\'s element leans unfavourable for your chart - the rating above already reflects this, but it\'s worth naming directly: this decade calls for more deliberate management, not passive momentum.',
    isFav ? ' 依用神分析，此运程五行确实对命盘有利，能补足您真正所需，而非加重原已过多之处。' : ' 依用神分析，此运程五行偏向不利——上方评级已反映此点，但仍值得明确指出：此十年需要更主动的自我管理，而非被动顺势而行。'
  );
  const curCycleHTML = a.curCycle ? bt(
    `${stemCN[a.curCycle.stemIdx]}${branchCN[a.curCycle.branchIdx]}, ages ${a.curCycle.age}-${a.curCycle.age+9} (${a.curCycle.calendarYearStart}-${a.curCycle.calendarYearStart+9}): this cycle's stem is ${a.curCycleGod.en} relative to your Day Master, rated ${bt(a.curCycle.rating.tierEN, a.curCycle.rating.tierZH)} by this app's simplified cycle heuristic. Hidden branch influences: ${a.curCycleBranchHiddenGods.map(g2=>g2.en).join(', ')}. ${['P','RW','DR','IR'].includes(a.curCycleGod.abbr) ? 'This cycle directly reinforces your own element - likely a more personally empowered decade than one leaning on Wealth/Officer pressure alone.' : ['DW','IW'].includes(a.curCycleGod.abbr) ? 'A Wealth-flavoured decade - business and income opportunity is the likely throughline, alongside the need for active management given the earlier Wealth findings.' : ['7K','DO'].includes(a.curCycleGod.abbr) ? 'An Officer/Killings-flavoured decade - expect continued pressure and responsibility as a central theme, though how well it lands depends on how supported your Day Master is elsewhere.' : 'An Output-flavoured decade - a period more geared toward expression, creative reward, and converting prior effort into visible results.'}${cycleFavVerdict(a.curCycleFavourable)}`,
    `${stemCN[a.curCycle.stemIdx]}${branchCN[a.curCycle.branchIdx]}，${a.curCycle.age}至${a.curCycle.age+9}岁（${a.curCycle.calendarYearStart}至${a.curCycle.calendarYearStart+9}年）：此运程天干相对您的日主为「${a.curCycleGod.cn}」，依本应用的简化运程评级为「${bt(a.curCycle.rating.tierEN, a.curCycle.rating.tierZH)}」。地支藏干影响：「${a.curCycleBranchHiddenGods.map(g2=>g2.cn).join('、')}」。${['P','RW','DR','IR'].includes(a.curCycleGod.abbr) ? '此运程直接强化您自身五行——相较单纯依赖财官压力的运程，此十年可能更能让您感到得心应手。' : ['DW','IW'].includes(a.curCycleGod.abbr) ? '此运程财星色彩浓厚——商业与收入机会可能是主轴，同时仍需如前述主动管理财运。' : ['7K','DO'].includes(a.curCycleGod.abbr) ? '此运程官杀色彩浓厚——预期责任与压力持续作为核心主题，其影响程度则视日主在其他方面获得的支持而定。' : '此运程食伤色彩浓厚——较偏向自我表达、创意回报，将先前的努力转化为可见成果。'}${cycleFavVerdict(a.curCycleFavourable)}`
  ) : `<em>${bt('No further Luck Pillar data available (chart extends to age 100).','暂无更多大运资料（命盘运程已推算至100岁）。')}</em>`;

  // 9) Next Year Summary
  const nextYearNum = a.nowYear + 1;
  const nextYearHTML = bt(
    `${nextYearNum} (${stemCN[a.nextYearPillar.stemIdx]}${branchCN[a.nextYearPillar.branchIdx]}): stem is ${a.nextYearGod.en} relative to your Day Master, hidden branch influences of ${a.nextYearBranchHiddenGods.map(g2=>g2.en).join(', ')}. ${a.nextYearGod.abbr !== a.curYearGod.abbr ? `This shifts in flavour from ${a.nowYear}'s ${a.curYearGod.en} theme - worth watching how the tone of the year changes as a result.` : `This continues in the same ${a.curYearGod.en} flavour as ${a.nowYear}, extending rather than reversing this year's themes.`}${favVerdict(a.nextYearFavourable)}`,
    `${nextYearNum}年（${stemCN[a.nextYearPillar.stemIdx]}${branchCN[a.nextYearPillar.branchIdx]}）：天干相对您的日主为「${a.nextYearGod.cn}」，地支藏干影响「${a.nextYearBranchHiddenGods.map(g2=>g2.cn).join('、')}」。${a.nextYearGod.abbr !== a.curYearGod.abbr ? `相较${a.nowYear}年的「${a.curYearGod.cn}」主题有所转变——值得留意本年基调的变化。` : `延续${a.nowYear}年同样的「${a.curYearGod.cn}」基调，是本年主题的延伸而非逆转。`}${favVerdict(a.nextYearFavourable)}`
  );

  // 10) Next Cycle Summary
  const nextCycleHTML = a.nextCycle ? bt(
    `${stemCN[a.nextCycle.stemIdx]}${branchCN[a.nextCycle.branchIdx]}, ages ${a.nextCycle.age}-${a.nextCycle.age+9} (${a.nextCycle.calendarYearStart}-${a.nextCycle.calendarYearStart+9}): stem is ${a.nextCycleGod.en} relative to your Day Master, rated ${bt(a.nextCycle.rating.tierEN, a.nextCycle.rating.tierZH)}. Hidden branch influences: ${a.nextCycleBranchHiddenGods.map(g2=>g2.en).join(', ')}.${cycleFavVerdict(a.nextCycleFavourable)}`,
    `${stemCN[a.nextCycle.stemIdx]}${branchCN[a.nextCycle.branchIdx]}，${a.nextCycle.age}至${a.nextCycle.age+9}岁（${a.nextCycle.calendarYearStart}至${a.nextCycle.calendarYearStart+9}年）：天干相对您的日主为「${a.nextCycleGod.cn}」，评级为「${bt(a.nextCycle.rating.tierEN, a.nextCycle.rating.tierZH)}」。地支藏干影响：「${a.nextCycleBranchHiddenGods.map(g2=>g2.cn).join('、')}」。${cycleFavVerdict(a.nextCycleFavourable)}`
  ) : `<em>${bt('No further Luck Pillar data available.','暂无更多大运资料。')}</em>`;

  // 11) Full Total Summary
  const totalHTML = bt(
    `A ${dmElemEN} Day Master, ${strengthLabel}, with ${g.en} as the dominant force shaping this chart.
     <ul style="margin:6px 0 0;padding-left:20px">
       <li><strong>Life:</strong> ${a.hasSevenKillings ? 'persistent, quiet pressure' : 'a comparatively steadier baseline'} met with ${a.hasHurtingOfficer || a.hasEatingGod ? 'genuine creative/problem-solving capacity' : 'consistency over time'}.</li>
       <li><strong>Career & Wealth:</strong> ${wealthDominant === 'indirect' ? 'entrepreneurial, opportunistic income suits better than a fixed salary path' : wealthDominant === 'direct' ? 'stable, structured income is the more natural lane' : 'both structured and opportunistic paths are viable'}.</li>
       <li><strong>Love:</strong> ${spouseHasKillingsOrOfficer ? 'requires effort and mutual respect for strength on both sides' : 'tends toward steadiness rather than high drama'}.</li>
       <li><strong>Health:</strong> the ${dmElemEN} system deserves the most consistent preventive attention.</li>
       <li><strong>Trajectory:</strong> ${a.isCycleTransitionNow ? `${a.nowYear} sits right at a genuine Luck Pillar turning point` : `you are mid-way through the ${stemCN[a.curCycle?.stemIdx]}${branchCN[a.curCycle?.branchIdx]} cycle`} - the ${a.curCycle ? bt(a.curCycle.rating.tierEN, a.curCycle.rating.tierZH) : ''} rating on this cycle gives a general sense of its overall tenor, though real outcomes depend on choices made within it, not the rating alone.</li>
     </ul>`,
    `${dmElemZH}日主，${strengthLabel}，命盘以「${g.cn}」为主导影响力。
     <ul style="margin:6px 0 0;padding-left:20px">
       <li><strong>人生：</strong>${a.hasSevenKillings ? '持续而低调的压力' : '相对稳定的基调'}，配合${a.hasHurtingOfficer || a.hasEatingGod ? '真实的创意与解难能力' : '长期的稳定性'}。</li>
       <li><strong>事业与财富：</strong>${wealthDominant === 'indirect' ? '创业型、机会型收入比固定薪资更适合您' : wealthDominant === 'direct' ? '稳定结构化的收入是您更自然的路径' : '结构化与机会型路径皆可行'}。</li>
       <li><strong>感情：</strong>${spouseHasKillingsOrOfficer ? '需要双方共同努力，并尊重彼此的强势个性' : '较倾向稳定而非强烈的戏剧性'}。</li>
       <li><strong>健康：</strong>${dmElemZH}对应的系统最值得持续的预防性关注。</li>
       <li><strong>大势：</strong>${a.isCycleTransitionNow ? `${a.nowYear}年正值大运真正的转折点` : `您目前正处于${stemCN[a.curCycle?.stemIdx]}${branchCN[a.curCycle?.branchIdx]}运程中段`}——此运程「${a.curCycle ? bt(a.curCycle.rating.tierEN, a.curCycle.rating.tierZH) : ''}」的评级仅提供整体基调的大致参考，实际结果仍取决于运程中的具体选择，而非评级本身。</li>
     </ul>`
  );

  return `
    <div class="calc-box" style="margin-bottom:14px;font-size:11px">${bt('This is a rule-based reading generated from your own chart\'s computed Ten God relationships, Day Master strength heuristic, and Luck Pillar data - a traditional symbolic framework for reflection, not a predictive or diagnostic tool. It is not a substitute for professional advice of any kind, medical or otherwise.', '此为依据您命盘中计算出的十神关系、日主强弱推算及大运资料所生成的规则式命理解读——属传统象征性框架，供反思参考，并非预测或诊断工具，亦不能取代任何专业（包括医疗）意见。')}</div>
    ${sectionHTML(1, 'Life', '人生', lifeHTML + `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)">${usefulGodHTML}</div>`)}
    ${sectionHTML(2, 'Career', '事业', careerHTML)}
    ${sectionHTML(3, 'Wealth', '财富', wealthHTML)}
    ${sectionHTML(4, 'Luck - Direct vs Indirect Wealth vs Windfall', '财运 - 正财、偏财与横财', luckHTML)}
    ${sectionHTML(5, 'Love', '感情', loveHTML)}
    ${sectionHTML(6, 'Health - What to Watch', '健康 - 需留意事项', healthHTML)}
    ${sectionHTML(7, `Current Year Summary - ${a.nowYear}`, `今年运势 - ${a.nowYear}年`, curYearHTML)}
    ${sectionHTML(8, 'Current Cycle Summary', '现行大运总览', curCycleHTML)}
    ${sectionHTML(9, `Next Year Summary - ${nextYearNum}`, `明年运势 - ${nextYearNum}年`, nextYearHTML)}
    ${sectionHTML(10, 'Next Cycle Summary', '下一运程总览', nextCycleHTML)}
    ${sectionHTML(11, 'Full Total Summary', '总体命局摘要', totalHTML)}
  `;
}

function renderHourlyTab(profilePrefix) {

  const u = activeUser(); if (!u) return;
  const prefix = profilePrefix || 'i';
  const p = getProfileData(getProfileByPrefix(prefix) || u.profile);
  const profileOptions = buildHourlyProfileOptions();
  const currentOption = profileOptions.find(o => o.prefix === prefix) || profileOptions[0];
  const nameCompat = (p.chineseFirstName || p.chineseLastName) ? calculateChineseNameBaziCompat(p.chineseLastName, p.chineseFirstName, p.bazi.dayStemIdx) : null;
  const elemNames = ['Wood','Fire','Earth','Metal','Water']; const elemNamesZH = ['木','火','土','金','水'];

  // HONESTY NOTE (added during audit): the 12 two-hour Shi Chen blocks below are calculated using
  // Singapore's longitude and timezone (103.82°E, UTC+8) as the true-solar-time reference, regardless
  // of your device's own timezone or your birth location's timezone. This was previously undisclosed.
  // If you're viewing this from outside Singapore, the calendar date shown uses your device's local
  // date, but the specific hour boundaries within that date are calibrated to Singapore time - so the
  // "current hour" highlight may not precisely match your own local clock.
  const timezoneDisclosure = `<div class="calc-box" style="font-size:11px;margin-bottom:10px">${bt('Time reference note: the 12 two-hour blocks below are calculated using Singapore time (UTC+8) as the reference, regardless of your own timezone or birth location. If you\'re viewing this from elsewhere, the highlighted "current hour" may not exactly match your own local clock.', '时区说明：以下十二时辰区块皆以新加坡时间（UTC+8）为准，与您本身所在时区或出生地时区无关。若您身处其他地区，标示的「当前时辰」可能与您当地实际时钟略有出入。')}</div>`;

  // ENHANCEMENT (reported: "for the hourly tab, Add another 2 days. This means there is a summary for
  // current day with an additional next 3 days"): was Today + Tomorrow (2 days total) with a 2-button
  // toggle; now covers Today + the next 3 days (4 days total) via a data-driven loop over day offsets
  // 0-3, rather than duplicating the old today/tomorrow-only pair of hand-written blocks/buttons.
  // computeHourlyHighlights(p, offset)/buildHourlyDayHTML are both already generic over the day offset,
  // so this is purely a "render one more of the same thing" change, not new calculation logic.
  const HOURLY_DAY_OFFSETS = [0, 1, 2, 3];
  const HOURLY_DAY_KEYS = ['today', 'tomorrow', 'day2', 'day3'];
  const dayDate = (offset) => new Date(Date.now() + offset * 24 * 3600 * 1000);
  const dayLabel = (offset) => dayDate(offset).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-SG', { weekday: 'long', day: 'numeric', month: 'long' });
  const dayButtonText = (offset) => {
    if (offset === 0) return bt('Today', '今天');
    if (offset === 1) return bt('Tomorrow', '明天');
    return bt(`+${offset} Days`, `+${offset}天`);
  };

  // PERFORMANCE FIX: this used to eagerly compute and cache ALL 4 days (12 two-hour blocks each - a
  // real BaZi+QMDJ+San Shi cast per block, so 48 casts total) every single time this function ran -
  // not just on first opening the tab, but on every profile switch via the selector below too. Only
  // ONE of those 4 days is ever shown at a time, so 3 of every 4 days' worth of work was routinely
  // thrown away unused. Now only "today" (the day shown by default) is computed up front; the other 3
  // days are computed lazily, the first time their button is actually clicked, and cached from then on
  // (globalThis.__hourlyDayHTML) so a repeat visit to an already-computed day is instant.
  // globalThis.__hourlyDayCtx holds what a lazy computation needs (set fresh on every render so a
  // profile switch never lazily computes a day for the WRONG profile from a stale context).
  // UPDATED (reported again this round: "Upon loading the page, you cannot change the day"): "today"
  // is no longer computed synchronously here either - see computeHourlyDayChunked's own comment above
  // for why. globalThis.__hourlyDayGen is bumped on every render so a still-in-flight chunked
  // computation from a previous render/profile switch is detected and discarded rather than landing on
  // top of whatever is showing by the time it finishes.
  // MEMORY-LEAK FIX (root cause of "ok for the first day change, every change after that lags 10+
  // seconds", reported again after the jieMoment/QMDJ-term caches above already fixed the previous
  // "15-25 seconds to switch days" report - that fix made the actual CAST fast, but every day's worth
  // of per-hour "View Details" popups was being registered into the app-wide deepAnalysisRegistry
  // (via buildHourlyDayHTML below) with a brand-new Math.random() id every time, and NEVER removed.
  // renderHourlyTab resets __hourlyDayHTML to {} on every call (so "today" always reflects the current
  // moment), which means simply reopening the Hourly tab, or switching profiles, re-triggers a fresh
  // 12-block build - but the OLD 12+ registry entries from the previous time this tab was open stayed
  // behind forever, growing without bound the longer a session goes on (every tab reopen, every day
  // switch, every profile switch adds more, and nothing ever frees the old ones). On a real device this
  // is exactly the kind of unbounded heap growth that produces escalating GC pauses - fast at first,
  // then progressively slower with every subsequent interaction - which matches the reported symptom
  // precisely and would not show up in this app's own short-lived automated test runs. Fix: track every
  // hourly popup id this tab has registered, and purge them all from deepAnalysisRegistry right here,
  // every time the tab is (re)opened, before any new ones are created - so the registry never carries
  // more than one tab-visit's worth (at most 4 days x 12 hours = 48 entries) of hourly popups at a time.
  if (Array.isArray(globalThis.__hourlyPopupIds)) {
    globalThis.__hourlyPopupIds.forEach(id => { delete deepAnalysisRegistry[id]; });
  }
  globalThis.__hourlyPopupIds = [];
  globalThis.__hourlyDayCtx = { p, nameCompat, elemNames, elemNamesZH };
  globalThis.__hourlyDayHTML = {};
  globalThis.__hourlyDayGen = (globalThis.__hourlyDayGen || 0) + 1;
  const thisGen = globalThis.__hourlyDayGen;

  const toggleHTML = `
    ${timezoneDisclosure}
    <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
      ${HOURLY_DAY_OFFSETS.map((offset, idx) => `<button class="btnHourlyDayToggle" data-day="${HOURLY_DAY_KEYS[idx]}" disabled style="flex:1;min-width:70px;padding:10px 4px;border-radius:8px;border:2px solid ${idx === 0 ? 'var(--gold)' : 'var(--line)'};background:${idx === 0 ? 'var(--gold)' : '#fff'};color:${idx === 0 ? '#fff' : 'var(--plum)'};font-weight:700;opacity:${idx === 0 ? '0.6' : '1'};cursor:${idx === 0 ? 'wait' : 'pointer'};font-size:13px">${dayButtonText(offset)}<br><span style="font-size:10px;font-weight:400">${dayLabel(offset)}</span></button>`).join('')}
    </div>
    <!-- DISCOVERABILITY FIX (this round): this diagnostic used to sit AFTER #hourlyDayContent, i.e.
         below the entire 12-row hourly table it was meant to explain - on a real device that table runs
         well past one screen, so the very number needed to tell an in-app compute lag apart from an
         external (browser/OS/device) one was buried off-screen and easy to never notice. Live-measured
         this round via the real running app: day-switch computation itself reads 3-7ms (see this
         diagnostic's own console.log mirror, "[Illuminate Hourly tab] Last day switch: Xms") - i.e. not
         the bottleneck - so surfacing this number where it's actually seen is what turns "still laggy"
         into an actionable report next time it happens. Moved to right under the day-toggle buttons,
         before the table, with no functional change (same element id, same two call sites that write to
         it in renderHourlyTab/the day-toggle handler).
    -->
    <div id="hourlyPerfDiag" class="pdf-exclude" style="font-size:10px;color:var(--muted);margin:6px 0 10px;text-align:right"></div>
    <div id="hourlyDayContent"><div class="calc-box" style="text-align:center;padding:16px">${bt('Computing…','计算中…')}</div></div>
  `;

  // BUG 7/8 FIX: explicit profile-holder label + a selector to switch whose highlights are shown.
  // Each profile's hourly reading is calculated purely from THAT profile's own BaZi/QMDJ/San Shi data
  // - it is never a shared or averaged reading, so the label makes clear whose chart is in view.
  const profileSelectorHTML = profileOptions.length > 1 ? `
    <div style="margin-bottom:10px">
      <label class="field" style="margin:0"><span style="font-size:12px">${bt('Viewing hourly highlights for','查看以下对象的时辰运势')}:</span>
        <select id="hourlyProfileSelect" style="margin-top:5px;width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;font-weight:700;color:var(--plum)" autocomplete="off">
          ${profileOptions.map(o => `<option value="${o.prefix}" ${o.prefix === (currentOption?.prefix) ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </label>
    </div>` : '';

  const container = $('#hourlyContent');
  if (container) {
    container.innerHTML = `<div class="calc-box" style="margin-bottom:12px">${bt(`This hourly reading is calculated individually for ${currentOption?.label.split(' (')[0] || p.displayName} only - it is not a shared or combined reading. Based on their own BaZi Day Master, an hourly-cast Qi Men Dun Jia chart, San Shi (Da Liu Ren), and Chinese Name element (if provided). Switch between Today and the next 3 days below.`, `此时辰运势仅针对${currentOption?.label.split('（')[0] || p.displayName}个人计算，并非共享或合并的结果，依据其本人的八字日主、每小时奇门遁甲盘、三式（大六壬），以及中文姓名五行（如有提供）推算。可在下方切换查看今天及未来3天。`)}</div>${profileSelectorHTML}${toggleHTML}`;
    const dayContentEl = $('#hourlyDayContent');
    const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    computeHourlyDayChunked(
      globalThis.__hourlyDayCtx, 0, 'today', thisGen,
      (shiSoFar) => { if (dayContentEl) dayContentEl.innerHTML = `<div class="calc-box" style="text-align:center;padding:16px">${bt('Computing…','计算中…')} (${shiSoFar}/12)</div>`; },
      (html) => {
        if (globalThis.__hourlyDayGen !== thisGen) return; // superseded - a newer render already took over
        if (dayContentEl) dayContentEl.innerHTML = html;
        $$('.btnHourlyDayToggle').forEach(btn => { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; });
        const elapsedMs = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startedAt);
        const diagEl = document.getElementById('hourlyPerfDiag');
        const diagText = bt(`Loaded in: ${elapsedMs}ms`, `载入耗时：${elapsedMs}毫秒`);
        if (diagEl) diagEl.textContent = diagText;
        console.log(`[Illuminate Hourly tab] ${diagText}`);
      }
    );
  }
}

// ENHANCEMENT (this round): Detailed Reading tab - reuses buildHourlyProfileOptions (already generic,
// not specific to the Hourly feature) so this new tab supports the exact same set of profiles
// (individual, Life/Business Partner, additional business partners, children) via an identical
// selector mechanism, per explicit request.
function renderDetailedReadingTab(profilePrefix) {
  const u = activeUser(); if (!u) return;
  const prefix = profilePrefix || 'i';
  const p = getProfileData(getProfileByPrefix(prefix) || u.profile);
  const profileOptions = buildHourlyProfileOptions();
  const currentOption = profileOptions.find(o => o.prefix === prefix) || profileOptions[0];

  const profileSelectorHTML = profileOptions.length > 1 ? `
    <div style="margin-bottom:10px">
      <label class="field" style="margin:0"><span style="font-size:12px">${bt('Viewing detailed reading for','查看以下对象的详细命理解读')}:</span>
        <select id="detailedReadingProfileSelect" style="margin-top:5px;width:100%;padding:10px;border:1px solid #ccc;border-radius:4px;font-weight:700;color:var(--plum)" autocomplete="off">
          ${profileOptions.map(o => `<option value="${o.prefix}" ${o.prefix === (currentOption?.prefix) ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </label>
    </div>` : '';

  const container = $('#detailedReadingContent');
  if (container) {
    container.innerHTML = `<div class="calc-box" style="margin-bottom:12px">${bt(`This detailed reading is calculated individually for ${currentOption?.label.split(' (')[0] || p.displayName} only, from their own BaZi chart, Ten God relationships, and Luck Pillar data.`, `此详细命理解读仅针对${currentOption?.label.split('（')[0] || p.displayName}个人计算，依据其本人的八字命盘、十神关系及大运资料推算。`)}</div>${profileSelectorHTML}${generateDetailedReading(p)}`;
  }
}


// Event Listeners completely restored and linked
function initListeners() {
  // BUG FIX (this round): a genuine, severe issue found while investigating a report that tabs showed
  // no content. Root cause: initListeners() is one long function (~680 lines) that registers ALL of
  // this app's delegated click/change listeners - including the one that handles tab switching,
  // export buttons, occupant management, and dozens of other features. Any single uncaught error
  // ANYWHERE early in this function halts its execution entirely, silently preventing every listener
  // registered AFTER that point from ever being attached - with no visible error to the user, just
  // features that quietly stop responding. Confirmed by direct reproduction: simulating a version
  // mismatch (an older engine-core.js missing a constant this file references) caused exactly this -
  // the function threw immediately, and the tab-switching handler (registered later in this same
  // function) was never attached, exactly matching the reported symptom.
  // Fix: the two most recently-added, most failure-prone blocks (both touch DOM elements and external
  // data that could be missing) are now wrapped so a failure in either is contained and logged, rather
  // than cascading into silently disabling the rest of this function. This does not fix every
  // theoretical failure point in a 680-line function, but removes the two most likely, most recently
  // introduced ones, and establishes the defensive pattern for future additions.
  try {
    const todayISO = new Date().toISOString().slice(0, 10);
    ['birthdate', 'partnerDate', 'bizDate', 'biz2Date', 'childDate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('max', todayISO);
    });
  } catch (e) { if (typeof console !== 'undefined') console.warn('initListeners: birthdate max-date setup failed, continuing:', e); }

  try {
    // ENHANCEMENT (this round, suggested: "collapse-by-default should be remembered per-section"):
    // persists which sections a person had open/closed, via wrapSectionCollapsible's own saved-state
    // lookup (see that function above). The native `toggle` event on <details> does NOT bubble, so a
    // normal delegated listener on document (bubble phase) would never see it - registering with
    // useCapture=true instead still works, because the CAPTURE phase always traverses from the
    // document down to the actual target regardless of whether the event bubbles, so this one
    // document-level listener correctly catches every section-details element's toggle, present now
    // or added later by any future re-render, with no per-element wiring needed.
    document.addEventListener('toggle', e => {
      const details = e.target;
      if (details && details.classList && details.classList.contains('section-details') && details.id) {
        setSectionOpenState(details.id, details.open);
      }
    }, true);
  } catch (e) { if (typeof console !== 'undefined') console.warn('initListeners: section-state toggle listener setup failed, continuing:', e); }

  try {
    // ENHANCEMENT: country-based longitude/timezone lookup - populates each form's country dropdown
    // once at startup, then a shared handler (below, in the delegated click listener) fills the
    // corresponding longitude/timezone fields when "Use" is clicked. Manual entry remains fully
    // available and unaffected - this only pre-fills fields that stay editable afterward.
    const sortedCountryNames = Object.keys(COUNTRY_LONGITUDE_TIMEZONE).sort();
    ['birthCountrySelect', 'partnerCountrySelect', 'bizCountrySelect', 'biz2CountrySelect', 'childCountrySelect'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sortedCountryNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        sel.appendChild(opt);
      });
    });
  } catch (e) { if (typeof console !== 'undefined') console.warn('initListeners: country dropdown population failed, continuing:', e); }

  try {
    // Dismiss control for the storage-quota warning banner (engine-core.js's saveState() shows this
    // the first time a save fails and can't be recovered by pruning) - purely cosmetic, hides the
    // banner until it next becomes relevant.
    const dismissBtn = document.getElementById('btnDismissStorageWarning');
    if (dismissBtn) dismissBtn.addEventListener('click', () => {
      const banner = document.getElementById('storageWarningBanner');
      if (banner) banner.style.display = 'none';
    });
  } catch (e) { if (typeof console !== 'undefined') console.warn('initListeners: storage warning dismiss wiring failed, continuing:', e); }

  if ($('#langToggle')) $('#langToggle').addEventListener('click', () => { lang = lang === 'en' ? 'zh' : 'en'; localStorage.setItem('illuminate_lang', lang); updateStaticLanguage(); renderAllViews(); });
  $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

// RESTORED: [data-reading] click listeners for landing page buttons
  $$('[data-reading]').forEach(b => {
    b.addEventListener('click', () => {
      const readingType = b.dataset.reading; go('chart');
      setTimeout(() => {
        // ENHANCEMENT (this round): sections now live inside one of 4 tabs, and only the active
        // tab's HTML is in the DOM - switch to the tab containing this section FIRST (home-screen
        // shortcuts always target the individual's own chart, prefix 'i'), so the section actually
        // exists to find/open/scroll to.
        const targetTab = SECTION_TAB_MAP[readingType];
        if (targetTab) switchChartTab('i', targetTab);
        const targetEl = document.getElementById(readingType) || document.getElementById('mingli');
        if (targetEl) {
          // ENHANCEMENT (this round): sections are now collapsible <details> elements - open the
          // target (or its containing <details>, since the id now lives on the details itself) before
          // scrolling, otherwise the shortcut would scroll to a collapsed, empty-looking section.
          const detailsEl = targetEl.tagName === 'DETAILS' ? targetEl : targetEl.closest?.('details');
          if (detailsEl) detailsEl.open = true;
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    });
  });

  // BUG FIX (deep audit): longitude/timezone fields previously had zero validation - an invalid,
  // out-of-range, or non-numeric value would silently corrupt the True Solar Time hour correction used
  // throughout the ENTIRE app (BaZi hour pillar, Zi Wei Life Palace, QMDJ, etc.), producing a visibly
  // wrong chart with no error shown to the user. Confirmed via direct testing: longitude=999 or
  // timezone=99 both produced a different (wrong) hour stem with no crash and no warning. This helper
  // validates and shows a clear error rather than silently saving garbage.
  // REDESIGN (this round): birth location is now country-only (plus, for a handful of countries that
  // genuinely span multiple time zones, an optional city/region refinement) - the user never types a
  // city name or enters longitude/timezone manually. This helper is called live (from the delegated
  // change listener above) the instant a country or city selection changes, and writes the resulting
  // longitude/timezone/display-location straight into the hidden fields the rest of the app already
  // reads (birthLongitude/birthTimezone/birthLocation and the partner/biz/biz2/child equivalents), so
  // every existing downstream consumer of those fields (validateLonTz, computeProfileData, the PDF
  // export, etc.) keeps working unchanged.
  function autoPopulateLonTz(target) {
      const sel = document.getElementById(`${target}CountrySelect`);
      const countryName = sel?.value;
      const locField = document.getElementById(`${target}Location`);
      const lonField = document.getElementById(`${target}Longitude`);
      const tzField = document.getElementById(`${target}Timezone`);
      const latField = document.getElementById(`${target}Latitude`);
      if (!countryName || !COUNTRY_LONGITUDE_TIMEZONE[countryName]) {
          if (locField) locField.value = '';
          if (lonField) lonField.value = '';
          if (tzField) tzField.value = '';
          if (latField) latField.value = '';
          return;
      }
      // If this country has multiple time zones and a specific city/region is selected, use that
      // city's more precise values; otherwise fall back to the country's single default.
      const cities = MULTI_TIMEZONE_COUNTRY_CITIES[countryName];
      const citySelect = document.getElementById(`${target}CitySelect`);
      const cityIdx = citySelect?.value;
      const usingCity = cities && cityIdx !== '' && cityIdx !== undefined;
      // ENHANCEMENT (requested directly: real Ascendant-based houses) - `lat` rides along with lon/tz
      // from the exact same selected country/city entry (see COUNTRY_LONGITUDE_TIMEZONE/
      // MULTI_TIMEZONE_COUNTRY_CITIES in engine-core.js).
      const { lon, tz, lat } = usingCity ? cities[Number(cityIdx)] : COUNTRY_LONGITUDE_TIMEZONE[countryName];
      if (locField) locField.value = usingCity ? `${cities[Number(cityIdx)].city}, ${countryName}` : countryName;
      if (lonField) lonField.value = lon;
      if (tzField) tzField.value = tz;
      if (latField) latField.value = lat;
  }
  function validateLonTz(lonVal, tzVal, errorElId) {
    const errEl = document.getElementById(errorElId);
    // Explicit empty-string check first: Number('') is 0 (a technically-valid longitude, the Prime
    // Meridian), which would otherwise pass the range check below silently even though an empty field
    // almost certainly means the user didn't intend exactly 0deg longitude.
    // REDESIGN (this round): these values are now auto-populated from the Birth Country dropdown
    // (never typed), so an empty/invalid value here means no country (or an unrecognized one) was
    // selected, and the error message is phrased for that rather than for manual entry.
    if (lonVal === '' || lonVal === undefined || tzVal === '' || tzVal === undefined) {
      if (errEl) errEl.textContent = bt('Please select a Birth Country.', '请选择出生国家。');
      return null;
    }
    const lon = Number(lonVal), tz = Number(tzVal);
    if (isNaN(lon) || lon < -180 || lon > 180 || isNaN(tz) || tz < -12 || tz > 14) {
      if (errEl) errEl.textContent = bt('Please select a valid Birth Country.', '请选择有效的出生国家。');
      return null;
    }
    if (errEl) errEl.textContent = '';
    return { lon, tz };
  }
  // ENHANCEMENT (requested directly: real Ascendant-based houses) - latitude is optional/best-effort
  // (auto-populated alongside longitude/timezone, but never blocks a save the way an invalid lon/tz
  // does), so this is intentionally lenient: a missing or out-of-range value just means "no Ascendant/
  // houses for this profile yet" downstream, not a validation error at save time.
  function readLatitude(latVal) {
    const lat = Number(latVal);
    return (latVal !== '' && latVal !== undefined && !isNaN(lat) && lat >= -90 && lat <= 90) ? lat : undefined;
  }
  // BUG FIX (deep audit): birth date fields had no upper-bound check - a future date doesn't crash
  // (computeCurrentAge already clamps displayed age to 0), but produces a full BaZi/Zi Wei/Feng Shui
  // reading for someone who technically doesn't exist yet, which is meaningless rather than merely
  // imprecise. The `max` HTML attribute (set dynamically to today's date elsewhere in this file)
  // blocks this in the native date picker UI; this is the second layer of defense in case that's ever
  // bypassed (e.g. a value set programmatically rather than through the picker).
  function validateNotFutureDate(dateStr, errorElId) {
    const errEl = document.getElementById(errorElId);
    if (dateStr && dateStr > new Date().toISOString().slice(0, 10)) {
      if (errEl) errEl.textContent = bt('Birth date cannot be in the future.', '出生日期不可为未来日期。');
      return false;
    }
    return true;
  }

  // RESTORED: Intake Forms
  if ($('#saveProfile')) $('#saveProfile').addEventListener('click', () => {
    const el = $('#englishLastName').value.trim(), ef = $('#englishFirstName').value.trim(), g = $('#gender').value, d = $('#birthdate').value, t = $('#birthtime').value;
    if(!el || !ef || !g || !d || !t) return;
    if (!validateNotFutureDate(d, 'profileError')) return;
    const lonTz = validateLonTz($('#birthLongitude')?.value, $('#birthTimezone')?.value, 'profileError');
    if (!lonTz) return;
    // UPDATED (reported: "All address input street name should be mandatory"): Street Name now joins
    // House Number/Block, City, Country, and Postal Code as mandatory - only Unit stays optional (see
    // the HTML comment above the fields in index.html for why). Checked AFTER the birth-detail fields
    // above so a person who hasn't filled in birth details yet sees that silent early-return first,
    // exactly as before, rather than an address error appearing ahead of a more fundamental missing field.
    const addrErrEl = $('#profileError');
    const houseNumberVal = $('#intakeHouseNumber') ? $('#intakeHouseNumber').value.trim() : '';
    const streetNameVal = $('#intakeStreetName') ? $('#intakeStreetName').value.trim() : '';
    const cityVal = $('#intakeCity') ? $('#intakeCity').value.trim() : '';
    const countryVal = $('#intakeCountry') ? $('#intakeCountry').value.trim() : '';
    const postalCodeVal = $('#intakePostalCode') ? $('#intakePostalCode').value.trim() : '';
    if (!houseNumberVal || !streetNameVal || !cityVal || !countryVal || !postalCodeVal) {
      if (addrErrEl) addrErrEl.textContent = bt('Please fill in House Number/Block, Street Name, City, Country, and Postal Code.', '请填写门牌号/座号、街道名称、城市、国家及邮政编码。');
      return;
    }
    if (addrErrEl) addrErrEl.textContent = '';
    // ENHANCEMENT: Personal Assets (Mobile Number, Vehicle Number) now collected here on intake too,
    // not only later in the Personal Assets section. Existing vehicles are preserved across a re-save
    // (this handler otherwise replaces the whole profile object) and a re-entered plate that already
    // exists on file is not duplicated - the person's own instruction that drafts/records stay free of
    // duplicates applies here just as much as it does to their CV work.
    const existingProfile = activeUser().profile;
    const existingVehicles = (existingProfile && existingProfile.vehicles) ? existingProfile.vehicles : [];
    const mobileNumber = $('#intakeMobileNumber') ? $('#intakeMobileNumber').value.trim() : '';
    const newVehiclePlate = $('#intakeVehicleNumber') ? $('#intakeVehicleNumber').value.trim() : '';
    const vehicleSharedInput = $('#intakeVehicleShared') ? $('#intakeVehicleShared').checked : false;
    let vehicles = existingVehicles;
    if (newVehiclePlate) {
      const existingIdx = existingVehicles.findIndex(v => v.number === newVehiclePlate);
      if (existingIdx === -1) {
        vehicles = existingVehicles.concat([{ number: newVehiclePlate, shared: vehicleSharedInput }]);
      } else {
        // ENHANCEMENT: re-saving intake with the Shared checkbox toggled now updates the existing
        // vehicle's shared flag too, rather than only ever being settable from the Personal Assets
        // section - this is the single vehicle field intake exposes, so it must fully round-trip.
        vehicles = existingVehicles.map((v, i) => i === existingIdx ? { ...v, shared: vehicleSharedInput } : v);
      }
    }
    // BUG FIX (found while making this change): this handler replaces the whole `profile` object, which
    // was previously silently dropping `profile.bazhaiOccupants` (your saved household occupants) any
    // time you edited your own birth details from the intake form - a genuine pre-existing data-loss
    // risk, unrelated to Personal Assets, caught only because this line was already being touched.
    // ensurePeopleArray is called BEFORE the profile is replaced (migrating a not-yet-migrated account's
    // bazhaiOccupants into u.people from the OLD profile first, if that hasn't already happened) so that
    // the rebuild call below - AFTER the profile is replaced - has real occupant data to regenerate
    // profile.bazhaiOccupants back onto the new profile object from. Doing this in the other order (or
    // relying on rebuild alone, without first guaranteeing u.people exists) silently loses the occupants
    // for anyone who hadn't yet touched the People screen - caught by this round's own test before ship.
    const u0 = activeUser();
    if (typeof ensurePeopleArray === 'function') ensurePeopleArray(u0);
    // ENHANCEMENT (reported: "Address input missing home facing direction"): intakeFsDir is optional,
    // so a blank selection here falls back to whatever was already on file (existingProfile.fsDir)
    // rather than silently wiping out a direction set earlier via the Feng Shui/Account page - the
    // same "don't lose data this handler doesn't own" principle behind the bazhaiOccupants fix above.
    const intakeFsDirVal = $('#intakeFsDir') ? $('#intakeFsDir').value.trim() : '';
    u0.profile = {
      englishLastName: el, englishFirstName: ef, chineseLastName: $('#chineseLastName').value.trim(), chineseFirstName: $('#chineseFirstName').value.trim(),
      gender: g, birthdate: d, birthtime: t,
      birthLocation: $('#birthLocation') ? $('#birthLocation').value.trim() : 'Singapore',
      birthLongitude: lonTz.lon, birthTimezone: lonTz.tz, birthLatitude: readLatitude($('#birthLatitude')?.value),
      mobileNumber, vehicles,
      fsDir: intakeFsDirVal || (existingProfile ? existingProfile.fsDir : '') || ''
    };
    if (typeof rebuildLegacySlotsFromPeople === 'function') rebuildLegacySlotsFromPeople(u0);
    // UPDATED (reported: "Address is not fixed. It should be split into multiple fields as suggested
    // in the last few prompts"): intake now collects the SAME 6 structured fields (+ Construction
    // Year) as the Feng Shui/Account page's own address entry, writing straight into the SAME
    // u.home.addresses.profile record - one underlying value editable from either place, not a
    // separate duplicate copy. Legacy u.home.address/constructionYear are kept in sync via
    // syncLegacyHomeFields (same helper the Feng Shui page already calls on every render) so every
    // other existing reader (Flying Star, buildProfilePdfHTML) keeps working unchanged.
    u0.home = u0.home || {};
    const homeYearInput = $('#intakeHomeConstructionYear') ? parseInt($('#intakeHomeConstructionYear').value, 10) : NaN;
    if (typeof ensureHomeAddressModel === 'function') {
      const addresses = ensureHomeAddressModel(u0);
      if (!addresses.profile) addresses.profile = blankAddressEntry();
      ADDRESS_STRUCT_FIELDS.forEach(key => {
        const el = $(`#intake${key.charAt(0).toUpperCase()}${key.slice(1)}`);
        if (el) addresses.profile[key] = el.value.trim();
      });
      if (homeYearInput && homeYearInput >= 1864 && homeYearInput <= 2043) addresses.profile.constructionYear = homeYearInput;
      // ENHANCEMENT (reported: "Address input should have a checkbox to indicate if the address is a
      // shared address"): same field intakeAddrShared writes into, prefilled from on load above.
      if ($('#intakeAddrShared')) addresses.profile.shared = $('#intakeAddrShared').checked;
      if (typeof syncLegacyHomeFields === 'function') syncLegacyHomeFields(u0);
      // ENHANCEMENT: Work Address (optional) - saved into u.home.addresses.work the same way as the
      // Home Address above, but with no mandatory fields (it's optional entirely) and no Construction
      // Year/Facing/Shared - those are Feng-Shui-specific concepts that don't apply to a workplace.
      const workHasAnyInput = ['WorkHouseNumber','WorkStreetName','WorkUnit','WorkCity','WorkCountry','WorkPostalCode']
        .some(suffix => { const el = $(`#intake${suffix}`); return el && el.value.trim(); });
      if (workHasAnyInput) {
        if (!addresses.work) addresses.work = blankAddressEntry();
        ADDRESS_STRUCT_FIELDS.forEach(key => {
          const el = $(`#intakeWork${key.charAt(0).toUpperCase()}${key.slice(1)}`);
          if (el) addresses.work[key] = el.value.trim();
        });
      } else if (addresses.work && isAddressEmpty(addresses.work)) {
        // Nothing entered (still) - keep it null rather than an empty object, matching `profile`'s own
        // "not set" representation used throughout (isAddressEmpty/buildPersonalAssetsSummaryRows).
        addresses.work = null;
      }
    } else if (homeYearInput && homeYearInput >= 1864 && homeYearInput <= 2043) {
      u0.home.constructionYear = homeYearInput;
    }
    saveState(); renderAllViews(); go('home');
  });

  // BUG 1 FIX: persist full birth detail set (was previously dropping longitude/timezone/location)
  if ($('#btnCalculateCompat')) $('#btnCalculateCompat').addEventListener('click', () => {
    const el = $('#partnerEnglishLastName').value.trim(), ef = $('#partnerEnglishFirstName').value.trim(), g = $('#partnerGender').value, d = $('#partnerDate').value, t = $('#partnerTime').value;
    if (!el || !ef || !g || !d || !t) return;
    if (!validateNotFutureDate(d, 'compatError')) return;
    const lonTz = validateLonTz($('#partnerLongitude')?.value, $('#partnerTimezone')?.value, 'compatError');
    if (!lonTz) return;
    // ENHANCEMENT: Personal Assets (Mobile Number, Vehicle Number) now collected here too. Existing
    // vehicles are preserved and a re-entered plate that's already on file isn't duplicated - same
    // approach as the main intake form above.
    const existingPartnerPerson = (typeof findPersonByRole === 'function') ? findPersonByRole(activeUser(), 'partner', 0) : null;
    const existingPartnerVehicles = (existingPartnerPerson && existingPartnerPerson.vehicles) ? existingPartnerPerson.vehicles : [];
    const partnerMobileNumber = $('#partnerMobileNumber') ? $('#partnerMobileNumber').value.trim() : '';
    const newPartnerVehiclePlate = $('#partnerVehicleNumber') ? $('#partnerVehicleNumber').value.trim() : '';
    const partnerVehicleSharedInput = $('#partnerVehicleShared') ? $('#partnerVehicleShared').checked : false;
    let partnerVehicles = existingPartnerVehicles;
    if (newPartnerVehiclePlate) {
      const existingIdx = existingPartnerVehicles.findIndex(v => v.number === newPartnerVehiclePlate);
      if (existingIdx === -1) {
        partnerVehicles = existingPartnerVehicles.concat([{ number: newPartnerVehiclePlate, shared: partnerVehicleSharedInput }]);
      } else {
        partnerVehicles = existingPartnerVehicles.map((v, i) => i === existingIdx ? { ...v, shared: partnerVehicleSharedInput } : v);
      }
    }
    // MULTI-ROLE PEOPLE MODEL (this round): this "single primary slot" write now goes through
    // syncLegacyPrimaryToPeople, so u.people (the true source of truth) stays in sync and
    // u.partner keeps being correctly regenerated from it - see engine-core.js.
    syncLegacyPrimaryToPeople(activeUser(), 'partner', {
      englishLastName: el, englishFirstName: ef,
      chineseLastName: $('#partnerChineseLastName') ? $('#partnerChineseLastName').value.trim() : '',
      chineseFirstName: $('#partnerChineseFirstName') ? $('#partnerChineseFirstName').value.trim() : '',
      gender: g, birthdate: d, birthtime: t,
      birthLocation: $('#partnerLocation') ? $('#partnerLocation').value.trim() : 'Singapore',
      birthLongitude: lonTz.lon, birthTimezone: lonTz.tz, birthLatitude: readLatitude($('#partnerLatitude')?.value),
      mobileNumber: partnerMobileNumber, vehicles: partnerVehicles
    });
    saveState(); renderAllViews(); go('partnerView');
  });

  if ($('#btnCalculateBiz')) $('#btnCalculateBiz').addEventListener('click', () => {
    const el = $('#bizEnglishLastName').value.trim(), ef = $('#bizEnglishFirstName').value.trim(), g = $('#bizGender').value, d = $('#bizDate').value, t = $('#bizTime').value;
    if (!el || !ef || !g || !d || !t) return;
    if (!validateNotFutureDate(d, 'bizError')) return;
    const lonTz = validateLonTz($('#bizLongitude')?.value, $('#bizTimezone')?.value, 'bizError');
    if (!lonTz) return;
    // MULTI-ROLE PEOPLE MODEL (this round): see the partner handler above - same treatment for the
    // core/primary Business Partner slot.
    syncLegacyPrimaryToPeople(activeUser(), 'businessPartner', {
      englishLastName: el, englishFirstName: ef,
      chineseLastName: $('#bizChineseLastName') ? $('#bizChineseLastName').value.trim() : '',
      chineseFirstName: $('#bizChineseFirstName') ? $('#bizChineseFirstName').value.trim() : '',
      gender: g, birthdate: d, birthtime: t,
      birthLocation: $('#bizLocation') ? $('#bizLocation').value.trim() : 'Singapore',
      birthLongitude: lonTz.lon, birthTimezone: lonTz.tz, birthLatitude: readLatitude($('#bizLatitude')?.value),
      mobileNumber: $('#bizMobileNumber') ? $('#bizMobileNumber').value.trim() : '' // vehicle is added afterward from their own Personal Assets section - see renderVehiclesBlock's extended scope
    });
    saveState(); renderAllViews(); go('bizView');
  });

  // ENHANCEMENT: Add Child Profile (up to 5)
  if ($('#btnAddChild')) $('#btnAddChild').addEventListener('click', () => {
    const u = activeUser(); if (!u) return;
    u.children = u.children || [];
    if (u.children.length >= 5) return;
    const el = $('#childEnglishLastName').value.trim(), ef = $('#childEnglishFirstName').value.trim(), g = $('#childGender').value, d = $('#childDate').value, t = $('#childTime').value;
    const errEl = $('#childError');
    if (!el || !ef || !g || !d || !t) { if (errEl) errEl.textContent = bt('Please fill in all required (*) fields.', '请填写所有必填 (*) 栏位。'); return; }
    if (!validateNotFutureDate(d, 'childError')) return;
    const lonTz = validateLonTz($('#childLongitude')?.value, $('#childTimezone')?.value, 'childError');
    if (!lonTz) return;
    if (errEl) errEl.textContent = '';
    // MULTI-ROLE PEOPLE MODEL (this round): a new Child is a genuinely new, distinct person, so this
    // always APPENDS a new 'child'-tagged person to u.people rather than replacing a single slot.
    syncLegacyAppendToPeople(u, 'child', {
      englishLastName: el, englishFirstName: ef,
      chineseLastName: $('#childChineseLastName') ? $('#childChineseLastName').value.trim() : '',
      chineseFirstName: $('#childChineseFirstName') ? $('#childChineseFirstName').value.trim() : '',
      gender: g, birthdate: d, birthtime: t,
      birthLocation: $('#childLocation') ? $('#childLocation').value.trim() : 'Singapore',
      birthLongitude: lonTz.lon, birthTimezone: lonTz.tz, birthLatitude: readLatitude($('#childLatitude')?.value),
      mobileNumber: $('#childMobileNumber') ? $('#childMobileNumber').value.trim() : '' // scope: no vehicle for children
    });
    saveState();
    ['childEnglishLastName','childEnglishFirstName','childChineseLastName','childChineseFirstName','childDate','childTime','childMobileNumber'].forEach(id => { if ($('#'+id)) $('#'+id).value = ''; });
    if ($('#childGender')) $('#childGender').value = '';
    renderChildrenTab();
  });
  
  // ENHANCEMENT: Add/Remove additional Business Partners (up to 3 total)
  if ($('#btnAddBizPartner2')) $('#btnAddBizPartner2').addEventListener('click', () => {
    const u = activeUser(); if (!u) return;
    u.additionalBizPartners = u.additionalBizPartners || [];
    if ((u.businessPartner ? 1 : 0) + u.additionalBizPartners.length >= 3) return;
    const el = $('#biz2EnglishLastName').value.trim(), ef = $('#biz2EnglishFirstName').value.trim(), g = $('#biz2Gender').value, d = $('#biz2Date').value, t = $('#biz2Time').value;
    const errEl = $('#biz2Error');
    if (!el || !ef || !g || !d || !t) { if (errEl) errEl.textContent = bt('Please fill in all required (*) fields.', '请填写所有必填 (*) 栏位。'); return; }
    if (!validateNotFutureDate(d, 'biz2Error')) return;
    const lonTz = validateLonTz($('#biz2Longitude')?.value, $('#biz2Timezone')?.value, 'biz2Error');
    if (!lonTz) return;
    if (errEl) errEl.textContent = '';
    // MULTI-ROLE PEOPLE MODEL (this round): an additional (2nd/3rd) Business Partner is a genuinely
    // new, distinct person - always APPENDS a new 'businessPartner'-tagged person to u.people, which
    // correctly becomes u.additionalBizPartners[N] once regenerated (the core one, added first, stays
    // u.businessPartner - see rebuildLegacySlotsFromPeople in engine-core.js).
    syncLegacyAppendToPeople(u, 'businessPartner', {
      englishLastName: el, englishFirstName: ef,
      chineseLastName: $('#biz2ChineseLastName') ? $('#biz2ChineseLastName').value.trim() : '',
      chineseFirstName: $('#biz2ChineseFirstName') ? $('#biz2ChineseFirstName').value.trim() : '',
      gender: g, birthdate: d, birthtime: t,
      birthLocation: $('#biz2Location') ? $('#biz2Location').value.trim() : 'Singapore',
      birthLongitude: lonTz.lon, birthTimezone: lonTz.tz, birthLatitude: readLatitude($('#biz2Latitude')?.value),
      mobileNumber: $('#biz2MobileNumber') ? $('#biz2MobileNumber').value.trim() : ''
    });
    saveState();
    ['biz2EnglishLastName','biz2EnglishFirstName','biz2ChineseLastName','biz2ChineseFirstName','biz2Date','biz2Time','biz2MobileNumber'].forEach(id => { if ($('#'+id)) $('#'+id).value = ''; });
    if ($('#biz2Gender')) $('#biz2Gender').value = '';
    renderAdditionalBizPartners();
  });

  // BUG 1 FIX: Edit buttons now prefill the form with existing saved data before showing it
  if ($('#btnEditPartner')) $('#btnEditPartner').addEventListener('click', () => { prefillPartnerForm('p'); $$('.view').forEach(v => v.classList.toggle('active', v.id === 'compat')); $('#nav').classList.remove('hidden'); });
  if ($('#btnEditBiz')) $('#btnEditBiz').addEventListener('click', () => { prefillPartnerForm('b'); $$('.view').forEach(v => v.classList.toggle('active', v.id === 'businessTab')); $('#nav').classList.remove('hidden'); });

  // BUG FIX (outstanding item: "no option to remove a profile - child / life partner / business
  // partner"): children and additional (2nd/3rd) Business Partners already had a Remove button
  // (btnRemoveChild, btnRemoveBizPartner2); the PRIMARY Life Partner and PRIMARY Business Partner had
  // an Edit button but no way to remove them entirely once added. Removing clears the stored profile
  // and returns Home, since there is no more "Full Assessment" view left to show once it's gone.
  if ($('#btnRemovePartner')) $('#btnRemovePartner').addEventListener('click', () => {
      const u = activeUser(); if (!u) return;
      // MULTI-ROLE PEOPLE MODEL (this round): strips just the 'partner' tag from the underlying
      // u.people entry (deleting that person outright only if they have no other role tags left), then
      // regenerates u.partner (and every other legacy slot) from u.people.
      if (!syncLegacyRemoveByRole(u, 'partner', 0)) u.partner = null; // fallback - see syncLegacyRemoveByRole's own comment
      saveState();
      go('home');
  });
  if ($('#btnRemoveBiz')) $('#btnRemoveBiz').addEventListener('click', () => {
      const u = activeUser(); if (!u) return;
      if (!syncLegacyRemoveByRole(u, 'businessPartner', 0)) u.businessPartner = null; // fallback
      saveState();
      go('home');
  });
  if ($('#editProfile')) $('#editProfile').addEventListener('click', () => { prefillMainProfileForm(); go('intake'); });
  if ($('#btnExportAllZip')) $('#btnExportAllZip').addEventListener('click', exportAllProfilesAsZip);

  // BUG 7 FIX: Ba Zhai Auto-update Listener - regenerates a dynamic, direction-aware deep analysis
  // using the live 8-Mansions star lookup. Only the chosen direction is persisted (not the derived
  // text), so the analysis is always recomputed fresh from the current profile - never anchored/stale.
  document.addEventListener('change', e => {
      // GENERAL FIX (companion to the switchChartTab fix above, same reported bug): panel.innerHTML
      // serializes each element's DOM ATTRIBUTES, but a user picking a <select> option or typing into
      // an <input> only changes that element's live VALUE/SELECTED PROPERTY, never the underlying
      // content attribute. Without this, switchChartTab's "save the tab being left" step would save a
      // string where every edited field looks blank/unselected again - so this keeps each field's
      // attribute in sync with what's actually on screen, for every input inside any chart tab.
      if (e.target.closest && e.target.closest('.chart-tab-panel')) {
          const el = e.target;
          if (el.tagName === 'SELECT') {
              Array.from(el.options).forEach(opt => opt.toggleAttribute('selected', opt.selected));
          } else if (el.tagName === 'INPUT' && el.type === 'checkbox') {
              el.toggleAttribute('checked', el.checked);
          } else if (el.tagName === 'INPUT') {
              el.setAttribute('value', el.value);
          } else if (el.tagName === 'TEXTAREA') {
              el.textContent = el.value;
          }
      }
      if (e.target.id === 'hourlyProfileSelect') {
          renderHourlyTab(e.target.value);
      }
      if (e.target.id === 'detailedReadingProfileSelect') {
          renderDetailedReadingTab(e.target.value);
      }
      // ENHANCEMENT (this round): when a country with multiple real time zones is selected, show and
      // populate a second "city" dropdown so the user can pick a region closer to their actual birth
      // location than the single capital-city default. Hidden and cleared for any other country.
      // REDESIGN (this round): the user no longer enters city/longitude/timezone manually at all - those
      // fields are now hidden and auto-populated the moment a country (and, where relevant, a city) is
      // selected, via the shared autoPopulateLonTz() helper below (which replaces the old, now-removed
      // "Use" button click handler - there is no button left to click, this fires live on selection).
      if (e.target.classList.contains('countrySelect')) {
          const target = e.target.dataset.target;
          const cityWrap = document.getElementById(`${target}CityWrap`);
          const citySelect = document.getElementById(`${target}CitySelect`);
          const countryName = e.target.value;
          const cities = MULTI_TIMEZONE_COUNTRY_CITIES[countryName];
          if (cityWrap && citySelect) {
              citySelect.innerHTML = `<option value="">${bt('-- Select City/Region --','-- 请选择城市／地区 --')}</option>`;
              if (cities) {
                  cities.forEach((c, idx) => {
                      const opt = document.createElement('option');
                      opt.value = idx; opt.textContent = c.city;
                      citySelect.appendChild(opt);
                  });
                  cityWrap.style.display = 'block';
              } else {
                  cityWrap.style.display = 'none';
              }
          }
          autoPopulateLonTz(target);
      }
      // A city refinement within an already-selected multi-timezone country also re-derives lon/tz.
      if (e.target.classList.contains('citySelect')) {
          autoPopulateLonTz(e.target.dataset.target);
      }
      if (e.target.classList.contains('pastDrawsYearSelect')) {
         const wrapper = e.target.closest('.pastDrawsBrowser');
         const idSuffix = e.target.dataset.idSuffix;
         const dateSelect = document.getElementById(`pastDrawsDateSelect_${idSuffix}`);
         if (!wrapper || !dateSelect) return;
         try {
           const yearToDates = JSON.parse(wrapper.dataset.years);
           const dates = yearToDates[e.target.value] || [];
           dateSelect.innerHTML = dates.map(iso => `<option value="${iso}">${iso}</option>`).join('');
         } catch (err) { /* malformed data attribute - leave date list as-is rather than crash */ }
      }
      if (e.target.classList.contains('fs-dir-select')) {
         const prefix = e.target.dataset.prefix;
         const prof = getProfileByPrefix(prefix);
         if (prof) {
             prof.fsDir = e.target.value;
             delete prof.fsResult; // no longer cached - always derived live from the profile
             // ENHANCEMENT (reported: "Address input missing home facing direction"): the Home Facing
             // Direction is now editable from TWO places for the main profile - its original spot in
             // the Ba Zhai Compass School card, and the new one inside the persistent Home Address
             // block - both write to the same prof.fsDir. Since this handler only patches specific
             // result divs (it doesn't re-render the whole chart), the OTHER select's displayed value
             // would otherwise go stale until the next full render - so every select sharing this
             // class/prefix is kept in sync here, immediately.
             document.querySelectorAll(`.fs-dir-select[data-prefix="${prefix}"]`).forEach(sel => {
                 if (sel !== e.target) sel.value = prof.fsDir;
             });
             const p = getProfileData(prof);
             const freshHTML = generateDeepAnalysisData('bazhai', p, { title: 'Ba Zhai Compass Deep Profile', direction: prof.fsDir });
             saveState(); 
             const resDiv = document.getElementById(`fs-result-${prefix}`);
             if (resDiv) { resDiv.innerHTML = freshHTML; resDiv.style.display = 'block'; }
             // ENHANCEMENT 2/3 FIX: refresh the household + occupants readings too, since they also
             // depend on the selected direction and must never fall out of sync with it.
             if (prefix === 'i') {
                 const u = activeUser();
                 if (u?.partner) {
                     const partnerP = getProfileData(u.partner);
                     const hhDiv = document.getElementById('bazhai-household-analysis-i');
                     if (hhDiv) hhDiv.innerHTML = generateDeepAnalysisData('bazhai_household', p, { title: `Household Ba Zhai Reading - You & ${partnerP.displayName}`, direction: prof.fsDir, partnerP });
                 }
                 const occDiv = document.getElementById('bazhai-occupants-analysis-i');
                 if (occDiv) {
                     const people = buildHouseholdPeopleList(p, u, prof.bazhaiOccupants || []);
                     occDiv.innerHTML = generateDeepAnalysisData('bazhai_occupants', p, { title: 'Full Household Roster Deep Analysis', direction: prof.fsDir, people: ((prof.bazhaiOccupants || []).length ? people : []) });
                 }
             }
         }
      }
      if (e.target.classList.contains('mobileNumberInput')) {
         const prefix = e.target.dataset.prefix;
         const prof = getProfileByPrefix(prefix);
         if (prof) {
             prof.mobileNumber = e.target.value.trim();
             saveState();
             const resDiv = document.getElementById(`mobileNumberResult_${prefix}`);
             if (resDiv) resDiv.innerHTML = prof.mobileNumber ? computeMobileNumberDeepAnalysisHTML(prof.mobileNumber, prefix) : '';
         }
      }
      if (e.target.classList.contains('vehicleSharedCheckbox')) {
         const prefix = e.target.dataset.prefix; const idx = Number(e.target.dataset.idx);
         const prof = getProfileByPrefix(prefix);
         if (prof && prof.vehicles && prof.vehicles[idx]) {
             prof.vehicles[idx].shared = e.target.checked;
             saveState();
             const resDiv = document.getElementById(`vehicleResult_${prefix}_${idx}`);
             if (resDiv) resDiv.innerHTML = computeVehicleDeepAnalysisHTML(prefix, idx);
         }
      }
      // REMOVED (reported: "remove the home address entry from Feng Shui as it is to be managed at the
      // profile level"): the persistent Home Address's structured input fields (data-idprefix="homeAddr")
      // no longer render inside the Feng Shui section - renderHomeDetailsBlock now shows the saved
      // address read-only there, with a note pointing to the Profile page - so this live auto-save
      // listener for idprefix "homeAddr" is now unreachable dead code and has been removed. Address
      // editing (including Construction Year, Facing Direction, and the Shared checkbox) happens
      // exclusively via the Intake/Profile page's own Save Profile button from here on, which already
      // triggers a full renderAllViews() (recomputing Flying Star, Ba Zhai, and Address Compatibility
      // together) - see #saveProfile's click handler. The "Check Another Address" form's fields
      // (data-idprefix="newAddr") were never handled here either - they're read on submit only, by the
      // btnConfirmAddAddress click handler below.
  });

  // ENHANCEMENT 3 FIX: Add/Remove Household Occupant listeners
  document.addEventListener('click', e => {
      // ENHANCEMENT (Task #76): "Check Another Address" - reveal the compact add-address form.
      if (e.target.classList.contains('btnShowAddAddressForm')) {
          const formDiv = document.getElementById('addAddressForm');
          if (formDiv) formDiv.classList.toggle('hidden');
          return;
      }
      // ENHANCEMENT (Task #76): confirm-add for the "Check Another Address" form - reads the newAddr*
      // structured fields and appends a new checked-address entry, then re-renders the whole block so
      // the new entry's own score/row appears immediately. The button that reaches this handler is
      // itself hidden once profile + checked already total 6 (see canAddMore in renderHomeDetailsBlock),
      // so a person must explicitly Remove one first to free a slot - nothing is silently evicted. The
      // shift() below is a defensive backstop only, in case this ever fires anyway (e.g. a stale form
      // still open in another tab).
      if (e.target.classList.contains('btnConfirmAddAddress')) {
          const u = activeUser(); if (!u) return;
          const addresses = ensureHomeAddressModel(u);
          const entry = blankAddressEntry();
          ADDRESS_STRUCT_FIELDS.forEach(key => {
              const el = document.getElementById(`newAddr${key.charAt(0).toUpperCase()}${key.slice(1)}`);
              entry[key] = el ? el.value.trim() : '';
          });
          // ENHANCEMENT (reported: "Check Address does not have year built, facing, and shared with
          // life partner input options"): these 3 fields now also exist on the Check Another Address
          // form (see renderAddressFieldsHTML's `includeYear`/`includeFacing` above) - read them the
          // same way the persistent Home Address's own change listener does.
          const yearEl = document.getElementById('newAddrConstructionYear');
          const yearVal = yearEl ? parseInt(yearEl.value, 10) : NaN;
          entry.constructionYear = (yearVal && yearVal >= 1864 && yearVal <= 2043) ? yearVal : '';
          const facingEl = document.getElementById('newAddrFacing');
          entry.facing = facingEl ? facingEl.value : '';
          const sharedEl = document.getElementById('newAddrShared');
          entry.shared = !!(sharedEl && sharedEl.checked);
          const newAddrErrEl = document.getElementById('newAddrError');
          if (isAddressEmpty(entry)) { if (newAddrErrEl) newAddrErrEl.textContent = ''; return; } // nothing entered - do nothing, no error needed
          // ENHANCEMENT (reported: "house number/block, city, country, postal code should be
          // mandatory"): a "Check Another Address" submission is now blocked, with an inline message,
          // unless those 4 fields are filled - the same requirement Intake's Save button enforces.
          if (!isAddressComplete(entry)) {
              if (newAddrErrEl) newAddrErrEl.textContent = bt('Please fill in House Number/Block, Street Name, City, Country, and Postal Code.', '请填写门牌号/座号、街道名称、城市、国家及邮政编码。');
              return;
          }
          if (newAddrErrEl) newAddrErrEl.textContent = '';
          const profReady = addresses.profile && isAddressComplete(addresses.profile);
          const maxChecked = profReady ? 5 : 6;
          addresses.checked.push(entry);
          while (addresses.checked.length > maxChecked) addresses.checked.shift(); // defensive backstop only
          saveState();
          refreshHomeAddressBlock(u);
          return;
      }
      // ENHANCEMENT (Task #76): remove one checked (non-persistent) address.
      if (e.target.classList.contains('btnRemoveCheckedAddress')) {
          const u = activeUser(); if (!u) return;
          const addresses = ensureHomeAddressModel(u);
          const idx = Number(e.target.dataset.idx);
          if (addresses.checked[idx]) addresses.checked.splice(idx, 1);
          saveState();
          refreshHomeAddressBlock(u);
          return;
      }
      // ENHANCEMENT (Task #76): promote a checked address to become the persistent Home Address - the
      // address previously in that slot is pushed back into the checked list (swap, not a loss), unless
      // it was empty, so nothing on file ever silently disappears.
      if (e.target.classList.contains('btnUseCheckedAsHome')) {
          const u = activeUser(); if (!u) return;
          const addresses = ensureHomeAddressModel(u);
          const idx = Number(e.target.dataset.idx);
          const picked = addresses.checked[idx];
          if (!picked) return;
          const previousProfile = addresses.profile;
          addresses.checked.splice(idx, 1);
          addresses.profile = picked;
          if (previousProfile && !isAddressEmpty(previousProfile)) addresses.checked.unshift(previousProfile);
          while (addresses.checked.length > 5) addresses.checked.pop();
          syncLegacyHomeFields(u);
          // Construction Year and facing direction may have changed with the swap - the promoted
          // address's own `facing` (set on it while it was still just a Checked Address - see
          // renderAddressFieldsHTML's includeFacing) now becomes the main profile's Home Main Door
          // Facing (prof.fsDir), the same value the Ba Zhai Compass School card and Flying Star both
          // read - kept in sync across every select sharing that class, exactly like editing it directly
          // does. A promoted address with no facing set leaves prof.fsDir untouched rather than blanking
          // out a value that was already there.
          const prof = getProfileByPrefix('i');
          if (prof && picked.facing) {
              prof.fsDir = picked.facing;
              document.querySelectorAll(`.fs-dir-select[data-prefix="i"]`).forEach(sel => { sel.value = picked.facing; });
          }
          saveState();
          refreshHomeAddressBlock(u);
          const fsResDiv = document.getElementById('fsFlyingStarResult_i');
          if (fsResDiv) {
              if (u.home.constructionYear && prof?.fsDir) {
                  const flyingStarP = prof ? getProfileData(prof) : getProfileData();
                  fsResDiv.innerHTML = renderFlyingStarResult(u.home.constructionYear, DIR_FULL_TO_SHORT[prof.fsDir], flyingStarP);
                  fsResDiv.style.display = 'block';
              } else {
                  fsResDiv.style.display = 'none';
              }
          }
          return;
      }
      // ENHANCEMENT: additional Business Partners - remove
      if (e.target.classList.contains('btnRemoveBizPartner2')) {
          const u = activeUser(); if (!u || !u.additionalBizPartners) return;
          const idx = Number(e.target.dataset.idx);
          // MULTI-ROLE PEOPLE MODEL (this round): additionalBizPartners[idx] is the (idx+1)th
          // 'businessPartner'-tagged person in u.people order (index 0 is the core/primary one).
          if (!syncLegacyRemoveByRole(u, 'businessPartner', idx + 1)) u.additionalBizPartners.splice(idx, 1); // fallback
          saveState();
          renderAdditionalBizPartners();
          return;
      }
      // ENHANCEMENT: Children tab - remove child / toggle full chart view
      if (e.target.classList.contains('btnRemoveChild')) {
          const u = activeUser(); if (!u || !u.children) return;
          const idx = Number(e.target.dataset.idx);
          if (!syncLegacyRemoveByRole(u, 'child', idx)) u.children.splice(idx, 1); // fallback - see syncLegacyRemoveByRole's own comment
          saveState();
          renderChildrenTab();
          return;
      }
      // ENHANCEMENT (outstanding item: "consolidate all profile-editing fields onto one page"): the
      // Manage Profiles hub's buttons are dynamically inserted (see renderManageProfilesList), so they
      // need delegated handling rather than a direct addEventListener bound only to elements present
      // at page load - each one just jumps to that profile's own existing edit form/tab.
      if (e.target.classList.contains('btnManageEditMain')) {
          prefillMainProfileForm();
          go('intake');
          return;
      }
      // ENHANCEMENT (reported: "remove the home address entry from Feng Shui as it is to be managed at
      // the profile level"): the Feng Shui section's own "Edit on Profile" shortcut jumps straight to
      // the Intake/Profile page (where House Number, Street Name, Unit, City, Country, Postal Code,
      // Construction Year, Home Facing Direction, and the Shared checkbox all now live exclusively),
      // same pattern as btnManageEditMain above.
      if (e.target.classList.contains('btnEditHomeAddressOnProfile')) {
          prefillMainProfileForm();
          go('intake');
          return;
      }
      if (e.target.classList.contains('btnManageEditPartner')) {
          prefillPartnerForm('p');
          $$('.view').forEach(v => v.classList.toggle('active', v.id === 'compat'));
          $('#nav').classList.remove('hidden');
          return;
      }
      if (e.target.classList.contains('btnManageEditBiz')) {
          prefillPartnerForm('b');
          $$('.view').forEach(v => v.classList.toggle('active', v.id === 'businessTab'));
          $('#nav').classList.remove('hidden');
          return;
      }
      if (e.target.classList.contains('btnManageGoChildren')) {
          go('childrenTab');
          return;
      }
      // UPDATED (reported: "household occupants should not be fixed... incorporate the household
      // occupants into the add person option under people instead and remove the household occupants
      // section"): the add/edit UI this button used to jump to (a dedicated Account-page section) is
      // gone - it now jumps to the flexible "People" screen instead, and, as a convenience, opens the
      // "+ Add Person" form there with the "Household Occupant" role already pre-checked so the click
      // leads straight into adding one, rather than just landing on the section and leaving the person
      // to open the form and find the right checkbox themselves.
      if (e.target.classList.contains('btnGoAccountOccupants')) {
          go('account');
          if (!peopleAddFormOpen) { peopleAddFormOpen = true; peopleEditingId = null; renderPeopleManagementList(); }
          setTimeout(() => {
              const preCheck = document.getElementById('pnew-role-occupant');
              if (preCheck) preCheck.checked = true;
              const targetEl = document.getElementById('peopleManagementSection');
              if (targetEl) {
                  targetEl.scrollIntoView({ behavior: 'smooth' });
                  targetEl.style.transition = 'background-color 0.3s';
                  targetEl.style.backgroundColor = 'var(--goldsoft)';
                  setTimeout(() => { targetEl.style.backgroundColor = ''; }, 1200);
              }
          }, 150);
          return;
      }
      // ============================================================================
      // UNIFIED MULTI-ROLE PEOPLE MANAGEMENT SCREEN handlers (this round)
      // ============================================================================
      if (e.target.id === 'btnPeopleAddPersonToggle') {
          peopleAddFormOpen = !peopleAddFormOpen;
          peopleEditingId = null;
          renderPeopleManagementList();
          return;
      }
      if (e.target.id === 'btnPeopleSaveNewPerson') {
          const u = activeUser(); if (!u) return;
          ensurePeopleArray(u);
          const fields = readPersonFieldsFromForm('pnew');
          const roles = readRolesFromCheckboxes('pnew');
          if (!validatePersonFields(fields, 'pnew-error', roles)) return;
          const partnerErr = checkOnlyOnePartnerRule(u, roles, null);
          if (partnerErr) { const el = document.getElementById('pnew-error'); if (el) el.textContent = partnerErr; return; }
          const vehiclePlateInput = fields._vehiclePlateInput; delete fields._vehiclePlateInput;
          const person = Object.assign({ id: makePersonId(), roles, vehicles: [] }, fields);
          applyVehiclePlateIfPartner(person, roles, vehiclePlateInput);
          u.people.push(person);
          rebuildLegacySlotsFromPeople(u);
          saveState();
          peopleAddFormOpen = false;
          renderPeopleManagementList();
          renderExportCenterList();
          renderExportReadinessChecklist();
          renderManageProfilesList();
          return;
      }
      if (e.target.classList.contains('btnPeopleEditPerson')) {
          const id = e.target.dataset.personid;
          peopleEditingId = (peopleEditingId === id) ? null : id;
          renderPeopleManagementList();
          return;
      }
      if (e.target.classList.contains('btnPeopleSavePersonEdit')) {
          const u = activeUser(); if (!u) return;
          const id = e.target.dataset.personid;
          const person = (u.people || []).find(p => p.id === id); if (!person) return;
          const formIdPrefix = `pedit-${id}`;
          const fields = readPersonFieldsFromForm(formIdPrefix);
          const roles = readRolesFromCheckboxes(formIdPrefix);
          if (!validatePersonFields(fields, `${formIdPrefix}-error`, roles)) return;
          const partnerErr = checkOnlyOnePartnerRule(u, roles, id);
          if (partnerErr) { const el = document.getElementById(`${formIdPrefix}-error`); if (el) el.textContent = partnerErr; return; }
          const vehiclePlateInput = fields._vehiclePlateInput; delete fields._vehiclePlateInput;
          Object.assign(person, fields, { roles });
          applyVehiclePlateIfPartner(person, roles, vehiclePlateInput);
          rebuildLegacySlotsFromPeople(u);
          saveState();
          peopleEditingId = null;
          renderPeopleManagementList();
          renderExportCenterList();
          renderExportReadinessChecklist();
          renderManageProfilesList();
          renderAllViews();
          return;
      }
      if (e.target.classList.contains('btnPeopleRemovePerson')) {
          const u = activeUser(); if (!u) return;
          const id = e.target.dataset.personid;
          if (typeof confirm === 'function' && !confirm(bt('Remove this person and all their role tags?', '确定移除此成员及其所有角色标签吗？'))) return;
          u.people = (u.people || []).filter(p => p.id !== id);
          rebuildLegacySlotsFromPeople(u);
          saveState();
          renderPeopleManagementList();
          renderExportCenterList();
          renderExportReadinessChecklist();
          renderManageProfilesList();
          renderAllViews();
          return;
      }
      if (e.target.classList.contains('btnToggleChildChart')) {
          const u = activeUser(); if (!u || !u.children) return;
          const idx = Number(e.target.dataset.idx);
          const container = document.getElementById(`childChart-${idx}`);
          if (!container) return;
          if (container.style.display === 'none' || !container.innerHTML) {
              const p = getProfileData();
              const cp = getProfileData(u.children[idx]);
              const cr = calculateTrueCompatibility(p, cp, false);
              container.innerHTML = renderSystemChart(cp, `c${idx}`, cr, false, p);
              container.style.display = 'block';
              e.target.textContent = bt('Hide Chart', '收起命盘');
          } else {
              container.style.display = 'none';
              container.innerHTML = '';
              e.target.textContent = bt('View Chart', '查看命盘');
          }
          return;
      }
      if (e.target.classList.contains('btnAddOccupant')) {
          const prefix = e.target.dataset.prefix;
          const prof = getProfileByPrefix(prefix); if (!prof) return;
          const nameInput = document.getElementById(`occ-name-${prefix}`);
          const birthdateInput = document.getElementById(`occ-birthdate-${prefix}`);
          const birthtimeInput = document.getElementById(`occ-birthtime-${prefix}`);
          const genderSelect = document.getElementById(`occ-gender-${prefix}`);
          const birthdate = birthdateInput?.value;
          if (!birthdate) return;
          const year = new Date(birthdate + 'T00:00:00').getFullYear();
          if (!year || year < 1920 || year > new Date().getFullYear()) return;
          prof.bazhaiOccupants = prof.bazhaiOccupants || [];
          if (prof.bazhaiOccupants.length >= 10) return;
          const birthtime = birthtimeInput?.value || '';
          // ENHANCEMENT (Phase 1): collects full birthdate (+ optional time) rather than just a birth
          // year, so a future household deep-analysis round can use this occupant's real BaZi chart
          // instead of only their Kua group. `approximateBirth` stays false here since a real date was
          // entered (even without a time) - it's only ever true for the pre-existing, year-only
          // occupants this replaces (see migrateOccupantBirthData() in engine-core.js).
          // MULTI-ROLE PEOPLE MODEL (this round): a new occupant is a genuinely new, distinct person -
          // always APPENDS a new 'occupant'-tagged person to u.people (occupants are currently only
          // ever collected on the main profile, prefix 'i', so no staleness risk from prof being
          // captured before the sync/rebuild below - see getProfileByPrefix('i') returning u.profile
          // itself rather than a derived copy).
          const u0 = activeUser();
          syncLegacyAppendToPeople(u0, 'occupant', { name: (nameInput?.value || '').trim(), englishFirstName: (nameInput?.value || '').trim(), year, birthdate, birthtime, gender: genderSelect?.value || 'male', approximateBirth: false });
          saveState();
          const p = getProfileData(prof); const u = activeUser();
          const listWrap = document.getElementById(`occupants-rows-${prefix}`)?.parentElement;
          if (listWrap) listWrap.innerHTML = renderOccupantsListHTML(prefix, prof.bazhaiOccupants);
          const occDiv = document.getElementById(`bazhai-occupants-analysis-${prefix}`);
          if (occDiv) {
              const people = buildHouseholdPeopleList(p, u, prof.bazhaiOccupants);
              occDiv.innerHTML = generateDeepAnalysisData('bazhai_occupants', p, { title: 'Full Household Roster Deep Analysis', direction: prof.fsDir || '', people });
          }
          // ENHANCEMENT (Phase 2): the household compatibility reading also needs to refresh whenever
          // the occupant roster changes, exactly like the Ba Zhai roster reading right above it.
          const compatDiv = document.getElementById(`household-compat-analysis-${prefix}`);
          if (compatDiv) {
              const compatRoster = buildHouseholdCompatibilityRoster(p, u, prof.bazhaiOccupants);
              compatDiv.innerHTML = generateDeepAnalysisData('household_compat', p, { title: 'Household Compatibility Deep Analysis', roster: compatRoster });
          }
      }
      if (e.target.classList.contains('btnRemoveOccupant')) {
          const prefix = e.target.dataset.prefix; const idx = Number(e.target.dataset.idx);
          const prof = getProfileByPrefix(prefix); if (!prof || !prof.bazhaiOccupants) return;
          // MULTI-ROLE PEOPLE MODEL (this round): removes the idx-th 'occupant'-tagged person from
          // u.people (in the same order bazhaiOccupants was rendered in), then regenerates
          // prof.bazhaiOccupants (== u.profile.bazhaiOccupants) from it.
          if (!syncLegacyRemoveByRole(activeUser(), 'occupant', idx)) prof.bazhaiOccupants.splice(idx, 1); // fallback - see syncLegacyRemoveByRole's own comment
          saveState();
          const p = getProfileData(prof); const u = activeUser();
          const listWrap = document.getElementById(`occupants-rows-${prefix}`)?.parentElement;
          if (listWrap) listWrap.innerHTML = renderOccupantsListHTML(prefix, prof.bazhaiOccupants);
          const occDiv = document.getElementById(`bazhai-occupants-analysis-${prefix}`);
          if (occDiv) {
              const people = buildHouseholdPeopleList(p, u, prof.bazhaiOccupants);
              occDiv.innerHTML = generateDeepAnalysisData('bazhai_occupants', p, { title: 'Full Household Roster Deep Analysis', direction: prof.fsDir || '', people: (prof.bazhaiOccupants.length ? people : []) });
          }
          const compatDiv = document.getElementById(`household-compat-analysis-${prefix}`);
          if (compatDiv) {
              const compatRoster = buildHouseholdCompatibilityRoster(p, u, prof.bazhaiOccupants);
              compatDiv.innerHTML = generateDeepAnalysisData('household_compat', p, { title: 'Household Compatibility Deep Analysis', roster: compatRoster });
          }
      }
      if (e.target.classList.contains('btnAddVehicle')) {
          const prefix = e.target.dataset.prefix;
          const u = activeUser();
          const input = document.getElementById(`newVehicleInput_${prefix}`);
          const number = input?.value.trim().toUpperCase();
          if (!number) return;
          // MULTI-ROLE PEOPLE MODEL: vehicles are collected for the main profile (prefix 'i',
          // unaffected by the people model - u.profile is never regenerated) or the Life Partner /
          // Business Partner (prefix 'p' / 'b'). For 'p' AND 'b', u.partner/u.businessPartner are
          // DERIVED copies regenerated by rebuildLegacySlotsFromPeople on many other actions, so the
          // write must go to the underlying u.people entry first, then rebuild - mutating the
          // (about-to-be-replaced) derived object directly would silently lose the vehicle the next
          // time anything else triggers a rebuild. UPDATED (reported: business partner should have
          // vehicle compatibility too) - 'b' now follows the same safe-write path 'p' already used.
          if (prefix === 'p' || prefix === 'b') {
            ensurePeopleArray(u);
            const role = prefix === 'p' ? 'partner' : 'businessPartner';
            const person = findPersonByRole(u, role, 0); if (!person) return;
            person.vehicles = person.vehicles || [];
            person.vehicles.push({ number, shared: false });
            rebuildLegacySlotsFromPeople(u);
          } else {
            const prof = getProfileByPrefix(prefix); if (!prof) return;
            prof.vehicles = prof.vehicles || [];
            prof.vehicles.push({ number, shared: false });
          }
          saveState();
          input.value = '';
          const prof2 = getProfileByPrefix(prefix);
          const p = getProfileData(prof2);
          const section = e.target.closest('article');
          if (section) section.outerHTML = renderVehiclesBlock(prefix, p, prof2);
      }
      if (e.target.classList.contains('btnRemoveVehicle')) {
          const prefix = e.target.dataset.prefix; const idx = Number(e.target.dataset.idx);
          const u = activeUser();
          // See the matching comment on btnAddVehicle above - 'p' and 'b' both need the safe
          // write-through-u.people-then-rebuild path since their legacy slots are derived copies.
          if (prefix === 'p' || prefix === 'b') {
            ensurePeopleArray(u);
            const role = prefix === 'p' ? 'partner' : 'businessPartner';
            const person = findPersonByRole(u, role, 0); if (!person || !person.vehicles) return;
            person.vehicles.splice(idx, 1);
            rebuildLegacySlotsFromPeople(u);
          } else {
            const prof = getProfileByPrefix(prefix); if (!prof || !prof.vehicles) return;
            prof.vehicles.splice(idx, 1);
          }
          saveState();
          const prof2 = getProfileByPrefix(prefix);
          const p = getProfileData(prof2);
          const section = e.target.closest('article');
          if (section) section.outerHTML = renderVehiclesBlock(prefix, p, prof2);
      }
  });


  // Bug 6, 16, 17 Triggers
  document.addEventListener('click', e => {
      if (e.target.classList.contains('btnSuggestAnotherName')) {
          const prefix = e.target.dataset.prefix;
          const prof = getProfileByPrefix(prefix);
          const p = prof ? getProfileData(prof) : getProfileData();
          if (!p) return;
          const shownNames = (e.target.dataset.shown || '').split(',').filter(Boolean);
          let list = suggestChineseGivenNameList(p.chineseLastName, p.bazi.dayStemIdx, null, 1, 85);
          let reached85 = true;
          if (!list.length) { list = suggestChineseGivenNameList(p.chineseLastName, p.bazi.dayStemIdx, null, 1, 0); reached85 = false; }
          const next = list.find(r => !shownNames.includes(r.name));
          const displayEl = document.getElementById(`suggestedNameDisplay-${prefix}`);
          const noteEl = document.getElementById(`suggestedNameNote-${prefix}`);
          if (!next) {
              if (noteEl) noteEl.innerHTML = bt(`No further distinct name combinations found beyond the ${shownNames.length} already shown from the searched character pool - these are the strongest options available.`, `除已显示的 ${shownNames.length} 个组合外，未能在搜索范围内找到其他不同的姓名组合——以上已是目前最佳选择。`);
              e.target.disabled = true;
              e.target.style.opacity = '0.5';
              return;
          }
          if (displayEl) displayEl.innerHTML = `${p.chineseLastName || ''}<span style="color:var(--success);font-weight:800">${next.name}</span> → ${next.percent}%`;
          if (noteEl) noteEl.innerHTML = reached85
            ? bt(`This alternative reaches ${next.favCount}/5 Favourable grids (85%+), keeping your surname unchanged.`, `此替代组合达到 ${next.favCount}/5 个有利格（85%以上），且姓氏保持不变。`)
            : bt(`This alternative reaches ${next.favCount}/5 Favourable grids - no combination in the searched pool reaches 85% for this Day Master, so this is the next-best option.`, `此替代组合达到 ${next.favCount}/5 个有利格——此日主在搜索范围内未有组合达到85%，故此为次佳选择。`);
          e.target.dataset.shown = [...shownNames, next.name].join(',');
      }
      // BUG FIX (this round - the real cause of the residual "click sometimes just does nothing" part
      // of the long-running Hourly-tab lag saga, found live via a real simulated mouse click on the
      // user's own running app after the timer-throttling fix above measurably improved but did not
      // fully resolve the reported lag). This button's own markup is `<button class="btnHourlyDayToggle">
      // Tomorrow<br><span>Tuesday, 29 September</span></button>` - i.e. the visible date-label text sits
      // inside a nested <span>, not directly on the button element. A real mouse click lands on whatever
      // element is actually under the cursor: clicking the button's outer edge/padding hits the <button>
      // itself, but clicking the date-label text (a large, natural-to-click portion of the button, right
      // where a user's eye is drawn) makes e.target that inner <span> - which does NOT have the
      // `btnHourlyDayToggle` class, so the exact-match `e.target.classList.contains(...)` check below used
      // to fail silently: no active-state change, no "Computing..." placeholder, no computation, nothing
      // at all. Confirmed directly: a real (trusted) click dispatched at the button's own on-screen
      // center - which `document.elementFromPoint` at that exact coordinate resolves to the inner date
      // <span> - registered zero clicks on this handler, while a synthetic click dispatched directly on
      // the <button> element itself worked instantly every time. This explains the residual, seemingly
      // random unresponsiveness precisely: whether a given click "does nothing" depends on the exact pixel
      // clicked, which a user has no way to know is special - it reads exactly like an intermittent freeze
      // requiring several attempts, which itself feels like a multi-second delay. Fixed by walking up to
      // the actual button with `closest()` instead of checking `e.target` directly, so a click anywhere
      // inside the button (including its date-label span) is handled correctly.
      const hourlyToggleBtn = e.target.closest('.btnHourlyDayToggle');
      if (hourlyToggleBtn && !hourlyToggleBtn.disabled) {
          const day = hourlyToggleBtn.dataset.day;
          const dayContentEl = document.getElementById('hourlyDayContent');
          const dayOffsetByKey = { today: 0, tomorrow: 1, day2: 2, day3: 3 };
          const alreadyCached = !!(globalThis.__hourlyDayHTML && globalThis.__hourlyDayHTML[day]);
          // DIAGNOSTIC (added after two rounds of fixes here still didn't resolve a reported "14
          // seconds before I can click on another day" lag, which this app's own testing has not been
          // able to reproduce - real compute time measures well under a second in every test run).
          // Rather than guess at a third theory blind, this measures and displays the REAL elapsed time
          // for this specific click, on the actual device it's running on, right in the UI - no
          // DevTools needed. If this is still slow for you, the number shown here (and logged to the
          // console) is the actual ground truth to report back, so the real bottleneck - wherever it
          // turns out to be - can be pinned down directly instead of guessed at again.
          const __hourlyClickStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

          // PERCEIVED-PERFORMANCE FIX (reported again: "Clicks on the hourly tab are very unresponsive"
          // even after the lazy-computation fix below cut the real compute time to well under a second).
          // The real bug here: this handler used to run the (still synchronous) calculation FIRST and
          // only update the buttons' pressed/active styling AFTER it finished - so for the entire
          // calculation window, literally nothing on screen changed. That reads exactly like a frozen,
          // unresponsive page, and clicking again out of doubt during that window only queues up more
          // work. Now the clicked button's active style, a disabled state on all 4 buttons (so rapid
          // re-clicks can't pile up), and a "Computing..." placeholder (only shown when this day isn't
          // cached yet - a repeat click on an already-computed day stays instant, no placeholder flash)
          // are all applied FIRST, synchronously, so the click visibly registers immediately; the actual
          // calculation is then deferred one tick (setTimeout 0) so the browser gets a chance to paint
          // that feedback before the (possibly ~0.3-0.5s) computation runs.
          $$('.btnHourlyDayToggle').forEach(btn => {
            const active = btn.dataset.day === day;
            btn.style.background = active ? 'var(--gold)' : '#fff';
            btn.style.color = active ? '#fff' : 'var(--plum)';
            btn.style.borderColor = active ? 'var(--gold)' : 'var(--line)';
            if (!alreadyCached) { btn.disabled = true; btn.style.opacity = '0.6'; btn.style.cursor = 'wait'; }
          });
          if (!alreadyCached && dayContentEl) {
            dayContentEl.innerHTML = `<div class="calc-box" style="text-align:center;padding:16px">${bt('Computing…','计算中…')}</div>`;
          }

          const finishApply = (computedNow) => {
            if (dayContentEl && globalThis.__hourlyDayHTML) {
                dayContentEl.innerHTML = globalThis.__hourlyDayHTML[day] || globalThis.__hourlyDayHTML.today;
            }
            $$('.btnHourlyDayToggle').forEach(btn => { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; });
            const elapsedMs = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - __hourlyClickStart);
            const diagEl = document.getElementById('hourlyPerfDiag');
            const diagText = bt(`Last day switch: ${elapsedMs}ms (${computedNow ? 'computed fresh' : 'cached'})`, `上次切换耗时：${elapsedMs}毫秒（${computedNow ? '重新计算' : '缓存'}）`);
            if (diagEl) diagEl.textContent = diagText;
            console.log(`[Illuminate Hourly tab] ${diagText}`);
          };
          if (alreadyCached) {
            // Instant cache read - no chunking needed, matches the original "cache read is instant"
            // guarantee exactly.
            finishApply(false);
          } else if (globalThis.__hourlyDayCtx && day in dayOffsetByKey) {
            // PERFORMANCE FIX (reported again: "click a day, then click another day right after - no
            // response until 10 seconds later - not captured in the console value"): computing 2 blocks
            // per tick (instead of all 12 in one uninterrupted synchronous loop) lets the browser repaint
            // and process input between every chunk, so the page stays visibly responsive throughout, the
            // "Computing… (n/12)" text shows real progress instead of a static placeholder, and the
            // diagnostic's elapsed time reflects genuine end-to-end wall-clock time on whatever device it
            // runs on. REFACTORED this round to share the exact same chunking implementation (and the
            // same generation-based staleness guard) as the initial "today" load in renderHourlyTab,
            // instead of duplicating the loop here - see computeHourlyDayChunked.
            globalThis.__hourlyDayGen = (globalThis.__hourlyDayGen || 0) + 1;
            const thisGen = globalThis.__hourlyDayGen;
            const dayOffset = dayOffsetByKey[day];
            computeHourlyDayChunked(
              globalThis.__hourlyDayCtx, dayOffset, day, thisGen,
              (shiSoFar) => {
                if (dayContentEl) dayContentEl.innerHTML = `<div class="calc-box" style="text-align:center;padding:16px">${bt('Computing…','计算中…')} (${shiSoFar}/12)</div>`;
              },
              () => {
                if (globalThis.__hourlyDayGen !== thisGen) return; // superseded by a newer click/render - discard
                finishApply(true);
              }
            );
          } else {
            finishApply(false);
          }
      }
      if (e.target.classList.contains('btnViewPastDraw')) {
          const gameKey = e.target.dataset.game;
          const idSuffix = e.target.dataset.idSuffix;
          const dateSelect = document.getElementById(`pastDrawsDateSelect_${idSuffix}`);
          const resultDiv = document.getElementById(`pastDrawResult_${idSuffix}`);
          if (!dateSelect || !resultDiv) return;
          const isoDate = dateSelect.value;
          resultDiv.innerHTML = renderSingleDrawDetail(gameKey, isoDate, lang === 'zh');
          resultDiv.style.display = 'block';
      }
      // ENHANCEMENT (this round): favourites are now managed via individual add/remove actions
      // instead of retyping the entire comma-separated list to change one number.
      if (e.target.classList.contains('btnAddFavourite')) {
          const gameKey = e.target.dataset.game;
          const idSuffix = gameKey === 'fourD' ? '4d' : 'toto';
          const inputEl = document.getElementById(`favouriteAddInput_${idSuffix}`);
          if (!inputEl || !inputEl.value.trim()) return;
          const u = activeUser(); if (!u || !u.profile) return;
          const existing = gameKey === 'fourD' ? (u.profile.favourite4D || []) : (u.profile.favouriteToto || []);
          // Reuses the same validated parser as before (correct format/range per game), then MERGES
          // with what's already saved - deduplicated, capped at 15 total - rather than replacing it.
          const newlyParsed = parseFavouriteInput(inputEl.value, gameKey);
          const merged = [...existing];
          newlyParsed.forEach(n => { if (!merged.includes(n)) merged.push(n); });
          const capped = merged.slice(0, 15);
          if (gameKey === 'fourD') u.profile.favourite4D = capped; else u.profile.favouriteToto = capped;
          saveState();
          inputEl.value = '';
          const p = getProfileData();
          if (p && typeof renderLotteryPredictions === 'function') renderLotteryPredictions(p);
      }
      if (e.target.classList.contains('btnRemoveFavourite')) {
          const gameKey = e.target.dataset.game;
          const rawValue = e.target.dataset.value;
          const u = activeUser(); if (!u || !u.profile) return;
          if (gameKey === 'fourD') {
            u.profile.favourite4D = (u.profile.favourite4D || []).filter(n => n !== rawValue);
          } else {
            // TOTO favourites are stored as numbers, but dataset attributes are always strings.
            u.profile.favouriteToto = (u.profile.favouriteToto || []).filter(n => String(n) !== rawValue);
          }
          saveState();
          const p = getProfileData();
          if (p && typeof renderLotteryPredictions === 'function') renderLotteryPredictions(p);
      }
      if (e.target.classList.contains('chartTabBtn')) {
          switchChartTab(e.target.dataset.prefix, e.target.dataset.tab);
      }
      if (e.target.classList.contains('btnViewDeepAnalysis') || e.target.closest?.('.btnViewDeepAnalysis')) {
          const btn = e.target.classList.contains('btnViewDeepAnalysis') ? e.target : e.target.closest('.btnViewDeepAnalysis');
          const id = btn.dataset.id;
          const content = deepAnalysisRegistry[id];
          const overlay = document.getElementById('deepAnalysisModalOverlay');
          const contentEl = document.getElementById('deepAnalysisModalContent');
          const box = overlay ? overlay.querySelector('.modal-box') : null;
          if (overlay && contentEl && content) {
            contentEl.innerHTML = content;
            overlay.classList.remove('hidden');
            if (box) positionModalNearClick(box, e.clientX, e.clientY);
          }
      }
      if (e.target.id === 'deepAnalysisModalClose' || e.target.id === 'deepAnalysisModalOverlay') {
          const overlay = document.getElementById('deepAnalysisModalOverlay');
          if (overlay) overlay.classList.add('hidden');
      }
      if (e.target.classList.contains('btnSuggestNameRetain')) {
          const prefix = e.target.dataset.prefix;
          const prof = getProfileByPrefix(prefix);
          const p = prof ? getProfileData(prof) : getProfileData();
          const retainInput = document.getElementById(`retainChar-${prefix}`);
          const retainChar = (retainInput?.value || '').trim();
          const posSelect = document.getElementById(`retainPos-${prefix}`);
          const retainPosition = Number(posSelect?.value || 1);
          const resBox = document.getElementById(`retainSuggestResult-${prefix}`);
          if (!resBox || !p) return;
          const suggested = suggestChineseGivenName(p.chineseLastName, p.bazi.dayStemIdx, retainChar || null, retainPosition);
          if (!suggested) {
              resBox.innerHTML = `<div style="color:var(--danger);font-size:12px">${bt('No combination retaining that character reaches a strong compatibility score - try a different character, a different position, or leave it blank.','保留该字未能找到契合度理想的组合，请尝试其他字、其他位置，或留空。')}</div>`;
          } else {
              resBox.innerHTML = `<div class="calc-box" style="border-left-color:var(--success)">
                <strong>${bt('Suggested Given Name','建议改名（名字）')}:</strong> ${p.chineseLastName || ''}<span style="color:var(--success);font-weight:800">${suggested.name}</span> → ${suggested.percent}%<br>
                <span style="font-size:11px;color:var(--muted)">${bt(`Retaining "${retainChar}" as the ${retainPosition === 2 ? '2nd' : '1st'} character as requested, this combination reaches ${suggested.favCount}/5 Favourable grids.`, `依您要求将「${retainChar}」保留为第${retainPosition === 2 ? '二' : '一'}字，此组合达到 ${suggested.favCount}/5 个有利格。`)}</span>
              </div>`;
          }
          resBox.style.display = 'block';
      }
      if (e.target.classList.contains('btnFindDates')) {
          const prefix = e.target.dataset.prefix;
          const dateInput = document.getElementById(`zrStart_${prefix}`);
          const tierSelect = document.getElementById(`zrTier_${prefix}`);
          const prof = getProfileByPrefix(prefix);
          const p = prof ? getProfileData(prof) : getProfileData();
          const resBox = document.getElementById(`zrResults_${prefix}`);
          if (!resBox) return;
          const tier = tierSelect ? tierSelect.value : 'Auspicious';
          resBox.innerHTML = renderAuspiciousDatesList(dateInput ? dateInput.value : '', tier, p);
          resBox.style.display = 'block';
      }

      // ENHANCEMENT (this round): Flying Star (玄空飞星) calculator - a standalone property-based
      // calculation, so it reads its two inputs directly and does not touch any saved profile data.
      if (e.target.classList.contains('btnCalcFlyingStar')) {
          const prefix = e.target.dataset.prefix;
          const yearInput = document.getElementById(`fsYearInput_${prefix}`);
          const facingInput = document.getElementById(`fsFacingInput_${prefix}`);
          const resBox = document.getElementById(`fsFlyingStarResult_${prefix}`);
          if (!resBox) return;
          const year = parseInt(yearInput?.value, 10);
          const facing = facingInput?.value;
          if (!year || year < 1864 || year > 2043 || !facing) {
              resBox.innerHTML = `<div class="error" style="min-height:auto">${bt('Please enter a construction year (1864-2043) and select a facing direction.','请输入建造年份（1864-2043）并选择朝向。')}</div>`;
              resBox.style.display = 'block';
              return;
          }
          const flyingStarP = getProfileByPrefix(prefix) ? getProfileData(getProfileByPrefix(prefix)) : getProfileData();
          resBox.innerHTML = renderFlyingStarResult(year, facing, flyingStarP);
          resBox.style.display = 'block';
      }

      // ENHANCEMENT (this round): Xiang Shu (面相) self-report calculator - reads its 5 inputs
      // directly, independent of any saved profile data.
      if (e.target.classList.contains('btnCalcXiangShu')) {
          const prefix = e.target.dataset.prefix;
          const resBox = document.getElementById(`xsResult_${prefix}`);
          if (!resBox) return;
          const features = {
              face: document.getElementById(`xsFaceInput_${prefix}`)?.value,
              eyes: document.getElementById(`xsEyesInput_${prefix}`)?.value,
              nose: document.getElementById(`xsNoseInput_${prefix}`)?.value,
              mouth: document.getElementById(`xsMouthInput_${prefix}`)?.value,
              chin: document.getElementById(`xsChinInput_${prefix}`)?.value
          };
          resBox.innerHTML = renderXiangShuResult(features);
          resBox.style.display = 'block';
      }

      // ENHANCEMENT (this round): PDF export button, present on the individual/partner/business
      // partner chart pages, identified by data-prefix rather than a fixed id since it repeats
      // across three separate view sections.
      const exportBtn = e.target.closest('.btnExportPdf');
      if (exportBtn) {
          exportProfileToPdf(exportBtn.dataset.prefix);
      }
      
      if (e.target.classList.contains('btnCheckSpecificDate')) {
          const prefix = e.target.dataset.prefix;
          const dateInput = document.getElementById(`zrCheckDate_${prefix}`);
          const prof = getProfileByPrefix(prefix);
          const p = prof ? getProfileData(prof) : getProfileData();
          const resBox = document.getElementById(`zrCheckResult_${prefix}`);
          if (!resBox) return;
          resBox.innerHTML = renderSpecificDateAnalysis(dateInput ? dateInput.value : '', p);
          resBox.style.display = 'block';
      }

      // ENHANCEMENT (reported: "Move the mobile number and vehicle plate checker into the personal
      // assets section. They should not reside in the landing page"): these 4 handlers now key off a
      // CLASS (there can be one Checker & Generator instance per profile now, each with its own
      // prefix-suffixed element ids) rather than a single fixed id, and resolve the profile to score
      // against from the clicked element's data-prefix, via getProfileByPrefix - so checking or
      // generating on, say, the Life Partner's own Personal Assets section correctly scores against the
      // Life Partner's own Day Master, not silently always the main individual as the old single
      // Home-page widget did.
      if (e.target.classList.contains('btnCheckVehicle')) {
          const prefix = e.target.dataset.prefix || 'i';
          const inputEl = $(`#currentVehicleInput_${prefix}`);
          const val = inputEl ? inputEl.value.trim() : '';
          const box = $(`#currentVehicleAuditResult_${prefix}`);
          if (box) {
              if (!val) { box.style.display = 'none'; }
              else {
                  const u = activeUser(); const prof = getProfileByPrefix(prefix); const p = prof ? getProfileData(prof) : getProfileData();
                  const partnerP = ($(`#checkVehicleSharedPartner_${prefix}`)?.checked && u?.partner) ? getProfileData(u.partner) : null;
                  const res = auditVehicleScore(val, p, partnerP);
                  box.innerHTML = `<strong>Plate "${val}" Score: <span style="color:${scoreColor(res.score)}">${res.score}%</span></strong><br><span style="font-size:12px">${res.explanation}</span>${renderStandardDeepAnalysis('Vehicle Plate Elemental Deep Analysis', `Parsed elemental composition of "${val}" scored ${res.score}%.`, res.explanation, `Score reflects how well the plate's elemental composition supports this profile's Day Master${partnerP?" and the Life Partner's":''}.`, res.hl, res.pos, res.neg, res.cau)}`;
                  box.style.display = 'block';
              }
          }
      }
      if (e.target.classList.contains('btnCheckMobile')) {
          const prefix = e.target.dataset.prefix || 'i';
          const inputEl = $(`#currentMobileInput_${prefix}`);
          const val = inputEl ? inputEl.value.trim() : '';
          const box = $(`#currentMobileAuditResult_${prefix}`);
          if (box) {
              if (!val) { box.style.display = 'none'; }
              else {
                  const u = activeUser(); const prof = getProfileByPrefix(prefix); const p = prof ? getProfileData(prof) : getProfileData();
                  const partnerP = ($(`#checkMobileSharedPartner_${prefix}`)?.checked && u?.partner) ? getProfileData(u.partner) : null;
                  const res = auditMobileScore(val, p, partnerP);
                  box.innerHTML = `<strong>Number "${val}" Score: <span style="color:${scoreColor(res.score)}">${res.score}%</span></strong><br><span style="font-size:12px">${res.explanation}</span>${renderStandardDeepAnalysis('Mobile Number Elemental Deep Analysis', `Parsed elemental composition of "${val}" scored ${res.score}%.`, res.explanation, `Score reflects how well the number's elemental composition supports this profile's Day Master${partnerP?" and the Life Partner's":''}.`, res.hl, res.pos, res.neg, res.cau)}`;
                  box.style.display = 'block';
              }
          }
      }
      if (e.target.classList.contains('btnRegenVehicle')) {
          const prefix = e.target.dataset.prefix || 'i';
          const u = activeUser(); const prof = getProfileByPrefix(prefix); const p = prof ? getProfileData(prof) : getProfileData();
          const vDigits = Number($(`#vehicleDigitSelect_${prefix}`)?.value || 4);
          const shared = $(`#sharedPartnerVehicle_${prefix}`)?.checked && u?.partner;
          const partnerP = shared ? getProfileData(u.partner) : null;
          const seedOffset = Math.floor(Math.random() * 1000);
          const res = generateUnanchoredVehicle(p, partnerP, vDigits, seedOffset);
          if ($(`#vehicleNumberDisplay_${prefix}`)) $(`#vehicleNumberDisplay_${prefix}`).textContent = res.number;
          if ($(`#vehicleCalcDetails_${prefix}`)) $(`#vehicleCalcDetails_${prefix}`).innerHTML = `<div style="font-size:12px;color:${scoreColor(res.score)};font-weight:700">Score: ${res.score}%</div><div style="font-size:12px;margin-top:4px">${res.explanation}</div>`;
      }
      if (e.target.classList.contains('btnRegenMobile')) {
          const prefix = e.target.dataset.prefix || 'i';
          const u = activeUser(); const prof = getProfileByPrefix(prefix); const p = prof ? getProfileData(prof) : getProfileData();
          const mDigits = Number($(`#mobileDigitSelect_${prefix}`)?.value || 8);
          const prefixSel = $(`#mobilePrefixSelect_${prefix}`)?.value || 'auto';
          const mobilePrefixDigit = prefixSel === 'auto' ? '9' : prefixSel;
          const shared = $(`#sharedPartnerMobile_${prefix}`)?.checked && u?.partner;
          const partnerP = shared ? getProfileData(u.partner) : null;
          const seedOffset = Math.floor(Math.random() * 1000);
          const res = generateUnanchoredMobile(p, partnerP, mDigits, mobilePrefixDigit, seedOffset);
          if ($(`#mobileNumberDisplay_${prefix}`)) $(`#mobileNumberDisplay_${prefix}`).textContent = res.number;
          if ($(`#mobileCalcDetails_${prefix}`)) $(`#mobileCalcDetails_${prefix}`).innerHTML = `<div style="font-size:12px;color:${scoreColor(res.score)};font-weight:700">Score: ${res.score}%</div><div style="font-size:12px;margin-top:4px">${res.explanation}</div>`;
      }
  });
}

window.addEventListener('DOMContentLoaded', () => { 
  if(typeof initAuthListeners === 'function') initAuthListeners();
  initListeners(); updateStaticLanguage(); 
  if (activeUser()) go(activeUser().profile ? 'home' : 'intake'); else go('welcome'); 
});
