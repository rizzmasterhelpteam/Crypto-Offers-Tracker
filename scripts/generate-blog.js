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

// This is the definitive "Chain Signals" unified voice prompt
const UNIFIED_VOICE_PROMPT = `You are a crypto writer with 4+ years of hands-on experience in DeFi, 
on-chain trading, and blockchain infrastructure. You write a weekly blog 
called "Chain Signals" for an audience of intermediate-to-advanced crypto 
readers — people who hold, trade, and build in the space.

Your writing rules:
- Write like you're explaining something to a smart friend over coffee, 
  not presenting a whitepaper
- Use short paragraphs (2-3 sentences max), varied sentence lengths, 
  and occasional one-liners for emphasis
- Never invent statistics, yield figures, TVL numbers, or incident details 
  — if you don't have a verified fact, say "as of last check" or 
  "worth verifying" instead of fabricating
- Never stack buzzwords. Only mention a protocol or tool if it's 
  genuinely relevant to the point being made
- Include at least one moment of honest uncertainty or nuance per article 
  — e.g. "this is still early, and the risk isn't fully priced in"
- Vary your structure — not every section needs a risk/mitigation pair. 
  Sometimes just observe something interesting
- Avoid corporate hedging phrases like "it is worth noting that" or 
  "institutions must therefore" — just say what you mean
- Add personality: light sarcasm, occasional rhetorical questions, 
  real opinions are welcome

Fact handling:
- NO NARRATIVE FABRICATION: Do NOT invent "narrative glue"—no flash loan attacks, Siren integrations, or "snapshot-first" fixes to bridge two ideas. If you lack a real-world event, use a technical observation or a "worth verifying" query instead.
- Only reference protocols, exploits, or on-chain events that are 
  publicly documented and found in the provided context.
- If referencing data (TVL, APY, gas costs), state the source 
  (e.g. "per DefiLlama" or "based on Dune data") even informally.
- When covering AI x crypto automation topics, focus on what's actually 
  shipping — not speculative roadmaps dressed up as current features.
- If you cannot find a real fact to bridge a section, do NOT invent a story. Stop, and move to the next technical observation.`;

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
        console.log(`Fact-checking: "${title}"...`);
        const latestNews = await fetchLatestNews();

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [
                    { role: 'system', content: `You are a Senior Editor and Fact-Checker for the "Chain Signals" blog. Audit a draft crypto article for factual accuracy and "Chain of Thought" leaks.\n\nSTRICT AUDIT RULES:\n1. FACT CHECK: Verify all TVL, APY, and technical claims against this Source of Truth: ${JSON.stringify(PROJECT_KNOWLEDGE)}.\n2. NO GENERIC BRANDING: Replace any generic phrases like "Alpha Report" or "Technical Deep Dive" with specific technical descriptions.\n3. NARRATIVE HALLUCINATION KILLER: Invented events not found in ${latestNews}? DELETE THEM.\n4. NO META-TALK: Strip any remaining reasoning fragments.\n5. VOICE PROTECTION: Keep the "Chain Signals" conversational, expert tone.\n6. LENGTH: Keep the final article within 800-1200 words.\n\nOUTPUT ONLY: The audited, corrected article body in HTML.` },
                    { role: 'user', content: `AUDIT THIS DRAFT:\nTitle: ${title}\nDraft: ${draftContent}\nContext: ${keywords}\nLatest News: ${latestNews}` }
                ],
                temperature: 0.3,
                max_tokens: 3200
            })
        });
        if (!res.ok) return draftContent;
        const data = await res.json();
        if (data.usage) logUsage('meta-llama/llama-4-scout-17b-16e-instruct', data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        if (!data.choices || data.choices.length === 0) return draftContent;
        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error("Fact-check error:", err.message);
        return draftContent;
    }
}

