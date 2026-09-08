function hasValue(value) {
    return String(value || '').trim().length > 0;
}

function hasSupabaseEmailConfig() {
    return hasValue(process.env.SUPABASE_URL) &&
        hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
}

function hasResendEmailConfig() {
    return hasValue(process.env.RESEND_API_KEY) && hasValue(process.env.OTP_EMAIL_FROM);
}

function getEmailOtpProvider() {
    const requested = String(process.env.EMAIL_OTP_PROVIDER || '').trim().toLowerCase();
    if (requested === 'supabase' || requested === 'resend') {
        return requested;
    }
    if (hasSupabaseEmailConfig()) {
        return 'supabase';
    }
    if (hasResendEmailConfig()) {
        return 'resend';
    }
    return null;
}

module.exports = {
    getEmailOtpProvider,
    hasResendEmailConfig,
    hasSupabaseEmailConfig,
};
