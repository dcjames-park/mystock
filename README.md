# mystock

간단한 게시판입니다. Next.js + Supabase Auth(Google) + Vercel 기준으로 구성되어 있습니다.

## 로컬 실행

1. 패키지 설치 (`pnpm`만 사용)

```bash
pnpm install
```

2. 환경변수 파일 만들기

`.env.example`을 복사해 `.env.local`을 만들고 값을 넣습니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

- URL / Key: Supabase Dashboard → Project Settings → API
- Publishable key가 안 보이면 `anon` `public` 키를 `NEXT_PUBLIC_SUPABASE_ANON_KEY`로 넣어도 됩니다.

3. Google 로그인 설정 (Supabase)

- Authentication → Providers → Google 활성화
- Authentication → URL Configuration
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/auth/callback`

Google Cloud Console의 OAuth 클라이언트에도 Supabase가 안내하는 Callback URL을 등록해야 합니다.

4. 테이블 만들기

Supabase SQL Editor에서 `supabase/schema.sql` 내용을 실행합니다.

5. 개발 서버

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 로그인하지 않으면 로그인 화면으로 이동합니다.

## 운영 (Vercel)

Vercel 프로젝트 Environment Variables에 아래를 등록합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Supabase Redirect URLs에는 Vercel 도메인의 `/auth/callback`도 추가합니다.
