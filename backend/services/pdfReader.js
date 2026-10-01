// backend/services/pdfReader.js

import pdf from "pdf-parse";


// ============================================================
// PDF READER
// VERSION: STRUCTURE-PRESERVING-V2
//
// Purpose:
// 1. Preserve page boundaries
// 2. Preserve question numbering
// 3. Preserve line structure
// 4. Preserve approximate PDF text positions
// 5. Reduce damage caused by aggressive normalization
// 6. Detect weak / empty PDF extraction
// 7. Remain compatible with pdf-parse v1 style API
// ============================================================


const PDF_READER_VERSION =
    "STRUCTURE-PRESERVING-V2";


// ============================================================
// SAFE TEXT
// ============================================================

const safeText = (
    value
) => {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value);

};


// ============================================================
// NORMALIZE LINE
//
// IMPORTANT:
// Do NOT aggressively remove spaces.
// Spaces can be meaningful in examination papers,
// especially for options, marks and tables.
// ============================================================

const normalizeLine = (
    value
) => {

    return safeText(value)

        .replace(
            /\u0000/g,
            ""
        )

        .replace(
            /\r\n/g,
            "\n"
        )

        .replace(
            /\r/g,
            "\n"
        )

        // Convert unusual whitespace to normal spaces
        .replace(
            /[ \t]+/g,
            " "
        )

        .trim();

};


// ============================================================
// NORMALIZE QUESTION HEADINGS
// ============================================================

const normalizeQuestionHeadings = (
    text
) => {

    let output =
        safeText(text);


    // QUESTION 1.
    output =
        output.replace(
            /\bQUESTION\s+(\d+)\s*[\.\-:]?/gi,
            "QUESTION $1."
        );


    // Question 1.
    output =
        output.replace(
            /\bQ(?:uestion)?\.?\s*(\d+)\s*[\.\-:]/gi,
            "QUESTION $1."
        );


    // Do NOT convert every "1." in the paper.
    //
    // This is intentional.
    //
    // A line such as:
    // 1. Explain...
    //
    // must remain intact because it may be a main question.
    //
    // V10 performs the actual structural grouping.


    return output;

};


// ============================================================
// NORMALIZE SUB-QUESTIONS
// ============================================================

const normalizeSubQuestions = (
    text
) => {

    let output =
        safeText(text);


    // ( a ) -> (a)
    output =
        output.replace(
            /\(\s*([a-z])\s*\)/gi,
            "($1)"
        );


    // ( i ) -> (i)
    output =
        output.replace(
            /\(\s*(i{1,3}|iv|vi{0,3}|ix|x)\s*\)/gi,
            "($1)"
        );


    return output;

};


// ============================================================
// CLEAN EXTRACTED TEXT
//
// IMPORTANT:
// No aggressive line merging.
// No removal of potentially useful spaces.
// ============================================================

const cleanExtractedText = (
    rawText
) => {

    let text =
        safeText(rawText);


    // Normalize line endings
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


    // Normalize each line independently
    const lines =
        text
            .split("\n")
            .map(
                normalizeLine
            );


    // Remove only clearly useless page-number-only lines.
    const filtered =
        lines.filter(
            line => {

                if (
                    !line
                ) {
                    return false;
                }


                // Page 1
                if (
                    /^\s*(?:Page|Pg\.?)\s+\d+\s*$/i.test(
                        line
                    )
                ) {
                    return false;
                }


                return true;

            }
        );


    text =
        filtered.join("\n");


    text =
        normalizeQuestionHeadings(
            text
        );


    text =
        normalizeSubQuestions(
            text
        );


    return text;

};


// ============================================================
// EXTRACT TEXT USING PDF.JS TEXT ITEMS
//
// This preserves approximate x/y positions.
// It is much safer for examination papers than simply
// trusting one flattened text string.
// ============================================================

