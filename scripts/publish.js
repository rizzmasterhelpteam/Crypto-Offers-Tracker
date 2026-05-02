const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const config = require('./lib/config');
const utils = require('./lib/utils');
const { publishAllDrafts } = require('./lib/publisher');
const { syncPublishWorkflowOptions } = require('./lib/publish-workflow-sync');

async function syncAndDeploy() {
    console.log('[Publish] Starting manual batch sync and deploy...');

    try {
        console.log('[1/5] Compiling drafts from templates...');
        const published = publishAllDrafts();
        if (published.length > 0) {
            console.log(`[Publish] Published ${published.length} new post(s) from drafts.`);
        } else {
            console.log('[Publish] No new content-only drafts to publish.');
        }

        console.log('[1.5/5] Refreshing publish workflow draft choices...');
        syncPublishWorkflowOptions();
        console.log('[Publish] Publish workflow choices updated.');

        console.log('[2/5] Scanning blog folders and updating index.html...');
        utils.syncBlogIndex();
        console.log('[Publish] Index synchronized.');

        const gitDir = path.join(config.ADMIN_DIR, '..', '.git');
        if (fs.existsSync(gitDir)) {
            console.log('[3/5] Staging changes for GitHub...');
            execSync(
                'git add blog/ drafts/ assets/ sitemap.xml index.html charts.html about.html contact.html privacy.html terms.html robots.txt admin/history.json admin/usage.log .github/workflows/publish.yml',
                { stdio: 'inherit' }
            );

            console.log('[4/5] Integrating remote changes...');
            try {
                execSync('git pull origin main --no-rebase', { stdio: 'inherit' });
            } catch (pullErr) {
                console.warn('[Publish] Pull needs manual attention. Continuing to commit current changes.');
            }

            console.log('[5/5] Committing and pushing...');
            const commitMsg = `Publish: Batch update ${new Date().toISOString().split('T')[0]}`;
            const commitResult = spawnSync('git', ['commit', '-m', commitMsg], { stdio: 'inherit' });
            if (commitResult.status === 0) {
                const pushResult = spawnSync('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
                if (pushResult.status === 0) {
                    console.log('[Publish] Successfully synced and pushed to GitHub.');
                } else {
                    console.error(`[Publish] Push failed with exit code ${pushResult.status}.`);
                }
            } else if (commitResult.status === 1) {
                console.log('[Publish] No new changes were identified for commit.');
            } else {
                console.error(`[Publish] Commit failed with exit code ${commitResult.status}.`);
            }
        } else {
            console.log('[Publish] No .git repository found. Skipping push.');
        }
    } catch (err) {
        console.error(`[Publish] Critical error during sync: ${err.message}`);
        process.exit(1);
    }
}

syncAndDeploy();
