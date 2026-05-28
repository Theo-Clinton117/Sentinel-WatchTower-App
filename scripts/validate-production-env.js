"use strict";

const path = require("path");
const { loadEnv } = require("../apps/backend/src/config/load-env");
const { validateRuntimeConfig } = require("../apps/backend/src/config/runtime");
const mobileConfig = require("../apps/mobile/app.config");

loadEnv({ paths: [path.resolve(__dirname, "..", ".env")] });

function fail(message) {
  throw new Error(message);
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    fail(`${name} must be set.`);
  }
  return value;
}

function validateBackend() {
  if (process.env.NODE_ENV !== "production") {
    fail("NODE_ENV must be set to production.");
  }
  validateRuntimeConfig();
}

function validateMobile() {
  const appEnv = requireEnv("EXPO_PUBLIC_APP_ENV");
  if (appEnv !== "production") {
    fail("EXPO_PUBLIC_APP_ENV must be set to production.");
  }

  mobileConfig({ config: {} });

  const warnings = [];
  if (!String(process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || "").trim()) {
    warnings.push("EXPO_PUBLIC_REVENUECAT_API_KEY is empty; paid plans should stay disabled in release builds.");
  }
  if (!String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim()) {
    warnings.push("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is empty; map rendering may be limited in release builds.");
  }
  return warnings;
}

function main() {
  validateBackend();
  const warnings = validateMobile();

  console.log("Production environment validation passed.");
  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
