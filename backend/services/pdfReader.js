// backend/services/pdfReader.js

import pdf from "pdf-parse";


// =====================================================
// READ PDF
// Compatible with the currently installed pdf-parse
// =====================================================

export const readPDF = async (buffer) => {

    try {

        console.log(
            "====================================="
        );

        console.log(
            "PDF READER STARTED"
        );

        console.log(
            "====================================="
        );


        // =================================================
        // VALIDATE BUFFER
        // =================================================

        if (!buffer) {

            throw new Error(
                "PDF buffer haipo."
            );

        }


        if (!Buffer.isBuffer(buffer)) {

            throw new Error(
                "PDF input si Buffer halali."
            );

        }


        console.log(
            "PDF BUFFER LENGTH:",
            buffer.length
        );


        if (buffer.length === 0) {

            throw new Error(
                "PDF buffer ni empty."
            );

        }


        // =================================================
        // VERIFY PDF HEADER
        // =================================================

        const header =
            buffer
                .subarray(0, 5)
                .toString("utf8");


        console.log(
            "PDF HEADER:",
            header
        );


        if (header !== "%PDF-") {

            throw new Error(
                "File iliyopokelewa si PDF halali."
            );

        }


        // =================================================
        // EXTRACT TEXT
        //
        // This is the pdf-parse v1 style API.
        // =================================================

        console.log(
            "EXTRACTING PDF TEXT..."
        );


        const data =
            await pdf(buffer);


        let text =
            data?.text || "";


        console.log(
            "RAW PDF TEXT LENGTH:",
            text.length
        );


        // =================================================
        // RETRY ON EMPTY TEXT
        // =================================================

        if (!text.trim()) {

            console.warn(
                "FIRST PDF EXTRACTION RETURNED EMPTY TEXT."
            );


            const retryBuffer =
                Buffer.from(buffer);


            const retryData =
                await pdf(
                    retryBuffer
                );


            text =
                retryData?.text || "";


            console.log(
                "RETRY PDF TEXT LENGTH:",
                text.length
            );

        }


        // =================================================
        // FAIL IF NO TEXT
        // =================================================

        if (!text.trim()) {

            throw new Error(
                "PDF text could not be extracted. " +
                "PDF inaweza kuwa scanned/image-only PDF " +
                "au parser imeshindwa kusoma maandishi."
            );

        }


        // =================================================
        // NORMALIZE LINE ENDINGS
        // =================================================

        text =
            text
                .replace(
                    /\r\n/g,
                    "\n"
                )
                .replace(
                    /\r/g,
                    "\n"
                )
                .replace(
                    /\u0000/g,
                    ""
                );


        // =================================================
        // NORMALIZE SPACES
        //
        // Keep line breaks so AI can detect questions.
        // =================================================

        text =
            text
                .split("\n")
                .map(
                    line =>
                        line
                            .replace(
                                /[ \t]+/g,
                                " "
                            )
                            .trim()
                )
                .filter(
                    Boolean
                )
                .join("\n");


        // =================================================
        // REMOVE PAGE NUMBER LINES
        // =================================================

        text =
            text.replace(
                /^\s*(?:Page|Pg\.?)\s*\d+\s*$/gim,
                ""
            );


        // =================================================
        // NORMALIZE QUESTION HEADINGS
        // =================================================

        text =
            text.replace(
                /\bQUESTION\s+(\d+)\s*\./gi,
                "QUESTION $1."
            );


        text =
            text.replace(
                /\bQuestion\s+(\d+)\s*\./gi,
                "QUESTION $1."
            );


        text =
            text.replace(
                /\bQ(?:uestion)?\.?\s*(\d+)\s*\./gi,
                "QUESTION $1."
            );


        // =================================================
        // NORMALIZE LETTER SUBQUESTIONS
        // =================================================

        text =
            text.replace(
                /\(\s*([a-z])\s*\)/gi,
                "($1)"
            );


        // =================================================
        // NORMALIZE ROMAN SUBQUESTIONS
        // =================================================

        text =
            text.replace(
                /\(\s*([ivxlcdm]+)\s*\)/gi,
                "($1)"
            );


        // =================================================
        // REMOVE EXCESSIVE EMPTY LINES
        // =================================================

        text =
            text
                .split("\n")
                .map(
                    line =>
                        line.trim()
                )
                .filter(
                    Boolean
                )
                .join("\n");


        // =================================================
        // FINAL VALIDATION
        // =================================================

        if (!text.trim()) {

            throw new Error(
                "PDF extraction imekamilika lakini hakuna text iliyobaki."
            );

        }


        console.log(
            "FINAL PDF TEXT LENGTH:",
            text.length
        );


        console.log(
            "PDF READER COMPLETED SUCCESSFULLY"
        );


        console.log(
            "====================================="
        );


        return text;


    } catch (error) {

        console.error(
            "====================================="
        );

        console.error(
            "PDF READER ERROR:"
        );

        console.error(
            error
        );

        console.error(
            "====================================="
        );


        throw error;

    }

};