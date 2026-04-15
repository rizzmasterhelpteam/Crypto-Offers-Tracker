# Crypto Offers Tracker - Complete Workflow

## 1️⃣ USER VISITS APP (index.html)

```
Browser loads → DOMContentLoaded event
    ├─ initPlatformChips() 
    │  └─ Creates filter chips (Binance, Coinbase, Kraken, etc.)
    ├─ initAds()
    │  └─ Loads Google AdSense
    └─ handleSearch(true) ← Initial load
```

---

## 2️⃣ FETCH OFFERS & MARKET DATA

### Frontend → Backend Flow

```
POST /api/search
  ↓
Backend (api/search.js)
  ├─ Check server cache (global_slot_X)
  │  └─ 12-hour cache per UTC slot
  └─ If cache miss:
     ├─ Parallel CoinGecko API calls:
     │  ├─ /global (market cap, volume, dominance, sentiment)
     │  ├─ /search/trending (top 7 trending coins)
     │  ├─ /simple/price (live prices + 24h %)
     │  └─ /exchanges (trust scores)
     │
     ├─ Enhance 20 VERIFIED_OFFERS with:
     │  ├─ livePrice (e.g., BTC $74,144)
     │  ├─ priceChange24h (e.g., +0.43%)
     │  ├─ isTrending (true/false)
     │  ├─ trendingRank (1-7 if trending)
     │  └─ exchangeTrustScore (1-10)
     │
     └─ Cache result + return JSON
```

### API Response Format

```json
{
  "results": [
    {
      "title": "Binance USDT Staking",
      "platform": "Binance",
      "description": "Earn up to 10% APY on USDT staking",
      "value": "Variable APY",
      "type": "staking",
      "badge": "live",
      "requirements": "Minimum: 50 USDT",
      "link": "https://www.binance.com/en/activity/earn",
      "livePrice": 74144,
      "priceChange24h": 0.43,
      "isTrending": true,
      "trendingRank": 1,
      "exchangeTrustScore": 10
    }
    // ... 19 more offers
  ],
  "marketData": {
    "total_market_cap": { "usd": 2594871108019.58 },
    "market_cap_change_percentage_24h_usd": -0.4325,
    "market_cap_percentage": { "btc": 57.11 }
  },
  "prices": {
    "bitcoin": { "usd": 74144, "usd_24h_change": 0.43 },
    "ethereum": { "usd": 2349.58, "usd_24h_change": 0.427 }
  },
  "cached": false,
  "nextRefresh": "2026-04-16T06:00:00.000Z"
}
```

---

## 3️⃣ DISPLAY MARKET WIDGETS

### Market Ticker Bar
```
📊 Market Cap: $2.59T | 📈 24h Vol: $99B | 
Bitcoin: $74,144 📈 +0.43% | Ethereum: $2,349 📉 -0.57% | BTC Dom: 57.1%
```
- Updates every page load
- No caching (always fresh)
- Shows global market sentiment

### Market Sentiment Banner
```
IF market up (+):  🟢 "Crypto market up 2.3% today — Great time to earn!"
IF market down (-): 🔴 "Crypto market down 1.8% — Check staking for stability!"
```
- Dynamic border color (green/red)
- Updates every 12 hours

### Trending Now Section
```
🔥 TRENDING NOW

[🔥 #1 Bitcoin] [🔥 #2 Ethereum] [🔥 #3 Solana] 
[Price: $74,144] [Price: $2,349] [Price: $84.83]

← Clickable chips to filter offers
```
- Top 7 trending coins from CoinGecko
- Shows live prices
- Click to filter offers by platform

---

## 4️⃣ FILTER & DISPLAY OFFERS

### User Selects
```
Platform Filter: All, Binance, Coinbase, Kraken, OKX, etc.
Type Filter: All Types, Airdrops, Staking, Trading, Learn & Earn, Launchpads
```

### Filtering Logic
```javascript
filtered = globalOffersList
  .filter(o => !selectedPlatform || o.platform === selectedPlatform)
  .filter(o => searchType === 'all' || o.type === searchType)
```

### Display Results
```
Grid Layout:
├─ 2 offer cards
├─ Advertisement
├─ 3 offer cards
├─ Advertisement
└─ Remaining cards
```

---

## 5️⃣ OFFER CARD DISPLAY

### Card Structure
```
┌────────────────────────────────┐
│ 🔥 #1 TRENDING (pulsing)      │ ← Badge (dynamic)
│                                │
│ Binance USDT Staking           │ ← Title
│ Earn up to 10% APY on USDT     │ ← Description
│ 📋 Minimum: 50 USDT            │ ← Requirements
│                                │
│ 🏢 Binance                     │ ← Platform
│ 💰 Variable APY                │ ← Value/Reward
│ 📈 $2,349 ↑ +0.43%             │ ← LIVE PRICE
│ ⭐ Trust: 10/10                │ ← TRUST SCORE
│ 📅 2026-04-15                  │ ← Date
│ 🔗 binance.com                 │ ← Domain
│                                │
│ [🔗 View Real Offer] [📤]      │ ← Actions
└────────────────────────────────┘

Badges:
  🟢 LIVE   - Currently active
  ✨ NEW    - Recently added
  ⏰ ENDING - Expiring soon
  🔥 TRENDING - In top 7 trending coins
```

