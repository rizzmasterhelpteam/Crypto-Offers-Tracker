/**
 * generator-v3.js - 5-Step High-Authority Pipeline
 * Hardened: Negative Prompts, Arch Boundaries, No Fake Quotes, No Fake Reg News, Artifact Scrub
 */
const fs = require('fs');
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
    let retries = 5;
    let delay = 10000;

    while (retries > 0) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages, temperature, max_tokens })
            });

            if (response.status === 429) {
                console.log(`[Rate Limit] 429 hit. Retrying in ${delay / 1000}s... (${retries} left)`);
                await new Promise(r => setTimeout(r, delay));
                retries--;
                delay = Math.min(delay * 2, 60000);
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Groq API Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            if (data.usage) {
                logUsage(model, data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
            }
            return data.choices[0].message.content.trim();
        } catch (err) {
            if (retries <= 1) throw err;
            console.log(`[Network Error] ${err.message}. Retrying...`);
            await new Promise(r => setTimeout(r, 2000));
            retries--;
        }
    }
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
TASK: Analyze the provided trending context and identify ONE high-potential "low-competition, medium-to-high volume" keyword for a technical blog post.
CRITERIA:
- Volume: Medium-to-high (1,000-5,000 monthly searches simulated).
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
    console.log(`[Step 1.5] Generating Alpha-focused title...`);
    const systemPrompt = `You are an institutional headline writer.
TASK: Generate ONE compelling crypto title for: "${keyword}".
RULES:
- 7-13 words maximum.
- NO introductory text (e.g. "Here is a title:", "Alternatively...").
- NO questions, NO colons, NO chat.
- OUTPUT ONLY the title string.`;

    const raw = await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `KEYWORD: ${keyword}\n\nSOURCE CONTEXT:\n${sourceContext.slice(0, 800)}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.7, 80);

    const title = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim()
        .replace(/^["'`*]+|["'`*]+$/g, '')
        .replace(/^(?:Title|Headline):\s*/i, '')
        .split('\n')[0]
        .trim();

    console.log(`[Step 1.5] Generated title: "${title}"`);
    return title;
}


const AUDIENCE_PROFILES = {
    RET: {
        name: "Retail Trader",
        category: "Protocol Alpha",
        badge: "green",
        goal: "De-emphasize backend math. Focus on user benefits: lower fees, higher yield, ease of use.",
        tone: "Relatable, benefit-driven, and punchy. Use trading analogies.",
        skeleton: "Benefit-focused (Problem -> Solution -> How to Benefit -> Future Outlook)",
        headers: ["The Cost of Doing Business", "A Better Way to Earn", "Maximizing Your Returns", "The Road Ahead"]
    },
    DEV: {
        name: "Blockchain Developer/Architect",
        category: "Deep Tech",
        badge: "blue",
        goal: "Technical deep-dive. Include code snippets (hypothetical), API logic, and specific benchmarks.",
        tone: "Peer-to-peer, objective, and dense. Focus on trade-offs and implementation.",
        skeleton: "Architecture-first (Stack -> Performance -> Consensus -> Integration)",
        headers: ["Core Protocol Architecture", "State Machine & Concurrency", "Implementation Benchmarks", "Developer Roadmap"]
    },
    NOV: {
        name: "Crypto Novice/Researcher",
        category: "Education",
        badge: "orange",
        goal: "Education. Strip the math. Use simple everyday analogies. Focus on security and 'why it matters'.",
        tone: "Educational, patient, and narrative. Step-by-step logic.",
        skeleton: "Educational Guide (The Problem -> Simple Analogy -> Security First -> Simple Outlook)",
        headers: ["The Problem Everyone Faces", "How it Works (Simply Put)", "Keeping Your Money Safe", "What This Means for You"]
    }
};

/**
 * STEP 2: Expert Drafting (gpt-oss-120b)
 * Now with a 'Persona Engine' to ensure structural variance and audience alignment.
 */
