// Server-side in-memory cache (shared across warm instance requests)
const serverCache = {};

function getCurrentSlot() {
    // Increments every 12 hours UTC — refreshes globally twice daily
    return Math.floor(Date.now() / (12 * 60 * 60 * 1000));
}

function getNextSlotTime() {
    return new Date((getCurrentSlot() + 1) * 12 * 60 * 60 * 1000);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured in Vercel environment variables.' });
    }

    const { platform, type } = req.body;
    const slot = getCurrentSlot();
    const cacheKey = `${slot}_${platform || 'all'}_${type}`;

    // Return cached slot data if available (same for all users in this 12h window)
    if (serverCache[cacheKey]) {
        return res.status(200).json({
            results: serverCache[cacheKey],
            cached: true,
            nextRefresh: getNextSlotTime().toISOString(),
            slot
        });
    }

    const typeLabels = {
        airdrop: 'Airdrops (token giveaways, claim events)',
        staking: 'Staking Rewards (APY, lock-up rewards)',
        trading: 'Trading Bonuses (deposit bonus, cashback, fee rebates)',
        learn: 'Learn & Earn (quiz rewards, educational campaigns)',
        launchpad: 'Launchpad token sales (IEO, IDO, new listings)',
        all: 'all types: airdrops, staking, trading bonuses, learn & earn, launchpads'
    };

    const today = new Date().toISOString().split('T')[0]; // e.g. 2026-03-02
    const platformPart = platform ? `on ${platform}` : 'across major exchanges';
    const typePart = typeLabels[type] || type;

    try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: `Today is ${today}. You are a crypto offers expert. List ONLY currently active, real offers that exist as of today. Include realistic reward values and today's date. Never invent random URLs — use only known official domain patterns.`
                    },
                    {
                        role: 'user',
                        content: `List 10 active crypto ${typePart} ${platformPart} as of ${today}.

Return ONLY a JSON array, no extra text. Each item:
{
  "title": "Specific offer name",
  "platform": "Exchange or protocol name",
  "description": "Clear 1-2 sentence description of the offer",
  "value": "Reward amount or APY (e.g. Up to $100, 12% APY)",
  "type": "${type}",
  "badge": "live" | "new" | "ending",
  "date": "${today}",
  "requirements": "Brief eligibility note",
  "link": "https://official-platform-domain.com/offers-page"
}

Use real, well-known platforms (Binance, OKX, Bybit, KuCoin, Coinbase, Kraken, Bitget, MEXC, Gate.io, etc.) and their real offers pages as the link.`
                    }
                ],
                temperature: 0.5,
                max_tokens: 2000
            })
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            return res.status(groqResponse.status).json({
                error: `Groq API error: ${groqResponse.status}`,
                detail: errorText
            });
        }

        const data = await groqResponse.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\[[\s\S]*\]/);

        if (!jsonMatch) {
            return res.status(500).json({ error: 'No valid JSON in Groq response', raw: content });
        }

        const results = JSON.parse(jsonMatch[0]);

        // Cache for this slot (all users get same results for 12h window)
        serverCache[cacheKey] = results;

        // Clean up stale slot caches
        const cur = getCurrentSlot();
        Object.keys(serverCache).forEach(k => {
            if (parseInt(k.split('_')[0]) < cur) delete serverCache[k];
        });

        return res.status(200).json({
            results,
            cached: false,
            nextRefresh: getNextSlotTime().toISOString(),
            slot
        });

    } catch (err) {
        console.error('Search error:', err);
        return res.status(500).json({ error: err.message });
    }
}
