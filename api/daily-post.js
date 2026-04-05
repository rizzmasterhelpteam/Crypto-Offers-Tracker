export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured.' });
    }

    try {
        // 1. Fetch Trending Topics from CoinGecko (No API Key Required for Public API)
        const trendingResponse = await fetch('https://api.coingecko.com/api/v3/search/trending');
        const trendingData = await trendingResponse.json();
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
                model: 'llama-3.1-70b-versatile', // High-end model for better personality
                messages: [
                    {
                        role: 'system',
                        content: `You are a passionate crypto enthusiast and blogger. Use a first-person perspective ('I', 'me', 'my'). 
Your tone should be deeply human, emotional, and opinionated. Share 'personal' anecdotes about your trading journey.
Avoid sounding like an AI or a clinical analyst. Use humor, frustration, or excitement where appropriate.
Format with a catchy personal title, conversational paragraphs, and a relatable closing.`
                    },
                    {
                        role: 'user',
                        content: `Today is ${today}. I'm looking at these trending tokens: ${trendingCoins}.
Write a blog post about what's happening. Make it feel like a real person wrote it after a long night of watching charts.
Express how you feel about these moves. Did you 'buy the dip'? Are you 'scared' of the volatility? 
Use human-like expressions, slang (like HODL or WAGMI sparingly), and share a 'personal' takeaway.`
                    }
                ],
                temperature: 0.8 // Increased temperature for more creative/human variability
            })
        });

        if (!groqResponse.ok) {
            throw new Error(`Groq API error: ${groqResponse.status}`);
        }

        const data = await groqResponse.json();
        const content = data.choices[0].message.content;

        // 3. Return the generated post
        return res.status(200).json({
            date: today,
            topics: trendingCoins,
            post: content,
            attribution: "AI-Generated via Groq & CoinGecko"
        });

    } catch (err) {
        console.error('Generation error:', err);
        return res.status(500).json({ error: err.message });
    }
}
