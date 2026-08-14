import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/components/google-login-button";
import { AppShell } from "@/components/portfolio/app-shell";
import { FolioLogo } from "@/components/portfolio/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    <AppShell layout="form">
      <div className="flex flex-1 flex-col justify-center pt-16">
        <p className="text-xs font-medium tracking-wide text-primary">
          PERSONAL PORTFOLIO
        </p>
        <h1 className="mt-3">
          <FolioLogo
            markSize={40}
            wordmarkClassName="text-3xl"
          />
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          국내·해외 주식과 ETF를 계좌별로 모아 봅니다.
        </p>
        <div className="mt-8 space-y-3">
          {configured ? (
            <GoogleLoginButton />
          ) : (
            <Alert>
              <AlertDescription>
                `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`과
                `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 넣은 뒤 개발 서버를 다시
                시작해 주세요.
              </AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground">
            로그인 후에만 메인 화면에 들어갈 수 있습니다.
          </p>
          {error === "auth" ? (
            <Alert variant="destructive">
              <AlertDescription>
                로그인에 실패했습니다. Google Provider와 Redirect URL을 확인해 주세요.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
