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
-- Row Level Security
-- =========================
-- The backend is the ONLY thing that talks to this database, using the
-- service_role key (which bypasses RLS entirely). Since the frontend never
-- queries Supabase directly, RLS is left off here for simplicity — enable
-- it later if you ever expose these tables to direct client access.
