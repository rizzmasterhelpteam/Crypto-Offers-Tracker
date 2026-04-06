/**
 * Weekly Market Charts Generation Script
 * Refresh: Every Monday at 1:10 PM IST
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const TEMPLATE_PATH = path.join(ASSETS_DIR, 'charts-template.html');
const OUTPUT_PATH = path.join(ROOT_DIR, 'charts.html');

async function fetchPerformanceData() {
    try {
        console.log("Fetching market performance data from CoinGecko...");
        // Fetch top 100 coins with price change data
        const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=30d,1y');
        const data = await response.json();

        // Sort for Top 10 Monthly
        const topMonthly = [...data]
            .filter(c => c.price_change_percentage_30d_in_currency != null)
            .sort((a, b) => b.price_change_percentage_30d_in_currency - a.price_change_percentage_30d_in_currency)
            .slice(0, 10);

        // Sort for Top 10 Yearly
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
        console.log("Fetching trending projects for 'Upcoming' highlights...");
        const response = await fetch('https://api.coingecko.com/api/v3/search/trending');
        const data = await response.json();
        return data.coins.slice(0, 5).map(c => ({
            name: c.item.name,
            symbol: c.item.symbol,
            market_cap_rank: c.item.market_cap_rank,
            thumb: c.item.thumb
        }));
    } catch (err) {
        console.error("Error fetching upcoming projects:", err);
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
                <img src="${p.thumb}" alt="${p.name}" style="width: 32px; border-radius: 50%;">
                <div>
                    <strong>${p.name}</strong> (${p.symbol})
                </div>
            </div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">
                Rank: #${p.market_cap_rank || 'N/A'} | Trending 🔥
            </div>
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
        .replace('<!-- {{UPCOMING_PROJECTS}} -->', formatUpcoming(upcoming));

    fs.writeFileSync(OUTPUT_PATH, html);
    console.log(`\nSuccessfully generated: ${OUTPUT_PATH}`);
}

run();
