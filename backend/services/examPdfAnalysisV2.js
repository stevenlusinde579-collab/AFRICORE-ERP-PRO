import readPDF from "./pdfReader.js";
import { analyzeExaminationV2 } from "./examAnalysisV2.js";

/**
 * V2 PDF entry point. It deliberately disables OCR so this first release only
 * evaluates selectable-text PDFs and cannot silently change scanned-PDF flow.
 */
export const analyzeExamPdfV2 = async ({
    buffer,
    level = "",
    subject = "",
    options = {},
    readPdf = readPDF,
} = {}) => {
    if (!buffer) throw new TypeError("A PDF buffer is required for V2 analysis.");
    const text = await readPdf(buffer, { ...options, enableOcr: false });
    const result = analyzeExaminationV2({ text: String(text || ""), level, subject });
    return {
        ...result,
        input: {
            type: "selectable_pdf_text",
            ocr_used: false,
            extracted_characters: String(text || "").length,
        },
    };
};

export default analyzeExamPdfV2;
