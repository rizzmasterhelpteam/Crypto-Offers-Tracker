/**
 * migrate-posts.js
 * Converts all existing full-HTML blog posts into:
 *   1. A content-only draft (YAML front matter + article body)
 *   2. A recompiled final HTML via the new publisher/template system
 *
 * Run once: node migrate-posts.js
 */
const fs = require('fs');
const path = require('path');
const { publishDraft } = require('./scripts/lib/publisher');

const BLOG_DIR = path.resolve(__dirname, 'blog');
const DRAFTS_DIR = path.resolve(__dirname, 'drafts');

if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR, { recursive: true });

/** Extract text from a regex match, returning fallback if not found */
function extract(html, regex, fallback = '') {
    const m = html.match(regex);
    return m ? m[1].replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim() : fallback;
}

/** Recursively list .html files in blog/ excluding index.html and template.html */
function getPostFiles(dir, out = []) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) getPostFiles(p, out);
        else if (f.name.endsWith('.html') && f.name !== 'index.html' && f.name !== 'template.html') {
            out.push(p);
        }
    }
    return out;
}

const posts = getPostFiles(BLOG_DIR);
console.log(`\n🔄 Migrating ${posts.length} blog posts...\n`);

let migratedCount = 0;

for (const postFile of posts) {
    const slug = path.basename(postFile, '.html');
    const html = fs.readFileSync(postFile, 'utf8');

    // -- Extract metadata --
    const title = extract(html, /<title>([\s\S]*?)<\/title>/)
        .replace(/\s*\|\s*(Crypto Digest|crypto offers Digest|crypto offers|Digest)\s*$/gi, '')
        .replace(/\s+Digest\s*$/gi, '')   // catch multi-line cases where only "Digest" dangles
        .replace(/\s{2,}/g, ' ')
        .trim();

    const description = extract(html, /<meta name="description"[\s\S]*?content="([\s\S]*?)"/);
    const keywords = extract(html, /<meta name="keywords"[\s\S]*?content="([\s\S]*?)"/);

    const dateM = html.match(/\d{4}-\d{2}-\d{2}/);
    const date = dateM ? dateM[0] : new Date().toISOString().split('T')[0];

    const catBadgeM = html.match(/class="category-badge (\w+)">([^<]+)</);
    const categoryBadge = catBadgeM ? catBadgeM[1] : 'green';
    const category = catBadgeM ? catBadgeM[2] : 'Protocol Alpha';

    const authorM = html.match(/href="\/author\/[^"]+"\s[^>]*>([^<]+)<\/a>/);
    const author = authorM ? authorM[1] : 'Mark';

    // Hero image — check og:image or inline hero img
    let heroImage = '';
    const ogImgM = html.match(/<meta property="og:image" content="[^"]*(assets\/blog\/[^"]+)"/);
    if (ogImgM) heroImage = ogImgM[1];
    else {
        const heroImgM = html.match(/class="hero-image"[^>]*src="[^"]*(assets\/blog\/[^"]+)"/);
        if (heroImgM) heroImage = heroImgM[1];
    }

    // -- Extract article body from .content-body --
    const contentM = html.match(/<div class="content-body">\s*([\s\S]*?)\s*<\/div>\s*(?:<!--\s*Post-Content|<div class="ad-container")/);
    if (!contentM) {
        console.warn(`⚠️  Could not extract content-body for: ${slug}`);
        continue;
    }

    // Strip any stray nested <html> tags that may have leaked in
    let content = contentM[1]
        .replace(/<\/?html>/gi, '')
        .replace(/^\s+|\s+$/g, '');

    // Build YAML front matter
    const frontMatter = [
        '---',
        `title: ${title}`,
        `date: ${date}`,
        `category: ${category}`,
        `category_badge: ${categoryBadge}`,
        `author: ${author}`,
        `description: ${description}`,
        `keywords: ${keywords}`,
        `hero_image: ${heroImage}`,
        '---'
    ].join('\n');

    const draftContent = `${frontMatter}\n\n${content}`;

    // Write content-only draft
    const draftPath = path.join(DRAFTS_DIR, `${slug}.html`);
    fs.writeFileSync(draftPath, draftContent, 'utf8');

    // Recompile post directly in-place (same output path)
    publishDraft(draftPath, postFile);

    console.log(`✅ Migrated: ${path.relative(BLOG_DIR, postFile)}`);
    migratedCount++;
}

console.log(`\n🎉 Done! ${migratedCount}/${posts.length} posts migrated and recompiled.\n`);
