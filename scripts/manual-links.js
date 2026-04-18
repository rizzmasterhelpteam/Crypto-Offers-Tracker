const fs = require('fs');
const path = require('path');

const replacements = [
    {
        file: 'blog/2026-04/10/monad-parallel-execution-chain-scalability-solutions.html',
        rules: [
            { regex: /optimistic parallel execution/i, replace: '<a href="https://docs.monad.xyz/" target="_blank" rel="nofollow">optimistic parallel execution</a>' },
            { regex: /MonadBFT/i, replace: '<a href="https://docs.monad.xyz/concepts/consensus" target="_blank" rel="nofollow">MonadBFT</a>' },
            { regex: /<p><strong>Bottom line:<\/strong> Monad delivers/, replace: '<p><strong>Bottom line:</strong> Monad delivers (For more high-TPS scaling, see our <a href="/blog/2026-04/09/starknet-parallel-transaction-processing-techniques.html">Starknet performance guide</a> or <a href="/blog/2026-04/10/sei-parallel-execution-chain-performance-analysis.html">Sei vs Monad comparison</a>).' }
        ]
    },
    {
        file: 'blog/2026-04/10/sei-parallel-execution-chain-performance-analysis.html',
        rules: [
            { regex: /Twin-Turbo consensus/i, replace: '<a href="https://www.sei.io/" target="_blank" rel="nofollow">Twin-Turbo consensus</a>' },
            { regex: /order matching engine/i, replace: '<a href="https://docs.sei.io/dev-ecosystem-providers/orderbook" target="_blank" rel="nofollow">order matching engine</a>' },
            { regex: /<p><strong>Bottom line:<\/strong> Sei v2 proves/, replace: '<p><strong>Bottom line:</strong> Sei v2 proves (Compare this with <a href="/blog/2026-04/10/monad-parallel-execution-chain-scalability-solutions.html">Monad\'s parallel EVM architecture</a>).' }
        ]
    },
    {
        file: 'blog/2026-04/10/zksync-era-optimistic-rollup-performance-optimization-techniques.html',
        rules: [
            { regex: /EIP-4844/i, replace: '<a href="https://eips.ethereum.org/EIPS/eip-4844" target="_blank" rel="nofollow">EIP-4844</a>' },
            { regex: /blobspace/i, replace: '<a href="https://ethereum.org/en/roadmap/danksharding/" target="_blank" rel="nofollow">blobspace</a>' }
        ]
    },
    {
        file: 'blog/2026-04/11/berachain-proof-of-liquidity-consensus-mechanism-advantages.html',
        rules: [
            { regex: /Proof of Liquidity \(PoL\)/i, replace: '<a href="https://docs.berachain.com/learn/what-is-proof-of-liquidity" target="_blank" rel="nofollow">Proof of Liquidity (PoL)</a>' },
            { regex: /Cosmos SDK/i, replace: '<a href="https://v1.cosmos.network/sdk" target="_blank" rel="nofollow">Cosmos SDK</a>' }
        ]
    },
    {
        file: 'blog/2026-04/11/jito-mev-extraction-strategies-for-solana-defi-yield-optimization.html',
        rules: [
            { regex: /Maximal Extractable Value/i, replace: '<a href="https://jito.network/" target="_blank" rel="nofollow">Maximal Extractable Value</a>' },
            { regex: /Jito-Solana validator client/i, replace: '<a href="https://jito.network/staking/" target="_blank" rel="nofollow">Jito-Solana validator client</a>' }
        ]
    },
    {
        file: 'blog/2026-04/11/optimism-eip-4844-blob-transaction-cost-reduction-strategies.html',
        rules: [
            { regex: /OP Stack/i, replace: '<a href="https://docs.optimism.io/stack/getting-started" target="_blank" rel="nofollow">OP Stack</a>' },
            { regex: /blob transactions/i, replace: '<a href="https://eips.ethereum.org/EIPS/eip-4844" target="_blank" rel="nofollow">blob transactions</a>' }
        ]
    },
    {
        file: 'blog/2026-04/12/celestia-data-availability-sampling-mechanisms-explained.html',
        rules: [
            { regex: /Data Availability Sampling \(DAS\)/i, replace: '<a href="https://celestia.org/what-is-celestia/" target="_blank" rel="nofollow">Data Availability Sampling (DAS)</a>' },
            { regex: /light nodes/i, replace: '<a href="https://docs.celestia.org/nodes/light-node" target="_blank" rel="nofollow">light nodes</a>' }
        ]
    },
    {
        file: 'blog/2026-04/13/avail-modular-data-availability-sampling-methods.html',
        rules: [
            { regex: /KZG commitments/i, replace: '<a href="https://docs.availproject.org/" target="_blank" rel="nofollow">KZG commitments</a>' },
            { regex: /Nominated Proof-of-Stake/i, replace: '<a href="https://wiki.polkadot.network/docs/learn-npos" target="_blank" rel="nofollow">Nominated Proof-of-Stake</a>' }
        ]
    },
    {
        file: 'blog/2026-04/14/celestia-data-availability-sampling-techniques-for-blockchain-scalability.html',
        rules: [
            { regex: /Rollups-as-a-Service/i, replace: '<a href="https://celestia.org/ecosystem/" target="_blank" rel="nofollow">Rollups-as-a-Service</a>' }
        ]
    }
];

replacements.forEach(({ file, rules }) => {
    const fullPath = path.resolve(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modifications = 0;

        rules.forEach(rule => {
            if (rule.regex.test(content) && !content.includes(rule.replace)) {
                content = content.replace(rule.regex, rule.replace);
                modifications++;
            }
        });

        if (!content.includes('<!-- seo-linked: true -->')) {
            content = content.replace(/<\/body>/, '    <!-- seo-linked: true -->\n</body>');
            modifications++;
        }

        if (modifications > 0) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Updated ${file} (${modifications} changes)`);
        } else {
            console.log(`Skipped ${file} (no matches or already linked)`);
        }
    } else {
        console.warn(`File not found: ${file}`);
    }
});
