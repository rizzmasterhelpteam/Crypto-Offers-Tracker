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

// Known acronyms to preserve casing during title-casing
const ACRONYMS = new Set(['RWA', 'DeFi', 'AVS', 'MEV', 'TPS', 'TVL', 'ZK', 'AI', 'L1', 'L2', 'L3', 'DA', 'EVM', 'DAO', 'NFT', 'KYC', 'AML', 'LST', 'AMM', 'DEX', 'CEX']);

/**
 * Title-case a string, preserving known acronyms and protocol names.
 */
function toDisplayTitle(str) {
    return str.replace(/\b\w+/g, word => {
        if (ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
        const knownKey = Object.keys(config.PROJECT_KNOWLEDGE).find(k => k.toLowerCase() === word.toLowerCase());
        if (knownKey) return knownKey.charAt(0).toUpperCase() + knownKey.slice(1);
        return word.charAt(0).toUpperCase() + word.slice(1);
    });
}

/**
 * Post-processing: DOM-free structural fix using regex.
 * Catches cases where the LLM still emits bare <h2>Key Takeaways</h2> or <h2>Analyst Note</h2>.
 */
function autoFixStructure(html) {
    // Remove any Mermaid diagram blocks (no longer supported)
    html = html.replace(/<pre\s+class=["']mermaid["']>[\s\S]*?<\/pre>/gi, '');

    // Fix: LLM wrapping intro paragraphs in <h2> instead of <p>
    html = html.replace(/<h2[^>]*>([^<]{70,})<\/h2>/g, (_, inner) => `<p>${inner}</p>`);

    // Fix: duplicate first paragraph (common AI artifact)
    const paragraphs = html.match(/<p>[\s\S]*?<\/p>/g) || [];
    if (paragraphs.length >= 2) {
        const p1 = paragraphs[0].replace(/<[^>]+>/g, '').trim().slice(0, 100);
        const p2 = paragraphs[1].replace(/<[^>]+>/g, '').trim().slice(0, 100);
        if (p1 === p2) {
            console.log("[Fix] Duplicate intro detected — removing first.");
            html = html.replace(paragraphs[0], '');
        }
    }

    // Fix: <h2>Key Takeaways</h2> followed by <ul> → wrap in takeaways-card
    html = html.replace(
        /<h2[^>]*>Key Takeaways<\/h2>\s*(<ul[\s\S]*?<\/ul>)/gi,
        '<div class="takeaways-card"><h4>Key Takeaways</h4>$1</div>'
    );

    // Fix: <table> missing class="comparison-table"
    html = html.replace(/<table(?![^>]*class=)>/gi, '<table class="comparison-table">');
    html = html.replace(/<table(?=[^>]*class="[^"]*")(?![^>]*comparison-table)/gi, (m) =>
        m.replace('class="', 'class="comparison-table ')
    );

    // Fix: <h2>Analyst Note</h2><p>text</p> → insight-card
    html = html.replace(
        /<h2[^>]*>Analyst Note:?<\/h2>\s*<p>([\s\S]*?)<\/p>/gi,
        '<div class="insight-card"><strong>Analyst Note:</strong> $1</div>'
    );

    // Fix: stray <del> tags from data sanitizer
    html = html.replace(/<del>([\s\S]*?)<\/del>/gi, '$1');

    // Fix: orphaned <hr> tags
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
                console.log(`[Sync] ${fileName} deleted — removing from history.`);
                delete historyObj[fileName];
                changed = true;
            }
        }
        if (changed) {
            fs.writeFileSync(config.HISTORY_PATH, JSON.stringify(historyObj, null, 4));
        }
        return historyObj;
    } catch (e) {
        console.warn("[Sync] History corrupted, starting fresh.");
        return {};
    }
}


