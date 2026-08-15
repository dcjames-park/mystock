-- 기존 Folio DB에 매수 이력 테이블을 추가할 때 실행하세요.
-- 새 프로젝트는 schema.sql만 실행하면 됩니다.

create table if not exists public.holding_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  holding_id uuid not null references public.holdings (id) on delete cascade,
  buy_price numeric not null,
  qty numeric not null,
  bought_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists holding_lots_holding_id_idx on public.holding_lots (holding_id);
create index if not exists holding_lots_user_id_idx on public.holding_lots (user_id);

alter table public.holding_lots enable row level security;

drop policy if exists "holding_lots_select_own" on public.holding_lots;
create policy "holding_lots_select_own" on public.holding_lots
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "holding_lots_insert_own" on public.holding_lots;
create policy "holding_lots_insert_own" on public.holding_lots
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "holding_lots_update_own" on public.holding_lots;
create policy "holding_lots_update_own" on public.holding_lots
  for update to authenticated using (auth.uid() = user_id);

drop policy if exists "holding_lots_delete_own" on public.holding_lots;
create policy "holding_lots_delete_own" on public.holding_lots
  for delete to authenticated using (auth.uid() = user_id);

insert into public.holding_lots (user_id, holding_id, buy_price, qty, bought_at, created_at, updated_at)
select h.user_id, h.id, h.buy_price, h.qty, h.bought_at, h.created_at, h.updated_at
from public.holdings h
where not exists (
  select 1 from public.holding_lots l where l.holding_id = h.id
);
