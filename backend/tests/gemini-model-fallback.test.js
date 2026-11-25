import test from "node:test";
import assert from "node:assert/strict";
import { GEMINI_FAILOVER_BUDGET_MS, isGeminiModelFallbackEligible } from "../services/gemini.service.js";

test("uses a strict 15-second total budget for the Gemini model failover chain", () => {
    assert.equal(GEMINI_FAILOVER_BUDGET_MS, 15000);
});

test("falls through to the next model when the current model daily quota is exhausted", () => {
    const error = {
        response: {
            status: 429,
            data: {
                error: {
                    message: "You exceeded your current quota. Generate content requests per day limit exceeded.",
                    status: "RESOURCE_EXHAUSTED",
                },
            },
        },
    };
    assert.equal(isGeminiModelFallbackEligible(error), true);
});

test("falls through to the next model during temporary Gemini capacity errors", () => {
    const error = {
        response: {
            status: 503,
            data: { error: { message: "The model is currently experiencing high demand." } },
        },
    };
    assert.equal(isGeminiModelFallbackEligible(error), true);
});

test("falls through to the next model for temporary rate limits but not permanent auth errors", () => {
    const rateLimit = {
        response: {
            status: 429,
            data: { error: { message: "Too many requests per minute." } },
        },
    };
    const authError = { response: { status: 403, data: { error: { message: "Permission denied." } } } };
    assert.equal(isGeminiModelFallbackEligible(rateLimit), true);
    assert.equal(isGeminiModelFallbackEligible(authError), false);
});

test("does not treat a generic quota word outside a 429 response as model quota exhaustion", () => {
    const badRequest = {
        response: {
            status: 400,
            data: { error: { message: "Invalid request quota field." } },
        },
    };
    assert.equal(isGeminiModelFallbackEligible(badRequest), false);
});


test("fails over on an unclassified 429 response instead of stopping at the current model", () => {
    const unknownRateLimit = { response: { status: 429, data: { error: { message: "Resource exhausted." } } } };
    assert.equal(isGeminiModelFallbackEligible(unknownRateLimit), true);
});


test("fails over when a configured Gemini model ID is unavailable", () => {
    assert.equal(isGeminiModelFallbackEligible({ response: { status: 404 } }), true);
});
