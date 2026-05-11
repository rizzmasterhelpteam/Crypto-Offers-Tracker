import fs from 'fs';
import path from 'path';

const serverCache = {};
const REGISTRY_PATH = path.join(process.cwd(), 'admin', 'offers.json');
const LIVE_VERIFICATION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const ENDING_WINDOW_MS = 72 * 60 * 60 * 1000;

const VALID_AUDIENCES = new Set(['retail', 'builder']);
const VALID_STATUSES = new Set(['verified', 'expired', 'needs_review', 'draft']);
const CATEGORY_LABELS = {
    staking: 'Staking & Earn',
    trading: 'Trading & Rewards',
    learn: 'Learn & Earn',
    defi: 'DeFi Yield',
    builder_program: 'Builder Programs'
};

function getCurrentSlot() {
    return Math.floor(Date.now() / (12 * 60 * 60 * 1000));
}

function getNextSlotTime() {
    return new Date((getCurrentSlot() + 1) * 12 * 60 * 60 * 1000);
}

function readOfferRegistry() {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const registry = JSON.parse(raw);
    return validateOfferRegistry(registry);
}

function validateOfferRegistry(registry) {
    const errors = [];

    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
        throw new Error('Offer registry must be a JSON object.');
    }

    if (!isValidDate(registry.updatedAt)) {
        errors.push('updatedAt must be a valid ISO datetime.');
    }

    if (!Array.isArray(registry.offers) || registry.offers.length === 0) {
        errors.push('offers must be a non-empty array.');
    }

    const seenIds = new Set();
    const offers = Array.isArray(registry.offers) ? registry.offers : [];

    offers.forEach((offer, index) => {
        const prefix = `offers[${index}]`;

        if (!offer || typeof offer !== 'object' || Array.isArray(offer)) {
            errors.push(`${prefix} must be an object.`);
            return;
        }

        requireNonEmptyString(offer.id, `${prefix}.id`, errors);
        requireNonEmptyString(offer.title, `${prefix}.title`, errors);
        requireNonEmptyString(offer.platform, `${prefix}.platform`, errors);
        requireNonEmptyString(offer.category, `${prefix}.category`, errors);
        requireNonEmptyString(offer.description, `${prefix}.description`, errors);
        requireNonEmptyString(offer.valueLabel, `${prefix}.valueLabel`, errors);
        requireNonEmptyString(offer.link, `${prefix}.link`, errors);
        requireNonEmptyString(offer.offerKind, `${prefix}.offerKind`, errors);
        requireNonEmptyString(offer.audience, `${prefix}.audience`, errors);
        requireNonEmptyString(offer.verificationStatus, `${prefix}.verificationStatus`, errors);
        requireNonEmptyString(offer.reviewBy, `${prefix}.reviewBy`, errors);

        if (offer.id) {
            if (seenIds.has(offer.id)) {
                errors.push(`${prefix}.id must be unique. Duplicate: ${offer.id}`);
            }
            seenIds.add(offer.id);
        }

        if (offer.audience && !VALID_AUDIENCES.has(offer.audience)) {
            errors.push(`${prefix}.audience must be one of: ${Array.from(VALID_AUDIENCES).join(', ')}`);
        }

        if (offer.verificationStatus && !VALID_STATUSES.has(offer.verificationStatus)) {
            errors.push(`${prefix}.verificationStatus must be one of: ${Array.from(VALID_STATUSES).join(', ')}`);
        }

        if (typeof offer.isEvergreen !== 'boolean') {
            errors.push(`${prefix}.isEvergreen must be a boolean.`);
        }

        const hasRequirements = typeof offer.requirements === 'string' && offer.requirements.trim() !== '';
        const hasNotes = typeof offer.notes === 'string' && offer.notes.trim() !== '';
        if (!hasRequirements && !hasNotes) {
            errors.push(`${prefix} must include notes or requirements.`);
        }

        if (offer.link && !isValidHttpsUrl(offer.link)) {
            errors.push(`${prefix}.link must be a valid https URL.`);
        }

        if (!isValidDate(offer.reviewBy)) {
            errors.push(`${prefix}.reviewBy must be a valid ISO datetime.`);
        }

        const requiresVerificationMetadata = offer.verificationStatus && offer.verificationStatus !== 'draft';
        if (requiresVerificationMetadata) {
            requireNonEmptyString(offer.lastVerifiedAt, `${prefix}.lastVerifiedAt`, errors);
            requireNonEmptyString(offer.verifiedFrom, `${prefix}.verifiedFrom`, errors);

            if (!isValidDate(offer.lastVerifiedAt)) {
                errors.push(`${prefix}.lastVerifiedAt must be a valid ISO datetime.`);
            }

            if (offer.verifiedFrom && !isValidHttpsUrl(offer.verifiedFrom)) {
                errors.push(`${prefix}.verifiedFrom must be a valid https URL.`);
            }
        }

        if (offer.expiresAt != null && offer.expiresAt !== '') {
            if (!isValidDate(offer.expiresAt)) {
                errors.push(`${prefix}.expiresAt must be a valid ISO datetime when provided.`);
            }
        }

        if (offer.verificationStatus === 'expired' && !offer.expiresAt) {
            errors.push(`${prefix}.expiresAt is required when verificationStatus is expired.`);
        }

        if (offer.coinId && !(typeof offer.coinName === 'string' && offer.coinName.trim() !== '')) {
            errors.push(`${prefix}.coinName is required when coinId is provided.`);
        }
    });

    if (errors.length > 0) {
        throw new Error(`Invalid offer registry:\n- ${errors.join('\n- ')}`);
    }

    return registry;
}

