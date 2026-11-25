const PRICING = {
    "gemini-3.1-flash-lite": { input: 0.25, output: 1.50, cached: 0.025 },
    "gemini-3-flash": { input: 0.50, output: 3.00, cached: 0.05 },
    "gemini-3-flash-preview": { input: 0.50, output: 3.00, cached: 0.05 },
    "gemini-2.5-flash-lite": { input: 0.10, output: 0.40, cached: 0.01 },
    "gemini-3.5-flash-lite": { input: 0.30, output: 2.50, cached: 0.03 },
};
const normalizeModel = (value) => String(value || "").toLowerCase().replace(/^models\//, "").trim();
export const getGeminiStandardPricing = (model, at = new Date()) => {
    const name = normalizeModel(model);
    if (["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"].includes(name)) {
        const future = new Date(at) >= new Date("2027-01-01T00:00:00Z");
        return future ? { input: 1.50, output: 7.50, cached: 0.15 } : { input: 0.75, output: 3.75, cached: 0.075 };
    }
    if (name === "gemini-3-flash" || name.startsWith("gemini-3-flash-preview")) return PRICING["gemini-3-flash"];
    for (const [prefix, rates] of Object.entries(PRICING)) {
        if (name === prefix || name.startsWith(prefix + "-")) return rates;
    }
    return null;
};
const readCount = (meta, ...keys) => {
    for (const key of keys) {
        if (meta?.[key] !== undefined && meta?.[key] !== null) {
            const value = Number(meta[key]);
            if (Number.isFinite(value) && value >= 0) return value;
        }
    }
    return 0;
};
export const estimateGeminiUsageCost = (usageAttempts = [], at = new Date()) => {
    const successful = usageAttempts.filter((item) => item?.success && item?.usageMetadata);
    const totals = { prompt: 0, candidates: 0, thoughts: 0, cached: 0, total: 0 };
    if (!successful.length) return { status: "missing_usage_metadata", costUsd: null, inputRate: null, outputRate: null, tokens: totals };
    let costUsd = 0, inputCost = 0, outputCost = 0, inputTokenBasis = 0, outputTokenBasis = 0;
    for (const item of successful) {
        const meta = item.usageMetadata;
        const rates = getGeminiStandardPricing(item.model, at);
        if (!rates) return { status: "missing_model_rate", costUsd: null, inputRate: null, outputRate: null, tokens: totals };
        const prompt = readCount(meta, "promptTokenCount", "prompt_token_count");
        const candidates = readCount(meta, "candidatesTokenCount", "candidates_token_count", "outputTokenCount", "output_token_count");
        const thoughts = readCount(meta, "thoughtsTokenCount", "thoughts_token_count");
        const cached = Math.min(prompt, readCount(meta, "cachedContentTokenCount", "cached_content_token_count"));
        const total = readCount(meta, "totalTokenCount", "total_token_count") || prompt + candidates + thoughts;
        totals.prompt += prompt; totals.candidates += candidates; totals.thoughts += thoughts; totals.cached += cached; totals.total += total;
        const uncachedInput = Math.max(0, prompt - cached), output = candidates + thoughts;
        const thisInputCost = (uncachedInput * rates.input + cached * rates.cached) / 1_000_000;
        const thisOutputCost = output * rates.output / 1_000_000;
        costUsd += thisInputCost + thisOutputCost; inputCost += thisInputCost; outputCost += thisOutputCost;
        inputTokenBasis += prompt; outputTokenBasis += output;
    }
    if (totals.total <= 0) return { status: "missing_usage_metadata", costUsd: null, inputRate: null, outputRate: null, tokens: totals };
    return { status: "estimated", costUsd,
        inputRate: inputTokenBasis > 0 ? inputCost * 1_000_000 / inputTokenBasis : 0,
        outputRate: outputTokenBasis > 0 ? outputCost * 1_000_000 / outputTokenBasis : 0, tokens: totals };
};
