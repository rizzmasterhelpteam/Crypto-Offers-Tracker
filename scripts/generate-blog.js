const fs = require('fs');
const path = require('path');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error("Please set GROQ_API_KEY environment variable.");
    process.exit(1);
}

const ADMIN_DIR = path.join(__dirname, '..', 'admin');
const BLOG_DIR = path.join(__dirname, '..', 'blog');
const QUEUE_PATH = path.join(ADMIN_DIR, 'blog-queue.csv');
const TEMPLATE_PATH = path.join(BLOG_DIR, 'template.html');
const INDEX_PATH = path.join(BLOG_DIR, 'index.html');

// Helper to parse simple CSV (handles basic quotes)
function parseCSV(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        // Simple regex to handle commas inside quotes
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const row = {};
        headers.forEach((h, i) => {
            row[h] = values[i] ? values[i].replace(/^"|"$/g, '').trim() : '';
        });
        return row;
    });
}

// Helper to write CSV
function writeCSV(headers, rows) {
    const content = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
            const val = r[h] || '';
            return val.includes(',') ? `"${val}"` : val;
        }).join(','))
    ].join('\n');
    fs.writeFileSync(QUEUE_PATH, content);
}

async function generatePost(title, tone, keywords) {
    try {
        const today = new Date().toISOString().split('T')[0];
        console.log(`Generating: "${title}" | Tone: ${tone}...`);

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-4-scout-17b-16e-instruct',
                messages: [
                    {
                        role: 'system',
                        content: `You are a crypto blogger. Use a first-person perspective ('I', 'me', 'my'). 
Your tone for this specific post MUST be: ${tone}.
Incorporate these keywords naturally: ${keywords}.
Ensure the content feels human, personal, and opinionated.`
                    },
                    {
                        role: 'user',
                        content: `Write a blog post titled: "${title}".
Today is ${today}. Discuss ${keywords}. 
Make it engaging, relatable, and use the specified tone of "${tone}".`
                    }
                ],
                temperature: 0.8,
                max_tokens: 4000
            })
        });

        const data = await groqResponse.json();
        const content = data.choices[0].message.content;

        // Cleanup markdown
        const bodyContent = content.replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .split('\n').map(line => line.trim() ? `<p>${line}</p>` : '').join('');

        // 1. Load Template
        let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
        let html = template
            .replace('{{TITLE}}', title)
            .replace('{{DATE}}', today)
            .replace('{{TOPICS}}', keywords)
            .replace('{{CONTENT}}', bodyContent);

        // 2. Save new post
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const fileName = `${slug}.html`;
        fs.writeFileSync(path.join(BLOG_DIR, fileName), html);
        console.log(`- Saved: blog/${fileName}`);

        // 3. Update Index
        let indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
        const postEntry = `
            <a href="${fileName}" class="post-card">
                <span class="post-date">${today}</span>
                <div class="post-title">${title}</div>
                <div class="post-excerpt">${keywords}</div>
            </a>
            <!-- POST_ITEM_TEMPLATE -->`;

        indexHtml = indexHtml.replace('<!-- POST_ITEM_TEMPLATE -->', postEntry);
        fs.writeFileSync(INDEX_PATH, indexHtml);

        return true;
    } catch (err) {
        console.error(`Error generating "${title}":`, err);
        return false;
    }
}

async function runQueue() {
    if (!fs.existsSync(QUEUE_PATH)) {
        console.error("Queue file not found at: admin/blog-queue.csv");
        return;
    }

    const content = fs.readFileSync(QUEUE_PATH, 'utf8');
    const rows = parseCSV(content);
    const headers = ['title', 'tone', 'keywords', 'status'];

    let count = 0;
    for (let row of rows) {
        if (row.status === 'pending') {
            const success = await generatePost(row.title, row.tone, row.keywords);
            if (success) {
                row.status = 'published';
                count++;
            }
        }
    }

    if (count > 0) {
        writeCSV(headers, rows);
        console.log(`\nSuccessfully processed ${count} posts.`);
    } else {
        console.log("No pending posts found in queue.");
    }
}

runQueue();
