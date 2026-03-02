// --- Server-side in-memory cache (shared across requests on same warm instance) ---
const serverCache = {};

function getCurrentSlot() {
    // Slot increments every 12 hours UTC: slot 0 = 00:00-11:59, slot 1 = 12:00-23:59 (repeats daily)
    return Math.floor(Date.now() / (12 * 60 * 60 * 1000));
}

function getNextSlotTime() {
    const slot = getCurrentSlot();
    return new Date((slot + 1) * 12 * 60 * 60 * 1000);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY is not configured in Vercel environment variables.' });

    const { platform, type } = req.body;
    const slot = getCurrentSlot();
    const cacheKey = `${slot}_${platform || 'all'}_${type}`;

    // Return cached data if available for this slot
    if (serverCache[cacheKey]) {
        const nextRefresh = getNextSlotTime();
        return res.status(200).json({
            results: serverCache[cacheKey],
            cached: true,
            nextRefresh: nextRefresh.toISOString(),
            slot
        });
    }

    const typeLabels = {
        airdrop: 'Airdrops',
        staking: 'Staking Rewards',
        trading: 'Trading Bonuses',
        learn: 'Learn & Earn',
        launchpad: 'Launchpad Sales',
        all: 'all types (airdrops, staking, trading, learn & earn, launchpads)'
    };

    const today = new Date().toISOString().split('T')[0]; // e.g. "2026-03-02"
    const platformPart = platform ? `on ${platform} ` : '';
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
                messages: [{
                    role: 'system',
                    content: `Today is ${today}. You are a crypto offers expert. Always provide the most current and active offers as of today's date. Never mention old or expired offers.`
                }, {
                    role: 'user',
                    content: `Find 10 active crypto ${typePart} ${platformPart}available right now as of ${today}. Return ONLY a JSON array with no extra text. Each item: {"title": string, "platform": string, "description": string, "value": string, "type": "${type}", "badge": "live"|"new"|"ending", "date": string, "requirements": string}. Make offers specific, realistic and current for ${today}.`
                }],
                temperature: 0.6,
                max_tokens: 2000
            })
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            return res.status(groqResponse.status).json({ error: `Groq API error: ${groqResponse.status}`, detail: errorText });
        }

        const data = await groqResponse.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\[[\s\S]*\]/);

        if (!jsonMatch) {
            return res.status(500).json({ error: 'No valid JSON in Groq response', raw: content });
        }

        const results = JSON.parse(jsonMatch[0]);

        // Cache results for this slot
        serverCache[cacheKey] = results;

        // Clean up old slot caches to save memory
        const currentSlot = getCurrentSlot();
        Object.keys(serverCache).forEach(k => {
            const keySlot = parseInt(k.split('_')[0]);
            if (keySlot < currentSlot) delete serverCache[k];
        });

        const nextRefresh = getNextSlotTime();
        return res.status(200).json({
            results,
            cached: false,
            nextRefresh: nextRefresh.toISOString(),
            slot
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
