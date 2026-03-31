# DoDo App - Commands Reference

A comprehensive guide to building, running, testing, and releasing the DoDo app.

## Table of Contents

- [Initial Setup](#initial-setup)
- [Development](#development)
- [Testing](#testing)
- [Building APK for Release](#building-apk-for-release)
- [Cleaning & Reset](#cleaning--reset)
- [Troubleshooting](#troubleshooting)

---

## Initial Setup

### Install Dependencies

**Initialize the workspace (from root):**

```bash
npm install
```

**Install Android SDK:**

```bash
npx react-native doctor
```

**Setup Python Virtual Environment (for backend):**

```bash
python -m venv .venv
source .venv/Scripts/activate  # Windows
source .venv/bin/activate      # macOS/Linux
pip install -r backend/requirements.txt
```

**Configure Environment Variables:**
Create `.env` files in the root and `dodomobile/` directories with necessary configuration (API_BASE_URL, Supabase credentials, etc.)

---

## Development

### Run Backend (Python API)

**From root directory:**

```bash
npm run backend:dev
```

**Or directly (from backend directory):**

```bash
cd backend
python run.py
```

The backend API will run on `http://localhost:8000` (or configured port in settings)

### Start Metro Bundler (React Native)

**From root directory:**

```bash
npm run mobile:start
```

**Or from dodomobile directory:**

```bash
cd dodomobile
npm start
```

### Run Mobile App on Android Emulator

**From root directory (starts bundler + app):**

```bash
npm run mobile:android
```

**Or from dodomobile directory:**

```bash
cd dodomobile
npx react-native run-android
```

**Note:** For emulator to reach localhost backend, use `http://10.0.2.2:<port>` as API URL

### Run Mobile App on iOS Simulator

**From root directory:**

```bash
npm run mobile:ios
```

**Or from dodomobile directory:**

```bash
cd dodomobile
npx react-native run-ios
```

### Run Both Backend & Frontend Concurrently

**Option 1: Open two terminals - one for each:**

- Terminal 1: `npm run backend:dev`
- Terminal 2: `npm run mobile:start` (or `npm run mobile:android`)

**Option 2: Use npm concurrently (if configured):**

```bash
npm run dev  # Requires script setup in root package.json
```

---

## Testing

### Type Check TypeScript

**From root:**

```bash
npm run mobile:typecheck
```

**Or from dodomobile:**

```bash
cd dodomobile
npm run typecheck
```

### Run Unit Tests

**From dodomobile:**

```bash
npm test
```

**Run tests in watch mode:**

```bash
npm test -- --watch
```

### Linting

**Check for linting issues:**

```bash
npm run lint
```

---

## Building APK for Release

### Build Release APK (APK Bundle)

**From dodomobile directory:**

```bash
cd dodomobile
npx react-native build-android --mode release
```

**Or using Gradle directly:**

```bash
cd android
./gradlew assembleRelease
```

The APK will be generated at:

```
dodomobile/android/app/build/outputs/apk/release/app-release.apk
```

### Build App Bundle (AAB) for Google Play Store

**From dodomobile directory:**

```bash
cd dodomobile/android
./gradlew bundleRelease
```

The bundle will be generated at:

```
dodomobile/android/app/build/outputs/bundle/release/app-release.aab
```

### Build APK with Specific Architecture

**For ARM64 only (modern devices):**

```bash
cd dodomobile/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

**For all architectures (default):**

```bash
cd dodomobile/android
./gradlew assembleRelease
```

Supported architectures: `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`

### Sign APK for Release

**First time - generate a keystore:**

```bash
keytool -genkey -v -keystore my-release-key.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```

The keystore will be used for signing in `android/app/build.gradle`

---

## Cleaning & Reset

### Clean Android Build

**From dodomobile:**

```bash
cd dodomobile/android
./gradlew clean
```

### Clean Node Modules

**From dodomobile:**

```bash
cd dodomobile
rm -rf node_modules
npm install
```

**From root:**

```bash
rm -rf node_modules dodomobile/node_modules
npm install
```

### Reset Android Emulator

```bash
emulator -avd <emulator_name> -wipe-data
```

### Clear Metro Bundler Cache

```bash
npx react-native start --reset-cache
```

### Clean Everything (Full Reset)

```bash
# From root
npm install
cd dodomobile
npm install
cd ../backend
pip install -r requirements.txt
```

---

## Troubleshooting

### Java/JDK Issues

**Install correct JDK:**

```bash
# Check current JDK
java -version
javac -version
```

For React Native 0.74, ensure JDK 17+ is installed.

### Metro Bundler Won't Start

```bash
# Kill any existing processes
lsof -i :8081  # macOS/Linux
netstat -ano | findstr :8081  # Windows

# Clear cache and restart
npx react-native start --reset-cache
```

### Android Build Fails

```bash
# Clean and rebuild
cd dodomobile/android
./gradlew clean
./gradlew assembleRelease
```

### Virtual Device Issues

```bash
# List available emulators
emulator -list-avds

# Start specific emulator
emulator -avd <emulator_name>
```

### Python Virtual Environment Issues

```bash
# Deactivate and remove
deactivate
rm -rf .venv

# Recreate
python -m venv .venv
source .venv/Scripts/activate  # Windows
pip install -r backend/requirements.txt
```

### API Connection Issues

**For emulator:** Use `http://10.0.2.2:8000` instead of `localhost:8000`

**For physical device:** Use your machine's LAN IP address (e.g., `http://192.168.x.x:8000`)

Check your `.env` configuration in `dodomobile/`

---

## Additional Resources

- [React Native Documentation](https://reactnative.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Android Studio Setup Guide](https://developer.android.com/studio)
- [Supabase Documentation](https://supabase.io/docs)

---

## Quick Cheat Sheet

| Task                   | Command                                              |
| ---------------------- | ---------------------------------------------------- |
| Start backend          | `npm run backend:dev`                                |
| Start mobile bundler   | `npm run mobile:start`                               |
| Run on Android         | `npm run mobile:android`                             |
| Run on iOS             | `npm run mobile:ios`                                 |
| Type check             | `npm run mobile:typecheck`                           |
| Run tests              | `npm test`                                           |
| Build release APK      | `cd dodomobile/android && ./gradlew assembleRelease` |
| Build App Bundle (AAB) | `cd dodomobile/android && ./gradlew bundleRelease`   |
| Clean build            | `cd dodomobile/android && ./gradlew clean`           |
| Reset cache            | `npx react-native start --reset-cache`               |
