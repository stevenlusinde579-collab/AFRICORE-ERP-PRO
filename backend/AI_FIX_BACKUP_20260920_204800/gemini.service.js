// ============================================================
// GEMINI SERVICE
// ============================================================

import axios from "axios";

const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash";

const GEMINI_BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_RETRIES =
    Math.max(
        0,
        Number(
            process.env.GEMINI_MAX_RETRIES ||
            4
        )
    );

const DEFAULT_RETRY_DELAY =
    Math.max(
        1000,
        Number(
            process.env.GEMINI_RETRY_DELAY_MS ||
            5000
        )
    );

const MAX_RETRY_DELAY =
    Math.max(
        DEFAULT_RETRY_DELAY,
        Number(
            process.env.GEMINI_MAX_RETRY_DELAY_MS ||
            60000
        )
    );

// ============================================================
// IMPORTANT:
// Increase output capacity so large examination-analysis JSON
// does not get cut before Gemini finishes generating it.
// ============================================================

const GEMINI_MAX_OUTPUT_TOKENS = Math.min(
    65536,
    Math.max(
        8192,
        Number(
            process.env.GEMINI_MAX_OUTPUT_TOKENS ||
            65536
        )
    )
);

// Keep temperature low because we need reliable structured JSON.
const GEMINI_TEMPERATURE = Math.max(
    0,
    Math.min(
        1,
        Number(
            process.env.GEMINI_TEMPERATURE ||
            0.1
        )
    )
);

// ============================================================
// HELPERS
// ============================================================

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

const getRetryAfterMs = (headers = {}) => {
    const retryAfter =
        headers["retry-after"] ??
        headers["Retry-After"];

    if (!retryAfter) {
        return null;
    }

    const numeric = Number(retryAfter);

    if (Number.isFinite(numeric)) {
        return Math.max(0, numeric * 1000);
    }

    const date = Date.parse(retryAfter);

    if (!Number.isNaN(date)) {
        return Math.max(0, date - Date.now());
    }

    return null;
};

const getRetryDelay = (attempt, headers = {}) => {
    const retryAfter = getRetryAfterMs(headers);

    if (retryAfter !== null) {
        return Math.min(
            retryAfter,
            MAX_RETRY_DELAY
        );
    }

    const exponentialDelay =
        DEFAULT_RETRY_DELAY *
        Math.pow(2, attempt);

    const jitter =
        Math.floor(
            Math.random() *
            Math.min(
                1000,
                exponentialDelay * 0.2
            )
        );

    return Math.min(
        exponentialDelay + jitter,
        MAX_RETRY_DELAY
    );
};

const shouldRetryGeminiRequest = (error) => {
    const status =
        error?.response?.status;

    if (!status) {
        return true;
    }

    return [
        429,
        500,
        502,
        503,
        504
    ].includes(status);
};

