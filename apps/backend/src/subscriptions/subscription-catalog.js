"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planCatalog = void 0;
exports.getSubscriptionCatalog = getSubscriptionCatalog;
exports.normalizePlanId = normalizePlanId;
const planCatalog = [
    {
        id: 'free',
        name: 'Free Tier',
        priceLabel: 'Free',
        cadence: 'forever',
        summary: 'Essential manual alerts, a small trusted-circle, and lightweight location sharing for fast adoption.',
        features: [
            'Manual SOS trigger',
            'Up to 3 trusted contacts',
            'Basic live location sharing',
            'Essential in-app alert flow',
        ],
        amountNgn: 0,
        entitlementKey: null,
        packageIdentifiers: [],
        productIdentifiers: {
            ios: [],
            android: [],
        },
    },
    {
        id: 'basic',
        name: 'Basic',
        priceLabel: 'Store pricing',
        cadence: 'per month',
        summary: 'Removes core free-tier limits while keeping the experience simple and affordable.',
        features: [
            'More trusted contacts',
            'Faster alert delivery',
            'Expanded alert history',
            'Priority onboarding support',
        ],
        amountNgn: 1500,
        entitlementKey: null,
        packageIdentifiers: [],
        productIdentifiers: {
            ios: [],
            android: [],
        },
    },
    {
        id: 'pro',
        name: 'Pro',
        priceLabel: 'Store pricing',
        cadence: 'per month',
        summary: 'Automation and persistent tracking for users who depend on Sentinel during higher-risk moments.',
        features: [
            'Automatic trigger workflows',
            'Continuous live tracking',
            'Escalated alert routing',
            'Cloud incident capture',
        ],
        amountNgn: 5000,
        entitlementKey: null,
        packageIdentifiers: [],
        productIdentifiers: {
            ios: [],
            android: [],
        },
    },
    {
        id: 'family',
        name: 'Family',
        priceLabel: 'Store pricing',
        cadence: 'per month',
        summary: 'Shared protection for households that need one subscription covering multiple people.',
        features: [
            'Multi-member family coverage',
            'Shared household visibility',
            'Household-wide escalation coverage',
            'Better caregiver coordination',
        ],
        amountNgn: 9000,
        entitlementKey: null,
        packageIdentifiers: [],
        productIdentifiers: {
            ios: [],
            android: [],
        },
    },
];
exports.planCatalog = planCatalog;
const planAliases = {
    free: 'free',
    free_tier: 'free',
    starter: 'basic',
    basic: 'basic',
    individual: 'pro',
    pro: 'pro',
    platinum: 'pro',
    family: 'family',
};
function readCsvEnv(name) {
    return String(process.env[name] || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}
function normalizePlanId(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    return planAliases[normalized] || 'free';
}
function getSubscriptionCatalog() {
    return planCatalog.map((plan) => ({
        ...plan,
        entitlementKey: plan.id === 'free'
            ? null
            : String(process.env[`REVENUECAT_${plan.id.toUpperCase()}_ENTITLEMENT_ID`] || plan.id).trim(),
        packageIdentifiers: plan.id === 'free'
            ? []
            : readCsvEnv(`REVENUECAT_${plan.id.toUpperCase()}_PACKAGE_IDS`),
        productIdentifiers: plan.id === 'free'
            ? { ios: [], android: [] }
            : {
                ios: readCsvEnv(`REVENUECAT_${plan.id.toUpperCase()}_IOS_PRODUCT_IDS`),
                android: readCsvEnv(`REVENUECAT_${plan.id.toUpperCase()}_ANDROID_PRODUCT_IDS`),
            },
    }));
}
