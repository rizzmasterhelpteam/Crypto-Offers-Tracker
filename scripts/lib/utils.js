/**
 * utils.js - Utility Helpers
 * CSV parsing, Index syncing, and post-processing.
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

function parseCSV(content) {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const row = {};
        headers.forEach((h, i) => {
            row[h] = values[i] ? values[i].replace(/^"|"$/g, '').trim() : '';
        });
        return row;
    });
}

function writeCSV(headers, rows, targetPath) {
    const content = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
            const val = r[h] || '';
            return val.includes(',') ? `"${val}"` : val;
        }).join(','))
    ].join('\n');
    fs.writeFileSync(targetPath, content);
}

function syncBlogIndex() {
    console.log("[Utils] Syncing Blog Index...");
    const blogFiles = fs.readdirSync(config.BLOG_DIR)
        .filter(f => f.endsWith('.html') && f !== 'template.html' && f !== 'index.html')
        .sort((a, b) => b.localeCompare(a)); // Newest first

    let postEntries = '';
    blogFiles.forEach(file => {
        const content = fs.readFileSync(path.join(config.BLOG_DIR, file), 'utf8');
        const titleMatch = content.match(/<title>(.*?)<\/title>/);
        const dateMatch = content.match(/🗓️ (.*?)<\/span>/);
        const categoryMatch = content.match(/<div class="category-badge (.*?)">(.*?)<\/div>/);
        const descriptionMatch = content.match(/<meta name="description" content="(.*?)"/);

        const title = titleMatch ? titleMatch[1].replace(' | crypto offers Tracker', '').trim() : file;
        const date = dateMatch ? dateMatch[1] : 'Recent';
        const categoryName = categoryMatch ? categoryMatch[2] : 'Insight';
        const categoryBadge = categoryMatch ? categoryMatch[1] : 'blue';
        const excerpt = descriptionMatch ? descriptionMatch[1].replace(/^Expert analysis on /i, '').split(' by Chain Signals')[0] : '';

        postEntries += `
        <a href="${file}" class="post-card">
            <div class="category-badge ${categoryBadge}">${categoryName}</div>
            <span class="date">${date}</span>
            <h3>${title}</h3>
            <div class="excerpt">${excerpt}</div>
            <span class="read-more">Read Full Insight</span>
        </a>`;
    });

    let indexHtml = fs.readFileSync(config.INDEX_PATH, 'utf8');
    const startMarker = '<div class="post-list" id="postList">';
    const endMarker = '<!-- POST_ITEM_TEMPLATE -->';
    const startIndex = indexHtml.indexOf(startMarker) + startMarker.length;
    const endIndex = indexHtml.indexOf(endMarker);

    if (startIndex > -1 && endIndex > -1) {
        indexHtml = indexHtml.substring(0, startIndex) + postEntries + '\n            ' + indexHtml.substring(endIndex);
        fs.writeFileSync(config.INDEX_PATH, indexHtml);
    }
}

module.exports = {
    parseCSV,
    writeCSV,
    syncBlogIndex
};
