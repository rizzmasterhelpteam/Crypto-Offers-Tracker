const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./lib/config');
const utils = require('./lib/utils');
const { publishAllDrafts } = require('./lib/publisher');

async function syncAndDeploy() {
    console.log(`🚀 STARTING MANUAL BATCH SYNC & DEPLOY...`);

    try {
        // 1. Compile content-only drafts → full HTML blog posts
        console.log(`[1/5] Compiling drafts from templates...`);
        const published = publishAllDrafts();
        if (published.length > 0) {
            console.log(`✅ Published ${published.length} new post(s) from drafts.`);
        } else {
            console.log(`ℹ️  No new content-only drafts to publish.`);
        }

        // 2. Sync Blog Index + Sitemap (deep scan)
        console.log(`[2/5] Scanning blog folders and updating index.html...`);
        utils.syncBlogIndex();
        console.log(`✅ Index synchronized.`);

        // 3. Git Operations
        const gitDir = path.join(config.ADMIN_DIR, '..', '.git');
        if (fs.existsSync(gitDir)) {
            console.log(`[3/5] Staging changes for GitHub...`);
            execSync(`git add blog/ assets/ sitemap.xml index.html charts.html about.html contact.html privacy.html terms.html robots.txt admin/history.json admin/usage.log`, { stdio: 'inherit' });

            console.log(`[4/5] Integrating remote changes...`);
            try {
                execSync(`git pull origin main --no-rebase`, { stdio: 'inherit' });
            } catch (pullErr) {
                console.warn(`⚠️  Pull resulted in conflicts or needs attention. Proceeding with commit...`);
            }

            console.log(`[5/5] Committing and Pushing...`);
            const commitMsg = `Publish: Batch update ${new Date().toISOString().split('T')[0]}`;
            try {
                execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
                execSync(`git push origin main`, { stdio: 'inherit' });
                console.log(`\n🎉 Successfully synced and pushed to GitHub.`);
            } catch (pushErr) {
                if (pushErr.message.includes('nothing to commit')) {
                    console.log(`\n😴 No new changes were identified for commit.`);
                } else {
                    console.error(`\n❌ Push failed:`, pushErr.message);
                }
            }
        } else {
            console.log(`\n⚠️  No .git repository found. Skipping push.`);
        }

    } catch (err) {
        console.error(`\n❌ CRITICAL ERROR during sync:`, err.message);
        process.exit(1);
    }
}

syncAndDeploy();
