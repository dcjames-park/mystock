"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AppShell,
  Field,
  pnlClass,
  ScreenHeader,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/lib/data/use-portfolio";
import { localDateStamp, toBoughtAt, toDateInput } from "@/lib/data/trend";
import { formatPct, formatWon, holdingToKrw } from "@/lib/money";

export function EditHoldingView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { ready, holdings, quotes, fx, updateHolding } = usePortfolio();
  const holding = holdings.find((item) => item.id === params.id);
  const [buy, setBuy] = useState<string | null>(null);
  const [qty, setQty] = useState<string | null>(null);
  const [boughtOn, setBoughtOn] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buyValue = buy ?? (holding ? String(holding.buyPrice) : "");
  const qtyValue = qty ?? (holding ? String(holding.qty) : "");
  const boughtValue = boughtOn ?? (holding ? toDateInput(holding.boughtAt) : "");

  const preview = useMemo(() => {
    if (!holding) {
      return null;
    }
    return holdingToKrw(
      {
        ...holding,
        buyPrice: Number(buyValue) || holding.buyPrice,
        qty: Number(qtyValue) || holding.qty,
      },
      quotes[holding.ticker] ?? holding.buyPrice,
      fx.usdKrw,
    );
  }, [buyValue, fx.usdKrw, holding, qtyValue, quotes]);

  if (!ready) {
    return <ScreenSkeleton />;
  }

  if (!holding || !preview) {
    return (
      <AppShell layout="form">
        <ScreenHeader title="수정" onClose={() => router.push("/")} />
        <p className="text-sm text-muted-foreground">종목을 찾을 수 없습니다.</p>
      </AppShell>
    );
  }

  const holdingId = holding.id;

  async function handleSave() {
    setError(null);
    const nextBuy = Number(buyValue);
    const nextQty = Number(qtyValue);
    if (!Number.isFinite(nextBuy) || nextBuy <= 0 || !Number.isFinite(nextQty) || nextQty <= 0) {
      setError("매입가와 수량을 확인해 주세요.");
      return;
    }
    if (!boughtValue) {
      setError("매수일을 확인해 주세요.");
      return;
    }
    setPending(true);
    try {
      await updateHolding(holdingId, {
        buyPrice: nextBuy,
        qty: nextQty,
        boughtAt: toBoughtAt(boughtValue),
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <AppShell layout="form">
      <ScreenHeader title="수정" onClose={() => router.push("/")} />
      <div className="mb-4">
        <p className="font-heading text-xl font-semibold leading-7">{holding.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {holding.ticker} · {holding.market === "kr" ? "국내" : "해외"} · 매입가,
          수량, 매수일을 바꿀 수 있습니다.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`매입가 (${holding.currency === "USD" ? "달러" : "원"})`}>
          <div className="relative">
            <Input
              type="number"
              value={buyValue}
              onChange={(event) => setBuy(event.target.value)}
              className="pr-12"
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
              {holding.currency === "USD" ? "달러" : "원"}
            </span>
          </div>
        </Field>
        <Field label="수량">
          <Input
            type="number"
            value={qtyValue}
            onChange={(event) => setQty(event.target.value)}
          />
        </Field>
      </div>
      <Field label="매수일" className="mt-3">
        <Input
          type="date"
          value={boughtValue}
          max={localDateStamp()}
          onChange={(event) => setBoughtOn(event.target.value)}
        />
      </Field>
      <Card size="sm" className="mt-5">
        <CardContent>
          <p className="text-xs text-muted-foreground">변경 후</p>
          <div className="mt-2 flex items-end">
            <div>
              <p className="text-xs text-muted-foreground">수익률</p>
              <p className={`font-semibold ${pnlClass(preview.rate)}`}>
                {formatPct(preview.rate)}
              </p>
            </div>
            <span className="flex-1" />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">수익 금액</p>
              <p className={`font-semibold ${pnlClass(preview.pnl)}`}>
                {formatWon(preview.pnl)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        className="mt-6 w-full"
        onClick={() => void handleSave()}
        disabled={pending}
      >
        {pending ? "저장 중..." : "저장"}
      </Button>
    </AppShell>
  );
}
