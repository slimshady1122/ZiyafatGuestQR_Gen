-- ============================================================
-- QR Guest Scanner — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Guests table
create table if not exists guests (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  party_size  int  not null default 1 check (party_size >= 1 and party_size <= 50),
  email       text,
  notes       text,
  created_at  timestamptz default now()
);

-- Optional second admin dataset. Users with user_metadata.dataset = 'demo'
-- can access this table through the admin UI.
create table if not exists demo_guests (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  party_size  int not null default 1 check (party_size >= 1 and party_size <= 50),
  email       text,
  notes       text,
  created_at  timestamptz default now()
);

-- 2. Scans table — logs every scan attempt
create table if not exists scans (
  id          uuid primary key default gen_random_uuid(),
  guest_id    uuid references guests(id) on delete cascade,
  scanned_at  timestamptz default now(),
  status      text not null check (status in ('valid', 'already_scanned', 'invalid'))
);

-- 3. Indexes for fast lookups
create index if not exists scans_guest_id_idx on scans(guest_id);
create index if not exists scans_status_idx   on scans(status);

-- ============================================================
-- 4. Row Level Security
--    Doorkeepers hit the API without auth (anon key).
--    We allow anon to SELECT guests and INSERT scans.
--    Only authenticated users (admins) can manage guests.
-- ============================================================

alter table guests enable row level security;
alter table demo_guests enable row level security;
alter table scans  enable row level security;

-- Anon (doorkeeper) can read guests to verify tickets
drop policy if exists "Anon can read guests" on guests;
create policy "Anon can read guests"
  on guests for select
  to anon
  using (true);

-- Anon (doorkeeper) can log scans
drop policy if exists "Anon can insert scans" on scans;
create policy "Anon can insert scans"
  on scans for insert
  to anon
  with check (true);

-- Anon can read scans (needed to detect duplicates)
drop policy if exists "Anon can read scans" on scans;
create policy "Anon can read scans"
  on scans for select
  to anon
  using (true);

-- Authenticated (admin) can do everything
drop policy if exists "Admin full access guests" on guests;
create policy "Admin full access guests"
  on guests for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'dataset') is distinct from 'demo')
  with check ((auth.jwt() -> 'user_metadata' ->> 'dataset') is distinct from 'demo');

drop policy if exists "Demo admin full access demo guests" on demo_guests;
create policy "Demo admin full access demo guests"
  on demo_guests for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'dataset') = 'demo')
  with check ((auth.jwt() -> 'user_metadata' ->> 'dataset') = 'demo');

drop policy if exists "Admin full access scans" on scans;
create policy "Admin full access scans"
  on scans for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'dataset') is distinct from 'demo')
  with check ((auth.jwt() -> 'user_metadata' ->> 'dataset') is distinct from 'demo');
