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

async function fetchCurrentOffers(keywords, news) {
    try {
        console.log("Identifying current crypto offers...");
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [
                    { role: 'system', content: `You are a Senior Crypto Research Lead. Identify 3-5 high-authority, research-grade crypto opportunities. Focus on: modularity, ZK-tech, restaking, and institutional DeFi. Use this knowledge base for accuracy: ${JSON.stringify(PROJECT_KNOWLEDGE)}. Research seeds: ${news}.` },
                    { role: 'user', content: `Return a tight research brief on the top 3-5 relevant opportunities for these keywords: ${keywords}. Format: NAME (TICKER) - Role - Technical moat - Key catalyst.` }
                ],
                temperature: 0.2,
                max_tokens: 800
            })
        });
        if (!res.ok) { console.error("fetchCurrentOffers API error:", res.status); return "Check our tracker for the latest active rewards."; }
        const data = await res.json();
        if (data.usage) logUsage('meta-llama/llama-4-scout-17b-16e-instruct', data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        if (!data.choices || data.choices.length === 0) return "Check our tracker for the latest active rewards.";
        return data.choices[0].message.content;
    } catch (err) {
        console.error("Error fetching offers:", err);
        return "Check our tracker for the latest active rewards.";
    }
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
        // Stage 3: Strict Recheck & Polish (llama-4-scout-17b)
        const model = 'meta-llama/llama-4-scout-17b-16e-instruct';
        console.log(`[Stage 3] Strict Recheck: "${title}" (Model: ${model})...`);
        const latestNews = await fetchLatestNews();

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system', content: `You are a senior technical editor performing an uncompromising final recheck before publication.

STRICT RECHECK RULES — NO EXCEPTIONS:
1. SECOND FACT PASS: Re-verify every protocol name, ticker, and role claim against: ${JSON.stringify(PROJECT_KNOWLEDGE)}. If still wrong after Stage 2, fix it now.
2. ZERO AI ARTIFACTS: These phrases are BANNED — delete on sight: "In summary", "In conclusion", "Let's explore", "It is crucial to", "It is important to note", "As we can see", "In the ever-evolving", "The world of crypto", "Navigate the landscape", "Delve into", "Tapestry", "Let's dive in", "Undoubtedly".
3. ACTIVE VOICE ENFORCEMENT: Convert all passive voice to active. "The protocol was upgraded by the team" → "The team upgraded the protocol".
4. PARAGRAPH QUALITY: Every paragraph must state a single clear point. If a paragraph is vague or filler, DELETE it — do not soften or paraphrase.
5. HOOK STRENGTH: The very first sentence must grab the reader immediately. If it starts with "Crypto", "The", "In", or "As" — rewrite it.
6. E-E-A-T CHECK: Ensure the article demonstrates real expertise. Remove any generic statements that a non-expert would write.
7. TITLE FINAL CHECK: Confirm title has no generic prefixes. Must be specific, keyword-rich, under 65 characters.
8. HTML VALIDITY: Only these tags allowed: <h2>, <h3>, <p>, <ul>, <li>, <strong>. Strip anything else.
9. WORD COUNT: Final article MUST be 780-850 words. Count carefully and trim or expand the last section if needed.

OUTPUT ONLY: The final article body in clean HTML. No preamble.` },
                    { role: 'user', content: `STRICT RECHECK THIS ARTICLE:\nTitle: ${title}\nKeywords: ${keywords}\nRecent context: ${latestNews}\n\nDRAFT TO RECHECK:\n${draftContent}` }
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



async function stage2FactCheck(draftContent, title, keywords) {
    try {
        // Stage 2: Strict Fact Check (llama-4-scout-17b)
        const model = 'meta-llama/llama-4-scout-17b-16e-instruct';
        console.log(`[Stage 2] Strict Fact Checking: "${title}" (Model: ${model})...`);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system', content: `You are a rigorous senior fact-checker at a specialist crypto publication. You have ZERO tolerance for inaccuracies. Today's date is ${CURRENT_DATE}.