async function draftProfessionalBlog(keyword, sourceText, manualPersona = null) {
    const personaKeys = Object.keys(AUDIENCE_PROFILES);
    const personaKey = (manualPersona && AUDIENCE_PROFILES[manualPersona])
        ? manualPersona
        : personaKeys[Math.floor(Math.random() * personaKeys.length)];
    const persona = AUDIENCE_PROFILES[personaKey];

    console.log(`[Step: Draft] Drafting for Persona: ${persona.name} (Target: 800 words)...`);

    const knowledgeBase = JSON.stringify(config.PROJECT_KNOWLEDGE, null, 2);
    const kwLower = keyword.toLowerCase();
    const relevantKnowledge = {};
    for (const [key, val] of Object.entries(config.PROJECT_KNOWLEDGE)) {
        if (kwLower.includes(key.toLowerCase()) || val.role.toLowerCase().split(/[\s,()]+/).some(w => w.length > 3 && kwLower.includes(w.toLowerCase()))) {
            relevantKnowledge[key] = val;
        }
    }
    const knowledgeSnippet = Object.keys(relevantKnowledge).length > 0
        ? JSON.stringify(relevantKnowledge, null, 2)
        : knowledgeBase;

    const bannedPhrases = config.BANNED_AI_PATTERNS.join('", "');

    const systemPrompt = `You are a professional content strategist and technical researcher. Today: ${config.CURRENT_DATE}.
AUDIENCE: ${persona.name}
GOAL: ${persona.goal}
TONE: ${persona.tone}

EDITORIAL & SEO STANDARDS:
- Human-like Flow: Use narrative transitions. No rigid "Introduction / Section 1" labels.
- Structural Variance: Use the skeleton theme: ${persona.skeleton}.
- BANNED CLICHÉS: Never use "Analyst Note:", "In conclusion,", or "A concrete case study involves...".
- ANTI-AI TROPES: DO NOT use character personas like "Meet Alex" or "Imagine Sarah". Use second-person ("Imagine you...") or general scenarios ("Let's say you hold 200 SOL...").
- SEO HEADER RULE: Never wrap a paragraph in an <h2> tag. <h2> tags MUST be short, punchy signposts (max 8 words). The intro paragraph must be a <p>.
- E-E-A-T DATA: Use specific, current-feeling figures (e.g. "JitoSOL APY is currently hovering around 5.8% to 6.0%"). Do not be vague.
- BANNED PHRASES: "${bannedPhrases}".
- Depth: If technical (DEV), include pseudo-code. If Retail (RET)/Novice (NOV), use relatable everyday analogies.

REQUIRED HTML SKELETON (Flexible):
1. Intro: 2 paragraphs in <p> tags setting the scene.
2. A "Snapshot" card with 4 punchy items.
3. 3-4 major sections with natural, creative <h2> headers.
4. For every section, write 3 paragraphs.
5. Case Study: Integrate a narrative case study (e.g. "Scenario: Scaling a DEX to $100M TVL").

OUTPUT: Pure HTML. Start with <p>. NO title.

KNOWLEDGE:
${knowledgeSnippet}

SOURCES:
${sourceText}`;

    const rawDraft = await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Draft the full 800-word technical report for: "${keyword}" targeting the ${persona.name} audience.` }
    ], 'openai/gpt-oss-120b', 0.7, 4000);

    const draft = rawDraft.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (!draft || draft.length < 500) {
        throw new Error(`[Step 2] FAILED: Draft was too short or empty (${draft?.length || 0} chars). Model may have refused or returned CoT only.`);
    }

    return {
        draft,
        personaKey
    };
}

/**
 * STEP 3: Hallucination & Fabrication Audit (llama-4-scout-17b)
 */
async function firstFactCheck(draftContent, sourceText) {
    console.log(`[Step 3] Hallucination Audit (llama-4-scout-17b)...`);
    const knownProtocols = getKnownProtocolNames();
    const systemPrompt = `You are a Hostile Factual Auditor. SILENTLY FIX errors. 
VERIFIED: ${knownProtocols.join(', ')}
CHECKLIST:
1. FABRICATED PROTOCOLS: Replace with general descriptions if not verified.
2. FABRICATED QUOTES: Delete all attributed human quotes.
3. FABRICATED REGULATORY NEWS: Replace with general framework references.
4. MARKDOWN SCRUB: Convert markdown to HTML.
5. NO PREFIXES: Delete any labels like "Draft:".
6. STRIP AI LABELS: Delete any "Analyst Note:" or "Note:" markers.
OUTPUT ONLY: The corrected HTML article body.`;

    const out = await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DRAFT:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.3);

    if (!out || out.length < 200 || out.includes("I can't audit") || out.includes("no HTML article")) {
        console.warn(`[Step 3] Audit rejected (Refusal or short output). Keeping original draft.`);
        return draftContent;
    }
    return out;
}

/**
 * STEP 4: Final Polish & HTML Integrity (llama-4-scout-17b)
 */
async function finalFactCheck(draftContent, sourceText) {
    console.log(`[Step 4] Final Polish (llama-4-scout-17b)...`);
    const systemPrompt = `You are the Lead Editor. Fix POV (use project name, not "We/Our"). Ensure <h2> tags are not wrapping long text. Ensure all visual cards are properly closed. Remove any "Conclusion" headers. First output must be an HTML tag.`;
    const out = await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `FINAL POLISH:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.3);

    if (!out || out.length < 200 || out.includes("I can't audit") || out.includes("no HTML article")) {
        console.warn(`[Step 4] Audit rejected (Refusal or short output). Keeping Step 3 state.`);
        return draftContent;
    }
    return out;
}

