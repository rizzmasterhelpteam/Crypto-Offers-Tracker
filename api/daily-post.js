// Server-side in-memory cache
const serverCache = {};

function getCurrentSlot() {
    return Math.floor(Date.now() / (12 * 60 * 60 * 1000));
}

function getNextSlotTime() {
    return new Date((getCurrentSlot() + 1) * 12 * 60 * 60 * 1000);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured.' });
    }

    const slot = getCurrentSlot();
    const cacheKey = `blog_slot_${slot}`;

    // Return cached blog if available
    if (serverCache[cacheKey]) {
        return res.status(200).json({
            ...serverCache[cacheKey],
            cached: true,
            nextRefresh: getNextSlotTime().toISOString()
        });
    }

    try {
        // 1. Fetch Trending Topics from CoinGecko
        const trendingResponse = await fetch('https://api.coingecko.com/api/v3/search/trending');
        if (!trendingResponse.ok) throw new Error('CoinGecko API busy');

        const trendingData = await trendingResponse.json();
        if (!trendingData || !Array.isArray(trendingData.coins)) {
            throw new Error('Unexpected CoinGecko response format');
        }
        const trendingCoins = trendingData.coins.slice(0, 5).map(c => c.item.name).join(', ');

        const today = new Date().toISOString().split('T')[0];

        // 2. Generate Post using Groq
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [
                    {
                        role: 'system',
                        content: `You are Chain Signals, a Lead Crypto Strategist writing for an audience of intermediate-to-advanced crypto readers.
Your tone is technical, objective, and confident — like a former quant explaining things for smart traders.
Do NOT use first-person ("I", "me", "my"). Do NOT fabricate quotes, regulatory news, or protocol names.
Format with a punchy title, technical paragraphs with specific data points, and a forward-looking closing signal.
Output in clean HTML (no markdown). No "Conclusion" headers or sign-off clichés.`
                    },
                    {
                        role: 'user',
                        content: `Today is ${today}. Trending tokens: ${trendingCoins}.
Write a concise technical blog post analyzing what's driving these moves. Include specific on-chain signals, protocol mechanics, or market structure insights where relevant. End with what to watch in the next 7-30 days.`
                    }
                ],
                temperature: 0.65,
                max_tokens: 6000
            })
        });

        if (!groqResponse.ok) {
            throw new Error(`Groq API error: ${groqResponse.status}`);
        }

        const data = await groqResponse.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            return res.status(500).json({ error: 'Unexpected response format from Groq API', detail: data });
        }
        const content = data.choices[0].message.content;

        const result = {
            date: today,
            topics: trendingCoins,
            post: content,
            attribution: "AI-Generated via Groq & CoinGecko"
        };

        // Cache the result for this slot
        serverCache[cacheKey] = result;

        return res.status(200).json({
            ...result,
            cached: false,
            nextRefresh: getNextSlotTime().toISOString()
        });

    } catch (err) {
        console.error('Generation error:', err);
        return res.status(500).json({ error: err.message });
    }
}
