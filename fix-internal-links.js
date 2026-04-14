const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, 'blog');

function getHtmlFiles(dir, files = []) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
            getHtmlFiles(full, files);
        } else if (file.endsWith('.html') && file !== 'template.html' && file !== 'index.html') {
            files.push(full);
        }
    }
    return files;
}

const files = getHtmlFiles(BLOG_DIR);
let totalReplaced = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const relativeCurrentFile = path.relative(BLOG_DIR, file).replace(/\\/g, '/');
    const currentDir = path.dirname(relativeCurrentFile);

    // Regex matches href="/blog/2026-..." 
    const linkRegex = /href="\/blog\/([^"]+)"/g;
    let modified = false;

    let match;
    let newContent = content;

    while ((match = linkRegex.exec(content)) !== null) {
        const targetRelativePath = match[1]; // e.g. "2026-04/10/monad.html"

        // Exclude links that just go to /blog/ index itself
        if (targetRelativePath === '' || targetRelativePath === '/') continue;

        let newRelative = path.relative(currentDir, targetRelativePath).replace(/\\/g, '/');
        if (!newRelative.startsWith('.')) newRelative = './' + newRelative;

        newContent = newContent.replace(match[0], `href="${newRelative}"`);
        modified = true;
        totalReplaced++;
    }

    if (modified) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`Rewrote links in ${relativeCurrentFile}`);
    }
}

console.log(`Finished rewriting ${totalReplaced} absolute internal links.`);

