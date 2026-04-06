const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://crypto-offers.vercel.app';
const PROJECT_ROOT = path.join(__dirname, '..');
const BLOG_DIR = path.join(PROJECT_ROOT, 'blog');

function getFiles(dir, extension) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(file => file.endsWith(extension));
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

    const blogPosts = getFiles(BLOG_DIR, '.html')
        .filter(file => file !== 'index.html' && file !== 'template.html')
        .map(file => {
            const filePath = path.join(BLOG_DIR, file);
            const stats = fs.statSync(filePath);
            return {
                url: `/blog/${file}`,
                priority: '0.7',
                changefreq: 'monthly',
                lastmod: stats.mtime.toISOString().split('T')[0]
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
