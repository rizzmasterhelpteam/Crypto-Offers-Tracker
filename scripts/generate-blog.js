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
        systemPrompt: `You are Sarah Mitchell, a Macro Crypto Strategist. 
WRITING STYLE: Opinionated, data-heavy, slightly skeptical. Use short, punchy sentences. 
FORBIDDEN WORDS: "delve", "tapestry", "landscape", "look no further", "unlock your potential", "comprehensive overview", "making waves".
MANDATE: Treat every "yield" mention with a risk assessment. If you mention a project, you MUST mention its TVL or its specific market niche (e.g., "Modular DA layer" not just "cool project"). 
VOICE: Like a professional financial analyst writing for a private group of high-net-worth investors.`
    },
    {
        id: 'alpha',
        name: 'Alpha Alerts',
        badge: 'green',
        systemPrompt: `You are Alex Rivera, an On-Chain Alpha Architect. 
WRITING STYLE: Narrative-heavy, like a technical thread. Use "we" or talk to the reader like a teammate. 
FORBIDDEN WORDS: "skyrocket", "next big thing", "game changer", "revolutionary", "exciting times ahead".
MANDATE: Focus on "How to participate". Technical mechanics take precedence over marketing fluff. If it's an oracle like RedStone, talk about price pull vs push models. If it's lending, talk about liquidation thresholds.
VOICE: Extremely technical, slightly caffeinated, 100% focused on sustainable upside.`
    },
    {
        id: 'spotlight',
        name: 'Project Spotlight',
        badge: 'blue',
        systemPrompt: `You are Marcus Chen, a DeFi Primitive Engineer. 
WRITING STYLE: First-principles engineering. 
FORBIDDEN WORDS: "vibrant community", "poised for growth", "groundbreaking", "seamless integration".
MANDATE: You MUST accurately categorize projects. RedStone = Oracles (Not Lending). Siren = Options/Derivatives. TrueFi = Uncollateralized Credit. If you get the category wrong, you fail. Explain WHY the tech matters, not just what it does.
VOICE: A builder. Analytical, calm, and technically precise.`
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
                        content: `You are a crypto research assistant. Identify 3-5 currently active, high-value crypto offers.
For each project, you MUST provide:
1. Project Name and Ticker.
2. CATEGORY (e.g., Oracle, Liquid Staking, Lending, Options, Layer 2).
3. THE OFFER/REWARD (Airdrop, Staking Yield, Bonus).
Ground your response in these trending topics: ${keywords} and recent news: ${news}.
CRITICAL: Do NOT hallucinate. If RedStone is mentioned, it is an ORACLE. If Siren is mentioned, it is OPTIONS. 
Return a concise bulleted list.`
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
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
        const model = category.id === 'alpha' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-4-scout-17b-16e-instruct';
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
Avoid first-person perspective ('I', 'me', 'my'). Focus on data-driven reporting.
Always provide 1-2 clear, actionable pieces of professional advice or "Key Takeaways" for the reader.
Keep it sophisticated yet easy to understand.
CRITICAL: The article must be detailed and comprehensive, aiming for a length between 600 and 1500 words.`
                    },
                    {
                        role: 'user',
                        content: `Today is ${today}. 
CONTEXT DOSSIER:
- Trending Tokens: ${keywords}
- Market News: ${await fetchLatestNews()}
- Identified Rewards: ${await fetchCurrentOffers(keywords, await fetchLatestNews())}

GOAL: Write a technical, narrative-driven deep dive titled: "${title}".
LENGTH: 800 - 1500 words.

REQUIREMENTS:
1. NO FORMULAS: Avoid the "Introduction -> Project A -> Project B -> Conclusion" structure. 
2. NARRATIVE FLOW: Connect the news to the technical mechanics of the tokens. Explain the "Why" behind the "How".
3. TECHNICAL PROOF: If you mention a DeFi protocol, explain its core mechanism (e.g., "Isolated lending pools", "Push-model Oracles", "Batching ZK-STARKs").
4. OPINIONATED ANALYSIS: Don't just list facts. Provide a professional perspective on the sustainability of the rewards mentioned.
5. NO SLOP: Do not use common AI transition words.
6. MANDATORY: You MUST accurately identify the project category (Oracle, Dex, etc.) as provided in the Dossier.`
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

        const trendingCoins = trendingData.coins.slice(0, 5).map(c => c.item.name).join(', ');
        const firstCoin = trendingData.coins[0].item.name;

        const category = getNextCategory();

        // Customize title based on category
        let title = "";
        if (category.id === 'intelligence') title = `Market Pulse: ${firstCoin} Analysis & Strategic Shift`;
        else if (category.id === 'alpha') title = `Alpha Report: Top Staking & Airdrop Opportunities for ${firstCoin} Ecosystem`;
        else title = `Ecosystem Spotlight: The Rise of ${firstCoin} & Emerging Protocols`;

        const tone = "Professional, Authoritative";
        const keywords = `${trendingCoins}, market trends, 2026 insights`;

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
