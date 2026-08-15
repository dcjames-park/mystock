"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, ScreenSkeleton } from "@/components/portfolio/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/lib/data/use-portfolio";
import { formatDateKo, formatPrice } from "@/lib/money";

export function DeleteLotView() {
  const router = useRouter();
  const params = useParams<{ id: string; lotId: string }>();
  const { ready, holdings, removeLot } = usePortfolio();
  const holding = holdings.find((item) => item.id === params.id);
  const lot = holding?.lots.find((item) => item.id === params.lotId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLot = (holding?.lots.length ?? 0) <= 1;

  if (!ready) {
    return <ScreenSkeleton />;
  }

  if (!holding || !lot) {
    return (
      <AppShell layout="form">
        <p className="pt-16 text-sm text-muted-foreground">매수 이력을 찾을 수 없습니다.</p>
      </AppShell>
    );
  }

  const holdingId = holding.id;
  const lotId = lot.id;

  async function handleConfirm() {
    setPending(true);
    try {
      const result = await removeLot(holdingId, lotId);
      router.push(result.removedHolding ? "/" : `/holdings/${holdingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <AppShell layout="form">
      <div className="pt-12">
        <p className="text-xs text-muted-foreground">매수 이력 삭제</p>
        <p className="mt-2 font-heading text-[22px] font-semibold leading-7">
          {holding.name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDateKo(lot.boughtAt)} · {formatPrice(lot.buyPrice, holding.currency)} ·{" "}
          {lot.qty.toLocaleString("ko-KR")}주
        </p>
        <Alert className="mt-7">
          <AlertTitle>
            {lastLot ? "마지막 매수 이력입니다" : "이 매수 이력을 삭제합니다"}
          </AlertTitle>
          <AlertDescription>
            {lastLot
              ? "이 이력을 지우면 종목 자체도 보유 목록에서 빠집니다."
              : "평균 매수가와 보유 수량이 다시 계산됩니다."}
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/holdings/${holdingId}`)}
          >
            취소
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
