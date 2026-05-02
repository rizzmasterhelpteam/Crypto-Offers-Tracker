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
const DRAFTS_DIR = path.join(BLOG_DIR, '..', 'drafts');
const ARCHIVED_DRAFTS_DIR = path.join(DRAFTS_DIR, 'published');

/**
 * Parse YAML-style front matter from a draft file.
 * Returns { meta: {}, content: '' }
 */
function parseDraft(rawText) {
    const match = rawText.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
    if (!match) {
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

function getDraftFiles() {
    if (!fs.existsSync(DRAFTS_DIR)) {
        return [];
    }

    return fs.readdirSync(DRAFTS_DIR, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
        .map(entry => path.join(DRAFTS_DIR, entry.name));
}

function listDrafts(options = {}) {
    const { includeLegacy = false } = options;

    return getDraftFiles()
        .map(draftFile => {
            const rawText = fs.readFileSync(draftFile, 'utf8');
            const { meta } = parseDraft(rawText);
            const hasFrontMatter = rawText.startsWith('---');

            return {
                draftFile,
                fileName: path.basename(draftFile),
                title: meta.title || path.basename(draftFile, '.html'),
                date: meta.date || '',
                hasFrontMatter
            };
        })
        .filter(draft => includeLegacy || draft.hasFrontMatter)
        .sort((a, b) => {
            const byDate = (b.date || '').localeCompare(a.date || '');
            return byDate || a.fileName.localeCompare(b.fileName);
        });
}

function archiveDraftFile(draftFile) {
    fs.mkdirSync(ARCHIVED_DRAFTS_DIR, { recursive: true });

    const parsed = path.parse(draftFile);
    let archivedPath = path.join(ARCHIVED_DRAFTS_DIR, parsed.base);
    let counter = 1;

    while (fs.existsSync(archivedPath)) {
        archivedPath = path.join(
            ARCHIVED_DRAFTS_DIR,
            `${parsed.name}-published-${counter++}${parsed.ext}`
        );
    }

    fs.renameSync(draftFile, archivedPath);
    return archivedPath;
}

/**
 * Build hero image HTML block from a relative asset path.
 */
function buildHeroImageHtml(heroImagePath, title, assetsPath) {
    if (!heroImagePath) return '';

    const src = heroImagePath.startsWith('http')
        ? heroImagePath
        : `${assetsPath}${heroImagePath.replace(/^assets\/blog\//, 'blog/')}`;

    return `<figure class="hero-image-container">
                    <img class="hero-image" src="${src}" alt="${title}" loading="lazy">
                </figure>`;
}

/**
 * Compute relative paths from a blog post back to blog/style.css and assets/.
 * Works at any nesting depth: depth 3 (YYYY-MM/DD/file.html) -> ../../style.css
 */
function computePaths(relativeFilePath) {
    const depth = relativeFilePath.split('/').length;
    const cssPath = '../'.repeat(depth - 1) + 'style.css';
    const assetsPath = '../'.repeat(depth) + 'assets/';
    return { cssPath, assetsPath };
}

/**
 * Inject a draft into the template and write the compiled HTML file.
 *
 * @param {string} draftFile - Absolute path to the .html draft file
 * @param {string} outputPath - Absolute path for the published blog post (optional)
 * @returns {string} The output path where the post was written
 */
function publishDraft(draftFile, outputPath = null) {
    console.log(`[Publisher] Processing: ${path.basename(draftFile)}`);

    const rawText = fs.readFileSync(draftFile, 'utf8');
    const { meta, content } = parseDraft(rawText);

    const title = meta.title || path.basename(draftFile, '.html');
    const date = meta.date || new Date().toISOString().split('T')[0];
    const category = meta.category || 'Protocol Alpha';
    const badge = meta.category_badge || 'green';
    const author = meta.author || config.AUTHOR.name;
    const description = meta.description || content.replace(/<[^>]+>/g, '').slice(0, 200).trim();
    const keywords = meta.keywords || '';
    const heroImage = meta.hero_image || '';

    if (!outputPath) {
        const [year, month] = date.split('-');
        const day = date.split('-')[2];
        const slug = path.basename(draftFile, '.html');
        const outDir = path.join(BLOG_DIR, `${year}-${month}`, day);
        fs.mkdirSync(outDir, { recursive: true });
        outputPath = path.join(outDir, `${slug}.html`);
    }

    const relPath = path.relative(BLOG_DIR, outputPath).replace(/\\/g, '/');
    const { cssPath, assetsPath } = computePaths(relPath);

    const ogImage = heroImage
        ? `${config.SITE_URL}/assets/blog/${heroImage.replace(/^assets\/blog\//, '')}`
        : `${config.SITE_URL}/assets/logo.png`;

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

    try {
        fs.writeFileSync(outputPath, compiled, 'utf8');
    } catch (writeErr) {
        console.error(`[Publisher] Failed to write ${relPath}: ${writeErr.message}`);
        throw writeErr;
    }

    try {
        let history = {};
        if (fs.existsSync(config.HISTORY_PATH)) {
            history = JSON.parse(fs.readFileSync(config.HISTORY_PATH, 'utf8'));
        }
        history[relPath] = title;
        fs.writeFileSync(config.HISTORY_PATH, JSON.stringify(history, null, 4));
    } catch (histErr) {
        console.warn(`[Publisher] Could not update history.json: ${histErr.message}`);
    }

    console.log(`[Publisher] Published -> ${relPath}`);
    return outputPath;
}

function publishDraftByName(draftFileName) {
    const draftFile = path.join(DRAFTS_DIR, draftFileName);
    if (!fs.existsSync(draftFile)) {
        throw new Error(`Draft not found: ${draftFileName}`);
    }

    const rawText = fs.readFileSync(draftFile, 'utf8');
    if (!rawText.startsWith('---')) {
        throw new Error(`Draft is not a content-only draft with front matter: ${draftFileName}`);
    }

    const outputPath = publishDraft(draftFile);
    const archivedPath = archiveDraftFile(draftFile);

    console.log(`[Publisher] Archived draft source -> ${path.relative(BLOG_DIR, archivedPath).replace(/\\/g, '/')}`);
    return { outputPath, archivedPath };
}

/**
 * Process all pending content-only draft files in the drafts/ directory.
 * Published drafts are archived under drafts/published/ after compilation.
 */
function publishAllDrafts() {
    if (!fs.existsSync(DRAFTS_DIR)) {
        console.log('[Publisher] No drafts/ directory found - skipping.');
        return [];
    }

    const draftFiles = getDraftFiles();
    if (draftFiles.length === 0) {
        console.log('[Publisher] No drafts found.');
        return [];
    }

    const published = [];
    for (const draftFile of draftFiles) {
        try {
            const raw = fs.readFileSync(draftFile, 'utf8');
            if (!raw.startsWith('---')) {
                console.log(`[Publisher] Skipping legacy full-HTML draft: ${path.basename(draftFile)}`);
                continue;
            }

            const outPath = publishDraft(draftFile);
            archiveDraftFile(draftFile);
            published.push(outPath);
        } catch (error) {
            console.error(`[Publisher] Failed to publish ${path.basename(draftFile)}: ${error.message}`);
        }
    }

    return published;
}

module.exports = {
    publishDraft,
    publishDraftByName,
    publishAllDrafts,
    parseDraft,
    listDrafts
};
