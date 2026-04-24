"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const subscription_catalog_1 = require("./subscription-catalog");
function getRevenueCatProjectId() {
    return String(process.env.REVENUECAT_PROJECT_ID || '').trim();
}
function getRevenueCatSecretKey() {
    return String(process.env.REVENUECAT_SECRET_API_KEY || '').trim();
}
function isRevenueCatConfigured() {
    return Boolean(getRevenueCatProjectId() && getRevenueCatSecretKey());
}
function tryParseJson(value) {
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}
function toIso(value) {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function fromEpochMs(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    return new Date(value).toISOString();
}
function normalizeProvider(store) {
    switch (String(store || '').trim().toLowerCase()) {
        case 'app_store':
        case 'mac_app_store':
            return 'app_store';
        case 'play_store':
            return 'play_store';
        default:
            return store ? String(store) : null;
    }
}
function normalizeStatus(value, activePlanId) {
    const raw = String(value || '').trim().toLowerCase();
    if (['active', 'trialing', 'grace_period', 'cancelled', 'expired', 'inactive'].includes(raw)) {
        return raw;
    }
    return activePlanId === 'free' ? 'inactive' : 'active';
}
let SubscriptionsService = class SubscriptionsService {
    constructor(db) {
        this.db = db;
    }
    async list(userId) {
        const catalog = (0, subscription_catalog_1.getSubscriptionCatalog)();
        const snapshot = await this.getStoredSnapshot(userId, catalog);
        return this.buildResponse(userId, catalog, snapshot, 'cached');
    }
    async sync(userId) {
        const catalog = (0, subscription_catalog_1.getSubscriptionCatalog)();
        if (!isRevenueCatConfigured()) {
            const snapshot = await this.getStoredSnapshot(userId, catalog);
            return this.buildResponse(userId, catalog, snapshot, 'revenuecat_not_configured');
        }
        const verifiedSnapshot = await this.fetchRevenueCatSnapshot(userId, catalog);
        await this.persistSnapshot(userId, verifiedSnapshot, catalog);
        return this.buildResponse(userId, catalog, verifiedSnapshot, 'verified');
    }
    async checkout() {
        throw new common_1.ConflictException('Subscriptions now use native App Store and Google Play purchases through RevenueCat. Use the mobile SDK flow instead of server checkout.');
    }
    async getStoredSnapshot(userId, catalog) {
        const result = await this.db.query('select * from subscriptions where user_id = $1 order by started_at desc nulls last, current_period_end desc nulls last limit 1', [userId]);
        const row = result.rows[0];
        if (!row) {
            return this.buildFreeSnapshot();
        }
        const activePlanId = (0, subscription_catalog_1.normalizePlanId)(row.plan_name);
        const matchingPlan = catalog.find((plan) => plan.id === activePlanId) || catalog[0];
        return {
            activePlanId,
            status: normalizeStatus(row.status, activePlanId),
            currentPeriodEnd: toIso(row.current_period_end),
            provider: normalizeProvider(row.provider),
            providerRef: row.provider_ref || null,
            startedAt: toIso(row.started_at),
            source: 'database',
            lastSyncedAt: toIso(row.started_at),
            amountNgn: typeof row.amount_ngn === 'number' ? row.amount_ngn : matchingPlan.amountNgn,
        };
    }
    async fetchRevenueCatSnapshot(userId, catalog) {
        const projectId = getRevenueCatProjectId();
        const customerId = encodeURIComponent(userId);
        const [entitlementsResponse, subscriptionsResponse] = await Promise.all([
            this.requestRevenueCat(`/projects/${projectId}/customers/${customerId}/active_entitlements?limit=20`),
            this.requestRevenueCat(`/projects/${projectId}/customers/${customerId}/subscriptions?limit=20`),
        ]);
        const entitlements = Array.isArray(entitlementsResponse?.items)
            ? entitlementsResponse.items
            : [];
        const subscriptions = Array.isArray(subscriptionsResponse?.items)
            ? subscriptionsResponse.items
            : [];
        const matchedPlan = this.resolvePlanFromEntitlements(catalog, entitlements);
        const activePlanId = matchedPlan?.id || 'free';
        const primaryEntitlement = matchedPlan
            ? entitlements.find((item) => item?.entitlement_id === matchedPlan.entitlementKey)
            : null;
        const latestSubscription = subscriptions
            .slice()
            .sort((left, right) => (Number(right?.current_period_ends_at || right?.ends_at || 0) -
            Number(left?.current_period_ends_at || left?.ends_at || 0)))[0];
        return {
            activePlanId,
            status: activePlanId === 'free' ? 'inactive' : 'active',
            currentPeriodEnd: fromEpochMs(primaryEntitlement?.expires_at) ||
                fromEpochMs(latestSubscription?.current_period_ends_at) ||
                fromEpochMs(latestSubscription?.ends_at),
            provider: normalizeProvider(latestSubscription?.store),
            providerRef: latestSubscription?.id ||
                latestSubscription?.store_subscription_identifier ||
                `revenuecat:${userId}`,
            startedAt: fromEpochMs(latestSubscription?.current_period_starts_at) ||
                fromEpochMs(latestSubscription?.starts_at) ||
                new Date().toISOString(),
            source: 'revenuecat',
            lastSyncedAt: new Date().toISOString(),
            amountNgn: matchedPlan?.amountNgn || 0,
        };
    }
    resolvePlanFromEntitlements(catalog, entitlements) {
        const activeEntitlementIds = new Set(entitlements
            .map((item) => String(item?.entitlement_id || '').trim())
            .filter(Boolean));
        return catalog
            .filter((plan) => Boolean(plan.entitlementKey))
            .sort((left, right) => right.amountNgn - left.amountNgn)
            .find((plan) => activeEntitlementIds.has(String(plan.entitlementKey)));
    }
    buildFreeSnapshot() {
        return {
            activePlanId: 'free',
            status: 'inactive',
            currentPeriodEnd: null,
            provider: null,
            providerRef: null,
            startedAt: null,
            source: 'database',
            lastSyncedAt: null,
            amountNgn: 0,
        };
    }
    async persistSnapshot(userId, snapshot, catalog) {
        const plan = catalog.find((item) => item.id === snapshot.activePlanId) || catalog[0];
        const current = await this.db.query('select id from subscriptions where user_id = $1 order by started_at desc nulls last, current_period_end desc nulls last limit 1', [userId]);
        const existingId = current.rows[0]?.id;
        if (existingId) {
            await this.db.query('update subscriptions set provider = $2, status = $3, plan_name = $4, amount_ngn = $5, started_at = coalesce($6, started_at, now()), current_period_end = $7, provider_ref = $8 where id = $1', [
                existingId,
                snapshot.provider || 'revenuecat',
                snapshot.status,
                plan.id,
                snapshot.amountNgn,
                snapshot.startedAt,
                snapshot.currentPeriodEnd,
                snapshot.providerRef,
            ]);
            return;
        }
        await this.db.query('insert into subscriptions (user_id, provider, status, plan_name, amount_ngn, started_at, current_period_end, provider_ref) values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7::timestamptz, $8)', [
            userId,
            snapshot.provider || 'revenuecat',
            snapshot.status,
            plan.id,
            snapshot.amountNgn,
            snapshot.startedAt,
            snapshot.currentPeriodEnd,
            snapshot.providerRef,
        ]);
    }
    buildResponse(userId, catalog, snapshot, syncStatus) {
        return {
            catalog,
            activePlanId: snapshot.activePlanId,
            status: snapshot.status,
            currentPeriodEnd: snapshot.currentPeriodEnd,
            provider: snapshot.provider,
            lastSyncedAt: snapshot.lastSyncedAt,
            syncStatus,
            revenueCat: {
                configured: isRevenueCatConfigured(),
                customerId: userId,
            },
            management: {
                provider: snapshot.provider,
                mode: 'native_store',
                helpText: 'Manage your billing from the App Store or Google Play on this device.',
            },
        };
    }
    async requestRevenueCat(path) {
        const response = await fetch(`https://api.revenuecat.com/v2${path}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${getRevenueCatSecretKey()}`,
                'Content-Type': 'application/json',
            },
        });
        const text = await response.text();
        const data = tryParseJson(text);
        if (response.status === 404) {
            return { items: [] };
        }
        if (!response.ok) {
            const message = typeof data === 'object' && data && 'message' in data
                ? data.message
                : 'RevenueCat verification failed.';
            throw new common_1.ServiceUnavailableException(typeof message === 'string' ? message : 'RevenueCat verification failed.');
        }
        return data;
    }
};
exports.SubscriptionsService = SubscriptionsService;
exports.SubscriptionsService = SubscriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map
