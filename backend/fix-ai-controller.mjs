import fs from "fs";

const file = "controllers/ai.controller.js";
const backup = "controllers/ai.controller.js.before-ai-fix.js";

console.log("");
console.log("====================================================");
console.log("AFRICORE AI CONTROLLER SAFE REPAIR");
console.log("====================================================");
console.log("");

if (!fs.existsSync(file)) {
    throw new Error(
        `FILE NOT FOUND: ${file}`
    );
}

let code = fs.readFileSync(
    file,
    "utf8"
);

console.log(
    `Original file size: ${code.length} characters`
);

console.log(
    `Original file lines: ${code.split(/\r?\n/).length}`
);


// ============================================================
// 1. BACKUP ORIGINAL FILE
// ============================================================

fs.copyFileSync(
    file,
    backup
);

console.log(
    `Backup created: ${backup}`
);


// ============================================================
// 2. REMOVE THE BAD TOP-LEVEL "return res.status(200)"
//
// The previous repair accidentally placed an executable
// "return" outside analyzePaper(). That is what causes:
//
// SyntaxError: Illegal return statement
//
// We remove ONLY that accidentally inserted block.
// ============================================================

const analyzePaperMarker =
    "export const analyzePaper = async";

const analyzePaperIndex =
    code.indexOf(
        analyzePaperMarker
    );

if (analyzePaperIndex === -1) {
    throw new Error(
        "Could not find analyzePaper() in ai.controller.js. FILE NOT MODIFIED."
    );
}


// ------------------------------------------------------------
// Find suspicious top-level return before analyzePaper()
// ------------------------------------------------------------

const beforeAnalyze =
    code.slice(
        0,
        analyzePaperIndex
    );

const badReturnMarker =
    "return res.status(200).json({";

const badReturnIndex =
    beforeAnalyze.lastIndexOf(
        badReturnMarker
    );

if (badReturnIndex !== -1) {

    console.log("");
    console.log(
        "WARNING: Found illegal top-level return before analyzePaper()."
    );

    // --------------------------------------------------------
    // We only remove it when it is associated with the
    // previous AI-failure block.
    // --------------------------------------------------------

    const nearbyStart =
        Math.max(
            0,
            badReturnIndex - 2000
        );

    const nearby =
        beforeAnalyze.slice(
            nearbyStart,
            badReturnIndex + 5000
        );

    const looksLikeBadAIBlock =
        nearby.includes(
            "ai_failed"
        ) &&
        nearby.includes(
            "exam_paper_id"
        ) &&
        nearby.includes(
            "Examination paper uploaded successfully"
        );

    if (looksLikeBadAIBlock) {

        console.log(
            "Confirmed: removing accidental top-level AI failure block..."
        );

        const blockStart =
            beforeAnalyze.lastIndexOf(
                "/*",
                badReturnIndex
            );

        const ifStart =
            beforeAnalyze.lastIndexOf(
                "if (examPaperId)",
                badReturnIndex
            );

        let removeStart =
            ifStart !== -1
                ? ifStart
                : badReturnIndex;

        if (
            blockStart !== -1 &&
            blockStart > nearbyStart
        ) {
            removeStart =
                blockStart;
        }

        // ----------------------------------------------------
        // Locate the closing "}" of the if block.
        // We use the known block contents instead of blindly
        // deleting unrelated code.
        // ----------------------------------------------------

        const afterReturn =
            beforeAnalyze.slice(
                badReturnIndex
            );

        const closingPattern =
            /\n\s*}\s*\n/;

        const closingMatch =
            closingPattern.exec(
                afterReturn
            );

        if (!closingMatch) {
            throw new Error(
                "Could not safely locate the end of the illegal top-level return block. FILE NOT MODIFIED."
            );
        }

        const removeEnd =
            badReturnIndex +
            closingMatch.index +
            closingMatch[0].length;

        code =
            code.slice(
                0,
                removeStart
            ) +
            code.slice(
                removeEnd
            );

        console.log(
            "Illegal top-level return removed."
        );

    } else {

        console.log(
            "A return was found before analyzePaper(), but it did not match the AI block. Leaving it untouched."
        );
    }
}


// ============================================================
// 3. RE-CALCULATE analyzePaper POSITION
// ============================================================

const analyzeIndex =
    code.indexOf(
        analyzePaperMarker
    );

if (analyzeIndex === -1) {
    throw new Error(
        "analyzePaper() disappeared after cleanup. FILE NOT MODIFIED."
    );
}


// ============================================================
// 4. LOCATE THE analyzePaper CATCH BLOCK
//
// We locate:
//
// } catch (error) {
//
// after analyzePaper(), then replace ONLY the response
// section that currently converts AI failure into HTTP 500.
// ============================================================

const catchMarker =
    "} catch (error) {";

const catchIndex =
    code.indexOf(
        catchMarker,
        analyzeIndex
    );

if (catchIndex === -1) {
    throw new Error(
        "Could not find analyzePaper() catch block. FILE NOT MODIFIED."
    );
}

console.log("");
console.log(
    `analyzePaper() found at character ${analyzeIndex}`
);

console.log(
    `catch block found at character ${catchIndex}`
);


// ============================================================
// 5. LOCATE THE END OF THE CATCH BLOCK
//
// We count braces so that we modify the correct catch block,
// not another function.
// ============================================================

let depth = 0;
let catchEnd = -1;
let started = false;

