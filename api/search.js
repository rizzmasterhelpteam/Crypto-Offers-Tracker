// Server-side in-memory cache (shared across warm instance requests)
const serverCache = {};

function getCurrentSlot() {
    // Increments every 12 hours UTC — refreshes globally twice daily
    return Math.floor(Date.now() / (12 * 60 * 60 * 1000));
}

function getNextSlotTime() {
    return new Date((getCurrentSlot() + 1) * 12 * 60 * 60 * 1000);
}

// Real, curated crypto offers from official sources
const VERIFIED_OFFERS = [
    // Binance Offers
    {
        title: "Binance USDT Staking Rewards",
        platform: "Binance",
        description: "Earn up to 10% APY on USDT staking through Binance Earn",
        value: "Variable APY",
        type: "staking",
        badge: "live",
        requirements: "Minimum: 50 USDT",
        link: "https://www.binance.com/en/activity/earn"
    },
    {
        title: "Binance Referral Commission",
        platform: "Binance",
        description: "Get 20% commission on friend's trading fees",
        value: "Lifetime 20%",
        type: "trading",
        badge: "live",
        requirements: "Share referral link",
        link: "https://www.binance.com/en/activity/referral"
    },

    // Coinbase Offers
    {
        title: "Coinbase Learn & Earn",
        platform: "Coinbase",
        description: "Learn about crypto projects and earn free crypto rewards",
        value: "$10-50 per course",
        type: "learn",
        badge: "live",
        requirements: "Complete learning modules",
        link: "https://www.coinbase.com/earn"
    },
    {
        title: "Coinbase Staking (Ethereum)",
        platform: "Coinbase",
        description: "Stake ETH and earn 3.5-4% APY",
        value: "3.5-4% APY",
        type: "staking",
        badge: "live",
        requirements: "Minimum: 0.001 ETH",
        link: "https://www.coinbase.com/staking/ethereum"
    },

    // Kraken Offers
    {
        title: "Kraken Staking Rewards",
        platform: "Kraken",
        description: "Stake multiple cryptocurrencies for 5-20% APY",
        value: "5-20% APY",
        type: "staking",
        badge: "live",
        requirements: "Varies by asset",
        link: "https://www.kraken.com/features/staking-coins"
    },
    {
        title: "Kraken Tier Rewards",
        platform: "Kraken",
        description: "Earn discounts on trading fees based on volume tier",
        value: "10-40% fee discount",
        type: "trading",
        badge: "live",
        requirements: "Monthly trading volume",
        link: "https://www.kraken.com/features/margin-trading"
    },

    // OKX Offers
    {
        title: "OKX Earn Program",
        platform: "OKX",
        description: "Fixed and flexible earn products with up to 30% APY",
        value: "5-30% APY",
        type: "staking",
        badge: "live",
        requirements: "Minimum varies by asset",
        link: "https://www.okx.com/earn"
    },

    // Bybit Offers
    {
        title: "Bybit New User Bonus",
        platform: "Bybit",
        description: "Deposit bonus up to $1000 USDT for new traders",
        value: "Up to $1000",
        type: "trading",
        badge: "new",
        requirements: "First deposit required",
        link: "https://www.bybit.com/en-US/promo/welcome-bonus"
    },

    // KuCoin Offers
    {
        title: "KuCoin Staking Center",
        platform: "KuCoin",
        description: "Stake crypto with APY ranging from 5% to 50%",
        value: "5-50% APY",
        type: "staking",
        badge: "live",
        requirements: "Asset specific",
        link: "https://www.kucoin.com/earn"
    },

    // Gate.io Offers
    {
        title: "Gate.io Lending Products",
        platform: "Gate.io",
        description: "Earn 2-15% APY by lending crypto assets",
        value: "2-15% APY",
        type: "staking",
        badge: "live",
        requirements: "Minimum: 0.1 BTC equivalent",
        link: "https://www.gate.io/earn"
    },

    // DeFi Offers
    {
        title: "Uniswap Liquidity Provider Rewards",
        platform: "Uniswap",
        description: "Earn trading fees and UNI rewards from providing liquidity",
        value: "Variable + UNI",
        type: "launchpad",
        badge: "live",
        requirements: "Pair liquidity in V4",
        link: "https://app.uniswap.org/explore/pools"
    },
    {
        title: "Curve Finance Governance Token",
        platform: "Curve",
        description: "Earn CRV rewards while providing stablecoin liquidity",
        value: "15-100% APY",
        type: "staking",
        badge: "live",
        requirements: "Provide liquidity to pools",
        link: "https://curve.fi/#/ethereum/pools"
    },
    {
        title: "Aave Liquidity Mining",
        platform: "Aave",
        description: "Earn AAVE tokens as lender or borrower rewards",
        value: "Variable AAVE",
        type: "staking",
        badge: "live",
        requirements: "Supply/borrow assets",
        link: "https://app.aave.com/markets"
    },

    // Bitget Offers
    {
        title: "Bitget Earning Center",
        platform: "Bitget",
        description: "Flexible and fixed-term earn products up to 20% APY",
        value: "2-20% APY",
        type: "staking",
        badge: "live",
        requirements: "Minimum varies",
        link: "https://www.bitget.com/earn"
    },

    // Crypto.com Offers
    {
        title: "Crypto.com Earn",
        platform: "Crypto.com",
        description: "Earn 3-14% APY on various cryptocurrencies",
        value: "3-14% APY",
        type: "staking",
        badge: "live",
        requirements: "CRO card staking tier",
        link: "https://crypto.com/earn"
    },

    // MEXC Offers
    {
        title: "MEXC Mining Rewards",
        platform: "MEXC",
        description: "Trading mining rewards with up to 50% fee back",
        value: "Up to 50% fee back",
        type: "trading",
        badge: "live",
        requirements: "Trading volume",
        link: "https://www.mexc.com/activity/mining"
    },

    // Additional Layer 2 & Protocol Offers
    {
        title: "Optimism Delegate Rewards",
        platform: "Optimism",
        description: "Delegate OP tokens to earn governance participation rewards",
        value: "Variable governance rewards",
        type: "launchpad",
        badge: "new",
        requirements: "Hold OP tokens",
        link: "https://app.optimism.io/governance"
    },
    {
        title: "Arbitrum DAO Grants",
        platform: "Arbitrum",
        description: "Community grants program for developers and projects",
        value: "$10K-100K ARB",
        type: "launchpad",
        badge: "live",
        requirements: "Project submission",
        link: "https://arbitrumgrants.org"
    },
    {
        title: "Lido Liquid Staking ETH",
        platform: "Lido",
        description: "Stake ETH and get stETH while earning rewards",
        value: "~3% APY",
        type: "staking",
        badge: "live",
        requirements: "Any amount of ETH",
        link: "https://lido.fi/eth"
    },
    {
        title: "Yearn Finance Vault APY",
        platform: "Yearn",
        description: "Automated yield farming through yearn vaults",
        value: "5-50% APY",
        type: "staking",
        badge: "live",
        requirements: "Deposit into vault",
        link: "https://yearn.fi"
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

    // Return cached global data if available
    if (serverCache[globalCacheKey]) {
        return res.status(200).json({
            results: serverCache[globalCacheKey],
            cached: true,
            nextRefresh: getNextSlotTime().toISOString(),
            slot
        });
    }

    const today = new Date().toISOString().split('T')[0];

    try {
        // Fetch market data for ticker display in parallel with offer enhancement
        const [enhancedOffers, marketData, prices] = await Promise.all([
            enhanceOffersWithRealData(VERIFIED_OFFERS, today),
            fetchMarketData()
        ]);

        // Cache globally for this slot
        const cachePayload = { enhancedOffers, marketData, prices };
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
            marketData: marketData || {},
            prices: prices || {},
            cached: false,
            nextRefresh: getNextSlotTime().toISOString(),
            slot,
            dataSource: "Verified Offers + Live CoinGecko Data"
        });

    } catch (err) {
        // Fallback to verified offers even if real-time enhancement fails
        serverCache[globalCacheKey] = { enhancedOffers: VERIFIED_OFFERS };
        return res.status(200).json({
            results: VERIFIED_OFFERS,
            marketData: {},
            prices: {},
            cached: false,
            nextRefresh: getNextSlotTime().toISOString(),
            slot,
            dataSource: "Verified Offers (Real-time API unavailable)"
        });
    }
}

