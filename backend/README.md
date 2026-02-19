# DoDo Backend (FastAPI + Supabase)

Python API server for auth + tasks/categories/habits.

## Environment variables

Create `backend/.env`:

```env
PORT=4000
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
CORS_ORIGIN=*
```

## Run locally

```bash
pip install -r requirements.txt
python run.py
```

## API routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET  /api/auth/me`
- `GET/POST/PATCH/DELETE /api/tasks`
- `GET/POST/PATCH/DELETE /api/categories`
- `GET/POST/PATCH/DELETE /api/habits`
