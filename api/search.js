// Server-side in-memory cache (shared across warm instance requests)
const serverCache = {};

function getCurrentSlot() {
    return Math.floor(Date.now() / (12 * 60 * 60 * 1000));
}

function getNextSlotTime() {
    return new Date((getCurrentSlot() + 1) * 12 * 60 * 60 * 1000);
}

// Real, curated crypto offers from official sources
// Each offer has a coinId for live price lookup and coinName for trending matching
// EVERGREEN OFFER LIST — descriptions and values use stable language that does not depend on
// live market rates. Any rate that fluctuates is described as "variable" and users are directed
// to the official platform page for current figures. This prevents stale data from shipping.
const VERIFIED_OFFERS = [
    {
        title: "Binance Flexible & Locked Savings",
        platform: "Binance",
        description: "Earn yield on idle crypto through Binance Earn — flexible or fixed-term. Rates update daily on the platform based on market conditions.",
        value: "Variable APY — check platform",
        type: "staking",
        badge: "live",
        requirements: "Verify current rates and minimums on Binance Earn before depositing",
        link: "https://www.binance.com/en/earn",
        coinId: "tether",
        coinName: "Tether"
    },
    {
        title: "Binance Referral Program",
        platform: "Binance",
        description: "Earn a share of trading fees from friends you refer. Standard rate is 10%; 20% is available when the referee holds BNB. Confirm current rate on the referral page.",
        value: "10-20% of referred fees",
        type: "trading",
        badge: "live",
        requirements: "Check current commission rate on the official Binance referral page",
        link: "https://www.binance.com/en/activity/referral",
        coinId: "binancecoin",
        coinName: "BNB"
    },
    {
        title: "Coinbase Learn & Earn",
        platform: "Coinbase",
        description: "Watch short educational videos and answer quiz questions to earn small amounts of crypto. Available tokens and reward amounts change as new courses launch.",
        value: "Variable — see active courses",
        type: "learn",
        badge: "live",
        requirements: "Verify which courses and rewards are currently available on Coinbase",
        link: "https://www.coinbase.com/earn",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "Coinbase ETH Staking",
        platform: "Coinbase",
        description: "Stake ETH directly on Coinbase and earn the Ethereum network staking reward minus Coinbase's commission. Rate tracks the Ethereum protocol and fluctuates.",
        value: "Variable ETH staking APR",
        type: "staking",
        badge: "live",
        requirements: "Verify current APR and any regional restrictions on Coinbase before staking",
        link: "https://www.coinbase.com/staking/ethereum",
        coinId: "ethereum",
        coinName: "Ethereum"
    },
    {
        title: "Kraken On-Chain Staking",
        platform: "Kraken",
        description: "Stake proof-of-stake assets on Kraken and earn protocol staking rewards. Rates vary by asset and are updated regularly. Availability differs by country.",
        value: "Variable by asset — check platform",
        type: "staking",
        badge: "live",
        requirements: "Check supported assets, current rates, and regional eligibility on Kraken",
        link: "https://www.kraken.com/features/staking-coins",
        coinId: "ethereum",
        coinName: "Ethereum"
    },
    {
        title: "Kraken Fee Schedule & Volume Discounts",
        platform: "Kraken",
        description: "Kraken's tiered fee schedule reduces trading costs as your 30-day volume increases. Higher tiers unlock lower maker/taker fees.",
        value: "Fee discounts based on volume tier",
        type: "trading",
        badge: "live",
        requirements: "Review current fee tiers on the official Kraken fee schedule page",
        link: "https://www.kraken.com/features/fee-schedule",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "OKX Earn — Flexible & Simple Earn",
        platform: "OKX",
        description: "OKX Earn offers flexible savings and structured products across many assets. Rates change with market conditions and vary widely by product type.",
        value: "Variable APY — check OKX Earn",
        type: "staking",
        badge: "live",
        requirements: "Verify current rates and lock-up terms on OKX Earn before committing funds",
        link: "https://www.okx.com/earn",
        coinId: "ethereum",
        coinName: "Ethereum"
    },
    {
        title: "Bybit Welcome Bonus",
        platform: "Bybit",
        description: "Bybit periodically offers deposit bonuses for new users. Bonus amount, qualifying deposit, and terms change with each promotion. Always read the current T&Cs.",
        value: "Check current promo — varies",
        type: "trading",
        badge: "new",
        requirements: "Read full T&Cs on the Bybit promo page; bonus terms change regularly",
        link: "https://www.bybit.com/en/promo/",
        coinId: "tether",
        coinName: "Tether"
    },
    {
        title: "KuCoin Earn",
        platform: "KuCoin",
        description: "KuCoin Earn offers flexible savings and promotions across a wide range of assets. Rates vary by asset and change frequently — check the platform for today's offers.",
        value: "Variable by asset — check platform",
        type: "staking",
        badge: "live",
        requirements: "Verify current APY and minimum amounts on KuCoin Earn before depositing",
        link: "https://www.kucoin.com/earn",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "Gate.io Lending & Earn",
        platform: "Gate.io",
        description: "Lend crypto assets to earn interest through Gate.io's lending marketplace. Rates fluctuate based on supply and demand — check the platform for live figures.",
        value: "Variable — see Gate.io Earn",
        type: "staking",
        badge: "live",
        requirements: "Check current lending rates and minimum amounts on Gate.io before depositing",
        link: "https://www.gate.io/earn",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "Uniswap Liquidity Provider Fees",
        platform: "Uniswap",
        description: "Provide liquidity to any pool on Uniswap V4 and earn a share of trading fees. Returns depend on pool volume and your position range — there is no UNI token emission.",
        value: "Variable trading fee share",
        type: "launchpad",
        badge: "live",
        requirements: "Understand impermanent loss risk before providing liquidity; returns vary by pool",
        link: "https://app.uniswap.org/explore/pools",
        coinId: "uniswap",
        coinName: "Uniswap"
    },
    {
        title: "Curve Finance Liquidity Pools",
        platform: "Curve",
        description: "Supply stablecoin or asset liquidity to Curve pools and earn trading fees plus CRV gauge rewards. Reward rates shift with CRV emissions and pool activity.",
        value: "Variable — see pool APY on Curve",
        type: "staking",
        badge: "live",
        requirements: "Check live pool APY on Curve Finance; rates change with CRV gauge weights",
        link: "https://curve.finance/pools",
        coinId: "curve-dao-token",
        coinName: "Curve DAO Token"
    },
    {
        title: "Aave Supply & Earn Interest",
        platform: "Aave",
        description: "Supply crypto assets to Aave's lending pools and earn variable interest paid by borrowers. Rates update in real time based on pool utilisation.",
        value: "Variable interest APR — see markets",
        type: "staking",
        badge: "live",
        requirements: "Check live supply APR for each asset on the Aave Markets page before supplying",
        link: "https://app.aave.com/markets",
        coinId: "aave",
        coinName: "Aave"
    },
    {
        title: "Bitget Earn",
        platform: "Bitget",
        description: "Bitget Earn offers flexible and fixed-term savings products. Rates differ by asset and term length and are updated regularly.",
        value: "Variable — check Bitget Earn",
        type: "staking",
        badge: "live",
        requirements: "Verify current APY and lock-up terms on Bitget Earn before depositing",
        link: "https://www.bitget.com/earn",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "Crypto.com Earn",
        platform: "Crypto.com",
        description: "Earn interest on crypto by locking it for a fixed term. Rates depend on the asset, term length, and your CRO staking tier — higher tiers unlock better rates.",
        value: "Variable — depends on CRO tier & term",
        type: "staking",
        badge: "live",
        requirements: "Rates vary by CRO staking tier; verify current terms on Crypto.com Earn",
        link: "https://crypto.com/earn",
        coinId: "crypto-com-chain",
        coinName: "Cronos"
    },
    {
        title: "MEXC Trading Rewards",
        platform: "MEXC",
        description: "MEXC runs periodic trading reward campaigns including fee rebates and token mining. Active promotions change frequently — check the events page for current offers.",
        value: "Variable — see active campaigns",
        type: "trading",
        badge: "live",
        requirements: "Check the MEXC events page for currently active promotions and their terms",
        link: "https://www.mexc.com/events",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "Optimism Governance Participation",
        platform: "Optimism",
        description: "Delegate your OP tokens to participate in Optimism governance. Some governance programs include retroactive rewards — check the Optimism governance site for active programs.",
        value: "Varies by program — check governance",
        type: "launchpad",
        badge: "live",
        requirements: "Verify current active governance programs and any associated rewards on Optimism",
        link: "https://agora.optimism.io",
        coinId: "optimism",
        coinName: "Optimism"
    },
    {
        title: "Arbitrum Foundation Grants & Programs",
        platform: "Arbitrum",
        description: "The Arbitrum Foundation runs multiple funding programs for builders on Arbitrum — including audit grants, gas sponsorship (ArbiFuel), gaming ventures, and chain development. Active programs and eligibility vary; check the grants page for currently open rounds.",
        value: "Varies by active program",
        type: "launchpad",
        badge: "live",
        requirements: "Check the Arbitrum Foundation grants page for currently open programs; the original DAO Grant Program has concluded",
        link: "https://arbitrum.foundation/grants",
        coinId: "arbitrum",
        coinName: "Arbitrum"
    },
    {
        title: "Lido Liquid ETH Staking",
        platform: "Lido",
        description: "Stake any amount of ETH with Lido and receive stETH, which accrues Ethereum staking rewards daily. The APR tracks the Ethereum protocol rate and changes over time.",
        value: "Variable ETH staking APR",
        type: "staking",
        badge: "live",
        requirements: "Check current staking APR on Lido; understand stETH liquidity and smart contract risks",
        link: "https://stake.lido.fi",
        coinId: "ethereum",
        coinName: "Ethereum"
    },
    {
        title: "Yearn Finance Vaults",
        platform: "Yearn",
        description: "Deposit assets into Yearn vaults for automated yield strategies. Returns vary by vault strategy and market conditions — riskier strategies may offer higher yields.",
        value: "Variable — see vault APY on Yearn",
        type: "staking",
        badge: "live",
        requirements: "Review each vault's strategy and current APY on Yearn Finance before depositing",
        link: "https://yearn.fi/vaults",
        coinId: "ethereum",
        coinName: "Ethereum"
    }
];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const slot = getCurrentSlot();
    const globalCacheKey = `global_slot_${slot}`;

    // BUG FIX #2: Return cached data with correct structure including marketData & prices
    if (serverCache[globalCacheKey]) {
        const cached = serverCache[globalCacheKey];
        return res.status(200).json({
            results: cached.enhancedOffers,
            marketData: cached.marketData || {},
            prices: cached.prices || {},
            trendingCoins: cached.trendingCoins || [],
            cached: true,
            nextRefresh: getNextSlotTime().toISOString(),
            slot,
            dataSource: "Verified Offers + Live CoinGecko Data (Cached)"
        });
    }

    const today = new Date().toISOString().split('T')[0];

    try {
        // BUG FIX #3: Single fetch call for all CoinGecko data — no duplicates
        const liveData = await fetchAllCoinGeckoData();
        const enhancedOffers = buildEnhancedOffers(VERIFIED_OFFERS, liveData, today);

        // Store full payload in cache
        const cachePayload = {
            enhancedOffers,
            marketData: liveData.marketData,
            prices: liveData.prices,
            trendingCoins: liveData.trendingCoins
        };
        serverCache[globalCacheKey] = cachePayload;

        // Clean up stale slot caches
        const cur = getCurrentSlot();
        Object.keys(serverCache).forEach(k => {
            if (k.startsWith('global_slot_') && parseInt(k.replace('global_slot_', '')) < cur) {
                delete serverCache[k];
            }
        });

        return res.status(200).json({
            results: enhancedOffers,
            marketData: liveData.marketData || {},
            prices: liveData.prices || {},
            trendingCoins: liveData.trendingCoins || [],
            cached: false,
            nextRefresh: getNextSlotTime().toISOString(),
            slot,
            dataSource: "Verified Offers + Live CoinGecko Data"
        });

    } catch (err) {
        // Fallback: return verified offers with no live data
        const fallbackOffers = VERIFIED_OFFERS.map(o => ({ ...o, date: today }));
        serverCache[globalCacheKey] = { enhancedOffers: fallbackOffers, marketData: {}, prices: {}, trendingCoins: [] };
        return res.status(200).json({
            results: fallbackOffers,
            marketData: {},
            prices: {},
            trendingCoins: [],
            cached: false,
            nextRefresh: getNextSlotTime().toISOString(),
            slot,
            dataSource: "Verified Offers (Live API unavailable)"
        });
    }
}

