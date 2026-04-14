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

const externalDict = [
    { word: "KZG commitments", url: "https://eips.ethereum.org/EIPS/eip-4844" },
    { word: "Data Availability Sampling", url: "https://celestia.org/what-is-celestia/" },
    { word: "Validium", url: "https://ethereum.org/en/developers/docs/scaling/validium/" },
    { word: "Parallel EVM", url: "https://monad.xyz" },
    { word: "Restaking", url: "https://docs.eigenlayer.xyz/" },
    { word: "Actively Validated Services", url: "https://docs.eigenlayer.xyz/" },
    { word: "Proof of Liquidity", url: "https://berachain.com" },
    { word: "Data Availability", url: "https://celestia.org/" },
    { word: "MEV", url: "https://jito.network" },
    { word: "ZK-Rollup", url: "https://zksync.io/" },
    { word: "Optimistic Rollup", url: "https://optimism.io/" },
    { word: "STARK-based", url: "https://starknet.io/" },
    { word: "EIP-4844", url: "https://eips.ethereum.org/EIPS/eip-4844" }
];

const internalDict = [
    { word: "parallel execution", url: "/blog/2026-04/10/monad-parallel-execution-chain-scalability-solutions.html" },
    { word: "blob transaction", url: "/blog/2026-04/11/optimism-eip-4844-blob-transaction-cost-reduction-strategies.html" },
    { word: "consensus mechanism", url: "/blog/2026-04/11/berachain-proof-of-liquidity-consensus-mechanism-advantages.html" },
    { word: "liquid restaking", url: "/blog/2026-04/09/eigenlayer-liquid-restaking-protocols-comparison.html" },
    { word: "gas efficiency", url: "/blog/2026-04/09/zksync-era-gas-efficiency-optimization-strategies.html" },
    { word: "yield optimization", url: "/blog/2026-04/11/jito-mev-extraction-strategies-for-solana-defi-yield-optimization.html" }
];

let processedCount = 0;

for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');

    // Nesting-aware content-body extraction
    const cbTag = '<div class="content-body">';
    const cbStart = html.indexOf(cbTag);
    if (cbStart === -1) continue;
    let depth = 1, pos = cbStart + cbTag.length;
    while (depth > 0 && pos < html.length) {
        const o = html.indexOf('<div', pos);
        const c = html.indexOf('</div>', pos);
        if (o !== -1 && o < c) { depth++; pos = o + 4; }
        else if (c !== -1) { depth--; pos = c + 6; }
        else break;
    }
    const cbEnd = pos;
    let body = html.slice(cbStart + cbTag.length, cbEnd - 6);

    // 1. Strip ALL existing <a> tags inside the body to reset links
    body = body.replace(/<a [^>]+>([^<]+)<\/a>/gi, '$1');

    // 2. Select exactly 3 external and 2 internal links on matching words
    let extCount = 0;
    let intCount = 0;

    // Shuffle dictionaries for variety
    const exts = [...externalDict].sort(() => 0.5 - Math.random());
    const ints = [...internalDict].sort(() => 0.5 - Math.random());

    for (const item of exts) {
        if (extCount >= 3) break;
        const regex = new RegExp('\\b(' + item.word + ')\\b', 'i');
        if (regex.test(body) && !body.includes('href="' + item.url + '"')) {
            const firstOccur = new RegExp('\\b(' + item.word + ')\\b(?!([^<]+)?>)', 'i');
            body = body.replace(firstOccur, '<a href="' + item.url + '" target="_blank" rel="nofollow">$1</a>');
            extCount++;
        }
    }

    for (const item of ints) {
        if (intCount >= 2) break;
        const regex = new RegExp('\\b(' + item.word + ')\\b', 'i');
        if (regex.test(body) && !body.includes('href="' + item.url + '"')) {
            const firstOccur = new RegExp('\\b(' + item.word + ')\\b(?!([^<]+)?>)', 'i');
            body = body.replace(firstOccur, '<a href="' + item.url + '">$1</a>');
            intCount++;
        }
    }

    // Rebuild html with updated body
    html = html.slice(0, cbStart) + cbTag + body + '</div>' + html.slice(cbEnd);
    fs.writeFileSync(file, html, 'utf8');
    processedCount++;
    console.log('✅ Processed ' + path.basename(file) + ' (Ext: ' + extCount + ', Int: ' + intCount + ')');
}

console.log('Done! Re-linked ' + processedCount + ' blog posts based on difficult words constraints.');
