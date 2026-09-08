-- Demo data for testing the scanner and the separate demo admin dataset.
-- Run this after supabase-schema.sql in the Supabase SQL Editor.

create table if not exists public.demo_guests (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  party_size  int not null default 1 check (party_size >= 1 and party_size <= 50),
  email       text,
  notes       text,
  created_at  timestamptz default now()
);

alter table public.demo_guests enable row level security;

create table if not exists public.demo_scans (
  id          uuid primary key default gen_random_uuid(),
  guest_id    uuid references public.demo_guests(id) on delete cascade,
  scanned_at  timestamptz default now(),
  status      text not null check (status in ('valid', 'already_scanned', 'invalid'))
);

create index if not exists demo_scans_guest_id_idx on public.demo_scans(guest_id);
create index if not exists demo_scans_status_idx on public.demo_scans(status);

drop policy if exists "Anon can read demo guests" on public.demo_guests;
create policy "Anon can read demo guests"
  on public.demo_guests for select
  to anon
  using (true);

drop policy if exists "Admin full access guests" on public.guests;
create policy "Admin full access guests"
  on public.guests for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'dataset') is distinct from 'demo')
  with check ((auth.jwt() -> 'user_metadata' ->> 'dataset') is distinct from 'demo');

drop policy if exists "Admin full access scans" on public.scans;
create policy "Admin full access scans"
  on public.scans for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'dataset') is distinct from 'demo')
  with check ((auth.jwt() -> 'user_metadata' ->> 'dataset') is distinct from 'demo');

drop policy if exists "Demo admin full access demo guests" on public.demo_guests;
create policy "Demo admin full access demo guests"
  on public.demo_guests for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'dataset') = 'demo')
  with check ((auth.jwt() -> 'user_metadata' ->> 'dataset') = 'demo');

alter table public.demo_scans enable row level security;

drop policy if exists "Anon can insert demo scans" on public.demo_scans;
create policy "Anon can insert demo scans"
  on public.demo_scans for insert
  to anon
  with check (true);

drop policy if exists "Anon can read demo scans" on public.demo_scans;
create policy "Anon can read demo scans"
  on public.demo_scans for select
  to anon
  using (true);

drop policy if exists "Demo admin full access demo scans" on public.demo_scans;
create policy "Demo admin full access demo scans"
  on public.demo_scans for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'dataset') = 'demo')
  with check ((auth.jwt() -> 'user_metadata' ->> 'dataset') = 'demo');

-- The existing admin panel can generate a QR image for this guest ID.

insert into public.demo_guests (id, name, party_size, email, notes)
values (
  '00000000-0000-4000-8000-000000000001',
  'Demo Guest',
  2,
  'demo@example.com',
  'Test ticket - safe to remove'
)
on conflict (id) do update set
  name = excluded.name,
  party_size = excluded.party_size,
  email = excluded.email,
  notes = excluded.notes;

-- Optional reset: run this separately if you want to remove the demo scan only.
-- delete from public.demo_scans
-- where guest_id = '00000000-0000-4000-8000-000000000001';

-- Remove the demo guest later with:
-- delete from public.demo_guests where id = '00000000-0000-4000-8000-000000000001';
