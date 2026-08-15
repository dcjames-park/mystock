"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AppShell,
  ScreenHeader,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/lib/data/use-portfolio";
import { fetchNaverHoldingName } from "@/lib/market/naver-name";

export function EditHoldingView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { ready, holdings, updateHolding } = usePortfolio();
  const holding = holdings.find((item) => item.id === params.id);
  const [name, setName] = useState<string | null>(null);
  const [namePending, setNamePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!ready) {
    return <ScreenSkeleton />;
  }

  if (!holding) {
    return (
      <AppShell layout="form">
        <ScreenHeader title="이름 수정" onClose={() => router.push("/")} />
        <p className="text-sm text-muted-foreground">종목을 찾을 수 없습니다.</p>
      </AppShell>
    );
  }

  const holdingId = holding.id;
  const displayName = name ?? holding.name;
  const ticker = holding.ticker;
  const market = holding.market;
  const kind = holding.kind;

  async function handleRefreshNaverName() {
    setError(null);
    setNotice(null);
    setNamePending(true);
    try {
      const naverName = await fetchNaverHoldingName(ticker, market, kind);
      if (!naverName) {
        setNotice("네이버에 한글명이 없어 기존 이름을 유지합니다.");
        return;
      }
      setName(naverName);
      await updateHolding(holdingId, { name: naverName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "네이버 이름을 받지 못했습니다.");
    } finally {
      setNamePending(false);
    }
  }

  return (
    <AppShell layout="form">
      <ScreenHeader title="이름 수정" onClose={() => router.push(`/holdings/${holdingId}`)} />
      <div className="mb-4">
        <p className="font-heading text-xl font-semibold leading-7">{displayName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {holding.ticker} · {holding.market === "kr" ? "국내" : "해외"} · 매수가와
          수량은 종목 상세의 매수 이력에서 바꿉니다.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          onClick={() => void handleRefreshNaverName()}
          disabled={namePending}
        >
          {namePending ? "받는 중..." : "네이버 이름으로 다시 받기"}
        </Button>
        {notice ? <p className="mt-2 text-xs text-muted-foreground">{notice}</p> : null}
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </AppShell>
  );
}