// BUG FIX #3: Single function that fetches ALL CoinGecko data in parallel — no duplicate calls
async function fetchAllCoinGeckoData() {
    const coinIds = [...new Set(VERIFIED_OFFERS.map(o => o.coinId).filter(Boolean))].join(',');

    const [trendingRes, globalRes, pricesRes, exchangesRes] = await Promise.allSettled([
        fetchWithTimeout(`https://api.coingecko.com/api/v3/search/trending`, 8000),
        fetchWithTimeout(`https://api.coingecko.com/api/v3/global`, 8000),
        fetchWithTimeout(`https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`, 8000),
        fetchWithTimeout(`https://api.coingecko.com/api/v3/exchanges?per_page=50`, 8000)
    ]);

    // Safely extract data from each settled promise
    const trendingData = trendingRes.status === 'fulfilled' ? await trendingRes.value.json().catch(() => ({})) : {};
    const globalData = globalRes.status === 'fulfilled' ? await globalRes.value.json().catch(() => ({})) : {};
    const pricesData = pricesRes.status === 'fulfilled' ? await pricesRes.value.json().catch(() => ({})) : {};
    const exchangesData = exchangesRes.status === 'fulfilled' ? await exchangesRes.value.json().catch(() => ([])) : [];

    // Build trending lookup: coinId → rank
    const trendingCoins = (trendingData?.coins || []).slice(0, 7).map((c, i) => ({
        id: c.item.id,
        name: c.item.name,
        symbol: c.item.symbol,
        rank: i + 1,
        price: c.item.data?.price || null,
        change24h: c.item.data?.price_change_percentage_24h?.usd || null,
        sparkline: c.item.data?.sparkline || null
    }));
    const trendingById = {};
    const trendingByName = {};
    trendingCoins.forEach(c => {
        trendingById[c.id.toLowerCase()] = c;
        trendingByName[c.name.toLowerCase()] = c;
        trendingByName[c.symbol.toLowerCase()] = c;
    });

    // Build exchange trust lookup: exchange name → trust info
    const exchangeTrustMap = {};
    (Array.isArray(exchangesData) ? exchangesData : []).forEach(ex => {
        exchangeTrustMap[ex.name.toLowerCase()] = {
            trustScore: ex.trust_score || 0,
            volume24hBtc: Math.round(ex.trade_volume_24h_btc || 0)
        };
    });

    return {
        trendingCoins,
        trendingById,
        trendingByName,
        exchangeTrustMap,
        marketData: globalData?.data || {},
        prices: pricesData
    };
}

