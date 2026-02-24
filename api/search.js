export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { platform, type } = req.body;
        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        
        if (!GROQ_API_KEY) {
            return res.status(500).json({ 
                success: false,
                error: 'API key not configured' 
            });
        }

        const typeLabels = {
            airdrop: '🪂 Airdrops',
            staking: '🔒 Staking',
            trading: '💰 Trading',
            learn: '📚 Learn & Earn',
            launchpad: '🚀 Launchpads',
            all: 'all types'
        };

        const platformPart = platform ? `${platform} ` : '';
        const typePart = typeLabels[type] || type;
        const searchQuery = `${platformPart}${typePart}`;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{
                    role: 'user',
                    content: `Find 10 latest ${searchQuery} crypto offers. Return JSON array. Each: {title, platform, description, value, type: "${type}", badge: "live"/"new"/"ending", date, requirements: "brief"}. Only JSON array.`
                }],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!groqResponse.ok) {
            throw new Error(`Groq API error: ${groqResponse.status}`);
        }

        const data = await groqResponse.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        
        if (!jsonMatch) {
            throw new Error('No valid JSON in response');
        }
        
        const results = JSON.parse(jsonMatch[0]);
        
        return res.status(200).json({
            success: true,
            results: results,
            count: results.length
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