for (
    let i = catchIndex;
    i < code.length;
    i++
) {

    const ch = code[i];

    if (ch === "{") {
        depth++;
        started = true;
    }

    if (ch === "}") {
        depth--;

        if (
            started &&
            depth === 0
        ) {
            catchEnd = i + 1;
            break;
        }
    }
}

if (catchEnd === -1) {
    throw new Error(
        "Could not determine the end of analyzePaper() catch block. FILE NOT MODIFIED."
    );
}


// ============================================================
// 6. READ ONLY THE CATCH BLOCK
// ============================================================

const catchBlock =
    code.slice(
        catchIndex,
        catchEnd
    );

console.log(
    `Catch block size: ${catchBlock.length} characters`
);


// ============================================================
// 7. VERIFY THAT THIS REALLY IS THE AI CONTROLLER CATCH
// ============================================================

if (
    !catchBlock.includes(
        "examPaperId"
    )
) {
    throw new Error(
        "The located catch block does not contain examPaperId. FILE NOT MODIFIED."
    );
}

if (
    !catchBlock.includes(
        "errorDetails"
    )
) {
    console.log(
        "Notice: errorDetails() was not found in this catch block."
    );
}


// ============================================================
// 8. FIND THE EXISTING HTTP STATUS RESPONSE
//
// We do NOT depend on exact indentation.
// ============================================================

const statusMarker =
    "const status";

const statusIndex =
    catchBlock.indexOf(
        statusMarker
    );

const httpStatusMarker =
    "const httpStatus";

const httpStatusIndex =
    catchBlock.indexOf(
        httpStatusMarker
    );

const responseMarker =
    "return res.status";

const responseIndex =
    catchBlock.lastIndexOf(
        responseMarker
    );

if (
    statusIndex === -1 ||
    httpStatusIndex === -1 ||
    responseIndex === -1
) {

    console.log("");
    console.log(
        "The expected old HTTP-status structure was not found."
    );

    console.log("");
    console.log(
        "The current catch block begins with:"
    );

    console.log(
        catchBlock.slice(
            0,
            Math.min(
                5000,
                catchBlock.length
            )
        )
    );

    throw new Error(
        "AI catch response structure is different from expected. FILE NOT MODIFIED."
    );
}


// ============================================================
// 9. FIND THE END OF THE EXISTING RESPONSE
// ============================================================

const responsePart =
    catchBlock.slice(
        responseIndex
    );

const responseEndMatch =
    responsePart.match(
        /\}\s*;\s*$/
    );

if (!responseEndMatch) {
    throw new Error(
        "Could not safely identify the end of the existing response. FILE NOT MODIFIED."
    );
}

const responseEnd =
    responseIndex +
    responseEndMatch.index +
    responseEndMatch[0].length;


// ============================================================
// 10. KEEP EVERYTHING BEFORE THE OLD HTTP RESPONSE
//     AND REPLACE ONLY THAT RESPONSE SECTION.
// ============================================================

const catchBeforeResponse =
    catchBlock.slice(
        0,
        statusIndex
    );

const newResponseSection = `
        // ----------------------------------------------------
        // IMPORTANT AI FAILURE HANDLING
        //
        // If examPaperId exists, the PDF has already been
        // successfully saved in exam_papers.
        //
        // Gemini quota/provider/parser errors must NOT turn
        // the successful PDF upload into HTTP 500.
        //
        // The paper remains stored for retry/manual work.
        // ----------------------------------------------------

        if (examPaperId) {

            return res.status(200).json({

                success: false,

                ai_failed: true,

                code:
                    error?.code ||
                    "AI_ANALYSIS_FAILED",

                message:
                    "Examination paper uploaded successfully, but AI analysis could not be completed.",

                user_message:
                    "Paper imehifadhiwa kikamilifu. AI analysis haikukamilika; unaweza kujaribu tena baadaye.",

                exam_id:
                    examId,

                exam_subject_id:
                    examSubjectId,

                exam_paper_id:
                    examPaperId,

            });

        }


        // ----------------------------------------------------
        // NO exam_paper_id
        //
        // This means the paper itself was not successfully
        // created. This remains a genuine HTTP error.
        // ----------------------------------------------------

        const status =
            Number(
                error?.status
            );

        const httpStatus =
            Number.isInteger(status) &&
            status >= 400 &&
            status <= 599
                ? status
                : 500;


        return res.status(
            httpStatus
        ).json({

            success: false,

            code:
                error?.code ||
                "AI_ANALYSIS_FAILED",

            message:
                error?.message ||
                "AI paper analysis failed.",

            error:
                errorDetails(
                    error
                ),

            exam_id:
                examId,

            exam_subject_id:
                examSubjectId,

            exam_paper_id:
                examPaperId,

        });
`;

const newCatchBlock =
    catchBeforeResponse +
    newResponseSection;


// ============================================================
// 11. REPLACE ONLY THE CATCH BLOCK
// ============================================================

code =
    code.slice(
        0,
        catchIndex
    ) +
    newCatchBlock +
    code.slice(
        catchEnd
    );


// ============================================================
// 12. WRITE FILE
// ============================================================

fs.writeFileSync(
    file,
    code,
    "utf8"
);

console.log("");
console.log(
    "===================================================="
);

console.log(
    "AI CONTROLLER FIX APPLIED SUCCESSFULLY"
);

console.log(
    "===================================================="
);

console.log(
    `File: ${file}`
);

console.log(
    `Backup: ${backup}`
);

console.log(
    `New file size: ${code.length} characters`
);

console.log(
    `New file lines: ${code.split(/\r?\n/).length}`
);

console.log("");

