/**
 * linker-engine.js - SEO Auto-Linker Core
 * Hardened with: Neighbor Guard, Live URL Validation, Target Diversity.
 */
const config = require('./config');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function callGroq(messages, model = 'meta-llama/llama-4-scout-17b-16e-instruct', temperature = 0.3) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: 1000,
            response_format: { type: "json_object" }
        })
    });
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content.trim());
}

async function isValidUrl(url) {
    if (url.startsWith('/')) return true;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        return res.ok;
    } catch (e) {
        return false;
    }
}

async function processBlog(html, historyObj, currentFilename) {
    console.log(`[Linker] Analyzing context for semantic placements...`);
    const internalLibrary = Object.entries(historyObj)
        .filter(([file]) => file !== currentFilename)
        .map(([file, keyword]) => ({ keyword, url: file }));

    const systemPrompt = `You are a Senior SEO Strategist.
TASK: Find exactly 6-8 SEMANTIC link placements.
LIBRARY: ${JSON.stringify(internalLibrary.slice(0, 15))}
VERIFIED DOMAINS: ${config.TRUSTED_DOMAINS.join(', ')}

RULES:
1. SEMANTIC ANCHORS: Link a meaningful phrase (2-5 words).
2. DIVERSITY: Do not link to the same URL more than once.
3. FORMAT: Output JSON object: {"links": [{"phrase": "...", "url": "...", "type": "internal|external"}]}`;

    try {
        const result = await callGroq([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `SOURCE:\n${html.replace(/<[^>]+>/g, ' ').slice(0, 5000)}` }
        ]);

        let linkedHtml = html;
        if (!result.links || !Array.isArray(result.links)) return html;

        const sortedLinks = result.links.sort((a, b) => b.phrase.length - a.phrase.length);
        const usedUrls = new Set();

        for (const link of sortedLinks) {
            const { phrase, url, type } = link;
            if (usedUrls.has(url)) continue;
            if (type === 'external' && !(await isValidUrl(url))) continue;

            const escapedText = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?<!<a[^>]*?>)(?<!<h[1-6][^>]*?>)${escapedText}(?![^<]*?</a>)(?![^<]*?</h[1-6]>)`, 'i');

            const match = linkedHtml.match(regex);
            if (match) {
                const surrounding = linkedHtml.slice(Math.max(0, match.index - 50), match.index + phrase.length + 50);
                if (surrounding.includes('<a href=')) continue;

                const attr = type === 'external' ? ' target="_blank" rel="nofollow"' : '';
                linkedHtml = linkedHtml.replace(regex, `<a href="${url}"${attr}>${phrase}</a>`);
                usedUrls.add(url);
            }
        }
        return linkedHtml + '\n<!-- seo-linked: true -->';
    } catch (e) {
        console.error(`[Linker] FAILED: ${e.message}`);
        return html;
    }
}

module.exports = { processBlog };
