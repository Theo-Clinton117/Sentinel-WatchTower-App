# Deployment Notes

- Backend runs on Node.js with PostgreSQL + Redis.
- Use Cloudflare or an equivalent WAF in front of the API.
- Configure environment variables from `.env.example`, then replace all development values before production.
- Use `docs/operational-geography.md` as the planning reference for nationwide risk-zone hierarchy and response-grid rollout.
- Run `npm run validate:production` and `npm run db:migrate` before directing mobile traffic to a new backend.
- The backend health endpoint is `GET /api/health`.
- Current backend test URL: `https://sentinel-watchtower-backend.onrender.com`.

## Required Production Environment

- `NODE_ENV=production`
- `DATABASE_URL` or `SUPABASE_DB_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, each at least 32 characters
- `FIELD_ENCRYPTION_KEY`, a dedicated secret of at least 32 characters. It encrypts trusted-contact identifiers and reviewer notes. Store it in a secret manager and keep it stable during rotation migrations.
- `CORS_ORIGINS` with explicit HTTPS origins
- Email OTP through Supabase auth (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- Optional fallback email delivery through Resend (`RESEND_API_KEY` + `OTP_EMAIL_FROM`) if you choose not to use Supabase auth OTP
- Phone OTP through KudiSMS using multipart form data fields `token`, `senderID`, `recipients`, `otp`, `appnamecode`, and `templatecode`
- Required KudiSMS env vars: `KUDISMS_TOKEN`, `KUDISMS_SENDER_ID`, `KUDISMS_APP_NAME_CODE`, `KUDISMS_TEMPLATE_CODE`
- Optional KudiSMS OTP endpoint override: `KUDISMS_OTP_URL` (defaults to `https://my.kudisms.net/api/otp`)
- Set the KudiSMS values only in your backend environment on Render; do not copy live credentials into docs or the mobile app.
- `OTP_BYPASS_CODE` must be empty

The backend accepts legacy plaintext contact and reviewer-note values for read compatibility, but all new writes use authenticated AES-256-GCM envelopes. After deploying the key, re-save existing contacts and classifications or run an approved data migration before treating the database as fully encrypted. Losing `FIELD_ENCRYPTION_KEY` makes those protected values unrecoverable.

## Mobile Production Environment

- `EXPO_PUBLIC_APP_ENV=production`
- `EXPO_PUBLIC_API_BASE_URL` must be a public HTTPS API URL
- `EXPO_PUBLIC_WS_URL` must be a public HTTPS API URL for Socket.IO
- For a physical device using Expo Go, copy `apps/mobile/.env.render.example` to `apps/mobile/.env` before starting Expo. This points both clients at `https://sentinel-watchtower-backend.onrender.com` instead of the phone's own `localhost`.
- Set `EXPO_PUBLIC_ENABLE_DEV_TEST_SESSION=true` only if you want the dev-only tester bootstrap to auto-sign in during local Expo development.
- Keep local development values in `apps/mobile/.env` when using a local backend; the mobile runtime automatically maps localhost to the computer running Metro during development.
- Configure `IOS_BUNDLE_IDENTIFIER`, `IOS_BUILD_NUMBER`, `ANDROID_PACKAGE`, and `ANDROID_VERSION_CODE`
- Configure `PAYSTACK_SECRET_KEY` and optional `PAYSTACK_CALLBACK_URL` before enabling paid plans in release builds

## CI/CD

- Run the local release gate before opening a pull request: `npm run ci:verify`.
- Build backend container from `apps/backend`.
- Run backend tests before image publish: `npm run test:backend`.
- Run disposable database integration tests before release when a test database is available: `TEST_DATABASE_URL=... npm run test:integration`.
- Run mobile typecheck before release builds: `npm --workspace apps/mobile run typecheck`.
- Validate production config before deployment: `npm run validate:production`.
- Apply database migrations before app rollout: `npm run db:migrate`.
- Smoke-test the deployed API after rollout: `npm run smoke:backend -- https://sentinel-watchtower-backend.onrender.com`.
- Smoke-test the emergency lifecycle in staging with a disposable user token: `API_BASE_URL=https://sentinel-watchtower-backend.onrender.com SMOKE_ACCESS_TOKEN=... npm run smoke:emergency`.
- Deploy to AWS, GCP, Fly.io, Render, or another Node-capable host with managed Postgres and Redis.
- Keep API, database, and Redis metrics visible before any public launch.

## Database Migrations

The migration runner applies the ordered SQL files in `db/migrations` and records applied files in `schema_migrations`.

```sh
npm run db:migrate -- --dry-run
npm run db:migrate
```

The runner fails if a previously applied migration file changes checksum. When schema changes are needed, add the next numbered SQL file instead of editing an applied migration.

For Supabase, prefer the Session pooler connection string for `SUPABASE_DB_URL` unless your backend host supports IPv6 direct database connections or the project has the IPv4 add-on. Supabase's direct database hostname is IPv6-only by default.

## Integration Tests

The emergency lifecycle integration test is intentionally opt-in. Point `TEST_DATABASE_URL` at a disposable database whose name contains `test`.

```sh
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/sentinel_test npm run test:integration
```

The test applies migrations, creates a temporary user, runs the alert lifecycle, verifies audit records, then deletes the temporary user.

## Emergency Smoke Test

Run this only in staging or with a disposable user account. The smoke script creates a real alert, waits briefly so you can restart the backend if you are testing Redis-backed queue durability, verifies the active session, then closes it.

```sh
API_BASE_URL=https://sentinel-watchtower-backend.onrender.com SMOKE_ACCESS_TOKEN=... SMOKE_RESTART_WAIT_MS=30000 npm run smoke:emergency
```

## Local Container Smoke Test

From the repository root:

```sh
docker compose -f deploy/docker-compose.yml up --build
```

Then check:

```sh
npm run smoke:backend -- http://localhost:4000
```
