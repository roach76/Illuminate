"""
resume_data.py — Roy Wong's resume content as structured data.

CRITICAL: every string of substance in here (bullets, titles, dates,
figures) is copied verbatim from Roy_Wong_CV_190826.docx. Nothing is
invented, exaggerated, or reworded for effect. The only thing this module
adds beyond the source document is `tags` per bullet — keywords used to
decide which real bullets to lead with for a given job description. The
tags never change what a bullet claims, only which real, already-true
bullets get emphasized first.

If Roy's CV is updated, update this file to match — search for the
CANDIDATE_INFO / SUMMARY_VARIANTS / EXPERIENCE / EDUCATION sections below.
"""

CANDIDATE_INFO = {
    "name": "Roy Wong",
    "tagline": "Customer Success Director | Service Delivery Director | Regional Operations Leader",
    "location": "Singapore",
    "phone": "+65 9789 7660",
    "email": "Roy5818@gmail.com",
    "linkedin": "linkedin.com/in/royljwong",
}

# The base executive profile, verbatim from the CV. Used as-is when no
# stronger job-specific angle is warranted.
BASE_SUMMARY = (
    "Customer Success, Service Delivery, and Regional Operations leader with 15+ years "
    "scaling enterprise customer organizations across ASEAN for global healthcare "
    "technology. Advanced from GE Product Specialist to regional director by building "
    "commercial HCIS leadership at Philips, then returned to GE to own Customer Success, "
    "Service Delivery, Professional Services, and CX across 6 ASEAN markets and a "
    "seven-figure renewal portfolio."
)

BASE_SUMMARY_LINE_2 = (
    "Lifted enterprise renewals from 35% to 60%, grew service attach from 30% to 70%, "
    "and delivered 22 consecutive quarters of plan attainment."
)

# Core Competencies — verbatim groupings from the CV, each with a tag set
# used to decide which groups to surface first for a given JD.
CORE_COMPETENCIES = [
    {
        "heading": "Customer Success & Experience",
        "items": "Strategy & Operating Models • Customer Journey & Lifecycle Management • "
                 "Health Scoring & Monitoring • EBRs/QBRs • Renewal & Retention Strategies • "
                 "VoC & Customer Advocacy.",
        "tags": ["customer success", "customer experience", "cx", "ebr", "qbr", "voc",
                 "customer advocacy", "retention", "renewal", "customer journey"],
    },
    {
        "heading": "Customer Growth & Retention",
        "items": "Gross Revenue Retention (GRR) • Net Revenue Retention (NRR) • Churn Prevention • "
                 "Expansion Pipeline • Customer Onboarding • Time-to-Value • Adoption & Utilization • "
                 "CSAT/NPS.",
        "tags": ["grr", "nrr", "gross revenue retention", "net revenue retention", "churn",
                 "expansion", "onboarding", "time-to-value", "adoption", "csat", "nps"],
    },
    {
        "heading": "Service Delivery & Operations",
        "items": "Regional Operations • Service Governance • SLA/KPI Management • "
                 "Continuous Improvement • Risk Management • Operating Model Design.",
        "tags": ["service delivery", "regional operations", "sla", "kpi", "governance",
                 "continuous improvement", "risk management", "operating model"],
    },
    {
        "heading": "Commercial Leadership",
        "items": "Contract Renewals & Forecasting • Account Expansion • Cross-functional Leadership • "
                 "Executive Stakeholder Management • Regional Leadership.",
        "tags": ["contract renewal", "forecasting", "account expansion", "cross-functional",
                 "stakeholder management", "regional leadership", "commercial"],
    },
    {
        "heading": "Platforms & Technology",
        "items": "Salesforce CRM • ServiceMax • Microsoft Visio • BI & Reporting Tools.",
        "tags": ["salesforce", "servicemax", "visio", "bi", "reporting tools", "crm"],
    },
]

