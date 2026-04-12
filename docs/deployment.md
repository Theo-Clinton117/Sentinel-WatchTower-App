# Deployment Notes

- Backend runs on Node.js with PostgreSQL + Redis.
- Use Cloudflare for CDN + WAF in front of API and media bucket.
- Use S3-compatible storage for media uploads.
- Configure environment variables from `.env.example`.

## CI/CD
- Build backend container from `apps/backend`.
- Deploy to AWS or GCP with autoscaling.
- Use managed Postgres and Redis where possible.
