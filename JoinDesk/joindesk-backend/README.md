# JoinDesk Backend

Node.js + Express + Supabase (Postgres + Storage, no Supabase Auth) backend
for JoinDesk. Google sign-in is a direct OAuth popup — no Supabase Auth
provider setup, no redirect callback page.

Desks are joinable, blockable, and "Special"-taggable:
- `desk_joins` tracks who clicked "Join via Google Meet" on which desk.
- `user_blocks` lets any user block another; a blocked-by creator's future
  desks disappear from that user's dashboard and search.
- `special_users` lets a desk creator flag people who've joined their desks
  as "Special", so they get a free push notification whenever that creator
  opens a new one (see section 8 — this used to be email, now it's Web Push).

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
   `desks`, `desk_joins`, `user_blocks`, `special_users`, and
   `push_subscriptions` — no auth tables involved.
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
| POST   | `/api/desks`                 | Bearer token | Creates a desk. Body: `{ title, description?, tags?, google_meet_link, topic? }`. `google_meet_link` accepts a link from ANY platform — Google Meet, Zoom, Microsoft Teams, Skype, Webex, etc. — the field name is kept for backward compatibility. Push-notifies anyone you've marked "Special" who has notifications enabled. |
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
| GET    | `/api/push/vapid-public-key`  | none | Returns `{ publicKey, configured }` — the frontend uses this to subscribe the browser to push. |
| POST   | `/api/push/subscribe`         | Bearer token | Body: `{ subscription }` (the browser's `PushSubscription.toJSON()`). Saves it against the logged-in user. |
| POST   | `/api/push/unsubscribe`       | Bearer token | Body: `{ endpoint }`. Removes that device's subscription. |

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

## 8. "Special" users & push notifications

A desk creator can mark anyone who has joined one of their desks as
"Special" (from the joiners popup on their profile page). From then on,
every new desk they create sends those people a **free push
notification** (the native browser/phone "you have a notification" popup)
via `src/services/push.js` — the same technology behind Chrome/Firefox
site notifications and Android app notifications.

This uses the **Web Push API with VAPID keys** — not Firebase, not any
Google product, and not a paid service of any kind. There is no signup,
no per-message cost, and no cap on how many people you can notify; you
just generate a keypair once and paste it into `.env`.

**One-time setup (takes 2 minutes):**

1. In `backend/`, run:
   ```bash
   npx web-push generate-vapid-keys
   ```
   This prints a `Public Key` and a `Private Key`. It runs entirely on
   your machine — no account, no website, no external service involved.
2. Add these to your `.env`:
   ```
   VAPID_PUBLIC_KEY=<the public key it printed>
   VAPID_PRIVATE_KEY=<the private key it printed>
   VAPID_SUBJECT=mailto:your-email@example.com
   ```
   `VAPID_SUBJECT` just needs to be a `mailto:` address or a URL — push
   services use it to contact you if your server is ever misbehaving.
3. Restart the backend. That's it.

Like the old email flow, this is zero-config safe by default: if
`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` aren't set, `createDesk` doesn't
fail — it just logs what *would* have been pushed to the console.

**How a user starts receiving notifications:** the frontend automatically
asks for notification permission right after login (the native
browser/phone popup) and, if granted, registers a subscription against
`POST /api/push/subscribe`. Nothing the desk creator or the "Special" user
needs to configure manually beyond allowing that one permission prompt.

**A note on iOS:** Apple only allows web push to iPhones/iPads if the site
has been "Added to Home Screen" first (this project's `site.webmanifest`
already supports that) — a plain Safari tab can't receive push on iOS.
Android, and desktop Chrome/Firefox/Edge, work in a normal browser tab
with no extra steps.

## 9. Avatar uploads

Profile pictures are the only editable signup field. To enable uploads:
1. In the Supabase Dashboard, go to **Storage** and create a new bucket
   named `avatars` (must match `SUPABASE_AVATAR_BUCKET` in `.env`, default
   `avatars`) and mark it **Public**.
2. That's it — `PATCH /api/users/me/avatar` (multipart, field `avatar`)
   uploads the file there and updates the user's `avatar_url`.

## 10a. Special Desks & the Admin Panel

Two extra things live on top of the MVP: **Special desks** (permanent,
admin-curated desks with no 15-day expiry and no visible creator identity)
and a password-gated **Admin Panel** to manage them and to ban abusive
users platform-wide.

1. Add to `.env`:
   ```
   ADMIN_PASSWORD=Asha@0507$$19992003
   ```
   If you don't set this, the backend falls back to the same password
   above, so the feature works immediately — set your own for a real
   deployment.
2. Any signed-in Google account that enters this password at `POST
   /api/admin/unlock` gets a short-lived (12h) admin session token — it is
   NOT tied to a specific email, matching the "I might log in with a
   different account and still need the admin panel" requirement.
3. New endpoints (all under `/api/admin`, require the admin token from
   step 2 as `Authorization: Bearer <adminToken>`, except `/unlock` which
   needs a normal login token):
   - `POST /api/admin/unlock` — body `{ password }` → `{ adminToken }`.
   - `GET /api/admin/desks` — every desk, Special or not, expired or not.
     Query: `search`, `special` (`true`/`false`), `limit`, `offset`.
   - `POST /api/admin/desks` — create a desk. Body: `{ title, description?,
     google_meet_link, topic?, is_special? }`. When `is_special: true` the
     desk never expires and shows as "JoinDesk" instead of your name.
   - `GET /api/admin/users` — search/list users. Query: `search`, `limit`,
     `offset`. Each row includes `is_blocked`.
   - `POST /api/admin/users/:id/block` / `POST /api/admin/users/:id/unblock`
     — platform-wide ban. A blocked user can't log in
     (`POST /api/auth/google` rejects them) and every other authenticated
     request 403s with `{ error: "blocked", blocked: true }` immediately,
     even mid-session — the frontend shows a full "you've been blocked"
     screen instead of the app.
   - Editing/deleting any desk (including Special ones) reuses the normal
     `PATCH /api/desks/:id` and `DELETE /api/desks/:id` routes — send the
     admin token there instead of a normal session token and you get
     write access to every desk, not just your own.
4. Regular users are unaffected: `POST /api/desks` (their normal "Create
   Desk" button) always creates `is_special: false` desks with the usual
   15-day lifespan, and they can edit only their own desks via
   `PATCH /api/desks/:id` with their normal login token.
5. `GET /api/desks/special` (public) lists Special desks only — no
   15-day cutoff — for the dashboard's Special Desks row and the `/special`
   page.
6. Any desk creator can hide/unhide their own desk from the public
   dashboard without deleting it — `PATCH /api/desks/:id` with
   `{ "is_hidden": true }` (or `false`). A hidden desk stays fully intact
   (joiners, join link, etc.) and only its creator sees it while hidden.

## 10a-2. Suggestions & Complaints (`/api/feedback`)

Powers the "Suggestions & Complaints" popup on the dashboard.

- `POST /api/feedback` (requires login) — body:
  `{ type: "suggestion" | "complaint", message, reported_user_id? }`.
  `reported_user_id` is the target's User ID (visible in the URL of their
  profile page, `/profile/<id>`) and only applies to complaints.
- **Auto-block:** once `COMPLAINT_AUTO_BLOCK_THRESHOLD` (env var, default
  `3`) *different* users have filed a complaint naming the same
  `reported_user_id`, that account is blocked platform-wide automatically
  — same effect as an admin blocking them from the Admin Panel. One person
  spamming complaints about someone doesn't count; it's distinct
  reporters.
- `GET /api/admin/feedback` (admin token) — review everything that's come
  in, with the reporter's and reported user's name/email attached. Query:
  `type` (`suggestion`/`complaint`), `limit`, `offset`. If an auto-block
  looks wrong, unblock the person from the Admin Panel's Users tab.

## 10b. Deploying

Any Node 18+ host works (Render, Railway, Fly.io, a VPS...). Set the same
env vars from `.env.example`, add your deployed frontend origin to both
`FRONTEND_URL` here and **Authorized JavaScript origins** on the Google
OAuth client, and point the frontend's `VITE_API_URL` at this backend.
