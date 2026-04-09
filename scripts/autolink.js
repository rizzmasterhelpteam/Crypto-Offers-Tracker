const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const linker = require('./lib/linker-engine');

function getNestedHtmlFiles(dir, base, results = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            getNestedHtmlFiles(fullPath, base, results);
        } else if (entry.name.endsWith('.html') && !['index.html', 'template.html'].includes(entry.name)) {
            results.push(path.relative(base, fullPath).replace(/\\/g, '/'));
        }
    }
    return results;
}

async function run() {
    console.log(`🚀 SEO AUTO-LINKER starting...`);

    if (!process.env.GROQ_API_KEY) {
        console.error(`[Flow] GROQ_API_KEY is not set. Aborting.`);
        process.exit(1);
    }

    if (!fs.existsSync(config.HISTORY_PATH)) {
        console.log(`[Flow] History not found at ${config.HISTORY_PATH}. Skipping.`);
        return;
    }
    let historyObj;
    try {
        historyObj = JSON.parse(fs.readFileSync(config.HISTORY_PATH, 'utf8'));
    } catch (e) {
        console.error(`[Flow] Failed to parse history.json: ${e.message}. Skipping.`);
        return;
    }

    const blogFiles = getNestedHtmlFiles(config.BLOG_DIR, config.BLOG_DIR);
    if (blogFiles.length === 0) {
        console.log(`[Flow] No blog posts found. Skipping.`);
        return;
    }

    const targets = blogFiles.map(file => {
        const fullPath = path.join(config.BLOG_DIR, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        return { file, isProcessed: content.includes('<!-- seo-linked: true -->'), mtime: fs.statSync(fullPath).mtime, content };
    }).sort((a, b) => (a.isProcessed !== b.isProcessed) ? (a.isProcessed ? 1 : -1) : b.mtime - a.mtime);

    const target = targets[0];

    if (target.isProcessed) {
        console.log(`[Flow] All posts are already SEO-linked. Nothing to do.`);
        return;
    }

    console.log(`[Flow] Target: ${target.file}`);
    const updated = await linker.processBlog(target.content, historyObj, target.file);
    try {
        fs.writeFileSync(path.join(config.BLOG_DIR, target.file), updated);
    } catch (e) {
        console.error(`[Flow] Failed to write updated file ${target.file}: ${e.message}`);
    }
}
run();
