/**
 * config.js - Core Configuration & Ground Truth
 * Contains the source of truth for the 2026 technical landscape.
 */
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const ADMIN_DIR = path.join(PROJECT_ROOT, 'admin');

module.exports = {
    SITE_URL: 'https://crypto-offers.vercel.app',
    BLOG_DIR: path.join(PROJECT_ROOT, 'blog'),
    ADMIN_DIR: ADMIN_DIR,
    TEMPLATE_PATH: path.join(PROJECT_ROOT, 'blog', 'template.html'),
    INDEX_PATH: path.join(PROJECT_ROOT, 'blog', 'index.html'),
    QUEUE_PATH: path.join(ADMIN_DIR, 'queue.csv'),
    SITEMAP_PATH: path.join(PROJECT_ROOT, 'sitemap.xml'),
    USAGE_LOG_PATH: path.join(ADMIN_DIR, 'usage.log'),
    STATE_PATH: path.join(ADMIN_DIR, 'state.json'),
    CONTEXT_CACHE_PATH: path.join(ADMIN_DIR, 'ground-truth-context.json'),
    HISTORY_PATH: path.join(ADMIN_DIR, 'history.json'),
    NEWS_CACHE_PATH: path.join(ADMIN_DIR, 'cache-news.json'),
    TRENDING_CACHE_PATH: path.join(ADMIN_DIR, 'cache-trending.json'),
    CACHE_TTL_MS: 4 * 60 * 60 * 1000,

    // Manual Approval Gate settings
    REQUIRE_APPROVAL: false,
    APPROVALS_PATH: path.join(ADMIN_DIR, 'approvals.json'),
    AUTO_PUSH: false,

    // 2026 PROJECT KNOWLEDGE: SOURCE OF TRUTH
    PROJECT_KNOWLEDGE: {
        'STRK': { role: 'Validity Rollup (Starknet)', mechanism: 'STARK-based proof systems. 2026 Focus: Stwo prover (L1 finality <1hr), STRK20 privacy protocol (March 2026 launch), and preconfirmations for <1s transaction latency.' },
        'STARKNET': { role: 'Validity Rollup', mechanism: 'STARK-based scaling. 2026 Pillars: STRK20 native privacy, Stwo prover efficiency, and Rust-based committers for 3x capacity.' },
        'MONAD': { role: 'Parallel EVM L1', mechanism: 'Mainnet launched Nov 2025. 10k TPS, 0.4s blocks. 2026 Focus: MONAD_NINE upgrade (optimized memory costs/EIP-7823 alignment) and ecosystem growth via Monad AI Blueprint.' },
        'MON': { role: 'Parallel EVM L1 (Monad)', mechanism: '10k TPS with parallel execution and MonadDB. Mainnet operational since late 2025.' },
        'EIGEN': { role: 'Verifiable Cloud (EigenLayer)', mechanism: 'Restaked security marketplace. Feb 2026: $18B+ TVL. Focus: Vertical Actively Validated Services (AVS) like EigenAI, EigenCompute and Multichain Verification across L2s.' },
        'EIGENLAYER': { role: 'Verifiable Cloud / Restaking', mechanism: 'Shared security for Actively Validated Services (AVS). 2026 Roadmap: Scaling decentralized AI inference and model evaluation via specialized AVS instances.' },
        'BERA': { role: 'DeFi-Focused L1 (Berachain)', mechanism: 'Proof of Liquidity (PoL) aligning security with liquidity. Mainnet launched Feb 2025. 2026: Bera Builds Businesses focus.' },
        'BERACHAIN': { role: 'DeFi-Focused L1', mechanism: 'PoL consensus. 2026 Focus: Revenue-generating apps over pure emission incentives ($BERA, $BGT, $HONEY).' },
        'TIA': { role: 'Modular Data Availability Layer (Celestia)', mechanism: 'Data Availability Sampling (DAS). 2026: Expansion beyond Ethereum L3s toward native modular alignment.' },
        'CELESTIA': { role: 'Modular DA Layer', mechanism: 'DAS and Namespace Merkle Trees (NMTs).' },
        'JTO': { role: 'Solana Liquid Staking (Jito)', mechanism: 'MEV-boosted rewards and stake delegation.' },
        'DRIFT': { role: 'Decentralized Perps (Drift)', mechanism: 'Dynamic VAMM and cross-margined trading on Solana.' },
        'PENGU': { role: 'NFT Brand (Pudgy Penguins)', mechanism: 'Consumer IP and physical toys. PENGU token launched for governance.' },
        'BRISE': { role: 'Low-fee L1 (Bitgert)', mechanism: 'EVM-compatible chain with near-zero fees. Note: NOT a Layer-0 bridge. Claims of 2026 "consensus re-engineering" for L0 are fabricated hallucinations.' }
    },

    BANNED_AI_PATTERNS: [
        "narrative convergence", "convergence of signals", "synergy between project X and Y",
        "poised for growth", "inflection point", "structural shift", "market narrative investors monitor",
        "subtle but measurable signal", "paving the way", "the future of finance", "game changer",
        "unlocking the potential", "seamless integration", "vibrant ecosystem",
        "like a hawk eyes a migrating herd", "pressure is on", "The answer is emerging now",
        "trust-less compliance paradigm", "A joint pilot", "converges"
    ],

    CATEGORIES: [
        { id: 'intelligence', name: 'Market Intelligence', badge: 'purple' },
        { id: 'alpha', name: 'Protocol Alpha', badge: 'green' },
        { id: 'spotlight', name: 'Deep Tech', badge: 'blue' }
    ],

    AUTHOR: {
        name: 'Mark',
        initials: 'M',
        title: 'Lead Crypto Strategist',
        bio: 'Technical signals for an audience of intermediate-to-advanced crypto readers — those building and trading in the 2026 modular landscape. The writing must be strictly devoid of forced metaphors or dramatized financial comparisons.'
    },

    TRUSTED_DOMAINS: [
        'ethereum.org', 'docs.eigenlayer.xyz', 'monad.xyz', 'celestia.org', 'starknet.io',
        'availproject.org', 'docs.solana.com', 'berachain.com', 'zksync.io', 'optimism.io',
        'arbitrum.io', 'docs.drift.trade', 'jito.network', 'eips.ethereum.org'
    ],
    RESEARCH_SEEDS: ['Celestia', 'EigenLayer', 'Monad', 'Berachain', 'Jito', 'Drift Protocol', 'Starknet', 'zkSync'],
    CURRENT_DATE: new Date().toISOString().split('T')[0] // 2026-04-07
};
