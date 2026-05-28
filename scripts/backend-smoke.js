"use strict";

const path = require("path");
const { loadEnv } = require("../apps/backend/src/config/load-env");

loadEnv({ paths: [path.resolve(__dirname, "..", ".env")] });

function getBaseUrl() {
  return String(process.argv[2] || process.env.API_BASE_URL || "http://localhost:4000").trim();
}

function getHealthUrl(baseUrl) {
  const url = new URL("/api/health", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  return url.toString();
}

async function main() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const healthUrl = getHealthUrl(getBaseUrl());

  try {
    const response = await fetch(healthUrl, { signal: controller.signal });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Health endpoint did not return JSON. HTTP ${response.status}: ${text.slice(0, 160)}`);
    }

    if (!response.ok) {
      throw new Error(`Health endpoint failed with HTTP ${response.status}: ${text.slice(0, 160)}`);
    }
    if (body.status !== "ok") {
      throw new Error(`Backend health is ${body.status || "unknown"}: ${JSON.stringify(body.checks || {})}`);
    }

    console.log(`Backend smoke check passed: ${healthUrl}`);
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((error) => {
  const message = error && error.name === "AbortError" ? "Backend smoke check timed out." : error;
  console.error(message instanceof Error ? message.message : message);
  process.exitCode = 1;
});
