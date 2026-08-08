"use strict";

const crypto = require("crypto");

function getAwsRegion() {
    return String(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "").trim();
}

function isSnsSmsConfigured() {
    return Boolean(String(process.env.AWS_ACCESS_KEY_ID || "").trim() &&
        String(process.env.AWS_SECRET_ACCESS_KEY || "").trim() &&
        getAwsRegion());
}

function hmac(key, value, encoding) {
    return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function hash(value) {
    return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function getSigningKey(secretAccessKey, dateStamp, region) {
    const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, "sns");
    return hmac(kService, "aws4_request");
}

function toAmzDate(date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function publishSms(phoneNumber, message) {
    const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID || "").trim();
    const secretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || "").trim();
    const sessionToken = String(process.env.AWS_SESSION_TOKEN || "").trim();
    const region = getAwsRegion();
    if (!accessKeyId || !secretAccessKey || !region) {
        throw new Error("Amazon SNS SMS is not configured.");
    }

    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const host = `sns.${region}.amazonaws.com`;
    const endpoint = `https://${host}/`;
    const params = new URLSearchParams({
        Action: "Publish",
        PhoneNumber: phoneNumber,
        Message: message,
        Version: "2010-03-31",
    });
    const senderId = String(process.env.SNS_SMS_SENDER_ID || "").trim();
    if (senderId) {
        params.set("MessageAttributes.entry.1.Name", "AWS.SNS.SMS.SenderID");
        params.set("MessageAttributes.entry.1.Value.DataType", "String");
        params.set("MessageAttributes.entry.1.Value.StringValue", senderId);
    }
    const smsType = String(process.env.SNS_SMS_TYPE || "Transactional").trim();
    if (smsType) {
        const index = senderId ? "2" : "1";
        params.set(`MessageAttributes.entry.${index}.Name`, "AWS.SNS.SMS.SMSType");
        params.set(`MessageAttributes.entry.${index}.Value.DataType`, "String");
        params.set(`MessageAttributes.entry.${index}.Value.StringValue`, smsType);
    }

    const body = params.toString();
    const payloadHash = hash(body);
    const headers = {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
    };
    if (sessionToken) {
        headers["x-amz-security-token"] = sessionToken;
    }
    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("");
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalRequest = [
        "POST",
        "/",
        "",
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${region}/sns/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        hash(canonicalRequest),
    ].join("\n");
    const signature = hmac(getSigningKey(secretAccessKey, dateStamp, region), stringToSign, "hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body,
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Could not publish SMS with Amazon SNS. ${errorBody || response.statusText}`);
    }
    return true;
}

module.exports = {
    getAwsRegion,
    isSnsSmsConfigured,
    publishSms,
};