function requireNonEmptyString(value, label, errors) {
    if (!(typeof value === 'string' && value.trim() !== '')) {
        errors.push(`${label} must be a non-empty string.`);
    }
}

function isValidDate(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isValidHttpsUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:';
    } catch (err) {
        return false;
    }
}

function getPublishedRetailOffers(offers) {
    const now = Date.now();

    return offers.filter(offer => {
        if (offer.audience !== 'retail') return false;
        if (offer.verificationStatus !== 'verified') return false;
        if (!offer.lastVerifiedAt || !offer.verifiedFrom) return false;
        if (offer.expiresAt && Date.parse(offer.expiresAt) <= now) return false;
        return true;
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    let registry;
    let publishedOffers;

    try {
        registry = readOfferRegistry();
        publishedOffers = getPublishedRetailOffers(registry.offers);
    } catch (err) {
        return res.status(500).json({ error: `Offer registry error: ${err.message}` });
    }

    const slot = getCurrentSlot();
    const registryVersion = sanitizeCacheComponent(registry.updatedAt);
    const globalCacheKey = `global_slot_${slot}_${registryVersion}`;

    const cacheMaxAge = 12 * 60 * 60;
    res.setHeader('Cache-Control', `public, s-maxage=${cacheMaxAge}, stale-while-revalidate=${cacheMaxAge * 2}`);

    if (serverCache[globalCacheKey]) {
        const cached = serverCache[globalCacheKey];
        return res.status(200).json({
            results: cached.enhancedOffers,
            marketData: cached.marketData || {},
            prices: cached.prices || {},
            trendingCoins: cached.trendingCoins || [],
            cached: true,
            nextRefresh: getNextSlotTime().toISOString(),
            registryUpdatedAt: registry.updatedAt,
            slot,
            dataSource: 'Verified Offer Registry + Live CoinGecko Data (Cached)'
        });
    }

    try {
        const liveData = await fetchAllCoinGeckoData(publishedOffers);
        const enhancedOffers = buildEnhancedOffers(publishedOffers, liveData);
        const cachePayload = {
            enhancedOffers,
            marketData: liveData.marketData,
            prices: liveData.prices,
            trendingCoins: liveData.trendingCoins
        };
        serverCache[globalCacheKey] = cachePayload;

        const currentSlot = getCurrentSlot();
        Object.keys(serverCache).forEach(key => {
            if (!key.startsWith('global_slot_')) return;
            const parts = key.split('_');
            const keySlot = parseInt(parts[2], 10);
            if (Number.isFinite(keySlot) && keySlot < currentSlot) {
                delete serverCache[key];
            }
        });

        return res.status(200).json({
            results: enhancedOffers,
            marketData: liveData.marketData || {},
            prices: liveData.prices || {},
            trendingCoins: liveData.trendingCoins || [],
            cached: false,
            nextRefresh: getNextSlotTime().toISOString(),
            registryUpdatedAt: registry.updatedAt,
            slot,
            dataSource: 'Verified Offer Registry + Live CoinGecko Data'
        });
    } catch (err) {
        const liveData = getEmptyLiveData();
        const fallbackOffers = buildEnhancedOffers(publishedOffers, liveData);
        serverCache[globalCacheKey] = {
            enhancedOffers: fallbackOffers,
            marketData: {},
            prices: {},
            trendingCoins: []
        };

        return res.status(200).json({
            results: fallbackOffers,
            marketData: {},
            prices: {},
            trendingCoins: [],
            cached: false,
            nextRefresh: getNextSlotTime().toISOString(),
            registryUpdatedAt: registry.updatedAt,
            slot,
            dataSource: 'Verified Offer Registry (Live market API unavailable)'
        });
    }
}

function sanitizeCacheComponent(value) {
    return String(value).replace(/[^a-zA-Z0-9]/g, '');
}

async function fetchAllCoinGeckoData(offers) {
    const coinIds = [...new Set(offers.map(offer => offer.coinId).filter(Boolean))].join(',');
    const priceUrl = coinIds
        ? `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
        : null;

    const requests = [
        fetchWithTimeout('https://api.coingecko.com/api/v3/search/trending', 8000),
        fetchWithTimeout('https://api.coingecko.com/api/v3/global', 8000),
        priceUrl ? fetchWithTimeout(priceUrl, 8000) : Promise.resolve(null),
        fetchWithTimeout('https://api.coingecko.com/api/v3/exchanges?per_page=50', 8000)
    ];

    const [trendingRes, globalRes, pricesRes, exchangesRes] = await Promise.allSettled(requests);
    const trendingData = trendingRes.status === 'fulfilled' ? await safeJson(trendingRes.value, {}) : {};
    const globalData = globalRes.status === 'fulfilled' ? await safeJson(globalRes.value, {}) : {};
    const pricesData = pricesRes.status === 'fulfilled' && pricesRes.value ? await safeJson(pricesRes.value, {}) : {};
    const exchangesData = exchangesRes.status === 'fulfilled' ? await safeJson(exchangesRes.value, []) : [];

    const trendingCoins = (trendingData?.coins || []).slice(0, 7).map((coin, index) => ({
        id: coin.item.id,
        name: coin.item.name,
        symbol: coin.item.symbol,
        rank: index + 1,
        price: coin.item.data?.price || null,
        change24h: coin.item.data?.price_change_percentage_24h?.usd || null,
        sparkline: coin.item.data?.sparkline || null
    }));

    const trendingById = {};
    const trendingByName = {};
    trendingCoins.forEach(coin => {
        trendingById[coin.id.toLowerCase()] = coin;
        trendingByName[coin.name.toLowerCase()] = coin;
        trendingByName[coin.symbol.toLowerCase()] = coin;
    });

    const exchangeTrustMap = {};
    (Array.isArray(exchangesData) ? exchangesData : []).forEach(exchange => {
        exchangeTrustMap[exchange.name.toLowerCase()] = {
            trustScore: exchange.trust_score || 0,
            volume24hBtc: Math.round(exchange.trade_volume_24h_btc || 0)
        };
    });

    return {
        trendingCoins,
        trendingById,
        trendingByName,
        exchangeTrustMap,
        marketData: globalData?.data || {},
        prices: pricesData || {}
    };
}

async function safeJson(response, fallbackValue) {
    try {
        return await response.json();
    } catch (err) {
        return fallbackValue;
    }
}

function getEmptyLiveData() {
    return {
        trendingCoins: [],
        trendingById: {},
        trendingByName: {},
        exchangeTrustMap: {},
        marketData: {},
        prices: {}
    };
}

function buildEnhancedOffers(offers, liveData) {
    const now = Date.now();
    const { trendingById, trendingByName, exchangeTrustMap, prices } = liveData;

    return offers.map(offer => {
        const priceInfo = offer.coinId && prices[offer.coinId] ? prices[offer.coinId] : null;
        const livePrice = priceInfo?.usd ?? null;
        const priceChange24h = priceInfo?.usd_24h_change ?? null;

        const trendingMatch =
            (offer.coinId && trendingById[offer.coinId.toLowerCase()]) ||
            (offer.coinName && trendingByName[offer.coinName.toLowerCase()]);
        const isTrending = Boolean(trendingMatch);
        const trendingRank = trendingMatch?.rank || null;

        const exchangeTrust = exchangeTrustMap[offer.platform.toLowerCase()] || { trustScore: 0, volume24hBtc: 0 };
        const lastVerifiedTime = Date.parse(offer.lastVerifiedAt);
        const expiresAtTime = offer.expiresAt ? Date.parse(offer.expiresAt) : null;

        let badge = 'verified';
        if (expiresAtTime && expiresAtTime > now && expiresAtTime - now <= ENDING_WINDOW_MS) {
            badge = 'ending';
        } else if (now - lastVerifiedTime <= LIVE_VERIFICATION_WINDOW_MS) {
            badge = 'live';
        } else if (offer.isEvergreen) {
            badge = 'evergreen';
        }

        return {
            id: offer.id,
            title: offer.title,
            platform: offer.platform,
            category: offer.category,
            categoryLabel: CATEGORY_LABELS[offer.category] || formatCategoryLabel(offer.category),
            description: offer.description,
            valueLabel: offer.valueLabel,
            offerKind: offer.offerKind,
            badge,
            requirements: offer.requirements,
            notes: offer.notes,
            link: offer.link,
            coinId: offer.coinId || null,
            coinName: offer.coinName || null,
            lastVerifiedAt: offer.lastVerifiedAt,
            verifiedFrom: offer.verifiedFrom,
            verificationStatus: offer.verificationStatus,
            isEvergreen: offer.isEvergreen,
            expiresAt: offer.expiresAt || null,
            reviewBy: offer.reviewBy,
            livePrice,
            priceChange24h,
            isTrending,
            trendingRank,
            exchangeTrustScore: exchangeTrust.trustScore,
            volume24hBtc: exchangeTrust.volume24hBtc
        };
    });
}

function formatCategoryLabel(category) {
    return String(category)
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

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
