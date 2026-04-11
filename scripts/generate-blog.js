/**
 * generate-blog.js - Pipeline Orchestration
 * Version 4: LLM title, TTL-cached sources, structure validation, SEO meta.
 */
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const sources = require('./lib/sources');
const generator = require('./lib/generator-v3');
const linker = require('./lib/linker-engine');
const utils = require('./lib/utils');

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
        for (const fileName in historyObj) {
            if (!fs.existsSync(path.join(config.BLOG_DIR, fileName))) {
                console.log(`[Sync] ${fileName} deleted — removing from history.`);
                delete historyObj[fileName];
            }
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

        // Final assembly
        // Phase 6: Deep Hierarchical Storage & Persistence
        const today = config.CURRENT_DATE; // e.g., 2026-04-09
        const yearMonth = today.substring(0, 7); // 2026-04
        const day = today.substring(8, 10);     // 09

        const slug = selectedKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Check for existing blog to maintain path stability
        let existingRelPath = null;
        function scanDir(dir) {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                const res = path.resolve(dir, item.name);
                if (item.isDirectory()) {
                    const found = scanDir(res);
                    if (found) return found;
                } else if (item.name.endsWith(`-${slug}.html`) || item.name === `${slug}.html`) {
                    return path.relative(config.BLOG_DIR, res).replace(/\\/g, '/');
                }
            }
            return null;
        }

        existingRelPath = scanDir(config.BLOG_DIR);

        let relativeFileName, fullPath, fileName;
        if (existingRelPath) {
            console.log(`[Persistence] Existing blog found: ${existingRelPath}. Staying in original folder.`);
            relativeFileName = existingRelPath;
            fullPath = path.join(config.BLOG_DIR, relativeFileName);
            fileName = path.basename(fullPath);
        } else {
            const nestedDir = path.join(config.BLOG_DIR, yearMonth, day);
            if (!fs.existsSync(nestedDir)) fs.mkdirSync(nestedDir, { recursive: true });

            fileName = `${slug}.html`; // Simplified filename since date is in folder
            relativeFileName = path.join(yearMonth, day, fileName).replace(/\\/g, '/');
            fullPath = path.join(nestedDir, fileName);

            let counter = 1;
            while (fs.existsSync(fullPath)) {
                fileName = `${slug}-v${counter++}.html`;
                relativeFileName = path.join(yearMonth, day, fileName).replace(/\\/g, '/');
                fullPath = path.join(nestedDir, fileName);
            }
        }

        let finalHtml = generator.assembleFullHtml(generatedTitle || selectedKeyword, content, personaKey);

        // STEP 7: SEO Auto-Linking (inline — no separate autolink.js pass needed)
        console.log("[Flow] Step 7: SEO Auto-Linking...");
        try {
            const linked = await linker.processBlog(finalHtml, historyObj, relativeFileName);
            if (linked && linked.length > finalHtml.length) {
                finalHtml = linked;
                console.log("[Flow] Step 7 OK — SEO links applied.");
            } else {
                console.warn("[Flow] Step 7 returned empty/short output — saving without links.");
            }
        } catch (e) {
            console.warn(`[Flow] Step 7 FAILED: ${e.message} — saving without links.`);
        }

        try {
            fs.writeFileSync(fullPath, finalHtml);
        } catch (writeErr) {
            console.error(`[Flow] Failed to write blog file at ${fullPath}: ${writeErr.message}`);
            throw writeErr;
        }

        historyObj[relativeFileName] = selectedKeyword;
        fs.writeFileSync(config.HISTORY_PATH, JSON.stringify(historyObj, null, 4));

        console.log(`✅ Saved: ${relativeFileName}`);

        console.log(`[Flow] Pipeline complete.`);
        console.log(`[Cooldown] Waiting 60 seconds...`);
        await new Promise(r => setTimeout(r, 60000));

    } catch (err) {
        console.error(`❌ CRITICAL ERROR:`, err.message);
        process.exit(1);
    }
}

run();
