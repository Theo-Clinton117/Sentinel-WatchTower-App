"use strict";

const KUDISMS_TIMEOUT_MS = 10000;

function getKudiSmsBaseUrl() {
    return String(process.env.KUDISMS_BASE_URL || "https://my.kudisms.net/api/sms").trim();
}

function getKudiSmsToken() {
    return String(process.env.KUDISMS_TOKEN || "").trim();
}

function getKudiSmsSenderId() {
    return String(process.env.KUDISMS_SENDER_ID || "").trim();
}

function getKudiSmsOtpUrl() {
    return String(process.env.KUDISMS_OTP_URL || "https://my.kudisms.net/api/otp").trim();
}

function getKudiSmsAppNameCode() {
    return String(process.env.KUDISMS_APP_NAME_CODE || "").trim();
}

function getKudiSmsTemplateCode() {
    return String(process.env.KUDISMS_TEMPLATE_CODE || "").trim();
}

function isKudiSmsConfigured() {
    return Boolean(getKudiSmsToken() && getKudiSmsSenderId());
}

function isKudiSmsOtpConfigured() {
    return Boolean(isKudiSmsConfigured() && getKudiSmsAppNameCode() && getKudiSmsTemplateCode());
}

function buildKudiSmsUrl(recipients, message) {
    const endpoint = new URL(getKudiSmsBaseUrl());
    endpoint.searchParams.set("token", getKudiSmsToken());
    endpoint.searchParams.set("senderID", getKudiSmsSenderId());
    endpoint.searchParams.set("recipients", recipients);
    endpoint.searchParams.set("message", message);
    return endpoint;
}

async function fetchKudiSms(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KUDISMS_TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    }
    catch (error) {
        if (error?.name === "AbortError") {
            throw new Error("KudiSMS request timed out.");
        }
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
}

async function sendSms(recipients, message) {
    if (!isKudiSmsConfigured()) {
        throw new Error("KudiSMS is not configured.");
    }
    const response = await fetchKudiSms(buildKudiSmsUrl(recipients, message), {
        method: "GET",
        headers: {
            accept: "application/json, text/plain, */*",
        },
    });
    if (!response.ok) {
        throw new Error(`Could not publish SMS with KudiSMS (HTTP ${response.status || 'unknown'}).`);
    }
    return true;
}

async function sendOtp(recipients, otp) {
    if (!isKudiSmsOtpConfigured()) {
        throw new Error("KudiSMS OTP is not configured.");
    }
    const form = new FormData();
    form.append("token", getKudiSmsToken());
    form.append("senderID", getKudiSmsSenderId());
    form.append("recipients", recipients);
    form.append("otp", otp);
    form.append("appnamecode", getKudiSmsAppNameCode());
    form.append("templatecode", getKudiSmsTemplateCode());
    const response = await fetchKudiSms(getKudiSmsOtpUrl(), {
        method: "POST",
        body: form,
        headers: {
            accept: "application/json, text/plain, */*",
        },
    });
    if (!response.ok) {
        throw new Error(`Could not publish OTP with KudiSMS (HTTP ${response.status || 'unknown'}).`);
    }
    return true;
}

module.exports = {
    getKudiSmsBaseUrl,
    getKudiSmsSenderId,
    getKudiSmsOtpUrl,
    getKudiSmsAppNameCode,
    getKudiSmsTemplateCode,
    isKudiSmsConfigured,
    isKudiSmsOtpConfigured,
    sendSms,
    sendOtp,
};
