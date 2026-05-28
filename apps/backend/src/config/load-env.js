"use strict";

const fs = require("fs");
const path = require("path");

function stripQuotes(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const separatorIndex = normalized.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  const value = stripQuotes(normalized.slice(separatorIndex + 1));
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  return { key, value };
}

function defaultEnvPaths() {
  const candidates = [
    process.env.ENV_FILE,
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
  ].filter(Boolean);

  return [...new Set(candidates)];
}

function loadEnv(options = {}) {
  const paths = options.paths || defaultEnvPaths();
  const override = Boolean(options.override);
  let loadedPath = null;

  for (const envPath of paths) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }
      if (override || process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.value;
      }
    }
    loadedPath = envPath;
    break;
  }

  return loadedPath;
}

module.exports = {
  loadEnv,
  parseEnvLine,
};
