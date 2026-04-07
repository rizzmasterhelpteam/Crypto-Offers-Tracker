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
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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

async function factCheckPost(draftContent, title, keywords) {
    try {
        console.log(`Fact-checking: "${title}"...`);
        const latestNews = await fetchLatestNews();

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [
                    {
                        role: 'system',
                        content: `You are a Senior Editor and Fact-Checker for the "Chain Signals" blog. 
Your goal is to audit a draft crypto article for factual accuracy and "Chain of Thought" leaks.

STRICT AUDIT RULES:
1. FACT CHECK: Verify all TVL, APY, and technical claims against this Source of Truth: ${JSON.stringify(PROJECT_KNOWLEDGE)}.
2. NARRATIVE HALLUCINATION KILLER: Identify "Narrative Glue"—specifically look for invented flash loan attacks, fake partnerships/integrations, or fictional technical "fixes" that bridge two ideas. If a story looks detailed but isn't in ${latestNews}, DELETE IT.
3. CONTEXT ONLY: If a named incident, protocol integration, or specific technical event is NOT found in the provided research data, it is a hallucination. REMOVE IT.
4. NO META-TALK: Strip any remaining reasoning fragments.
5. VOICE PROTECTION: Keep the "Chain Signals" conversational, expert tone. Do not make it sound like a robot.
6. CONCISENESS: Keep the final length within 600-900 words.

OUTPUT ONLY: The audited, corrected article body in HTML format (using <h2>, <h3>, <p>, <ul>, <li>).`
                    },
                    {
                        role: 'user',
                        content: `AUDIT THIS DRAFT ARTICLE:
                        
Title: ${title}
Draft: ${draftContent}
Reference Context: ${keywords}
Latest News for verification: ${latestNews}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 3200
            })
        });

        if (!groqResponse.ok) return draftContent; // Fallback to draft if fact-check fails

        const data = await groqResponse.json();
        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error("Fact-check error:", err.message);
        return draftContent;
    }
}

async function forensicFactAudit(content, title, keywords) {
    try {
        console.log(`Forensic Audit: Finalizing technical accuracy for "${title}"...`);

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [
                    {
                        role: 'system',
                        content: `You are a Lead Blockchain Engineer and Technical Reviewer. 
Your task is a FINAL AUDIT of a crypto article for technical accuracy before publication.

STRICT FORENSIC RULES:
1. TICKER & ROLE CHECK: Ensure all tickers and protocol roles ALIGN PERFECTLY with: ${JSON.stringify(PROJECT_KNOWLEDGE)}.
2. NO HALLUCINATIONS: If any mechanism (DAS, DAS-DAS, Zero-Knowledge proofs) is described inaccurately vs standard industry docs, correct it.
3. ELIMINATE FLUFF: Remove any remaining AI conversational filler (e.g., "In conclusion," "As mentioned above," "Let's dive in").
4. CLEAN HTML: Ensure the structure is valid HTML (<h2>, <h3>, <p>, <ul>, <li>).

OUTPUT ONLY: The final, forensic-grade article body in HTML.`
                    },
                    {
                        role: 'user',
                        content: `PERFORM FINAL FORENSIC AUDIT:
                        
Title: ${title}
Content to Audit: ${content}
Key Context: ${keywords}`
                    }
                ],
                temperature: 0.1,
                max_tokens: 3200
            })
        });

        if (!groqResponse.ok) return content;
        const data = await groqResponse.json();
        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error("Forensic audit error:", err.message);
        return content;
    }
}

async function generatePost(title, tone, keywords, category = CATEGORIES[0]) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const model = 'meta-llama/llama-4-scout-17b-16e-instruct';
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
                        content: `${UNIFIED_VOICE_PROMPT}

- CRITICAL: NO META-TALK. Do NOT include your "thinking process" or conversational preamble. 
- OUTPUT ONLY: Start the response immediately with the article title or the first sentence. Nothing else.`
                    },
                    {
                        role: 'user',
                        content: `Write a blog post about ${title.toUpperCase()}.

Context: ${keywords} - focusing on technical moats, recent events, and protocol mechanics.
Tone: conversational but informed — like a knowledgeable friend, not a research report
Length: ~600-800 words
Structure: use 3-4 natural sections with short headers, no bullet-point dumps
Avoid: made-up numbers, fake incidents, jargon stacking, robotic transition phrases
End with: a genuine open question or honest take on where things are headed`
                    }
                ],
                temperature: 0.7,
                max_tokens: 3200
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
        let bodyContent = data.choices[0].message.content;

        // Stage 2: Initial Fact-Check & Fix
        bodyContent = await factCheckPost(bodyContent, title, keywords);

        // Stage 3: Secondary Forensic Fact-Audit (Step 4)
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
