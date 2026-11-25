// ============================================================
// GEMINI SERVICE
// ============================================================

import axios from "axios";

// ============================================================
// CONFIGURATION
// ============================================================

const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.5-flash-lite";

const GEMINI_BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

// ============================================================
// MODEL FALLBACKS
//
// Primary:
//   gemini-3.5-flash-lite
//
// Fallback:
//   gemini-3.1-flash-lite
//
// Keep the fallback list restricted to the Free Tier models
// selected for AfriCore. Temporary capacity/server/rate-limit
// errors and model-specific quota exhaustion may move to the
// next configured model.
//
// Permanent quota exhaustion does NOT keep retrying forever.
// ============================================================

const DEFAULT_MODEL_FALLBACKS = [
    "gemini-3.1-flash-lite",
    "gemini-3-flash",
    "gemini-2.5-flash-lite",
];

// The complete fallback chain has a strict 15-second budget.
// Time is shared across the remaining models so a slow/unresponsive
// provider cannot prevent later models from being attempted.
export const GEMINI_FAILOVER_BUDGET_MS = 15000;

const GEMINI_MODELS = [
    GEMINI_MODEL,
    ...DEFAULT_MODEL_FALLBACKS,
].filter(
    (model, index, array) =>
        model &&
        array.indexOf(model) === index
);

// ============================================================
// RETRIES
//
// Per-model retries are disabled; failures move straight to the next model.
// ============================================================

// Failover must be fast: do not retry a failed model. The next model
// is attempted immediately within the shared 15-second total budget.
const MAX_RETRIES = 0;

// ============================================================
// Legacy retry-delay helpers remain for Retry-After diagnostics only.
// They are not used to delay model failover.
// ============================================================

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
// NORMALIZE GEMINI ERROR TEXT
// ============================================================

const getGeminiErrorText = (
    error
) => {
    const data =
        error?.response?.data;

    const apiMessage =
        data?.error?.message ||
        data?.message ||
        error?.message ||
        "";

    return String(
        apiMessage
    ).toLowerCase();
};

// ============================================================
// DETECT DAILY / HARD QUOTA EXHAUSTION
//
// These conditions should NOT keep retrying.
//
// Examples:
//   quota exceeded
//   daily quota
//   daily limit
//   requests per day
//   generate requests per day
//   tokens per day
//   limit: 0
// ============================================================

const isHardQuotaExceeded = (
    error
) => {
    const status =
        error?.response?.status;

    if (
        status !== 429
    ) {
        return false;
    }

    const message =
        getGeminiErrorText(
            error
        );

    const data =
        error?.response?.data;

    const errorStatus =
        String(
            data?.error?.status ||
            ""
        ).toLowerCase();

    const combined =
        `${message} ${errorStatus}`;

    const hardQuotaPatterns = [
        "quota exceeded",
        "daily quota",
        "daily limit",
        "requests per day",
        "request per day",
        "tokens per day",
        "limit: 0",
        "per day",
        "quota_exceeded",
        "quota-exceeded",
    ];

    return hardQuotaPatterns.some(
        (pattern) =>
            combined.includes(
                pattern
            )
    );
};

// ============================================================
// DETECT TEMPORARY RATE LIMIT
//
// 429 does NOT automatically mean daily quota.
//
// A temporary rate-limit response can be retried.
//
// Examples:
//   too many requests
//   rate limit
//   rate_limit_exceeded
//   resource exhausted without daily quota wording
// ============================================================

const isTemporaryRateLimit = (
    error
) => {
    const status =
        error?.response?.status;

    if (
        status !== 429
    ) {
        return false;
    }

    if (
        isHardQuotaExceeded(
            error
        )
    ) {
        return false;
    }

    const message =
        getGeminiErrorText(
            error
        );

    const data =
        error?.response?.data;

    const errorStatus =
        String(
            data?.error?.status ||
            ""
        ).toLowerCase();

    const combined =
        `${message} ${errorStatus}`;

    const rateLimitPatterns = [
        "rate limit",
        "rate_limit",
        "too many requests",
        "too_many_requests",
        "temporarily rate",
        "resource exhausted",
        "resource_exhausted",
        "try again later",
        "requests per minute",
        "request per minute",
        "tokens per minute",
        "requests per second",
        "request per second",
    ];

    return rateLimitPatterns.some(
        (pattern) =>
            combined.includes(
                pattern
            )
    );
};

