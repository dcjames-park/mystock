"use client";

import { useEffect, useRef, useState } from "react";
import {
  AppShell,
  Field,
  ScreenHeader,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AmountInput } from "@/components/portfolio/amount-input";
import { searchHoldings, usePortfolio } from "@/lib/data/use-portfolio";
import { useOverlay, useRouteIds } from "@/components/portfolio/overlay-context";
import { localDateStamp, toBoughtAt } from "@/lib/data/trend";
import { fetchNaverHoldingName, isKoreanName } from "@/lib/market/naver-name";
import type { SearchHit } from "@/lib/data/types";

export function AddHoldingView() {
  const overlay = useOverlay();
  const { accountId: presetAccountId = "" } = useRouteIds();
  const { ready, accounts, holdings, addHolding } = usePortfolio();
  const [accountId, setAccountId] = useState(presetAccountId || accounts[0]?.id || "");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [buyPrice, setBuyPrice] = useState("");
  const [qty, setQty] = useState("");
  const [boughtOn, setBoughtOn] = useState(localDateStamp);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [namePending, setNamePending] = useState(false);
  const nameResolveRef = useRef<Promise<string> | null>(null);
  const selectSeq = useRef(0);

  const currentAccountId =
    accounts.some((item) => item.id === accountId)
      ? accountId
      : (accounts.some((item) => item.id === presetAccountId)
        ? presetAccountId
        : (accounts[0]?.id ?? ""));
  const currentAccount = accounts.find((item) => item.id === currentAccountId);
  const heldInAccount = holdings.filter((item) => item.accountId === currentAccountId);
  const existingHolding = selected
    ? heldInAccount.find((item) => item.ticker === selected.ticker)
    : null;

  useEffect(() => {
    if (presetAccountId && accounts.some((item) => item.id === presetAccountId)) {
      setAccountId(presetAccountId);
    }
  }, [accounts, presetAccountId]);

  async function handleSearch() {
    setError(null);
    const next = await searchHoldings(query);
    setHits(next);
    setSearchOpen(true);
    if (next.length === 0) {
      setError("검색 결과가 없습니다. 종목명이나 티커를 확인해 주세요.");
    }
  }

  function handleSelect(item: SearchHit) {
    const seq = ++selectSeq.current;
    setSelected(item);
    setQuery(item.name);
    setSearchOpen(false);
    if (isKoreanName(item.name)) {
      setNamePending(false);
      nameResolveRef.current = Promise.resolve(item.name);
      return;
    }
    setNamePending(true);
    const resolve = fetchNaverHoldingName(item.ticker, item.market, item.kind)
      .then((naverName) => naverName ?? item.name)
      .catch(() => item.name)
      .then((name) => {
        if (selectSeq.current === seq) {
          setSelected((prev) =>
            prev && prev.ticker === item.ticker ? { ...prev, name } : prev,
          );
          setQuery(name);
          setNamePending(false);
        }
        return name;
      });
    nameResolveRef.current = resolve;
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
    const alreadyHeld = heldInAccount.find((item) => item.ticker === selected.ticker);
    if (alreadyHeld) {
      setError("이미 보유 중인 종목입니다. 종목 상세에서 매수를 추가해 주세요.");
      return;
    }
    const buy = Number(buyPrice);
    const count = Number(qty);
    if (!Number.isFinite(buy) || buy <= 0 || !Number.isFinite(count) || count <= 0) {
      setError("매수가와 수량을 확인해 주세요.");
      return;
    }
    if (!boughtOn) {
      setError("매수일을 확인해 주세요.");
      return;
    }
    setPending(true);
    try {
      const name = nameResolveRef.current
        ? await nameResolveRef.current
        : selected.name;
      await addHolding({
        accountId: currentAccountId,
        name,
        ticker: selected.ticker,
        market: selected.market,
        kind: selected.kind,
        buyPrice: buy,
        qty: count,
        currency: selected.market === "kr" ? "KRW" : "USD",
        boughtAt: toBoughtAt(boughtOn),
      });
      overlay.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setPending(false);
    }
  }

  if (!ready) {
    return <ScreenSkeleton />;
  }

  return (
    <AppShell>
      <ScreenHeader title="종목 추가" dismiss />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
        <Field label="계좌">
          {accounts.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start border-dashed"
              onClick={() => overlay.open({ m: "account-new" })}
            >
              계좌가 없습니다. 먼저 추가하세요.
            </Button>
          ) : presetAccountId && currentAccount ? (
            <Input value={currentAccount.label} disabled />
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
              placeholder="한글 종목명 또는 티커"
              className="min-w-0 flex-1"
            />
            <Button type="button" onClick={() => void handleSearch()}>
              찾기
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {namePending
              ? "네이버 한글 종목명을 확인하는 중..."
              : "한글 이름이나 티커로 검색하세요. 중간 글자만 넣어도 됩니다."}
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
            {hits.map((item) => {
              const held = heldInAccount.find((row) => row.ticker === item.ticker);
              return (
                <div key={item.ticker}>
                  <div className="flex items-center py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.ticker} · {item.market === "kr" ? "국내" : "해외"} ·{" "}
                        {item.kind === "etf" ? "ETF" : "주식"}
                        {held ? " · 보유 중" : null}
                      </p>
                    </div>
                    {held ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => overlay.open({ m: "lot-add", id: held.id })}
                      >
                        매수 추가
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSelect(item)}
                      >
                        선택
                      </Button>
                    )}
                  </div>
                  <Separator />
                </div>
              );
            })}
          </div>
        ) : null}

        <Field label="야후 티커">
          <Input value={selected?.ticker ?? ""} placeholder="찾기에서 선택" disabled />
        </Field>
        </div>

        <div className="flex flex-col gap-4">
        {existingHolding ? (
          <>
            <Alert>
              <AlertTitle>이미 보유 중인 종목입니다</AlertTitle>
              <AlertDescription>
                {currentAccount?.label ?? "이 계좌"}에 등록된 종목입니다. 여기서는 새
                종목만 추가할 수 있습니다. 추가 매수는 종목 상세의 매수 이력에서
                등록하세요.
              </AlertDescription>
            </Alert>
            <Button
              type="button"
              variant="outline"
              onClick={() => overlay.open({ m: "lot-add", id: existingHolding.id })}
            >
              종목 상세에서 매수 추가
            </Button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={
                  selected
                    ? `매수가 (${selected.market === "kr" ? "원" : "달러"})`
                    : "매수가"
                }
              >
                <AmountInput
                  value={buyPrice}
                  onChange={setBuyPrice}
                  maxFraction={selected?.market === "us" ? 2 : 0}
                  suffix={selected?.market === "us" ? "달러" : "원"}
                />
              </Field>
              <Field label="수량">
                <AmountInput value={qty} onChange={setQty} maxFraction={4} suffix="주" />
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
          </>
        )}
        </div>
      </div>
    </AppShell>
  );
}
