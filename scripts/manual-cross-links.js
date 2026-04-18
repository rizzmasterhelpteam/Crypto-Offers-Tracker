const fs = require('fs');
const path = require('path');

const crossLinks = {
    'blog/2026-04/10/sei-parallel-execution-chain-performance-analysis.html': [
        { url: '/blog/2026-04/10/monad-parallel-execution-chain-scalability-solutions.html', title: 'Monad Parallel EVM Architecture' }
    ],
    'blog/2026-04/10/zksync-era-optimistic-rollup-performance-optimization-techniques.html': [
        { url: '/blog/2026-04/09/zksync-era-gas-efficiency-optimization-strategies.html', title: 'zkSync Era Gas Efficiency Guide' }
    ],
    'blog/2026-04/11/berachain-proof-of-liquidity-consensus-mechanism-advantages.html': [
        { url: '/blog/2026-04/10/monad-parallel-execution-chain-scalability-solutions.html', title: 'Monad vs Traditional Consensus' }
    ],
    'blog/2026-04/11/jito-mev-extraction-strategies-for-solana-defi-yield-optimization.html': [
        { url: '/blog/2026-04/09/jito-retail-guide-yield-savings.html', title: 'JitoSOL Retail Yield Guide' }
    ],
    'blog/2026-04/11/optimism-eip-4844-blob-transaction-cost-reduction-strategies.html': [
        { url: '/blog/2026-04/10/zksync-era-optimistic-rollup-performance-optimization-techniques.html', title: 'zkSync Era Performance Overview' }
    ],
    'blog/2026-04/12/celestia-data-availability-sampling-mechanisms-explained.html': [
        { url: '/blog/2026-04/14/celestia-data-availability-sampling-techniques-for-blockchain-scalability.html', title: 'Celestia Scalability Deep Dive' }
    ],
    'blog/2026-04/13/avail-modular-data-availability-sampling-methods.html': [
        { url: '/blog/2026-04/12/celestia-data-availability-sampling-mechanisms-explained.html', title: 'Comparing DAS Mechanics (Celestia)' }
    ],
    'blog/2026-04/14/celestia-data-availability-sampling-techniques-for-blockchain-scalability.html': [
        { url: '/blog/2026-04/09/starknet-parallel-transaction-processing-techniques.html', title: 'Starknet and L2 Scaling Techniques' }
    ]
};

Object.entries(crossLinks).forEach(([file, links]) => {
    const fullPath = path.resolve(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');

        if (!content.includes('Related Reads')) {
            const linksHtml = links.map(l => `<li><a href="${l.url}">${l.title}</a></li>`).join('\n                        ');

            const relatedSection = `
                    <h3>Related Reads:</h3>
                    <ul>
                        ${linksHtml}
                    </ul>
                </div>

                <!-- Post-Content Ad -->`;

            content = content.replace(/<\/div>\s*<!-- Post-Content Ad -->/m, relatedSection);
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Added cross-links to ${file}`);
        } else {
            console.log(`Skipped cross-links for ${file} (already present)`);
        }
    } else {
        console.warn(`File not found: ${file}`);
    }
});
