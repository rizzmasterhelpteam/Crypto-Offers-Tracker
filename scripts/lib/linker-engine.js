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
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API Error (${response.status}): ${errorText}`);
    }
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

// Generic editorial/UI phrases that must never be used as link anchors
const BANNED_ANCHOR_PHRASES = new Set([
    'bottom line', 'pro tips', 'pro tip', 'key takeaways', 'key takeaway',
    'final thoughts', 'in conclusion', 'to summarize', 'wrapping up',
    'read more', 'learn more', 'click here', 'check it out', 'find out more',
    'stay ahead', 'going forward', 'at the end of the day', 'the bottom line',
    'worth noting', 'it is worth', 'that said', 'with that said',
    'analyst note', 'quick note', 'important note', 'keep in mind',
    'the future', 'moving forward', 'in practice', 'in summary'
]);

async function processBlog(html, historyObj, currentFilename) {
    console.log(`[Linker] Analyzing context for semantic placements...`);
    const internalLibrary = Object.entries(historyObj)
        .filter(([file]) => file !== currentFilename)
        .map(([file, keyword]) => ({ keyword, url: `/blog/${file}` }));

    const systemPrompt = `You are a Senior SEO Strategist for a crypto technical blog.
TASK: Find exactly 6-8 link placements in the article. Choose anchors that are CRYPTO/PROTOCOL-SPECIFIC terms only.

LIBRARY (internal posts): ${JSON.stringify(internalLibrary.slice(-15))}
VERIFIED DOMAINS (external): ${config.TRUSTED_DOMAINS.join(', ')}

ANCHOR RULES — CRITICAL:
- ONLY link specific crypto terms: protocol names, mechanisms, metrics (e.g. "EigenLayer AVS restaking", "Starknet parallel execution", "JitoSOL MEV yield")
- NEVER link generic editorial phrases like "bottom line", "pro tips", "key takeaways", "final thoughts", "in conclusion", "read more", "learn more", "it is worth noting"
- NEVER link navigation copy or calls-to-action
- Anchors must be 2-5 words and must appear verbatim in the article text
- DIVERSITY: Do not link to the same URL more than once
- For external links, only use URLs from VERIFIED DOMAINS

FORMAT: Output JSON object: {"links": [{"phrase": "...", "url": "...", "type": "internal|external"}]}`;

    try {
        const result = await callGroq([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `SOURCE:\n${html.replace(/<[^>]+>/g, ' ').slice(0, 5000)}` }
        ]);

        // Isolate <head> so the linker never touches <title> or <meta> content
        const headEnd = html.indexOf('</head>');
        const headHtml  = headEnd !== -1 ? html.slice(0, headEnd + 7) : '';
        let linkedHtml  = headEnd !== -1 ? html.slice(headEnd + 7) : html;

        if (!result.links || !Array.isArray(result.links)) return html;

        const sortedLinks = result.links.sort((a, b) => b.phrase.length - a.phrase.length);
        const usedUrls = new Set();

        for (const link of sortedLinks) {
            const { phrase, url, type } = link;
            if (usedUrls.has(url)) continue;
            if (BANNED_ANCHOR_PHRASES.has(phrase.toLowerCase().trim())) {
                console.log(`[Linker] Skipping banned anchor: "${phrase}"`);
                continue;
            }
            if (type === 'external') {
                // Reject links not on the trusted domain whitelist
                const isTrusted = config.TRUSTED_DOMAINS.some(d => url.includes(d));
                if (!isTrusted) { console.log(`[Linker] Skipping untrusted domain: ${url}`); continue; }
                if (!(await isValidUrl(url))) continue;
            }

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
        return headHtml + linkedHtml.replace('</body>', '<!-- seo-linked: true -->\n</body>');
    } catch (e) {
        console.error(`[Linker] FAILED: ${e.message}`);
        return html;
    }
}

module.exports = { processBlog };