// ============================================================
// SHOULD RETRY GEMINI REQUEST
//
// Retry:
//   429 temporary rate-limit
//   500
//   502
//   503
//   504
//   network timeout/reset
//
// Do NOT retry:
//   hard quota
//   400
//   401
//   403
//   404
//   413
// ============================================================

const shouldRetryGeminiRequest = (
    error
) => {
    const status =
        error?.response?.status;

    if (
        status === 429
    ) {
        return isTemporaryRateLimit(
            error
        );
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
// TEMPORARY ERROR CHECK
//
// Used to decide whether to move to the next model.
// ============================================================

const isTemporaryGeminiError = (
    error
) => {
    const status =
        error?.response?.status;

    if (
        status === 429
    ) {
        return isTemporaryRateLimit(
            error
        );
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

// A hard quota applies to the current model. It must stop retries for that
// model, but it should not prevent trying the next configured fallback model.
// If every configured model is exhausted, the final quota error is returned.
export const isGeminiModelFallbackEligible = (error) =>
    isHardQuotaExceeded(error) ||
    isTemporaryGeminiError(error);

// ============================================================
// GEMINI URL
// ============================================================

const getGeminiUrl = (
    model = GEMINI_MODEL
) => {
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
        `${model}:generateContent`
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
    error,
    model = GEMINI_MODEL
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
    // 429 HARD QUOTA
    //
    // Daily/project quota exhausted.
    // Do not keep retrying.
    // ========================================================

    if (
        status === 429 &&
        isHardQuotaExceeded(
            error
        )
    ) {
        throw createGeminiError(
            "Gemini API quota ya matumizi imefika. AI analysis imesimamishwa bila kuendelea na retries zisizo na maana.",
            "GEMINI_QUOTA_EXCEEDED",
            429,
            {
                responseData:
                    data,

                model,

                retryAfter:
                    getRetryAfterMs(
                        error?.response
                            ?.headers ||
                            {}
                    ),

                quotaType:
                    "hard_quota",
            }
        );
    }

    // ========================================================
    // 429 TEMPORARY RATE LIMIT
    //
    // This should only be reached if the caller has exhausted
    // the configured temporary retries.
    // ========================================================

    if (
        status === 429
    ) {
        throw createGeminiError(
            "Gemini API rate limit imefika kwa muda. Mfumo umejaribu retry/fallback models lakini haukupata nafasi.",
            "GEMINI_RATE_LIMIT",
            429,
            {
                responseData:
                    data,

                model,

                retryAfter:
                    getRetryAfterMs(
                        error?.response
                            ?.headers ||
                            {}
                    ),

                quotaType:
                    "temporary_rate_limit",
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

                model,
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
            `Gemini model "${model}" haipatikani.`,
            "GEMINI_MODEL_NOT_FOUND",
            404,
            {
                responseData:
                    data,

                model,
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

                model,
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

                model,
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
            504,
            {
                model,
            }
        );
    }

    if (
        error?.code ===
        "ECONNRESET"
    ) {
        throw createGeminiError(
            "Connection ya Gemini imekatika wakati wa analysis.",
            "GEMINI_NETWORK_ERROR",
            503,
            {
                model,
            }
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

                model,
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

            model,
        }
    );
};

// ============================================================
// REQUEST CONFIG
// ============================================================

const getRequestConfig = (timeoutMs = GEMINI_TIMEOUT_MS) => {
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
            Math.max(1, Math.min(GEMINI_TIMEOUT_MS, timeoutMs)),

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
        payload,
        model,
        timeoutMs = GEMINI_TIMEOUT_MS
    ) => {
        const url =
            getGeminiUrl(
                model
            );

        const response =
            await axios.post(
                url,
                payload,
                getRequestConfig(timeoutMs)
            );

        return response.data;
    };

// ============================================================
// GEMINI REQUEST WITH MODEL FALLBACK
//
// Flow:
//   gemini-3.5-flash-lite
//     ↓ immediate failover on temporary error or model quota exhaustion
//   gemini-3.1-flash-lite
//     ↓
//   gemini-3-flash
//     ↓
//   gemini-2.5-flash-lite
//
// All configured models share one strict 15-second failover budget.
//
// HARD QUOTA:
//   Stop retries for the affected model and try the next
//   configured Free Tier model.
//
// PERMANENT ERROR:
//   Stop immediately.
//
// ============================================================

const makeGeminiRequest =
    async (
        payload,
        includeUsage = false
    ) => {
        const usageAttempts = [];
        let lastError = null;
        const failoverStartedAt = Date.now();
        const failoverDeadline = failoverStartedAt + GEMINI_FAILOVER_BUDGET_MS;

        for (
            let modelIndex = 0;
            modelIndex <
            GEMINI_MODELS.length;
            modelIndex++
        ) {
            const currentModel =
                GEMINI_MODELS[
                    modelIndex
                ];

            let modelLastError = null;
            const remainingModels = GEMINI_MODELS.length - modelIndex;
            const remainingBudget = Math.max(1, failoverDeadline - Date.now());
            const modelTimeoutMs = Math.max(
                1,
                Math.floor(remainingBudget / remainingModels)
            );

            if (Date.now() >= failoverDeadline) {
                console.error("GEMINI FAILOVER DEADLINE REACHED", {
                    attemptedModels: usageAttempts.map((attempt) => attempt.model),
                    budgetMs: GEMINI_FAILOVER_BUDGET_MS,
                });
                break;
            }

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
                        currentModel
                    );

                    console.log(
                        "MODEL INDEX:",
                        `${modelIndex + 1}/${GEMINI_MODELS.length}`
                    );

                    console.log(
                        "ATTEMPT:",
                        `${attempt + 1}/${MAX_RETRIES + 1}`
                    );

                    console.log(
                        "MODEL TIMEOUT:",
                        `${modelTimeoutMs}ms`
                    );
                    console.log(
                        "FAILOVER BUDGET REMAINING:",
                        `${Math.max(0, failoverDeadline - Date.now())}ms`
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
                            payload,
                            currentModel,
                            modelTimeoutMs
                        );

                    console.log(
                        "============================================================"
                    );

                    console.log(
                        "GEMINI REQUEST SUCCESS"
                    );

                    console.log(
                        "MODEL USED:",
                        currentModel
                    );

                    console.log(
                        "============================================================"
                    );

                    usageAttempts.push({ model: currentModel, success: true, usageMetadata: response?.usageMetadata || response?.usage_metadata || null });
                    return includeUsage ? { response, usageAttempts } : response;
                } catch (
                    error
                ) {
                    usageAttempts.push({ model: currentModel, success: false, status: error?.response?.status || null });
                    lastError =
                        error;

                    modelLastError =
                        error;

                    const status =
                        error?.response
                            ?.status;

                    const temporaryRateLimit =
                        isTemporaryRateLimit(
                            error
                        );

                    const hardQuota =
                        isHardQuotaExceeded(
                            error
                        );

                    console.error(
                        "============================================================"
                    );

                    console.error(
                        "GEMINI REQUEST FAILED"
                    );

                    console.error(
                        "MODEL:",
                        currentModel
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

                    if (
                        status === 429
                    ) {
                        console.error(
                            "429 TYPE:",
                            hardQuota
                                ? "HARD QUOTA"
                                : temporaryRateLimit
                                    ? "TEMPORARY RATE LIMIT"
                                    : "UNKNOWN 429"
                        );
                    }

                    console.error(
                        "============================================================"
                    );

                    // ====================================================
                    // HARD QUOTA
                    //
                    // Never retry.
                    // Never switch model.
                    // ====================================================

                    if (
                        status === 429 &&
                        hardQuota
                    ) {
                        console.warn(
                            "Gemini daily/project quota reached for this model; skipping retries and trying the next configured model."
                        );
                        break;
                    }

                    // ====================================================
                    // UNKNOWN 429
                    //
                    // We treat an unclassified 429 as a temporary
                    // rate limit rather than blindly declaring daily
                    // quota exhausted.
                    // ====================================================

                    if (
                        status === 429 &&
                        !hardQuota &&
                        !temporaryRateLimit
                    ) {
                        console.warn(
                            "Gemini returned an unclassified 429."
                        );

                        console.warn(
                            "Treating it as temporary rate limit."
                        );
                    }

                    // ====================================================
                    // PERMANENT ERRORS
                    // ====================================================

                    if (
                        !shouldRetryGeminiRequest(
                            error
                        ) &&
                        status !== 429
                    ) {
                        handleGeminiError(
                            error,
                            currentModel
                        );
                    }

                    // ====================================================
                    // FAST FAILOVER
                    //
                    // Do not spend time retrying a failed model. Move
                    // immediately to the next configured model so the
                    // entire chain stays inside the 15-second budget.
                    // ====================================================

                    if (
                        attempt <
                        MAX_RETRIES
                    ) {
                        const delay =
                            getRetryDelay(
                                attempt,
                                error
                                    ?.response
                                    ?.headers ||
                                    {}
                            );

                        if (
                            status === 429
                        ) {
                            console.warn(
                                "Gemini temporary rate limit."
                            );
                        } else {
                            console.warn(
                                "Gemini temporary server/network error."
                            );
                        }

                        console.warn(
                            "MODEL:",
                            currentModel
                        );

                        console.warn(
                            `Retrying same model after ${delay}ms`
                        );

                        await sleep(delay);

                        continue;
                    }

                    // ====================================================
                    // SAME MODEL RETRIES EXHAUSTED
                    // ====================================================

                    break;
                }
            }

            // ============================================================
            // MODEL FAILED
            //
            // Move to the next configured model when this model has
            // a temporary outage/rate limit OR its own hard quota is
            // exhausted. A hard quota must never be retried on the same model.
            // ============================================================

            if (
                isGeminiModelFallbackEligible(
                    modelLastError
                ) &&
                modelIndex <
                    GEMINI_MODELS.length -
                        1
            ) {
                const nextModel =
                    GEMINI_MODELS[
                        modelIndex + 1
                    ];

                console.warn(
                    "============================================================"
                );

                console.warn(
                    "GEMINI MODEL FALLBACK"
                );

                console.warn(
                    "FAILED MODEL:",
                    currentModel
                );

                console.warn(
                    "NEXT MODEL:",
                    nextModel
                );

                console.warn(
                    "STATUS:",
                    modelLastError
                        ?.response
                        ?.status ||
                        modelLastError
                            ?.code ||
                        "UNKNOWN"
                );

                console.warn(
                    "REASON:",
                    modelLastError
                        ?.response
                        ?.data
                        ?.error
                        ?.message ||
                        modelLastError
                            ?.message ||
                        "Temporary Gemini error"
                );

                console.warn(
                    "============================================================"
                );

                continue;
            }

            // ============================================================
            // NO MORE FALLBACK MODELS
            // ============================================================

            if (
                modelLastError
            ) {
                handleGeminiError(
                    modelLastError,
                    currentModel
                );
            }
        }

        handleGeminiError(
            lastError,
            GEMINI_MODEL
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
// REPAIR UNESCAPED DOUBLE QUOTES INSIDE JSON STRINGS
//
// Gemini can occasionally return natural-language quotes inside
// a JSON string without escaping them. Repair only quotes that
// cannot plausibly close a JSON token, then validate the complete
// result with JSON.parse before accepting it.
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

        // A comma after a quoted word may be ordinary sentence
        // punctuation (for example, 'Choose "A", "B" or "C"').
        // Treat it as a JSON delimiter only when what follows
        // looks like the end of a container or another object key.
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
        // Attempt a narrow repair for unescaped quotation marks
        // in natural-language fields. Never accept repaired text
        // unless the entire result passes JSON.parse.
        try {
            const repairedText =
                repairUnescapedJsonStringQuotes(
                    text
                );

            JSON.parse(
                repairedText
            );

            console.warn(
                "GEMINI JSON QUOTE REPAIR SUCCESS"
            );

            return repairedText;
        } catch (
            repairError
        ) {
            const jsonError =
                createGeminiError(
                    "Gemini ilirudisha response ambayo si valid JSON.",
                    "GEMINI_INVALID_JSON",
                    502,
                    {
                        originalError:
                            error,

                        repairError:
                            repairError?.message || null,

                        rawText:
                            text,
                    }
                );

            throw jsonError;
        }
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
            "AVAILABLE MODELS:",
            GEMINI_MODELS.join(
                " -> "
            )
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
            const response = await makeGeminiRequest(payload);

            const rawText =
                extractGeminiText(
                    response
                );

            try {
                return cleanGeminiJson(rawText);
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
                "MODEL:",
                error?.model
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

        let usageAttempts = [];

        try {
            const requestResult = await makeGeminiRequest(payload, true);
            const response = requestResult.response;
            usageAttempts = [...requestResult.usageAttempts];

            const rawText =
                extractGeminiText(
                    response
                );

            try {
                return { text: cleanGeminiJson(rawText), usageAttempts };
            } catch (firstParseError) {
                // A malformed JSON response should not immediately fail a
                // valid uploaded paper. Retry once with the same PDF and a
                // stricter repair instruction; never attempt to guess missing
                // fields or accept incomplete JSON.
                if (
                    ![
                        "GEMINI_INVALID_JSON",
                        "INVALID_AI_JSON",
                    ].includes(firstParseError?.code)
                ) {
                    throw firstParseError;
                }

                console.warn(
                    "GEMINI PDF JSON RETRY: first response was invalid; retrying once with stricter JSON-only instructions."
                );

                const retryPrompt = [
                    String(prompt),
                    "",
                    "REQUIRED RECOVERY INSTRUCTION:",
                    "Your previous response was not valid complete JSON. Analyze the attached PDF again and return exactly one complete JSON object matching the Expected JSON structure above.",
                    "Do not shorten the analysis by omitting required keys. Do not use markdown fences, comments, trailing commas, or text outside the JSON.",
                    "Escape all quotation marks and control characters inside JSON strings. Ensure every object and array is fully closed before finishing.",
                    "Keep the paper's actual structure and evidence-based marks. Do not invent questions or marks to make the JSON easier to produce.",
                ].join("\n");

                const retryPayload = {
                    contents: [
                        {
                            role: "user",
                            parts: [
                                { text: retryPrompt },
                                {
                                    inlineData: {
                                        mimeType: "application/pdf",
                                        data: String(pdfBase64),
                                    },
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        responseMimeType: "application/json",
                        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
                        temperature: 0,
                    },
                };

                const retryRequestResult = await makeGeminiRequest(retryPayload, true);
                usageAttempts.push(...retryRequestResult.usageAttempts);
                const retryText = extractGeminiText(retryRequestResult.response);

                try {
                    return { text: cleanGeminiJson(retryText), usageAttempts };
                } catch (retryParseError) {
                    console.error(
                        "GEMINI PDF JSON RETRY FAILED:",
                        JSON.stringify({
                            firstError: firstParseError?.code || firstParseError?.message,
                            retryError: retryParseError?.code || retryParseError?.message,
                            firstResponseLength: String(rawText || "").length,
                            retryResponseLength: String(retryText || "").length,
                        })
                    );

                    const error = createGeminiError(
                        "Gemini ilirudisha JSON isiyokamilika hata baada ya jaribio la pili. PDF imehifadhiwa; jaribu tena au punguza kurasa za PDF ikiwa ni ndefu sana.",
                        "GEMINI_INVALID_JSON_AFTER_RETRY",
                        502,
                        {
                            firstError: firstParseError?.code || firstParseError?.message,
                            retryError: retryParseError?.code || retryParseError?.message,
                            firstResponseLength: String(rawText || "").length,
                            retryResponseLength: String(retryText || "").length,
                        }
                    );
                    throw error;
                }
            }
        } catch (
            error
        ) {
            if (usageAttempts.length) error.usageAttempts = usageAttempts;
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
                "MODEL:",
                error?.model
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

    models:
        GEMINI_MODELS,

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

    failoverBudgetMs:
        GEMINI_FAILOVER_BUDGET_MS,
};