# Backend Deployment (Render)

This Express + TypeScript API is built for Supabase-backed auth. To deploy on Render:

1. **Connect repo** and choose `Node` service.
2. **Build command:** `npm run build` (postinstall already runs `npm run build` automatically).
3. **Start command:** `npm run start`.
4. **Environment variables to set on Render**:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CORS_ORIGIN` (set to the URL(s) that will call this API, e.g., your Expo app or dev machine)
   - `PORT` (Render automatically provides this; no need to override unless you want a fixed value)
5. **Node version:** Render will use `node` from the `engines` field (`20.x`).

Render exposes `PORT` and sets it automatically; the server already reads `process.env.PORT` with a `4000` fallback.

You can validate the deployment via `GET https://{service-name}.onrender.com/api/health`.
