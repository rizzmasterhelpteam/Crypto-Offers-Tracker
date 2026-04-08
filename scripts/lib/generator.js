/**
 * generator.js - LLM Generation & Verification Flow
 * Implements the Hostile Grounded architecture.
 */
const config = require('./config');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function callGroq(messages, model = 'meta-llama/llama-4-scout-17b-16e-instruct', temperature = 0.5) {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set.");

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature, max_tokens: model.includes('gpt-oss') ? 4000 : 6000 })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

async function generateDraft(title, keywords, sourceText) {
    console.log(`[Generator] Stage 1: Drafting (gpt-oss-120b)...`);
    const systemPrompt = `You are ${config.AUTHOR.name}, ${config.AUTHOR.title}. Today is ${config.CURRENT_DATE}.
STYLE:
- Technical, objective, and advanced. Use precise terminology (L1 finality, AVS scaling).
- Tone: Coldly objective and skeptically grounded.
- Rules: NO synthetic hype (slop). Every claim MUST have an inline qualifier (e.g., "[Verified via L2Beat]").
SOURCE DOCUMENTS:
${sourceText}

PROJECT KNOWLEDGE (Ground Truth):
${JSON.stringify(config.PROJECT_KNOWLEDGE, null, 2)}`;

    const userPrompt = `Write an 800-word article about: ${title}
KEYWORDS: ${keywords}
STRUCTURE:
- Strong hook (no "The", "In", "As", or "Crypto" starts).
- H2 sections of varying length.
- Key takeaways in bullets.

DO NOT fabricate architecture not in source documents.`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ], 'openai/gpt-oss-120b', 0.7);
}

async function factCheck(draftContent, sourceText) {
    console.log(`[Generator] Stage 2: Hostile Fact-Checking...`);

    // Step 2a: Extract Claims
    console.log(`[Generator] 2a: Extracting claims...`);
    const claims = await callGroq([
        { role: 'system', content: "Extract every technical/factual claim from the following text into a numbered list. No preamble." },
        { role: 'user', content: draftContent }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.1);

    // Step 2b: Hostile Verification
    console.log(`[Generator] 2b: Verifying claims against sources...`);
    const hostileSystem = `You are a hostile technical editor. 
SOURCES: [${sourceText}]
TASK: Compare the extracted claims against the sources. 
DELETE claims that are NOT supported by the sources or conflict with the 2026 state.
OUTPUT ONLY: The cleaned article wrapped in [ARTICLE_BODY] tags and a log in [DELETED_CLAIMS_LOG] tags.`;

    const result = await callGroq([
        { role: 'system', content: hostileSystem },
        { role: 'user', content: `CLAIMS:\n${claims}\n\nDRAFT:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.1);

    const logMatch = result.match(/\[DELETED_CLAIMS_LOG\]([\s\S]*?)\[\/DELETED_CLAIMS_LOG\]/);
    if (logMatch) console.log(`\n--- Hostile Editor: Deleted Claims ---\n${logMatch[1].trim()}\n`);

    const bodyMatch = result.match(/\[ARTICLE_BODY\]([\s\S]*?)\[\/ARTICLE_BODY\]/);
    return bodyMatch ? bodyMatch[1].trim() : result;
}

async function polishArticle(content) {
    console.log(`[Generator] Stage 3: Technical Polishing...`);
    return await callGroq([
        {
            role: 'system', content: `Final polish for technical precision and human-like sentence variation. Today: ${config.CURRENT_DATE}. 
        Ensure no banned patterns: ${config.BANNED_AI_PATTERNS.join(', ')}.
        OUTPUT ONLY: Pure HTML formatted article.` },
        { role: 'user', content: content }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.1);
}

module.exports = {
    generateDraft,
    factCheck,
    polishArticle
};
