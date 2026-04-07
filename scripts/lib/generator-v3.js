/**
 * generator-v3.js - 4-Step High-Authority Pipeline
 * Models: Step 1 & 2 (gpt-oss-120b), Step 3 & 4 (llama-4-scout-17b)
 */
const config = require('./config');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

function logUsage(model, promptTokens, completionTokens, totalTokens) {
    const fs = require('fs');
    const timestamp = new Date().toISOString();
    const entry = `${timestamp} | Model: ${model} | Prompt: ${promptTokens} | Completion: ${completionTokens} | Total: ${totalTokens}\n`;
    try { fs.appendFileSync(config.USAGE_LOG_PATH, entry); } catch (e) { /* non-fatal */ }
}

async function callGroq(messages, model, temperature = 0.5) {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set.");

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature, max_tokens: 4000 })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.usage) {
        logUsage(model, data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
    }
    return data.choices[0].message.content.trim();
}

/**
 * STEP 1: Keyword Discovery (gpt-oss-120b)
 * Searches for mid-volume and low competition keywords.
 */
async function discoverKeywords(trendingContext) {
    console.log(`[Step 1] Discovering Keywords (gpt-oss-120b)...`);
    const systemPrompt = `You are a senior SEO and crypto market analyst. Today is ${config.CURRENT_DATE}.
TASK: Analyze the provided trending context and identify ONE high-potential "mid-volume, low-competition" keyword for a technical blog post.
CRITERIA:
- Mid-volume: 500-2000 monthly searches (simulated).
- Low-competition: Not dominated by mainstream media; technical or niche.
- Topic: Must be related to the 2026 technical roadmap (L2/L3 scaling, AI agents, RWA, or Institutional DeFi).

OUTPUT ONLY: The selected keyword.`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `TRENDING CONTEXT:\n${trendingContext}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.7);
}

/**
 * STEP 2: Source Analysis & E-E-A-T Drafting (gpt-oss-120b)
 * Searches for trustable sources, analyzes them, and writes a professional blog with backlinks.
 */
async function draftProfessionalBlog(keyword, sourceText) {
    console.log(`[Step 2] Source Analysis & Drafting (gpt-oss-120b)...`);
    const systemPrompt = `You are an elite technical crypto researcher and writer. 
Today's Date: ${config.CURRENT_DATE}.
GOAL: Write a 600-800 word professional blog post about the keyword "${keyword}".

E-E-A-T REQUIREMENTS:
- Depth: Technical, analytical, and authoritative.
- Logic: Direct source attribution (e.g., "[Verified via L2Beat]").
- BACKLINKS: You MUST include at least 2-3 direct <a> links to the provided source URLs.
- Format: HTML with <h2>, <p>, <ul>, and <strong>.

SOURCE DOCUMENTS:
${sourceText}`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write the high-ranking, 800-word SEO-optimized blog post for: ${keyword}` }
    ], 'openai/gpt-oss-120b', 0.6);
}

/**
 * STEP 3: First Fact-Check & Fix (llama-4-scout-17b)
 */
async function firstFactCheck(draftContent, sourceText) {
    console.log(`[Step 3] First Fact-Check & Fix (llama-4-scout-17b)...`);
    const systemPrompt = `You are a Hostile Technical Fact-Checker. 
TASK: Compare the draft against the sources. 
Identify and FIX every technical error, hallucination, or synthetic hype.
STRICT RULES:
1. DO NOT DELETE entire sections if they contain salvageable info; FIX the inaccuracies instead.
2. DELETION is only permitted if a statement or claim is FULLY IMAGINARY and lacks any grounding in the sources.
3. Ensure the technical depth is maintained while ensuring 100% accuracy.
OUTPUT ONLY: The corrected HTML article.`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `SOURCES:\n${sourceText}\n\nDRAFT:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.1);
}

/**
 * STEP 4: Final Fact-Check & Publish (llama-4-scout-17b)
 */
async function finalFactCheck(draftContent, sourceText) {
    console.log(`[Step 4] Final Fact-Check & Publish (llama-4-scout-17b)...`);
    const systemPrompt = `You are the Final Auditor.
TASK: Perform a second, independent fact-check pass. 
STRICT RULES:
1. FOCUS ON FIXING: Adjust language and data to match the sources perfectly.
2. MINIMAL DELETION: Only remove content that is demonstrably and entirely fabricated (hallucinated).
3. Ensure technical consistency, professional tone, and valid formatting.
OUTPUT ONLY: The final, polished HTML article for publication.`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `SOURCES:\n${sourceText}\n\nDRAFT:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.1);
}

module.exports = {
    discoverKeywords,
    draftProfessionalBlog,
    firstFactCheck,
    finalFactCheck
};
