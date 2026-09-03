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
alter table scans  enable row level security;

-- Anon (doorkeeper) can read guests to verify tickets
create policy "Anon can read guests"
  on guests for select
  to anon
  using (true);

-- Anon (doorkeeper) can log scans
create policy "Anon can insert scans"
  on scans for insert
  to anon
  with check (true);

-- Anon can read scans (needed to detect duplicates)
create policy "Anon can read scans"
  on scans for select
  to anon
  using (true);

-- Authenticated (admin) can do everything
create policy "Admin full access guests"
  on guests for all
  to authenticated
  using (true)
  with check (true);

create policy "Admin full access scans"
  on scans for all
  to authenticated
  using (true)
  with check (true);
