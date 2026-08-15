"use strict";

function getKudiSmsBaseUrl() {
    return String(process.env.KUDISMS_BASE_URL || "https://my.kudisms.net/api/sms").trim();
}

function getKudiSmsToken() {
    return String(process.env.KUDISMS_TOKEN || "").trim();
}

function getKudiSmsSenderId() {
    return String(process.env.KUDISMS_SENDER_ID || "").trim();
}

function isKudiSmsConfigured() {
    return Boolean(getKudiSmsToken() && getKudiSmsSenderId());
}

function buildKudiSmsUrl(recipients, message) {
    const endpoint = new URL(getKudiSmsBaseUrl());
    endpoint.searchParams.set("token", getKudiSmsToken());
    endpoint.searchParams.set("senderID", getKudiSmsSenderId());
    endpoint.searchParams.set("recipients", recipients);
    endpoint.searchParams.set("message", message);
    return endpoint;
}

async function sendSms(recipients, message) {
    if (!isKudiSmsConfigured()) {
        throw new Error("KudiSMS is not configured.");
    }
    const response = await fetch(buildKudiSmsUrl(recipients, message), {
        method: "GET",
        headers: {
            accept: "application/json, text/plain, */*",
        },
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Could not publish SMS with KudiSMS. ${errorBody || response.statusText}`);
    }
    return true;
}

module.exports = {
    getKudiSmsBaseUrl,
    getKudiSmsSenderId,
    isKudiSmsConfigured,
    sendSms,
};
