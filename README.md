# Sentinel WatchTower

Monorepo for the Sentinel WatchTower mobile app (Expo) and backend (NestJS).

**Quick Start**
1. Install dependencies at the root and per app.
2. Create `.env` from `.env.example`.
3. Run dev servers:

- Backend: `npm run dev:backend`
- Mobile: `npm run dev:mobile`

**Structure**
- `apps/backend` NestJS API, WebSocket gateway, BullMQ workers
- `apps/mobile` Expo app with Zustand + React Query
- `db` PostgreSQL schema + migrations
- `docs` API, WebSocket, deployment notes

**Requirements Covered**
- Panic alert flow, escalation timers, background location tracking
- Rate limiting and device binding
- Google Maps, FCM, Twilio, Paystack/Flutterwave integration hooks
- Black/blue theme with red blare animation overlay
