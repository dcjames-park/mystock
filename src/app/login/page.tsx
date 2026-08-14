import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/components/google-login-button";
import { isLocalBackend } from "@/lib/data/backend";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (isLocalBackend()) {
    redirect("/");
  }

  const { error } = await searchParams;
  const configured = hasSupabaseEnv();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">게시판</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Google 계정으로 로그인한 뒤 글을 읽고 작성할 수 있습니다.
      </p>
      {configured ? (
        <GoogleLoginButton />
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`과
          `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 넣은 뒤 개발 서버를 다시
          시작해 주세요.
        </p>
      )}
      {error === "auth" ? (
        <p className="mt-4 text-sm text-red-600">
          로그인에 실패했습니다. Google Provider와 Redirect URL을 확인해 주세요.
        </p>
      ) : null}
    </main>
  );
}
