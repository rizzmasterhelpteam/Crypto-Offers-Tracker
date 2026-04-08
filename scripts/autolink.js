const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const linker = require('./lib/linker-engine');

async function run() {
    console.log(`🚀 SEO AUTO-LINKER starting...`);
    if (!fs.existsSync(config.HISTORY_PATH)) return;
    const historyObj = JSON.parse(fs.readFileSync(config.HISTORY_PATH, 'utf8'));
    const blogFiles = fs.readdirSync(config.BLOG_DIR).filter(f => f.endsWith('.html') && !['index.html', 'template.html'].includes(f));
    if (blogFiles.length === 0) return;

    const targets = blogFiles.map(file => {
        const content = fs.readFileSync(path.join(config.BLOG_DIR, file), 'utf8');
        return { file, isProcessed: content.includes('<!-- seo-linked: true -->'), mtime: fs.statSync(path.join(config.BLOG_DIR, file)).mtime, content };
    }).sort((a, b) => (a.isProcessed !== b.isProcessed) ? (a.isProcessed ? 1 : -1) : b.mtime - a.mtime);

    const target = targets[0];
    console.log(`[Flow] Target: ${target.file}`);
    const updated = await linker.processBlog(target.content, historyObj, target.file);
    fs.writeFileSync(path.join(config.BLOG_DIR, target.file), updated);
}
run();
