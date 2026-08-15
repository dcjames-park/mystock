-- 기존 Folio DB에 계좌 색 종류를 늘릴 때 실행하세요.
-- 새 프로젝트는 schema.sql만 실행하면 됩니다.

alter table public.accounts drop constraint if exists accounts_color_check;

alter table public.accounts
  add constraint accounts_color_check
  check (color in (
    'blue', 'cyan', 'purple', 'orange', 'rose', 'green', 'amber', 'pink'
  ));
