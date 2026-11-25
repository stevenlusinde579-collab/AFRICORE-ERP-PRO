import test from "node:test";
import assert from "node:assert/strict";
import { estimateGeminiUsageCost, getGeminiStandardPricing } from "../services/geminiPricing.js";
test("prices Gemini 3.1 Flash-Lite", () => assert.deepEqual(getGeminiStandardPricing("gemini-3.1-flash-lite"), { input: 0.25, output: 1.50, cached: 0.025 }));
test("failed fallback models do not make a successful model unpriced", () => {
 const r=estimateGeminiUsageCost([{model:"gemini-3.8-flash",success:false},{model:"gemini-3.1-flash-lite",success:true,usageMetadata:{promptTokenCount:1000,candidatesTokenCount:200,totalTokenCount:1200}}],new Date("2026-11-25T00:00:00Z"));
 assert.equal(r.status,"estimated"); assert.ok(Math.abs(r.costUsd-0.00055)<1e-12); assert.equal(r.tokens.total,1200);
});
test("cached input and thinking tokens are priced separately", () => {
 const r=estimateGeminiUsageCost([{model:"gemini-2.5-flash-lite",success:true,usageMetadata:{promptTokenCount:1000,cachedContentTokenCount:400,candidatesTokenCount:100,thoughtsTokenCount:50,totalTokenCount:1150}}]);
 assert.ok(Math.abs(r.costUsd-(600*.10+400*.01+150*.40)/1_000_000)<1e-12);
});
test("applies Gemini 3.8 Flash rate change from 2027", () => assert.deepEqual(getGeminiStandardPricing("gemini-3.8-flash",new Date("2027-01-01T00:00:00Z")),{input:0.75,output:3.75,cached:0.075}));
test("unknown successful model is unpriced", () => { const r=estimateGeminiUsageCost([{model:"unlisted-model",success:true,usageMetadata:{totalTokenCount:100}}]); assert.equal(r.status,"missing_model_rate"); assert.equal(r.costUsd,null); });
test("missing usage metadata is distinguished", () => assert.equal(estimateGeminiUsageCost([{model:"gemini-3.1-flash-lite",success:false}]).status,"missing_usage_metadata"));

test("preserves token totals when a successful model has no known price", () => {
 const r=estimateGeminiUsageCost([{model:"unlisted-model",success:true,usageMetadata:{promptTokenCount:80,candidatesTokenCount:20,totalTokenCount:100}}]);
 assert.equal(r.status,"missing_model_rate");
 assert.equal(r.costUsd,null);
 assert.deepEqual(r.tokens,{prompt:80,candidates:20,thoughts:0,cached:0,total:100});
});