async function run() {
    console.log(`\n🚀 HIGH-AUTHORITY PIPELINE v4 starting... (${config.CURRENT_DATE})`);

    try {
        const historyObj = loadHistory();
        const activeKeywords = Object.values(historyObj);

        // STEP 1: Keyword Discovery — uses cached news (4hr TTL)
        console.log("[Flow] Step 1: Keyword Discovery...");
        const newsContext = await sources.fetchLatestNews();
        const selectedKeyword = await generator.discoverKeywords(newsContext, activeKeywords.slice(-20));
        console.log(`[Flow] Keyword: "${selectedKeyword}"`);

        // STEP 1.5 + SOURCES: Run title generation and source gathering in parallel
        console.log("[Flow] Step 1.5 + Sources: Title generation & source gathering (parallel)...");
        const [generatedTitle, sourceText] = await Promise.all([
            generator.generateTitle(selectedKeyword, newsContext),
            sources.getGroundedSources(selectedKeyword, selectedKeyword)
        ]);
        console.log(`[Flow] Title: "${generatedTitle}"`);

        // STEP 2: Expert Drafting
        console.log("[Flow] Step 2: Drafting...");
        const draftResult = await generator.draftProfessionalBlog(selectedKeyword, sourceText);
        let content = draftResult.draft;
        const personaKey = draftResult.personaKey;

        // STEP 3: Hallucination Audit
        console.log("[Flow] Step 3: Hallucination Audit...");
        try {
            const out = await generator.firstFactCheck(content, sourceText);
            if (out && out.length > 200) { content = out; console.log(`[Flow] Step 3 OK (${out.length} chars)`); }
            else console.warn(`[Flow] Step 3 short output (${out?.length || 0} chars), keeping Step 2.`);
        } catch (e) { console.warn(`[Flow] Step 3 FAILED: ${e.message}`); }

        // STEP 4: Final Polish
        console.log("[Flow] Step 4: Final Polish...");
        try {
            const out = await generator.finalFactCheck(content, sourceText);
            if (out && out.length > 200) { content = out; console.log(`[Flow] Step 4 OK (${out.length} chars)`); }
            else console.warn(`[Flow] Step 4 short output (${out?.length || 0} chars), keeping Step 3.`);
        } catch (e) { console.warn(`[Flow] Step 4 FAILED: ${e.message}`); }

        // STEP 5: Data Sanitizer
        console.log("[Flow] Step 5: Data Sanitizer...");
        try {
            const out = await generator.dataSanitizer(content, sourceText);
            if (out && out.length > 200) { content = out; console.log(`[Flow] Step 5 OK (${out.length} chars)`); }
            else console.warn(`[Flow] Step 5 short output (${out?.length || 0} chars), keeping Step 4.`);
        } catch (e) { console.warn(`[Flow] Step 5 FAILED: ${e.message}`); }

        // STEP 6: Local structure fix (no LLM needed)
        console.log("[Flow] Step 6: Auto-fixing HTML structure...");
        content = autoFixStructure(content);

        // Save as DRAFT — not published to blog yet
        const slug = selectedKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const draftsDir = path.join(path.join(__dirname, '..'), 'drafts');
        if (!fs.existsSync(draftsDir)) fs.mkdirSync(draftsDir, { recursive: true });

        let draftFileName = `${slug}.html`;
        let fullPath = path.join(draftsDir, draftFileName);
        let counter = 1;
        while (fs.existsSync(fullPath)) {
            draftFileName = `${slug}-v${counter++}.html`;
            fullPath = path.join(draftsDir, draftFileName);
        }

        const finalDraftContent = generator.assembleDraftContent(generatedTitle || selectedKeyword, content, personaKey);

        try {
            fs.writeFileSync(fullPath, finalDraftContent);
        } catch (writeErr) {
            console.error(`[Flow] Failed to write draft at ${fullPath}: ${writeErr.message}`);
            throw writeErr;
        }

        console.log(`✅ Draft saved: drafts/${draftFileName}`);

        // Immediately compile draft → full HTML blog post (CSS + head + body via template)
        console.log(`[Flow] Compiling full HTML page from template...`);
        const publishedPath = publishDraft(fullPath);
        console.log(`✅ Full HTML post ready: ${path.relative(path.join(__dirname, '..'), publishedPath)}`);

        // Keep the blog index in sync
        console.log(`[Flow] Updating blog index...`);
        utils.syncBlogIndex();
        console.log(`✅ Blog index updated.`);

    } catch (err) {
        console.error(`❌ CRITICAL ERROR:`, err.message);
        process.exit(1);
    }
}

run();