const renderPageWithStructure =
    async (
        pageData
    ) => {

        const content =
            await pageData.getTextContent(
                {
                    normalizeWhitespace: false,
                    disableCombineTextItems: false
                }
            );


        const items =
            Array.isArray(
                content?.items
            )
                ? content.items
                : [];


        if (
            items.length === 0
        ) {
            return "";
        }


        const positionedItems =
            items
                .map(
                    (
                        item,
                        index
                    ) => {

                        const str =
                            safeText(
                                item?.str
                            );


                        if (
                            !str
                        ) {
                            return null;
                        }


                        const transform =
                            Array.isArray(
                                item?.transform
                            )
                                ? item.transform
                                : [];


                        const x =
                            Number(
                                transform?.[4] ?? 0
                            );


                        const y =
                            Number(
                                transform?.[5] ?? 0
                            );


                        const fontHeight =
                            Math.abs(
                                Number(
                                    transform?.[3] ?? 0
                                )
                            ) || 10;


                        const width =
                            Number(
                                item?.width ?? 0
                            );


                        return {

                            str,

                            x,

                            y,

                            width,

                            fontHeight,

                            index

                        };

                    }
                )
                .filter(
                    Boolean
                );


        if (
            positionedItems.length === 0
        ) {
            return "";
        }


        // ====================================================
        // GROUP ITEMS INTO VISUAL LINES
        //
        // PDF coordinates have origin at bottom-left,
        // therefore higher Y comes before lower Y.
        // ====================================================

        const sorted =
            [...positionedItems].sort(
                (
                    a,
                    b
                ) => {

                    if (
                        Math.abs(
                            a.y - b.y
                        ) > 2.5
                    ) {
                        return b.y - a.y;
                    }


                    return a.x - b.x;

                }
            );


        const lines = [];


        for (
            const item of sorted
        ) {

            let target =
                null;


            // Find an existing line with approximately
            // the same vertical position.
            for (
                let i = 0;
                i < lines.length;
                i++
            ) {

                const line =
                    lines[i];


                if (
                    Math.abs(
                        line.y - item.y
                    ) <= Math.max(
                        2.5,
                        Math.min(
                            line.fontHeight,
                            item.fontHeight
                        ) * 0.35
                    )
                ) {

                    target =
                        line;

                    break;

                }

            }


            if (
                !target
            ) {

                target = {

                    y: item.y,

                    fontHeight:
                        item.fontHeight,

                    items: []

                };


                lines.push(
                    target
                );

            }


            target.items.push(
                item
            );

        }


        // ====================================================
        // SORT LINES TOP -> BOTTOM
        // ====================================================

        lines.sort(
            (
                a,
                b
            ) => b.y - a.y
        );


        // ====================================================
        // BUILD READABLE TEXT
        // ====================================================

        const outputLines = [];


        for (
            const line of lines
        ) {

            line.items.sort(
                (
                    a,
                    b
                ) => a.x - b.x
            );


            let lineText =
                "";


            let previousRight =
                null;


            for (
                const item of line.items
            ) {

                const currentX =
                    item.x;


                const itemText =
                    item.str;


                if (
                    !lineText
                ) {

                    lineText =
                        itemText;

                } else {

                    const gap =
                        previousRight === null
                            ? 0
                            : currentX -
                              previousRight;


                    // Preserve meaningful visual gaps.
                    //
                    // Large gap can represent:
                    // - question marks
                    // - answer spaces
                    // - columns
                    // - option separation
                    //
                    // But do not create hundreds of spaces.

                    if (
                        gap > 12
                    ) {

                        lineText +=
                            "    ";

                    } else if (
                        gap > 2
                    ) {

                        lineText +=
                            " ";

                    }


                    lineText +=
                        itemText;

                }


                previousRight =
                    currentX +
                    Math.max(
                        0,
                        item.width
                    );

            }


            lineText =
                normalizeLine(
                    lineText
                );


            if (
                lineText
            ) {

                outputLines.push(
                    lineText
                );

            }

        }


        return outputLines.join(
            "\n"
        );

    };


// ============================================================
// DEFAULT PDF-PARSE EXTRACTION
//
// Used as fallback and also as a comparison source.
// ============================================================

const extractDefaultText =
    async (
        buffer
    ) => {

        const data =
            await pdf(
                buffer
            );


        return safeText(
            data?.text
        );

    };


// ============================================================
// STRUCTURED PDF-PARSE EXTRACTION
// ============================================================

const extractStructuredText =
    async (
        buffer
    ) => {

        const data =
            await pdf(
                buffer,
                {
                    pagerender:
                        renderPageWithStructure
                }
            );


        return safeText(
            data?.text
        );

    };


// ============================================================
// QUESTION NUMBER DETECTION
//
// This does NOT decide final question structure.
// It only measures whether extraction contains useful
// question evidence.
// ============================================================

const detectQuestionNumbers =
    (
        text
    ) => {

        const numbers =
            new Set();


        const value =
            safeText(text);


        // QUESTION 1.
        const explicit =
            value.matchAll(
                /\bQUESTION\s+(\d{1,2})\b/gi
            );


        for (
            const match of explicit
        ) {

            const number =
                Number(
                    match?.[1]
                );


            if (
                Number.isInteger(number) &&
                number > 0 &&
                number <= 100
            ) {

                numbers.add(
                    number
                );

            }

        }


        // Lines beginning with:
        // 1.
        // 2)
        // 3:
        //
        // We only use these for scoring,
        // not final grouping.

        const lines =
            value.split("\n");


        for (
            const line of lines
        ) {

            const match =
                line.match(
                    /^\s*(\d{1,2})\s*[\.\):\-]\s+/
                );


            if (
                !match
            ) {
                continue;
            }


            const number =
                Number(
                    match[1]
                );


            if (
                Number.isInteger(number) &&
                number > 0 &&
                number <= 100
            ) {

                numbers.add(
                    number
                );

            }

        }


        return [
            ...numbers
        ].sort(
            (
                a,
                b
            ) => a - b
        );

    };


