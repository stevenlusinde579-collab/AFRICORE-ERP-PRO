// ============================================================
// GEMINI SERVICE
// ============================================================

import axios from "axios";

// ============================================================
// CONFIGURATION
// ============================================================

const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.8-flash";

const GEMINI_BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

// ============================================================
// IMPORTANT
//
// Gemini analysis lazima iwe fast-fail.
// 429 / quota HAITAKIWI kusubiri retries nyingi.
//
// Default:
// - 0 retries for quota/rate-limit
// - maximum 1 retry for temporary server errors
// - short retry delay
// - 60 second HTTP timeout
// ============================================================

const MAX_RETRIES =
    Math.max(
        0,
        Math.min(
            1,
            Number(
                process.env.GEMINI_MAX_RETRIES ||
                1
            )
        )
    );

const DEFAULT_RETRY_DELAY =
    Math.max(
        500,
        Number(
            process.env.GEMINI_RETRY_DELAY_MS ||
            1500
        )
    );

const MAX_RETRY_DELAY =
    Math.max(
        DEFAULT_RETRY_DELAY,
        Number(
            process.env.GEMINI_MAX_RETRY_DELAY_MS ||
            5000
        )
    );

// ============================================================
// OUTPUT TOKENS
//
// 65536 ilikuwa kubwa sana kwa examination JSON.
// 32768 bado ni kubwa lakini inapunguza unnecessary generation.
// ============================================================

const GEMINI_MAX_OUTPUT_TOKENS =
    Math.min(
        32768,
        Math.max(
            4096,
            Number(
                process.env.GEMINI_MAX_OUTPUT_TOKENS ||
                32768
            )
        )
    );

// ============================================================
// TEMPERATURE
// ============================================================

