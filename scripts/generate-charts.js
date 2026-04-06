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

const AUTHOR = {
    name: 'Liam Foster',
    initials: 'LF',
    title: 'Chief Data Analyst',
    bio: 'Liam Foster is the data engine behind crypto offers. With a background in quantitative analysis, he specializes in identifying market trends and project "Titans" before they hit the mainstream.'
};

async function fetchNewsContext() {
    try {
        console.log("Fetching market news for upcoming trends...");
        const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
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
                model: 'llama-4-scout-109b',
                messages: [
                    {
                        role: 'system',
                        content: `You are Liam Foster, a data analyst at "crypto offers". Your voice is direct, factual, and 100% human-like. 
CRITICAL: No "AI slop" (avoid words like "tapestry", "digital landscape", "unveiling"). 
Explain these projects in one simple, punchy sentence. 
Identify 5 high-potential projects that are in GENUINELY early stages (e.g., Testnet, Alpha/Beta, Early Mainnet, or IDO Phase). 
Exclude Top 100 market cap projects. Ground your response in these news trends: ${news}.
Return a JSON array of objects: [{"name": "...", "symbol": "...", "status": "Testnet Phase|IDO Stage|Mainnet Soon", "insight": "Concise 1-sentence potential"}]`
                    }
                ],
                temperature: 0.5,
                response_format: { type: "json_object" }
            })
        });

        const data = await groqResponse.json();
        const content = JSON.parse(data.choices[0].message.content);
        return content.projects || Object.values(content)[0] || [];
    } catch (err) {
        console.error("Error fetching upcoming projects with AI:", err);
        return [];
    }
}

function formatTableRows(data, key) {
    return data.map(c => {
        const change = c[key];
        const colorClass = change >= 0 ? 'trend-up' : 'trend-down';
        const sign = change >= 0 ? '+' : '';
        return `<tr>
            <td><strong>${c.name}</strong> (${c.symbol.toUpperCase()})</td>
            <td>$${c.current_price.toLocaleString()}</td>
            <td class="${colorClass}">${sign}${change.toFixed(2)}%</td>
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
