-- JoinDesk MVP schema
-- Run this in Supabase: Project -> SQL Editor -> New query
--
-- Supabase is used here purely as a Postgres database — auth is handled
-- entirely by our own backend (Google OAuth popup + our own JWT), so
-- there's no dependency on Supabase's auth.users table.

create extension if not exists "pgcrypto";

-- =========================
-- users
-- =========================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  google_id text unique not null,   -- Google's "sub" claim, stable per Google account
  name text not null,
  email text unique not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- =========================
-- desks
-- =========================
-- No desk_members table by design: joining is a direct redirect to
-- google_meet_link on the frontend, nothing to track server-side.
create table if not exists public.desks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  tags text[] not null default '{}',
  topic text not null default 'Research',
  google_meet_link text not null, -- despite the name, any meeting link works (Zoom, Teams, Meet, etc.) — kept as-is for backward compatibility
  creator_id uuid references public.users (id) on delete cascade,
  creator_name text not null,
  creator_avatar text,
  created_at timestamptz not null default now()
);

create index if not exists desks_created_at_idx on public.desks (created_at desc);
create index if not exists desks_creator_id_idx on public.desks (creator_id);

-- =========================
-- desk_joins
-- =========================
-- Records every time a user clicks "Join via Google Meet" on a desk. This
-- powers the "who joined my desk" list on the profile page (View popup),
-- and is the pool of users a desk creator can mark as "Special".
create table if not exists public.desk_joins (
  id uuid primary key default gen_random_uuid(),
  desk_id uuid not null references public.desks (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (desk_id, user_id)
);

create index if not exists desk_joins_desk_id_idx on public.desk_joins (desk_id);
create index if not exists desk_joins_user_id_idx on public.desk_joins (user_id);

-- =========================
-- user_blocks
-- =========================
-- blocker_id blocks blocked_id. Desks created by blocked-by users are
-- filtered out of the blocked user's dashboard/search server-side.
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- =========================
-- special_users
-- =========================
-- owner_id (a desk creator) marks special_user_id as "Special". Every time
-- owner_id creates a new desk, everyone in this list gets an email.
create table if not exists public.special_users (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  special_user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, special_user_id),
  constraint special_users_no_self_special check (owner_id <> special_user_id)
);

create index if not exists special_users_owner_idx on public.special_users (owner_id);

-- =========================
-- push_subscriptions
-- =========================
-- Free browser/phone push notifications (Web Push, VAPID-based — no
-- Firebase, no Google account, no per-message cost, no cap). A user can
-- have several rows (one per device/browser they've enabled notifications
-- on). Replaces the old email-based "Special" notification: this is what
-- POST /api/desks now writes to instead of sending email.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- =========================
-- Feature update: Special Desks + Admin Panel + Platform Block
-- =========================
-- All statements below are idempotent (safe to re-run on an existing
-- database that already has the tables above created).
--
-- `desks.is_special`   -> true for desks created from the Admin Panel and
--                          flagged "Special". These never expire (ignore
--                          the 15-day cutoff) until an admin deletes them,
--                          and hide the creator's name/avatar in the UI.
-- `users.is_blocked`   -> platform-wide ban set by an admin. A blocked
--                          user cannot log in or use the app at all (this
--                          is separate from `user_blocks`, which is the
--                          existing user-to-user block feature).
alter table public.desks add column if not exists is_special boolean not null default false;
alter table public.users add column if not exists is_blocked boolean not null default false;
alter table public.users add column if not exists blocked_at timestamptz;

create index if not exists desks_is_special_idx on public.desks (is_special);
create index if not exists users_is_blocked_idx on public.users (is_blocked);

-- `desks.is_hidden` -> the desk's own creator can hide it from the public
-- dashboard/search (e.g. "I already have enough people in this group")
-- without deleting it. Only the creator can see + toggle it back from
-- their profile; everyone else simply never sees it while hidden.
alter table public.desks add column if not exists is_hidden boolean not null default false;
create index if not exists desks_is_hidden_idx on public.desks (is_hidden);

