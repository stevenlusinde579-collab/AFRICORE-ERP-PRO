import test from "node:test";
import assert from "node:assert/strict";
import { isGeminiModelFallbackEligible } from "../services/gemini.service.js";

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