/**
 * STEP 5: Data Sanitizer (llama-4-scout-17b)
 */
async function dataSanitizer(draftContent, sourceText) {
    console.log(`[Step 5] Data Sanitizer (llama-4-scout-17b)...`);
    const systemPrompt = `You are a Data Accuracy Auditor. Fix factual date/TPS/TVL errors. Ensure ${config.CURRENT_DATE} consistency. Do not change style. Do not remove real protocol names. 
OUTPUT ONLY: The corrected HTML article body.`;
    const out = await callGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `DATA AUDIT:\n${draftContent}` }
    ], 'meta-llama/llama-4-scout-17b-16e-instruct', 0.2);

    if (!out || out.length < 200 || out.includes("I can't audit") || out.includes("no HTML article")) {
        console.warn(`[Step 5] Audit rejected (Refusal or short output). Keeping Step 4 state.`);
        return draftContent;
    }
    return out;
}

/**
 * UI Assembly: Wraps the final body in the institutional template.
 */
function assembleFullHtml(title, bodyHtml, personaKey = 'RET') {
    console.log(`[Utils] Assembling UI for ${personaKey}...`);
    const template = fs.readFileSync('blog/template.html', 'utf8');
    const description = bodyHtml.replace(/<[^>]+>/g, '').slice(0, 160).trim() + "...";

    // Dynamic metadata from Persona
    const p = AUDIENCE_PROFILES[personaKey] || AUDIENCE_PROFILES['RET'];
    const category = p.category || "Protocol Alpha";
    const badge = p.badge || "green";

    // Extract some keywords for meta tags
    const keywords = bodyHtml.match(/<h2>(.*?)<\/h2>/g)?.map(h => h.replace(/<[^>]+>/g, '')).slice(0, 5).join(', ') || "";

    return template
        .replace(/{{TITLE}}/g, title)
        .replace(/{{META_DESCRIPTION}}/g, description)
        .replace(/{{SEO_KEYWORDS}}/g, keywords)
        .replace(/{{CONTENT}}/g, bodyHtml)
        .replace(/{{DATE}}/g, config.CURRENT_DATE)
        .replace(/{{AUTHOR_NAME}}/g, config.AUTHOR.name)
        .replace(/{{CATEGORY}}/g, category)
        .replace(/{{CATEGORY_BADGE}}/g, badge);
}

module.exports = {
    discoverKeywords,
    generateTitle,
    draftProfessionalBlog,
    firstFactCheck,
    finalFactCheck,
    dataSanitizer,
    assembleFullHtml
};
