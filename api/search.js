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
const VERIFIED_OFFERS = [
    {
        title: "Binance USDT Staking Rewards",
        platform: "Binance",
        description: "Earn up to 10% APY on USDT staking through Binance Earn",
        value: "Variable APY",
        type: "staking",
        badge: "live",
        requirements: "Minimum: 50 USDT",
        link: "https://www.binance.com/en/activity/earn",
        coinId: "tether",
        coinName: "Tether"
    },
    {
        title: "Binance Referral Commission",
        platform: "Binance",
        description: "Get 20% commission on friend's trading fees",
        value: "Lifetime 20%",
        type: "trading",
        badge: "live",
        requirements: "Share referral link",
        link: "https://www.binance.com/en/activity/referral",
        coinId: "binancecoin",
        coinName: "BNB"
    },
    {
        title: "Coinbase Learn & Earn",
        platform: "Coinbase",
        description: "Learn about crypto projects and earn free crypto rewards",
        value: "$10-50 per course",
        type: "learn",
        badge: "live",
        requirements: "Complete learning modules",
        link: "https://www.coinbase.com/earn",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "Coinbase Staking (Ethereum)",
        platform: "Coinbase",
        description: "Stake ETH and earn 3.5-4% APY",
        value: "3.5-4% APY",
        type: "staking",
        badge: "live",
        requirements: "Minimum: 0.001 ETH",
        link: "https://www.coinbase.com/staking/ethereum",
        coinId: "ethereum",
        coinName: "Ethereum"
    },
    {
        title: "Kraken Staking Rewards",
        platform: "Kraken",
        description: "Stake multiple cryptocurrencies for 5-20% APY",
        value: "5-20% APY",
        type: "staking",
        badge: "live",
        requirements: "Varies by asset",
        link: "https://www.kraken.com/features/staking-coins",
        coinId: "ethereum",
        coinName: "Ethereum"
    },
    {
        title: "Kraken Tier Rewards",
        platform: "Kraken",
        description: "Earn discounts on trading fees based on volume tier",
        value: "10-40% fee discount",
        type: "trading",
        badge: "live",
        requirements: "Monthly trading volume",
        link: "https://www.kraken.com/features/fee-schedule",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "OKX Earn Program",
        platform: "OKX",
        description: "Fixed and flexible earn products with up to 30% APY",
        value: "5-30% APY",
        type: "staking",
        badge: "live",
        requirements: "Minimum varies by asset",
        link: "https://www.okx.com/earn",
        coinId: "ethereum",
        coinName: "Ethereum"
    },
    {
        title: "Bybit New User Bonus",
        platform: "Bybit",
        description: "Deposit bonus up to $1000 USDT for new traders",
        value: "Up to $1000",
        type: "trading",
        badge: "new",
        requirements: "First deposit required",
        link: "https://www.bybit.com/en-US/promo/welcome-bonus",
        coinId: "tether",
        coinName: "Tether"
    },
    {
        title: "KuCoin Staking Center",
        platform: "KuCoin",
        description: "Stake crypto with APY ranging from 5% to 50%",
        value: "5-50% APY",
        type: "staking",
        badge: "live",
        requirements: "Asset specific",
        link: "https://www.kucoin.com/earn",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "Gate.io Lending Products",
        platform: "Gate.io",
        description: "Earn 2-15% APY by lending crypto assets",
        value: "2-15% APY",
        type: "staking",
        badge: "live",
        requirements: "Minimum: 0.1 BTC equivalent",
        link: "https://www.gate.io/earn",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "Uniswap Liquidity Provider Rewards",
        platform: "Uniswap",
        description: "Earn trading fees and UNI rewards from providing liquidity",
        value: "Variable + UNI",
        type: "launchpad",
        badge: "live",
        requirements: "Pair liquidity in V4",
        link: "https://app.uniswap.org/explore/pools",
        coinId: "uniswap",
        coinName: "Uniswap"
    },
    {
        title: "Curve Finance Governance Token",
        platform: "Curve",
        description: "Earn CRV rewards while providing stablecoin liquidity",
        value: "15-100% APY",
        type: "staking",
        badge: "live",
        requirements: "Provide liquidity to pools",
        link: "https://curve.fi/#/ethereum/pools",
        coinId: "curve-dao-token",
        coinName: "Curve DAO Token"
    },
    {
        title: "Aave Liquidity Mining",
        platform: "Aave",
        description: "Earn AAVE tokens as lender or borrower rewards",
        value: "Variable AAVE",
        type: "staking",
        badge: "live",
        requirements: "Supply/borrow assets",
        link: "https://app.aave.com/markets",
        coinId: "aave",
        coinName: "Aave"
    },
    {
        title: "Bitget Earning Center",
        platform: "Bitget",
        description: "Flexible and fixed-term earn products up to 20% APY",
        value: "2-20% APY",
        type: "staking",
        badge: "live",
        requirements: "Minimum varies",
        link: "https://www.bitget.com/earn",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "Crypto.com Earn",
        platform: "Crypto.com",
        description: "Earn 3-14% APY on various cryptocurrencies",
        value: "3-14% APY",
        type: "staking",
        badge: "live",
        requirements: "CRO card staking tier",
        link: "https://crypto.com/earn",
        coinId: "crypto-com-chain",
        coinName: "Cronos"
    },
    {
        title: "MEXC Mining Rewards",
        platform: "MEXC",
        description: "Trading mining rewards with up to 50% fee back",
        value: "Up to 50% fee back",
        type: "trading",
        badge: "live",
        requirements: "Trading volume",
        link: "https://www.mexc.com/activity/mining",
        coinId: "bitcoin",
        coinName: "Bitcoin"
    },
    {
        title: "Optimism Delegate Rewards",
        platform: "Optimism",
        description: "Delegate OP tokens to earn governance participation rewards",
        value: "Variable governance rewards",
        type: "launchpad",
        badge: "new",
        requirements: "Hold OP tokens",
        link: "https://app.optimism.io/governance",
        coinId: "optimism",
        coinName: "Optimism"
    },
    {
        title: "Arbitrum DAO Grants",
        platform: "Arbitrum",
        description: "Community grants program for developers and projects",
        value: "$10K-100K ARB",
        type: "launchpad",
        badge: "live",
        requirements: "Project submission",
        link: "https://arbitrumgrants.org",
        coinId: "arbitrum",
        coinName: "Arbitrum"
    },
    {
        title: "Lido Liquid Staking ETH",
        platform: "Lido",
        description: "Stake ETH and get stETH while earning rewards",
        value: "~3% APY",
        type: "staking",
        badge: "live",
        requirements: "Any amount of ETH",
        link: "https://lido.fi/eth",
        coinId: "ethereum",
        coinName: "Ethereum"
    },
    {
        title: "Yearn Finance Vault APY",
        platform: "Yearn",
        description: "Automated yield farming through yearn vaults",
        value: "5-50% APY",
        type: "staking",
        badge: "live",
        requirements: "Deposit into vault",
        link: "https://yearn.fi",
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
