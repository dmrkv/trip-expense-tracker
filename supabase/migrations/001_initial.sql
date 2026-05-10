-- Tripsplit: remote mirror for optional cloud backup / multi-device restore.
-- Run in Supabase SQL editor or via supabase db push after linking a project.

-- Trips (maps to local Dexie `groups` table)
create table if not exists public.trips (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  avatar_data_url text,
  default_currency text not null default 'EUR',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists trips_owner_id_idx on public.trips (owner_id);
create index if not exists trips_updated_at_idx on public.trips (updated_at desc);

-- Members / expenses / transfers: JSON snapshot + row updated_at for LWW sync
create table if not exists public.trip_members (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null
);

create index if not exists trip_members_trip_id_idx on public.trip_members (trip_id);

create table if not exists public.trip_expenses (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null
);

create index if not exists trip_expenses_trip_id_idx on public.trip_expenses (trip_id);

create table if not exists public.trip_transfers (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null
);

create index if not exists trip_transfers_trip_id_idx on public.trip_transfers (trip_id);

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.trip_transfers enable row level security;

-- Owner-only access via trips.owner_id = auth.uid()
create policy "trips_select_own"
  on public.trips for select
  using (owner_id = (select auth.uid()));

create policy "trips_insert_own"
  on public.trips for insert
  with check (owner_id = (select auth.uid()));

create policy "trips_update_own"
  on public.trips for update
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "trips_delete_own"
  on public.trips for delete
  using (owner_id = (select auth.uid()));

create policy "trip_members_all_via_trip"
  on public.trip_members for all
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id and t.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id and t.owner_id = (select auth.uid())
    )
  );

create policy "trip_expenses_all_via_trip"
  on public.trip_expenses for all
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_expenses.trip_id and t.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_expenses.trip_id and t.owner_id = (select auth.uid())
    )
  );

create policy "trip_transfers_all_via_trip"
  on public.trip_transfers for all
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_transfers.trip_id and t.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_transfers.trip_id and t.owner_id = (select auth.uid())
    )
  );
