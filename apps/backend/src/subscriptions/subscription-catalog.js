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
        name: 'Silver',
        priceLabel: 'NGN 1,000',
        cadence: 'per month',
        summary: 'Affordable individual safety coverage with stronger limits than the free tier.',
        features: [
            'More trusted contacts',
            'Faster alert delivery',
            'Expanded alert history',
            'Priority onboarding support',
        ],
        amountNgn: 1000,
        entitlementKey: null,
        packageIdentifiers: [],
        productIdentifiers: {
            ios: [],
            android: [],
        },
    },
    {
        id: 'family',
        name: 'Gold Family',
        priceLabel: 'NGN 3,500',
        cadence: 'per month',
        summary: 'One main account can create a family circle and add up to four other accounts at a discounted monthly rate.',
        features: [
            'One main account plus up to 4 circle members',
            'Add new or existing Sentinel accounts',
            'Shared household visibility',
            'Discounted family coverage versus individual plans',
        ],
        amountNgn: 3500,
        entitlementKey: null,
        packageIdentifiers: [],
        productIdentifiers: {
            ios: [],
            android: [],
        },
    },
    {
        id: 'pro',
        name: 'Platinum Enterprise',
        priceLabel: 'NGN 10,000',
        cadence: 'per month',
        summary: 'Enterprise-grade coverage for teams and high-dependence users who need the strongest Sentinel automation.',
        features: [
            'Automatic trigger workflows',
            'Continuous live tracking',
            'Escalated alert routing',
            'Cloud incident capture',
        ],
        amountNgn: 10000,
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
    silver: 'basic',
    gold: 'family',
    individual: 'pro',
    pro: 'pro',
    platinum: 'pro',
    enterprise: 'pro',
    entriprise: 'pro',
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
            : String(process.env[`PAYSTACK_${plan.id.toUpperCase()}_PLAN_CODE`] || plan.id).trim(),
        packageIdentifiers: plan.id === 'free'
            ? []
            : readCsvEnv(`PAYSTACK_${plan.id.toUpperCase()}_PLAN_ALIASES`),
        productIdentifiers: plan.id === 'free'
            ? { ios: [], android: [] }
            : {
                ios: [],
                android: [],
            },
    }));
}
