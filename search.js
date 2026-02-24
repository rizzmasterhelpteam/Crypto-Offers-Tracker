// Vercel Serverless Function - API Endpoint
// File: /api/search.js

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { platform, type, query } = req.body;

        // Get API key from Vercel environment variable
        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        
        if (!GROQ_API_KEY) {
            return res.status(500).json({ 
                success: false,
                error: 'API key not configured in Vercel environment variables' 
            });
        }

        // Build search query
        const typeLabels = {
            airdrop: '🪂 Airdrops',
            staking: '🔒 Staking',
            trading: '💰 Trading',
            learn: '📚 Learn & Earn',
            launchpad: '🚀 Launchpads',
            all: 'all types'
        };

        const platformPart = platform ? `${platform} ` : '';
        const typePart = query || typeLabels[type] || type;
        const searchQuery = `${platformPart}${typePart}`;

        // Call Groq API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{
                    role: 'user',
                    content: `Find 10 latest ${searchQuery} crypto offers. Return JSON array. Each: {title, platform, description, value, type: "${type}", badge: "live"/"new"/"ending", date, requirements: "brief info"}. Only JSON array.`
                }],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        
        // Extract JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('No valid JSON in response');
        }
        
        const results = JSON.parse(jsonMatch[0]);
        
        return res.status(200).json({
            success: true,
            results: results,
            count: results.length,
            cached: false
        });
        
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({
            success: false,
            error: 'Search failed',
            message: error.message
        });
    }
}
