"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorsOrigins = exports.validateRuntimeConfig = exports.getJwtRefreshSecret = exports.getJwtAccessSecret = exports.getRequiredSecret = exports.isProduction = void 0;

function isProduction() {
    return process.env.NODE_ENV === "production";
}
exports.isProduction = isProduction;

function getRequiredSecret(name, fallback) {
    const value = String(process.env[name] || "").trim();
    if (isProduction()) {
        if (!value || value === fallback || value.length < 32) {
            throw new Error(`${name} must be set to a strong production secret.`);
        }
        return value;
    }
    return value || fallback;
}
exports.getRequiredSecret = getRequiredSecret;

function getJwtAccessSecret() {
    return getRequiredSecret("JWT_ACCESS_SECRET", "change-me");
}
exports.getJwtAccessSecret = getJwtAccessSecret;

function getJwtRefreshSecret() {
    return getRequiredSecret("JWT_REFRESH_SECRET", "change-me");
}
exports.getJwtRefreshSecret = getJwtRefreshSecret;

function getCorsOrigins() {
    const origins = String(process.env.CORS_ORIGINS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    if (isProduction() && origins.length === 0) {
        throw new Error("CORS_ORIGINS must be set in production.");
    }
    return origins.length > 0 ? origins : true;
}
exports.getCorsOrigins = getCorsOrigins;

function validateRuntimeConfig() {
    getJwtAccessSecret();
    getJwtRefreshSecret();
    if (isProduction()) {
        const databaseUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
        if (!databaseUrl) {
            throw new Error("DATABASE_URL or SUPABASE_DB_URL must be set in production.");
        }
        if (String(process.env.OTP_BYPASS_CODE || "").trim()) {
            throw new Error("OTP_BYPASS_CODE must be empty in production.");
        }
        getCorsOrigins();
    }
    return true;
}
exports.validateRuntimeConfig = validateRuntimeConfig;
