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



async function factCheckPost(draftContent, title, keywords) {
    try {
        // Stage 3: Quality Editor (llama-4-scout-17b)
        const model = 'meta-llama/llama-4-scout-17b-16e-instruct';
        console.log(`[Stage 3] Quality Editing: "${title}" (Model: ${model})...`);
        const latestNews = await fetchLatestNews();

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system', content: `You are a senior editor at a specialist crypto publication. Your job is quality control — not just fact-checking, but making the post EXCELLENT.

YOUR TASKS:
1. FACT ACCURACY: Cross-check all protocol claims, tickers, and roles against: ${JSON.stringify(PROJECT_KNOWLEDGE)}. Remove or qualify anything unverifiable.
2. CHOP THE FLAB: Cut generic sentences that say nothing. Every paragraph must earn its place.
3. FIX WEAK OPENERS: If the intro doesn't hook in 2 sentences, rewrite it.
4. TIGHTEN HEADLINES: H2 headers must be specific and contain keywords — not generic labels like "Overview" or "Conclusion".
5. NO AI SLOP: Remove any phrases like "In the ever-evolving crypto landscape", "It is worth noting", "Let's dive in", "As we can see".
6. LENGTH CHECK: Final article must be 750-850 words. Not shorter. Not longer. Cut or expand accordingly.
7. PRESERVE HTML: Keep the HTML structure intact (<h2>, <h3>, <p>, <ul>, <li>).

OUTPUT ONLY: The improved article body in HTML. No preamble.` },
                    { role: 'user', content: `EDIT THIS ARTICLE FOR QUALITY:\nTitle: ${title}\nKeywords: ${keywords}\nLatest context: ${latestNews}\n\nDRAFT:\n${draftContent}` }
                ],
                temperature: 0.4,
                max_tokens: 2500
            })
        });
        if (!res.ok) return draftContent;
        const data = await res.json();
        if (data.usage) logUsage(model, data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        if (!data.choices || data.choices.length === 0) return draftContent;
        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error("Quality edit error:", err.message);
        return draftContent;
    }
}

async function forensicFactAudit(content, title, keywords) {
    try {
        // Stage 4: Final Polish (qwen3-32b)
        const model = 'qwen/qwen3-32b';
        console.log(`[Stage 4] Final Polish: "${title}" (Model: ${model})...`);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system', content: `You are a senior technical editor doing a FINAL PASS before publication. Your job is to make this article publish-ready.

FINAL PASS CHECKLIST:
1. TECHNICAL TRUTH: Verify all protocol descriptions match: ${JSON.stringify(PROJECT_KNOWLEDGE)}. Fix any inaccuracies.
2. GOOGLE SEO: Ensure the first 160 characters of the first paragraph would work as a meta description. It should contain the primary keyword naturally.
3. READABILITY: Short sentences. Active voice. No passive voice constructions.
4. STRIP AI ARTIFACTS: Remove phrases like "In conclusion", "As mentioned above", "It is important to note", "Let's explore", "In summary".
5. VALID HTML: Ensure clean HTML structure only using <h2>, <h3>, <p>, <ul>, <li>, <strong>. No <div>, no <span>, no inline styles.
6. WORD COUNT: Article must be 750-850 words. Check and adjust if needed.

OUTPUT ONLY: The final, publish-ready article body in HTML. No preamble, no explanation.` },
                    { role: 'user', content: `FINAL PASS:\nTitle: ${title}\nKeywords: ${keywords}\n\nARTICLE:\n${content}` }
                ],
                temperature: 0.2,
                max_tokens: 2500
            })
        });
        if (!res.ok) return content;
        const data = await res.json();
        if (data.usage) logUsage(model, data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        if (!data.choices || data.choices.length === 0) return content;
        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error("Final polish error:", err.message);
        return content;
    }
}

async function enhancePostSEO(draftContent, title, keywords) {
    try {
        // Stage 2: SEO Optimizer (llama-4-scout-17b)
        const model = 'meta-llama/llama-4-scout-17b-16e-instruct';
        console.log(`[Stage 2] SEO Optimization: "${title}" (Model: ${model})...`);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system', content: `You are an SEO specialist for a crypto blog. Your job is to optimize a draft article for Google search rankings.

SEO OPTIMIZATION TASKS:
1. META KEYWORDS: Identify 2-3 long-tail keywords from the topic (low-medium competition). Weave them naturally into headings and first sentences of paragraphs.
2. TITLE: Rewrite the title if needed — it must be specific, keyword-rich, and under 60 characters. NO generic phrases like "Everything You Need to Know" or "Complete Guide".
3. INTRO: The first paragraph must answer "what is this article about and why should I care?" in 2-3 sentences. It's the meta description.
4. H2 HEADERS: Every H2 must contain a keyword naturally. Headers like "Introduction" or "Overview" are banned.
5. INTERNAL STRUCTURE: Add a bullet-list "Key Takeaways" section at the very end with 3-4 punchy insights.
6. WORD COUNT: Keep at 750-900 words. Do NOT pad.
7. DO NOT fabricate any technical facts. Just restructure and optimize the existing content.

OUTPUT ONLY: The SEO-optimized article body in HTML (<h2>, <h3>, <p>, <ul>, <li>). No head/body tags.` },
                    { role: 'user', content: `SEO OPTIMIZE THIS DRAFT:\nTopic keywords: ${keywords}\n\nDRAFT:\n${draftContent}` }
                ],
                temperature: 0.5,
                max_tokens: 2500
            })
        });
        if (!res.ok) { console.error("SEO optimization error:", res.status); return draftContent; }
        const data = await res.json();
        if (data.usage) logUsage(model, data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        if (!data.choices || data.choices.length === 0) return draftContent;
        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error("SEO enhance error:", err.message);
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
                    { role: 'system', content: `${UNIFIED_VOICE_PROMPT}\n\nCRITICAL OUTPUT RULES:\n- Do NOT write your thinking process or preamble\n- Start IMMEDIATELY with the article content\n- Use HTML formatting: <h2> for sections, <p> for paragraphs, <ul><li> for lists\n- Do NOT use placeholder headings like "Introduction" or "Conclusion" — make them specific\n- The article title should be the FIRST line as plain text (not wrapped in a tag)` },
                    { role: 'user', content: `Write an 800-word article for "Chain Signals" blog about: ${title}\n\nTOPIC CONTEXT: ${keywords}\n\nSTRUCTURE BLUEPRINT:\n- Para 1 (Hook): State the core insight or tension in 2-3 sentences. Make it immediately interesting.\n- H2 Section 1: What the protocol/trend actually does and why it matters technically\n- H2 Section 2: The specific angle that makes this worth writing about right now\n- H2 Section 3: Real risks, trade-offs, or open questions — be honest, not promotional\n- H2 Section 4: What to watch or do next (practical takeaway)\n- DO NOT add a generic conclusion paragraph. End on something memorable.\n\nKEY RULES:\n- 750-850 words total\n- Every claim must be supportable — no invented numbers or events\n- Conversational but technically solid` }
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

        // Stage 2: Enhance and SEO Optimize
        bodyContent = await enhancePostSEO(bodyContent, title, keywords);

        // Stage 3: Secondary Fact-Check & Fix
        bodyContent = await factCheckPost(bodyContent, title, keywords);

        // Stage 4: Final Forensic Fact-Audit
        bodyContent = await forensicFactAudit(bodyContent, title, keywords);

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

        // Customize title based on category
        let title = "";
        if (category.id === 'intelligence') title = `Deep Research: ${firstCoin} Infrastructure & Market Dominance`;
        else if (category.id === 'alpha') title = `Alpha Report: Professional Staking & Institutional Yield for ${firstCoin}`;
        else title = `Technical Deep Dive: ${combinedResearch} Ecosystem Evolution`;

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