-- =========================
-- feedback
-- =========================
-- Powers the "Suggestions & Complaints" popup on the dashboard. A
-- complaint can optionally name another user (reported_user_id) — if
-- enough DISTINCT users file a complaint naming the same person, that
-- person is auto-blocked platform-wide (see feedback.controller.js for
-- the threshold, COMPLAINT_AUTO_BLOCK_THRESHOLD).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('suggestion', 'complaint')),
  message text not null,
  reported_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_type_idx on public.feedback (type);
create index if not exists feedback_reported_user_idx on public.feedback (reported_user_id);
create index if not exists feedback_user_idx on public.feedback (user_id);

-- =========================
-- Feature update: Admin feedback workflow + name/desk reporting
-- =========================
-- `feedback.status`            -> admin workflow state for the Admin Panel's
--                                  Feedback tab: 'pending' (not looked at
--                                  yet / "Incomplete"), 'resolved' ("Complete"),
--                                  or 'problem' (admin looked into it but hit
--                                  an issue — needs follow-up before it can
--                                  be marked Complete).
-- `feedback.reported_name`     -> free-text name of the person being
--                                  reported in a complaint (optional).
--                                  Replaces the old `reported_user_id`
--                                  approach: two people meeting on a call
--                                  have no way to see each other's JoinDesk
--                                  User ID, only a name and which desk they
--                                  were in, so that's what we collect now.
--                                  `reported_user_id` is left in place for
--                                  backward compatibility but is no longer
--                                  written by the frontend.
-- `feedback.reported_desk_id`  -> which desk the reported person was in,
--                                  picked from the real desks table (not a
--                                  free-text field) so this always points at
--                                  an actual desk.
alter table public.feedback add column if not exists status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'feedback_status_check'
  ) then
    alter table public.feedback add constraint feedback_status_check
      check (status in ('pending', 'resolved', 'problem'));
  end if;
end $$;

alter table public.feedback add column if not exists reported_name text;
alter table public.feedback add column if not exists reported_desk_id uuid references public.desks (id) on delete set null;

create index if not exists feedback_status_idx on public.feedback (status);
create index if not exists feedback_reported_desk_idx on public.feedback (reported_desk_id);

