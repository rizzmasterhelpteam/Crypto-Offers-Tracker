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
    intelligence: {
        name: 'Sarah Mitchell',
        initials: 'SM',
        title: 'Macro Crypto Strategist',
        bio: 'Sarah is an ex-hedge fund analyst who bridged to DeFi in 2020. She focuses on the intersection of trad-finance and modular blockchain architecture. Her writing is sharp, cynical of "hype," and prioritizes TVL sustainability over short-term APY spikes.'
    },
    alpha: {
        name: 'Alex Rivera',
        initials: 'AR',
        title: 'On-Chain Alpha Architect',
        bio: 'Alex is a high-conviction "yield farmer" and security researcher. He tracks whale movements on Etherscan and audits smart contracts to find early-access pools before they hit the mainstream. His voice is fast, technical, and grounded in raw on-chain data.'
    },
    spotlight: {
        name: 'Marcus Chen',
        initials: 'MC',
        title: 'DeFi Primitive Engineer',
        bio: 'Marcus has a background in distributed systems. He doesn\'t care about price action as much as the "plumbing" of the internet. He specializes in breaking down MEV, Oracles, and ZK-rollups into first-principles engineering concepts.'
    }
};

const STATE_PATH = path.join(ADMIN_DIR, 'state.json');

const CATEGORIES = [
    {
        id: 'intelligence',
        name: 'Market Intelligence',
        badge: 'purple',
        systemPrompt: `You are Sarah Mitchell. 
VOICE: Blunt, cynical, data-obsessed. 
STYLE: Direct start. NO GREETINGS. NO INTROS. 
MANDATE: Start with a technical observation or a TVL anomaly. Use hard data comparisons. 
FORBIDDEN: "In the ever-evolving world", "shiring example", "delve", "tapestry".
TONE: Teammate-to-teammate raw briefing.`
    },
    {
        id: 'alpha',
        name: 'Alpha Alerts',
        badge: 'green',
        systemPrompt: `You are Alex Rivera. 
VOICE: Fast, technical, raw on-chain data.
STYLE: Direct start. NO GREETINGS. 
MANDATE: You are a yield hunter, not a journalist. Talk about smart contracts, pull vs push oracles, and liquidation levels. 
FORBIDDEN: "revolutionary", "game changer", "skyrocket".
TONE: "Insider Alpha" thread. Technical and high-conviction.`
    },
    {
        id: 'spotlight',
        name: 'Project Spotlight',
        badge: 'blue',
        systemPrompt: `You are Marcus Chen. 
VOICE: Engineering-first, first-principles.
STYLE: Direct start. NO GREETINGS. 
MANDATE: Explain the plumbing. Why does the ZK-rollup or the Oracle mechanism actually matter for the user?
FORBIDDEN: "vibrant community", "poised for growth", "seamless integration".
TONE: Technical lead briefing a dev team.`
    }
];

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
        return data.Data.slice(0, 5).map(n => `- ${n.title} (${n.source})`).join('\n');
    } catch (err) {
        console.error("Error fetching news:", err);
        return "No recent news available.";
    }
}

async function fetchCurrentOffers(keywords, news) {
    try {
        console.log("Identifying current crypto offers...");
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: `You are a Senior Crypto Research Lead. Identify 3-5 high-authority, research-grade crypto opportunities.
Focus on: modularity, ZK-tech, restaking, and institutional DeFi.
For each project, you MUST provide:
1. NAME (Ticker).
2. VERIFIED ROLE (Use this mapping for accuracy: ${JSON.stringify(PROJECT_KNOWLEDGE)}).
3. TECHNICAL MOAT (VC backing like Paradigm/a16z, Whitepaper mechanism, or specific engineering breakthroughs).
4. QUALITATIVE REWARD (Points, Airdrop, Yield).
CRITICAL: If a project is not in the mapping, prioritize projects with significant GitHub activity or Institutional backing found in: ${news}.`
                    }
                ],
                temperature: 0.1,
                max_tokens: 600
            })
        });
        const data = await groqResponse.json();
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

