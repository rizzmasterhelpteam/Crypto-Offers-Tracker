/**
 * publisher.js - Template Injection Engine
 *
 * Reads a content-only draft file (YAML front matter + HTML body),
 * injects it into blog/template.html, and writes the final compiled
 * HTML to blog/YYYY-MM/DD/slug.html.
 *
 * Draft format:
 * ---
 * title: My Post Title
 * date: 2026-04-14
 * category: Education
 * category_badge: orange
 * author: Mark
 * description: Short meta description here
 * keywords: keyword1, keyword2
 * hero_image: assets/blog/my-hero.png   (optional, leave blank for none)
 * ---
 *
 * <p>Your article content starts here...</p>
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const TEMPLATE_PATH = config.TEMPLATE_PATH;
const BLOG_DIR = config.BLOG_DIR;

/**
 * Parse YAML-style front matter from a draft file.
 * Returns { meta: {}, content: '' }
 */
function parseDraft(rawText) {
    const match = rawText.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
    if (!match) {
        // Legacy format: no front matter — treat whole file as content
        return { meta: {}, content: rawText.trim() };
    }

    const meta = {};
    match[1].split('\n').forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) return;
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        meta[key] = value;
    });

    return { meta, content: match[2].trim() };
}

/**
 * Build hero image HTML block from a relative asset path.
 */
function buildHeroImageHtml(heroImagePath, title, assetsPath) {
    if (!heroImagePath) return '';
    // Resolve relative to the deployed URL (assetsPath is "../../assets/" or "../../../assets/")
    const src = heroImagePath.startsWith('http')
        ? heroImagePath
        : `${assetsPath}${heroImagePath.replace(/^assets\/blog\//, 'blog/')}`;

    return `<figure class="hero-image-container">
                    <img class="hero-image" src="${src}" alt="${title}" loading="lazy">
                </figure>`;
}

/**
 * Compute relative path from blog/YYYY-MM/DD/ back to blog/style.css and assets/
 * Depth 3 (YYYY-MM/DD/file.html) → ../../style.css and ../../../assets/
 */
function computePaths(relativeFilePath) {
    const depth = relativeFilePath.split('/').length; // e.g. "2026-04/14/file.html" = 3
    const cssPath = depth === 3 ? '../../style.css' : '../style.css';
    const assetsPath = depth === 3 ? '../../../assets/' : '../../assets/';
    return { cssPath, assetsPath };
}

/**
 * Inject a draft into the template and write the compiled HTML file.
 *
 * @param {string} draftFile   - Absolute path to the .html draft file
 * @param {string} outputPath  - Absolute path for the published blog post (optional)
 * @returns {string} The output path where the post was written
 */
function publishDraft(draftFile, outputPath = null) {
    console.log(`[Publisher] Processing: ${path.basename(draftFile)}`);

    const rawText = fs.readFileSync(draftFile, 'utf8');
    const { meta, content } = parseDraft(rawText);

    // Required metadata with fallbacks
    const title = meta.title || path.basename(draftFile, '.html');
    const date = meta.date || new Date().toISOString().split('T')[0];
    const category = meta.category || 'Protocol Alpha';
    const badge = meta.category_badge || 'green';
    const author = meta.author || config.AUTHOR.name;
    const description = meta.description || content.replace(/<[^>]+>/g, '').slice(0, 200).trim();
    const keywords = meta.keywords || '';
    const heroImage = meta.hero_image || '';

    // Determine output path: blog/YYYY-MM/DD/slug.html
    if (!outputPath) {
        const [year, month] = date.split('-');             // "2026", "04"
        const day = date.split('-')[2];                     // "14"
        const slug = path.basename(draftFile, '.html');
        const outDir = path.join(BLOG_DIR, `${year}-${month}`, day);
        fs.mkdirSync(outDir, { recursive: true });
        outputPath = path.join(outDir, `${slug}.html`);
    }

    const relPath = path.relative(BLOG_DIR, outputPath).replace(/\\/g, '/');
    const { cssPath, assetsPath } = computePaths(relPath);

    const ogImage = heroImage
        ? `${assetsPath}${heroImage.replace(/^assets\/blog\//, 'blog/')}`
        : `${assetsPath}logo.png`;

    const authorLink = `<a href="/author/${author.toLowerCase()}.html" style="color: var(--link); font-weight: 600; text-decoration: none;">${author}</a>`;
    const heroHtml = buildHeroImageHtml(heroImage, title, assetsPath);

    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    const compiled = template
        .replace(/{{TITLE}}/g, title)
        .replace(/{{META_DESCRIPTION}}/g, description)
        .replace(/{{SEO_KEYWORDS}}/g, keywords)
        .replace(/{{DATE}}/g, date)
        .replace(/{{CATEGORY}}/g, category)
        .replace(/{{CATEGORY_BADGE}}/g, badge)
        .replace(/{{AUTHOR_NAME}}/g, author)
        .replace(/{{AUTHOR_LINK}}/g, authorLink)
        .replace(/{{CSS_PATH}}/g, cssPath)
        .replace(/{{ASSETS_PATH}}/g, assetsPath)
        .replace(/{{OG_IMAGE}}/g, ogImage)
        .replace(/{{ADSENSE_PUB_ID}}/g, config.ADSENSE_PUB_ID)
        .replace(/{{HERO_IMAGE}}/g, heroHtml)
        .replace(/{{CONTENT}}/g, content);

    fs.writeFileSync(outputPath, compiled, 'utf8');
    console.log(`[Publisher] ✅ Published → ${relPath}`);
    return outputPath;
}

/**
 * Process all draft files in the drafts/ directory.
 * Skips drafts that have already been published (exist in blog/).
 */
function publishAllDrafts() {
    const draftsDir = path.join(BLOG_DIR, '..', 'drafts');
    if (!fs.existsSync(draftsDir)) {
        console.log('[Publisher] No drafts/ directory found — skipping.');
        return [];
    }

    const draftFiles = fs.readdirSync(draftsDir)
        .filter(f => f.endsWith('.html'))
        .map(f => path.join(draftsDir, f));

    if (draftFiles.length === 0) {
        console.log('[Publisher] No drafts found.');
        return [];
    }

    const published = [];
    for (const draftFile of draftFiles) {
        try {
            // Only publish content-only drafts (have front matter)
            const raw = fs.readFileSync(draftFile, 'utf8');
            if (!raw.startsWith('---')) {
                console.log(`[Publisher] ⚠️  Skipping legacy full-HTML draft: ${path.basename(draftFile)}`);
                continue;
            }

            // Bug fix: skip already-published drafts to avoid overwriting existing posts
            const { meta } = parseDraft(raw);
            const date = meta.date || new Date().toISOString().split('T')[0];
            const [year, month] = date.split('-');
            const day = date.split('-')[2];
            const slug = path.basename(draftFile, '.html');
            const expectedOutPath = path.join(BLOG_DIR, `${year}-${month}`, day, `${slug}.html`);
            if (fs.existsSync(expectedOutPath)) {
                console.log(`[Publisher] ⏭️  Already published, skipping: ${path.basename(draftFile)}`);
                continue;
            }

            const outPath = publishDraft(draftFile);
            published.push(outPath);
        } catch (e) {
            console.error(`[Publisher] ❌ Failed to publish ${path.basename(draftFile)}: ${e.message}`);
        }
    }
    return published;
}

module.exports = { publishDraft, publishAllDrafts, parseDraft };
