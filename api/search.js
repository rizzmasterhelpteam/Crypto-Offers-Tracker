// Server-side in-memory cache (shared across warm instance requests)
const serverCache = {};

function getCurrentSlot() {
    return Math.floor(Date.now() / (12 * 60 * 60 * 1000));
}

function getNextSlotTime() {
    return new Date((getCurrentSlot() + 1) * 12 * 60 * 60 * 1000);
}

// Build smart Google search queries for real crypto offers
function buildSearchQueries(platform, type) {
    const today = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();

    const typeTerms = {
        airdrop: ['airdrop', 'token airdrop claim', 'free crypto airdrop'],
        staking: ['staking rewards APY', 'crypto staking earn'],
        trading: ['trading bonus promo', 'deposit bonus cashback'],
        learn: ['learn earn rewards', 'crypto quiz rewards'],
        launchpad: ['launchpad IEO token sale', 'new token listing'],
        all: ['crypto offers rewards', 'airdrop staking bonus']
    };

    const terms = typeTerms[type] || typeTerms.all;

    if (platform) {
        // Targeted site-specific search for selected platform
        const platformDomains = {
            'Binance': 'site:binance.com',
            'Coinbase': 'site:coinbase.com',
            'Kraken': 'site:kraken.com',
            'OKX': 'site:okx.com',
            'Bybit': 'site:bybit.com',
            'KuCoin': 'site:kucoin.com',
            'Gate.io': 'site:gate.io',
            'HTX': 'site:htx.com',
            'Bitget': 'site:bitget.com',
            'MEXC': 'site:mexc.com',
            'Crypto.com': 'site:crypto.com',
            'Gemini': 'site:gemini.com',
            'Phemex': 'site:phemex.com',
            'Uniswap': 'site:app.uniswap.org OR site:blog.uniswap.org',
            'PancakeSwap': 'site:pancakeswap.finance',
            'dYdX': 'site:dydx.exchange OR site:dydx.foundation',
        };
        const siteFilter = platformDomains[platform] || '';
        return terms.slice(0, 2).map(t =>
            `${platform} ${t} ${year} ${siteFilter}`.trim()
        );
    } else {
        // General search across all platforms
        return terms.slice(0, 2).map(t =>
            `crypto ${t} ${year} active`
        );
    }
}

async function searchSerper(query, apiKey) {
    const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query, num: 6, gl: 'us', hl: 'en' })
    });
    if (!res.ok) throw new Error(`Serper error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.organic || []).map(r => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet,
        date: r.date || ''
    }));
}

async function formatWithGroq(rawResults, platform, type, groqKey) {
    const today = new Date().toISOString().split('T')[0];
    const resultsText = rawResults.map((r, i) =>
        `[${i + 1}] Title: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}\nDate: ${r.date}`
    ).join('\n\n');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{
                role: 'system',
                content: `Today is ${today}. You extract structured crypto offer information from real search results. You MUST preserve the exact URL from each search result — never modify or fabricate URLs.`
            }, {
                role: 'user',
                content: `From these real Google search results about crypto ${type} offers${platform ? ` on ${platform}` : ''}, extract up to 8 offers as a JSON array.

RULES:
- "link" MUST be the EXACT URL from the search result (do not change or invent URLs)
- "platform" should be the exchange/protocol name extracted from the URL or title
- "badge" must be "live", "new", or "ending" based on content
- "value" should be the reward amount/APY if mentioned, else "varies"
- "date" from search result date if available
- "requirements" brief eligibility note
- Only include results that are clearly active crypto offers (skip news articles, generic pages)

Search results:
${resultsText}

Return ONLY a valid JSON array, no extra text:
[{"title":"...","platform":"...","description":"...","value":"...","type":"${type}","badge":"live","date":"...","requirements":"...","link":"exact-url-from-results"}]`
            }],
            temperature: 0.2,
            max_tokens: 2000
        })
    });

    if (!res.ok) throw new Error(`Groq error ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Groq returned no valid JSON');
    return JSON.parse(jsonMatch[0]);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const groqKey = process.env.GROQ_API_KEY;
    const serperKey = process.env.SERPER_API_KEY;

    if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY not set in Vercel environment variables.' });
    if (!serperKey) return res.status(500).json({ error: 'SERPER_API_KEY not set in Vercel environment variables. Get a free key at serper.dev' });

    const { platform, type } = req.body;
    const slot = getCurrentSlot();
    const cacheKey = `${slot}_${platform || 'all'}_${type}`;

    // Return cached slot data if available
    if (serverCache[cacheKey]) {
        return res.status(200).json({
            results: serverCache[cacheKey],
            cached: true,
            nextRefresh: getNextSlotTime().toISOString(),
            slot
        });
    }

    try {
        // Step 1: Build search queries
        const queries = buildSearchQueries(platform, type);

        // Step 2: Fetch real Google results via Serper for each query (parallel)
        const searchResultArrays = await Promise.all(
            queries.map(q => searchSerper(q, serperKey).catch(() => []))
        );

        // Merge + deduplicate by URL
        const seen = new Set();
        const allResults = [];
        for (const arr of searchResultArrays) {
            for (const r of arr) {
                if (!seen.has(r.link)) {
                    seen.add(r.link);
                    allResults.push(r);
                }
            }
        }

        if (allResults.length === 0) {
            return res.status(200).json({
                results: [],
                cached: false,
                nextRefresh: getNextSlotTime().toISOString(),
                slot
            });
        }

        // Step 3: Use Groq to extract structured offer data — real URLs preserved
        const offers = await formatWithGroq(allResults, platform, type, groqKey);

        // Filter to ensure links are real (not hallucinated)
        const validOffers = offers.filter(o =>
            o.link && o.link.startsWith('http') && allResults.some(r => r.link === o.link)
        );

        // Cache for this slot
        serverCache[cacheKey] = validOffers;

        // Clean old slot caches
        const cur = getCurrentSlot();
        Object.keys(serverCache).forEach(k => {
            if (parseInt(k.split('_')[0]) < cur) delete serverCache[k];
        });

        return res.status(200).json({
            results: validOffers,
            cached: false,
            nextRefresh: getNextSlotTime().toISOString(),
            slot
        });

    } catch (err) {
        console.error('Search error:', err);
        return res.status(500).json({ error: err.message });
    }
}
