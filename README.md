# Folio

개인 주식·ETF 포트폴리오입니다. Next.js + Supabase Auth(Google) + Vercel 기준으로 구성되어 있습니다.

데이터 저장소는 환경에 따라 갈립니다.

- `pnpm dev` / 로컬 `next start` / Vercel Preview: 브라우저 `localStorage`
- Vercel Production: Supabase

강제로 바꾸려면 `.env.local`에 `NEXT_PUBLIC_DATA_BACKEND=local` 또는 `supabase`를 넣습니다.

## 로컬 실행

1. 패키지 설치 (`pnpm`만 사용)

```bash
pnpm install
```

2. 개발 서버

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 로컬에서는 로그인 없이 바로 들어가며, 샘플 계좌·종목이 브라우저 저장소에 만들어집니다. 시세 검색은 야후 파이낸스 비공식 API를 서버에서 중계합니다.

운영 연동을 로컬에서 시험할 때만 아래 환경변수와 Google/Supabase 설정이 필요합니다.

3. (운영 연동 시험 시) 환경변수

`.env.example`을 복사해 `.env.local`을 만들고 값을 넣습니다.

```bash
NEXT_PUBLIC_DATA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

- URL / Key: Supabase Dashboard → Project Settings → API
- Publishable key가 안 보이면 `anon` `public` 키를 `NEXT_PUBLIC_SUPABASE_ANON_KEY`로 넣어도 됩니다.

4. (운영 연동 시험 시) Google 로그인 설정 (Supabase)

- Authentication → Providers → Google 활성화
- Authentication → URL Configuration
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/auth/callback`

Google Cloud Console의 OAuth 클라이언트에도 Supabase가 안내하는 Callback URL을 등록해야 합니다.

5. (운영 연동 시험 시) 테이블 만들기

Supabase SQL Editor에서 `supabase/schema.sql` 내용을 실행합니다. 이미 예전에 `schema.sql`을 실행한 프로젝트는 `supabase/migrate-holding-lots.sql`로 매수 이력 테이블을 만들고, `supabase/migrate-account-colors.sql`로 계좌 색 종류를 늘립니다.

## 운영 (Vercel)

Production 배포는 자동으로 Supabase를 씁니다. Vercel 프로젝트 Environment Variables에 아래를 등록합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Supabase Redirect URLs에는 Vercel 도메인의 `/auth/callback`도 추가합니다.

Free 플랜 프로젝트는 약 7일 동안 DB 요청이 없으면 일시 중지됩니다. Production에서는 Vercel Cron이 매일 한 번 `/api/health`를 호출해 `accounts`를 한 줄 조회합니다. 시각은 UTC 15:00(한국 시간 다음날 00:00)입니다. Vercel에 `CRON_SECRET`을 넣으면 그 요청만 통과합니다. 한 시간마다 돌리려면 Vercel Pro에서 `vercel.json`의 schedule을 `0 * * * *`로 바꾸면 됩니다.
