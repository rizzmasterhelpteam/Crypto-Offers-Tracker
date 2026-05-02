/**
 * generate-blog.js - Pipeline Orchestration
 * Version 4: LLM title, TTL-cached sources, structure validation, SEO meta.
 */
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const sources = require('./lib/sources');
const generator = require('./lib/generator-v3');
const utils = require('./lib/utils');
const { publishDraft } = require('./lib/publisher');

/**
 * Post-processing: DOM-free structural fix using regex.
 * Catches cases where the LLM still emits bare <h2>Key Takeaways</h2> or <h2>Analyst Note</h2>.
 */
function autoFixStructure(html) {
    html = html.replace(/<pre\s+class=["']mermaid["']>[\s\S]*?<\/pre>/gi, '');
    html = html.replace(/<pre[^>]*>\s*<code[^>]*class=["'][^"']*mermaid[^"']*["'][^>]*>[\s\S]*?<\/code>\s*<\/pre>/gi, '');
    html = html.replace(/```mermaid[\s\S]*?```/gi, '');

    html = html.replace(/<h2[^>]*>([^<]{70,})<\/h2>/g, (_, inner) => `<p>${inner}</p>`);

    const paragraphs = html.match(/<p>[\s\S]*?<\/p>/g) || [];
    if (paragraphs.length >= 2) {
        const p1 = paragraphs[0].replace(/<[^>]+>/g, '').trim().slice(0, 100);
        const p2 = paragraphs[1].replace(/<[^>]+>/g, '').trim().slice(0, 100);
        if (p1 === p2) {
            console.log('[Fix] Duplicate intro detected - removing first.');
            html = html.replace(paragraphs[0], '');
        }
    }

    html = html.replace(
        /<h2[^>]*>Key Takeaways<\/h2>\s*(<ul[\s\S]*?<\/ul>)/gi,
        '<div class="takeaways-card"><h4>Key Takeaways</h4>$1</div>'
    );

    html = html.replace(/<table(?![^>]*class=)>/gi, '<table class="comparison-table">');
    html = html.replace(/<table(?=[^>]*class="[^"]*")(?![^>]*comparison-table)/gi, match =>
        match.replace('class="', 'class="comparison-table ')
    );

    html = html.replace(
        /<h2[^>]*>Analyst Note:?<\/h2>\s*<p>([\s\S]*?)<\/p>/gi,
        '<div class="insight-card"><strong>Analyst Note:</strong> $1</div>'
    );

    html = html.replace(/<del>([\s\S]*?)<\/del>/gi, '$1');
    html = html.replace(/<hr\s*\/?>/gi, '');

    return html.trim();
}

/**
 * Load history, syncing out deleted files.
 */
function loadHistory() {
    if (!fs.existsSync(config.HISTORY_PATH)) return {};

    try {
        const historyObj = JSON.parse(fs.readFileSync(config.HISTORY_PATH, 'utf8'));
        let changed = false;

        for (const fileName in historyObj) {
            if (!fs.existsSync(path.join(config.BLOG_DIR, fileName))) {
                console.log(`[Sync] ${fileName} deleted - removing from history.`);
                delete historyObj[fileName];
                changed = true;
            }
        }

        if (changed) {
            fs.writeFileSync(config.HISTORY_PATH, JSON.stringify(historyObj, null, 4));
        }

        return historyObj;
    } catch (error) {
        console.warn('[Sync] History corrupted, starting fresh.');
        return {};
    }
}

async function run() {
    console.log(`\n[Flow] High-authority pipeline v4 starting... (${config.CURRENT_DATE})`);

    try {
        const historyObj = loadHistory();
        const activeKeywords = Object.values(historyObj);

        console.log('[Flow] Step 1: Keyword discovery...');
        const newsContext = await sources.fetchLatestNews();
        const selectedKeyword = await generator.discoverKeywords(newsContext, activeKeywords.slice(-20));
        console.log(`[Flow] Keyword: "${selectedKeyword}"`);

        console.log('[Flow] Step 1.5 + Sources: Title generation and source gathering...');
        const [generatedTitle, sourceText] = await Promise.all([
            generator.generateTitle(selectedKeyword, newsContext),
            sources.getGroundedSources(selectedKeyword, selectedKeyword)
        ]);
        console.log(`[Flow] Title: "${generatedTitle}"`);

        console.log('[Flow] Step 2: Drafting...');
        const draftResult = await generator.draftProfessionalBlog(selectedKeyword, sourceText);
        let content = draftResult.draft;
        const personaKey = draftResult.personaKey;

        console.log('[Flow] Step 3: Hallucination audit...');
        try {
            const out = await generator.firstFactCheck(content, sourceText);
            if (out && out.length > 200) {
                content = out;
                console.log(`[Flow] Step 3 OK (${out.length} chars)`);
            } else {
                console.warn(`[Flow] Step 3 short output (${out?.length || 0} chars), keeping Step 2.`);
            }
        } catch (error) {
            console.warn(`[Flow] Step 3 failed: ${error.message}`);
        }

        console.log('[Flow] Step 4: Final polish...');
        try {
            const out = await generator.finalFactCheck(content, sourceText);
            if (out && out.length > 200) {
                content = out;
                console.log(`[Flow] Step 4 OK (${out.length} chars)`);
            } else {
                console.warn(`[Flow] Step 4 short output (${out?.length || 0} chars), keeping Step 3.`);
            }
        } catch (error) {
            console.warn(`[Flow] Step 4 failed: ${error.message}`);
        }

        console.log('[Flow] Step 5: Data sanitizer...');
        try {
            const out = await generator.dataSanitizer(content, sourceText);
            if (out && out.length > 200) {
                content = out;
                console.log(`[Flow] Step 5 OK (${out.length} chars)`);
            } else {
                console.warn(`[Flow] Step 5 short output (${out?.length || 0} chars), keeping Step 4.`);
            }
        } catch (error) {
            console.warn(`[Flow] Step 5 failed: ${error.message}`);
        }

        console.log('[Flow] Step 6: Auto-fixing HTML structure...');
        content = autoFixStructure(content);

        const slug = selectedKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const draftsDir = path.join(__dirname, '..', 'drafts');
        if (!fs.existsSync(draftsDir)) {
            fs.mkdirSync(draftsDir, { recursive: true });
        }

        let draftFileName = `${slug}.html`;
        let fullPath = path.join(draftsDir, draftFileName);
        let counter = 1;
        while (fs.existsSync(fullPath)) {
            draftFileName = `${slug}-v${counter++}.html`;
            fullPath = path.join(draftsDir, draftFileName);
        }

        const finalDraftContent = generator.assembleDraftContent(
            generatedTitle || selectedKeyword,
            content,
            personaKey
        );

        try {
            fs.writeFileSync(fullPath, finalDraftContent);
        } catch (writeErr) {
            console.error(`[Flow] Failed to write draft at ${fullPath}: ${writeErr.message}`);
            throw writeErr;
        }

        console.log(`OK Draft saved: drafts/${draftFileName}`);

        console.log('[Flow] Compiling full HTML page from template...');
        const publishedPath = publishDraft(fullPath);
        console.log(`OK Full HTML post ready: ${path.relative(path.join(__dirname, '..'), publishedPath)}`);

        console.log('[Flow] Updating blog index...');
        utils.syncBlogIndex();
        console.log('OK Blog index updated.');
    } catch (err) {
        console.error(`[Flow] Critical error: ${err.message}`);
        process.exit(1);
    }
}

run();
