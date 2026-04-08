/**
 * generator-v3.js - 5-Step High-Authority Pipeline
 * Hardened: Negative Prompts, Arch Boundaries, No Fake Quotes, No Fake Reg News, Artifact Scrub
 */
const config = require('./config');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Build a whitelist of verified protocol names from PROJECT_KNOWLEDGE
// so fact-checking steps don't strip real names.
function getKnownProtocolNames() {
    const names = new Set();
    for (const [key, val] of Object.entries(config.PROJECT_KNOWLEDGE)) {
        names.add(key);
        // Extract protocol names from the role field (e.g. "Validity Rollup (Starknet)" → "Starknet")
        const roleMatch = val.role.match(/\(([^)]+)\)/);
        if (roleMatch) names.add(roleMatch[1]);
        // Extract from mechanism field — capitalized multi-word names
        const mechNames = val.mechanism.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g) || [];
        mechNames.forEach(n => { if (n.length > 3) names.add(n); });
    }
    return [...names];
}

function logUsage(model, promptTokens, completionTokens, totalTokens) {
    const fs = require('fs');
    const timestamp = new Date().toISOString();
    const entry = `${timestamp} | Model: ${model} | Prompt: ${promptTokens} | Completion: ${completionTokens} | Total: ${totalTokens}\n`;
    try { fs.appendFileSync(config.USAGE_LOG_PATH, entry); } catch (e) { /* non-fatal */ }
}

// Token-per-minute limits per model (leave headroom for prompt tokens)
const MODEL_MAX_TOKENS = {
    'openai/gpt-oss-120b': 4000,       // 8K TPM limit — ~4K prompt + 4K completion
    'openai/gpt-oss-20b': 4000,        // 8K TPM limit
    'meta-llama/llama-4-scout-17b-16e-instruct': 6000,  // 30K TPM limit — plenty of room
    'qwen/qwen3-32b': 3000,            // 6K TPM limit
    'llama-3.3-70b-versatile': 4000,   // 12K TPM limit
};

async function callGroq(messages, model, temperature = 0.5, maxTokensOverride = null) {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set.");

    const max_tokens = maxTokensOverride || MODEL_MAX_TOKENS[model] || 4000;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature, max_tokens })
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
- Topic: Must be related to one of these 2026 crypto verticals (ROTATE between them — do NOT repeat the same vertical twice in a row):
  * L2/L3 scaling and rollup technology (Starknet, zkSync, Optimism, Arbitrum)
  * Restaking and shared security (EigenLayer, AVS, liquid restaking)
  * Parallel execution chains (Monad, Sei, Sui)
  * DeFi-native L1s and Proof of Liquidity (Berachain)
  * Modular data availability (Celestia, EigenDA, Avail)
  * RWA tokenization and institutional DeFi
  * AI agents and on-chain automation
  * MEV, Solana DeFi, and perps protocols (Jito, Drift)
  * ZK proofs, privacy protocols, and identity
  * Cross-chain interoperability and bridge security
- IMPORTANT: Focus the keyword on a SPECIFIC protocol or mechanism, not a broad category. Good: "EigenLayer AVS restaking yield strategies". Bad: "L3 blockchain scalability solutions".${historyBlock}

