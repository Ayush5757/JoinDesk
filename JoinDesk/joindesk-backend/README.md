# JoinDesk Backend (MVP)

Node.js + Express + Supabase (Postgres only, no Supabase Auth) backend for
JoinDesk. Google sign-in is a direct OAuth popup — no Supabase Auth
provider setup, no redirect callback page.

No `desk_members` table, no join-tracking — joining a desk is just the
frontend opening `google_meet_link` in a new tab.

## 1. Google OAuth Client

1. Go to Google Cloud Console -> **APIs & Services -> Credentials**.
2. **Create Credentials -> OAuth client ID -> Web application.**
3. Under **Authorized JavaScript origins**, add your frontend URL(s):
   `http://localhost:3000` (and your prod domain later). No redirect URI
   is needed — this is a popup flow, not a redirect.
4. Copy the **Client ID**. You'll use it as both `GOOGLE_CLIENT_ID` here
   and `VITE_GOOGLE_CLIENT_ID` in the frontend.

## 2. Supabase project (database only)

1. Create a project at https://supabase.com.
2. **SQL Editor** -> run `schema.sql` (in this folder). Just `users` and
   `desks`, no auth tables involved.
3. **Project Settings -> API** -> copy:
   - `Project URL` -> `SUPABASE_URL`
   - `service_role` secret -> `SUPABASE_SERVICE_ROLE_KEY` (server only)

## 3. Configure & run

```bash
cd backend
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID,
# JWT_SECRET (generate one: openssl rand -base64 48), FRONTEND_URL
npm install
npm run dev
```

Requires Node 18+ (uses the built-in `fetch`). Server starts on
`http://localhost:5000`. Health check: `GET /health`.

## 4. How the auth flow works

1. Frontend calls Google's Identity Services popup directly — user picks a
   Google account, grants `openid email profile`. Google hands the
   frontend an **access token**.
2. Frontend sends that access token to `POST /api/auth/google`.
3. Backend verifies the token really was issued for this app (checks
   `aud` via Google's tokeninfo endpoint), then fetches the profile from
   Google's userinfo endpoint.
4. Backend upserts the user into `public.users` (keyed on Google's stable
   account id) and issues **its own JWT**, signed with `JWT_SECRET`.
5. Frontend stores that JWT in `localStorage['auth_token']` and sends it
   as `Authorization: Bearer <token>` on every future request. This
   backend never sees or trusts a Supabase session — it's 100% our own.

## 5. API Reference

| Method | Route              | Auth | Description |
|--------|--------------------|------|-------------|
| POST   | `/api/auth/google` | none (verifies Google token itself) | Body: `{ access_token }`. Verifies it with Google, upserts the user, returns `{ token, user }`. |
| GET    | `/api/auth/me`     | Bearer token | Returns the current user's profile row. |
| GET    | `/api/desks`       | none | Returns all active desks (created in the last 3 hours), newest first. |
| POST   | `/api/desks`       | Bearer token | Creates a desk. Body: `{ title, description?, tags?, google_meet_link, topic? }` |

`Bearer token` = the JWT from step 4 above — the same one the frontend
stores in `localStorage['auth_token']`.

### Example: create a desk
```bash
curl -X POST http://localhost:5000/api/desks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "DSA Sprint",
    "description": "Solving graphs for an hour",
    "tags": ["dsa", "leetcode"],
    "topic": "DSA & Coding",
    "google_meet_link": "https://meet.google.com/abc-defg-hij"
  }'
```

## 6. Notes on the "3-hour" desk lifespan

`GET /api/desks` only returns desks with `created_at` within the last 3
hours — no cron job or expiry column needed. Matches the "Active Desk (3h
max)" label already in the UI.

## 7. Deploying

Any Node 18+ host works (Render, Railway, Fly.io, a VPS...). Set the same
env vars from `.env.example`, add your deployed frontend origin to both
`FRONTEND_URL` here and **Authorized JavaScript origins** on the Google
OAuth client, and point the frontend's `VITE_API_URL` at this backend.
