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
  google_meet_link text not null,
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
-- Row Level Security
-- =========================
-- The backend is the ONLY thing that talks to this database, using the
-- service_role key (which bypasses RLS entirely). Since the frontend never
-- queries Supabase directly, RLS is left off here for simplicity — enable
-- it later if you ever expose these tables to direct client access.
