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
        // STEP 1: Keyword Discovery (gpt-oss-120b)
        console.log("[Flow] Step 1 Starting...");
        const newsHeadlineContext = await sources.fetchLatestNews();
        const selectedKeyword = await generator.discoverKeywords(newsHeadlineContext);
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

        // Final assembly
        const today = config.CURRENT_DATE;
        const slug = selectedKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const fileName = `${today}-${slug}.html`;

        let template = fs.readFileSync(config.TEMPLATE_PATH, 'utf8');
        const finalHtml = template
            .replaceAll('{{TITLE}}', selectedKeyword)
            .replaceAll('{{DATE}}', today)
            .replaceAll('{{TOPICS}}', selectedKeyword)
            .replaceAll('{{CATEGORY}}', config.CATEGORIES[0].name) // Default to first
            .replaceAll('{{CATEGORY_BADGE}}', config.CATEGORIES[0].badge)
            .replaceAll('{{CONTENT}}', content)
            .replaceAll('{{AUTHOR_NAME}}', config.AUTHOR.name)
            .replaceAll('{{AUTHOR_INITIALS}}', config.AUTHOR.initials)
            .replaceAll('{{AUTHOR_TITLE}}', config.AUTHOR.title)
            .replaceAll('{{AUTHOR_BIO}}', config.AUTHOR.bio);

        fs.writeFileSync(path.join(config.BLOG_DIR, fileName), finalHtml);
        console.log(`✅ Step 4 Complete: blog/${fileName} is PUBLISHED.`);

        utils.syncBlogIndex();
        console.log(`[Flow] End-to-end pipeline complete.`);

    } catch (err) {
        console.error(`❌ CRITICAL ERROR:`, err.message);
        process.exit(1);
    }
}

run();
