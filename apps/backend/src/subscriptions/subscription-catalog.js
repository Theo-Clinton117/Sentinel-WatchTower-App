"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planCatalog = void 0;
exports.getSubscriptionCatalog = getSubscriptionCatalog;
exports.normalizePlanId = normalizePlanId;
const planCatalog = [
    { id: 'free', name: 'Free', priceLabel: 'Free', cadence: 'forever', summary: 'Basic Sentinel access.', features: ['Manual SOS trigger', 'Trusted contacts'], amountNgn: 0 },
    { id: 'basic', name: 'Sentinel Pro', priceLabel: 'NGN 1,000', cadence: '30 days', summary: 'Paid Sentinel service access.', features: ['Paid Sentinel features', 'Priority alert delivery'], amountNgn: 1000 },
];
exports.planCatalog = planCatalog;
function normalizePlanId(value) {
    const normalized = String(value || '').trim().toLowerCase();
    // Historical paid plan rows remain intact; their unexpired access maps to
    // the single prepaid Sentinel entitlement.
    const aliases = { free: 'free', starter: 'basic', basic: 'basic', individual: 'basic', silver: 'basic', sentinel: 'basic', family: 'basic', gold: 'basic', organization: 'basic', enterprise: 'basic', entriprise: 'basic', pro: 'basic', platinum: 'basic' };
    return aliases[normalized] || 'free';
}
function getSubscriptionCatalog() {
    return planCatalog.map((plan) => ({ ...plan, entitlementKey: null, packageIdentifiers: [], productIdentifiers: { ios: [], android: [] } }));
}
