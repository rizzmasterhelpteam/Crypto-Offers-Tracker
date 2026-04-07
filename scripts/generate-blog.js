/**
 * generate-blog.js - 4-Step Orchestration Script
 * Version 3: Modular, SEO-Focused, and Dual Fact-Checked.
 */
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const sources = require('./lib/sources');
const generator = require('./lib/generator-v3');
const utils = require('./lib/utils');

async function run() {
    console.log(`\n🚀 HIGH-AUTHORITY PIPELINE: 4-Step Generation v3 starting... (${config.CURRENT_DATE})`);

    try {
        // Load & Sync History with Filesystem
        let historyObj = {};
        if (fs.existsSync(config.HISTORY_PATH)) {
            try {
                historyObj = JSON.parse(fs.readFileSync(config.HISTORY_PATH, 'utf8'));
                // SYNC: Remove keywords if the corresponding file was deleted
                for (const fileName in historyObj) {
                    if (!fs.existsSync(path.join(config.BLOG_DIR, fileName))) {
                        console.log(`[Sync] File ${fileName} deleted; removing keyword "${historyObj[fileName]}" from history.`);
                        delete historyObj[fileName];
                    }
                }
            } catch (e) {
                console.warn("[Sync] History file corrupted or not JSON, starting fresh.");
                historyObj = {};
            }
        }
        const activeKeywords = Object.values(historyObj);

        // STEP 1: Keyword Discovery (llama-4-scout-17b)
        console.log("[Flow] Step 1 Starting...");
        const newsHeadlineContext = await sources.fetchLatestNews();
        const selectedKeyword = await generator.discoverKeywords(newsHeadlineContext, activeKeywords.slice(-20)); // Last 20 keywords
        console.log(`[Flow] Selected Keyword: "${selectedKeyword}"`);

        // STEP 2: Source Analysis & E-E-A-T Drafting (gpt-oss-120b)
        console.log("[Flow] Step 2 Starting...");
        const sourceText = await sources.getGroundedSources(selectedKeyword, selectedKeyword);
        let content = await generator.draftProfessionalBlog(selectedKeyword, sourceText);

        // STEP 3: First Fact-Check & Fix (llama-4-scout-17b)
        console.log("[Flow] Step 3 Starting...");
        content = await generator.firstFactCheck(content, sourceText);

        // STEP 4: Final Fact-Check & Publish (llama-4-scout-17b)
        console.log("[Flow] Step 4 Starting...");
        content = await generator.finalFactCheck(content, sourceText);

        // STEP 5: Data Sanitizer — corrects inaccurate dates, figures, TPS numbers (llama-4-scout-17b)
        console.log("[Flow] Step 5 Starting...");
        content = await generator.dataSanitizer(content, sourceText);

        // Final assembly
        const today = config.CURRENT_DATE;
        const slug = selectedKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        let fileName = `${today}-${slug}.html`;

        // Ensure Uniqueness (don't overwrite)
        let counter = 1;
        while (fs.existsSync(path.join(config.BLOG_DIR, fileName))) {
            fileName = `${today}-${slug}-v${counter}.html`;
            counter++;
        }

        let template = fs.readFileSync(config.TEMPLATE_PATH, 'utf8');
        const finalHtml = template
            .replaceAll('{{TITLE}}', selectedKeyword)
            .replaceAll('{{DATE}}', today)
            .replaceAll('{{TOPICS}}', selectedKeyword)
            .replaceAll('{{CATEGORY}}', config.CATEGORIES[0].name)
            .replaceAll('{{CATEGORY_BADGE}}', config.CATEGORIES[0].badge)
            .replaceAll('{{CONTENT}}', content)
            .replaceAll('{{AUTHOR_NAME}}', config.AUTHOR.name)
            .replaceAll('{{AUTHOR_INITIALS}}', config.AUTHOR.initials)
            .replaceAll('{{AUTHOR_TITLE}}', config.AUTHOR.title)
            .replaceAll('{{AUTHOR_BIO}}', config.AUTHOR.bio);

        fs.writeFileSync(path.join(config.BLOG_DIR, fileName), finalHtml);

        // Record and Save History
        historyObj[fileName] = selectedKeyword;
        fs.writeFileSync(config.HISTORY_PATH, JSON.stringify(historyObj, null, 4));

        console.log(`✅ Step 4 Complete: blog/${fileName} is PUBLISHED.`);

        utils.syncBlogIndex();
        console.log(`[Flow] End-to-end pipeline complete.`);

    } catch (err) {
        console.error(`❌ CRITICAL ERROR:`, err.message);
        process.exit(1);
    }
}

run();
