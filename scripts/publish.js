const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./lib/config');
const utils = require('./lib/utils');

async function syncAndDeploy() {
    console.log(`🚀 STARTING MANUAL BATCH SYNC & DEPLOY...`);

    try {
        // 1. Sync Sitemap/Index (Deep scan of directories)
        console.log(`[1/4] Scanning blog folders and updating index.html...`);
        utils.syncBlogIndex();
        console.log(`✅ Index synchronized.`);

        // 2. Git Operations
        const gitDir = path.join(config.ADMIN_DIR, '..', '.git');
        if (fs.existsSync(gitDir)) {
            console.log(`[2/4] Staging changes for GitHub...`);
            execSync(`git add blog/ assets/ sitemap.xml admin/history.json admin/usage.log`, { stdio: 'inherit' });

            console.log(`[3/4] Integrating remote changes...`);
            try {
                execSync(`git pull origin main --no-rebase`, { stdio: 'inherit' });
            } catch (pullErr) {
                console.warn(`⚠️  Pull resulted in conflicts or needs attention. Proceeding with commit...`);
            }

            console.log(`[4/4] Committing and Pushing...`);
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
