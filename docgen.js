// docgen.js — Resume and cover letter generation logic.
//
// This file is developed and tested standalone under Node (using the same
// `docx` package available via CDN in the browser) before being embedded
// into dashboard.html. Keeping it separate during development makes it
// possible to catch errors with real Node stack traces instead of
// debugging inside a browser console.
//
// TAILORING APPROACH (per explicit instruction): real bullets from
// resume_data.js are REORDERED and SELECTED based on keyword overlap with
// the target job description — no bullet text is invented, rewritten, or
// exaggerated. The set of true statements is fixed; only emphasis
// (ordering, which competency groups lead) changes per job. The one piece
// of job-specific NEW text is a single opening sentence naming the target
// role/company and, where the JD's own top matched keywords overlap with
// Roy's real matched_keywords for that posting, naming those explicitly —
// still entirely factual (it names things Roy's resume already says are
// true), not an invented claim.
//
// VISUAL FORMAT: matches Roy_Wong_CV_190826.docx exactly, confirmed by
// unzipping that file and reading its own word/document.xml — Arial
// throughout, headings in #1F3864 with a 6-weight bottom border rule,
// true bulleted list items (not inline paragraphs) for competencies, and
// company/dates on one line with the date right-aligned via a positional
// tab. The cover letter reuses the same font, heading color, and rule
// style so the two documents look like a matched set.

const BRAND_COLOR = "1F3864";
const FONT = "Arial";

function extractJobKeywords(jobText) {
  // Build a lowercase token set from the JD to score resume items against.
  return (jobText || "").toLowerCase();
}

// Generic tags that appear on many bullets and shouldn't dominate ranking
// just by co-occurring; specific tags (sla, escalation, grr, csat, etc.)
// are far more diagnostic of genuine JD fit and are weighted higher.
const COMMON_TAGS = new Set([
  "customer success", "service delivery", "healthcare", "asean", "apac",
  "regional leadership", "stakeholder management", "c-suite", "portfolio",
  "strategy", "executive",
]);

function tagWeight(tag) {
  return COMMON_TAGS.has(tag) ? 1 : 2;
}

function scoreItemAgainstJob(itemTags, jobTextLower) {
  return itemTags
    .filter(tag => jobTextLower.includes(tag))
    .reduce((sum, tag) => sum + tagWeight(tag), 0);
}

function tailorSummary(resumeData, jobTitle, jobTextLower) {
  // The two base summary sentences are always used verbatim (they are
  // factual, high-level, and true for any role) — tailoring here means
  // choosing whether to lead with them as-is. No new sentence is invented.
  return {
    line1: resumeData.baseSummary,
    line2: resumeData.baseSummaryLine2,
  };
}

