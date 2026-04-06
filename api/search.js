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
        // Fetch news for context to improve currency/accuracy
        const newsResponse = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        const newsData = await newsResponse.json();

        // Safety check: Ensure newsData.Data exists and is an array
        const newsContext = (newsData && Array.isArray(newsData.Data))
            ? newsData.Data.slice(0, 5).map(n => n.title).join(', ')
            : "General crypto market interest";

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant', // Fast data retrieval
                messages: [
                    {
                        role: 'system',
                        content: `Today is ${today}. You are a crypto offers expert. 
Latest Market News: ${newsContext}.
You must generate a diverse list of exactly 30 currently active crypto offers.
Output MUST be a single JSON array starting with [ and ending with ]. NO prose.`
                    },
                    {
                        role: 'user',
                        content: `Generate exactly 30 active crypto offers as of ${today} based on current market data and news.
Include a mix of airdrop, staking, trading, learn, and launchpad offers across 15+ platforms.
Avoid hallucinations. Do not include expired offers.

Return ONLY a JSON array. Each item MUST follow this format:
{
  "title": "Offer name",
  "platform": "Exchange name",
  "description": "Short description",
  "value": "Reward",
  "type": "airdrop|staking|trading|learn|launchpad",
  "badge": "live|new|ending",
  "date": "${today}",
  "requirements": "Requirements",
  "link": "https://official-platform-domain.com"
}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 4000
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
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            return res.status(500).json({ error: 'Unexpected response format from Groq API', detail: data });
        }

        const content = data.choices[0].message.content;
        let results = [];
        try {
            // 1. Sometimes LLMs use markdown blocks, so remove ```json and ``` if they exist
            let cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

            // 2. Extract the actual array bracket content
            const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);

            if (!jsonMatch) {
                console.error("Groq raw content did not contain an array:", content);
                return res.status(500).json({ error: 'No valid JSON array found in Groq response', raw: content });
            }

            // 3. Clean up trailing commas which break strict JSON.parse (a common LLM mistake)
            let arrayStr = jsonMatch[0].replace(/,(\s*[\]}])/g, '$1');

            results = JSON.parse(arrayStr);
        } catch (parseErr) {
            console.error('JSON Parse Error:', parseErr, 'Raw Content:', content);
            return res.status(500).json({ error: 'Failed to parse JSON from Groq', detail: parseErr.message });
        }

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
