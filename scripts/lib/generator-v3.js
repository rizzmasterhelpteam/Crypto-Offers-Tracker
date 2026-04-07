/**
 * generator-v3.js - 4-Step High-Authority Pipeline
 * Version: Hostile Grounded (Anti-Hallucination)
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
 * STEP 1: Keyword Discovery (llama-4-scout-17b)
 */
async function discoverKeywords(trendingContext, history = []) {
    console.log(`[Step 1] Discovering Keywords (llama-4-scout-17b)...`);
    const historyBlock = history.length > 0
        ? `\nDO NOT USE any of these recently covered keywords: ${history.join(', ')}`
        : "";

    const systemPrompt = `You are a senior SEO and crypto market analyst. Today is ${config.CURRENT_DATE}.
TASK: Analyze the provided trending context and identify ONE high-potential "mid-volume, low-competition" keyword for a technical blog post.
CRITERIA:
- Mid-volume: 500-2000 monthly searches (simulated).
- Low-competition: Not dominated by mainstream media; technical or niche.
- Topic: Must be related to the 2026 technical roadmap (L2/L3 scaling, AI agents, RWA, or Institutional DeFi).${historyBlock}

OUTPUT ONLY: The selected keyword.`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `TRENDING CONTEXT:\n${trendingContext}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.8);
}

/**
 * STEP 2: Source Analysis & E-E-A-T Drafting (gpt-oss-120b)
 */
async function draftProfessionalBlog(keyword, sourceText) {
    console.log(`[Step 2] Grounded Drafting (gpt-oss-120b)...`);
    const knowledgeBase = JSON.stringify(config.PROJECT_KNOWLEDGE, null, 2);

    const systemPrompt = `You are a Hostilely Grounded technical crypto researcher. 
Today's Date: ${config.CURRENT_DATE}.
GOAL: Write a 800-word professional blog post for the keyword "${keyword}".

ANTI-HALLUCINATION RULES:
1. SOURCE ONLY: If a protocol/project is NOT in the "SOURCE DOCUMENTS" or the "PROJECT KNOWLEDGE" base below, it DOES NOT EXIST. Never invent projects.
2. INTENT ALIGNMENT: Strictly follow the technical layer (L1, L2, or L3) and category (RWA, AI, etc.) requested in the keyword. If it asks for L2, do NOT write about L1 or L3.
3. GROUND TRUTH: Use the PROJECT KNOWLEDGE base as the final arbiter of truth for specific protocol mechanics.

HTML FORMATTING RULES:
1. NO MARKDOWN: Absolutely zero '#', '*', or '---' symbols. Use pure HTML only.
2. STRUCTURE: Use 'takeaways-card', 'insight-card', and 'comparison-table' as defined in global CSS.
3. P.O.V.: Objective third-person only. 

SOURCE DOCUMENTS:
${sourceText}

PROJECT KNOWLEDGE (Ground Truth):
${knowledgeBase}`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write the HOSTILELY GROUNDED premium HTML blog post for: ${keyword}` }
    ], 'openai/gpt-oss-120b', 0.5);
}

/**
 * STEP 3: Source Verification & Correction (llama-4-scout-17b)
 */
async function firstFactCheck(draftContent, sourceText) {
    console.log(`[Step 3] Factual Audit (llama-4-scout-17b)...`);
    const knowledgeBase = JSON.stringify(config.PROJECT_KNOWLEDGE, null, 2);

    const systemPrompt = `You are a Hostile Factual Auditor. 
TASK: Cross-reference the DRAFT against the SOURCE DOCUMENTS and PROJECT KNOWLEDGE.
STRICT AUDIT TASKS:
1. DETECT FABRICATION: Identify any protocol/project mentioned in the draft that IS NOT present in the sources or Knowledge Base. DELETE them immediately.
2. FIX INTENT: Ensure the article strictly addresses the requested technical architecture (e.g., if keyword is about L2, ensure L1 content is minimized).
3. PURE HTML: Ensure zero markdown symbols remain.

OUTPUT ONLY: The ground-truthed, corrected HTML body.

PROJECT KNOWLEDGE:
${knowledgeBase}

SOURCES:
${sourceText}`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DRAFT:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.1);
}

/**
 * STEP 4: Final Intent & Technical Audit (llama-4-scout-17b)
 */
async function finalFactCheck(draftContent, sourceText) {
    console.log(`[Step 4] Final Intent Audit (llama-4-scout-17b)...`);
    const systemPrompt = `You are the Lead Technical Editor.
TASK: Final audit for "Intent Alignment" and "Zero-Hallucination".
RULES:
1. INTENT MISMATCH: If the user asked for "RWA on L2" and you wrote about "Solana L1", this is a FAIL. Rewrite sections to align with the specific layer/intent requested.
2. PROTOCOL VERIFICATION: Ensure every cited project is real and present in the sources.
3. VISUALS: Ensure all cards and tables are rendered with pure HTML tags.

OUTPUT ONLY: The final, high-authority, 100% grounded HTML article.`;

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