# Professional experience — every bullet verbatim from the CV, tagged.
EXPERIENCE = [
    {
        "title": "Head, Customer Services, Solutions for Enterprise Imaging (SEI), ASEAN",
        "company": "GE Healthcare Pte Ltd",
        "dates": "Sep 2020 - May 2026",
        "bullets": [
            {
                "text": "Directed Customer Success, Service Delivery, Professional Services, and CX "
                        "across 6 ASEAN countries for the enterprise digital imaging portfolio.",
                "tags": ["customer success", "service delivery", "professional services", "cx",
                         "asean", "regional leadership"],
            },
            {
                "text": "Designed and led a regional Customer Success operating model, introducing "
                        "EBRs, customer-health monitoring, and adoption metrics to improve renewal "
                        "predictability across a USD 4M+ annual portfolio.",
                "tags": ["customer success", "operating model", "ebr", "customer health",
                         "adoption", "renewal", "portfolio"],
            },
            {
                "text": "Elevated enterprise contract renewals from 35% to 60% and expanded service "
                        "attach from 30% to 70% by aligning Channel Partners, Sales, and Commercial "
                        "Operations.",
                "tags": ["contract renewal", "renewal", "service attach", "cross-functional",
                         "commercial", "sales alignment"],
            },
            {
                "text": "Established strategic governance forums with CIOs, CMIOs, and hospital "
                        "C-suites across 6 markets, deepening executive account relationships and "
                        "anchoring long-term customer value realization.",
                "tags": ["governance", "c-suite", "stakeholder management", "executive",
                         "healthcare", "customer value"],
            },
            {
                "text": "Standardized regional service controls to achieve zero SLA breaches and "
                        "zero major disruptions across 10 consecutive quarters, while sustaining a "
                        "95%+ First-Time Fix rate without escalation.",
                "tags": ["sla", "service governance", "escalation", "first-time fix",
                         "continuous improvement", "risk management"],
            },
            {
                "text": "Built and mentored a regional team of 20 professionals across 6 markets, "
                        "maintaining 100% employee retention across 5+ years through coaching and "
                        "succession planning.",
                "tags": ["team leadership", "regional team", "multi-country", "people management",
                         "coaching", "succession planning"],
            },
        ],
    },
    {
        "title": "Business Manager, Healthcare Information Systems (HCIS), ASEAN",
        "company": "Philips Electronics Singapore Pte Ltd (formerly Carestream Health Singapore Pte Ltd)",
        "dates": "Mar 2017 – Dec 2019",
        "bullets": [
            {
                "text": "Led HCIS strategy across 9 ASEAN markets, managing a USD 4M+ portfolio and "
                        "supporting the transition from Carestream to Philips following acquisition.",
                "tags": ["strategy", "asean", "portfolio", "healthcare it", "hcis",
                         "change management"],
            },
            {
                "text": "Directed regional strategy for a portfolio above USD 4M; optimized pricing "
                        "models and competitive positioning to improve forecasting accuracy to 90% "
                        "and grow revenue 15-20% over 3 years.",
                "tags": ["strategy", "forecasting", "pricing", "revenue growth", "portfolio"],
            },
            {
                "text": "Formulated go-to-market, customer enablement, and adoption strategies "
                        "aligning Sales, Product, and Customer Success, accelerating software "
                        "consumption 20-30% over 3 years across enterprise accounts.",
                "tags": ["go-to-market", "customer success", "adoption", "cross-functional",
                         "enterprise accounts"],
            },
            {
                "text": "Represented the business at regional executive forums and healthcare "
                        "conferences, expanding executive relationships with healthcare providers "
                        "and regulatory bodies.",
                "tags": ["executive", "stakeholder management", "healthcare", "regional"],
            },
        ],
    },
    {
        "title": "Product Specialist, Healthcare IT (HCIT), ASEAN",
        "company": "GE Healthcare Pte Ltd",
        "dates": "Oct 2014 – Feb 2017",
        "bullets": [
            {
                "text": "Managed 8 enterprise accounts in Singapore, collaborating with Sales and "
                        "Professional Services to drive post implementation adoption and solution "
                        "utilization for a six-figure portfolio.",
                "tags": ["account management", "professional services", "adoption",
                         "enterprise accounts"],
            },
            {
                "text": "Built Voice of Customer (VoC) feedback frameworks through advisory forums "
                        "and customer engagements, directly influencing regional product updates "
                        "and service delivery enhancements.",
                "tags": ["voc", "customer advocacy", "service delivery", "product feedback"],
            },
            {
                "text": "Won 90% of tenders participated in, with total contract value reaching "
                        "eight figures, expanding GE's footprint in Singapore's public and private "
                        "healthcare sectors.",
                "tags": ["tenders", "healthcare", "public sector", "contract value"],
            },
        ],
    },
    {
        "title": "Applications Manager",
        "company": "Integrated Health Information Systems Pte Ltd",
        "dates": "Feb 2011 – Sep 2014",
        "bullets": [
            {
                "text": "Led a team of 5 functional analysts supporting enterprise healthcare "
                        "applications across public healthcare institutions.",
                "tags": ["team leadership", "healthcare it", "public sector"],
            },
            {
                "text": "Designed cluster-wide RFPs and served on evaluation committees for "
                        "nationwide RFQs and RFPs, supporting application modernization and "
                        "large-scale digital transformation programs.",
                "tags": ["rfp", "public sector", "digital transformation"],
            },
        ],
    },
]

EDUCATION = [
    {"line": "Applied AI and Data Analytics – RISE 2.0, Boston Consulting Group", "date": "Expected Oct 2026"},
    {"line": "Bachelor of Business — Marketing & Management, Monash University", "date": ""},
    {"line": "Bachelor of Computing — System Development, Monash University", "date": ""},
    {"line": "Diploma in Information Technology – Temasek Polytechnic", "date": ""},
]