-- =========================
-- Feature update: Special desk manual ordering (Admin Panel)
-- =========================
-- `desks.position` -> 1-based manual sort order, used ONLY for is_special
-- desks, so an admin can move any Special desk up/down or to an exact spot
-- in the dashboard's Special row/page instead of it always sorting by
-- created_at desc (which used to mean "whatever was created last always
-- shows first"). NULL for normal (non-special) desks — they keep sorting
-- by created_at as before. A brand-new Special desk starts with NO
-- position assigned here in SQL; admin.controller.js assigns
-- "last position + 1" at creation time so it appends to the END of the
-- Special row by default, and the admin can then drag/move it wherever
-- they want (see PATCH /api/admin/desks/:id/move and /position).
alter table public.desks add column if not exists position integer;
create index if not exists desks_position_idx on public.desks (position);

-- One-time backfill: give every EXISTING Special desk (created before this
-- feature existed) a position that matches its current on-screen order
-- (newest first, same as the old created_at-desc sort) — so running this
-- migration doesn't visually reshuffle anything that's already live. Only
-- touches rows where position is still null, so it's safe to re-run.
do $$
declare
  r record;
  i integer := 0;
begin
  for r in
    select id from public.desks
    where is_special = true and position is null
    order by created_at desc
  loop
    i := i + 1;
    update public.desks set position = i where id = r.id;
  end loop;
end $$;

-- =========================
-- Site-wide announcement banner
-- =========================
-- A single admin-editable notice shown to every logged-in user at the top
-- of the dashboard (e.g. "Late-night study session tonight from 10-12").
-- One row per setting key so this table can hold more site-wide settings
-- later without another migration. NULL/empty value = no banner shown.
create table if not exists public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- Seeds today's notice the first time this runs. Uses "do nothing" so it
-- never overwrites a message the admin has already changed via the panel.
insert into public.site_settings (key, value)
values (
  'announcement',
  'Late-night study session from 10 PM to 12 AM. Join us and study with people who share the same goals!'
)
on conflict (key) do nothing;

-- =========================
-- Row Level Security
-- =========================
-- The backend is the ONLY thing that talks to this database, using the
-- service_role key (which bypasses RLS entirely). Since the frontend never
-- queries Supabase directly, RLS is left off here for simplicity — enable
-- it later if you ever expose these tables to direct client access.

-- =========================
-- Feature update: Join tracking, Free access, Razorpay payments
-- =========================
-- Safe to re-run. Run this whole block once in the Supabase SQL Editor.

-- ---- users: trial + subscription + activity counters ----
-- trial_started_at: the free trial (TRIAL_DAYS in .env) counts from here.
--   NOTE: adding this column with `default now()` gives every EXISTING user
--   a fresh trial starting today (so nobody gets locked out the moment you
--   turn the paywall on). If you'd rather existing users start with their
--   trial already used up, run once after this:
--     update public.users set trial_started_at = created_at;
-- subscription_expires_at: set by a successful Razorpay payment.
-- total_joins / last_join_at: cheap counters so the admin can sort users by
--   activity ("dead" users = total_joins = 0) without scanning all events.
alter table public.users add column if not exists trial_started_at timestamptz not null default now();
alter table public.users add column if not exists subscription_expires_at timestamptz;
alter table public.users add column if not exists total_joins integer not null default 0;
alter table public.users add column if not exists last_join_at timestamptz;

create index if not exists users_last_join_at_idx on public.users (last_join_at);
create index if not exists users_total_joins_idx on public.users (total_joins);

-- ---- desk_join_events: EVERY join click, not just the first ----
-- desk_joins (unique per desk+user) is still used for the "People who
-- joined" list. This table is the full log used for the admin analytics
-- (daily/monthly counts, who is frequent, who is dead, Excel export).
-- access_type: how they got in -> 'paid' | 'trial' | 'free_all' |
--              'free_desk' | 'open' (paywall off) | 'legacy' (backfilled).
create table if not exists public.desk_join_events (
  id uuid primary key default gen_random_uuid(),
  desk_id uuid not null references public.desks (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  access_type text
);

create index if not exists desk_join_events_desk_time_idx on public.desk_join_events (desk_id, joined_at desc);
create index if not exists desk_join_events_user_time_idx on public.desk_join_events (user_id, joined_at desc);
create index if not exists desk_join_events_time_idx on public.desk_join_events (joined_at desc);

-- One-time backfill from the old desk_joins table so history isn't empty
-- (only runs while the events table is still empty).
insert into public.desk_join_events (desk_id, user_id, joined_at, access_type)
select desk_id, user_id, joined_at, 'legacy'
from public.desk_joins
where not exists (select 1 from public.desk_join_events);

update public.users u
set total_joins = s.c, last_join_at = s.m
from (
  select user_id, count(*) as c, max(joined_at) as m
  from public.desk_join_events
  group by user_id
) s
where u.id = s.user_id and u.total_joins = 0;

-- ---- access_grants: free access given by the admin ----
-- Keyed by EMAIL (lowercase) so you can grant access even before the
-- person has signed up. scope 'all' = every desk, 'desk' = one desk only.
create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  scope text not null check (scope in ('all', 'desk')),
  desk_id uuid references public.desks (id) on delete cascade,
  note text,
  granted_at timestamptz not null default now(),
  constraint access_grants_scope_desk check (
    (scope = 'all' and desk_id is null) or (scope = 'desk' and desk_id is not null)
  )
);

create unique index if not exists access_grants_all_unique on public.access_grants (email) where scope = 'all';
create unique index if not exists access_grants_desk_unique on public.access_grants (email, desk_id) where scope = 'desk';
create index if not exists access_grants_email_idx on public.access_grants (email);

-- ---- payments: Razorpay orders/payments ----
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  razorpay_order_id text not null unique,
  razorpay_payment_id text,
  amount_paise integer not null,
  currency text not null default 'INR',
  days integer not null,
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz
);

create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
