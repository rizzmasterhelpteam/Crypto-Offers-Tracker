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
    'MON': { role: 'Parallelized EVM Layer 1 (Monad)', mechanism: 'Parallel execution and MonadDb for high-performance consensus' },
    'MONAD': { role: 'Parallelized EVM Layer 1', mechanism: 'Parallel execution and MonadDb for high-performance consensus' },
    'BERA': { role: 'DeFi-Focused Layer 1 (Berachain)', mechanism: 'Proof of Liquidity (PoL) and tri-token system ($BERA, $BGT, $HONEY)' },
    'BERACHAIN': { role: 'DeFi-Focused Layer 1', mechanism: 'Proof of Liquidity (PoL) and tri-token system' },
    'JTO': { role: 'Solana MEV-Powered Liquid Staking (Jito)', mechanism: 'Maximum Extractable Value (MEV) redistribution to stakers' },
    'DRIFT': { role: 'Decentralized Perceptual DEX on Solana', mechanism: 'Dynamic Virtual AMM (dAMM) and cross-margined trading' },
    'JUP': { role: 'Solana Liquidity & Swap Aggregator (Jupiter)', mechanism: 'Metis routing and decentralized limit order engine' },
    'REDSTONE': { role: 'Modular Oracle Provider', mechanism: 'Push/Pull data delivery for low-latency L1s/L2s' },
    'SIREN': { role: 'Decentralized Options & Derivatives Protocol', mechanism: 'On-chain option writing and AMM-based trading' },
    'TRUEFI': { role: 'Uncollateralized Institutional Lending', mechanism: 'Credit-based lending pools on Ethereum' },
    'TRU': { role: 'Uncollateralized Institutional Lending', mechanism: 'Credit-based lending pools on Ethereum' },
    'LDO': { role: 'Liquid Staking Protocol (Lido)', mechanism: 'Tokenized staked ETH and decentralized validator sets' },
    'TAIKO': { role: 'Based Rollup (Taiko)', mechanism: 'Decentralized sequencing via Ethereum L1' },
    'STARKNET': { role: 'ZK-Rollup (Starknet)', mechanism: 'STARK-based scaling with Cairo language' },
    'ZKSYNC': { role: 'ZK-Rollup (zkSync Era)', mechanism: 'ZK-SNARK scalability with native account abstraction' }
};

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
const UNIFIED_VOICE_PROMPT = `You are a senior crypto analyst and writer for "Chain Signals" — a trusted independent blog for serious DeFi and blockchain readers.

YOUR AUDIENCE: Intermediate-to-advanced crypto readers: people who already hold, trade, and build. Skip basic explanations.

WRITING STYLE:
- Write in first-person confident voice — direct, clear, opinionated
- Use short punchy paragraphs (2-3 sentences). Never write walls of text.
- One-liners are powerful. Use them for emphasis.
- Rhetorical questions and light skepticism are welcome
- Sound like a smart insider sharing a genuine take, not a content farm

SEO STRUCTURE RULES (Google ranking):
- Start with a hook sentence that directly states the article's value proposition
- Use H2 headers every 150-200 words
- H2 headers must contain the target keyword or a natural variant
- Include a "Key Takeaways" or summary section at the end
- Target 750-850 words total
- Write for featured snippets: lead each section with a direct, declarative answer

FACT DISCIPLINE:
- NEVER invent TVL numbers, APY percentages, dates, or specific events
- If uncertain about a figure, write "reportedly" or "per on-chain data" as a qualifier
- Do NOT fabricate protocol integrations or exploit narratives as bridges
- Stick to what's verifiable from the context provided`;

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
                        role: 'system', content: `You are a rigorous senior fact-checker at a specialist crypto publication. You have ZERO tolerance for inaccuracies.

STRICT FACT CHECK RULES — APPLY EVERY ONE:
1. TICKER ACCURACY: Every coin/token ticker mentioned MUST match exactly: ${JSON.stringify(PROJECT_KNOWLEDGE)}. Wrong ticker? Delete the sentence.
2. PROTOCOL ROLE ACCURACY: If a protocol's described role does not match its actual function in the knowledge base, REWRITE the sentence using the correct description.
3. HALLUCINATION REMOVAL: Any fabricated on-chain event, exploit, partnership, integration, or launch date NOT present in the knowledge base MUST BE DELETED — do NOT replace it with something else.
4. DATA QUALIFICATION: Any TVL, APY, price, or percentage figure without a source qualifier (e.g. "reportedly", "per DefiLlama") MUST be qualified or removed.
5. NARRATIVE INTEGRITY: Do NOT let AI narrative glue survive. If a paragraph only exists to connect two sections but contains no factual substance, DELETE it.
6. TITLE CLEANUP: The article title MUST NOT contain generic phrases like "Alpha Report", "Technical Deep Dive", "Deep Tech", or "Protocol Alpha". If present, rewrite it.
7. PRESERVE STRUCTURE: Keep all valid HTML (<h2>, <h3>, <p>, <ul>, <li>, <strong>). Do not add or remove tags.
8. WORD COUNT: Keep the article approximately 800 words. Do not expand beyond 900 words.

OUTPUT ONLY: The fact-checked article in HTML. No preamble. No explanations.` },
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
                    { role: 'system', content: `${UNIFIED_VOICE_PROMPT}\n\nCRITICAL OUTPUT RULES:\n- Do NOT write your thinking process or preamble\n- Start IMMEDIATELY with the article content\n- Use HTML formatting: <h2> for sections, <p> for paragraphs, <ul><li> for lists\n- Output a HIGHLY HUMAN-LIKE blog post demonstrating E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) that will rank well in Google.\n- The article title should be the FIRST line as plain text (not wrapped in a tag)` },
                    { role: 'user', content: `Write a highly human-like, 800-word article for a crypto blog about: ${title}\n\nTOPIC CONTEXT: ${keywords}\n\nREQUIREMENTS:\n1. E-E-A-T FOCUS: Write with deep expertise. Show authoritativeness and trustworthiness.\n2. GOOGLE RANKING: Optimize naturally for search intent. Include an engaging hook and a summary "Key Takeaways".\n3. HUMAN VOICE: Use active voice, conversational tone, short paragraphs, and varied sentence length. Avoid robotic phrasing.\n4. LENGTH: Approximately 800 words.\n5. STRUCTURE:\n   - Hook (Intro paragraph)\n   - H2 Sections for technical deep dives and core issues\n   - Key Takeaways (Bullet points)\n\nDO NOT fabricate events.` }
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