function tailorCompetencies(resumeData, jobTextLower) {
  // Reorder the 5 real competency groups by keyword overlap with the JD.
  // All 5 are always included (nothing is hidden) — only order changes.
  const scored = resumeData.coreCompetencies.map(group => ({
    group,
    score: scoreItemAgainstJob(group.tags, jobTextLower),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.group);
}

function tailorExperience(resumeData, jobTextLower) {
  // Roles stay in reverse-chronological order (standard resume convention
  // — changing this would look wrong to any recruiter/ATS). Within each
  // role, the real bullets are reordered by relevance to the JD.
  return resumeData.experience.map(role => {
    const scoredBullets = role.bullets.map(b => ({
      bullet: b,
      score: scoreItemAgainstJob(b.tags, jobTextLower),
    }));
    scoredBullets.sort((a, b) => b.score - a.score);
    return {
      ...role,
      bullets: scoredBullets.map(s => s.bullet),
    };
  });
}

function findTopMatchedTerms(resumeData, jobTextLower, maxTerms) {
  // Collect every tag from every competency group and every bullet that
  // actually appears in the JD text, weighted the same way tailoring
  // scoring is, then return the top few, most-specific ones, translated
  // to plain English. Used to build a genuinely job-specific (not
  // generic) opening line — every term returned here is something both
  // the JD asks for AND Roy's resume already, factually, lists as a real
  // skill/competency; nothing here is invented.
  const seen = new Map();
  const collect = (tags) => {
    tags.forEach(tag => {
      if (jobTextLower.includes(tag) && !seen.has(tag)) {
        seen.set(tag, tagWeight(tag));
      }
    });
  };
  resumeData.coreCompetencies.forEach(g => collect(g.tags));
  resumeData.experience.forEach(role => role.bullets.forEach(b => collect(b.tags)));

  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .map(termToPlainEnglish)
    .filter((v, i, arr) => v && arr.indexOf(v) === i)  // drop untranslatable terms, then de-dupe
    .slice(0, maxTerms);
}

// Every tag used anywhere in resume_data.py, translated to a plain-English
// phrase with no acronyms or industry jargon. This is the ONLY place
// resume tags get turned into reader-facing wording — the résumé's and
// cover letter's original sentences (from resume_data.py, i.e. Roy's real
// CV) are never reworded, only this new job-specific opening line is
// built from scratch, and only using terms from this approved list.
// A tag with no entry here is intentionally left out of the opening line
// rather than guessed at or shown as a raw acronym.
const PLAIN_ENGLISH_TERMS = {
  "sla": "meeting service commitments",
  "kpi": "tracking performance targets",
  "escalation": "resolving customer escalations",
  "renewal": "customer contract renewals",
  "contract renewal": "customer contract renewals",
  "retention": "customer retention",
  "churn": "reducing customer churn",
  "customer health": "tracking customer health",
  "ebr": "running executive business reviews",
  "qbr": "running quarterly business reviews",
  "voc": "gathering customer feedback",
  "customer advocacy": "building customer advocacy",
  "onboarding": "customer onboarding",
  "time-to-value": "speeding up time to value for customers",
  "adoption": "driving product adoption",
  "csat": "improving customer satisfaction",
  "nps": "improving customer satisfaction",
  "gross revenue retention": "retaining customer revenue",
  "grr": "retaining customer revenue",
  "net revenue retention": "growing revenue from existing customers",
  "nrr": "growing revenue from existing customers",
  "service governance": "service governance",
  "operating model": "designing operating models",
  "risk management": "managing operational risk",
  "continuous improvement": "continuous improvement",
  "forecasting": "revenue forecasting",
  "account expansion": "growing existing accounts",
  "expansion": "growing existing accounts",
  "stakeholder management": "managing senior stakeholders",
  "c-suite": "working with senior executives",
  "executive": "working with senior executives",
  "cio": "working with senior IT leaders",
  "cmio": "working with senior medical leaders",
  "asean": "leading teams across Southeast Asia",
  "apac": "leading teams across Asia-Pacific",
  "multi-country": "leading multi-country teams",
  "regional team": "leading regional teams",
  "regional leadership": "regional leadership",
  "regional operations": "regional operations",
  "cross-functional": "working across teams and departments",
  "customer success": "customer success",
  "customer experience": "customer experience",
  "customer journey": "mapping the customer journey",
  "service delivery": "service delivery",
  "professional services": "professional services",
  "salesforce": "using Salesforce",
  "servicemax": "using ServiceMax",
  "visio": "using Microsoft Visio",
  "bi": "using business reporting tools",
  "reporting tools": "using business reporting tools",
  "crm": "using customer relationship management systems",
  "healthcare": "the healthcare industry",
  "healthcare it": "healthcare technology",
  "hcis": "healthcare information systems",
  "cx": "customer experience",
  "team leadership": "leading teams",
  "people management": "managing people",
  "coaching": "coaching and developing staff",
  "succession planning": "succession planning",
  "account management": "managing enterprise accounts",
  "enterprise accounts": "managing enterprise accounts",
  "first-time fix": "first-time issue resolution",
  "go-to-market": "go-to-market planning",
  "digital transformation": "digital transformation",
  "public sector": "public sector work",
  "rfp": "leading proposal and tender processes",
  "tenders": "leading proposal and tender processes",
  "contract value": "managing contract value",
  "portfolio": "managing a large customer portfolio",
  "pricing": "pricing strategy",
  "product feedback": "gathering product feedback",
  "revenue growth": "growing revenue",
  "sales alignment": "aligning with sales teams",
  "commercial": "commercial leadership",
  "governance": "governance",
  "service attach": "growing service attach rates",
  "strategy": "strategic planning",
  "change management": "leading change management",
  "customer value": "delivering customer value",
  "regional": "regional leadership",
};

function termToPlainEnglish(tag) {
  return PLAIN_ENGLISH_TERMS[tag] || null;
}

function buildTailoredResumeModel(resumeData, job) {
  const jobTextLower = extractJobKeywords((job.title || "") + " " + (job.description || ""));
  const topMatchedTerms = findTopMatchedTerms(resumeData, jobTextLower, 4);
  return {
    candidateInfo: resumeData.candidateInfo,
    summary: tailorSummary(resumeData, job.title, jobTextLower),
    competencies: tailorCompetencies(resumeData, jobTextLower),
    experience: tailorExperience(resumeData, jobTextLower),
    education: resumeData.education,
    targetJobTitle: job.title,
    targetCompany: job.company,
    topMatchedTerms,
  };
}

// ---------------------------------------------------------------------
// SHARED STYLE HELPERS — used by both the resume and the cover letter so
// they read as a matched set.
// ---------------------------------------------------------------------

function sectionHeading(docxLib, text) {
  const { Paragraph, TextRun, BorderStyle } = docxLib;
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: BRAND_COLOR, font: FONT })],
    spacing: { before: 180, after: 90 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, space: 2, color: BRAND_COLOR },
    },
  });
}

