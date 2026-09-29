// =====================================================
// ANALYZE EXAM PAPER
// =====================================================

export const analyzeExamPaper = async (text) => {

    // =================================================
    // VALIDATE TEXT
    // =================================================

    if (!text || typeof text !== "string") {
        throw new Error(
            "No PDF text found"
        );
    }


    // =================================================
    // CLEAN TEXT
    // =================================================

    const cleanText = text
        .replace(/\r/g, " ")
        .replace(/\n+/g, "\n")
        .trim();


    if (!cleanText) {
        throw new Error(
            "PDF text is empty"
        );
    }


    // =================================================
    // DETECT MAIN QUESTIONS
    //
    // Supports:
    //
    // Question 1
    // 1.
    // 1)
    // 1 -
    // 1:
    //
    // Also supports question numbers appearing
    // at the beginning of a line.
    // =================================================

    const questionPattern =
        /(?:^|\n)\s*(?:Question\s*)?(\d{1,3})\s*[\.\):\-]\s+(?!\d)/gi;


    const questionMatches = [
        ...cleanText.matchAll(
            questionPattern
        )
    ];


    const totalQuestions =
        questionMatches.length;


    // =================================================
    // ANALYZE EACH QUESTION
    // =================================================

    const questionAnalysis = [];


    for (
        let i = 0;
        i < questionMatches.length;
        i++
    ) {

        const start =
            questionMatches[i].index;


        const end =
            questionMatches[i + 1]
                ? questionMatches[i + 1].index
                : cleanText.length;


        const questionText =
            cleanText.substring(
                start,
                end
            ).trim();


        // =================================================
        // COUNT QUESTION PARTS
        //
        // Supports:
        //
        // (a)
        // (b)
        // (c)
        //
        // a)
        // b)
        //
        // (i)
        // (ii)
        // =================================================

        const parts = [
            ...questionText.matchAll(
                /(?:\([a-z]\)|\b[a-z]\)|\([ivxlcdm]+\))/gi
            )
        ];


        // =================================================
        // EXTRACT QUESTION NUMBER
        // =================================================

        const questionNumber =
            Number(
                questionMatches[i][1]
            );


        // =================================================
        // EXTRACT MAXIMUM MARKS
        //
        // This is the maximum mark belonging to
        // this main question.
        // =================================================

        const maxMarks =
            extractMarks(
                questionText
            );


        // =================================================
        // DETECT SELECTIVE QUESTION
        //
        // Examples:
        //
        // Answer any 3
        // Attempt any 4
        // Choose any 2
        // Select any 5
        // Answer THREE questions
        // Attempt THREE out of FIVE
        //
        // IMPORTANT:
        //
        // is_selective = true ONLY when an actual
        // selection instruction is detected.
        // =================================================

        const selectiveInfo =
            detectSelectiveQuestion(
                questionText
            );


        // =================================================
        // ADD QUESTION ANALYSIS
        // =================================================

        questionAnalysis.push({

            question:
                questionNumber,


            question_number:
                questionNumber,


            content:
                questionText.substring(
                    0,
                    250
                ),


            parts:
                parts.length,


            difficulty:
                estimateDifficulty(
                    questionText
                ),


            // Keep existing field
            marks:
                maxMarks,


            // Explicit field used by EnterMarks
            max_marks:
                maxMarks,


            // =================================================
            // SELECTIVE QUESTION INFORMATION
            // =================================================

            is_selective:
                selectiveInfo.is_selective,


            selection_required:
                selectiveInfo.selection_required,


            selection_count:
                selectiveInfo.selection_count,


            selection_total:
                selectiveInfo.selection_total,


            selection_instruction:
                selectiveInfo.selection_instruction

        });

    }


    // =====================================================
    // TOPIC DETECTION
    // =====================================================

    const topics = [];


    const dictionary = {

        Accounting: [
            "ledger",
            "balance",
            "debit",
            "credit",
            "journal",
            "accounting",
            "trial balance",
            "cash book",
            "financial statement",
            "capital",
            "asset",
            "liability",
            "profit",
            "loss"
        ],


        Commerce: [
            "trade",
            "business",
            "entrepreneur",
            "market",
            "commerce",
            "consumer",
            "producer",
            "wholesale",
            "retail",
            "banking",
            "insurance"
        ],


        Mathematics: [
            "equation",
            "calculate",
            "solve",
            "factor",
            "mathematics",
            "algebra",
            "geometry",
            "percentage",
            "fraction",
            "probability",
            "statistics",
            "ratio"
        ],


        Biology: [
            "cell",
            "organ",
            "plant",
            "animal",
            "biology",
            "photosynthesis",
            "respiration",
            "reproduction",
            "tissue",
            "organism",
            "ecosystem"
        ],


        Chemistry: [
            "chemical",
            "reaction",
            "acid",
            "element",
            "chemistry",
            "compound",
            "molecule",
            "atom",
            "periodic",
            "oxidation",
            "reduction"
        ],


        Physics: [
            "force",
            "energy",
            "motion",
            "velocity",
            "physics",
            "acceleration",
            "mass",
            "pressure",
            "electricity",
            "current",
            "voltage",
            "density"
        ]

    };


    // =====================================================
    // FIND TOPICS
    // =====================================================

    const lowerText =
        cleanText.toLowerCase();


    for (
        const subject in dictionary
    ) {

        const keywords =
            dictionary[subject];


        let matches = 0;


        keywords.forEach(
            word => {

                if (
                    lowerText.includes(
                        word.toLowerCase()
                    )
                ) {

                    matches++;

                }

            }
        );


        if (matches > 0) {

            topics.push({
                subject,
                matches
            });

        }

    }


    // =====================================================
    // SORT TOPICS BY NUMBER OF MATCHES
    // =====================================================

    topics.sort(
        (a, b) =>
            b.matches - a.matches
    );


    const topicsFound =
        topics.map(
            item =>
                item.subject
        );


    // =====================================================
    // DETERMINE SUBJECT
    // =====================================================

    const detectedSubject =
        topics.length > 0
            ? topics[0].subject
            : "Unknown";


    // =====================================================
    // SYLLABUS COVERAGE
    // =====================================================

    const syllabusCoverage =
        Math.min(
            topics.length * 20,
            100
        );


    // =====================================================
    // OVERALL DIFFICULTY
    // =====================================================

    const overallDifficulty =
        calculateOverallDifficulty(
            questionAnalysis
        );


    // =====================================================
    // QUALITY SCORE
    // =====================================================

    const qualityScore =
        calculateQuality(
            totalQuestions,
            topicsFound.length
        );


    // =====================================================
    // TOTAL MAXIMUM MARKS
    // =====================================================

    const totalMaximumMarks =
        questionAnalysis.reduce(
            (
                total,
                question
            ) => {

                const maxMarks =
                    Number(
                        question.max_marks
                    );


                if (
                    Number.isNaN(
                        maxMarks
                    )
                ) {

                    return total;

                }


                return total + maxMarks;

            },
            0
        );


    // =====================================================
    // SELECTIVE QUESTIONS SUMMARY
    //
    // This tells the frontend how many main questions
    // were detected as selective.
    // =====================================================

    const selectiveQuestions =
        questionAnalysis.filter(
            question =>
                question.is_selective === true
        );


    const selectiveQuestionCount =
        selectiveQuestions.length;


    // =====================================================
    // RECOMMENDATIONS
    // =====================================================

    let recommendations;


    if (
        totalQuestions === 0
    ) {

        recommendations =
            "No main questions detected. Please check the PDF text extraction or question numbering.";

    }

    else {

        recommendations =
            "Paper analysed successfully.";

    }


    // =====================================================
    // RETURN RESULT
    // =====================================================

    return {

        subject:
            detectedSubject,


        total_questions:
            totalQuestions,


        topics_found:
            topicsFound,


        question_analysis:
            questionAnalysis,


        // =================================================
        // TOTAL MAXIMUM MARKS
        // =================================================

        total_max_marks:
            totalMaximumMarks,


        // =================================================
        // SELECTIVE QUESTION INFORMATION
        // =================================================

        selective_questions:
            selectiveQuestions,


        selective_question_count:
            selectiveQuestionCount,


        syllabus_coverage:
            syllabusCoverage,


        difficulty:
            overallDifficulty,


        quality_score:
            qualityScore,


        recommendations

    };

};


