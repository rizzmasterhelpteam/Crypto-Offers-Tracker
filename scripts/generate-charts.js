/**
 * Weekly Market Charts Generation Script
 * Refresh: Every Monday at 1:10 PM IST
 */
const fs = require('fs');
const path = require('path');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error("Please set GROQ_API_KEY environment variable.");
    process.exit(1);
}

const ROOT_DIR = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const TEMPLATE_PATH = path.join(ASSETS_DIR, 'charts-template.html');
const OUTPUT_PATH = path.join(ROOT_DIR, 'charts.html');

// SOURCE OF TRUTH: Hard-coded knowledge for Liam Foster's analysis
const PROJECT_KNOWLEDGE = {
    'TIA': { role: 'Modular Data Availability Layer (Celestia)', mechanism: 'Data Availability Sampling (DAS) and Namespace Merkle Trees' },
    'EIGEN': { role: 'Ethereum Restaking Primitive (EigenLayer)', mechanism: 'Shared security via Actively Validated Services (AVS)' },
    'MON': { role: 'Parallelized EVM Layer 1 (Monad)', mechanism: 'Parallel execution and MonadDb for high-performance consensus' },
    'BERA': { role: 'DeFi-Focused Layer 1 (Berachain)', mechanism: 'Proof of Liquidity (PoL) and tri-token system ($BERA, $BGT, $HONEY)' },
    'JTO': { role: 'Solana MEV-Powered Liquid Staking (Jito)', mechanism: 'Maximum Extractable Value (MEV) redistribution to stakers' },
    'DRIFT': { role: 'Decentralized Perceptual DEX on Solana', mechanism: 'Dynamic Virtual AMM (dAMM) and cross-margined trading' },
    'REDSTONE': { role: 'Modular Oracle Provider', mechanism: 'Push/Pull data delivery for low-latency L1s/L2s' },
    'TAIKO': { role: 'Based Rollup (Taiko)', mechanism: 'Decentralized sequencing via Ethereum L1' }
};

const AUTHOR = {
    name: 'Liam Foster',
    initials: 'LF',
    title: 'Quantitative Analyst',
    bio: 'Liam provides high-frequency market analysis and on-chain volatility monitoring via a first-principles approach.'
};

async function fetchNewsContext() {
    try {
        console.log("Fetching market news for upcoming trends...");
        const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        if (!response.ok) throw new Error(`CryptoCompare API error: ${response.status}`);
        const data = await response.json();
        return data.Data.slice(0, 10).map(n => n.title).join('\n');
    } catch (err) {
        return "No recent news.";
    }
}

async function fetchPerformanceData() {
    try {
        console.log("Fetching market performance data from CoinGecko...");
        const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150&page=1&sparkline=false&price_change_percentage=30d,1y');
        if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
        const data = await response.json();

        const topMonthly = [...data]
            .filter(c => c.price_change_percentage_30d_in_currency != null)
            .sort((a, b) => b.price_change_percentage_30d_in_currency - a.price_change_percentage_30d_in_currency)
            .slice(0, 10);

        const topYearly = [...data]
            .filter(c => c.price_change_percentage_1y_in_currency != null)
            .sort((a, b) => b.price_change_percentage_1y_in_currency - a.price_change_percentage_1y_in_currency)
            .slice(0, 10);

        return { topMonthly, topYearly };
    } catch (err) {
        console.error("Error fetching performance data:", err);
        return { topMonthly: [], topYearly: [] };
    }
}

