# JoinDesk Backend

Node.js + Express + Supabase (Postgres + Storage, no Supabase Auth) backend
for JoinDesk. Google sign-in is a direct OAuth popup — no Supabase Auth
provider setup, no redirect callback page.

Desks are joinable, blockable, and "Special"-taggable:
- `desk_joins` tracks who clicked "Join via Google Meet" on which desk.
- `user_blocks` lets any user block another; a blocked-by creator's future
  desks disappear from that user's dashboard and search.
- `special_users` lets a desk creator flag people who've joined their desks
  as "Special", so they get emailed whenever that creator opens a new one.

See section 5 below for the full API surface, and sections 7–9 for how
blocking, Special notifications, and avatar uploads work.

## 1. Google OAuth Client

1. Go to Google Cloud Console -> **APIs & Services -> Credentials**.
2. **Create Credentials -> OAuth client ID -> Web application.**
3. Under **Authorized JavaScript origins**, add your frontend URL(s):
   `http://localhost:3000` (and your prod domain later). No redirect URI
   is needed — this is a popup flow, not a redirect.
4. Copy the **Client ID**. You'll use it as both `GOOGLE_CLIENT_ID` here
   and `VITE_GOOGLE_CLIENT_ID` in the frontend.

## 2. Supabase project (database + storage)

1. Create a project at https://supabase.com.
2. **SQL Editor** -> run `schema.sql` (in this folder). Creates `users`,
   `desks`, `desk_joins`, `user_blocks`, and `special_users` — no auth
   tables involved.
3. **Project Settings -> API** -> copy:
   - `Project URL` -> `SUPABASE_URL`
   - `service_role` secret -> `SUPABASE_SERVICE_ROLE_KEY` (server only)
4. **Storage** -> create a new **public** bucket named `avatars` (see
   section 9 below) — needed for the profile-picture upload feature.

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

| Method | Route                       | Auth | Description |
|--------|-----------------------------|------|-------------|
| POST   | `/api/auth/google`          | none (verifies Google token itself) | Body: `{ access_token }`. Verifies it with Google, upserts the user, returns `{ token, user }`. |
| GET    | `/api/auth/me`               | Bearer token | Returns the current user's profile row. |
| GET    | `/api/desks`                 | optional | Active desks (last 15 days), newest first. If logged in, desks by anyone who has blocked you are excluded. Query: `limit`, `offset`, `search`, `topic`. |
| POST   | `/api/desks`                 | Bearer token | Creates a desk. Body: `{ title, description?, tags?, google_meet_link, topic? }`. Emails anyone you've marked "Special". |
| GET    | `/api/desks/mine`             | Bearer token | All desks *you* created, including expired ones (for your profile page). Query: `limit`, `offset`. |
| POST   | `/api/desks/:id/join`         | Bearer token | Records that you joined this desk (called when "Join via Google Meet" is clicked). Idempotent. |
| GET    | `/api/desks/:id/joiners`      | Bearer token, creator only | Everyone who joined this desk. Query: `search`. Each entry includes `isSpecial`/`isBlocked` flags. |
| GET    | `/api/users/:id`              | optional | Public profile (view-only). Own email is only included when viewing yourself. Includes `isOwner`, `iBlockedThem`, `theyBlockedMe`. |
| GET    | `/api/users/:id/desks`        | optional | That user's desks — full history if it's your own profile, active-only otherwise. Empty if they've blocked you. |
| PATCH  | `/api/users/me/avatar`        | Bearer token | Multipart form, field `avatar`. The only editable profile field. Uploads to Supabase Storage and updates `avatar_url`. |
| POST   | `/api/users/:id/block`        | Bearer token | Blocks a user. Their future desks stop appearing in your dashboard/search. |
| POST   | `/api/users/:id/unblock`      | Bearer token | Reverses a block. |
| GET    | `/api/users/me/blocks`        | Bearer token | List of users you've blocked. |
| POST   | `/api/users/:id/special`      | Bearer token | Marks a user "Special" — they must have joined one of your desks. They'll be emailed whenever you create a new desk. |
| DELETE | `/api/users/:id/special`      | Bearer token | Removes the "Special" mark. |
| GET    | `/api/users/me/special`       | Bearer token | List of users you've marked "Special". |

`Bearer token` = the JWT from the Google sign-in step — the same one the frontend
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

### Example: block a user
```bash
curl -X POST http://localhost:5000/api/users/$OTHER_USER_ID/block \
  -H "Authorization: Bearer $TOKEN"
```

## 6. Notes on the "15-day" desk lifespan

`GET /api/desks` only returns desks with `created_at` within the last 15
days — no cron job or expiry column needed. Matches the "Active Desk (15d
max)" label already in the UI. Your own profile page (`GET /api/desks/mine`)
shows your full history regardless of age.

## 7. Blocking

Blocking is one-directional and keyed off the desk *creator*, not desk
membership: if User 1 blocks User 2, every desk User 1 creates afterward is
hidden from User 2's dashboard, search, and desk count — enforced in
`getDesks`/`getUserDesks` via a `user_blocks` lookup, not in the client.
Blocking can be done from:
- A user's profile page (`/profile/:id`) — the primary entry point.
- The "joiners" popup on your own desk (block someone who joined, right
  from that list).

## 8. "Special" users & email notifications

A desk creator can mark anyone who has joined one of their desks as
"Special" (from the joiners popup on their profile page). From then on,
every new desk they create sends those people an email via
`src/services/email.js`.

This is intentionally zero-config by default: if `SMTP_HOST` / `SMTP_PORT`
/ `SMTP_USER` / `SMTP_PASS` aren't set in `.env`, the app doesn't fail —
it just logs what *would* have been sent to the console. Fill in those four
vars (any SMTP provider — Gmail app password, SendGrid, Resend's SMTP
relay, etc.) to start sending real emails, no code changes required.

## 9. Avatar uploads

Profile pictures are the only editable signup field. To enable uploads:
1. In the Supabase Dashboard, go to **Storage** and create a new bucket
   named `avatars` (must match `SUPABASE_AVATAR_BUCKET` in `.env`, default
   `avatars`) and mark it **Public**.
2. That's it — `PATCH /api/users/me/avatar` (multipart, field `avatar`)
   uploads the file there and updates the user's `avatar_url`.

## 10. Deploying

Any Node 18+ host works (Render, Railway, Fly.io, a VPS...). Set the same
env vars from `.env.example`, add your deployed frontend origin to both
`FRONTEND_URL` here and **Authorized JavaScript origins** on the Google
OAuth client, and point the frontend's `VITE_API_URL` at this backend.
