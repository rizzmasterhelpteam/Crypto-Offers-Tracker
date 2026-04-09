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

    // Recursive file finder
    function getFiles(dir, allFiles = []) {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const res = path.resolve(dir, file.name);
            if (file.isDirectory()) {
                getFiles(res, allFiles);
            } else if (file.name.endsWith('.html') && file.name !== 'template.html' && file.name !== 'index.html') {
                allFiles.push(res);
            }
        }
        return allFiles;
    }

    const blogRoot = path.resolve(config.BLOG_DIR);
    const absoluteFiles = getFiles(blogRoot).sort((a, b) => b.localeCompare(a)); // Sort by full path (reverse)

    let postEntries = '';
    absoluteFiles.forEach(absolutePath => {
        const file = path.relative(blogRoot, absolutePath).replace(/\\/g, '/');
        const content = fs.readFileSync(absolutePath, 'utf8');
        const titleMatch = content.match(/<title>(.*?)<\/title>/);
        const dateMatch = content.match(/\u2022\s*(\d{4}-\d{2}-\d{2})/) ||
            content.match(/Published on (\d{4}-\d{2}-\d{2})/) ||
            content.match(/<span class="date">(\d{4}-\d{2}-\d{2})<\/span>/);

        const categoryMatch = content.match(/<div class="category-badge (.*?)">(.*?)<\/div>/);
        const descriptionMatch = content.match(/<meta name="description" content="(.*?)"/);

        const title = titleMatch
            ? titleMatch[1].replace(/ \| crypto offers.*$/i, '').replace(/^["']+|["']+$/g, '').trim()
            : file;

        // Extract date from content or filename (YYYY-MM/DD/slug.html)
        let date = 'Recent';
        if (dateMatch) {
            date = dateMatch[1];
        } else {
            const parts = file.split('/'); // 2026-04/09/slug.html
            if (parts.length >= 3) {
                date = `${parts[0]}-${parts[1]}`; // This should be parts[0] is YYYY-MM, parts[1] is DD
            }
        }

        const categoryName = categoryMatch ? categoryMatch[2] : 'Insight';
        const categoryBadge = categoryMatch ? categoryMatch[1] : 'blue';
        const categoryFilter = categoryName.toLowerCase().replace(/\s+/g, '-');

        let excerpt = '';
        if (descriptionMatch) {
            excerpt = descriptionMatch[1].replace(/^Expert (?:crypto )?analysis on\s*/i, '').split(/\s*by Chain Signals/i)[0].trim();
        }
        if (!excerpt) {
            const firstPMatch = content.match(/<div class="content-body">\s*<p>([\s\S]*?)<\/p>/);
            if (firstPMatch) {
                excerpt = firstPMatch[1].replace(/<[^>]+>/g, '').slice(0, 180).trim();
            }
        }

        postEntries += `
        <a href="${file}" class="post-card" data-category="${categoryFilter}">
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
    const startMarkerPos = indexHtml.indexOf(startMarker);
    const endIndex = indexHtml.indexOf(endMarker);

    if (startMarkerPos === -1 || endIndex === -1) {
        console.warn('[Utils] Could not find post list markers in blog/index.html — skipping index sync.');
        return;
    }
    const startIndex = startMarkerPos + startMarker.length;
    indexHtml = indexHtml.substring(0, startIndex) + postEntries + '\n            ' + indexHtml.substring(endIndex);
    fs.writeFileSync(config.INDEX_PATH, indexHtml);
}

module.exports = {
    parseCSV,
    writeCSV,
    syncBlogIndex
};
