import test from "node:test";
import assert from "node:assert/strict";

// Use dummy credentials before importing the controller. These tests must never
// connect to the production Supabase project or call the Gemini API.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test-only-placeholder-key-not-for-network-use";

const { analyzePaper } = await import("../controllers/ai.controller.js");

const createResponse = () => {
    const response = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };

    return response;
};

test("rejects an invalid exam ID before accessing external services", async () => {
    const response = createResponse();

    await analyzePaper(
        {
            body: { exam_id: "not-an-id", exam_subject_id: 1 },
            file: { buffer: Buffer.from("not a PDF"), originalname: "test.pdf" },
        },
        response
    );

    assert.equal(response.statusCode, 400);
    assert.equal(response.body?.success, false);
    assert.equal(response.body?.message, "Invalid exam ID.");
});

test("rejects an invalid exam-subject ID before accessing external services", async () => {
    const response = createResponse();

    await analyzePaper(
        {
            body: { exam_id: 1, exam_subject_id: 0 },
            file: { buffer: Buffer.from("not a PDF"), originalname: "test.pdf" },
        },
        response
    );

    assert.equal(response.statusCode, 400);
    assert.equal(response.body?.success, false);
    assert.equal(response.body?.message, "Invalid exam subject ID.");
});

test("rejects a missing PDF before accessing external services", async () => {
    const response = createResponse();

    await analyzePaper(
        {
            body: { exam_id: 1, exam_subject_id: 1 },
            file: undefined,
        },
        response
    );

    assert.equal(response.statusCode, 400);
    assert.equal(response.body?.success, false);
    assert.equal(response.body?.message, "Examination paper PDF is required.");
});