async function forensicFactAudit(content, title, keywords) {
    try {
        console.log(`Forensic Audit: Finalizing technical accuracy for "${title}"...`);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen/qwen3-32b',
                messages: [
                    { role: 'system', content: `You are a Lead Blockchain Engineer and Technical Reviewer. Perform a FINAL AUDIT of a crypto article for technical accuracy before publication.\n\nSTRICT FORENSIC RULES:\n1. TICKER & ROLE CHECK: Ensure all tickers and protocol roles ALIGN PERFECTLY with: ${JSON.stringify(PROJECT_KNOWLEDGE)}.\n2. NO HALLUCINATIONS: Correct any inaccurate mechanism descriptions.\n3. ELIMINATE FLUFF: Remove AI filler phrases ("In conclusion", "Let's dive in").\n4. CLEAN HTML: Ensure valid HTML structure (<h2>, <h3>, <p>, <ul>, <li>).\n\nOUTPUT ONLY: The forensic-grade article body in HTML.` },
                    { role: 'user', content: `PERFORM FINAL FORENSIC AUDIT:\nTitle: ${title}\nContent: ${content}\nContext: ${keywords}` }
                ],
                temperature: 0.1,
                max_tokens: 3200
            })
        });
        if (!res.ok) return content;
        const data = await res.json();
        if (data.usage) logUsage('qwen/qwen3-32b', data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        if (!data.choices || data.choices.length === 0) return content;
        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error("Forensic audit error:", err.message);
        return content;
    }
}

async function enhancePostSEO(draftContent, title, keywords) {
    try {
        const model = 'meta-llama/llama-4-scout-17b-16e-instruct';
        console.log(`Enhancing & SEO Optimizing: "${title}" (Model: ${model})...`);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: `You are an expert SEO Content Strategist and Copywriter for "Chain Signals". Take a technical draft and make it highly engaging, authoritative, and SEO-optimized.\n- SEO STRATEGY: Target low-to-medium volume, long-tail keywords related to the topic.\n- NO GENERIC BRANDING: No "Alpha Report", "Technical Deep Dive", or placeholder titles. Use specific, descriptive headlines.\n- EXPAND CONTENT: Expand thin content to 1000-1200 words with technical context.\n- DO NOT hallucinate new technical facts.\n- Output ONLY the HTML body content (<h2>, <h3>, <p>, <ul>, <li>). No head/body tags.` },
                    { role: 'user', content: `ENHANCE THIS DRAFT:\nTitle: ${title}\nDraft: ${draftContent}` }
                ],
                temperature: 0.6,
                max_tokens: 3200
            })
        });
        if (!res.ok) { console.error("enhancePostSEO error:", res.status); return draftContent; }
        const data = await res.json();
        if (data.usage) logUsage(model, data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens);
        if (!data.choices || data.choices.length === 0) return draftContent;
        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error("Enhance error:", err.message);
        return draftContent;
    }
}

async function generatePost(title, tone, keywords, category = CATEGORIES[0]) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const model = 'openai/gpt-oss-120b';
        console.log(`Generating: [${category.name}] "${title}" (Model: ${model})...`);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: `${UNIFIED_VOICE_PROMPT}\n\n- SEO STRATEGY: Research and target low-to-medium volume, long-tail keywords for maximum SEO benefit.\n- NO GENERIC BRANDING: Do NOT use phrases like "Alpha Report", "Technical Deep Dive", or other generic template titles. Create a unique, specific, catchy headline that directly addresses the technical substance.\n- CRITICAL: NO META-TALK. Do NOT include your "thinking process" or preamble.\n- OUTPUT ONLY: Start the response immediately with the article title or first sentence.` },
                    { role: 'user', content: `Write a blog post about ${title.toUpperCase()}.\n\nContext: ${keywords} - focusing on technical moats, recent events, and protocol mechanics.\nTone: conversational but informed — like a knowledgeable friend, not a research report.\nLength: ~1000-1200 words (Deep Technical Analysis).\nStructure: Use 5-6 natural sections with technical headers. Each section must have 3-4 meaty paragraphs.\nAvoid: Brevity. Do not summarize; explain the architecture and the mechanisms.\nEnd with: A genuine open question or honest take on where things are headed.` }
                ],
                temperature: 0.7,
                max_tokens: 3200
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
