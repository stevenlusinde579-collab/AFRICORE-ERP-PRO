// Rule-Based analysis parity helpers.
// These helpers translate the paper-first requirements used by AI Analysis
// into deterministic, evidence-backed classification. They do not call Gemini.

const normalizeEvidenceText = (value) =>
    String(value || "").replace(/\s+/g, " ").trim();

const EDUCATION_LEVEL_PATTERNS = [
    {
        category: "early_childhood",
        label: "Early Childhood / Pre-Primary",
        patterns: [
            /\bbaby\s*class\b/i,
            /\bnursery\b/i,
            /\bpre[- ]?primary\b/i,
            /\bkindergarten\b|\bkg\b/i,
            /\bchekechea\b|\bawali\b/i,
        ],
    },
    {
        category: "primary",
        label: "Primary",
        patterns: [
            /\bprimary(?:\s+school)?\b/i,
            /\bshule\s+ya\s+msingi\b/i,
            /\bdarasa\s+la\s*(?:kwanza|pili|tatu|nne|tano|sita|saba|[1-7])\b/i,
            /\bstandard\s*(?:[1-7]|i{1,3}|iv|v|vi|vii)\b/i,
            /\bstd\.?\s*(?:[1-7]|i{1,3}|iv|v|vi|vii)\b/i,
        ],
    },
    {
        category: "advanced_secondary",
        label: "Advanced Secondary / A-Level",
        patterns: [
            /\badvanced\s*(?:level|certificate)?\b/i,
            /\ba[- ]?level\b|\bacsee\b/i,
            /\bform\s*(?:five|six|v|vi|5|6)\b/i,
            /\bkidato\s+cha\s+(?:tano|sita|5|6)\b/i,
        ],
    },
    {
        category: "ordinary_secondary",
        label: "Ordinary Secondary / O-Level",
        patterns: [
            /\bordinary\s*(?:level|secondary)?\b/i,
            /\bo[- ]?level\b|\bcsee\b/i,
            /\bform\s*(?:one|two|three|four|i{1,3}|iv|1|2|3|4)\b/i,
            /\bkidato\s+cha\s+(?:kwanza|pili|tatu|nne|1|2|3|4)\b/i,
            /\bsekondari\b/i,
        ],
    },
    {
        category: "vocational_or_tertiary",
        label: "Vocational / Technical / Post-Secondary",
        patterns: [
            /\bveta\b|\btvet\b|\bnta\s*(?:level)?\s*\d+\b/i,
            /\bcertificate\b|\bdiploma\b|\btechnician\b/i,
            /\bvocational\b|\btrade\s+test\b|\bartisan\b/i,
            /\bcollege\b|\buniversity\b|\bundergraduate\b/i,
            /\bbachelor(?:'s)?\b|\bdegree\b|\bpostgraduate\b|\bmaster(?:'s)?\b|\bphd\b/i,
        ],
    },
];

export const inferEducationProfile = ({
    level,
    subjectName,
    examName,
    examType,
    curriculum,
    pdfText,
} = {}) => {
    const metadata = normalizeEvidenceText([
        level, subjectName, examName, examType, curriculum,
    ].filter(Boolean).join(" "));
    const documentHeader = normalizeEvidenceText(String(pdfText || "").slice(0, 6000));
    const combined = metadata + " " + documentHeader;

    for (const profile of EDUCATION_LEVEL_PATTERNS) {
        const matched = profile.patterns.find((pattern) => pattern.test(combined));
        if (matched) {
            return {
                category: profile.category,
                label: profile.label,
                confidence: "evidence_detected",
                evidence: matched.source,
                metadata_level: normalizeEvidenceText(level) || null,
            };
        }
    }

    return {
        category: "unclassified",
        label: "Unclassified education level",
        confidence: "insufficient_evidence",
        evidence: null,
        metadata_level: normalizeEvidenceText(level) || null,
    };
};

// Broad structural format classification. This deliberately avoids inferring
// an answer key or assigning marks from question wording alone.
export const classifyQuestionFormat = (value) => {
    const text = String(value || "").toLowerCase();

    if (/\b(match|matching|pair|column\s*a|column\s*b|list\s*a|list\s*b|oanisha)\b/.test(text)) return "Matching";
    if (/\b(multiple[- ]choice|choose the correct|select the correct|tick the correct|circle the correct|chagua jibu|chagua herufi)\b/.test(text)) return "Objective";
    if (/\b(fill in the blank|complete the sentence|missing word|jaza nafasi)\b/.test(text)) return "Fill-in";
    if (/\b(true or false|write true|write false|kweli au si kweli)\b/.test(text)) return "True/False";
    if (/\b(trace|tracing|copy the letter|andika herufi)\b/.test(text)) return "Tracing/Writing";
    if (/\b(colour|color|shade the|rangi|paka rangi)\b/.test(text)) return "Colouring";
    if (/\b(identify the picture|name the picture|look at the picture|recognise the object|tazama picha|taja picha)\b/.test(text)) return "Picture Identification";
    if (/\b(listen|oral|pronounce|dictation|sikiliza|tamka|matamshi)\b/.test(text)) return "Oral/Listening";
    if (/\b(draw|sketch|label the diagram|illustrate)\b/.test(text)) return "Diagram";
    if (/\b(calculate|solve|compute|find the value|work out|hesabu)\b/.test(text)) return "Calculation";
    if (/\b(experiment|practical|laboratory|measure|observe|demonstrate)\b/.test(text)) return "Practical/Experiment";
    if (/\b(explain|describe|discuss|analyse|analyze|compare|evaluate|justify|assess)\b/.test(text)) return "Structured/Essay";
    return null; // Preserve the existing subject-aware Rule-Based fallback for unclassified wording.
};
