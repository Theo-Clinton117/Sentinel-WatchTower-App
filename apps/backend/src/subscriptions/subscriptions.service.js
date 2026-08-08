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
function getPaystackSecretKey() {
    return String(process.env.PAYSTACK_SECRET_KEY || '').trim();
}
function getPaystackCallbackUrl() {
    return String(process.env.PAYSTACK_CALLBACK_URL || '').trim();
}
function isPaystackConfigured() {
    return Boolean(getPaystackSecretKey());
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
function isPastIso(value) {
    const iso = toIso(value);
    if (!iso) {
        return false;
    }
    return new Date(iso).getTime() <= Date.now();
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
        const snapshot = await this.getStoredSnapshot(userId, catalog);
        return this.buildResponse(userId, catalog, snapshot, 'cached');
    }
    async syncPayment(userId, body) {
        const reference = String(body?.reference || '').trim();
        const catalog = (0, subscription_catalog_1.getSubscriptionCatalog)();
        if (!reference) {
            const snapshot = await this.getStoredSnapshot(userId, catalog);
            return this.buildResponse(userId, catalog, snapshot, 'cached');
        }
        if (!isPaystackConfigured()) {
            const snapshot = await this.getStoredSnapshot(userId, catalog);
            return this.buildResponse(userId, catalog, snapshot, 'paystack_not_configured');
        }
        const verifiedSnapshot = await this.fetchPaystackSnapshot(userId, reference, catalog);
        await this.persistSnapshot(userId, verifiedSnapshot, catalog);
        return this.buildResponse(userId, catalog, verifiedSnapshot, 'verified');
    }
    async checkout(userId, userEmail, body) {
        if (!isPaystackConfigured()) {
            throw new common_1.ServiceUnavailableException('Paystack is not configured for this environment.');
        }
        const catalog = (0, subscription_catalog_1.getSubscriptionCatalog)();
        const planId = (0, subscription_catalog_1.normalizePlanId)(body?.planId);
        const plan = catalog.find((item) => item.id === planId);
        if (!plan || plan.id === 'free') {
            throw new common_1.BadRequestException('Choose a paid subscription plan.');
        }
        const email = await this.resolveBillingEmail(userId, userEmail || body?.email);
        if (!email) {
            throw new common_1.BadRequestException('Add an email address before starting Paystack checkout.');
        }
        const payload = {
            email,
            amount: Math.round(plan.amountNgn * 100),
            currency: 'NGN',
            callback_url: String(body?.callbackUrl || '').trim() || getPaystackCallbackUrl() || undefined,
            plan: String(process.env[`PAYSTACK_${plan.id.toUpperCase()}_PLAN_CODE`] || '').trim() || undefined,
            metadata: {
                userId,
                planId: plan.id,
                planName: plan.name,
            },
        };
        Object.keys(payload).forEach((key) => {
            if (payload[key] === undefined || payload[key] === '') {
                delete payload[key];
            }
        });
        const response = await this.requestPaystack('/transaction/initialize', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return {
            provider: 'paystack',
            planId: plan.id,
            authorizationUrl: response?.data?.authorization_url || null,
            accessCode: response?.data?.access_code || null,
            reference: response?.data?.reference || null,
        };
    }
    async getStoredSnapshot(userId, catalog) {
        const result = await this.db.query('select * from subscriptions where user_id = $1 order by started_at desc nulls last, current_period_end desc nulls last limit 1', [userId]);
        const row = result.rows[0];
        if (!row) {
            return this.buildFreeSnapshot();
        }
        const activePlanId = (0, subscription_catalog_1.normalizePlanId)(row.plan_name);
        const matchingPlan = catalog.find((plan) => plan.id === activePlanId) || catalog[0];
        const expiredPaidSnapshot = activePlanId !== 'free' && isPastIso(row.current_period_end);
        return {
            activePlanId: expiredPaidSnapshot ? 'free' : activePlanId,
            status: expiredPaidSnapshot ? 'expired' : normalizeStatus(row.status, activePlanId),
            currentPeriodEnd: expiredPaidSnapshot ? null : toIso(row.current_period_end),
            provider: row.provider ? String(row.provider) : null,
            providerRef: row.provider_ref || null,
            startedAt: toIso(row.started_at),
            source: 'database',
            lastSyncedAt: toIso(row.started_at),
            amountNgn: expiredPaidSnapshot ? 0 : typeof row.amount_ngn === 'number' ? row.amount_ngn : matchingPlan.amountNgn,
        };
    }
    async fetchPaystackSnapshot(userId, reference, catalog) {
        const response = await this.requestPaystack(`/transaction/verify/${encodeURIComponent(reference)}`);
        const transaction = response?.data || {};
        if (transaction.status !== 'success') {
            throw new common_1.ConflictException('Paystack payment has not completed successfully yet.');
        }
        const metadata = transaction.metadata || {};
        if (metadata.userId && String(metadata.userId) !== String(userId)) {
            throw new common_1.ForbiddenException('This payment reference belongs to another user.');
        }
        const activePlanId = (0, subscription_catalog_1.normalizePlanId)(metadata.planId);
        const matchedPlan = catalog.find((plan) => plan.id === activePlanId && plan.id !== 'free') || this.resolvePlanFromAmount(catalog, transaction.amount);
        const paidAt = toIso(transaction.paid_at || transaction.created_at) || new Date().toISOString();
        const periodEnd = this.resolvePaystackPeriodEnd(transaction) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        return {
            activePlanId: matchedPlan?.id || 'free',
            status: matchedPlan ? 'active' : 'inactive',
            currentPeriodEnd: matchedPlan ? periodEnd : null,
            provider: 'paystack',
            providerRef: transaction.reference || reference,
            startedAt: paidAt,
            source: 'paystack',
            lastSyncedAt: new Date().toISOString(),
            amountNgn: matchedPlan?.amountNgn || 0,
        };
    }
    resolvePlanFromAmount(catalog, amountKobo) {
        const amountNgn = Number(amountKobo) / 100;
        return catalog
            .filter((plan) => plan.id !== 'free')
            .sort((left, right) => right.amountNgn - left.amountNgn)
            .find((plan) => plan.amountNgn === amountNgn);
    }
    resolvePaystackPeriodEnd(transaction) {
        const subscription = transaction.subscription || {};
        return toIso(subscription.next_payment_date || subscription.next_payment_at || transaction.next_payment_date);
    }
    async resolveBillingEmail(userId, candidate) {
        const normalized = String(candidate || '').trim().toLowerCase();
        if (normalized && normalized.includes('@')) {
            return normalized;
        }
        const result = await this.db.query('select email from users where id = $1 limit 1', [userId]);
        const email = String(result.rows[0]?.email || '').trim().toLowerCase();
        return email && email.includes('@') ? email : null;
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
                snapshot.provider || 'paystack',
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
            snapshot.provider || 'paystack',
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
            paystack: {
                configured: isPaystackConfigured(),
                customerId: userId,
            },
            management: {
                provider: snapshot.provider,
                mode: 'paystack',
                helpText: 'Manage billing from your Paystack receipt or contact Sentinel support.',
            },
        };
    }
    async requestPaystack(path, init = {}) {
        const response = await fetch(`https://api.paystack.co${path}`, {
            method: init.method || 'GET',
            headers: {
                Authorization: `Bearer ${getPaystackSecretKey()}`,
                'Content-Type': 'application/json',
                ...(init.headers || {}),
            },
            body: init.body,
        });
        const text = await response.text();
        const data = tryParseJson(text);
        if (!response.ok) {
            const message = typeof data === 'object' && data && 'message' in data
                ? data.message
                : 'Paystack request failed.';
            throw new common_1.ServiceUnavailableException(typeof message === 'string' ? message : 'Paystack request failed.');
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
