"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppShell,
  Field,
  ScreenHeader,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { searchHoldings, usePortfolio } from "@/lib/data/use-portfolio";
import { localDateStamp, toBoughtAt } from "@/lib/data/trend";
import type { SearchHit } from "@/lib/data/types";

export function AddHoldingView() {
  const router = useRouter();
  const { ready, accounts, addHolding } = usePortfolio();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [buyPrice, setBuyPrice] = useState("");
  const [qty, setQty] = useState("");
  const [boughtOn, setBoughtOn] = useState(localDateStamp);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const currentAccountId =
    accounts.some((item) => item.id === accountId)
      ? accountId
      : (accounts[0]?.id ?? "");

  async function handleSearch() {
    setError(null);
    const next = await searchHoldings(query);
    setHits(next);
    setSearchOpen(true);
    if (next.length === 0) {
      setError("검색 결과가 없습니다. 종목명이나 티커를 확인해 주세요.");
    }
  }

  async function handleSave() {
    setError(null);
    if (!currentAccountId) {
      setError("먼저 계좌를 추가해 주세요.");
      return;
    }
    if (!selected) {
      setError("찾기에서 종목을 선택해 주세요.");
      return;
    }
    const buy = Number(buyPrice);
    const count = Number(qty);
    if (!Number.isFinite(buy) || buy <= 0 || !Number.isFinite(count) || count <= 0) {
      setError("매입가와 수량을 확인해 주세요.");
      return;
    }
    if (!boughtOn) {
      setError("매수일을 확인해 주세요.");
      return;
    }
    setPending(true);
    try {
      await addHolding({
        accountId: currentAccountId,
        name: selected.name,
        ticker: selected.ticker,
        market: selected.market,
        kind: selected.kind,
        buyPrice: buy,
        qty: count,
        currency: selected.market === "kr" ? "KRW" : "USD",
        boughtAt: toBoughtAt(boughtOn),
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setPending(false);
    }
  }

  if (!ready) {
    return <ScreenSkeleton />;
  }

  return (
    <AppShell layout="form">
      <ScreenHeader title="종목 추가" onClose={() => router.push("/")} />
      <div className="flex flex-col gap-4">
        <Field label="계좌">
          {accounts.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start border-dashed"
              onClick={() => router.push("/accounts/new")}
            >
              계좌가 없습니다. 먼저 추가하세요.
            </Button>
          ) : (
            <Select value={currentAccountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="계좌 선택" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field label="종목명">
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="영어로 입력하세요"
              className="min-w-0 flex-1"
            />
            <Button type="button" variant="outline" onClick={() => void handleSearch()}>
              찾기
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            예: Samsung, AAPL, QQQ · 대소문자·공백은 구분하지 않습니다.
          </p>
        </Field>

        {searchOpen ? (
          <div className="space-y-2">
            <div className="flex items-center text-xs text-muted-foreground">
              <span>검색 결과</span>
              <span className="flex-1" />
              <Button type="button" variant="ghost" size="sm" onClick={() => setSearchOpen(false)}>
                닫기
              </Button>
            </div>
            {hits.map((item) => (
              <div key={item.ticker}>
                <div className="flex items-center py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.ticker} · {item.market === "kr" ? "국내" : "해외"} ·{" "}
                      {item.kind === "etf" ? "ETF" : "주식"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelected(item);
                      setQuery(item.name);
                      setSearchOpen(false);
                    }}
                  >
                    선택
                  </Button>
                </div>
                <Separator />
              </div>
            ))}
          </div>
        ) : null}

        <Field label="야후 티커">
          <Input value={selected?.ticker ?? ""} placeholder="찾기에서 선택" disabled />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={
              selected
                ? `매입가 (${selected.market === "kr" ? "원" : "달러"})`
                : "매입가"
            }
          >
            <div className="relative">
              <Input
                type="number"
                value={buyPrice}
                onChange={(event) => setBuyPrice(event.target.value)}
                placeholder={selected?.market === "us" ? "180" : "72000"}
                className="pr-12"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                {selected?.market === "us" ? "달러" : "원"}
              </span>
            </div>
          </Field>
          <Field label="수량">
            <Input
              type="number"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              placeholder="50"
            />
          </Field>
        </div>
        <Field label="매수일">
          <Input
            type="date"
            value={boughtOn}
            max={localDateStamp()}
            onChange={(event) => setBoughtOn(event.target.value)}
          />
        </Field>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" onClick={() => void handleSave()} disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </AppShell>
  );
}
