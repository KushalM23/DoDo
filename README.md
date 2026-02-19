# DoDo (React Native + Supabase + FastAPI)

DoDo mobile app with a FastAPI backend and Supabase as the backend service.

## Project structure

- `dodomobile/`: React Native app (frontend only)
- `backend/`: FastAPI server (auth + tasks/categories/habits)
- `supabase/schema.sql`: database schema to run in Supabase SQL editor

## 1) Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.

## 2) Backend setup

1. Create env file:
   - PowerShell: `Copy-Item backend/.env.example backend/.env`
2. Fill `backend/.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `CORS_ORIGIN`
   - `PORT` (optional, defaults to `4000`)
3. Install dependencies and start backend:

```bash
cd backend
pip install -r requirements.txt
python run.py
```

## 3) Mobile setup

1. Create env file:
   - PowerShell: `Copy-Item dodomobile/.env.example dodomobile/.env`
2. Fill `dodomobile/.env`:
   - `API_BASE_URL` (example: `http://10.0.2.2:4000/api` for Android emulator)
3. Run app:

```bash
cd dodomobile
npm install
npx react-native start
```

In a second terminal:

```bash
cd dodomobile
npx react-native run-android
```
