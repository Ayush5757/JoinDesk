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

-- =========================
-- Row Level Security
-- =========================
-- The backend is the ONLY thing that talks to this database, using the
-- service_role key (which bypasses RLS entirely). Since the frontend never
-- queries Supabase directly, RLS is left off here for simplicity — enable
-- it later if you ever expose these tables to direct client access.
