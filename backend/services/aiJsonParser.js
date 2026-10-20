// Pure JSON parsing helpers for AI examination responses.
// This module intentionally has no database or API dependencies so it can be tested safely.

const normalizeAIJsonCharacters =
    (value) => {
        if (
            typeof value !==
            "string"
        ) {
            return value;
        }

        return value
            .replace(
                /[\u2018\u2019]/g,
                "'"
            )
            .replace(
                /[\u201C\u201D]/g,
                '"'
            )
            .replace(
                /\u00A0/g,
                " "
            )
            .replace(
                /\uFEFF/g,
                ""
            );
    };

const stripMarkdownJson = (
    value
) => {
    let text =
        normalizeAIJsonCharacters(
            value
        );

    text =
        text.trim();

    text =
        text.replace(
            /^```(?:json)?\s*/i,
            ""
        );

    text =
        text.replace(
            /\s*```$/i,
            ""
        );

    return text.trim();
};

const extractCompleteJsonValue =
    (text) => {
        const source =
            String(
                text || ""
            ).trim();

        if (!source) {
            return "";
        }

        const firstObject =
            source.indexOf("{");

        const firstArray =
            source.indexOf("[");

        let start = -1;

        if (
            firstObject === -1
        ) {
            start =
                firstArray;
        } else if (
            firstArray === -1
        ) {
            start =
                firstObject;
        } else {
            start =
                Math.min(
                    firstObject,
                    firstArray
                );
        }

        if (
            start < 0
        ) {
            return source;
        }

        const opening =
            source[start];

        const closing =
            opening === "{"
                ? "}"
                : "]";

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (
            let index = start;
            index < source.length;
            index++
        ) {
            const character =
                source[index];

            if (inString) {
                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (
                    character === "\\"
                ) {
                    escaped = true;
                    continue;
                }

                if (
                    character === '"'
                ) {
                    inString = false;
                }

                continue;
            }

            if (
                character === '"'
            ) {
                inString = true;
                continue;
            }

            if (
                character === opening
            ) {
                depth++;
            } else if (
                character === closing
            ) {
                depth--;

                if (
                    depth === 0
                ) {
                    return source.slice(
                        start,
                        index + 1
                    );
                }
            }
        }

        return source.slice(
            start
        );
    };