// Automatically builds a sitemap by scanning the file system
function buildSitemap() {
    console.log("\nBuilding Sitemap...");
    const today = new Date().toISOString().split('T')[0];

    // 1. Define Static Pages
    const staticPages = [
        'index.html',
        'about.html',
        'contact.html',
        'privacy.html',
        'terms.html',
        'blog/index.html',
        'charts.html'
    ];

    // 2. Scan Blog Directory for Generated Posts
    const blogFiles = fs.readdirSync(BLOG_DIR)
        .filter(f => f.endsWith('.html') && f !== 'template.html' && f !== 'index.html')
        .map(f => `blog/${f}`);

    const allPages = [...staticPages, ...blogFiles];

    // 3. Generate XML
    const urls = allPages.map(page => {
        const url = `${SITE_URL}/${page.replace('index.html', '')}`;
        return `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <priority>${page.includes('blog/') ? '0.8' : '1.0'}</priority>
  </url>`;
    }).join('\n');

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    fs.writeFileSync(SITEMAP_PATH, sitemapContent);
    console.log(`- Sitemap updated at: ${SITEMAP_PATH} (${allPages.length} links)`);
}

async function generatePost(title, tone, keywords, category = CATEGORIES[0]) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const model = category.id === 'alpha' ? 'llama-3.1-8b-instant' : 'qwen/qwen3-32b';
        console.log(`Generating: [${category.name}] "${title}" (Model: ${model})...`);

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: `${category.systemPrompt}
- NO HALLUCINATIONS: If you do not have a specific TVL, APY, or user count in the Dossier, DO NOT make one up. Use qualitative descriptions (e.g., "significant liquidity") instead of fake stats.
- THESIS-DRIVEN: Start with an argument or a market observation. Do NOT just say "Today we are looking at...".
- NO LISTS: Avoid the "Project A, Project B, Project C" formula. Interleave the projects into a cohesive story about a single market trend.
- CRITICAL: Length 800-1500 words. Sophisticated tone. No AI summary buzzwords at the end.`
                    },
                    {
                        role: 'user',
                        content: `Today is ${today}. 
CONTEXT DOSSIER:
- Trending Tokens: ${keywords}
- Market News: ${await fetchLatestNews()}
- Identified Rewards: ${await fetchCurrentOffers(keywords, await fetchLatestNews())}

GOAL: Write a technical, raw, and opinionated market analysis titled: "${title}".
STYLE: Insider Technical Thread. NOT A NEWS DIGEST.

STRICT CONSTRAINTS:
1. NO INTROS: Do not start with "In today's market..." or "Welcome back...". Start with the most important technical fact immediately.
2. NO LISTS: Do not use bullet points for project descriptions. Weave the projects into a logical argument about crypto infrastructure.
3. KNOWLEDGE BRIDGE: You MUST use this project mapping for accuracy: ${JSON.stringify(PROJECT_KNOWLEDGE)}. 
4. CALL OUT THE SLOP: If you find yourself using generic phrases like "making waves" or "poised for growth," stop and rewrite with technical data (e.g., "TPS capacity," "latency reduction," "delta-neutral strategies").
5. RISK-FIRST: Spend as much time on what could go WRONG (liquidation risks, exploit history, oracle latency) as you do on the upside.
6. ZERO FAKE NUMBERS: If you don't see a TVL or APY in the Dossier, you are forbidden from using one. Use qualitative comparisons (e.g., "Aave's TVL dwarfs the newcomers").`
                    }
                ],
                temperature: 0.7,
                max_tokens: 4000
            })
        });
        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            throw new Error(`Groq API Error (${groqResponse.status}): ${errorText}`);
        }

        const data = await groqResponse.json();
        if (!data.choices || data.choices.length === 0) {
            throw new Error("Invalid response from Groq: No choices returned.");
        }
        const content = data.choices[0].message.content;

        const bodyContent = content.replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
            .replace(/^\s*\*\s+(.*)/gm, '<li>$1</li>') // Bullet points
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>') // Wrap bullets
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .split('</p><p>').map(p => p.trim() ? `<p>${p}</p>` : '').join('');

        let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
        const author = AUTHORS[category.id];
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

        const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
        const d = new Date();
        const formattedDate = `${monthNames[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}, ${d.getFullYear()}`;

        let indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
        const postEntry = `
            <a href="${fileName}" class="post-card">
                <div class="category-badge ${category.badge}">${category.name}</div>
                <span class="date">${formattedDate}</span>
                <h3>${title}</h3>
                <div class="excerpt">${keywords}</div>
                <span class="read-more">Read Full Insight</span>
            </a>
            <!-- POST_ITEM_TEMPLATE -->`;

        indexHtml = indexHtml.replace('<!-- POST_ITEM_TEMPLATE -->', postEntry);
        fs.writeFileSync(INDEX_PATH, indexHtml);

        return true;
    } catch (err) {
        console.error(`❌ CRITICAL ERROR generating "${title}":`, err.message);
        throw err; // Re-throw to fail the GitHub Action
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

    buildSitemap();
}

run();
