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
const crypto_1 = require("crypto");
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
    return activePlanId === 'free' ? 'active' : 'active';
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
        return this.buildResponse(userId, catalog, await this.getStoredSnapshot(userId, catalog), 'verified');
    }
    async handlePaystackWebhook(rawBody, signature) {
        const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
        const expected = (0, crypto_1.createHmac)('sha512', getPaystackSecretKey()).update(body).digest('hex');
        const provided = String(signature || '').trim().toLowerCase();
        if (!provided || provided.length !== expected.length || !(0, crypto_1.timingSafeEqual)(Buffer.from(provided), Buffer.from(expected))) {
            throw new common_1.UnauthorizedException('Invalid Paystack webhook signature.');
        }
        let event;
        try {
            event = JSON.parse(body.toString('utf8'));
        }
        catch {
            throw new common_1.BadRequestException('Invalid Paystack webhook payload.');
        }
        if (event.event !== 'charge.success') {
            return { received: true, processed: false, reason: 'event_not_supported' };
        }
        const transaction = event.data || {};
        const userId = transaction.metadata?.userId;
        if (!userId || transaction.status !== 'success') {
            return { received: true, processed: false, reason: 'missing_verified_transaction_identity' };
        }
        const catalog = (0, subscription_catalog_1.getSubscriptionCatalog)();
        const snapshot = this.snapshotFromPaystackTransaction(transaction, catalog);
        if (!snapshot.providerRef || snapshot.status !== 'active' || snapshot.activePlanId !== 'basic' || transaction.metadata?.product !== 'sentinel_service' || Number(transaction.metadata?.durationDays) !== 30) {
            return { received: true, processed: false, reason: 'unrecognized_plan' };
        }
        await this.persistSnapshot(String(userId), snapshot, catalog);
        return { received: true, processed: true, providerRef: snapshot.providerRef };
    }
    async checkout(userId, body) {
        if (!isPaystackConfigured()) {
            throw new common_1.ServiceUnavailableException('Paystack is not configured for this environment.');
        }
        const catalog = (0, subscription_catalog_1.getSubscriptionCatalog)();
        const plan = catalog.find((item) => item.id === 'basic');
        const email = await this.resolveBillingEmail(userId, body?.email);
        if (!email) {
            throw new common_1.BadRequestException('Add an email address before starting Paystack checkout.');
        }
        const payload = {
            email,
            amount: Math.round(plan.amountNgn * 100),
            currency: 'NGN',
            callback_url: String(body?.callbackUrl || '').trim() || getPaystackCallbackUrl() || undefined,
            metadata: {
                userId,
                product: 'sentinel_service',
                durationDays: 30,
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
            planId: 'basic',
            authorizationUrl: response?.data?.authorization_url || null,
            accessCode: response?.data?.access_code || null,
            reference: response?.data?.reference || null,
        };
    }
    async getStoredSnapshot(userId, catalog) {
        const result = await this.db.query('select * from subscriptions where user_id = $1 order by paid_until desc nulls last, current_period_end desc nulls last, started_at desc nulls last limit 1', [userId]);
        const row = result.rows[0];
        if (!row) {
            return this.buildFreeSnapshot();
        }
        const activePlanId = (0, subscription_catalog_1.normalizePlanId)(row.plan_name);
        const matchingPlan = catalog.find((plan) => plan.id === activePlanId) || catalog[0];
        const paidUntil = row.paid_until || row.current_period_end;
        const expiredPaidSnapshot = activePlanId !== 'free' && isPastIso(paidUntil);
        return {
            activePlanId: expiredPaidSnapshot ? 'free' : activePlanId,
            status: expiredPaidSnapshot ? 'expired' : normalizeStatus(row.status, activePlanId),
            currentPeriodEnd: expiredPaidSnapshot ? null : toIso(paidUntil),
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
        if (String(metadata.userId || '') !== String(userId) || metadata.product !== 'sentinel_service' || Number(metadata.durationDays) !== 30) {
            throw new common_1.ForbiddenException('This payment reference belongs to another user.');
        }
        if (Number(transaction.amount) !== 100000 || String(transaction.currency || '').toUpperCase() !== 'NGN') {
            throw new common_1.ConflictException('Payment amount or currency does not match Sentinel pricing.');
        }
        return this.snapshotFromPaystackTransaction(transaction, catalog);
    }
    snapshotFromPaystackTransaction(transaction, catalog) {
        const activePlanId = 'basic';
        const matchedPlan = Number(transaction.amount) === 100000 && String(transaction.currency || 'NGN').toUpperCase() === 'NGN'
            ? catalog.find((plan) => plan.id === 'basic')
            : null;
        const paidAt = toIso(transaction.paid_at || transaction.created_at) || new Date().toISOString();
        return {
            activePlanId: matchedPlan?.id || 'free',
            status: matchedPlan ? 'active' : 'inactive',
            currentPeriodEnd: null,
            provider: 'paystack',
            providerRef: transaction.reference || null,
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
            .find((plan) => Math.abs(plan.amountNgn - amountNgn) < 1);
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
            status: 'active',
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
        const persist = async (client) => this.persistSnapshotWithClient(client, userId, snapshot, catalog);
        if (typeof this.db.transaction === 'function') {
            await this.db.transaction(persist);
            return;
        }
        await persist(this.db);
    }
    async persistSnapshotWithClient(client, userId, snapshot, catalog) {
        const plan = catalog.find((item) => item.id === snapshot.activePlanId) || catalog[0];
        // Serialize different successful payments for the same account even
        // when the account has no existing subscription row to lock.
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [String(userId)]);
        const current = await client.query('select paid_until from subscriptions where user_id = $1 order by paid_until desc nulls last, started_at desc nulls last limit 1 for update', [userId]);
        const base = current.rows[0]?.paid_until && new Date(current.rows[0].paid_until).getTime() > Date.now()
            ? new Date(current.rows[0].paid_until)
            : new Date();
        const paidUntil = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
        await client.query('insert into subscriptions (user_id, provider, status, entitlement_status, plan_name, amount_ngn, payment_amount_ngn, payment_currency, started_at, payment_at, current_period_end, paid_until, duration_days, provider_ref, paystack_metadata) values ($1, $2, $3, $4, $5, $6, $6, $7, coalesce($8::timestamptz, now()), coalesce($8::timestamptz, now()), $9::timestamptz, $9::timestamptz, 30, $10, $11::jsonb) on conflict (provider, provider_ref) where provider_ref is not null do nothing', [
            userId,
            snapshot.provider || 'paystack',
            snapshot.status,
            'active',
            'basic',
            snapshot.amountNgn,
            'NGN',
            snapshot.startedAt,
            paidUntil.toISOString(),
            snapshot.providerRef,
            JSON.stringify({ reference: snapshot.providerRef, durationDays: 30 }),
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
                helpText: 'Renew Sentinel manually for another 30 days when your service expires.',
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
