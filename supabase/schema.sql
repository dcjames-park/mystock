-- 게시판 글 테이블. Supabase SQL Editor에서 실행하세요.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content text not null,
  author_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

drop policy if exists "Authenticated users can read posts" on public.posts;
create policy "Authenticated users can read posts"
  on public.posts
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert own posts" on public.posts;
create policy "Authenticated users can insert own posts"
  on public.posts
  for insert
  to authenticated
  with check (auth.uid() = user_id);