// =====================================================
// HELPER:
// DETECT SELECTIVE QUESTION
//
// Examples:
//
// Answer any 3
// Attempt any 4
// Choose any 2
// Select any 5
// Answer any three
// Attempt any four questions
// Answer THREE out of FIVE
// Choose 2 questions from the following
//
// IMPORTANT:
// This function only marks a question as selective
// when a selection instruction is actually detected.
// =====================================================

function detectSelectiveQuestion(
    text
) {

    if (
        !text ||
        typeof text !== "string"
    ) {

        return {

            is_selective:
                false,

            selection_required:
                false,

            selection_count:
                null,

            selection_total:
                null,

            selection_instruction:
                null

        };

    }


    // =================================================
    // NORMALIZE TEXT
    // =================================================

    const normalizedText =
        text
            .replace(/\s+/g, " ")
            .trim();


    // =================================================
    // NUMBER WORDS
    // =================================================

    const numberWords = {

        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
        eleven: 11,
        twelve: 12,
        thirteen: 13,
        fourteen: 14,
        fifteen: 15,
        sixteen: 16,
        seventeen: 17,
        eighteen: 18,
        nineteen: 19,
        twenty: 20

    };


    // =================================================
    // HELPER TO CONVERT NUMBER / WORD
    // =================================================

    const convertNumber =
        value => {

            if (
                value === undefined ||
                value === null
            ) {

                return null;

            }


            const normalized =
                String(
                    value
                )
                    .toLowerCase()
                    .trim();


            if (
                /^\d+$/.test(
                    normalized
                )
            ) {

                return Number(
                    normalized
                );

            }


            return (
                numberWords[
                    normalized
                ] ?? null
            );

        };


    // =================================================
    // PATTERN 1
    //
    // Answer any 3
    // Attempt any 4
    // Choose any 2
    // Select any 5
    //
    // Also:
    //
    // Answer any three questions
    // Attempt any four questions
    // =================================================

    const anyPattern =
        /\b(answer|attempt|choose|select|do)\s+(?:any|any\s+of)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i;


    const anyMatch =
        normalizedText.match(
            anyPattern
        );


    if (anyMatch) {

        const selectionCount =
            convertNumber(
                anyMatch[2]
            );


        return {

            is_selective:
                true,

            selection_required:
                true,

            selection_count:
                selectionCount,

            selection_total:
                null,

            selection_instruction:
                anyMatch[0]

        };

    }


    // =================================================
    // PATTERN 2
    //
    // Answer 3 out of 5
    // Attempt 4 out of 6
    // Choose 2 out of 5
    // Select 3 from 7
    //
    // This is also selective.
    // =================================================

    const outOfPattern =
        /\b(answer|attempt|choose|select|do)\s+(?:any\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:questions?\s+)?(?:out\s+of|from)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i;


    const outOfMatch =
        normalizedText.match(
            outOfPattern
        );


    if (outOfMatch) {

        const selectionCount =
            convertNumber(
                outOfMatch[2]
            );


        const selectionTotal =
            convertNumber(
                outOfMatch[3]
            );


        return {

            is_selective:
                true,

            selection_required:
                true,

            selection_count:
                selectionCount,

            selection_total:
                selectionTotal,

            selection_instruction:
                outOfMatch[0]

        };

    }


    // =================================================
    // PATTERN 3
    //
    // "Any three questions"
    // "Any 4 questions"
    //
    // Sometimes "answer/attempt" is missing.
    // =================================================

    const anyQuestionsPattern =
        /\bany\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+questions?\b/i;


    const anyQuestionsMatch =
        normalizedText.match(
            anyQuestionsPattern
        );


    if (anyQuestionsMatch) {

        const selectionCount =
            convertNumber(
                anyQuestionsMatch[1]
            );


        return {

            is_selective:
                true,

            selection_required:
                true,

            selection_count:
                selectionCount,

            selection_total:
                null,

            selection_instruction:
                anyQuestionsMatch[0]

        };

    }


    // =================================================
    // PATTERN 4
    //
    // "Choose three questions from the following"
    // "Select four questions from the following"
    // =================================================

    const chooseFromPattern =
        /\b(choose|select|answer|attempt)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+questions?\s+from\b/i;


    const chooseFromMatch =
        normalizedText.match(
            chooseFromPattern
        );


    if (chooseFromMatch) {

        const selectionCount =
            convertNumber(
                chooseFromMatch[2]
            );


        return {

            is_selective:
                true,

            selection_required:
                true,

            selection_count:
                selectionCount,

            selection_total:
                null,

            selection_instruction:
                chooseFromMatch[0]

        };

    }


    // =================================================
    // NOT SELECTIVE
    // =================================================

    return {

        is_selective:
            false,

        selection_required:
            false,

        selection_count:
            null,

        selection_total:
            null,

        selection_instruction:
            null

    };

}