### Card Interactions
```
"View Real Offer" Button → window.open(link) → Official exchange page
"Share" Button → navigator.share() or copy URL
Click Card → No action (info only)
```

---

## 6️⃣ CACHING STRATEGY

### 12-Hour Slot System
```
Slot = Math.floor(Date.now() / (12 * 60 * 60 * 1000))

Timeline:
├─ Slot 0: 00:00 UTC → 12:00 UTC (Cache expires at 12:00)
├─ Slot 1: 12:00 UTC → 00:00 UTC next day (Cache expires at 00:00)
└─ Slot 2: Next day starts...

Refresh Points: 00:00 UTC and 12:00 UTC (Twice daily globally)
```

### Cache Locations
```
Server-side (api/search.js):
  - In-memory: serverCache[global_slot_X]
  - Shared across all users in that 12h window
  - Auto-cleanup of old slots

Client-side (index.html):
  - localStorage: crypto_v3_global_slot_X
  - Per-browser cache
  - Auto-cleanup of stale slots
```

---

## 7️⃣ CHARTS WORKFLOW (charts.html)

### Charts Page Display
```
Top Monthly Performers Table:
  Rank  │ Name      │ 24h Change │ %
  1     │ Bitcoin   │ ███████    │ 45%
  2     │ Ethereum  │ █████      │ 32%
  3     │ Solana    │ ███        │ 18%

Top Yearly Performers Table:
  Rank  │ Name      │ YTD Change │ %
  1     │ Bitcoin   │ ██████████ │ 180%
  2     │ Ethereum  │ ████████   │ 120%
  3     │ Solana    │ ██████     │ 95%

Upcoming Projects & Airdrops:
  • Project X  🚀 Coming Soon
  • Project Y  🔜 Q2 2026
  • Project Z  📅 TBA
```

### Chart Update Strategy
```
⚠️ IMPORTANT: Charts are STATIC/MANUAL

- NOT connected to API
- Updated weekly by admin
- Shows historical context (not real-time)
- Different from live offers (which ARE real-time)
```

---

## 8️⃣ DATA FLOW SUMMARY

```
CoinGecko API (Free, No Key)
├─ /global → Market sentiment banner
├─ /search/trending → Trending section + badges
├─ /simple/price → Live prices on cards
└─ /exchanges → Trust score badges

VERIFIED_OFFERS (Hardcoded, 20 total)
├─ Binance (2 offers)
├─ Coinbase (2 offers)
├─ Kraken (2 offers)
├─ OKX (1 offer)
├─ Bybit (1 offer)
├─ KuCoin (1 offer)
├─ Gate.io (1 offer)
├─ Bitget (1 offer)
├─ Crypto.com (1 offer)
├─ MEXC (1 offer)
├─ DeFi Protocols (Uniswap, Curve, Aave, Lido, Yearn)
└─ Layer 2s (Optimism, Arbitrum)

Combined & Enhanced
└─ Display to user with live context
```

---

## 9️⃣ VERIFIED OFFERS DATABASE (20 Offers)

| # | Platform | Offer | Type | APY/Value |
|---|----------|-------|------|-----------|
| 1 | Binance | USDT Staking | Staking | 10% APY |
| 2 | Binance | Referral Commission | Trading | 20% |
| 3 | Coinbase | Learn & Earn | Learn | $10-50 |
| 4 | Coinbase | ETH Staking | Staking | 3.5-4% |
| 5 | Kraken | Multi-Asset Staking | Staking | 5-20% |
| 6 | Kraken | Tier Rewards | Trading | 10-40% |
| 7 | OKX | Earn Program | Staking | 5-30% |
| 8 | Bybit | New User Bonus | Trading | $1000 |
| 9 | KuCoin | Staking Center | Staking | 5-50% |
| 10 | Gate.io | Lending Products | Staking | 2-15% |
| 11 | Uniswap | Liquidity Rewards | Launchpad | Variable |
| 12 | Curve | Governance Rewards | Staking | 15-100% |
| 13 | Aave | Liquidity Mining | Staking | Variable |
| 14 | Bitget | Earning Center | Staking | 2-20% |
| 15 | Crypto.com | Earn | Staking | 3-14% |
| 16 | MEXC | Mining Rewards | Trading | 50% fee back |
| 17 | Optimism | Delegate Rewards | Launchpad | Variable |
| 18 | Arbitrum | DAO Grants | Launchpad | $10K-100K |
| 19 | Lido | Liquid Staking | Staking | ~3% |
| 20 | Yearn | Vault APY | Staking | 5-50% |

---

## 🔟 KEY STATISTICS

```
Verified Offers:     20 real, authenticated offers
CoinGecko APIs:      5 endpoints (parallel fetch)
Cache Duration:      12 hours (2 slots per day)
Update Frequency:    Twice daily (00:00 UTC & 12:00 UTC)
Trending Coins:      Top 7 from CoinGecko
Total Platforms:     22+ exchanges + DeFi protocols
Mobile Responsive:   Yes
Ad Integration:      Google AdSense
API Keys Required:   None (free CoinGecko public API)
```

---

## 🔗 FILE STRUCTURE

```
├─ index.html ..................... Main offers page (55KB)
├─ charts.html .................... Market charts (17KB)
├─ api/search.js .................. Offers API backend
├─ api/daily-post.js .............. Blog post API
├─ blog/style.css ................. Shared styles
├─ assets/ ........................ Images, logos
└─ WORKFLOW.md .................... This file
```
