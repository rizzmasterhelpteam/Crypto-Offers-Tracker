/**
 * fix-blog.js - Automated fixer for all identified blog issues
 * 1. Strips " | crypto offers Digest" / " | Crypto Digest" etc from <title> tags
 * 2. Removes nested <html> tags in content-body
 * 3. Patches CSS link depths for all posts
 */
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.resolve(__dirname, 'blog');
let totalFixed = 0;

function getFiles(dir, all = []) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) getFiles(p, all);
        else if (f.name.endsWith('.html') && f.name !== 'index.html' && f.name !== 'template.html') all.push(p);
    }
    return all;
}

const files = getFiles(BLOG_DIR);
console.log(`\n🔧 Processing ${files.length} blog posts...\n`);

for (const file of files) {
    const rel = path.relative(BLOG_DIR, file).replace(/\\/g, '/');
    let html = fs.readFileSync(file, 'utf8');
    let changed = false;
    const fixes = [];

    // 1. Strip " | crypto offers Digest" / " | Crypto Digest" etc from <title>
    const newHtml1 = html.replace(
        /(<title>)([\s\S]*?)(<\/title>)/,
        (_, open, title, close) => {
            const cleaned = title
                .replace(/\|\s*crypto offers.*?(?=\n|$)/gi, '')
                .replace(/\|\s*Crypto Digest.*?(?=\n|$)/gi, '')
                .replace(/\r?\n\s*\r?\n/g, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
            if (cleaned !== title.trim()) {
                fixes.push(`✅ Fixed <title> suffix`);
                return open + cleaned + close;
            }
            return _;
        }
    );
    if (newHtml1 !== html) { html = newHtml1; changed = true; }

    // 2. Remove nested <html> tag leftover in .content-body
    if (html.match(/<div class="content-body">[\s\S]*?<html>/)) {
        const newHtml2 = html.replace(/(<div class="content-body">[\s\S]*?)\s*<html>\s*/g, '$1\n');
        if (newHtml2 !== html) {
            html = newHtml2;
            changed = true;
            fixes.push('✅ Removed nested <html> from content-body');
        }
    }

    // 3. Remove closing </html> that's wrongly inside body content
    if (html.match(/<div class="content-body">[\s\S]*?<\/html>\s*<\/div>/)) {
        const newHtml3 = html.replace(/<\/html>(\s*<\/div>\s*<!--)/g, '$1');
        if (newHtml3 !== html) {
            html = newHtml3;
            changed = true;
            fixes.push('✅ Removed stray </html> from content');
        }
    }

    // 4. Fix CSS depth (YYYY-MM/DD/file.html = 3 parts deep from blog root)
    const depth = rel.split('/').length;
    const expectedCSS = depth === 3 ? '../../style.css' : '../style.css';
    const cssFixed = html.replace(
        /href="([^"]*?style\.css)"/,
        (orig, current) => {
            if (current !== expectedCSS) {
                fixes.push(`✅ Fixed CSS path: ${current} → ${expectedCSS}`);
                return `href="${expectedCSS}"`;
            }
            return orig;
        }
    );
    if (cssFixed !== html) { html = cssFixed; changed = true; }

    // Save file if changed
    if (changed) {
        fs.writeFileSync(file, html, 'utf8');
        console.log(`📄 ${rel}`);
        fixes.forEach(f => console.log(`   ${f}`));
        console.log('');
        totalFixed++;
    }
}

// Fix index.html h3 titles (strip site suffix from card headings)
const indexPath = path.join(BLOG_DIR, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
const indexFixed = indexHtml.replace(
    /<h3>([\s\S]*?)<\/h3>/g,
    (_, title) => {
        const cleaned = title
            .replace(/\|\s*crypto offers\s*Digest/gi, '')
            .replace(/\|\s*Crypto Digest/gi, '')
            .replace(/\|\s*crypto offers/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        return `<h3>${cleaned}</h3>`;
    }
);
if (indexFixed !== indexHtml) {
    fs.writeFileSync(indexPath, indexFixed, 'utf8');
    console.log('📄 blog/index.html');
    console.log('   ✅ Stripped site suffixes from post card titles\n');
    totalFixed++;
}

console.log(`\n✅ Done! Fixed ${totalFixed} files.\n`);
