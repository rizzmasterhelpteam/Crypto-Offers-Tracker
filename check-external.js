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
const linkRegex = /href="(https?:\/\/[^"]+)"/g;
const uniqueLinks = new Map();

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        const url = match[1];
        if (!uniqueLinks.has(url)) {
            uniqueLinks.set(url, []);
        }
        uniqueLinks.get(url).push(file.replace(__dirname, ''));
    }
}

async function verifyLinks() {
    console.log(`Checking ${uniqueLinks.size} unique external links...`);
    let brokenCount = 0;

    for (const [url, locations] of uniqueLinks.entries()) {
        try {
            // Using GET instead of HEAD as some sites block HEAD requests
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (!res.ok) {
                console.error(`[BROKEN: ${res.status}] ${url}`);
                locations.forEach(loc => console.error(`  -> Found in: ${loc}`));
                brokenCount++;
            } else {
                console.log(`[OK] ${url}`);
            }
        } catch (e) {
            console.error(`[ERROR: ${e.message}] ${url}`);
            locations.forEach(loc => console.error(`  -> Found in: ${loc}`));
            brokenCount++;
        }
    }

    console.log(`\nAudit complete. Found ${brokenCount} broken external links.`);
}

verifyLinks();
