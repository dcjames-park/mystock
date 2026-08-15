"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, FormPanel, ScreenSkeleton } from "@/components/portfolio/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/lib/data/use-portfolio";

export function DeleteAccountView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { ready, accounts, holdings, removeAccount } = usePortfolio();
  const account = accounts.find((item) => item.id === params.id);
  const holdingCount = holdings.filter((item) => item.accountId === params.id).length;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) {
    return <ScreenSkeleton />;
  }

  if (!account) {
    return (
      <AppShell>
        <p className="pt-16 text-sm text-muted-foreground">계좌를 찾을 수 없습니다.</p>
      </AppShell>
    );
  }

  const accountId = account.id;

  async function handleConfirm() {
    setPending(true);
    try {
      await removeAccount(accountId);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <AppShell>
      <FormPanel className="pt-12">
        <p className="text-xs font-medium text-primary">계좌 삭제</p>
        <p className="mt-2 font-heading text-[22px] font-semibold leading-7">
          {account.label}
        </p>
        <Alert className="mt-7">
          <AlertTitle>이 계좌를 삭제합니다</AlertTitle>
          <AlertDescription>
            {holdingCount > 0
              ? `들어 있는 종목 ${holdingCount}개도 함께 삭제됩니다.`
              : "들어 있는 종목은 없습니다."}
          </AlertDescription>
        </Alert>
        {error ? (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="mt-6 flex gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={pending}
          >
            {pending ? "삭제 중..." : "삭제"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/")}>
            취소
          </Button>
        </div>
      </FormPanel>
    </AppShell>
  );
}
