"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseService = void 0;
const common_1 = require("@nestjs/common");
function normalizeUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}
function toRealtimeUrl(projectUrl) {
    if (!projectUrl) {
        return null;
    }
    if (projectUrl.startsWith('https://')) {
        return `${projectUrl.replace(/^https:\/\//, 'wss://')}/realtime/v1`;
    }
    if (projectUrl.startsWith('http://')) {
        return `${projectUrl.replace(/^http:\/\//, 'ws://')}/realtime/v1`;
    }
    return null;
}
function detectConnectionSource() {
    if (process.env.SUPABASE_DB_URL) {
        return 'SUPABASE_DB_URL';
    }
    if (process.env.DATABASE_URL) {
        return 'DATABASE_URL';
    }
    return null;
}
let SupabaseService = class SupabaseService {
    status() {
        const projectUrl = normalizeUrl(process.env.SUPABASE_URL);
        const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
        const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
        const databaseUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();
        const connectionSource = detectConnectionSource();
        const sqlConfigured = Boolean(databaseUrl);
        const usingSupabaseSql = /supabase\.co|pooler\.supabase\.com/i.test(databaseUrl);
        const warnings = [];
        if (!projectUrl || !publishableKey) {
            warnings.push('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY on the backend to enable server-side Supabase configuration.');
        }
        if (!sqlConfigured) {
            warnings.push('This API still uses direct SQL queries. Add SUPABASE_DB_URL or DATABASE_URL to link the backend to Supabase Postgres.');
        }
        if (!serviceRoleKey) {
            warnings.push('SUPABASE_SERVICE_ROLE_KEY is not set, so privileged Supabase REST or storage operations are intentionally unavailable.');
        }
        return {
            configured: Boolean(projectUrl && publishableKey),
            authMode: 'local-jwt',
            projectUrl: projectUrl || null,
            projectRef: projectUrl ? new URL(projectUrl).hostname.split('.')[0] : null,
            endpoints: {
                rest: projectUrl ? `${projectUrl}/rest/v1` : null,
                auth: projectUrl ? `${projectUrl}/auth/v1` : null,
                realtime: toRealtimeUrl(projectUrl),
                storage: projectUrl ? `${projectUrl}/storage/v1` : null,
            },
            keys: {
                publishableConfigured: Boolean(publishableKey),
                serviceRoleConfigured: Boolean(serviceRoleKey),
            },
            database: {
                sqlConfigured,
                usingSupabaseSql,
                connectionSource,
            },
            warnings,
            clientPolicy: {
                exposePublishableKeyToMobile: false,
                backendOwnsSupabaseSecrets: true,
            },
        };
    }
};
exports.SupabaseService = SupabaseService;
exports.SupabaseService = SupabaseService = __decorate([
    (0, common_1.Injectable)()
], SupabaseService);
//# sourceMappingURL=supabase.service.js.map
