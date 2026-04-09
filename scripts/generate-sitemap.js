const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://crypto-offers.vercel.app';
const PROJECT_ROOT = path.join(__dirname, '..');
const BLOG_DIR = path.join(PROJECT_ROOT, 'blog');

function getHtmlFilesRecursive(dir, base, results = []) {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            getHtmlFilesRecursive(fullPath, base, results);
        } else if (entry.name.endsWith('.html') && !['index.html', 'template.html'].includes(entry.name)) {
            results.push({ fullPath, relPath: path.relative(base, fullPath).replace(/\\/g, '/') });
        }
    }
    return results;
}

function generateSitemap() {
    console.log('🚀 Starting Sitemap Generation...');

    const staticPages = [
        { url: '/', priority: '1.0', changefreq: 'daily' },
        { url: '/blog/', priority: '0.9', changefreq: 'daily' },
        { url: '/charts.html', priority: '0.8', changefreq: 'weekly' },
        { url: '/about.html', priority: '0.5', changefreq: 'monthly' },
        { url: '/contact.html', priority: '0.5', changefreq: 'monthly' },
        { url: '/privacy.html', priority: '0.3', changefreq: 'monthly' },
        { url: '/terms.html', priority: '0.3', changefreq: 'monthly' }
    ];

    const blogPosts = getHtmlFilesRecursive(BLOG_DIR, BLOG_DIR)
        .map(({ fullPath, relPath }) => {
            let lastmod;
            try {
                lastmod = fs.statSync(fullPath).mtime.toISOString().split('T')[0];
            } catch (_) {
                lastmod = new Date().toISOString().split('T')[0];
            }
            return {
                url: `/blog/${relPath}`,
                priority: '0.7',
                changefreq: 'monthly',
                lastmod
            };
        });

    const allPages = [...staticPages, ...blogPosts];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    allPages.forEach(page => {
        xml += `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${page.lastmod || new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    });

    xml += '</urlset>';

    const outputPath = path.join(PROJECT_ROOT, 'sitemap.xml');
    fs.writeFileSync(outputPath, xml);

    console.log(`✅ Sitemap generated successfully with ${allPages.length} URLs!`);
    console.log(`📍 Saved to: ${outputPath}`);
}

generateSitemap();
