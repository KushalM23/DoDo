# DoDo Starter Template (React Native + Supabase + Express)

Starter for the assignment in `assignment.txt`.

## Repo layout

- `backend/`: Express API (TypeScript) + Supabase auth verification.
- `dodomobile/`: runnable React Native app (screens/state/services + Android/iOS native folders).
- `mobile/`: legacy scaffold folder (no longer the primary runnable app).
- `supabase/schema.sql`: DB schema + RLS policies.

## 1) Setup Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL editor.

## 2) Setup backend env and run backend

1. Create env:
   - PowerShell: `Copy-Item backend/.env.example backend/.env`
2. Fill `backend/.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CORS_ORIGIN`
   - `PORT` (optional, defaults to `4000`)
3. Run backend from repo root:

```bash
npm install
npm run backend:dev
```

If using Render, set mobile `API_BASE_URL` to your Render URL:
`https://<your-service>.onrender.com/api`.

## 3) Setup mobile env (`dodomobile`)

1. Create env:
   - PowerShell: `Copy-Item dodomobile/.env.example dodomobile/.env`
2. Fill `dodomobile/.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `API_BASE_URL`

Use one of these for `API_BASE_URL`:
- Render backend: `https://<your-service>.onrender.com/api`
- Local backend on same machine: `http://localhost:4000/api` (with `adb reverse` in step 4)

## 4) Run on Android phone (USB)

Prerequisites:
- Android Studio + Android SDK Platform Tools installed.
- `java` and `adb` available in terminal.
- USB debugging enabled on phone.

Commands:

```bash
cd dodomobile
npm install
adb devices
adb reverse tcp:8081 tcp:8081
adb reverse tcp:4000 tcp:4000
npx react-native start
```

Open a second terminal:

```bash
cd dodomobile
npx react-native run-android
```

Notes:
- Keep Metro (`npx react-native start`) running while testing.
- If backend is on Render, you can skip `adb reverse tcp:4000 tcp:4000`.

## 5) Quick checks if Android build fails

- `JAVA_HOME` not set: install JDK (or Android Studio JBR) and set `JAVA_HOME`.
- `adb` not found: add `.../Android/Sdk/platform-tools` to `PATH`.
- Device not detected: run `adb devices`, reconnect USB, accept RSA prompt on phone.
