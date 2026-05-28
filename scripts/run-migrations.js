"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { loadEnv } = require("../apps/backend/src/config/load-env");

const rootDir = path.resolve(__dirname, "..");
const migrationsDir = path.join(rootDir, "db", "migrations");
const lockKey = 91742361;

loadEnv({ paths: [path.join(rootDir, ".env")] });

function getConnectionString() {
  return String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
}

function getConnectionHost(connectionString) {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return "";
  }
}

function formatConnectionError(error, connectionString) {
  const message = error instanceof Error ? error.message : String(error);
  const host = getConnectionHost(connectionString);
  const isDirectSupabaseHost = /^db\.[^.]+\.supabase\.co$/i.test(host);
  if (isDirectSupabaseHost && /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|timeout|network/i.test(message)) {
    return [
      message,
      "",
      "The configured SUPABASE_DB_URL uses Supabase's direct database host.",
      "Direct Supabase database connections require IPv6 unless the project has the IPv4 add-on.",
      "Use the Session pooler connection string from Supabase Dashboard > Connect for IPv4-only environments.",
    ].join("\n");
  }
  return message;
}

function shouldUseSsl(connectionString) {
  const mode = String(process.env.DB_SSL_MODE || "auto").trim().toLowerCase();
  if (["disable", "false", "off", "0"].includes(mode)) {
    return false;
  }
  if (["require", "true", "on", "1"].includes(mode)) {
    return true;
  }
  return /supabase\.co|pooler\.supabase\.com/i.test(connectionString);
}

function checksum(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function loadMigrations() {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migration directory does not exist: ${migrationsDir}`);
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((filename) => {
      const filePath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filePath, "utf8");
      return {
        filename,
        sql,
        checksum: checksum(sql),
      };
    });
}

async function ensureMigrationTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query("select filename, checksum from schema_migrations");
  return new Map(result.rows.map((row) => [row.filename, row.checksum]));
}

async function applyMigration(client, migration) {
  await client.query("begin");
  try {
    await client.query(migration.sql);
    await client.query(
      "insert into schema_migrations (filename, checksum) values ($1, $2)",
      [migration.filename, migration.checksum],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function ensureSupabaseCompatibility(client) {
  await client.query("create schema if not exists auth");
  await client.query(`
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select null::uuid
    $$
  `);
}

async function runMigrations(options = {}) {
  const connectionString = String(options.connectionString || getConnectionString()).trim();
  const dryRun = Boolean(options.dryRun);
  const log = options.log || console.log;
  if (!connectionString) {
    throw new Error("DATABASE_URL or SUPABASE_DB_URL is required to run migrations.");
  }

  const migrations = loadMigrations();
  if (migrations.length === 0) {
    throw new Error(`No .sql migrations found in ${migrationsDir}`);
  }

  const pool = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();

  let appliedCount = 0;
  let skippedCount = 0;
  let pendingCount = 0;

  try {
    await client.query("select pg_advisory_lock($1)", [lockKey]);
    if (options.supabaseCompat) {
      await ensureSupabaseCompatibility(client);
    }
    await ensureMigrationTable(client);
    const applied = await getAppliedMigrations(client);

    for (const migration of migrations) {
      const previousChecksum = applied.get(migration.filename);
      if (previousChecksum) {
        if (previousChecksum !== migration.checksum) {
          throw new Error(
            `${migration.filename} has changed since it was applied. Create a new migration instead of editing applied SQL.`,
          );
        }
        skippedCount += 1;
        continue;
      }

      if (dryRun) {
        log(`Pending ${migration.filename}`);
        pendingCount += 1;
        continue;
      }

      process.stdout.write(`Applying ${migration.filename}... `);
      await applyMigration(client, migration);
      appliedCount += 1;
      process.stdout.write("done\n");
    }
  } finally {
    try {
      await client.query("select pg_advisory_unlock($1)", [lockKey]);
    } finally {
      client.release();
      await pool.end();
    }
  }

  if (dryRun) {
    log(`Migration dry run complete. Pending: ${pendingCount}. Applied: 0. Skipped: ${skippedCount}.`);
    return { appliedCount: 0, skippedCount, pendingCount };
  }

  log(`Migrations complete. Applied: ${appliedCount}. Skipped: ${skippedCount}.`);
  return { appliedCount, skippedCount, pendingCount: 0 };
}

async function main() {
  await runMigrations({
    dryRun: process.argv.includes("--dry-run") || process.env.MIGRATION_DRY_RUN === "1",
    supabaseCompat: process.env.MIGRATION_SUPABASE_COMPAT === "1",
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(formatConnectionError(error, getConnectionString()));
    process.exitCode = 1;
  });
}

module.exports = {
  formatConnectionError,
  runMigrations,
};