// BUG FIX #5: Use coinId and coinName for accurate trending matching
function buildEnhancedOffers(offers, liveData, today) {
    const { trendingById, trendingByName, exchangeTrustMap, prices } = liveData;

    return offers.map(offer => {
        // Price lookup using explicit coinId on each offer
        const priceInfo = offer.coinId && prices[offer.coinId] ? prices[offer.coinId] : null;
        const livePrice = priceInfo?.usd ?? null;
        const priceChange24h = priceInfo?.usd_24h_change ?? null;

        // BUG FIX #5: Match trending using coinId and coinName fields (not title word split)
        const trendingMatch =
            (offer.coinId && trendingById[offer.coinId.toLowerCase()]) ||
            (offer.coinName && trendingByName[offer.coinName.toLowerCase()]);
        const isTrending = !!trendingMatch;
        const trendingRank = trendingMatch?.rank || null;

        // Exchange trust score
        const exchangeTrust = exchangeTrustMap[offer.platform.toLowerCase()] || { trustScore: 0, volume24hBtc: 0 };

        // BUG FIX #4: Remove dead coinLogoUrl variable
        return {
            title: offer.title,
            platform: offer.platform,
            description: offer.description,
            value: offer.value,
            type: offer.type,
            badge: offer.badge,
            requirements: offer.requirements,
            link: offer.link,
            date: today,
            livePrice,
            priceChange24h,
            isTrending,
            trendingRank,
            exchangeTrustScore: exchangeTrust.trustScore,
            volume24hBtc: exchangeTrust.volume24hBtc
        };
    });
}

// Utility: fetch with timeout, throws on non-ok or timeout
async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}