const GEMINI_TEMPERATURE =
    Math.max(
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
// HTTP TIMEOUT
// ============================================================

const GEMINI_TIMEOUT_MS =
    Math.max(
        15000,
        Number(
            process.env.GEMINI_TIMEOUT_MS ||
            60000
        )
    );

// ============================================================
// HELPERS
// ============================================================

const sleep = (
    milliseconds
) =>
    new Promise(
        (resolve) =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

// ============================================================
// RETRY-AFTER
// ============================================================

const getRetryAfterMs = (
    headers = {}
) => {
    const retryAfter =
        headers["retry-after"] ??
        headers["Retry-After"];

    if (
        retryAfter ===
            undefined ||
        retryAfter ===
            null ||
        retryAfter === ""
    ) {
        return null;
    }

    const numeric =
        Number(
            retryAfter
        );

    if (
        Number.isFinite(
            numeric
        )
    ) {
        return Math.max(
            0,
            numeric * 1000
        );
    }

    const date =
        Date.parse(
            retryAfter
        );

    if (
        !Number.isNaN(
            date
        )
    ) {
        return Math.max(
            0,
            date - Date.now()
        );
    }

    return null;
};

// ============================================================
// RETRY DELAY
// ============================================================

const getRetryDelay = (
    attempt,
    headers = {}
) => {
    const retryAfter =
        getRetryAfterMs(
            headers
        );

    if (
        retryAfter !==
        null
    ) {
        return Math.min(
            retryAfter,
            MAX_RETRY_DELAY
        );
    }

    const exponentialDelay =
        DEFAULT_RETRY_DELAY *
        Math.pow(
            2,
            attempt
        );

    const jitter =
        Math.floor(
            Math.random() *
            Math.min(
                500,
                exponentialDelay *
                    0.15
            )
        );

    return Math.min(
        exponentialDelay +
            jitter,
        MAX_RETRY_DELAY
    );
};

// ============================================================
// SHOULD RETRY
//
// VERY IMPORTANT:
//
// 429 = NO RETRY
//
// Kwa sababu quota/rate-limit inaweza kufanya system
// ikae dakika nyingi ikisubiri.
// ============================================================

const shouldRetryGeminiRequest = (
    error
) => {
    const status =
        error?.response?.status;

    if (
        status === 429
    ) {
        return false;
    }

    if (
        status === 400 ||
        status === 401 ||
        status === 403 ||
        status === 404 ||
        status === 413
    ) {
        return false;
    }

    if (
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504
    ) {
        return true;
    }

    if (
        error?.code ===
            "ECONNABORTED" ||
        error?.code ===
            "ETIMEDOUT" ||
        error?.code ===
            "ECONNRESET"
    ) {
        return true;
    }

    return false;
};

// ============================================================
// GEMINI URL
// ============================================================

const getGeminiUrl = () => {
    const apiKey =
        process.env.GEMINI_API_KEY;

    if (
        !apiKey ||
        !String(
            apiKey
        ).trim()
    ) {
        const error =
            new Error(
                "GEMINI_API_KEY haijawekwa kwenye environment variables."
            );

        error.code =
            "GEMINI_API_KEY_MISSING";

        error.status =
            500;

        throw error;
    }

    return (
        `${GEMINI_BASE_URL}/` +
        `${GEMINI_MODEL}:generateContent`
    );
};

// ============================================================
// ERROR CREATOR
// ============================================================

const createGeminiError = (
    message,
    code,
    status,
    extra = {}
) => {
    const error =
        new Error(
            message
        );

    error.code =
        code;

    error.status =
        status;

    Object.assign(
        error,
        extra
    );

    return error;
};

// ============================================================
// ERROR HANDLER
// ============================================================

const handleGeminiError = (
    error
) => {
    if (
        error?.code ===
            "GEMINI_OUTPUT_TRUNCATED" ||
        error?.code ===
            "GEMINI_SAFETY_BLOCK" ||
        error?.code ===
            "GEMINI_INVALID_JSON" ||
        error?.code ===
            "GEMINI_EMPTY_RESPONSE" ||
        error?.code ===
            "GEMINI_EMPTY_TEXT"
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

    // ========================================================
    // 429
    //
    // DO NOT RETRY.
    // ========================================================

    if (
        status === 429
    ) {
        throw createGeminiError(
            "Gemini API quota/rate limit imefika. AI analysis imesimamishwa bila kusubiri retries.",
            "GEMINI_QUOTA_EXCEEDED",
            429,
            {
                responseData:
                    data,
                retryAfter:
                    getRetryAfterMs(
                        error?.response
                            ?.headers ||
                            {}
                    ),
            }
        );
    }

    // ========================================================
    // AUTH
    // ========================================================

    if (
        status === 401 ||
        status === 403
    ) {
        throw createGeminiError(
            "Gemini API key si sahihi au haina permission ya kutumia model hii.",
            "GEMINI_AUTH_ERROR",
            status,
            {
                responseData:
                    data,
            }
        );
    }

    // ========================================================
    // MODEL NOT FOUND
    // ========================================================

    if (
        status === 404
    ) {
        throw createGeminiError(
            `Gemini model "${GEMINI_MODEL}" haipatikani.`,
            "GEMINI_MODEL_NOT_FOUND",
            404,
            {
                responseData:
                    data,
            }
        );
    }

    // ========================================================
    // BAD REQUEST
    // ========================================================

    if (
        status === 400
    ) {
        throw createGeminiError(
            `Gemini request si sahihi: ${apiMessage}`,
            "GEMINI_BAD_REQUEST",
            400,
            {
                responseData:
                    data,
            }
        );
    }

    // ========================================================
    // REQUEST TOO LARGE
    // ========================================================

    if (
        status === 413
    ) {
        throw createGeminiError(
            "Gemini request ni kubwa sana.",
            "GEMINI_REQUEST_TOO_LARGE",
            413,
            {
                responseData:
                    data,
            }
        );
    }

    // ========================================================
    // TIMEOUT / NETWORK
    // ========================================================

    if (
        error?.code ===
            "ECONNABORTED" ||
        error?.code ===
            "ETIMEDOUT"
    ) {
        throw createGeminiError(
            "Gemini analysis ime-timeout baada ya muda uliowekwa.",
            "GEMINI_TIMEOUT",
            504
        );
    }

    if (
        error?.code ===
        "ECONNRESET"
    ) {
        throw createGeminiError(
            "Connection ya Gemini imekatika wakati wa analysis.",
            "GEMINI_NETWORK_ERROR",
            503
        );
    }

    // ========================================================
    // SERVER ERRORS
    // ========================================================

    if (
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504
    ) {
        throw createGeminiError(
            `Gemini server error: ${apiMessage}`,
            "GEMINI_SERVER_ERROR",
            status,
            {
                responseData:
                    data,
            }
        );
    }

    // ========================================================
    // UNKNOWN
    // ========================================================

    throw createGeminiError(
        `Gemini API error: ${apiMessage}`,
        error?.code ||
            "GEMINI_API_ERROR",
        status || 500,
        {
            responseData:
                data,
        }
    );
};

// ============================================================
// REQUEST CONFIG
// ============================================================

const getRequestConfig = () => {
    const apiKey =
        process.env.GEMINI_API_KEY;

    if (
        !apiKey ||
        !String(
            apiKey
        ).trim()
    ) {
        const error =
            new Error(
                "GEMINI_API_KEY haijawekwa kwenye environment variables."
            );

        error.code =
            "GEMINI_API_KEY_MISSING";

        error.status =
            500;

        throw error;
    }

    return {
        timeout:
            GEMINI_TIMEOUT_MS,

        headers: {
            "Content-Type":
                "application/json",

            "x-goog-api-key":
                String(
                    apiKey
                ).trim()
        },

        maxContentLength:
            Infinity,

        maxBodyLength:
            Infinity
    };
};

// ============================================================
// INTERNAL GEMINI REQUEST
// ============================================================

const makeGeminiRequestInternal =
    async (
        payload
    ) => {
        const url =
            getGeminiUrl();

        const response =
            await axios.post(
                url,
                payload,
                getRequestConfig()
            );

        return response.data;
    };

// ============================================================
// GEMINI REQUEST WITH FAST RETRIES
//
// 429 NEVER RETRIES.
//
// Temporary server errors can retry ONCE only.
// ============================================================

const makeGeminiRequest =
    async (
        payload
    ) => {
        let lastError =
            null;

        for (
            let attempt = 0;
            attempt <=
            MAX_RETRIES;
            attempt++
        ) {
            try {
                console.log(
                    "============================================================"
                );

                console.log(
                    "GEMINI REQUEST START"
                );

                console.log(
                    "MODEL:",
                    GEMINI_MODEL
                );

                console.log(
                    "ATTEMPT:",
                    `${attempt + 1}/${MAX_RETRIES + 1}`
                );

                console.log(
                    "TIMEOUT:",
                    `${GEMINI_TIMEOUT_MS}ms`
                );

                console.log(
                    "MAX OUTPUT TOKENS:",
                    GEMINI_MAX_OUTPUT_TOKENS
                );

                console.log(
                    "============================================================"
                );

                const response =
                    await makeGeminiRequestInternal(
                        payload
                    );

                console.log(
                    "============================================================"
                );

                console.log(
                    "GEMINI REQUEST SUCCESS"
                );

                console.log(
                    "============================================================"
                );

                return response;
            } catch (
                error
            ) {
                lastError =
                    error;

                const status =
                    error?.response
                        ?.status;

                console.error(
                    "============================================================"
                );

                console.error(
                    "GEMINI REQUEST FAILED"
                );

                console.error(
                    "STATUS:",
                    status ||
                        error?.code ||
                        "UNKNOWN"
                );

                console.error(
                    "MESSAGE:",
                    error?.response
                        ?.data
                        ?.error
                        ?.message ||
                        error?.message
                );

                console.error(
                    "============================================================"
                );

                // ====================================================
                // 429 MUST FAIL IMMEDIATELY
                // ====================================================

                if (
                    status === 429
                ) {
                    handleGeminiError(
                        error
                    );
                }

                // ====================================================
                // Permanent errors
                // ====================================================

                if (
                    !shouldRetryGeminiRequest(
                        error
                    )
                ) {
                    handleGeminiError(
                        error
                    );
                }

                // ====================================================
                // Retry exhausted
                // ====================================================

                if (
                    attempt >=
                    MAX_RETRIES
                ) {
                    handleGeminiError(
                        error
                    );
                }

                // ====================================================
                // SHORT RETRY
                // ====================================================

                const delay =
                    getRetryDelay(
                        attempt,
                        error
                            ?.response
                            ?.headers ||
                            {}
                    );

                console.warn(
                    "Gemini temporary error."
                );

                console.warn(
                    `Retrying once after ${delay}ms`
                );

                await sleep(
                    delay
                );
            }
        }

        handleGeminiError(
            lastError
        );
    };

// ============================================================
// EXTRACT GEMINI TEXT
// ============================================================

const extractGeminiText =
    (
        response
    ) => {
        const candidates =
            response?.candidates ||
            [];

        if (
            !Array.isArray(
                candidates
            ) ||
            candidates.length === 0
        ) {
            throw createGeminiError(
                "Gemini haikurudisha candidate yoyote.",
                "GEMINI_EMPTY_RESPONSE",
                502
            );
        }

        let selectedCandidate =
            null;

        let selectedText =
            "";

        for (
            const candidate of
            candidates
        ) {
            const parts =
                candidate
                    ?.content
                    ?.parts ||
                [];

            const textParts =
                parts
                    .map(
                        (part) =>
                            typeof part?.text ===
                            "string"
                                ? part.text
                                : ""
                    )
                    .filter(
                        Boolean
                    );

            if (
                textParts.length
            ) {
                selectedCandidate =
                    candidate;

                selectedText =
                    textParts.join(
                        "\n"
                    );

                break;
            }
        }

        if (
            !selectedText
        ) {
            const firstCandidate =
                candidates[0];

            const finishReason =
                firstCandidate
                    ?.finishReason ||
                firstCandidate
                    ?.finish_reason ||
                "UNKNOWN";

            throw createGeminiError(
                `Gemini haikurudisha text. Finish reason: ${finishReason}`,
                "GEMINI_EMPTY_TEXT",
                502,
                {
                    finishReason,
                }
            );
        }

        const finishReason =
            selectedCandidate
                ?.finishReason ||
            selectedCandidate
                ?.finish_reason ||
            "";

        const normalizedFinishReason =
            String(
                finishReason
            ).toUpperCase();

        const usageMetadata =
            response?.usageMetadata ||
            response?.usage_metadata ||
            {};

        const outputTokenCount =
            usageMetadata
                ?.candidatesTokenCount ??
            usageMetadata
                ?.candidates_token_count ??
            usageMetadata
                ?.outputTokenCount ??
            usageMetadata
                ?.output_token_count ??
            null;

        console.log(
            "============================================================"
        );

        console.log(
            "GEMINI FINISH REASON:",
            finishReason ||
                "UNKNOWN"
        );

        console.log(
            "GEMINI OUTPUT TOKEN COUNT:",
            outputTokenCount ??
                "UNKNOWN"
        );

        console.log(
            "GEMINI RESPONSE LENGTH:",
            selectedText.length
        );

        console.log(
            "============================================================"
        );

        // ========================================================
        // MAX TOKENS
        // ========================================================

        if (
            normalizedFinishReason ===
            "MAX_TOKENS"
        ) {
            throw createGeminiError(
                "Gemini output ilikatika kabla JSON haijakamilika. Output token limit imefikiwa.",
                "GEMINI_OUTPUT_TRUNCATED",
                502,
                {
                    finishReason,
                    outputTokenCount,
                }
            );
        }

        // ========================================================
        // SAFETY
        // ========================================================

        if (
            normalizedFinishReason ===
            "SAFETY"
        ) {
            throw createGeminiError(
                "Gemini imezuia response kutokana na safety filtering.",
                "GEMINI_SAFETY_BLOCK",
                502,
                {
                    finishReason,
                }
            );
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
        throw createGeminiError(
            "Gemini ilirudisha response tupu.",
            "GEMINI_EMPTY_RESPONSE",
            502
        );
    }

    let text =
        String(
            rawText
        )
            .replace(
                /^\uFEFF/,
                ""
            )
            .trim();

    if (
        !text
    ) {
        throw createGeminiError(
            "Gemini ilirudisha response tupu.",
            "GEMINI_EMPTY_RESPONSE",
            502
        );
    }

    // ========================================================
    // REMOVE MARKDOWN FENCE
    // ========================================================

    text =
        text.replace(
            /^```json\s*/i,
            ""
        );

    text =
        text.replace(
            /^```\s*/i,
            ""
        );

    text =
        text.replace(
            /\s*```$/i,
            ""
        );

    text =
        text.trim();

    // ========================================================
    // FIND JSON START
    // ========================================================

    const firstObject =
        text.indexOf(
            "{"
        );

    const firstArray =
        text.indexOf(
            "["
        );

    let start =
        -1;

    if (
        firstObject === -1 &&
        firstArray === -1
    ) {
        throw createGeminiError(
            "Gemini ilirudisha response ambayo si valid JSON.",
            "GEMINI_INVALID_JSON",
            502
        );
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

    if (
        start > 0
    ) {
        text =
            text.slice(
                start
            );
    }

    // ========================================================
    // REMOVE TRAILING FENCE
    // ========================================================

    text =
        text.replace(
            /\s*```[\s\S]*$/,
            ""
        )
        .trim();

    // ========================================================
    // PARSE JSON
    // ========================================================

    try {
        JSON.parse(
            text
        );

        return text;
    } catch (
        error
    ) {
        const jsonError =
            createGeminiError(
                "Gemini ilirudisha response ambayo si valid JSON.",
                "GEMINI_INVALID_JSON",
                502,
                {
                    originalError:
                        error,
                    rawText:
                        text,
                }
            );

        throw jsonError;
    }
};

// ============================================================
// ASK GEMINI - TEXT
// ============================================================

export const askGemini =
    async (
        prompt
    ) => {
        if (
            !prompt ||
            !String(
                prompt
            ).trim()
        ) {
            throw createGeminiError(
                "Gemini prompt haipo.",
                "GEMINI_PROMPT_EMPTY",
                400
            );
        }

        const cleanPrompt =
            String(
                prompt
            );

        console.log(
            "============================================================"
        );

        console.log(
            "GEMINI EXAMINATION ANALYSIS"
        );

        console.log(
            "PROMPT LENGTH:",
            cleanPrompt.length
        );

        console.log(
            "============================================================"
        );

        const payload = {
            contents: [
                {
                    role:
                        "user",

                    parts: [
                        {
                            text:
                                cleanPrompt,
                        },
                    ],
                },
            ],

            generationConfig: {
                responseMimeType:
                    "application/json",

                maxOutputTokens:
                    GEMINI_MAX_OUTPUT_TOKENS,

                temperature:
                    GEMINI_TEMPERATURE,
            },
        };

        try {
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
            } catch (
                error
            ) {
                console.error(
                    "============================================================"
                );

                console.error(
                    "GEMINI INVALID JSON"
                );

                console.error(
                    "RESPONSE LENGTH:",
                    rawText?.length ||
                        0
                );

                console.error(
                    "RESPONSE PREVIEW:"
                );

                console.error(
                    String(
                        rawText ||
                            ""
                    ).slice(
                        0,
                        3000
                    )
                );

                console.error(
                    "RESPONSE TAIL:"
                );

                console.error(
                    String(
                        rawText ||
                            ""
                    ).slice(
                        -1500
                    )
                );

                console.error(
                    "============================================================"
                );

                throw error;
            }
        } catch (
            error
        ) {
            console.error(
                "============================================================"
            );

            console.error(
                "GEMINI EXAMINATION ANALYSIS FAILED"
            );

            console.error(
                "CODE:",
                error?.code
            );

            console.error(
                "STATUS:",
                error?.status
            );

            console.error(
                "MESSAGE:",
                error?.message
            );

            console.error(
                "============================================================"
            );

            throw error;
        }
    };

// ============================================================
// ASK GEMINI WITH PDF
// ============================================================

export const askGeminiWithPDF =
    async (
        prompt,
        pdfBase64
    ) => {
        if (
            !prompt ||
            !String(
                prompt
            ).trim()
        ) {
            throw createGeminiError(
                "Gemini prompt haipo.",
                "GEMINI_PROMPT_EMPTY",
                400
            );
        }

        if (
            !pdfBase64 ||
            !String(
                pdfBase64
            ).trim()
        ) {
            throw createGeminiError(
                "PDF data haipo.",
                "GEMINI_PDF_EMPTY",
                400
            );
        }

        const payload = {
            contents: [
                {
                    role:
                        "user",

                    parts: [
                        {
                            text:
                                String(
                                    prompt
                                ),
                        },

                        {
                            inlineData: {
                                mimeType:
                                    "application/pdf",

                                data:
                                    String(
                                        pdfBase64
                                    ),
                            },
                        },
                    ],
                },
            ],

            generationConfig: {
                responseMimeType:
                    "application/json",

                maxOutputTokens:
                    GEMINI_MAX_OUTPUT_TOKENS,

                temperature:
                    GEMINI_TEMPERATURE,
            },
        };

        try {
            const response =
                await makeGeminiRequest(
                    payload
                );

            const rawText =
                extractGeminiText(
                    response
                );

            return cleanGeminiJson(
                rawText
            );
        } catch (
            error
        ) {
            console.error(
                "============================================================"
            );

            console.error(
                "GEMINI PDF ANALYSIS FAILED"
            );

            console.error(
                "CODE:",
                error?.code
            );

            console.error(
                "STATUS:",
                error?.status
            );

            console.error(
                "MESSAGE:",
                error?.message
            );

            console.error(
                "============================================================"
            );

            throw error;
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
                    role:
                        "user",

                    parts: [
                        {
                            text:
                                'Return only this JSON object: {"ok":true}',
                        },
                    ],
                },
            ],

            generationConfig: {
                responseMimeType:
                    "application/json",

                maxOutputTokens:
                    256,

                temperature:
                    0,
            },
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
        GEMINI_TEMPERATURE,

    timeoutMs:
        GEMINI_TIMEOUT_MS,
};