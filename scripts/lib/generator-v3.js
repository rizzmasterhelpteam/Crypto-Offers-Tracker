/**
 * generator-v3.js - 5-Step High-Authority Pipeline
 * Hardened: Negative Prompts, Arch Boundaries, No Fake Quotes, No Fake Reg News, Artifact Scrub
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
        .replace(/^["'\s]+|["'\s]+$/g, '')
        .split('\n')[0]
        .trim();

    console.log(`[Step 1] Cleaned keyword: "${cleaned}"`);
    return cleaned;
}

/**
 * STEP 2: Expert Drafting (gpt-oss-120b)
 * Role: Confident expert writer. Grounding/hallucination checks happen in Steps 3-5.
 */
async function draftProfessionalBlog(keyword, sourceText) {
    console.log(`[Step 2] Expert Drafting (gpt-oss-120b)...`);
    const knowledgeBase = JSON.stringify(config.PROJECT_KNOWLEDGE, null, 2);

    const systemPrompt = `You are a world-class technical crypto journalist — the kind that writes for CoinDesk Pro and Bankless Research.
Today's Date: ${config.CURRENT_DATE}.
ASSIGNMENT: Write a confident, vivid, 900-word technical deep-dive article targeting the keyword: "${keyword}".

═══════════════════════════════════════════
STEP 0 — ARCHITECTURE DECLARATION (MANDATORY)
Before writing a single sentence, state internally:
  - What layer is this technology? (L1, L2, L3, DA layer, etc.)
  - What is its consensus or execution mechanism?
  - What real protocols are relevant to this keyword?
Then write ONLY about those defined technologies. Do NOT drift into adjacent chains.
═══════════════════════════════════════════

WRITING STANDARDS:
- Use specific protocol names, TPS numbers, and dates ONLY from PROJECT KNOWLEDGE and SOURCE DOCUMENTS below.
- If a source doesn't mention a specific figure, write a general qualifier ("hundreds of transactions per second", "sub-cent fees") — do NOT invent a number.
- The article reads like a former quant/engineer explaining things for smart crypto traders.
- Open with a punchy hook that immediately establishes why this topic matters RIGHT NOW in 2026.

ARTICLE STRUCTURE (mandatory):
1. Opening hook paragraph (no h1 — the template handles that).
2. <div class="takeaways-card"><h4>Key Takeaways</h4><ul>...</ul></div> with 3-5 specific, actionable bullets.
3. At least two <h2> sections with technical depth — includes specific mechanics, not vague generalities.
4. One <div class="comparison-table-wrapper"><table class="comparison-table">...</table></div> with benchmark data.
5. One <div class="insight-card"><strong>Analyst Note:</strong> ...</div> with a sharp expert perspective.
6. Final <h2>Forward-Looking Signals</h2> section — what to watch in the next 30-90 days.

═══════════════════════════════════════════
CRITICAL — ABSOLUTE PROHIBITIONS (auditors will delete violations):
═══════════════════════════════════════════
FABRICATION RULES:
- NEVER invent protocol upgrade names (e.g., do not write "MONAD_NINE", "STRK20", or any named upgrade not in PROJECT KNOWLEDGE or SOURCES).
- NEVER invent company names, researcher names, analyst firms, or quotes from human beings.
- NEVER attribute a quote to any named person ("According to [Name], CTO of...") unless that exact quote appears in SOURCE DOCUMENTS.
- NEVER fabricate specific regulatory actions: no invented SEC rulings, Fed pilots, EU directives, or Treasury announcements. Reference only broad, established frameworks (e.g., MiCA, existing EIP numbers).
- NEVER claim a mainnet launch date that is not in PROJECT KNOWLEDGE or SOURCES.
- NEVER start multiple sentences in a row with the same subject (e.g., "The Starknet team ... The Starknet team ...").

FORMATTING RULES:
- No markdown characters: #, ##, *, **, ***, --, ---, ===
- No "Conclusion" headers or sign-off clichés
- No first-person "Our", "We", "My"
- No meta-tags, keyword labels, or template footer text in the output

OUTPUT: Pure HTML only. No markdown. No preamble. Start directly with the first paragraph.

PROJECT KNOWLEDGE (2026 ground truth — primary reference):
${knowledgeBase}

SOURCE DOCUMENTS:
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

    const systemPrompt = `You are a Hostile Factual Auditor for a high-authority institutional crypto publication.
Your job is to SILENTLY FIX errors — do NOT summarize, explain, or rewrite style.

AUDIT CHECKLIST (apply all in one pass):

1. FABRICATED PROTOCOLS: Any named protocol upgrade, version, or product (e.g., "MONAD_NINE", "STRK20") that does NOT appear word-for-word in SOURCES → DELETE the specific name, replace with a general description ("a recent performance upgrade" / "Starknet's proof system improvements").

2. FABRICATED QUOTES: Any sentence attributing words to a named human being (e.g., 'According to Jane Doe...', 'CTO of X said...') → DELETE the entire quote and attribution. Replace with a factual observation from the sources if possible, otherwise remove the sentence.

3. FABRICATED REGULATORY NEWS: Any claim about a specific SEC ruling, Federal Reserve pilot, Treasury announcement, or EU directive that is not explicitly in SOURCES → DELETE and replace with reference to an established framework only (e.g., "Under the EU's MiCA framework...").

4. ARCHITECTURE DRIFT: If the article's keyword is about Ethereum L2s but the article discusses Solana, or if it's about L3s but covers L1 restaking → Flag and remove the off-topic section. Replace with a sentence acknowledging the correct layer.

5. SENTENCE REPETITION: If any subject phrase (e.g., "The Starknet team", "Monad's architecture") appears at the start of 2+ consecutive sentences → Rewrite the second sentence to start differently.

6. MARKDOWN SCRUB: Delete all '#', '*', '**', '---' symbols. Replace with proper HTML tags (h2, strong, hr).

7. ARTIFACT SCRUB: Delete any text that looks like a meta-tag (e.g., "Selected Keyword:", "**Keyword:**"), template footer ("Back to all Digests"), or scraping artifact.

DO NOT REWRITE style or substance beyond the above. Preserve vivid, specific writing.
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

    const systemPrompt = `You are the Lead Editor doing a final quality pass on a crypto article.
DO NOT change the substance or rewrite the style. Only fix the following specific issues:

1. POV FIX: Replace any "Our", "We", "My" with the specific project name (e.g., "The Starknet team", "EigenLayer's validators").
2. HTML CLEANLINESS: Ensure all visual components (takeaways-card, insight-card, comparison-table-wrapper, comparison-table) are correctly opened AND closed with matching tags.
3. ZERO MARKDOWN: If any '#', '*', '**', or '---' characters remain, convert them to proper HTML now.
4. CLEAN ENDING: The article must end on a forward-looking insight or signal. Remove any "Conclusion" headers, "Back to all posts" links, sign-off lines, or template boilerplate.
5. TOP ARTIFACT CHECK: Ensure the article does NOT start with any label text like "**Selected Keyword:**", "Keyword:", "Title:", or any meta-prefix. The first output character must be an HTML tag or a content word.

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

    const systemPrompt = `You are a Data Accuracy Auditor for a high-authority financial publication.
Today's Date: ${config.CURRENT_DATE}.

YOUR ONLY JOB is to fix factual data errors in the article below. Do NOT rewrite style, restructure sections, or change tone.

AUDIT CHECKLIST:
1. DATES: All dates must be consistent with ${config.CURRENT_DATE}. Delete any future date claimed as a past event, or any past date used incorrectly for a "coming soon" claim.
2. TPS / THROUGHPUT: Cross-reference all TPS and throughput numbers against SOURCES. Any figure with no source backing → delete the exact number and replace with a general qualifier ("thousands of transactions per second").
3. TVL / MARKET FIGURES: Cross-reference all TVL, market cap, and funding figures against SOURCES. Remove any round fabricated numbers not found in sources.
4. PROTOCOL VERSIONS: Ensure all version numbers, upgrade names, and launch dates match SOURCES exactly.
5. QUOTE REMNANTS: If any attributed human quote survived earlier audits, delete it now.
6. HTML INTEGRITY: Do not break any HTML tags. Preserve all visual components (takeaways-card, comparison-table, insight-card).

OUTPUT ONLY: The corrected HTML article body with all data errors fixed. Nothing else.

SOURCE DOCUMENTS:
${sourceText}`;

    return await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DATA AUDIT ON:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.2);
}

module.exports = {
    discoverKeywords,
    draftProfessionalBlog,
    firstFactCheck,
    finalFactCheck,
    dataSanitizer
};