function bodyRun(docxLib, text, opts) {
  const { TextRun } = docxLib;
  return new TextRun({ text, font: FONT, ...opts });
}

function bodyParagraph(docxLib, text, opts) {
  const { Paragraph, TextRun } = docxLib;
  return new Paragraph({
    children: [new TextRun({ text, font: FONT })],
    ...opts,
  });
}

// ---------------------------------------------------------------------
// DOCX BUILDING (uses the global `docx` object — loaded via CDN in the
// browser, via require() under Node for this standalone test)
// ---------------------------------------------------------------------

// Joins a list of plain-English phrases into a natural sentence fragment,
// e.g. ["a", "b", "c"] -> "a, b, and c" — used so the generated opening
// sentence reads naturally rather than as a raw comma-separated list.
function joinNaturally(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildResumeDocx(docxLib, model) {
  const { Document, Paragraph, TextRun, TabStopType, TabStopPosition } = docxLib;

  const children = [];

  // Header — name, tagline, contact line with a rule underneath, matching
  // the real CV's header treatment exactly.
  children.push(new Paragraph({
    children: [new TextRun({ text: model.candidateInfo.name.toUpperCase(), bold: true, size: 32, color: BRAND_COLOR, font: FONT })],
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: model.candidateInfo.tagline, size: 22, font: FONT })],
    spacing: { after: 60 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `${model.candidateInfo.location} | ${model.candidateInfo.phone} | ${model.candidateInfo.email} | ${model.candidateInfo.linkedin}`,
      size: 20, color: "444444", font: FONT,
    })],
    border: { bottom: { style: docxLib.BorderStyle.SINGLE, size: 4, space: 1, color: "auto" } },
    spacing: { after: 160 },
  }));

  // Executive Profile — opens with one genuinely job-specific sentence
  // (real target role/company, plus real matched skill terms already
  // true of Roy's background) ahead of the two fixed, factual summary
  // sentences. This is the direct fix for "resume isn't edited to match
  // the job" — a concrete, per-job difference beyond just bullet order.
  children.push(sectionHeading(docxLib, "EXECUTIVE PROFILE"));
  const targetPhrase = model.targetJobTitle
    ? `Applying for the ${model.targetJobTitle}${model.targetCompany ? ` role at ${model.targetCompany}` : " role"}${model.topMatchedTerms.length ? `. This experience includes ${joinNaturally(model.topMatchedTerms)}.` : "."}`
    : "";
  if (targetPhrase) {
    children.push(bodyParagraph(docxLib, targetPhrase, { spacing: { after: 90 } }));
  }
  children.push(bodyParagraph(docxLib, model.summary.line1, { spacing: { after: 90 } }));
  children.push(bodyParagraph(docxLib, model.summary.line2, { spacing: { after: 160 } }));

  // Core Competencies — true bulleted list items (bullet, bold heading,
  // then the items line), matching the original's actual structure
  // rather than one inline paragraph per group.
  children.push(sectionHeading(docxLib, "CORE COMPETENCIES"));
  model.competencies.forEach(group => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: group.heading + ": ", bold: true, font: FONT }),
        new TextRun({ text: group.items, font: FONT }),
      ],
      bullet: { level: 0 },
      spacing: { after: 60 },
    }));
  });

  // Professional Experience — company + dates on one line, date
  // right-aligned via a positional tab (per the docx skill's guidance
  // for this exact layout need), matching the original. Long company
  // names with a parenthetical qualifier (e.g. "X Pte Ltd (formerly Y)")
  // are split onto two lines, exactly like the original CV, so the
  // right-aligned date never collides with a long company name.
  children.push(sectionHeading(docxLib, "PROFESSIONAL EXPERIENCE"));
  model.experience.forEach(role => {
    children.push(new Paragraph({
      children: [new TextRun({ text: role.title, bold: true, font: FONT })],
      spacing: { before: 120 },
    }));

    const parenMatch = role.company.match(/^(.*?)\s*(\(.*\))$/);
    if (parenMatch) {
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: parenMatch[1], italics: true, size: 20, font: FONT }),
          new TextRun({ text: "\t", font: FONT }),
          new TextRun({ text: role.dates, italics: true, size: 20, font: FONT }),
        ],
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: parenMatch[2], italics: true, size: 20, font: FONT })],
        spacing: { after: 60 },
      }));
    } else {
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: role.company, italics: true, size: 20, font: FONT }),
          new TextRun({ text: "\t", font: FONT }),
          new TextRun({ text: role.dates, italics: true, size: 20, font: FONT }),
        ],
        spacing: { after: 60 },
      }));
    }

    role.bullets.forEach(b => {
      children.push(new Paragraph({
        children: [new TextRun({ text: b.text, font: FONT })],
        bullet: { level: 0 },
        spacing: { after: 50 },
      }));
    });
  });

  // Education
  children.push(sectionHeading(docxLib, "EDUCATION & QUALIFICATIONS"));
  model.education.forEach(e => {
    const text = e.date ? `${e.line} — ${e.date}` : e.line;
    children.push(new Paragraph({
      children: [new TextRun({ text, font: FONT })],
      bullet: { level: 0 },
      spacing: { after: 50 },
    }));
  });

  return new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children,
    }],
  });
}

