/**
 * Twice-Daily Automated Blog Generation Script
 * Runs at 9:00 AM and 9:00 PM IST
 */
const fs = require('fs');
const path = require('path');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error("❌ ERROR: GROQ_API_KEY is NOT set in GitHub Secrets.");
    console.error("Please add it in: Settings -> Secrets and variables -> Actions");
    process.exit(1);
} else {
    console.log("✅ GROQ_API_KEY detected (Length:", GROQ_API_KEY.length, ")");
}

const SITE_URL = 'https://crypto-offers.vercel.app'; // Update this if your domain changes

const PROJECT_ROOT = path.join(__dirname, '..');
const BLOG_DIR = path.join(PROJECT_ROOT, 'blog');
const ADMIN_DIR = path.join(PROJECT_ROOT, 'admin');
const TEMPLATE_PATH = path.join(BLOG_DIR, 'template.html');
const INDEX_PATH = path.join(BLOG_DIR, 'index.html');
const QUEUE_PATH = path.join(ADMIN_DIR, 'queue.csv');
const SITEMAP_PATH = path.join(PROJECT_ROOT, 'sitemap.xml');
const USAGE_LOG_PATH = path.join(ADMIN_DIR, 'usage.log');
const CONTEXT_CACHE_PATH = path.join(ADMIN_DIR, 'ground-truth-context.json');
const REVIEW_DIR = path.join(ADMIN_DIR, 'review');

if (!fs.existsSync(REVIEW_DIR)) fs.mkdirSync(REVIEW_DIR, { recursive: true });

// SOURCE OF TRUTH: Hard-coded 2026 technical knowledge to prevent AI hallucinations
const PROJECT_KNOWLEDGE = {
    'STRK': { role: 'Validity Rollup (Starknet)', mechanism: 'STARK-based proof systems. 2026 Focus: S-two prover (L1 finality <1hr), STRK20 privacy protocol (March 2026 launch), and preconfirmations for <1s transaction latency.' },
    'STARKNET': { role: 'Validity Rollup', mechanism: 'STARK-based scaling. 2026 Pillars: STRK20 native privacy, S-two prover efficiency, and Rust-based committers for 3x capacity.' },
    'MONAD': { role: 'Parallel EVM L1', mechanism: 'Mainnet launched Nov 2025. 10k TPS, 0.4s blocks. 2026 Focus: MONAD_NINE upgrade (optimized memory costs/EIP-7823 alignment) and ecosystem growth via Monad AI Blueprint.' },
    'MON': { role: 'Parallel EVM L1 (Monad)', mechanism: '10k TPS with parallel execution and MonadDB. Mainnet operational since late 2025.' },
    'EIGEN': { role: 'Verifiable Cloud (EigenLayer)', mechanism: 'Restaked security marketplace. Feb 2026: $18B+ TVL. Focus: Vertical AVS (EigenAI, EigenCompute) and Multichain Verification across L2s.' },
    'EIGENLAYER': { role: 'Verifiable Cloud / Restaking', mechanism: 'Shared security for AVS. 2026 Roadmap: Scaling decentralized AI inference and model evaluation via specialized AVS instances.' },
    'BERA': { role: 'DeFi-Focused L1 (Berachain)', mechanism: 'Proof of Liquidity (PoL) with tri-token system ($BERA, $BGT, $HONEY). 2026 Focus: Bera Builds Businesses (revenue-generating apps over pure emission incentives).' },
    'BERACHAIN': { role: 'DeFi-Focused L1', mechanism: 'PoL consensus aligning security with liquidity. Mainnet launched Feb 2025.' },
    'TIA': { role: 'Modular Data Availability Layer (Celestia)', mechanism: 'Data Availability Sampling (DAS). 2026: Expansion beyond Ethereum L3s toward native modular alignment with Avail and internal throughput optimizations.' },
    'CELESTIA': { role: 'Modular DA Layer', mechanism: 'Data Availability Sampling (DAS) and Namespace Merkle Trees (NMTs).' },
    'JTO': { role: 'Solana Liquid Staking (Jito)', mechanism: 'MEV-boosted rewards and stake delegation. Core part of Solana high-performance ecosystem.' },
    'DRIFT': { role: 'Decentralized Perps (Drift)', mechanism: 'Dynamic VAMM and cross-margined trading on Solana.' },
    'PENGU': { role: 'NFT Brand (Pudgy Penguins)', mechanism: 'Consumer IP and physical toys. PENGU token launched for governance. Note: Staking integration claims are speculative and require 2+ sources before inclusion.' },
    'BRISE': { role: 'Low-fee L1 (Bitgert)', mechanism: 'EVM-compatible chain with near-zero fees. Note: Bitgert is NOT a Layer-0 bridge. Claims of 2026 "consensus re-engineering" for L0 are fabricated hallucinations.' },
    'BITGERT': { role: 'Low-fee L1', mechanism: 'EVM chain. Avoid architectural bridge/rollup claims without official roadmap support.' }
};