async function fetchUpcomingProjects() {
    try {
        console.log("Analyzing news and trends to identify genuine 'Upcoming' Titans...");
        const news = await fetchNewsContext();

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'system',
                        content: `You are a quantitative crypto analyst. Voice: direct, technical, data-driven.
FORBIDDEN words: "tapestry", "landscape", "unveiling", "vibrant", "revolutionary".
Output ONLY a JSON object with a "projects" array.

KNOWN FACTS (do not contradict):
- Berachain: Mainnet launched Feb 2025. Proof of Liquidity L1.
- Monad: Mainnet launched Nov 2025. 10k TPS parallel EVM.
- EigenLayer: $18B+ TVL restaking platform. Live since 2024.
- Starknet: Operational L2. Stwo prover deployed Q4 2025.
Do NOT list these as "upcoming" — they are already live. Focus on genuinely pre-mainnet or early-stage projects.`
                    },
                    {
                        role: 'user',
                        content: `Recent crypto news:\n${news}\n\nIdentify 5 high-potential projects that are genuinely in early stages (testnet, devnet, or pre-launch). Return JSON: {"projects": [{"name": "...", "symbol": "...", "insight": "one-line description", "status": "Testnet|Devnet|Pre-launch"}]}`
                    }
                ],
                temperature: 0.5
            })
        });

        const data = await groqResponse.json();
        if (!data.choices?.[0]?.message) throw new Error(`Unexpected Groq response: ${JSON.stringify(data)}`);
        let raw = data.choices[0].message.content;
        // Strip markdown code blocks if present
        raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const content = JSON.parse(raw);
        return Array.isArray(content) ? content : (content.projects || Object.values(content)[0] || []);
    } catch (err) {
        console.error("Error fetching upcoming projects with AI:", err);
        return [];
    }
}

function formatTableRows(data, key) {
    const maxChange = Math.max(...data.map(c => Math.abs(c[key] || 0)));
    return data.map((c, i) => {
        const change = c[key];
        const colorClass = change >= 0 ? 'trend-up' : 'trend-down';
        const sign = change >= 0 ? '+' : '';
        const barWidth = maxChange > 0 ? Math.round((Math.abs(change) / maxChange) * 100) : 0;
        const rankClass = i < 3 ? 'rank-num top3' : 'rank-num';
        const price = c.current_price != null ? `$${c.current_price.toLocaleString()}` : 'N/A';
        return `<tr>
            <td><span class="${rankClass}">${i + 1}</span><strong>${c.name}</strong> (${c.symbol.toUpperCase()})</td>
            <td>${price}</td>
            <td class="${colorClass}"><div class="gain-cell">${sign}${change.toFixed(2)}%<div class="gain-bar-wrap"><div class="gain-bar-fill" style="width:${barWidth}%"></div></div></div></td>
        </tr>`;
    }).join('');
}

function formatUpcoming(data) {
    return data.map(p => `
        <div class="upcoming-item">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="width: 12px; height: 12px; background: var(--accent-secondary); border-radius: 50%; box-shadow: 0 0 10px var(--accent-secondary);"></div>
                <div>
                    <strong>${p.name}</strong> (${p.symbol})
                    <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">${p.insight}</div>
                </div>
            </div>
            <div class="status-badge">${p.status}</div>
        </div>
    `).join('');
}

async function run() {
    const { topMonthly, topYearly } = await fetchPerformanceData();
    const upcoming = await fetchUpcomingProjects();

    let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    let html = template
        .replace('<!-- {{TOP_YEARLY}} -->', formatTableRows(topYearly, 'price_change_percentage_1y_in_currency'))
        .replace('<!-- {{TOP_MONTHLY}} -->', formatTableRows(topMonthly, 'price_change_percentage_30d_in_currency'))
        .replace('<!-- {{UPCOMING_PROJECTS}} -->', formatUpcoming(upcoming))
        .replace(/{{AUTHOR_NAME}}/g, AUTHOR.name)
        .replace(/{{AUTHOR_INITIALS}}/g, AUTHOR.initials)
        .replace(/{{AUTHOR_TITLE}}/g, AUTHOR.title)
        .replace(/{{AUTHOR_BIO}}/g, AUTHOR.bio);

    fs.writeFileSync(OUTPUT_PATH, html);
    console.log(`\nSuccessfully generated: ${OUTPUT_PATH}`);
}

run();