// ============================================================
// EXTRACTION QUALITY SCORE
//
// We compare default extraction against structured extraction.
// ============================================================

const scoreExtraction =
    (
        text
    ) => {

        const value =
            safeText(text);


        if (
            !value.trim()
        ) {
            return 0;
        }


        const lengthScore =
            Math.min(
                40,
                value.length / 500
            );


        const lines =
            value
                .split("\n")
                .filter(
                    line =>
                        line.trim()
                );


        const lineScore =
            Math.min(
                20,
                lines.length / 5
            );


        const questionNumbers =
            detectQuestionNumbers(
                value
            );


        const questionScore =
            Math.min(
                30,
                questionNumbers.length * 3
            );


        const mainQuestionSequenceScore =
            hasReasonableQuestionSequence(
                questionNumbers
            )
                ? 10
                : 0;


        return (
            lengthScore +
            lineScore +
            questionScore +
            mainQuestionSequenceScore
        );

    };


// ============================================================
// QUESTION SEQUENCE CHECK
// ============================================================

const hasReasonableQuestionSequence =
    (
        numbers
    ) => {

        if (
            !Array.isArray(numbers) ||
            numbers.length < 2
        ) {
            return false;
        }


        let consecutive =
            0;


        for (
            let i = 1;
            i < numbers.length;
            i++
        ) {

            if (
                numbers[i] ===
                numbers[i - 1] + 1
            ) {

                consecutive++;

            }

        }


        return (
            consecutive >= 1
        );

    };


// ============================================================
// ADD PAGE BOUNDARIES
//
// If structured extraction contains form-feed characters,
// convert them into explicit page markers.
//
// If the parser does not expose pages separately,
// the markers are not invented.
// ============================================================

const normalizePageBoundaries =
    (
        text
    ) => {

        return safeText(text)

            .replace(
                /\f+/g,
                "\n\n--- PDF PAGE BREAK ---\n\n"
            );

    };


// ============================================================
// PROTECT IMPORTANT SPACING
// ============================================================

const finalClean =
    (
        text
    ) => {

        let output =
            normalizePageBoundaries(
                text
            );


        output =
            cleanExtractedText(
                output
            );


        // Restore a clear page marker if normalization
        // touched it.
        output =
            output.replace(
                /---\s*PDF\s+PAGE\s+BREAK\s*---/gi,
                "--- PDF PAGE BREAK ---"
            );


        // Remove only repeated blank lines.
        output =
            output.replace(
                /\n{3,}/g,
                "\n\n"
            );


        return output.trim();

    };


// ============================================================
// READ PDF
// ============================================================

