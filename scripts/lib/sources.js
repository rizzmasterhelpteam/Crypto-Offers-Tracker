/**
 * sources.js - External Data Sourcing
 * Fetches trending coins and recent news for grounding.
 */
const config = require('./config');

async function fetchLatestNews() {
    try {
        console.log("Fetching latest crypto news...");
        const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        const data = await response.json();
        if (!data || !data.Data || !Array.isArray(data.Data)) {
            return "No recent news available.";
        }
        return data.Data.slice(0, 8).map(n => `- ${n.title} (${n.source})`).join('\n');
    } catch (err) {
        console.error("Error fetching news:", err.message);
        return "No recent news available.";
    }
}

async function fetchTrendingCoins() {
    try {
        console.log("Fetching trending crypto data from CoinGecko...");
        const response = await fetch('https://api.coingecko.com/api/v3/search/trending');
        const data = await response.json();
        if (!data || !data.coins || data.coins.length === 0) {
            return config.RESEARCH_SEEDS;
        }
        return data.coins.slice(0, 5).map(c => c.item.name);
    } catch (err) {
        console.error("Error fetching trending data:", err.message);
        return config.RESEARCH_SEEDS;
    }
}

async function fetchProtocolDetails(term) {
    try {
        const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(term)}`);
        if (!searchRes.ok) return null;
        const searchData = await searchRes.json();
        const coin = searchData.coins && searchData.coins[0];
        if (!coin) return null;

        const detailRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`);
        if (!detailRes.ok) return null;
        const detail = await detailRes.json();
        const description = detail.description && detail.description.en
            ? detail.description.en.replace(/<[^>]+>/g, '').slice(0, 600)
            : null;

        return description ? { name: detail.name, symbol: detail.symbol.toUpperCase(), description } : null;
    } catch (e) {
        return null;
    }
}

async function getGroundedSources(title, keywords) {
    console.log('[Sources] Building source pack...');
    const sources = [];

    // Extract real protocol names by matching against PROJECT_KNOWLEDGE keys
    const knownProtocols = Object.keys(config.PROJECT_KNOWLEDGE);
    const combinedText = `${title} ${keywords}`.toLowerCase();
    const matchedProtocols = knownProtocols.filter(p => combinedText.includes(p.toLowerCase()));

    // Also extract capitalized multi-word terms that look like protocol names (3+ chars)
    const properNouns = `${title} ${keywords}`.match(/\b[A-Z][a-z]{2,}\b/g) || [];
    const searchTerms = [...new Set([
        ...matchedProtocols,
        ...properNouns
    ])].slice(0, 5);

    console.log(`[Sources] Search terms: ${searchTerms.join(', ')}`);

    for (const term of searchTerms) {
        const detail = await fetchProtocolDetails(term);
        if (detail) {
            sources.push(`PROTOCOL: ${detail.name} (${detail.symbol})\nSOURCE: CoinGecko\nCONTENT: ${detail.description}`);
        }
    }

    // Load ground truth context if available
    const fs = require('fs');
    if (fs.existsSync(config.CONTEXT_CACHE_PATH)) {
        try {
            const groundTruth = JSON.parse(fs.readFileSync(config.CONTEXT_CACHE_PATH, 'utf8'));
            const protocols = groundTruth.protocols || {};
            for (const term of matchedProtocols) {
                const key = term.toLowerCase();
                if (protocols[key]) {
                    sources.push(`GROUND TRUTH — ${term.toUpperCase()}:\n${JSON.stringify(protocols[key], null, 2)}`);
                }
            }
        } catch (e) { console.warn('[Sources] Could not load ground-truth-context.json:', e.message); }
    }

    const news = await fetchLatestNews();
    sources.push(`RECENT NEWS:\n${news}`);

    return sources.join('\n\n---\n\n');
}

module.exports = {
    fetchLatestNews,
    fetchTrendingCoins,
    getGroundedSources
};