// =====================================================
// HELPER:
// ESTIMATE QUESTION DIFFICULTY
// =====================================================

function estimateDifficulty(
    text
) {

    const length =
        text.length;


    if (
        length > 500
    ) {

        return "Hard";

    }


    if (
        length > 200
    ) {

        return "Medium";

    }


    return "Easy";

}


// =====================================================
// HELPER:
// EXTRACT MAXIMUM MARKS
//
// Examples supported:
//
// (10 marks)
// [10 marks]
// 10 marks
// (10 mark)
// 10 mks
// (10 mks)
//
// Also supports:
//
// (10)
// [10]
//
// when the number appears near the end
// of the main question.
// =====================================================

function extractMarks(
    text
) {

    if (
        !text ||
        typeof text !== "string"
    ) {

        return 0;

    }


    // =================================================
    // NORMALIZE WHITESPACE
    // =================================================

    const normalizedText =
        text
            .replace(/\s+/g, " ")
            .trim();


    // =================================================
    // FIRST PRIORITY:
    // NUMBER + MARKS
    // =================================================

    const explicitMarksMatches = [
        ...normalizedText.matchAll(
            /(?:\(|\[|\s|^)(\d+(?:\.\d+)?)\s*(?:marks?|mks?)(?:\s*\)|\])?/gi
        )
    ];


    if (
        explicitMarksMatches.length > 0
    ) {

        const lastMatch =
            explicitMarksMatches[
                explicitMarksMatches.length - 1
            ];


        const value =
            Number(
                lastMatch[1]
            );


        if (
            !Number.isNaN(
                value
            )
        ) {

            return value;

        }

    }


    // =================================================
    // SECOND PRIORITY:
    // BRACKET MARKS
    // =================================================

    const bracketMatches = [
        ...normalizedText.matchAll(
            /[\(\[]\s*(\d+(?:\.\d+)?)\s*[\)\]]/g
        )
    ];


    if (
        bracketMatches.length > 0
    ) {

        const lastMatch =
            bracketMatches[
                bracketMatches.length - 1
            ];


        const value =
            Number(
                lastMatch[1]
            );


        if (
            !Number.isNaN(
                value
            )
        ) {

            return value;

        }

    }


    // =================================================
    // THIRD PRIORITY:
    // MARKS AT END OF QUESTION
    // =================================================

    const endingMatch =
        normalizedText.match(
            /(?:^|\s)(\d+(?:\.\d+)?)\s*$/
        );


    if (
        endingMatch
    ) {

        const value =
            Number(
                endingMatch[1]
            );


        if (
            !Number.isNaN(
                value
            )
        ) {

            return value;

        }

    }


    // =================================================
    // NO MARKS FOUND
    // =================================================

    return 0;

}