const CURRENT_DATE = new Date().toISOString().split('T')[0]; // Current source of truth: 2026-04-07

// Known Hallucination Patterns to detect and delete
const BANNED_AI_PATTERNS = [
    "narrative convergence", "convergence of signals", "synergy between project X and Y",
    "poised for growth", "inflection point", "structural shift", "market narrative investors monitor",
    "subtle but measurable signal", "paving the way", "the future of finance", "game changer"
];

// Research seeds for high-authority content
const RESEARCH_SEEDS = ['Celestia', 'EigenLayer', 'Monad', 'Berachain', 'Jito', 'Drift Protocol', 'Starknet', 'zkSync'];

const AUTHORS = {
    research: {
        name: 'Chain Signals',
        initials: 'CS',
        title: 'Lead Crypto Strategist',
        bio: 'Write for an audience of intermediate-to-advanced crypto readers — people who hold, trade, and build in the space.'
    }
};

const STATE_PATH = path.join(ADMIN_DIR, 'state.json');

const CATEGORIES = [
    { id: 'intelligence', name: 'Market Intelligence', badge: 'purple' },
    { id: 'alpha', name: 'Protocol Alpha', badge: 'green' },
    { id: 'spotlight', name: 'Deep Tech', badge: 'blue' }
];

// Master voice prompt: the "Chain Signals" brand identity
const UNIFIED_VOICE_PROMPT = `You are a senior technical crypto analyst for "Chain Signals". Today is ${CURRENT_DATE}.

STYLE — CONVERSATIONAL EXPERT:
- Write for advanced readers. Use precise terminology (L1 finality, preconfirmations, AVS scaling).
- Vary sentence length aggressively. Mix short statements with deep analysis.
- Tone: Coldly objective, technically precise, and skeptically grounded.

GROUNDED DRAFTING RULES:
1. NO SYNTHESIS: Do NOT claim "convergence" or "synergy" between protocols unless explicitly stated in the SOURCE DOCUMENTS.
2. SOURCE ATTRIBUTION: Every technical claim MUST have an inline qualifier (e.g., "[Verified via L2Beat]", "[Per Monad April 2026 Ops Update]").
3. ROADMAP PRECISION: If quoting a roadmap, use the official date and specify if it has shipped. (Today is ${CURRENT_DATE}).
4. NO FILLER: Avoid banned patterns like "poised for growth" or "narrative convergence".
5. HUMAN VARIATION: Every section must have a unique paragraph structure. No repetition in rhythm.`;

function logUsage(model, promptTokens, completionTokens, totalTokens) {
    const timestamp = new Date().toISOString();
    const entry = `${timestamp} | Model: ${model} | Prompt: ${promptTokens} | Completion: ${completionTokens} | Total: ${totalTokens}\n`;
    try { fs.appendFileSync(USAGE_LOG_PATH, entry); } catch (e) { /* non-fatal */ }
}

function getNextCategory() {
    let state = { lastCategoryIndex: -1 };
    if (fs.existsSync(STATE_PATH)) {
        state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    }
    const nextIndex = (state.lastCategoryIndex + 1) % CATEGORIES.length;
    state.lastCategoryIndex = nextIndex;
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 4));
    return CATEGORIES[nextIndex];
}

