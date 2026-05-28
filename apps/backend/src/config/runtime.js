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
        const redisUrl = String(process.env.REDIS_URL || "").trim();
        const supabaseEmailOtpConfigured = Boolean(String(process.env.SUPABASE_URL || "").trim() &&
            String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
        const resendEmailOtpConfigured = Boolean(String(process.env.RESEND_API_KEY || "").trim() &&
            String(process.env.OTP_EMAIL_FROM || "").trim());
        const twilioVerifyConfigured = Boolean(String(process.env.TWILIO_ACCOUNT_SID || "").trim() &&
            String(process.env.TWILIO_AUTH_TOKEN || "").trim() &&
            String(process.env.TWILIO_VERIFY_SERVICE_SID || "").trim());
        if (!databaseUrl) {
            throw new Error("DATABASE_URL or SUPABASE_DB_URL must be set in production.");
        }
        if (!redisUrl) {
            throw new Error("REDIS_URL must be set in production.");
        }
        if (String(process.env.OTP_BYPASS_CODE || "").trim()) {
            throw new Error("OTP_BYPASS_CODE must be empty in production.");
        }
        if (!supabaseEmailOtpConfigured && !resendEmailOtpConfigured) {
            throw new Error("Production email OTP requires Supabase auth or Resend email configuration.");
        }
        if (!twilioVerifyConfigured) {
            throw new Error("Production phone OTP requires Twilio Verify configuration.");
        }
        getCorsOrigins();
    }
    return true;
}
exports.validateRuntimeConfig = validateRuntimeConfig;
