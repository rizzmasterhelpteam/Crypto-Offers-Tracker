# Crypto Offers Tracker - Offer Registry Workflow

## 1. Homepage Data Model

The homepage no longer uses a hardcoded offer list inside `api/search.js`.

The source of truth is `admin/offers.json`.

Each record includes:

- `id`, `title`, `platform`, `category`, `description`, `valueLabel`, `link`
- `audience`, `offerKind`, `verificationStatus`
- `lastVerifiedAt`, `verifiedFrom`, `reviewBy`
- `isEvergreen`, `expiresAt`
- `requirements` and/or `notes`
- `coinId`, `coinName` when market enrichment is useful

This separates editorial verification from live market data.

## 2. Publish Rules

`api/search.js` loads the registry and validates it before serving any offer data.

The homepage only publishes records that are:

- `audience === "retail"`
- `verificationStatus === "verified"`
- not expired
- carrying `lastVerifiedAt` and `verifiedFrom`

Records for builders, governance, expired programs, drafts, or malformed entries stay out of the homepage response.

## 3. API Flow

Request path:

```text
GET /api/search
  -> read admin/offers.json
  -> validate registry structure
  -> filter to published retail offers
  -> fetch CoinGecko market context
  -> enrich offers with prices, trending flags, and exchange trust score
  -> cache response for the current 12-hour slot
```

Response fields now include:

- offer verification metadata
- `lastVerifiedAt`
- `verifiedFrom`
- `verificationStatus`
- `isEvergreen`
- `expiresAt` when present
- CoinGecko market context such as `livePrice`, `priceChange24h`, `isTrending`, and `exchangeTrustScore`

CoinGecko does not decide whether an offer is valid. It only adds market context.

## 4. Homepage Rendering

`index.html` renders the verified API response and does not synthesize freshness.

Current behavior:

- category filter options are derived from published registry data
- cards show `last verified` instead of a fake current date
- badges are rule-based:
  - recent verification -> `LIVE`
  - evergreen verified record -> `EVERGREEN`
  - verified record outside the live window -> `VERIFIED`
  - near expiry -> `ENDING`
- trending coins can temporarily surface a `TRENDING` badge, but verification status still comes from the registry

The homepage is retail-only. Builder grants and governance programs are kept out even if they remain in the registry for tracking.

## 5. Market Widgets and Caching

The ticker, sentiment banner, and trending section still use CoinGecko data.

- cache window: 12 hours
- refresh cadence: twice daily
- cache applies to market context and enriched results
- homepage copy must not imply that every offer was live-scraped at that moment

Client cache key namespace:

- `crypto_v4_verified_offers_slot_<slot>`

Older cache namespaces are cleaned up in the browser.

## 6. Maintenance Workflow

Before publishing registry changes, run:

```powershell
node scripts/validate-offers.js
```

The validator fails fast on:

- malformed JSON structure
- duplicate IDs
- invalid URLs
- missing required fields
- invalid verification metadata
- expired records without `expiresAt`

If validation passes, deploy the repo changes. The homepage will then serve the updated verified registry on the next deployment.
