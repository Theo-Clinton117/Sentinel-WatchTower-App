"use strict";

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1";

function getKey() {
  const configured = String(process.env.FIELD_ENCRYPTION_KEY || "").trim();
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("FIELD_ENCRYPTION_KEY must be set in production.");
  }
  const source = configured || String(process.env.JWT_ACCESS_SECRET || "change-me");
  return crypto.createHash("sha256").update(source, "utf8").digest();
}

function encryptField(value) {
  if (value == null || String(value) === "") {
    return value == null ? null : String(value);
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

function decryptField(value) {
  if (value == null || typeof value !== "string" || !value.startsWith(`${PREFIX}:`)) {
    return value ?? null;
  }
  const [, version, ivEncoded, tagEncoded, dataEncoded] = value.split(":");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !dataEncoded) {
    throw new Error("Invalid encrypted field envelope.");
  }
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataEncoded, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt protected field.");
  }
}

module.exports = { encryptField, decryptField };