OUTPUT RULES (CRITICAL):
- Output ONLY the keyword itself — nothing else.
- Do NOT prefix it with "Selected Keyword:", "Keyword:", or any label.
- Do NOT wrap it in quotes or markdown.
- Do NOT output multiple lines or explanations.`;

    const raw = await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `TRENDING CONTEXT:\n${trendingContext}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.8);

    // Strip any AI formatting artifacts from the response
    const cleaned = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')  // safety: strip CoT blocks
        .trim()
        .replace(/^(?:\**)?(?:Selected )?Keyword:?(?:\**)?\s*/gi, '')
        .replace(/\\"/g, '')                         // strip escaped quotes
        .replace(/^["'`\s]+|["'`\s]+$/g, '')         // strip surrounding quotes/whitespace
        .replace(/[."'`]+$/g, '')                     // strip trailing punctuation
        .split('\n')[0]
        .trim();

    console.log(`[Step 1] Cleaned keyword: "${cleaned}"`);
    return cleaned;
}

/**
 * STEP 1.5: Compelling Title Generation (llama-4-scout-17b)
 * Role: Generate a specific, engaging article title from keyword + source context.
 */
async function generateTitle(keyword, sourceContext = '') {
    console.log(`[Step 1.5] Generating compelling title...`);
    const systemPrompt = `You are a headline writer for a high-authority institutional crypto publication.
Generate ONE compelling, specific article title from the keyword and source context.

RULES:
- 6-12 words maximum
- Include the main protocol or mechanism name (Starknet, Monad, EigenLayer, Celestia, etc.)
- Specific and insight-driven — NOT generic category titles
- No clickbait, no hype, no colons, no question marks
- Start with a strong noun or verb phrase

GOOD examples:
  EigenLayer AVS Fee Premiums Outpace Generic Restaking Yields
  Starknet's Stwo Prover Cuts L1 Finality to Under One Hour
  Monad's Parallel EVM Unlocks High-Frequency RWA Tokenization
  Celestia DAS Layer Reduces Rollup Data Costs by Order of Magnitude

BAD examples:
  The Future of Blockchain Technology in 2026
  EigenLayer: A Deep Dive into Restaking
  Top Crypto Trends to Watch

OUTPUT ONLY: The title text. No quotes, no labels, no explanation.`;

    const raw = await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `KEYWORD: ${keyword}\n\nSOURCE CONTEXT:\n${sourceContext.slice(0, 800)}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.7, 80);

    const title = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim()
        .replace(/^["'`*]+|["'`*]+$/g, '')
        .replace(/^Title:\s*/i, '')
        .split('\n')[0]
        .trim();

    console.log(`[Step 1.5] Generated title: "${title}"`);
    return title;
}

/**
 * STEP 2: Expert Drafting (gpt-oss-120b)
 * Role: Confident expert writer. Grounding/hallucination checks happen in Steps 3-5.
 */
async function draftProfessionalBlog(keyword, sourceText) {
    console.log(`[Step 2] Expert Drafting (gpt-oss-120b)...`);
    const knowledgeBase = JSON.stringify(config.PROJECT_KNOWLEDGE, null, 2);

    // Build a focused knowledge snippet instead of dumping all protocols
    const kwLower = keyword.toLowerCase();
    const relevantKnowledge = {};
    for (const [key, val] of Object.entries(config.PROJECT_KNOWLEDGE)) {
        if (kwLower.includes(key.toLowerCase()) || val.role.toLowerCase().split(/[\s,()]+/).some(w => w.length > 3 && kwLower.includes(w.toLowerCase()))) {
            relevantKnowledge[key] = val;
        }
    }
    const knowledgeSnippet = Object.keys(relevantKnowledge).length > 0
        ? JSON.stringify(relevantKnowledge, null, 2)
        : knowledgeBase; // fallback to full if no match

    const systemPrompt = `You are a technical crypto journalist. Today: ${config.CURRENT_DATE}.
Write a 700-word HTML article for keyword: "${keyword}".

RULES:
- Use data ONLY from KNOWLEDGE and SOURCES below. If no source for a figure, use a qualifier ("hundreds of TPS") — never invent numbers.
- Write like a quant explaining for smart traders. Punchy opening hook (2 paragraphs), no h1 tag.
- AVS = "Actively Validated Services" only. No fake quotes, regulatory news, protocol names, or version numbers.
- No markdown (#, *, **). No dummy links (<a href="#">). No "Conclusion" headers. No first-person (Our/We/My).
- Tables: TVL in dollars, cost in fees, TPS in numbers. Correct units always.

REQUIRED HTML SKELETON (copy this structure exactly, fill in content):
<p>[opening hook paragraph 1]</p>
<p>[opening hook paragraph 2]</p>
<div class="takeaways-card"><h4>Key Takeaways</h4><ul><li>[bullet 1]</li><li>[bullet 2]</li><li>[bullet 3]</li></ul></div>
<h2>[Section 1 title]</h2>
<p>[technical content]</p>
<h2>[Section 2 title]</h2>
<p>[technical content]</p>
<div class="comparison-table-wrapper"><table class="comparison-table"><thead><tr><th>Protocol</th><th>TVL (USD)</th><th>Cost (Fees)</th><th>Throughput (TPS)</th></tr></thead><tbody><tr><td>[real name]</td><td>$[X]</td><td>$[Y]</td><td>[N]</td></tr></tbody></table></div>
<div class="insight-card"><strong>Analyst Note:</strong> [2-3 sentences of original analysis]</div>
<h2>Forward-Looking Signals</h2>
<ul><li>[signal 1 with specific protocol/date]</li><li>[signal 2]</li><li>[signal 3]</li></ul>

CRITICAL RULES:
- takeaways-card div MUST wrap both the h4 AND the ul — never use h2 for Key Takeaways
- table MUST have class="comparison-table" — never output <table> without it
- insight-card MUST be a div, not an h2 — never use <h2>Analyst Note</h2>
- No h1 tags. No <hr> tags. No markdown. No dummy <a href="#"> links.

OUTPUT: Pure HTML only. Start with first <p> tag.

KNOWLEDGE:
${knowledgeSnippet}

SOURCES:
${sourceText}`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write the premium 900-word technical deep-dive for: "${keyword}"` }
    ], 'openai/gpt-oss-120b', 0.65);
}

/**
 * STEP 3: Hallucination & Fabrication Audit (llama-4-scout-17b)
 * Role: Hostile auditor. Kills invented names, fake quotes, fake regulatory news, architecture drift.
 */
async function firstFactCheck(draftContent, sourceText) {
    console.log(`[Step 3] Hallucination Audit (llama-4-scout-17b)...`);

    const knownProtocols = getKnownProtocolNames();

    const systemPrompt = `You are a Hostile Factual Auditor for a high-authority institutional crypto publication.
Your job is to SILENTLY FIX errors — do NOT summarize, explain, or rewrite style.

VERIFIED PROTOCOL NAMES (these are confirmed real — NEVER remove or replace these):
${knownProtocols.join(', ')}

AUDIT CHECKLIST (apply all in one pass):

1. FABRICATED PROTOCOLS: Any named protocol, upgrade, or product that is NOT in the VERIFIED list above AND NOT in SOURCES → DELETE the specific name, replace with a general description. IMPORTANT: Protocol names that ARE in the VERIFIED list (e.g., Starknet, Monad, EigenLayer, Celestia, Berachain, Jito, Drift) MUST be kept as-is. Upgrade codenames (e.g., "MONAD_NINE", "STRK20", "Stwo") that appear in SOURCES should also be kept.

2. FABRICATED QUOTES: Any sentence attributing words to a named human being (e.g., 'According to Jane Doe...', 'CTO of X said...') → DELETE the entire quote and attribution. Replace with a factual observation from the sources if possible, otherwise remove the sentence.

3. FABRICATED REGULATORY NEWS: Any claim about a specific SEC ruling, Federal Reserve pilot, MAS sandbox, Treasury announcement, or EU directive that is not explicitly in SOURCES → DELETE and replace with reference to an established framework only (e.g., "Under the EU's MiCA framework...").

4. ARCHITECTURE DRIFT: If the article's keyword is about Ethereum L2s but the article discusses Solana, or if it's about L3s but covers L1 restaking → Flag and remove the off-topic section.

5. SENTENCE REPETITION: If any subject phrase appears at the start of 2+ consecutive sentences → Rewrite the second sentence to start differently.

6. AVS TERMINOLOGY: If AVS is defined as anything other than "Actively Validated Services", fix it.

7. MARKDOWN SCRUB: Delete all '#', '*', '**', '---' symbols. Replace with proper HTML tags (h2, strong, hr).

8. ARTIFACT SCRUB: Delete meta-tags ("Selected Keyword:", "**Keyword:**"), template footers, scraping artifacts ("🗓️", "🔥Trending:"). Remove dummy links (<a href="#">) by keeping inner text only.

DO NOT REWRITE style or substance beyond the above. Preserve vivid, specific writing. Keep all real protocol names.
OUTPUT ONLY: The corrected, pure HTML article body. Nothing else.

SOURCES:
${sourceText}`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DRAFT TO AUDIT:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.3);
}

/**
 * STEP 4: Final Polish & HTML Integrity (llama-4-scout-17b)
 * Role: Final editor. Clean HTML, correct POV, no AI artifacts, no trailing junk.
 */
async function finalFactCheck(draftContent, sourceText) {
    console.log(`[Step 4] Final Polish (llama-4-scout-17b)...`);

    const knownProtocols = getKnownProtocolNames();

    const systemPrompt = `You are the Lead Editor doing a final quality pass on a crypto article.
DO NOT change the substance or rewrite the style. DO NOT remove or replace real protocol names (${knownProtocols.slice(0, 15).join(', ')}, etc.).

Only fix these specific issues:
1. POV FIX: Replace any "Our", "We", "My" with the specific project name.
2. STRUCTURE FIX (CRITICAL):
   - If "Key Takeaways" is an <h2> outside a div, wrap it: <div class="takeaways-card"><h4>Key Takeaways</h4>[ul]</div>
   - If <table> is missing class="comparison-table", add it: <table class="comparison-table">
   - If "Analyst Note" is an <h2>, convert to: <div class="insight-card"><strong>Analyst Note:</strong> [text]</div>
3. HTML CLEANLINESS: Ensure all visual components are correctly opened AND closed.
4. ZERO MARKDOWN: Convert any remaining '#', '*', '**', '---' to proper HTML tags.
5. CLEAN ENDING: Remove any "Conclusion" headers, "Back to all posts" links, sign-off lines, template boilerplate.
6. TOP ARTIFACT CHECK: Remove any label prefix like "Selected Keyword:", "Title:", "🗓️". First output must be an HTML tag.
7. PROTOCOL NAME INTEGRITY: If any real protocol name has been replaced with a generic phrase like "A validity rollup", restore the actual name.

OUTPUT ONLY: The final, polished HTML article body. Nothing else.`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `FINAL POLISH:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.3);
}

/**
 * STEP 5: Data Sanitizer (llama-4-scout-17b)
 * Role: Corrects inaccurate dates, TPS figures, TVL numbers, and protocol versions.
 */
async function dataSanitizer(draftContent, sourceText) {
    console.log(`[Step 5] Data Sanitizer (llama-4-scout-17b)...`);

    const knownProtocols = getKnownProtocolNames();

    const systemPrompt = `You are a Data Accuracy Auditor for a high-authority financial publication.
Today's Date: ${config.CURRENT_DATE}.

YOUR ONLY JOB is to fix factual data errors. Do NOT rewrite style, restructure, change tone, or remove real protocol names.

VERIFIED PROTOCOL NAMES (keep these as-is): ${knownProtocols.slice(0, 15).join(', ')}

AUDIT CHECKLIST:
1. DATES: All dates must be consistent with ${config.CURRENT_DATE}. Delete any future date claimed as past, or past date used for "coming soon".
2. TPS / THROUGHPUT: Cross-reference TPS numbers against SOURCES. Unsourced exact figures → replace with qualifiers ("thousands of TPS"). But keep sourced figures like "10k TPS" for Monad.
3. TABLES AND METRICS: TVL must be dollar amounts, cost must be fees, TPS must be throughput. Fix any misplaced units.
4. TVL / MARKET FIGURES: Cross-reference against SOURCES. Remove fabricated round numbers not in sources. Keep sourced figures (e.g., "$18B+ TVL" for EigenLayer).
5. PROTOCOL VERSIONS: Keep upgrade names that appear in SOURCES (Stwo, MONAD_NINE, STRK20, etc.).
6. QUOTE REMNANTS: Delete any attributed human quotes.
7. HTML INTEGRITY: Preserve all HTML tags and visual components.
8. PROTOCOL NAME INTEGRITY: Do NOT replace real protocol names with generic descriptions.

OUTPUT ONLY: The corrected HTML article body. Nothing else.

SOURCE DOCUMENTS:
${sourceText}`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DATA AUDIT ON:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.2);
}

module.exports = {
    discoverKeywords,
    generateTitle,
    draftProfessionalBlog,
    firstFactCheck,
    finalFactCheck,
    dataSanitizer
};
