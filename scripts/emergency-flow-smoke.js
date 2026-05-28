"use strict";

const { loadEnv } = require("../apps/backend/src/config/load-env");

loadEnv();

function requireValue(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function endpoint(baseUrl, path) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

async function requestJson(url, { method = "GET", token, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${url} failed with HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  return payload;
}

async function main() {
  const baseUrl = requireValue("API_BASE_URL");
  const token = requireValue("SMOKE_ACCESS_TOKEN");
  const restartWaitMs = Number(process.env.SMOKE_RESTART_WAIT_MS || 30000);

  const created = await requestJson(endpoint(baseUrl, "/api/alerts"), {
    method: "POST",
    token,
    body: {
      triggerSource: "panic",
      riskScore: 95,
      detectionSummary: ["production smoke alert"],
    },
  });

  console.log(`Created smoke alert ${created.alertId} with session ${created.sessionId}.`);
  console.log(`Restart the backend now if you are testing queue durability. Waiting ${restartWaitMs}ms...`);
  await new Promise((resolve) => setTimeout(resolve, restartWaitMs));

  const active = await requestJson(endpoint(baseUrl, "/api/sessions/active"), { token });
  if (!active || active.id !== created.sessionId || active.alertId !== created.alertId) {
    throw new Error("Active session did not survive smoke verification.");
  }

  const closed = await requestJson(endpoint(baseUrl, `/api/sessions/${created.sessionId}/close`), {
    method: "POST",
    token,
  });
  console.log(`Closed smoke session ${closed.id}; status=${closed.status}; alertStatus=${closed.alertStatus}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
