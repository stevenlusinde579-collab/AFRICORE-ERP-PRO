// Extract only an explicitly printed whole-paper total. Do not infer a total
// from arbitrary question/section text; a missing declaration returns null.
const extractDeclaredTotalMarks = (pdfText) => {
    const text = String(pdfText || "").replace(/\s+/g, " ").trim();
    if (!text) return null;

    const patterns = [
        /\b(?:TOTAL\s+MARKS?|MAXIMUM\s+MARKS?|MAX\.?\s+MARKS?)\s*[:=\-]?\s*(\d{1,4})(?!\d)/i,
        /\bTOTAL\s*[:=\-]\s*(\d{1,4})\s*MARKS?\b/i,
        /\bTHIS\s+PAPER\s+(?:CARRIES|IS\s+WORTH|HAS)\s+(\d{1,4})\s+MARKS?\b/i,
        /\bTOTAL\s+OF\s+(\d{1,4})\s+MARKS?\b/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;

        const value = Number(match[1]);
        if (Number.isInteger(value) && value > 0 && value <= 10000) {
            return value;
        }
    }

    return null;
};

export { extractDeclaredTotalMarks };
