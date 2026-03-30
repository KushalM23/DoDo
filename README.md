# DoDo

DoDo is a mobile productivity app that combines task planning and habit tracking in one place.  
It is built with React Native (mobile), FastAPI (API), and Supabase (auth + Postgres).

![DoDo cover](Dodo.jpg)

## What this project does

DoDo helps users plan daily work, build routines, and stay consistent with a light gamification layer.

Users can:

- Create and organize tasks by date, priority, and category.
- Start/stop timers and complete tasks with undo support.
- Create recurring habits (daily, interval-based, or selected weekdays).
- Track streaks, completion history, and profile stats.
- Earn XP and level up from completed tasks and habits.
- Manage account settings, password changes, and preferences.

## Project architecture (high level)

- `dodomobile/`  
  React Native client (Android/iOS), local state via context providers, and API calls to backend.
- `backend/`  
  FastAPI API for auth, tasks, categories, habits, timers, streak logic, and XP progression.
- `supabase/schema.sql`  
  Database schema, indexes, row-level security (RLS) policies, and profile trigger setup.

## Repository structure

- `README.md` - main project overview and setup
- `backend/README.md` - backend-specific notes
- `backend/app/routes/` - API endpoints
- `dodomobile/src/screens/` - app screens
- `dodomobile/src/state/` - app state/context
- `render.yaml`, `Procfile` - deployment config for backend

## Quick start

### 1. Prerequisites

- Node.js 18+
- Python 3.11 (project runtime is `3.11.10`)
- React Native Android/iOS environment (based on your target platform)
- A Supabase project

### 2. Set up Supabase

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql` to create tables, policies, and triggers.

### 3. Configure and run backend

1. Create env file:
   - PowerShell: `Copy-Item backend/.env.example backend/.env`
2. Update `backend/.env` values:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `CORS_ORIGIN` (for local mobile dev, `http://localhost:8081` works)
   - `PORT` (optional, default: `4000`)
   - `SUPABASE_SERVICE_ROLE_KEY` (optional, needed for delete-account endpoint)
3. Start backend:

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Or from repo root:

```bash
npm run backend:dev
```

### 4. Configure and run mobile app

1. Create env file:
   - PowerShell: `Copy-Item dodomobile/.env.example dodomobile/.env`
2. Set `API_BASE_URL` in `dodomobile/.env`.

   - Android emulator: `http://10.0.2.2:4000/api`
   - iOS simulator: `http://localhost:4000/api`
   - Physical device: `http://<your-machine-local-ip>:4000/api`

3. Install dependencies:

```bash
npm install
```

4. Start Metro:

```bash
npm start
```

5. Run app:

```bash
npm run android
```

On macOS, you can also run:

```bash
npm run ios
```

## Core API groups

- Auth: register, login, current user, change password, delete account
- Notifications: upsert/delete authenticated device FCM token
- Tasks: CRUD, date/range filtering, completion and timer flow
- Categories: CRUD with color/icon constraints
- Habits: CRUD, history, start/pause timer, complete/uncomplete, streak updates

## Push notifications setup (Firebase Messaging + Notifee)

### 1. Install dependencies

From repository root:

```bash
npm --prefix dodomobile install
```

### 2. Firebase Console setup

1. Create a Firebase project (or reuse existing).
2. Add Android app with package name `com.rn_native`.
3. Add iOS app with bundle id matching `rn_native` target bundle id.
4. Download config files:
   - `google-services.json` -> place in `dodomobile/android/app/google-services.json`
   - `GoogleService-Info.plist` -> place in `dodomobile/ios/rn_native/GoogleService-Info.plist`
5. In Firebase Cloud Messaging, enable APNs key/certificate for iOS delivery.

### 3. iOS native checklist

1. In Xcode, open `dodomobile/ios/rn_native.xcworkspace`.
2. Under Signing & Capabilities, add:
   - Push Notifications
   - Background Modes -> Remote notifications
3. Install pods:

```bash
cd dodomobile/ios
pod install
```

### 4. Android native checklist

1. Ensure `dodomobile/android/app/google-services.json` exists.
2. Build with Gradle sync via React Native CLI:

```bash
npm --prefix dodomobile run android
```

### 5. Runtime behavior implemented

- App requests notification permissions (Android 13+/iOS).
- Foreground remote messages are displayed via Notifee.
- Data-only background messages are displayed via Notifee.
- Notification taps support routing with payload data (`screen`, `taskId`, `habitId`).
- FCM token is fetched, refreshed, and synced to backend when user is authenticated.

### 6. Sample FCM payload for manual testing

Use Firebase Console test message or HTTP v1 API with a device token:

```json
{
  "message": {
    "token": "<FCM_DEVICE_TOKEN>",
    "notification": {
      "title": "Task Reminder",
      "body": "Complete your daily focus session."
    },
    "data": {
      "screen": "TaskDetail",
      "taskId": "<task-uuid>",
      "channelId": "dodo-task-reminders"
    }
  }
}
```

Expected result:

- Foreground: custom Notifee notification shown.
- Background/quit: notification appears in system tray.
- Tap: app opens and navigates to target route when payload is valid.

## Notes

- User data is protected via Supabase row-level security policies.
- Mobile app expects backend base URL under `API_BASE_URL`.
- Basic tests exist in `dodomobile/__tests__/App.test.tsx`; run with `npm --prefix dodomobile test`.
