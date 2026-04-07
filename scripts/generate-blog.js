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

// SOURCE OF TRUTH: Hard-coded knowledge to prevent AI hallucinations on project types
const PROJECT_KNOWLEDGE = {
    'TIA': { role: 'Modular Data Availability Layer (Celestia)', mechanism: 'Data Availability Sampling (DAS) and Namespace Merkle Trees' },
    'CELESTIA': { role: 'Modular Data Availability Layer', mechanism: 'Data Availability Sampling (DAS) and Namespace Merkle Trees' },
    'EIGEN': { role: 'Ethereum Restaking Primitive (EigenLayer)', mechanism: 'Shared security via Actively Validated Services (AVS)' },
    'EIGENLAYER': { role: 'Ethereum Restaking Primitive', mechanism: 'Shared security via Actively Validated Services (AVS)' },
    'MON': { role: 'Parallelized EVM Layer 1 (Monad)', mechanism: 'Parallel execution and MonadDb for high-performance consensus. As of April 2026 the mainnet has not launched — claims about a shipped zk-rollup engine are NOT verified.' },
    'MONAD': { role: 'Parallelized EVM Layer 1', mechanism: 'Parallel execution and MonadDb for high-performance consensus. As of April 2026 the mainnet has not launched — claims about a shipped zk-rollup engine are NOT verified.' },
    'BERA': { role: 'DeFi-Focused Layer 1 (Berachain)', mechanism: 'Proof of Liquidity (PoL) and tri-token system ($BERA, $BGT, $HONEY)' },
    'BERACHAIN': { role: 'DeFi-Focused Layer 1', mechanism: 'Proof of Liquidity (PoL) and tri-token system' },
    'JTO': { role: 'Solana MEV-Powered Liquid Staking (Jito)', mechanism: 'Maximum Extractable Value (MEV) redistribution to stakers' },
    'DRIFT': { role: 'Decentralized Perpetual DEX on Solana', mechanism: 'Dynamic Virtual AMM (dAMM) and cross-margined trading' },
    'JUP': { role: 'Solana Liquidity & Swap Aggregator (Jupiter)', mechanism: 'Metis routing and decentralized limit order engine' },
    'REDSTONE': { role: 'Modular Oracle Provider', mechanism: 'Push/Pull data delivery for low-latency L1s/L2s' },
    'SIREN': { role: 'Decentralized Options & Derivatives Protocol', mechanism: 'On-chain option writing and AMM-based trading' },
    'TRUEFI': { role: 'Uncollateralized Institutional Lending', mechanism: 'Credit-based lending pools on Ethereum' },
    'TRU': { role: 'Uncollateralized Institutional Lending', mechanism: 'Credit-based lending pools on Ethereum' },
    'LDO': { role: 'Liquid Staking Protocol (Lido)', mechanism: 'Tokenized staked ETH and decentralized validator sets' },
    'TAIKO': { role: 'Based Rollup (Taiko)', mechanism: 'Decentralized sequencing via Ethereum L1' },
    'STARKNET': { role: 'ZK-Rollup (Starknet)', mechanism: 'STARK-based scaling with Cairo language' },
    'ZKSYNC': { role: 'ZK-Rollup (zkSync Era)', mechanism: 'ZK-SNARK scalability with native account abstraction' },
    'BRISE': { role: 'EVM-Compatible Layer 1 (Bitgert chain)', mechanism: 'Bitgert is a low-fee EVM-compatible chain. It is NOT a Layer-0 bridge, NOT a ZK rollup, and has no verified institutional DeFi integrations. Treat all unverified Bitgert architecture claims as hallucinations.' },
    'BITGERT': { role: 'EVM-Compatible Layer 1', mechanism: 'Bitgert is a low-fee EVM-compatible chain, NOT a Layer-0 bridge or ZK rollup.' },
    'TAO': { role: 'Decentralized AI Network (Bittensor)', mechanism: 'Incentivized machine learning marketplace where validators rank subnets and miners earn TAO for producing useful AI outputs' },
    'BITTENSOR': { role: 'Decentralized AI Network', mechanism: 'Incentivized machine learning marketplace with subnet structure' },
    'PENGU': { role: 'NFT Collection & Community Token (Pudgy Penguins)', mechanism: 'Pudgy Penguins is an Ethereum NFT collection. PENGU is their governance/community token. Any staking mechanics or governance claims should be qualified as unverified unless independently confirmed.' },
    'PUDGY_PENGUINS': { role: 'Ethereum NFT Collection with community token PENGU', mechanism: 'Consumer-focused NFT brand with physical toy licensing. Staking claims are unverified — do not state as fact.' }
};

