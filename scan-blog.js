/**
 * scan-blog.js - Comprehensive blog quality scanner
 * Scans all blog HTML files for common issues and reports them
 */
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.resolve(__dirname, 'blog');
const issues = [];

function getFiles(dir, all = []) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) getFiles(p, all);
        else if (f.name.endsWith('.html') && f.name !== 'index.html' && f.name !== 'template.html') all.push(p);
    }
    return all;
}

const files = getFiles(BLOG_DIR);
console.log(`\n📂 Scanning ${files.length} blog posts...\n`);

for (const file of files) {
    const rel = path.relative(BLOG_DIR, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    const fileIssues = [];

    // 1. Title contains '| crypto offers' or '| Crypto Digest' leftover
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
    if (titleMatch) {
        const rawTitle = titleMatch[1].replace(/[\r\n]+/g, ' ').trim();
        if (rawTitle.includes('| crypto offers')) {
            fileIssues.push(`🔴 Title still has site suffix: "${rawTitle.slice(0, 80)}..."`);
        }
    } else {
        fileIssues.push('🔴 Missing <title> tag');
    }

    // 2. Check meta description for AI artifacts
    const descMatch = html.match(/<meta name="description"[\s\S]*?content="([\s\S]*?)"/);
    if (descMatch) {
        const desc = descMatch[1];
        if (desc.includes('No factual') || desc.includes('Here is the same') || desc.length < 30) {
            fileIssues.push(`🔴 Bad meta description: "${desc.slice(0, 80)}"`);
        }
    } else {
        fileIssues.push('🟡 Missing meta description');
    }

    // 3. AI body artifact
    if (html.includes('No factual date/TPS/TVL errors') || html.includes('Here is the same HTML article')) {
        fileIssues.push('🔴 AI artifact in body content');
    }

    // 4. Check hero image
    if (!html.includes('class="hero-image"') && !html.includes('hero-image-wrap') && !html.includes('hero-image-container')) {
        fileIssues.push('🟡 No hero image');
    }

    // 5. CSS link depth check
    const depth = rel.split('/').length; // e.g. "2026-04/14/file.html" = 3 parts
    let expectedCSSHref = 'style.css';
    if (depth === 2) expectedCSSHref = '../style.css';
    if (depth === 3) expectedCSSHref = '../../style.css';
    const cssMatch = html.match(/href="([^"]*style\.css)"/);
    if (cssMatch) {
        if (cssMatch[1] !== expectedCSSHref) {
            fileIssues.push(`🟡 CSS path: got "${cssMatch[1]}", expected "${expectedCSSHref}"`);
        }
    } else {
        fileIssues.push('🔴 Missing CSS link');
    }

    // 6. Inline <html> tag inside body
    if (html.match(/<div class="content-body">[\s\S]*?<html>/)) {
        fileIssues.push('🔴 Nested <html> tag in content body');
    }

    // 7. Missing h1
    if (!html.includes('<h1>')) {
        fileIssues.push('🟡 No <h1> found');
    }

    // 8. Missing date in meta-line
    if (!html.match(/\d{4}-\d{2}-\d{2}/) && !html.match(/\w+ \d{1,2}, \d{4}/)) {
        fileIssues.push('🟡 No date found in post');
    }

    if (fileIssues.length > 0) {
        console.log(`📄 ${rel}`);
        fileIssues.forEach(i => console.log(`   ${i}`));
        console.log('');
        issues.push({ file: rel, issues: fileIssues });
    }
}

if (issues.length === 0) {
    console.log('✅ All blog posts look clean!\n');
} else {
    const critical = issues.flatMap(i => i.issues).filter(i => i.startsWith('🔴'));
    const warnings = issues.flatMap(i => i.issues).filter(i => i.startsWith('🟡'));
    console.log(`\n📊 Summary: ${critical.length} critical errors, ${warnings.length} warnings across ${issues.length} files.`);
}
