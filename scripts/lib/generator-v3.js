/**
 * generator-v3.js - 4-Step High-Authority Pipeline
 * Version: Expert Writer + Hostile Auditor (separated concerns)
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
 * STEP 2: Expert Drafting (gpt-oss-120b)
 * Role: Confident expert writer. Produces vivid, specific, high-quality prose.
 * All grounding/hallucination checks happen AFTER in Steps 3 & 4.
 */
async function draftProfessionalBlog(keyword, sourceText) {
    console.log(`[Step 2] Expert Drafting (gpt-oss-120b)...`);

    const systemPrompt = `You are a world-class technical crypto journalist — the kind that writes for CoinDesk Pro and Bankless Research.
Today's Date: ${config.CURRENT_DATE}.
ASSIGNMENT: Write a confident, vivid, 900-word technical deep-dive article targeting the keyword: "${keyword}".

YOUR WRITING STANDARDS:
- Write with authority and precision. Use specific protocol names, TPS numbers, and dates from the sources below.
- Prioritize facts from the SOURCE DOCUMENTS. If sources lack a specific detail, use publicly known, verifiable information — do NOT invent fictional companies or statistics.
- The article should read like it was written by a former quant/engineer who explains things for smart crypto traders.
- Open with a punchy hook that immediately establishes why this topic matters RIGHT NOW in 2026.

ARTICLE STRUCTURE (mandatory sections):
1. Opening hook paragraph (no h1 — the template handles that).
2. <div class="takeaways-card"><h4>Key Takeaways</h4><ul>...</ul></div> with 3-5 specific, actionable bullets.
3. At least two <h2> sections with technical depth — include specific protocol mechanics, not vague generalities.
4. One <div class="comparison-table-wrapper"><table class="comparison-table">...</table></div> with benchmark data.
5. One <div class="insight-card"><strong>Analyst Note:</strong> ...</div> with a sharp expert perspective.
6. Final <h2>Forward-Looking Signals</h2> section — what to watch in the next 30-90 days.

FORBIDDEN ELEMENTS (will be caught in audit):
- Markdown characters: #, ##, *, **, ***, --, ---, ===
- Vague filler: "exciting developments", "the future of finance", "game changer"
- "Conclusion" headers or sign-off clichés
- First-person "Our", "We", "My"
- Fictional companies, made-up TPS figures, or fabricated protocol names

OUTPUT: Pure HTML only. No markdown. No preamble — just the article HTML body.

SOURCE DOCUMENTS:
${sourceText}`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write the premium 900-word technical deep-dive for: "${keyword}"` }
    ], 'openai/gpt-oss-120b', 0.65);
}

/**
 * STEP 3: Hallucination & Factual Audit (llama-4-scout-17b)
 * Role: Hostile auditor. Finds fabricated projects, fixes architecture intent.
 */
async function firstFactCheck(draftContent, sourceText) {
    console.log(`[Step 3] Hallucination Audit (llama-4-scout-17b)...`);
    const knowledgeBase = JSON.stringify(config.PROJECT_KNOWLEDGE, null, 2);

    const systemPrompt = `You are a Hostile Factual Auditor for a high-authority crypto publication.
SOURCE DOCUMENTS and PROJECT KNOWLEDGE are your only sources of truth.

AUDIT TASKS (fix in place, do not summarize):
1. FABRICATION CHECK: Any protocol/project mentioned in the DRAFT that does NOT appear in SOURCE DOCUMENTS or PROJECT KNOWLEDGE must be DELETED. Replace deleted claims with verified info from sources.
2. ARCHITECTURE CHECK: If the keyword references a specific layer (e.g., L2, L3) or category (e.g., RWA, AI agents), the article must stay on that topic. Remove off-topic layer references.
3. MARKDOWN SCRUB: Delete all '#', '*', '**', '---' symbols. Replace with proper HTML tags.
4. FILLER SCRUB: Delete "Conclusion" sections and generic sign-offs.

DO NOT REWRITE the article style. Only fix the above issues. Preserve vivid, specific writing.

OUTPUT ONLY: The corrected, pure HTML article body.

PROJECT KNOWLEDGE:
${knowledgeBase}

SOURCES:
${sourceText}`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DRAFT TO AUDIT:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.3);
}

/**
 * STEP 4: Final Polish & POV Audit (llama-4-scout-17b)
 * Role: Final editor. Ensures clean HTML, correct POV, no AI artifacts.
 */
async function finalFactCheck(draftContent, sourceText) {
    console.log(`[Step 4] Final Polish (llama-4-scout-17b)...`);

    const systemPrompt = `You are the Lead Editor doing a final quality pass.
DO NOT change the substance or style of the article. Only fix these specific issues:

1. POV: Replace any "Our", "We", "My" with the specific project name (e.g., "The Starknet team").
2. HTML CLEANLINESS: Ensure all visual components (takeaways-card, insight-card, comparison-table) are correctly closed.
3. ZERO MARKDOWN: If any '#', '*', or '---' remain, convert them to proper HTML tags now.
4. FINAL CHECK: Ensure the article ends cleanly — no "Conclusion" headers, no "Back to all posts" links.

OUTPUT ONLY: The final, polished HTML article body. Nothing else.`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `FINAL POLISH:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.3);
}

module.exports = {
    discoverKeywords,
    draftProfessionalBlog,
    firstFactCheck,
    finalFactCheck
};
