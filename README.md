# Sentinel WatchTower Mobile (React Native)

This folder is now configured as the mobile application codebase using Expo + React Native.

## Implemented App Structure

- Bottom navigation tabs:
  - `Home`
  - `Risk Log`
  - `Account`
- Home-only side navigation (drawer):
  - `Home`
  - `Safety Feed`
  - `Watch History`
  - `Settings`
- Home screen:
  - Live map (`react-native-maps`)
  - Foreground location permission request (`expo-location`)
  - Auto-follow toggle enabled after permission grant
  - Primary `Send Alert` button connected to backend `POST /api/alerts`
- Risk Log screen:
  - Pull-to-refresh incident feed connected to backend `GET /api/risk-log`
- Responsive behavior:
  - Device categories: `compact`, `phone`, `tablet`
  - Shared sizing tokens used across screens for spacing, typography, and controls

## Run

1. Install dependencies:
   - `npm install`
2. Start the app:
   - `npm run start`
3. Open target platform:
   - `npm run android`
   - `npm run ios`
   - `npm run web`

## API Configuration

Set your backend base URL before starting Expo:

- Windows CMD:
  - `set EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:3000`
- macOS/Linux:
  - `export EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:3000`

Default fallback is `http://localhost:3000`.

## Supabase Twin-Platform Configuration

Risk Log can read directly from the same Supabase database as your web platform.

Set these env vars before starting Expo:

- Windows CMD:
  - `set EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co`
  - `set EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY`
  - `set EXPO_PUBLIC_RISK_LOG_TABLE=alerts`
  - `set EXPO_PUBLIC_RISK_LOG_ORDER_COLUMN=created_at`
- macOS/Linux:
  - `export EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co`
  - `export EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY`
  - `export EXPO_PUBLIC_RISK_LOG_TABLE=alerts`
  - `export EXPO_PUBLIC_RISK_LOG_ORDER_COLUMN=created_at`

Behavior:

- If Supabase env vars are set, `Risk Log` reads from Supabase directly and subscribes to realtime table changes.
- If not set, `Risk Log` falls back to backend API `GET /api/risk-log`.
- `Send Alert` stays API-first (`POST /api/alerts`) as recommended.

## Endpoint Contract

- Send alert:
  - `POST /api/alerts`
  - Body: `{ latitude, longitude, source, createdAt }`
- Risk log:
  - `GET /api/risk-log?limit=50`
  - Accepts response as array, `{ items: [] }`, or `{ data: [] }`

## Main Files

- `App.js`
- `src/navigation/AppNavigator.js`
- `src/screens/HomeScreen.js`
- `src/screens/RiskLogScreen.js`
- `src/screens/AccountScreen.js`
- `src/screens/DrawerPageScreen.js`
- `src/theme/responsive.js`
