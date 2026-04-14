const fs = require('fs');
const path = require('path');

const GLOB_DIR = path.join(__dirname, 'blog', '2026-04');

function getHtmlFiles(dir, files = []) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
            getHtmlFiles(full, files);
        } else if (file.endsWith('.html')) {
            files.push(full);
        }
    }
    return files;
}

const files = getHtmlFiles(GLOB_DIR);

const missingImages = [];
const hasImages = [];

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('class="hero-image-wrap"') || content.includes('class="post-hero-wrap"')) {
        hasImages.push(file);
    } else {
        missingImages.push(file);
    }
}

fs.writeFileSync('missing.json', JSON.stringify(missingImages, null, 2));
