const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./lib/config');
const utils = require('./lib/utils');

async function publish() {
    console.log(`🚀 PUBLISHING APPROVED CONTENT...`);

    if (!fs.existsSync(config.APPROVALS_PATH)) {
        console.log(`❌ No approvals registry found at ${config.APPROVALS_PATH}`);
        return;
    }

    const approvals = JSON.parse(fs.readFileSync(config.APPROVALS_PATH, 'utf8'));
    const files = Object.keys(approvals);
    let count = 0;

    for (const fileName of files) {
        const entry = approvals[fileName];

        if (entry.approved && !entry.pushed) {
            console.log(`[Publishing] ${fileName} ("${entry.title}")...`);

            try {
                // 1. Sync Index (Local)
                utils.syncBlogIndex();
                console.log(`   - Index synced.`);

                // 2. Git Operations
                if (fs.existsSync('.git')) {
                    console.log(`   - Pushing to GitHub...`);
                    execSync(`git add blog/${fileName} blog/index.html admin/history.json`, { stdio: 'inherit' });
                    execSync(`git commit -m "Publish: ${entry.title}"`, { stdio: 'inherit' });
                    execSync(`git push origin main`, { stdio: 'inherit' });
                }

                // 3. Mark as Pushed
                entry.pushed = true;
                count++;
            } catch (err) {
                console.error(`   ❌ Failed to publish ${fileName}:`, err.message);
            }
        }
    }

    if (count > 0) {
        fs.writeFileSync(config.APPROVALS_PATH, JSON.stringify(approvals, null, 4));
        console.log(`\n🎉 Successfully published ${count} new blog(s).`);
    } else {
        console.log(`\n😴 No newly approved content found. (Check "approved": true in admin/approvals.json)`);
    }
}

publish();