const CURRENT_DATE = new Date().toISOString().split('T')[0]; // e.g. 2026-04-07

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
const UNIFIED_VOICE_PROMPT = `You are a senior crypto analyst and writer for "Chain Signals" — a trusted independent blog for serious DeFi and blockchain readers. Today's date is ${CURRENT_DATE}.

YOUR AUDIENCE: Intermediate-to-advanced crypto readers who already hold, trade, and build. Skip basic definitions.

WRITING STYLE — HUMAN VARIATION IS MANDATORY:
- Vary your sentence length aggressively. Mix short punchy sentences with longer analytical ones.
- Vary your paragraph length. Some paragraphs can be 1 sentence. Others 4. Never two identical-length paragraphs in a row.
- Vary your register: switch between analytical observation, direct opinion, and honest uncertainty.
- Sound like one person writing, not a template being filled in.
- Use rhetorical questions and light skepticism naturally — not as a formula.

SEO STRUCTURE RULES:
- Start with a hook that states a tension, surprise, or genuine insight
- Use H2 headers every 150-200 words, each containing a natural keyword
- Include "Key Takeaways" bullets at the end
- Target 750-850 words

FACT DISCIPLINE — NON-NEGOTIABLE:
- NEVER state on-chain data (TVL, volume, APY, price) as fact without a source qualifier: "per DefiLlama", "according to Dune", "reportedly", "per on-chain trackers"
- NEVER make architectural claims about a protocol that are not in the provided knowledge base
- NEVER reference a roadmap date that is in the past without stating whether it shipped
- If the current date is ${CURRENT_DATE}, any date before this is in the past — do NOT frame past dates as upcoming milestones
- If you are unsure whether something shipped, write "reportedly" or "worth verifying independently"
- Do NOT fabricate integrations, exploits, or partnerships as narrative bridges`;

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

    for (const term of terms) {
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

    if (warnings.length > 0) warnings.forEach(w => console.warn(w));

    const sourceText = sources.length > 0
        ? sources.join('\n\n---\n\n')
        : 'No live source data available. Use only verified knowledge base facts and qualify all claims.';

    console.log(`Grounded sources fetched: ${sources.length - 1} protocols + news.`);
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
        console.log(`[Stage 3] Claim Verification: "${title}" (Model: ${model})...`);
        const latestNews = await fetchLatestNews();

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system', content: `You are a senior technical editor performing an uncompromising final verification. Today's date is ${CURRENT_DATE}.

YOUR PROCESS — APPLY IN ORDER:
STEP 1 — EXTRACT CLAIMS: Mentally list every factual assertion in the article (protocol roles, architecture claims, on-chain data, dates, integrations).
STEP 2 — VERIFY EACH CLAIM against: ${JSON.stringify(PROJECT_KNOWLEDGE)}
  - If a claim is supported by the knowledge base: keep it.
  - If a claim is NOT in the knowledge base and is not qualified: add "reportedly" or delete it.
  - If a claim references a date in the past (before ${CURRENT_DATE}) as an upcoming milestone: fix it.
STEP 3 — STRIP AI ARTIFACTS:
  BANNED phrases (delete on sight): "In summary", "In conclusion", "Let's explore", "It is crucial to",
  "It is important to note", "As we can see", "In the ever-evolving", "The world of crypto",
  "Navigate the landscape", "Delve into", "Undoubtedly", "It's worth noting".
STEP 4 — HUMAN VOICE: If any two consecutive sections have the same sentence count or rhythm, vary one of them.
STEP 5 — HOOK CHECK: The first sentence must not start with "The", "In", "As", or "Crypto". If it does, rewrite it.
STEP 6 — HTML CLEANUP: Only <h2>, <h3>, <p>, <ul>, <li>, <strong> allowed. Strip <div>, <span>, inline styles, and chain-of-thought output.
STEP 7 — WORD COUNT: Final must be 780-850 words.

OUTPUT ONLY: The final article in clean HTML. No preamble. No list of changes.` },
                    { role: 'user', content: `VERIFY AND FINALIZE:\nTitle: ${title}\nKeywords: ${keywords}\nRecent news context: ${latestNews}\n\nARTICLE:\n${draftContent}` }
                ],
                temperature: 0.25,
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
        // Stage 2: Hostile Fact Check against live-fetched sources (llama-4-scout-17b)
        const model = 'meta-llama/llama-4-scout-17b-16e-instruct';
        console.log(`[Stage 2] Hostile Fact Check: "${title}" (Model: ${model})...`);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system', content: `You are a hostile technical editor with zero tolerance for unsourced claims. Today's date is ${CURRENT_DATE}.

You have been given SOURCE DOCUMENTS containing live, verified information about the protocols in this article.
Your job: find every claim in the draft that is NOT directly supported by the SOURCE DOCUMENTS and either fix or delete it.

HOSTILE FACT-CHECK RULES:
1. SUPPORTED CLAIMS ONLY: If a protocol architecture claim (e.g. "Layer-0 bridge", "zk-rollup engine", "staking mechanism") is NOT present in the SOURCE DOCUMENTS, DELETE it immediately. Do not give it the benefit of the doubt.
2. UNSOURCED DATA: Any TVL, APY, price, volume, or percentage not in the SOURCE DOCUMENTS must be preceded by "reportedly" or removed.
3. TEMPORAL ACCURACY: Any date before ${CURRENT_DATE} is PAST. Reframe "upcoming" past dates as "was scheduled for [date] — verify if shipped".
4. KNOWLEDGE BASE CROSS-CHECK: Also verify against this hard knowledge base: ${JSON.stringify(PROJECT_KNOWLEDGE)}.
5. NO HALLUCINATED ARCHITECTURE: Specific claims like "Layer-0 bridge", "re-engineered consensus", "institutional-grade liquidity migration" require source support. If missing from SOURCE DOCUMENTS, delete them.
6. NARRATIVE GLUE REMOVAL: Delete paragraphs that exist only to connect sections with no factual content.
7. PRESERVE VALID HTML: Keep all <h2>, <h3>, <p>, <ul>, <li>, <strong>. Do not add tags.
8. WORD COUNT: Keep ~800 words.

OUTPUT ONLY: The fact-checked article in HTML. No explanation of what you changed.` },
                    { role: 'user', content: `SOURCE DOCUMENTS (use these as ground truth):\n${sourceText}\n\n---\n\nFACT CHECK THIS DRAFT:\nTitle: ${title}\nKeywords: ${keywords}\n\nDRAFT:\n${draftContent}` }
                ],
                temperature: 0.15,
                max_tokens: 3500
            })
        });
        if (!res.ok) { console.error("Fact check error:", res.status); return draftContent; }
        const data = await res.json();
        if (data.usage) logUsage(model, data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        if (!data.choices || data.choices.length === 0) return draftContent;
        return data.choices[0].message.content.trim();
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
        fs.writeFileSync(path.join(BLOG_DIR, fileName), html);
        console.log(`- Saved: blog/${fileName}`);

        return true;
    } catch (err) {
        console.error(`❌ CRITICAL ERROR generating "${title}":`, err.message);
        throw err; // Re-throw to fail the GitHub Action
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
