-- Folio 포트폴리오 테이블. Supabase SQL Editor에서 실행하세요.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  color text not null default 'blue',
  created_at timestamptz not null default now()
);

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  ticker text not null,
  market text not null check (market in ('kr', 'us')),
  kind text not null check (kind in ('stock', 'etf')),
  buy_price numeric not null,
  qty numeric not null,
  currency text not null check (currency in ('KRW', 'USD')),
  bought_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.valuation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  captured_at date not null,
  account_id uuid references public.accounts (id) on delete cascade,
  holding_id uuid references public.holdings (id) on delete cascade,
  market_value numeric not null,
  cost_value numeric not null
);

create unique index if not exists valuation_snapshots_uniq
  on public.valuation_snapshots (
    user_id,
    captured_at,
    (coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    (coalesce(holding_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );

create index if not exists accounts_user_id_idx on public.accounts (user_id);
create index if not exists holdings_user_id_idx on public.holdings (user_id);
create index if not exists holdings_account_id_idx on public.holdings (account_id);
create index if not exists valuation_snapshots_user_captured_idx
  on public.valuation_snapshots (user_id, captured_at desc);

alter table public.accounts enable row level security;
alter table public.holdings enable row level security;
alter table public.valuation_snapshots enable row level security;

drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own" on public.accounts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own" on public.accounts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own" on public.accounts
  for update to authenticated using (auth.uid() = user_id);

drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own" on public.accounts
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "holdings_select_own" on public.holdings;
create policy "holdings_select_own" on public.holdings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "holdings_insert_own" on public.holdings;
create policy "holdings_insert_own" on public.holdings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "holdings_update_own" on public.holdings;
create policy "holdings_update_own" on public.holdings
  for update to authenticated using (auth.uid() = user_id);

drop policy if exists "holdings_delete_own" on public.holdings;
create policy "holdings_delete_own" on public.holdings
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "snapshots_select_own" on public.valuation_snapshots;
create policy "snapshots_select_own" on public.valuation_snapshots
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "snapshots_insert_own" on public.valuation_snapshots;
create policy "snapshots_insert_own" on public.valuation_snapshots
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "snapshots_update_own" on public.valuation_snapshots;
create policy "snapshots_update_own" on public.valuation_snapshots
  for update to authenticated using (auth.uid() = user_id);

drop policy if exists "snapshots_delete_own" on public.valuation_snapshots;
create policy "snapshots_delete_own" on public.valuation_snapshots
  for delete to authenticated using (auth.uid() = user_id);