const getGeminiUrl = () => {
    const apiKey =
        process.env.GEMINI_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "GEMINI_API_KEY haijawekwa kwenye environment variables."
        );

        error.code = "GEMINI_API_KEY_MISSING";
        error.status = 500;

        throw error;
    }

    return `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
};

// ============================================================
// ERROR HANDLER
// ============================================================

const handleGeminiError = (error) => {
    if (
        error?.code ===
            "GEMINI_OUTPUT_TRUNCATED" ||
        error?.code ===
            "GEMINI_SAFETY_BLOCK" ||
        error?.code ===
            "GEMINI_INVALID_JSON"
    ) {
        throw error;
    }

    const status =
        error?.response?.status;

    const data =
        error?.response?.data;

    const apiMessage =
        data?.error?.message ||
        data?.message ||
        error?.message ||
        "Unknown Gemini error";

    const wrappedError =
        new Error(
            `Gemini API error: ${apiMessage}`
        );

    wrappedError.status =
        status || 500;

    wrappedError.code =
        data?.error?.status ||
        error?.code ||
        "GEMINI_API_ERROR";

    wrappedError.responseData =
        data;

    throw wrappedError;
};

// ============================================================
// REQUEST CONFIG
// ============================================================

const getRequestConfig = () => ({
    timeout: 180000,
    headers: {
        "Content-Type":
            "application/json"
    }
});

// ============================================================
// INTERNAL GEMINI REQUEST
// ============================================================

const makeGeminiRequestInternal = async (
    payload
) => {
    const url =
        getGeminiUrl();

    try {
        const response =
            await axios.post(
                url,
                payload,
                getRequestConfig()
            );

        return response.data;
    } catch (error) {
        throw error;
    }
};

// ============================================================
// GEMINI REQUEST WITH RETRIES
// ============================================================

const makeGeminiRequest = async (
    payload
) => {
    let lastError = null;

    for (
        let attempt = 0;
        attempt <= MAX_RETRIES;
        attempt++
    ) {
        try {
            return await makeGeminiRequestInternal(
                payload
            );
        } catch (error) {
            lastError = error;

            if (
                !shouldRetryGeminiRequest(
                    error
                ) ||
                attempt >= MAX_RETRIES
            ) {
                handleGeminiError(error);
            }

            const delay =
                getRetryDelay(
                    attempt,
                    error?.response
                        ?.headers || {}
                );

            console.warn(
                `Gemini request failed. Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`
            );

            await sleep(delay);
        }
    }

    handleGeminiError(lastError);
};

// ============================================================
// EXTRACT GEMINI TEXT
// ============================================================

const extractGeminiText = (
    response
) => {
    const candidates =
        response?.candidates || [];

    if (!candidates.length) {
        const error =
            new Error(
                "Gemini haikurudisha candidate yoyote."
            );

        error.code =
            "GEMINI_EMPTY_RESPONSE";

        error.status = 502;

        throw error;
    }

    let selectedCandidate =
        null;

    let selectedText =
        "";

    for (
        const candidate of candidates
    ) {
        const parts =
            candidate?.content
                ?.parts || [];

        const textParts =
            parts
                .map(
                    (part) =>
                        typeof part?.text ===
                        "string"
                            ? part.text
                            : ""
                )
                .filter(Boolean);

        if (textParts.length) {
            selectedCandidate =
                candidate;

            selectedText =
                textParts.join("\n");

            break;
        }
    }

    if (!selectedText) {
        const firstCandidate =
            candidates[0];

        const finishReason =
            firstCandidate?.finishReason ||
            firstCandidate?.finish_reason ||
            "UNKNOWN";

        const error =
            new Error(
                `Gemini haikurudisha text. Finish reason: ${finishReason}`
            );

        error.code =
            "GEMINI_EMPTY_TEXT";

        error.status = 502;

        error.finishReason =
            finishReason;

        throw error;
    }

    const finishReason =
        selectedCandidate?.finishReason ||
        selectedCandidate?.finish_reason ||
        "";

    const usageMetadata =
        response?.usageMetadata ||
        response?.usage_metadata ||
        {};

    const outputTokenCount =
        usageMetadata?.candidatesTokenCount ||
        usageMetadata?.candidates_token_count ||
        usageMetadata?.outputTokenCount ||
        usageMetadata?.output_token_count ||
        null;

    console.log(
        "============================================================"
    );

    console.log(
        "GEMINI FINISH REASON:",
        finishReason || "UNKNOWN"
    );

    console.log(
        "GEMINI OUTPUT TOKEN COUNT:",
        outputTokenCount ?? "UNKNOWN"
    );

    console.log(
        "GEMINI RESPONSE LENGTH:",
        selectedText.length
    );

    console.log(
        "============================================================"
    );

    // ========================================================
    // VERY IMPORTANT:
    // If Gemini stopped because it reached max output tokens,
    // the JSON can be incomplete and JSON.parse will fail.
    // Detect it before trying to parse the response.
    // ========================================================

    if (
        finishReason ===
        "MAX_TOKENS"
    ) {
        const error =
            new Error(
                "Gemini output ilikatika kabla JSON haijakamilika. Output token limit imefikiwa. Jaribu analysis tena."
            );

        error.code =
            "GEMINI_OUTPUT_TRUNCATED";

        error.status = 502;

        error.finishReason =
            finishReason;

        error.outputTokenCount =
            outputTokenCount;

        throw error;
    }

    // ========================================================
    // SAFETY BLOCK
    // ========================================================

    if (
        finishReason ===
        "SAFETY"
    ) {
        const error =
            new Error(
                "Gemini imezuia response kutokana na safety filtering."
            );

        error.code =
            "GEMINI_SAFETY_BLOCK";

        error.status = 502;

        error.finishReason =
            finishReason;

        throw error;
    }

    return selectedText;
};

// ============================================================
// CLEAN GEMINI JSON
// ============================================================

const cleanGeminiJson = (
    rawText
) => {
    if (
        rawText === null ||
        rawText === undefined
    ) {
        const error =
            new Error(
                "Gemini ilirudisha response tupu."
            );

        error.code =
            "GEMINI_EMPTY_RESPONSE";

        throw error;
    }

    let text =
        String(rawText)
            .replace(/^\uFEFF/, "")
            .trim();

    if (!text) {
        const error =
            new Error(
                "Gemini ilirudisha response tupu."
            );

        error.code =
            "GEMINI_EMPTY_RESPONSE";

        throw error;
    }

    // ========================================================
    // Remove markdown JSON fences
    // ========================================================

    text = text.replace(
        /^```json\s*/i,
        ""
    );

    text = text.replace(
        /^```\s*/i,
        ""
    );

    text = text.replace(
        /\s*```$/i,
        ""
    );

    text = text.trim();

    // ========================================================
    // Find first JSON object / array
    // ========================================================

    const firstObject =
        text.indexOf("{");

    const firstArray =
        text.indexOf("[");

    let start = -1;

    if (
        firstObject === -1 &&
        firstArray === -1
    ) {
        const error =
            new Error(
                "Gemini ilirudisha response ambayo si valid JSON."
            );

        error.code =
            "GEMINI_INVALID_JSON";

        throw error;
    }

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

    if (start > 0) {
        text =
            text.slice(start);
    }

    // ========================================================
    // Remove trailing markdown fence if any
    // ========================================================

    text =
        text.replace(
            /\s*```[\s\S]*$/,
            ""
        ).trim();

    // ========================================================
    // Validate JSON
    // ========================================================

    try {
        JSON.parse(text);

        return text;
    } catch (error) {
        const jsonError =
            new Error(
                "Gemini ilirudisha response ambayo si valid JSON."
            );

        jsonError.code =
            "GEMINI_INVALID_JSON";

        jsonError.originalError =
            error;

        jsonError.rawText =
            text;

        throw jsonError;
    }
};

// ============================================================
// ASK GEMINI
// ============================================================

export const askGemini = async (
    prompt
) => {
    if (
        !prompt ||
        !String(prompt).trim()
    ) {
        const error =
            new Error(
                "Gemini prompt haipo."
            );

        error.code =
            "GEMINI_PROMPT_EMPTY";

        throw error;
    }

    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: String(
                            prompt
                        )
                    }
                ]
            }
        ],

        generationConfig: {
            // Force JSON response
            responseMimeType:
                "application/json",

            // Prevent large exam analysis
            // from being cut prematurely.
            maxOutputTokens:
                GEMINI_MAX_OUTPUT_TOKENS,

            // Low temperature for
            // consistent structured output.
            temperature:
                GEMINI_TEMPERATURE
        }
    };

    const response =
        await makeGeminiRequest(
            payload
        );

    const rawText =
        extractGeminiText(
            response
        );

    try {
        return cleanGeminiJson(
            rawText
        );
    } catch (error) {
        console.error(
            "============================================================"
        );

        console.error(
            "GEMINI INVALID JSON"
        );

        console.error(
            "RESPONSE LENGTH:",
            rawText?.length || 0
        );

        console.error(
            "JSON PARSE ERROR:",
            error?.message
        );

        console.error(
            "RESPONSE PREVIEW:"
        );

        console.error(
            String(
                rawText || ""
            ).slice(0, 4000)
        );

        console.error(
            "RESPONSE TAIL:"
        );

        console.error(
            String(
                rawText || ""
            ).slice(-2000)
        );

        console.error(
            "============================================================"
        );

        const jsonError =
            new Error(
                "Gemini ilirudisha response ambayo si valid JSON. Jaribu analysis tena."
            );

        jsonError.code =
            "GEMINI_INVALID_JSON";

        jsonError.status =
            502;

        jsonError.rawResponseLength =
            rawText?.length || 0;

        jsonError.originalError =
            error;

        throw jsonError;
    }
};

// ============================================================
// ASK GEMINI WITH PDF
// ============================================================

export const askGeminiWithPDF = async (
    prompt,
    pdfBase64
) => {
    if (
        !prompt ||
        !String(prompt).trim()
    ) {
        const error =
            new Error(
                "Gemini prompt haipo."
            );

        error.code =
            "GEMINI_PROMPT_EMPTY";

        throw error;
    }

    if (
        !pdfBase64 ||
        !String(pdfBase64).trim()
    ) {
        const error =
            new Error(
                "PDF data haipo."
            );

        error.code =
            "GEMINI_PDF_EMPTY";

        throw error;
    }

    const payload = {
        contents: [
            {
                role: "user",

                parts: [
                    {
                        text: String(
                            prompt
                        )
                    },

                    {
                        inlineData: {
                            mimeType:
                                "application/pdf",

                            data:
                                String(
                                    pdfBase64
                                )
                        }
                    }
                ]
            }
        ],

        generationConfig: {
            responseMimeType:
                "application/json",

            maxOutputTokens:
                GEMINI_MAX_OUTPUT_TOKENS,

            temperature:
                GEMINI_TEMPERATURE
        }
    };

    const response =
        await makeGeminiRequest(
            payload
        );

    const rawText =
        extractGeminiText(
            response
        );

    try {
        return cleanGeminiJson(
            rawText
        );
    } catch (error) {
        console.error(
            "============================================================"
        );

        console.error(
            "GEMINI PDF INVALID JSON"
        );

        console.error(
            "RESPONSE LENGTH:",
            rawText?.length || 0
        );

        console.error(
            "JSON PARSE ERROR:",
            error?.message
        );

        console.error(
            "RESPONSE PREVIEW:"
        );

        console.error(
            String(
                rawText || ""
            ).slice(0, 4000)
        );

        console.error(
            "RESPONSE TAIL:"
        );

        console.error(
            String(
                rawText || ""
            ).slice(-2000)
        );

        console.error(
            "============================================================"
        );

        const jsonError =
            new Error(
                "Gemini ilirudisha response ambayo si valid JSON. Jaribu analysis tena."
            );

        jsonError.code =
            "GEMINI_INVALID_JSON";

        jsonError.status =
            502;

        jsonError.rawResponseLength =
            rawText?.length || 0;

        jsonError.originalError =
            error;

        throw jsonError;
    }
};

// ============================================================
// GEMINI CONNECTION TEST
// ============================================================

export const testGeminiConnection =
    async () => {
        const payload = {
            contents: [
                {
                    role: "user",

                    parts: [
                        {
                            text:
                                'Return only this JSON object: {"ok":true}'
                        }
                    ]
                }
            ],

            generationConfig: {
                responseMimeType:
                    "application/json",

                maxOutputTokens:
                    256,

                temperature:
                    0
            }
        };

        const response =
            await makeGeminiRequest(
                payload
            );

        const text =
            extractGeminiText(
                response
            );

        const cleaned =
            cleanGeminiJson(
                text
            );

        return JSON.parse(
            cleaned
        );
    };

// ============================================================
// CONFIG EXPORT
// ============================================================

export const geminiConfig = {
    model:
        GEMINI_MODEL,

    maxRetries:
        MAX_RETRIES,

    defaultRetryDelay:
        DEFAULT_RETRY_DELAY,

    maxRetryDelay:
        MAX_RETRY_DELAY,

    maxOutputTokens:
        GEMINI_MAX_OUTPUT_TOKENS,

    temperature:
        GEMINI_TEMPERATURE
};