const repairCommonAIJsonErrors =
    (value) => {
        let text =
            String(value || "");

        text =
            text.replace(
                /,\s*([}\]])/g,
                "$1"
            );

        text =
            text.replace(
                /:\s*undefined\b/g,
                ": null"
            );

        text =
            text.replace(
                /:\s*NaN\b/g,
                ": null"
            );

        text =
            text.replace(
                /([{[]\s*)'([A-Za-z_$][\w$]*)'\s*:/g,
                '$1"$2":'
            );

        return text;
    };

// ============================================================
// REPAIR UNESCAPED DOUBLE QUOTES INSIDE JSON STRING VALUES
//
// Exam question text often contains quoted words or instructions.
// Gemini can return those quotes without JSON escaping. Escape only
// quotes that cannot reasonably be JSON string delimiters, and only
// accept the repaired document if JSON.parse validates it.
// ============================================================

const repairUnescapedJsonStringQuotes = (
    value
) => {
    const source = String(value || "");
    let output = "";
    let inString = false;
    let escaped = false;

    for (let index = 0; index < source.length; index++) {
        const character = source[index];

        if (!inString) {
            output += character;

            if (character === '"') {
                inString = true;
                escaped = false;
            }

            continue;
        }

        if (escaped) {
            output += character;
            escaped = false;
            continue;
        }

        if (character === "\\") {
            output += character;
            escaped = true;
            continue;
        }

        if (character !== '"') {
            output += character;
            continue;
        }

        let nextIndex = index + 1;

        while (
            nextIndex < source.length &&
            /\s/.test(source[nextIndex])
        ) {
            nextIndex++;
        }

        const nextCharacter = source[nextIndex];
        let commaFollowedByJsonStructure = false;

        if (nextCharacter === ",") {
            let afterComma = nextIndex + 1;

            while (
                afterComma < source.length &&
                /\s/.test(source[afterComma])
            ) {
                afterComma++;
            }

            if (
                source[afterComma] === "}" ||
                source[afterComma] === "]"
            ) {
                commaFollowedByJsonStructure = true;
            } else if (source[afterComma] === '"') {
                let keyEnd = afterComma + 1;
                let keyEscaped = false;

                while (keyEnd < source.length) {
                    const keyCharacter = source[keyEnd];

                    if (keyEscaped) {
                        keyEscaped = false;
                    } else if (keyCharacter === "\\") {
                        keyEscaped = true;
                    } else if (keyCharacter === '"') {
                        break;
                    }

                    keyEnd++;
                }

                keyEnd++;

                while (
                    keyEnd < source.length &&
                    /\s/.test(source[keyEnd])
                ) {
                    keyEnd++;
                }

                commaFollowedByJsonStructure =
                    source[keyEnd] === ":";
            }
        }

        const canCloseString =
            nextCharacter === undefined ||
            nextCharacter === ":" ||
            nextCharacter === "}" ||
            nextCharacter === "]" ||
            commaFollowedByJsonStructure;

        if (canCloseString) {
            output += character;
            inString = false;
        } else {
            output += '\\"';
        }
    }

    return output;
};

const parseAIResult = (
    aiRawResponse
) => {
    let rawText;

    if (
        typeof aiRawResponse ===
        "string"
    ) {
        rawText =
            aiRawResponse;
    } else if (
        aiRawResponse?.text
    ) {
        rawText =
            aiRawResponse.text;
    } else if (
        aiRawResponse?.response
    ) {
        rawText =
            typeof aiRawResponse.response ===
            "string"
                ? aiRawResponse.response
                : JSON.stringify(
                    aiRawResponse.response
                );
    } else {
        rawText =
            JSON.stringify(
                aiRawResponse
            );
    }

    rawText =
        stripMarkdownJson(
            rawText
        );

    // Gemini's service already validates and cleans its JSON response.
    // Parse a complete valid JSON document before applying any repair regexes.
    // This avoids corrupting valid question text that happens to contain commas,
    // quotes, or punctuation resembling JSON syntax.
    try {
        const directResult = JSON.parse(rawText);

        if (
            directResult &&
            typeof directResult === "object"
        ) {
            return directResult;
        }
    } catch {
        // Continue to the tolerant recovery path for fenced, prefixed,
        // or imperfect JSON responses from other AI/provider versions.
    }

    // Repair unescaped quotes BEFORE extracting the complete JSON value.
    // If extraction runs first, an unescaped quote inside a question can make
    // the scanner think the JSON string ended early and truncate the candidate.
    const firstObjectIndex =
        rawText.indexOf("{");

    const firstArrayIndex =
        rawText.indexOf("[");

    let jsonStartIndex = -1;

    if (firstObjectIndex === -1) {
        jsonStartIndex = firstArrayIndex;
    } else if (firstArrayIndex === -1) {
        jsonStartIndex = firstObjectIndex;
    } else {
        jsonStartIndex = Math.min(
            firstObjectIndex,
            firstArrayIndex
        );
    }

    const rawJsonCandidate =
        jsonStartIndex >= 0
            ? rawText.slice(jsonStartIndex)
            : rawText;

    let repairedCandidate =
        repairUnescapedJsonStringQuotes(
            rawJsonCandidate
        );

    let jsonText =
        extractCompleteJsonValue(
            repairedCandidate
        );

    // Accept quote repair only when the extracted result is valid complete JSON.
    try {
        const quoteRepairedResult =
            JSON.parse(
                jsonText
            );

        if (
            quoteRepairedResult &&
            typeof quoteRepairedResult === "object"
        ) {
            console.warn(
                "AI JSON QUOTE REPAIR SUCCESS"
            );

            return quoteRepairedResult;
        }
    } catch {
        // Continue with the existing general recovery path.
    }

    // Keep the original extracted candidate as a fallback for cases where
    // the quote-repair pass changes a legitimate delimiter or cannot recover.
    jsonText =
        extractCompleteJsonValue(
            rawText
        );

    jsonText =
        repairCommonAIJsonErrors(
            jsonText
        );

    try {
        return JSON.parse(
            jsonText
        );
    } catch (
        firstError
    ) {
        try {
            const cleaned =
                jsonText.replace(
                    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
                    ""
                );

            return JSON.parse(
                cleaned
            );
        } catch (
            secondError
        ) {
            const error =
                new Error(
                    "Gemini returned an invalid JSON examination analysis."
                );

            error.code =
                "INVALID_AI_JSON";

            // Include the malformed JSON location in diagnostics.
            // The previous 2,000-character prefix could not show errors
            // occurring later in longer exam analyses.
            const parsePositionMatch =
                String(
                    firstError?.message ||
                    secondError?.message ||
                    ""
                ).match(/position\s+(\d+)/i);

            const parsePosition =
                parsePositionMatch
                    ? Number(parsePositionMatch[1])
                    : -1;

            const previewStart =
                parsePosition >= 0
                    ? Math.max(0, parsePosition - 500)
                    : Math.max(0, rawText.length - 1500);

            const previewEnd =
                parsePosition >= 0
                    ? Math.min(rawText.length, parsePosition + 800)
                    : rawText.length;

            error.details = {
                firstError:
                    firstError.message,

                secondError:
                    secondError.message,

                responseLength:
                    rawText.length,

                parsePosition,

                responsePreview:
                    rawText.slice(
                        previewStart,
                        previewEnd
                    ),

                responseEndsWith:
                    rawText.slice(
                        Math.max(0, rawText.length - 500)
                    ),
            };

            throw error;
        }
    }
};

// ============================================================

export {
    parseAIResult,
};
