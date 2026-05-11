const fs = require('fs');
const config = require('./lib/config');

const VALID_AUDIENCES = new Set(['retail', 'builder']);
const VALID_STATUSES = new Set(['verified', 'expired', 'needs_review', 'draft']);

function main() {
    const registry = JSON.parse(fs.readFileSync(config.OFFERS_PATH, 'utf8'));
    const summary = validateOfferRegistry(registry);

    const publishedRetailOffers = summary.offers.filter(offer =>
        offer.audience === 'retail' &&
        offer.verificationStatus === 'verified' &&
        (!offer.expiresAt || Date.parse(offer.expiresAt) > Date.now())
    );

    const countsByCategory = publishedRetailOffers.reduce((acc, offer) => {
        acc[offer.category] = (acc[offer.category] || 0) + 1;
        return acc;
    }, {});

    console.log('[Offers] Registry is valid.');
    console.log(`[Offers] Updated at: ${registry.updatedAt}`);
    console.log(`[Offers] Total records: ${summary.offers.length}`);
    console.log(`[Offers] Published retail offers: ${publishedRetailOffers.length}`);
    console.log(`[Offers] Published categories: ${Object.keys(countsByCategory).map(key => `${key}=${countsByCategory[key]}`).join(', ')}`);
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
        requireNonEmptyString(offer.audience, `${prefix}.audience`, errors);
        requireNonEmptyString(offer.offerKind, `${prefix}.offerKind`, errors);
        requireNonEmptyString(offer.verificationStatus, `${prefix}.verificationStatus`, errors);
        requireNonEmptyString(offer.reviewBy, `${prefix}.reviewBy`, errors);

        if (offer.id) {
            if (seenIds.has(offer.id)) {
                errors.push(`${prefix}.id must be unique. Duplicate: ${offer.id}`);
            }
            seenIds.add(offer.id);
        }

        if (offer.link && !isValidHttpsUrl(offer.link)) {
            errors.push(`${prefix}.link must be a valid https URL.`);
        }

        if (offer.verifiedFrom && !isValidHttpsUrl(offer.verifiedFrom)) {
            errors.push(`${prefix}.verifiedFrom must be a valid https URL.`);
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

        if (!isValidDate(offer.reviewBy)) {
            errors.push(`${prefix}.reviewBy must be a valid ISO datetime.`);
        }

        const hasRequirements = typeof offer.requirements === 'string' && offer.requirements.trim() !== '';
        const hasNotes = typeof offer.notes === 'string' && offer.notes.trim() !== '';
        if (!hasRequirements && !hasNotes) {
            errors.push(`${prefix} must include notes or requirements.`);
        }

        const requiresVerificationMetadata = offer.verificationStatus && offer.verificationStatus !== 'draft';
        if (requiresVerificationMetadata) {
            requireNonEmptyString(offer.lastVerifiedAt, `${prefix}.lastVerifiedAt`, errors);
            requireNonEmptyString(offer.verifiedFrom, `${prefix}.verifiedFrom`, errors);

            if (!isValidDate(offer.lastVerifiedAt)) {
                errors.push(`${prefix}.lastVerifiedAt must be a valid ISO datetime.`);
            }
        }

        if (offer.expiresAt != null && offer.expiresAt !== '' && !isValidDate(offer.expiresAt)) {
            errors.push(`${prefix}.expiresAt must be a valid ISO datetime when provided.`);
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

    return { offers };
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

try {
    main();
} catch (err) {
    console.error(`[Offers] Validation failed: ${err.message}`);
    process.exit(1);
}
