"use client";

import { useMemo, useState } from "react";
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
import { AmountInput } from "@/components/portfolio/amount-input";
import { usePortfolio } from "@/lib/data/use-portfolio";
import { useOverlay, useRouteIds } from "@/components/portfolio/overlay-context";
import { applyLotSummary } from "@/lib/data/lots";
import { localDateStamp, toBoughtAt, toDateInput } from "@/lib/data/trend";
import { formatPct, formatWon, holdingToKrw } from "@/lib/money";

export function LotFormView({ mode }: { mode: "add" | "edit" }) {
  const overlay = useOverlay();
  const { id, lotId: routeLotId } = useRouteIds();
  const { ready, holdings, quotes, fx, addLot, updateLot } = usePortfolio();
  const holding = holdings.find((item) => item.id === id);
  const lot = holding?.lots.find((item) => item.id === routeLotId);
  const [buy, setBuy] = useState("");
  const [qty, setQty] = useState("");
  const [boughtOn, setBoughtOn] = useState(localDateStamp);
  const [seededLotId, setSeededLotId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "edit" && lot && seededLotId !== lot.id) {
    setBuy(String(lot.buyPrice));
    setQty(String(lot.qty));
    setBoughtOn(toDateInput(lot.boughtAt));
    setSeededLotId(lot.id);
  }

  const preview = useMemo(() => {
    if (!holding) {
      return null;
    }
    const nextBuy = Number(buy);
    const nextQty = Number(qty);
    const nextLot = {
      id: lot?.id ?? "preview",
      holdingId: holding.id,
      buyPrice: Number.isFinite(nextBuy) && nextBuy > 0 ? nextBuy : lot?.buyPrice ?? 0,
      qty: Number.isFinite(nextQty) && nextQty > 0 ? nextQty : lot?.qty ?? 0,
      boughtAt: boughtOn ? toBoughtAt(boughtOn) : lot?.boughtAt ?? holding.boughtAt,
      createdAt: lot?.createdAt ?? holding.createdAt,
      updatedAt: lot?.updatedAt ?? holding.updatedAt,
    };
    const lots =
      mode === "edit"
        ? holding.lots.map((item) => (item.id === lot?.id ? nextLot : item))
        : [...holding.lots, nextLot];
    return holdingToKrw(
      applyLotSummary({ ...holding, lots }),
      quotes[holding.ticker] ?? holding.buyPrice,
      fx.usdKrw,
    );
  }, [boughtOn, buy, fx.usdKrw, holding, lot, mode, qty, quotes]);

  if (!ready) {
    return <ScreenSkeleton />;
  }

  if (!holding || (mode === "edit" && !lot)) {
    return (
      <AppShell>
        <ScreenHeader
          title={mode === "add" ? "추가 매수" : "매수 수정"}
        />
        <p className="text-sm text-muted-foreground">종목을 찾을 수 없습니다.</p>
      </AppShell>
    );
  }

  const holdingId = holding.id;
  const lotId = lot?.id ?? "";

  async function handleSave() {
    setError(null);
    const nextBuy = Number(buy);
    const nextQty = Number(qty);
    if (!Number.isFinite(nextBuy) || nextBuy <= 0 || !Number.isFinite(nextQty) || nextQty <= 0) {
      setError("매수가와 수량을 확인해 주세요.");
      return;
    }
    if (!boughtOn) {
      setError("매수일을 확인해 주세요.");
      return;
    }
    setPending(true);
    try {
      const input = {
        buyPrice: nextBuy,
        qty: nextQty,
        boughtAt: toBoughtAt(boughtOn),
      };
      if (mode === "edit") {
        await updateLot(holdingId, lotId, input);
      } else {
        await addLot(holdingId, input);
      }
      overlay.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <AppShell>
      <ScreenHeader
        title={mode === "add" ? "추가 매수" : "매수 수정"}
        fallbackHref={`/holdings/${holdingId}`}
      />
      <div className="mb-4">
        <p className="font-heading text-xl font-semibold leading-7">{holding.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {holding.ticker} · {holding.market === "kr" ? "국내" : "해외"} · 이 종목에 매수
          이력을 {mode === "add" ? "추가" : "수정"}합니다.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`매수가 (${holding.currency === "USD" ? "달러" : "원"})`}>
              <AmountInput
                value={buy}
                onChange={setBuy}
                maxFraction={holding.currency === "USD" ? 2 : 0}
                suffix={holding.currency === "USD" ? "달러" : "원"}
              />
            </Field>
            <Field label="수량">
              <AmountInput
                value={qty}
                onChange={setQty}
                maxFraction={4}
                suffix="주"
              />
            </Field>
          </div>
          <Field label="매수일" className="mt-3">
            <Input
              type="date"
              value={boughtOn}
              max={localDateStamp()}
              onChange={(event) => setBoughtOn(event.target.value)}
            />
          </Field>
          {error ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="button"
            className="mt-6 w-full lg:w-auto"
            onClick={() => void handleSave()}
            disabled={pending}
          >
            {pending ? "저장 중..." : "저장"}
          </Button>
        </div>
        {preview ? (
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">변경 후 평균</p>
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
        ) : null}
      </div>
    </AppShell>
  );
}