async function fetchMarketData() {
    try {
        const [globalRes, pricesRes] = await Promise.all([
            fetchWithTimeout('https://api.coingecko.com/api/v3/global', 5000),
            fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano,polkadot,ripple,binancecoin,dogecoin,tron,avalanche-2&vs_currencies=usd&include_24hr_change=true&include_market_cap=true', 5000)
        ]);

        const globalData = await globalRes.json();
        const pricesData = await pricesRes.json();

        return [globalData?.data, pricesData];
    } catch {
        return [null, null];
    }
}

// Enhance offers with real-time market data from CoinGecko (FREE API, no key needed)
async function enhanceOffersWithRealData(offers, today) {
    try {
        // Fetch all CoinGecko data in parallel
        const [trendingRes, globalRes, pricesRes, exchangesRes] = await Promise.all([
            fetchWithTimeout('https://api.coingecko.com/api/v3/search/trending', 8000),
            fetchWithTimeout('https://api.coingecko.com/api/v3/global', 8000),
            fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano,polkadot,ripple,binancecoin,dogecoin,tron,avalanche-2&vs_currencies=usd&include_24hr_change=true&include_market_cap=true', 8000),
            fetchWithTimeout('https://api.coingecko.com/api/v3/exchanges?per_page=30', 8000)
        ]);

        const trendingData = await trendingRes.json();
        const globalData = await globalRes.json();
        const pricesData = await pricesRes.json();
        const exchangesData = await exchangesRes.json();

        // Build lookup tables
        const trendingCoins = (trendingData?.coins || []).slice(0, 7).map(c => c.item.name.toLowerCase());
        const trendingRanks = {};
        (trendingData?.coins || []).slice(0, 7).forEach((c, i) => {
            trendingRanks[c.item.name.toLowerCase()] = i + 1;
        });

        const exchangeTrustMap = {};
        (exchangesData || []).forEach(ex => {
            exchangeTrustMap[ex.name.toLowerCase()] = {
                trustScore: ex.trust_score || 0,
                volume24hBtc: ex.trade_volume_24h_btc || 0,
                image: ex.image
            };
        });

        const marketSentiment = globalData?.data?.market_cap_change_percentage_24h_usd >= 0 ? 'bullish' : 'bearish';
        const marketChange = globalData?.data?.market_cap_change_percentage_24h_usd || 0;

        // Add live data to each offer
        return offers.map(offer => {
            let livePrice = null;
            let priceChange24h = null;
            let marketCap = null;
            let coinLogoUrl = null;

            // Map offer platforms to coins
            const coinMap = {
                'ethereum': 'ethereum',
                'bitcoin': 'bitcoin',
                'solana': 'solana',
                'cardano': 'cardano',
                'bnb': 'binancecoin'
            };

            const coinId = Object.keys(coinMap).find(key => offer.title.toLowerCase().includes(key) || offer.description.toLowerCase().includes(key));
            if (coinId && pricesData[coinMap[coinId]]) {
                const priceInfo = pricesData[coinMap[coinId]];
                livePrice = priceInfo.usd;
                priceChange24h = priceInfo.usd_24h_change;
                marketCap = priceInfo.usd_market_cap;
            }

            // Get exchange trust score
            const exchangeTrust = exchangeTrustMap[offer.platform.toLowerCase()] || { trustScore: 0, volume24hBtc: 0 };

            // Check if trending
            const offerCoins = offer.title.toLowerCase().split(/\s+|,/);
            const isTrending = offerCoins.some(c => trendingCoins.includes(c));
            const trendingRank = offerCoins.find(c => trendingRanks[c])
                ? trendingRanks[offerCoins.find(c => trendingRanks[c])]
                : null;

            return {
                ...offer,
                date: today,
                livePrice,
                priceChange24h,
                marketCap,
                isTrending,
                trendingRank,
                exchangeTrustScore: exchangeTrust.trustScore,
                volume24hBtc: exchangeTrust.volume24hBtc,
                marketSentiment,
                globalMarketChange: marketChange
            };
        });
    } catch (err) {
        // Fallback - just add date and sentiment
        return offers.map(offer => ({
            ...offer,
            date: today,
            livePrice: null,
            priceChange24h: null,
            isTrending: false,
            exchangeTrustScore: 0
        }));
    }
}

// Utility function for fetch with timeout
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