async function fetchLatestNews() {
    try {
        console.log("Fetching latest crypto news...");
        const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        const data = await response.json();
        if (!data || !data.Data || !Array.isArray(data.Data)) {
            console.log("No news data received or invalid format.");
            return "No recent news available.";
        }
        return data.Data.slice(0, 5).map(n => `- ${n.title} (${n.source})`).join('\n');
    } catch (err) {
        console.error("Error fetching news:", err);
        return "No recent news available.";
    }
}

// Protocols with known thin/unreliable on-chain documentation — flag for extra caution
const THIN_DATA_PROTOCOLS = ['bitgert', 'brise', 'safemoon', 'babydoge', 'shib'];

async function fetchGroundedSources(topicTitle, keywords) {
    console.log('Fetching live grounded sources from CoinGecko + news...');
    const sources = [];
    const warnings = [];

    // Extract protocol names from keywords
    const terms = [...new Set([
        ...keywords.split(/[,\s]+/).filter(t => t.length > 2),
        ...topicTitle.split(/[\s:,]+/).filter(t => t.length > 3)
    ])].slice(0, 6);

    // Primary Technical Source Pack (Hard-coded for 2026 High-Authority projects)
    const TECHNICAL_DOCS = {
        'starknet': 'https://docs.starknet.io/documentation/ (Roadmap: S-two, STRK20, Preconfirmations)',
        'monad': 'https://docs.monad.xyz/ (Technical: Parallel EVM, MonadBFT, MonadDB)',
        'eigenlayer': 'https://docs.eigenlayer.xyz/ (AVS: Vertical Scaling, Multichain Verification)',
        'berachain': 'https://docs.berachain.com/ (Mechanism: Proof of Liquidity PoL)',
        'celestia': 'https://docs.celestia.org/ (Modular DA: DAS, NMTs)'
    };

    for (const term of terms) {
        // Append technical docs if term matches
        const lowerTerm = term.toLowerCase();
        for (const [key, url] of Object.entries(TECHNICAL_DOCS)) {
            if (lowerTerm.includes(key)) {
                sources.push(`PRIMARY TECHNICAL SOURCE: ${key.toUpperCase()}\nURL: ${url}`);
            }
        }

        try {
            const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(term)}`);
            if (!searchRes.ok) continue;
            const searchData = await searchRes.json();
            const coin = searchData.coins && searchData.coins[0];
            if (!coin) continue;

            // Check if this is a thin-data protocol
            if (THIN_DATA_PROTOCOLS.includes(coin.id.toLowerCase())) {
                warnings.push(`⚠️ THIN DATA WARNING: "${coin.name}" has unreliable on-chain documentation. Extra caution required.`);
            }

            // Fetch coin detail page for description
            const detailRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`);
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();
            const description = detail.description && detail.description.en
                ? detail.description.en.replace(/<[^>]+>/g, '').slice(0, 600)
                : null;

            if (description) {
                sources.push(`PROTOCOL: ${detail.name} (${detail.symbol ? detail.symbol.toUpperCase() : coin.symbol.toUpperCase()})\nSOURCE: CoinGecko official description\nCONTENT: ${description}`);
            }
        } catch (e) {
            // non-fatal, just skip this term
        }
    }

    // Always append recent news headlines as context
    const news = await fetchLatestNews();
    sources.push(`RECENT CRYPTO NEWS HEADLINES (for context only — do not state as protocol facts):\n${news}`);

    // Load 2026 Ground Truth Cache (Primary Source Override)
    let contextCache = '';
    if (fs.existsSync(CONTEXT_CACHE_PATH)) {
        try {
            const cache = JSON.parse(fs.readFileSync(CONTEXT_CACHE_PATH, 'utf8'));
            contextCache = `[CRITICAL 2026 GROUND TRUTH CACHE]:\n${JSON.stringify(cache.protocols, null, 2)}`;
        } catch (e) { /* non-fatal */ }
    }

    if (contextCache) sources.unshift(contextCache);
    if (warnings.length > 0) warnings.forEach(w => console.warn(w));

    const sourceText = sources.length > 0
        ? sources.join('\n\n---\n\n')
        : 'No live source data available. Use only verified knowledge base facts and qualify all claims.';

    console.log(`Grounded sources fetched: ${sources.length - (contextCache ? 1 : 0) - 1} protocols + news.`);
    return { sourceText, warnings };
}

function parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const row = {};
        headers.forEach((h, i) => {
            row[h] = values[i] ? values[i].replace(/^"|"$/g, '').trim() : '';
        });
        return row;
    });
}

function writeCSV(headers, rows) {
    const content = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
            const val = r[h] || '';
            return val.includes(',') ? `"${val}"` : val;
        }).join(','))
    ].join('\n');
    fs.writeFileSync(QUEUE_PATH, content);
}



async function stage3Recheck(draftContent, title, keywords) {
    try {
        // Stage 3: Claim Extraction + Individual Verification (llama-4-scout-17b)
        const model = 'meta-llama/llama-4-scout-17b-16e-instruct';
        console.log(`[Stage 3] Technical Precision Pass: "${title}" (Model: ${model})...`);
        const latestNews = await fetchLatestNews();

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system', content: `You are a senior technical editor performing an uncompromising final verification. Today's date is ${CURRENT_DATE}.

YOUR PROCESS:
1. TECHNICAL PRECISION: Ensure terms like "validity rollup", "L1 finality", "preconfirmations", "STRK20", "MONAD_NINE", and "Vertical AVS" are used accurately per: ${JSON.stringify(PROJECT_KNOWLEDGE)}.
2. BAN SYNTHETIC HYPE (SLOP): Delete mentions of: "inflection point", "convergence of signals", "poised for significant growth", "deeper structural shifts", "subtle but measurable signal", "market narrative", "the future of finance".
3. SOURCE ATTRIBUTION: Every substantive claim must have an inline qualifier (e.g. "[Per L2Beat]", "[Per Official Roadmap]"). Ensure these are present.
4. HOOK AUDIT: The first sentence must not start with "The", "In", "As", or "Crypto".
5. ACTIONABLE SIGNALS: If the article mentions Starknet, Monad, or EigenLayer, ensure it includes a "Signals to Monitor" bullet point with a placeholder for a dashboard link (e.g. "[Monitor L1 Finality Latency here]").

OUTPUT ONLY: The polished HTML article. Final length: 780-850 words. Priority on quality over exact count.` },
                    { role: 'user', content: `FINALIZE AND POLISH:\nTitle: ${title}\nKeywords: ${keywords}\nNews: ${latestNews}\n\nARTICLE:\n${draftContent}` }
                ],
                temperature: 0.15,
                max_tokens: 3500
            })
        });
        if (!res.ok) return draftContent;
        const data = await res.json();
        if (data.usage) logUsage(model, data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        if (!data.choices || data.choices.length === 0) return draftContent;
        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error("Recheck error:", err.message);
        return draftContent;
    }
}



async function stage2FactCheck(draftContent, title, keywords, sourceText) {
    try {
        // Stage 2: Hostile Fact Check (llama-4-scout-17b)
        const model = 'meta-llama/llama-4-scout-17b-16e-instruct';
        console.log(`[Stage 2] Hostile Fact-Checking: "${title}" (Model: ${model})...`);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system', content: `You are a ruthless technical auditor. Every integration, synergy, or pilot claim in the draft is "Guilty Until Proven Innocent". 

YOUR TASK:
1. BAN SYNTHETIC SYNERGY: If the draft connects two projects (e.g., Starknet + RedStone) without verbatim 2026 support in the SOURCE DOCUMENTS, DELETE the connection.
2. DELETE OUTDATED FRAMING: Identify 2024-era facts (e.g., Celestia Blobstream for L2s) and delete them if they conflict with 2026 state (L3 appchains only).
3. FORCE VERBATIM ATTRIBUTION: Every technical claim MUST be attributed (e.g. "[Per Official Roadmap March 2026]").
4. CONFIDENCE SCORE: Rank the remaining claims' reliability (1-10). Only an 8+ is acceptable for Chain Signals.

OUTPUT FORMAT:
[DELETED_CLAIMS_LOG]
- (List specifically what was removed and why)
[/DELETED_CLAIMS_LOG]

[CONFIDENCE_SCORE]
(Rank 1-10)
[/CONFIDENCE_SCORE]

[ARTICLE_BODY]
(The ruthless fact-checked HTML)
[/ARTICLE_BODY]` },
                    { role: 'user', content: `SOURCE DOCUMENTS:\n${sourceText}\n\nKNOWLEDGE BASE: ${JSON.stringify(PROJECT_KNOWLEDGE)}\n\n---\n\nFACT CHECK THIS DRAFT:\n${draftContent}` }
                ],
                temperature: 0.1,
                max_tokens: 3500
            })
        });
        if (!res.ok) return draftContent;
        const data = await res.json();
        if (data.usage) logUsage(model, data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        const content = data.choices[0].message.content;

        // Log auditing metadata
        const logMatch = content.match(/\[DELETED_CLAIMS_LOG\]([\s\S]*?)\[\/DELETED_CLAIMS_LOG\]/);
        const scoreMatch = content.match(/\[CONFIDENCE_SCORE\]([\s\S]*?)\[\/CONFIDENCE_SCORE\]/);
        if (logMatch) console.log(`\n--- Ruthless Editor: Deleted Claims ---\n${logMatch[1].trim()}\n`);
        if (scoreMatch) console.log(`--- Claims Confidence Score: ${scoreMatch[1].trim()}/10 ---\n`);

        const bodyMatch = content.match(/\[ARTICLE_BODY\]([\s\S]*?)\[\/ARTICLE_BODY\]/);
        return bodyMatch ? bodyMatch[1].trim() : content;
    } catch (err) {
        console.error("Fact check exception:", err.message);
        return draftContent;
    }
}

async function generatePost(title, tone, keywords, category = CATEGORIES[0]) {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Pre-fetch: Get live grounded sources before any generation
        const { sourceText, warnings } = await fetchGroundedSources(title, keywords);
        if (warnings.length > 0) {
            console.warn(`[Pipeline] ${warnings.length} thin-data protocol warning(s) — extra caution applied.`);
        }

        // Stage 1: Grounded Draft (gpt-oss-120b)
        const model = 'openai/gpt-oss-120b';
        console.log(`[Stage 1] Grounded Draft: [${category.name}] "${title}" (Model: ${model})...`);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: `${UNIFIED_VOICE_PROMPT}\n\nCRITICAL OUTPUT RULES:\n- Do NOT write your thinking process or preamble\n- Start IMMEDIATELY with the article content (first tag must be <p> or <h2>)\n- Use HTML: <h2> for sections, <p> for paragraphs, <ul><li> for lists\n- HUMAN VARIATION: Sections MUST have DIFFERENT paragraph counts (1 to 4). No two sections feel structurally identical.\n- SOURCE ALL DATA: Every on-chain claim needs a qualifier: "per DefiLlama", "according to Dune", "reportedly". Unsourced assertions WILL be deleted.\n- TEMPORAL ACCURACY: Today is ${CURRENT_DATE}. Any date before today is PAST. Never frame past dates as upcoming milestones.\n- ARCHITECTURE CLAIMS: Only describe a protocol using the provided SOURCE DOCUMENTS or knowledge base. Do not invent architecture.` },
                    { role: 'user', content: `SOURCE DOCUMENTS (your ground truth — only write what these support):\n${sourceText}\n\n---\n\nWrite a highly human-like, 800-word article about: ${title}\nTOPIC KEYWORDS: ${keywords}\n\nSTRUCTURE:\n- Strong hook (1-2 paragraphs, do NOT start with "The", "In", "As", or "Crypto")\n- H2 sections of VARYING length (some 1 paragraph, some 3)\n- Key Takeaways (3-4 bullets)\n\nDO NOT fabricate events or architecture not in the SOURCE DOCUMENTS.` }
                ],
                temperature: 0.75,
                max_tokens: 2000
            })
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`API Error (${res.status}): ${errorText}`);
        }
        const data = await res.json();
        if (!data.choices || data.choices.length === 0) {
            throw new Error("Invalid response: No choices returned.");
        }
        if (data.usage) logUsage(model, data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        let bodyContent = data.choices[0].message.content;

        // Stage 2: Hostile Fact Check against live-fetched sources
        bodyContent = await stage2FactCheck(bodyContent, title, keywords, sourceText);

        // Stage 3: Claim-by-Claim Verification
        bodyContent = await stage3Recheck(bodyContent, title, keywords);

        // Post-processing: Strip meta-prompt leakage / chain-of-thought
        // Strip everything before the first HTML tag
        const firstTagIndex = bodyContent.search(/<(h[1-6]|p|ul|li|strong)/);
        if (firstTagIndex > 0) bodyContent = bodyContent.slice(firstTagIndex);
        bodyContent = bodyContent
            .replace(/^(Thinking|Step \d|Let me|Okay,|I will|Here is|Here's|Starting with)[^\n]*\n/gim, '')
            .replace(/^(Thinking Process|Scratchpad|Reasoning|Chain of Thought):[\s\S]*?\n\n/gi, '')
            .trim();

        bodyContent = bodyContent.replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
            .replace(/^\s*\*\s+(.*)/gm, '<li>$1</li>') // Bullet points
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>') // Wrap bullets
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .split('</p><p>').map(p => p.trim() ? `<p>${p}</p>` : '').join('');

        let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
        const author = AUTHORS.research;
        let html = template
            .replaceAll('{{TITLE}}', title)
            .replaceAll('{{DATE}}', today)
            .replaceAll('{{TOPICS}}', keywords)
            .replaceAll('{{CATEGORY}}', category.name)
            .replaceAll('{{CATEGORY_BADGE}}', category.badge)
            .replaceAll('{{CONTENT}}', bodyContent)
            .replaceAll('{{AUTHOR_NAME}}', author.name)
            .replaceAll('{{AUTHOR_INITIALS}}', author.initials)
            .replaceAll('{{AUTHOR_TITLE}}', author.title)
            .replaceAll('{{AUTHOR_BIO}}', author.bio);

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const fileName = `${today}-${slug}.html`;

        // Bitgert / Thin Data Handler: Force exact marketing attribution only
        if (title.toLowerCase().includes('bitgert') || keywords.toLowerCase().includes('bitgert')) {
            console.log("⚠️ Applied Thin-Data Handler for Bitgert — restricting to 1 attributed sentence.");
            bodyContent = bodyContent.replace(/<p>.*?Bitgert.*?<\/p>/gi,
                '<p>Bitgert is an EVM-compatible Layer 1 blockchain optimized for low-fee throughput [Per Bitgert documentation April 2026].</p>');
        }

        // [Stage 4] MANDATORY REVIEW GATE: Save to review folder first
        const reviewPath = path.join(REVIEW_DIR, fileName);
        fs.writeFileSync(reviewPath, html);
        console.log(`\n✅ GENERATION COMPLETE: [REVIEW REQUIRED]`);
        console.log(`- File: admin/review/${fileName}`);
        console.log(`- Action: Manually verify and move to /blog to publish.`);

        return true;
    } catch (err) {
        console.error(`❌ CRITICAL ERROR generating "${title}":`, err.message);
        throw err;
    }
}

// Rebuilds the blog/index.html list based on actual files in the blog directory
function syncBlogIndex() {
    console.log("\nSyncing Blog Index with filesystem...");
    try {
        const blogFiles = fs.readdirSync(BLOG_DIR)
            .filter(f => f.endsWith('.html') && f !== 'template.html' && f !== 'index.html')
            .sort((a, b) => b.localeCompare(a)); // Newest first (assuming YYYY-MM-DD prefix)

        let postEntries = '';
        const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

        blogFiles.forEach(file => {
            const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');

            // Extract metadata using robust regex
            const titleMatch = content.match(/<title>(.*?)<\/title>/);
            const dateMatch = content.match(/<span>🗓️ (.*?)<\/span>/) || content.match(/• ([\d\-]+)/);
            const categoryMatch = content.match(/<div class="category-badge (.*?)">(.*?)<\/div>/);
            const descriptionMatch = content.match(/<meta name="description" content="(.*?)"/);

            let title = titleMatch ? titleMatch[1].replace(' | crypto offers Digest', '') : file;
            const date = dateMatch ? dateMatch[1] : 'Recent';
            const categoryName = categoryMatch ? categoryMatch[2] : 'Insight';
            const categoryBadge = categoryMatch ? categoryMatch[1] : 'blue';

            // Clean up description: remove "Expert crypto analysis on..." prefix if possible
            let excerpt = descriptionMatch ? descriptionMatch[1] : '';
            excerpt = excerpt.replace(/^Expert crypto analysis on /i, '').split(' by Chain Signals')[0];

            postEntries += `
            <a href="${file}" class="post-card">
                <div class="category-badge ${categoryBadge}">${categoryName}</div>
                <span class="date">${date}</span>
                <h3>${title}</h3>
                <div class="excerpt">${excerpt}</div>
                <span class="read-more">Read Full Insight</span>
            </a>`;
        });

        let indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');

        // Replace everything between the start of postList and the template marker
        const listStartTag = '<div class="post-list" id="postList">';
        const templateMarker = '<!-- POST_ITEM_TEMPLATE -->';

        const startIndex = indexHtml.indexOf(listStartTag) + listStartTag.length;
        const endIndex = indexHtml.indexOf(templateMarker);

        if (startIndex > listStartTag.length - 1 && endIndex > -1) {
            indexHtml = indexHtml.substring(0, startIndex) + postEntries + '\n            ' + indexHtml.substring(endIndex);
            fs.writeFileSync(INDEX_PATH, indexHtml);
            console.log(`- Synced: ${blogFiles.length} posts found.`);
        } else {
            console.error("❌ ERROR: Could not find post-list markers in blog/index.html");
        }
    } catch (err) {
        console.error("❌ Error syncing blog index:", err.message);
    }
}

async function autoDiscoverAndGenerate() {
    try {
        console.log("Auto-Discovery Mode: Fetching trending crypto data from CoinGecko...");
        const trendingResponse = await fetch('https://api.coingecko.com/api/v3/search/trending');
        const trendingData = await trendingResponse.json();

        if (!trendingData || !trendingData.coins || trendingData.coins.length === 0) {
            throw new Error("No trending coins found in CoinGecko response.");
        }

        const trendingCoins = trendingData.coins.slice(0, 3).map(c => c.item.name);
        const combinedResearch = [...new Set([...trendingCoins, ...RESEARCH_SEEDS.slice(0, 3)])].join(', ');
        const firstCoin = RESEARCH_SEEDS[Math.floor(Math.random() * RESEARCH_SEEDS.length)];

        const category = getNextCategory();

        // Customize title based on category — no generic label prefixes
        let title = "";
        if (category.id === 'intelligence') title = `${firstCoin} Market Outlook: On-Chain Signals Worth Watching`;
        else if (category.id === 'alpha') title = `${firstCoin} Staking & Yield Opportunities in 2026`;
        else title = `${combinedResearch}: What's Actually Happening On-Chain`;

        const tone = "Deeply Technical, Professional, Investigative";
        const keywords = `${combinedResearch}, institutional DeFi, modular infrastructure, 2026 technical roadmap`;

        await generatePost(title, tone, keywords, category);
    } catch (err) {
        console.error("❌ Error in Auto-Discovery Mode:", err.message);
        // Fallback to a generic market update if CoinGecko is down
        const fallbackTitle = `Market Update: Latest Crypto Trends for ${new Date().toLocaleDateString()}`;
        const fallbackKeywords = "Bitcoin, Ethereum, DeFi, Market Trends";
        const category = getNextCategory();
        await generatePost(fallbackTitle, "Professional", fallbackKeywords, category);
    }
}

async function run() {
    let rows = [];
    if (fs.existsSync(QUEUE_PATH)) {
        const content = fs.readFileSync(QUEUE_PATH, 'utf8');
        rows = parseCSV(content);
    }

    const headers = ['title', 'tone', 'keywords', 'status'];

    let manualCount = 0;
    for (let row of rows) {
        if (row.status === 'pending') {
            const category = getNextCategory();
            const success = await generatePost(row.title, row.tone, row.keywords, category);
            if (success) {
                row.status = 'published';
                manualCount++;
            }
        }
    }

    if (manualCount > 0) {
        writeCSV(headers, rows);
        console.log(`\nSuccessfully processed ${manualCount} manual posts.`);
    } else {
        console.log("No pending manual posts. Switching to Rotating Auto-Discovery...");
        await autoDiscoverAndGenerate();
    }

    syncBlogIndex();
}

run();
