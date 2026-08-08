"use strict";

const { spawnSync } = require("child_process");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, options = {}) {
  const label = [command, ...args].join(" ");
  console.log(`\n> ${label}`);
  const spawnCommand = process.platform === "win32" ? "cmd.exe" : command;
  const spawnArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", quoteWindowsCommand([command, ...args])]
    : args;
  const result = spawnSync(spawnCommand, spawnArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...options.env,
    },
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function quoteWindowsCommand(parts) {
  return parts.map((part) => {
    const value = String(part);
    if (/^[A-Za-z0-9_:./\\=-]+$/.test(value)) {
      return value;
    }
    return `"${value.replace(/"/g, '\\"')}"`;
  }).join(" ");
}

const productionValidationEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://postgres:postgres@example.com:5432/sentinel",
  REDIS_URL: "redis://redis.example.com:6379",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  CORS_ORIGINS: "https://app.example.com",
  OTP_BYPASS_CODE: "",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
  AWS_SECRET_ACCESS_KEY: "aws-secret-key",
  AWS_REGION: "us-east-1",
  EXPO_PUBLIC_APP_ENV: "production",
  EXPO_PUBLIC_API_BASE_URL: "https://api.example.com",
  EXPO_PUBLIC_WS_URL: "https://api.example.com",
  IOS_BUNDLE_IDENTIFIER: "com.sentinel.watchtower",
  IOS_BUILD_NUMBER: "1",
  ANDROID_PACKAGE: "com.sentinel.watchtower",
  ANDROID_VERSION_CODE: "1",
};

run(npmCommand, ["run", "test:backend"]);
run(npmCommand, ["--workspace", "apps/mobile", "run", "typecheck"]);
run(npmCommand, ["run", "test:integration"]);
run(npmCommand, ["run", "validate:production"], { env: productionValidationEnv });
run(npmCommand, ["run", "build:backend"]);
