/**
 * generator-v3.js - 4-Step High-Authority Pipeline
 * Models: Step 1 (llama-4-scout-17b), Step 2 (gpt-oss-120b), Step 3 & 4 (llama-4-scout-17b)
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
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.7);
}

/**
 * STEP 2: Source Analysis & E-E-A-T Drafting (gpt-oss-120b)
 */
async function draftProfessionalBlog(keyword, sourceText) {
    console.log(`[Step 2] Source Analysis & Drafting (gpt-oss-120b)...`);
    const systemPrompt = `You are an elite technical crypto researcher and writer. 
Today's Date: ${config.CURRENT_DATE}.
GOAL: Write a 600-800 word professional blog post about the keyword "${keyword}".

E-E-A-T & PREMIUM FORMATTING REQUIREMENTS:
1. SEO: Use "${keyword}" as the H1 title. Naturalize the opening paragraph.
2. TAKEAWAYS: Mandatory '<div class="takeaways-card"><h4>Key Takeaways</h4><ul>...</ul></div>' immediately below the intro.
3. INSIGHTS: Include at least one '<div class="insight-card">...</div>' for analyst perspective.
4. STRUCTURE: Use H2s for main sections and H3s for nested details. 
5. DATA: Every benchmark (fees, TPS, finality) MUST be in a '<div class="comparison-table-wrapper"><table class="comparison-table">...</table></div>'.
6. P.O.V.: Use third-person objective voice. NEVER use "Our", "We", or "My". Always name the projects (e.g., "The Provenance platform").
7. NO FILLER: Absolutely NO "Conclusion" headers or cliché AI sign-offs. End cleanly after "Future Outlook".
8. BACKLINKS: Include 2-3 direct <a> links to source URLs.

SOURCE DOCUMENTS:
${sourceText}`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write the premium, 800-word SEO-optimized blog post for: ${keyword}` }
    ], 'openai/gpt-oss-120b', 0.6);
}

/**
 * STEP 3: First Fact-Check & Fix (llama-4-scout-17b)
 */
async function firstFactCheck(draftContent, sourceText) {
    console.log(`[Step 3] First Fact-Check & Fix (llama-4-scout-17b)...`);
    const systemPrompt = `You are a Hostile Technical Fact-Checker. 
TASK: Compare the draft against the sources. Identify and FIX errors.
STRICT AUDIT RULES:
1. P.O.V. AUDIT: Change first-person "Our/We/My" to the specific project name from the source.
2. VISUAL AUDIT: Ensure '<div class="takeaways-card">', '<div class="insight-card">', and '<table class="comparison-table">' are used correctly.
3. SCRUB FILLER: Delete "Conclusion" headers and generic sign-offs.
4. FACTUAL FIX: Fix inaccuracies based on the sources.
OUTPUT ONLY: The corrected HTML article body.`;

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
    const systemPrompt = `You are the Final Auditor. Ensure the draft is perfect.
STRICT RULES:
1. SCRUB AI ARTIFACTS: Ensure NO "Conclusion" sections remain.
2. P.O.V. ENFORCEMENT: Ensure 100% objective third-person project-based naming.
3. VISUAL POLISH: Verify all tables and cards use premium CSS classes (takeaways-card, comparison-table, insight-card).
4. FACTUAL CONSISTENCY: Match the sources perfectly.
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
