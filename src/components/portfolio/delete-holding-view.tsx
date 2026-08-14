"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, ScreenSkeleton } from "@/components/portfolio/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/lib/data/use-portfolio";

export function DeleteHoldingView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { ready, holdings, accounts, removeHolding } = usePortfolio();
  const holding = holdings.find((item) => item.id === params.id);
  const account = accounts.find((item) => item.id === holding?.accountId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) {
    return <ScreenSkeleton />;
  }

  if (!holding) {
    return (
      <AppShell layout="form">
        <p className="pt-16 text-sm text-muted-foreground">종목을 찾을 수 없습니다.</p>
      </AppShell>
    );
  }

  const holdingId = holding.id;

  async function handleConfirm() {
    setPending(true);
    try {
      await removeHolding(holdingId);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <AppShell layout="form">
      <div className="pt-12">
        <p className="text-xs text-muted-foreground">매도 · {account?.label ?? ""}</p>
        <p className="mt-2 font-heading text-[22px] font-semibold leading-7">
          {holding.name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{holding.ticker}</p>
        <Alert className="mt-7">
          <AlertTitle>보유 목록에서 삭제합니다</AlertTitle>
          <AlertDescription>
            총 평가와 기간별 추이에서도 빠집니다.
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
      </div>
    </AppShell>
  );
}