// =====================================================
// HELPER:
// CALCULATE OVERALL DIFFICULTY
// =====================================================

function calculateOverallDifficulty(
    data
) {

    if (
        !data ||
        data.length === 0
    ) {

        return "Unknown";

    }


    const hard =
        data.filter(
            item =>
                item.difficulty ===
                "Hard"
        ).length;


    const medium =
        data.filter(
            item =>
                item.difficulty ===
                "Medium"
        ).length;


    const easy =
        data.filter(
            item =>
                item.difficulty ===
                "Easy"
        ).length;


    const total =
        data.length;


    // ---------------------------------------------
    // HARD DOMINANT
    // ---------------------------------------------

    if (
        hard / total >= 0.5
    ) {

        return "Hard";

    }


    // ---------------------------------------------
    // EASY DOMINANT
    // ---------------------------------------------

    if (
        easy / total >= 0.6
    ) {

        return "Easy";

    }


    // ---------------------------------------------
    // OTHERWISE
    // ---------------------------------------------

    return "Medium";

}


// =====================================================
// HELPER:
// CALCULATE QUALITY SCORE
// =====================================================

function calculateQuality(
    questionCount,
    topicCount
) {

    let score = 50;


    // ---------------------------------------------
    // NUMBER OF QUESTIONS
    // ---------------------------------------------

    if (
        questionCount >= 5
    ) {

        score += 20;

    }

    else if (
        questionCount > 0
    ) {

        score += 10;

    }


    // ---------------------------------------------
    // TOPIC COVERAGE
    // ---------------------------------------------

    if (
        topicCount >= 3
    ) {

        score += 30;

    }

    else if (
        topicCount > 0
    ) {

        score += 20;

    }


    // ---------------------------------------------
    // LIMIT SCORE
    // ---------------------------------------------

    return Math.min(
        score,
        100
    );

}