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
    { word: "EIP-4844", url: "https://eips.ethereum.org/EIPS/eip-4844" },
    { word: "Smart contracts", url: "https://ethereum.org/en/smart-contracts/" },
    { word: "LRTs", url: "https://ethereum.org/en/staking/" },
    { word: "DefiLlama", url: "https://defillama.com/" },
    { word: "liquid staking", url: "https://jito.network/" },
    { word: "validators", url: "https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/" },
    { word: "Ethereum", url: "https://ethereum.org" }
];

const internalDict = [
    { word: "parallel execution", url: "/blog/2026-04/10/monad-parallel-execution-chain-scalability-solutions.html" },
    { word: "blob transaction", url: "/blog/2026-04/11/optimism-eip-4844-blob-transaction-cost-reduction-strategies.html" },
    { word: "consensus mechanism", url: "/blog/2026-04/11/berachain-proof-of-liquidity-consensus-mechanism-advantages.html" },
    { word: "liquid restaking", url: "/blog/2026-04/09/eigenlayer-liquid-restaking-protocols-comparison.html" },
    { word: "gas efficiency", url: "/blog/2026-04/09/zksync-era-gas-efficiency-optimization-strategies.html" },
    { word: "yield optimization", url: "/blog/2026-04/11/jito-mev-extraction-strategies-for-solana-defi-yield-optimization.html" },
    { word: "modularity", url: "/blog/2026-04/13/avail-modular-data-availability-sampling-methods.html" },
    { word: "scalability", url: "/blog/2026-04/10/sei-parallel-execution-chain-performance-analysis.html" },
    { word: "Layer 2", url: "/blog/2026-04/11/optimism-eip-4844-blob-transaction-cost-reduction-strategies.html" },
    { word: "Solana", url: "/blog/2026-04/09/jito-retail-guide-yield-savings.html" }
];

let processedCount = 0;

for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');

    const matchBody = html.match(/<div class="content-body">([\s\S]*?)<\/div>/);
    if (!matchBody) continue;

    let body = matchBody[1];

    body = body.replace(/<a [^>]+>([^<]+)<\/a>/gi, '$1');

    let extCount = 0;
    let intCount = 0;

    const fallbackExt = [
        { word: "smart contract", url: "https://ethereum.org/en/smart-contracts/" },
        { word: "Layer 1", url: "https://ethereum.org/" },
        { word: "L1", url: "https://ethereum.org/" },
        { word: "blockchain", url: "https://ethereum.org/" },
        { word: "consensus", url: "https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/" }
    ];

    const fallbackInt = [
        { word: "performance", url: "/blog/2026-04/10/sei-parallel-execution-chain-performance-analysis.html" },
        { word: "execution", url: "/blog/2026-04/10/sei-parallel-execution-chain-performance-analysis.html" },
        { word: "optimistic", url: "/blog/2026-04/10/zksync-era-optimistic-rollup-performance-optimization-techniques.html" },
        { word: "rollup", url: "/blog/2026-04/10/zksync-era-optimistic-rollup-performance-optimization-techniques.html" },
        { word: "transaction", url: "/blog/2026-04/09/starknet-parallel-transaction-processing-techniques.html" },
        { word: "gas", url: "/blog/2026-04/09/zksync-era-gas-efficiency-optimization-strategies.html" }
    ];

    const exts = [...externalDict].sort(() => 0.5 - Math.random()).concat(fallbackExt);
    const ints = [...internalDict].sort(() => 0.5 - Math.random()).concat(fallbackInt);

    for (const item of exts) {
        if (extCount >= 3) break;
        const regex = new RegExp('(^|[^a-zA-Z0-9_])(' + item.word + ')([^a-zA-Z0-9_]|$)', 'i');
        if (regex.test(body) && !body.includes('href="' + item.url + '"')) {
            const firstOccur = new RegExp('(^|[^a-zA-Z0-9_])(' + item.word + ')([^a-zA-Z0-9_]|$)(?!([^<]+)?>)', 'i');
            body = body.replace(firstOccur, '$1<a href="' + item.url + '" target="_blank" rel="nofollow">$2</a>$3');
            extCount++;
        }
    }

    for (const item of ints) {
        if (intCount >= 2) break;
        const regex = new RegExp('(^|[^a-zA-Z0-9_])(' + item.word + ')([^a-zA-Z0-9_]|$)', 'i');
        if (regex.test(body) && !body.includes('href="' + item.url + '"')) {
            const firstOccur = new RegExp('(^|[^a-zA-Z0-9_])(' + item.word + ')([^a-zA-Z0-9_]|$)(?!([^<]+)?>)', 'i');
            body = body.replace(firstOccur, '$1<a href="' + item.url + '">$2</a>$3');
            intCount++;
        }
    }

    // Fallback if not enough links reached
    if (extCount < 2) {
        console.log('Warn: Only ' + extCount + ' external links found for ' + path.basename(file));
    }

    html = html.replace(/<div class="content-body">[\s\S]*?<\/div>/, '<div class="content-body">' + body + '</div>');
    fs.writeFileSync(file, html, 'utf8');
    processedCount++;
    console.log('✅ Processed ' + path.basename(file) + ' (Ext: ' + extCount + ', Int: ' + intCount + ')');
}

console.log('Done! Re-linked ' + processedCount + ' blog posts based on difficult words constraints.');
