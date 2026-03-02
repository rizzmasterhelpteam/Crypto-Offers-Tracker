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

    // We now ignore the requested platform/type and generate one massive global payload per 12h slot.
    // This allows the client to download everything once and filter instantly without further API calls.
    const slot = getCurrentSlot();
    const globalCacheKey = `global_slot_${slot}`;

    // Return cached global data if available
    if (serverCache[globalCacheKey]) {
        return res.status(200).json({
            results: serverCache[globalCacheKey],
            cached: true,
            nextRefresh: getNextSlotTime().toISOString(),
            slot
        });
    }

    const today = new Date().toISOString().split('T')[0];

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
                        content: `Today is ${today}. You are a crypto offers expert. You must generate a diverse, comprehensive list of exactly 40 currently active crypto offers.`
                    },
                    {
                        role: 'user',
                        content: `Generate exactly 40 active crypto offers as of ${today}.
Ensure a balanced mix of: "airdrop", "staking", "trading", "learn", and "launchpad".
Ensure a wide mix of platforms: Binance, OKX, Bybit, KuCoin, Coinbase, Kraken, Bitget, MEXC, Gate.io, HTX, etc.

Return ONLY a JSON array, no extra text. Each item MUST follow this exact format:
{
  "title": "Specific offer name (e.g., Learn & Earn SUI, 120% APY USDT)",
  "platform": "Exchange or protocol name",
  "description": "Clear 1-2 sentence description",
  "value": "Reward amount or APY",
  "type": "Must be exactly one of: airdrop, staking, trading, learn, launchpad",
  "badge": "live" | "new" | "ending",
  "date": "${today}",
  "requirements": "Brief eligibility note",
  "link": "https://official-platform-domain.com/offers-page"
}`
                    }
                ],
                temperature: 0.5,
                max_tokens: 3500 // Increased token limit for 40 items
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

        // Cache globally for this slot
        serverCache[globalCacheKey] = results;

        // Clean up stale slot caches
        const cur = getCurrentSlot();
        Object.keys(serverCache).forEach(k => {
            if (k.startsWith('global_slot_') && parseInt(k.replace('global_slot_', '')) < cur) {
                delete serverCache[k];
            }
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
