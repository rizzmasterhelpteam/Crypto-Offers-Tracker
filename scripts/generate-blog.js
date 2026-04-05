const fs = require('fs');
const path = require('path');

// To run this, you must have GROQ_API_KEY in your env
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error("Please set GROQ_API_KEY environment variable.");
    process.exit(1);
}

const BLOG_DIR = path.join(__dirname, '..', 'blog');
const TEMPLATE_PATH = path.join(BLOG_DIR, 'template.html');
const INDEX_PATH = path.join(BLOG_DIR, 'index.html');

async function generate() {
    try {
        console.log("Fetching trending data...");
        const trendingResponse = await fetch('https://api.coingecko.com/api/v3/search/trending');
        const trendingData = await trendingResponse.json();
        const trendingCoins = trendingData.coins.slice(0, 5).map(c => c.item.name).join(', ');

        const today = new Date().toISOString().split('T')[0];
        console.log(`Generating post for ${today}...`);

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-70b-versatile',
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
                temperature: 0.8,
                max_tokens: 4000
            })
        });

        const data = await groqResponse.json();
        const content = data.choices[0].message.content;

        // Extract title (first line)
        const rawLines = content.split('\n');
        const title = rawLines.find(l => l.trim().length > 0)?.replace(/#/g, '').trim() || "Daily Market Digest";
        const bodyContent = content.replace(rawLines[0], '')
            .replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .split('\n').map(line => line.trim() ? `<p>${line}</p>` : '').join('');

        // 1. Load Template
        let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
        let html = template
            .replace('{{TITLE}}', title)
            .replace('{{DATE}}', today)
            .replace('{{TOPICS}}', trendingCoins)
            .replace('{{CONTENT}}', bodyContent);

        // 2. Save new post
        const slug = `market-digest-${today}`;
        const fileName = `${slug}.html`;
        fs.writeFileSync(path.join(BLOG_DIR, fileName), html);
        console.log(`Saved new post: blog/${fileName}`);

        // 3. Update Index
        let indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
        const postEntry = `
            <a href="${fileName}" class="post-card">
                <span class="post-date">${today}</span>
                <div class="post-title">${title}</div>
                <div class="post-excerpt">${trendingCoins}</div>
            </a>
            <!-- POST_ITEM_TEMPLATE -->`;

        indexHtml = indexHtml.replace('<!-- POST_ITEM_TEMPLATE -->', postEntry);
        fs.writeFileSync(INDEX_PATH, indexHtml);
        console.log("Updated blog/index.html");

    } catch (err) {
        console.error("Error generating blog:", err);
    }
}

generate();
