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
        title: 'Senior Market Strategist',
        bio: 'Sarah Mitchell is a veteran crypto analyst with over 8 years of experience in macro-finance. She specializes in identifying early-stage market rotations and institutional capital flows.'
    },
    alpha: {
        name: 'Alex Rivera',
        initials: 'AR',
        title: 'Alpha Sniper & Rewards Lead',
        bio: 'Alex Rivera is a dedicated airdrop hunter and DeFi degen. He spends his days auditing protocols and tracking on-chain alerts to bring the community first-access to high-yield opportunities.'
    },
    spotlight: {
        name: 'Marcus Chen',
        initials: 'MC',
        title: 'Lead Tech Researcher',
        bio: 'Marcus Chen focuses on the deep-tech layers of crypto. From L2 scaling solutions to obscure DeFi primitives, Marcus breaks down complex project architectures for the everyday investor.'
    }
};

const STATE_PATH = path.join(ADMIN_DIR, 'state.json');

const CATEGORIES = [
    {
        id: 'intelligence',
        name: 'Market Intelligence',
        badge: 'purple',
        systemPrompt: 'You are Sarah Mitchell, a clear and logical market strategist for "crypto offers". Your voice is professional but VERY EASY TO UNDERSTAND. Avoid "AI slop" like "delving into", "tapestry", or "comprehensive overview". Explain market moves like you are talking to a smart friend. Use short paragraphs and direct language.'
    },
    {
        id: 'alpha',
        name: 'Alpha Alerts',
        badge: 'green',
        systemPrompt: 'You are Alex Rivera, a fast-talking alpha scout for "crypto offers". Your voice is direct, high-energy, and NO-NONSENSE. No fluff, no jargon. Tell users exactly what to do and why it is a win. Avoid formal AI introductions. Start with the "Alpha" immediately.'
    },
    {
        id: 'spotlight',
        name: 'Project Spotlight',
        badge: 'blue',
        systemPrompt: 'You are Marcus Chen, a tech researcher who speaks plain English for "crypto offers". Your job is to explain complex tech using SIMPLE ANALOGIES. Avoid technical jargon without explaining it. Be inquisitive but stay grounded. No repetitive AI filler words.'
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
                model: 'llama-4-scout-109b',
                messages: [
                    {
                        role: 'system',
                        content: `You are a crypto rewards expert. Identify 3-5 currently active, high-value crypto offers (airdrops, staking, or bonuses).
Ground your response in these trending topics: ${keywords} and recent news: ${news}.
Avoid hallucinations. Only list offers known to be active today.
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
        const model = category.id === 'alpha' ? 'llama-3.1-8b-instant' : 'llama-4-scout-109b';
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
Trending Tokens: ${keywords}
Latest News Headlines:
${await fetchLatestNews()}

Current Active Offers/Rewards:
${await fetchCurrentOffers(keywords, await fetchLatestNews())}

Write a long-form professional update titled: "${title}".
Aim for a word count between 600 and 1500 words. 
Structure the post with clear, descriptive headings. Incorporate the trending tokens, news, and active offers naturally but with deep analysis. 
Close with a dedicated "Expert Outlook" section containing 1-2 strategic pieces of advice.`
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
