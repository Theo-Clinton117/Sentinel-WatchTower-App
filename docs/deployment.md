# Deployment Notes

- Backend runs on Node.js with PostgreSQL + Redis.
- Use Cloudflare or an equivalent WAF in front of the API.
- Configure environment variables from `.env.example`, then replace all development values before production.
- Run `npm run validate:production` and `npm run db:migrate` before directing mobile traffic to a new backend.
- The backend health endpoint is `GET /api/health`.

## Required Production Environment

- `NODE_ENV=production`
- `DATABASE_URL` or `SUPABASE_DB_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, each at least 32 characters
- `CORS_ORIGINS` with explicit HTTPS origins
- Email OTP through either Supabase auth (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) or Resend (`RESEND_API_KEY` + `OTP_EMAIL_FROM`)
- Phone OTP through Twilio Verify (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`)
- `OTP_BYPASS_CODE` must be empty

## Mobile Production Environment

- `EXPO_PUBLIC_APP_ENV=production`
- `EXPO_PUBLIC_API_BASE_URL` must be a public HTTPS API URL
- `EXPO_PUBLIC_WS_URL` must be a public HTTPS API URL for Socket.IO
- Configure `IOS_BUNDLE_IDENTIFIER`, `IOS_BUILD_NUMBER`, `ANDROID_PACKAGE`, and `ANDROID_VERSION_CODE`
- Configure RevenueCat public SDK keys before enabling paid plans in release builds

## CI/CD

- Build backend container from `apps/backend`.
- Run backend tests before image publish: `npm run test:backend`.
- Run disposable database integration tests before release when a test database is available: `TEST_DATABASE_URL=... npm run test:integration`.
- Run mobile typecheck before release builds: `npm --workspace apps/mobile run typecheck`.
- Validate production config before deployment: `npm run validate:production`.
- Apply database migrations before app rollout: `npm run db:migrate`.
- Smoke-test the deployed API after rollout: `npm run smoke:backend -- https://your-api.example.com`.
- Smoke-test the emergency lifecycle in staging with a disposable user token: `API_BASE_URL=... SMOKE_ACCESS_TOKEN=... npm run smoke:emergency`.
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
API_BASE_URL=https://staging-api.example.com SMOKE_ACCESS_TOKEN=... SMOKE_RESTART_WAIT_MS=30000 npm run smoke:emergency
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