STRICT FACT CHECK RULES — APPLY EVERY ONE:
1. TICKER ACCURACY: Every coin/token ticker mentioned MUST match exactly: ${JSON.stringify(PROJECT_KNOWLEDGE)}. Wrong ticker? Delete the sentence.
2. PROTOCOL ROLE ACCURACY: If a protocol's described role does not match its actual function in the knowledge base, REWRITE the sentence using the correct description. If a protocol is NOT in the knowledge base, use only conservative language like "reportedly" — never invent its architecture.
3. HALLUCINATION REMOVAL: Any fabricated on-chain event, exploit, partnership, integration, or launch NOT present in the knowledge base MUST BE DELETED — do NOT replace with something else.
4. DATA QUALIFICATION: Any TVL, APY, volume, price, or percentage figure without a source qualifier MUST be qualified ("per DefiLlama", "reportedly", "per on-chain data") or removed.
5. TEMPORAL CONTRADICTION: Any date mentioned that is BEFORE ${CURRENT_DATE} is in the PAST. If the article mentions a future milestone for a date that has already passed, either state "this shipped" (if verifiable) or rewrite as "was scheduled for [date] — verify current status" — never leave a past date framed as upcoming.
6. NARRATIVE GLUE REMOVAL: If a paragraph exists only to bridge two sections with no factual content — DELETE IT.
7. UNIFORM STRUCTURE DETECTION: If multiple sections have identical sentence counts and identical rhythm, flag this as AI artifact and vary the structure.
8. TITLE CLEANUP: No generic prefixes (Alpha Report, Technical Deep Dive, Deep Tech, Protocol Alpha).
9. PRESERVE VALID HTML: Keep all <h2>, <h3>, <p>, <ul>, <li>, <strong> intact.
10. WORD COUNT: Keep ~800 words. Do not exceed 900.

OUTPUT ONLY: The fact-checked article in HTML. No preamble.` },
                    { role: 'user', content: `STRICTLY FACT CHECK THIS DRAFT:\nTitle: ${title}\nTopic keywords: ${keywords}\n\nDRAFT:\n${draftContent}` }
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
        // Stage 1: Draft (gpt-oss-120b)
        const model = 'openai/gpt-oss-120b';
        console.log(`[Stage 1] Drafting: [${category.name}] "${title}" (Model: ${model})...`);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: `${UNIFIED_VOICE_PROMPT}\n\nCRITICAL OUTPUT RULES:\n- Do NOT write your thinking process or preamble\n- Start IMMEDIATELY with the article content\n- Use HTML formatting: <h2> for sections, <p> for paragraphs, <ul><li> for lists\n- HUMAN VARIATION: Sections must have DIFFERENT paragraph counts (1 to 4 paragraphs each). Different sentence lengths. No two sections can feel structurally identical.\n- SOURCE ALL DATA: Every on-chain claim needs a qualifier. "per DefiLlama", "according to Dune", "reportedly" — pick one. Unsourced data assertions will be removed in fact-checking.\n- TEMPORAL ACCURACY: Today is ${CURRENT_DATE}. Any date before today is PAST. Do not frame past dates as upcoming milestones. If a milestone was scheduled for a past date, state whether it shipped or not — do not pretend the date is still future.\n- ARCHITECTURE CLAIMS: Only describe a protocol's architecture using what is confirmed in the knowledge base. Anything outside the knowledge base must be qualified with "reportedly" or omitted.` },
                    { role: 'user', content: `Write a highly human-like, 800-word article for a crypto blog about: ${title}\n\nTOPIC CONTEXT: ${keywords}\n\nREQUIREMENTS:\n1. E-E-A-T FOCUS: Write with deep expertise. Show authoritativeness and trustworthiness.\n2. GOOGLE RANKING: Optimize naturally for search intent. Include an engaging hook and a summary "Key Takeaways".\n3. HUMAN VOICE: Vary sentence length and structure deliberately. Make each section feel different.\n4. LENGTH: Approximately 800 words.\n5. STRUCTURE:\n   - Strong hook (1-2 paragraph intro — NOT starting with "The" or "In")\n   - H2 sections of VARYING length (some 1 paragraph, some 3-4)\n   - Key Takeaways (3-4 bullet points)\n\nDO NOT fabricate events. DO NOT use roadmap dates without confirming they shipped.` }
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

        // Stage 2: Fact Check
        bodyContent = await stage2FactCheck(bodyContent, title, keywords);

        // Stage 3: Recheck
        bodyContent = await stage3Recheck(bodyContent, title, keywords);

        // Final Scrubber for residual slop
        bodyContent = bodyContent
            .replace(/^.*?(Let me|Okay,|I will|Starting with).*?\n/gi, '')
            .replace(/^(Thinking Process|Scratchpad|Reasoning):[\s\S]*?\n\n/gi, '')
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