function buildCoverLetterDocx(docxLib, model) {
  const { Document, Paragraph, TextRun } = docxLib;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Pick the top 3 most relevant bullets across all roles (already sorted
  // by relevance within tailorExperience) to reference concretely in the
  // letter body — real achievements, not invented ones.
  const topBullets = [];
  model.experience.forEach(role => {
    if (role.bullets.length > 0) topBullets.push(role.bullets[0].text);
  });

  const children = [];

  // Header — reuses the exact same name/color/rule treatment as the
  // resume so the two documents read as a matched set, per the request
  // that the cover letter follow the resume's layout.
  children.push(new Paragraph({
    children: [new TextRun({ text: model.candidateInfo.name.toUpperCase(), bold: true, size: 32, color: BRAND_COLOR, font: FONT })],
  }));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `${model.candidateInfo.location} | ${model.candidateInfo.phone} | ${model.candidateInfo.email} | ${model.candidateInfo.linkedin}`,
      size: 20, color: "444444", font: FONT,
    })],
    border: { bottom: { style: docxLib.BorderStyle.SINGLE, size: 4, space: 1, color: "auto" } },
    spacing: { after: 200 },
  }));

  children.push(bodyParagraph(docxLib, today, { spacing: { after: 200 } }));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `Re: Application for ${model.targetJobTitle}${model.targetCompany ? " at " + model.targetCompany : ""}`,
      bold: true, font: FONT,
    })],
    spacing: { after: 200 },
  }));
  children.push(bodyParagraph(docxLib, "Dear Hiring Manager,", { spacing: { after: 200 } }));

  // Job-specific opening sentence (same real, factual matched-terms
  // phrase used in the resume's profile section) followed by the fixed
  // summary sentence — again, real content reused, not fabricated.
  const openingSentence = model.targetJobTitle
    ? `I am writing to express my interest in the ${model.targetJobTitle} role${model.targetCompany ? " at " + model.targetCompany : ""}${model.topMatchedTerms.length ? `. My experience includes ${joinNaturally(model.topMatchedTerms)}, which fits well with what you are looking for.` : "."}`
    : "I am writing to express my interest in this role.";
  children.push(bodyParagraph(docxLib, openingSentence, { spacing: { after: 200 } }));
  children.push(bodyParagraph(docxLib, model.summary.line1, { spacing: { after: 200 } }));
  children.push(bodyParagraph(docxLib, "Highlights directly relevant to this role include:", { spacing: { after: 100 } }));

  topBullets.slice(0, 3).forEach(text => {
    children.push(new Paragraph({
      children: [new TextRun({ text, font: FONT })],
      bullet: { level: 0 },
      spacing: { after: 70 },
    }));
  });

  children.push(bodyParagraph(docxLib,
    "I would welcome the opportunity to discuss how this background can contribute to your team's objectives.",
    { spacing: { before: 200, after: 200 } }
  ));
  children.push(bodyParagraph(docxLib, "Sincerely,", { spacing: { after: 300 } }));
  children.push(bodyParagraph(docxLib, model.candidateInfo.name, {}));

  return new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      children,
    }],
  });
}

// Export for Node testing; in the browser these functions are simply
// available as globals within dashboard.html's inline <script>.
if (typeof module !== "undefined") {
  module.exports = {
    buildTailoredResumeModel,
    buildResumeDocx,
    buildCoverLetterDocx,
    tailorCompetencies,
    tailorExperience,
    findTopMatchedTerms,
  };
}