export const readPDF =
    async (
        buffer
    ) => {

        try {

            console.log(
                "============================================================"
            );

            console.log(
                "PDF READER STARTED"
            );

            console.log(
                "PDF READER VERSION:",
                PDF_READER_VERSION
            );

            console.log(
                "============================================================"
            );


            // =================================================
            // VALIDATE BUFFER
            // =================================================

            if (
                !buffer
            ) {

                throw new Error(
                    "PDF buffer haipo."
                );

            }


            if (
                !Buffer.isBuffer(buffer)
            ) {

                throw new Error(
                    "PDF input si Buffer halali."
                );

            }


            console.log(
                "PDF BUFFER LENGTH:",
                buffer.length
            );


            if (
                buffer.length === 0
            ) {

                throw new Error(
                    "PDF buffer ni empty."
                );

            }


            // =================================================
            // VERIFY PDF HEADER
            // =================================================

            const header =
                buffer
                    .subarray(
                        0,
                        5
                    )
                    .toString(
                        "utf8"
                    );


            console.log(
                "PDF HEADER:",
                header
            );


            if (
                header !== "%PDF-"
            ) {

                throw new Error(
                    "File iliyopokelewa si PDF halali."
                );

            }


            // =================================================
            // DEFAULT EXTRACTION
            // =================================================

            console.log(
                "EXTRACTING DEFAULT PDF TEXT..."
            );


            let defaultText =
                "";


            try {

                defaultText =
                    await extractDefaultText(
                        buffer
                    );

            } catch (
                defaultError
            ) {

                console.warn(
                    "DEFAULT PDF EXTRACTION FAILED:",
                    defaultError?.message ||
                    defaultError
                );

            }


            console.log(
                "DEFAULT PDF TEXT LENGTH:",
                defaultText.length
            );


            // =================================================
            // STRUCTURED EXTRACTION
            // =================================================

            console.log(
                "EXTRACTING STRUCTURED PDF TEXT..."
            );


            let structuredText =
                "";


            try {

                structuredText =
                    await extractStructuredText(
                        buffer
                    );

            } catch (
                structuredError
            ) {

                console.warn(
                    "STRUCTURED PDF EXTRACTION FAILED:",
                    structuredError?.message ||
                    structuredError
                );

            }


            console.log(
                "STRUCTURED PDF TEXT LENGTH:",
                structuredText.length
            );


            // =================================================
            // CLEAN CANDIDATES
            // =================================================

            const cleanedDefault =
                finalClean(
                    defaultText
                );


            const cleanedStructured =
                finalClean(
                    structuredText
                );


            // =================================================
            // SCORE BOTH EXTRACTIONS
            // =================================================

            const defaultScore =
                scoreExtraction(
                    cleanedDefault
                );


            const structuredScore =
                scoreExtraction(
                    cleanedStructured
                );


            const defaultQuestions =
                detectQuestionNumbers(
                    cleanedDefault
                );


            const structuredQuestions =
                detectQuestionNumbers(
                    cleanedStructured
                );


            console.log(
                "DEFAULT EXTRACTION SCORE:",
                defaultScore
            );


            console.log(
                "STRUCTURED EXTRACTION SCORE:",
                structuredScore
            );


            console.log(
                "DEFAULT DETECTED QUESTIONS:",
                defaultQuestions
            );


            console.log(
                "STRUCTURED DETECTED QUESTIONS:",
                structuredQuestions
            );


            // =================================================
            // SELECT EXTRACTION
            //
            // Structured extraction gets preference when it
            // contains stronger question evidence.
            //
            // This prevents a badly flattened PDF from being
            // blindly sent to Gemini.
            // =================================================

            let finalText =
                "";


            if (
                structuredScore >
                0 &&
                (
                    structuredScore >=
                    defaultScore
                )
            ) {

                finalText =
                    cleanedStructured;


                console.log(
                    "SELECTED EXTRACTION: STRUCTURED"
                );

            } else {

                finalText =
                    cleanedDefault;


                console.log(
                    "SELECTED EXTRACTION: DEFAULT"
                );

            }


            // =================================================
            // FALLBACK
            // =================================================

            if (
                !finalText.trim()
            ) {

                if (
                    cleanedStructured.trim()
                ) {

                    finalText =
                        cleanedStructured;

                } else if (
                    cleanedDefault.trim()
                ) {

                    finalText =
                        cleanedDefault;

                }

            }


            // =================================================
            // FINAL VALIDATION
            // =================================================

            if (
                !finalText.trim()
            ) {

                throw new Error(
                    "PDF text could not be extracted. " +
                    "PDF inaweza kuwa scanned/image-only PDF " +
                    "au parser imeshindwa kusoma maandishi."
                );

            }


            const finalQuestions =
                detectQuestionNumbers(
                    finalText
                );


            console.log(
                "FINAL PDF TEXT LENGTH:",
                finalText.length
            );


            console.log(
                "FINAL DETECTED QUESTION NUMBERS:",
                finalQuestions
            );


            console.log(
                "FINAL QUESTION COUNT:",
                finalQuestions.length
            );


            // =================================================
            // IMPORTANT WARNING
            //
            // Do not fail the PDF merely because question
            // numbers were not detected.
            //
            // Some legitimate papers use unusual formatting.
            // V10 remains responsible for final structural
            // reconciliation.
            // =================================================

            if (
                finalQuestions.length === 0
            ) {

                console.warn(
                    "WARNING: NO QUESTION NUMBERS DETECTED IN PDF TEXT."
                );

            }


            // =================================================
            // FINAL PREVIEW
            // =================================================

            console.log(
                "PDF TEXT PREVIEW:"
            );


            console.log(
                finalText
                    .slice(
                        0,
                        2500
                    )
            );


            console.log(
                "============================================================"
            );

            console.log(
                "PDF READER COMPLETED SUCCESSFULLY"
            );

            console.log(
                "============================================================"
            );


            return finalText;

        } catch (
            error
        ) {

            console.error(
                "============================================================"
            );

            console.error(
                "PDF READER ERROR:"
            );

            console.error(
                error
            );

            console.error(
                "============================================================"
            );


            throw error;

        }

    };


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default readPDF;