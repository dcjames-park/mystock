"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Loader2 } from "lucide-react";
import { ACCOUNT_COLOR, DayChange, pnlClass } from "@/components/portfolio/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyDayChangeView,
  type DayChangeMarketFilter,
  type DayChangeSort,
  type DayChangeSortDir,
  type DayChangeSummary,
} from "@/lib/data/day-change";
import { formatQuoteAsOf, formatWon } from "@/lib/money";
import { cn } from "@/lib/utils";

const MARKET_FILTERS: { id: DayChangeMarketFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "kr", label: "국내" },
  { id: "us", label: "해외" },
];

const SORTS: { id: DayChangeSort; label: string }[] = [
  { id: "value", label: "변동액" },
  { id: "pct", label: "수익률" },
];

const LOADING_MIN_MS = 400;

export function DayChangePopup({
  summary,
  asOf,
  onClose,
}: {
  summary: DayChangeSummary | null;
  asOf: string | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [accountId, setAccountId] = useState("all");
  const [market, setMarket] = useState<DayChangeMarketFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DayChangeSort>("pct");
  const [dir, setDir] = useState<DayChangeSortDir>("desc");

  const view = useMemo(
    () =>
      summary
        ? applyDayChangeView(summary, {
            accountId,
            market,
            query,
            sort,
            dir,
          })
        : null,
    [accountId, dir, market, query, sort, summary],
  );
  const loading = !contentReady || !summary || !view;
  const filtered = Boolean(summary && view && view.itemCount !== summary.itemCount);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!summary) {
      setContentReady(false);
      return;
    }
    const timer = window.setTimeout(() => setContentReady(true), LOADING_MIN_MS);
    return () => window.clearTimeout(timer);
  }, [summary]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[3px] overlay-backdrop dark:bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-change-popup-title"
        aria-busy={loading}
        className="overlay-panel relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl ring-1 ring-black/10 sm:max-h-[85dvh] sm:max-w-lg sm:rounded-xl dark:ring-white/15"
      >
        {loading || !summary || !view ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">전일 대비를 불러오는 중</p>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <p id="day-change-popup-title" className="text-base font-medium">
                전일 대비
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatQuoteAsOf(asOf)} · 전일 종가 기준
                {" · "}
                {filtered ? `${view.itemCount} / ${summary.itemCount}` : summary.itemCount}종목
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                국내와 해외는 전일 종가 기준 시점이 다를 수 있습니다.
              </p>

              <div className="mt-3 space-y-2">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="종목명, 티커"
                  aria-label="종목 검색"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="min-w-0 flex-1 sm:max-w-52">
                      <SelectValue placeholder="계좌" />
                    </SelectTrigger>
                    <SelectContent className="z-[60]">
                      <SelectItem value="all">전체 계좌</SelectItem>
                      {summary.accounts.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex shrink-0 gap-1">
                    {MARKET_FILTERS.map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        size="sm"
                        variant={market === item.id ? "default" : "outline"}
                        className="rounded-full px-3"
                        aria-pressed={market === item.id}
                        onClick={() => setMarket(item.id)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-0.5">
                  {SORTS.map((item) => {
                    const active = sort === item.id;
                    const SortIcon =
                      active && dir === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow;
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        size="sm"
                        variant={active ? "secondary" : "ghost"}
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => {
                          if (active) {
                            setDir(dir === "desc" ? "asc" : "desc");
                            return;
                          }
                          setSort(item.id);
                          setDir("desc");
                        }}
                      >
                        {item.label}
                        <SortIcon
                          className={cn("size-3.5", active ? "opacity-100" : "opacity-60")}
                        />
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 rounded-xl border px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {filtered ? "선택한 종목" : "전체"}
                  </p>
                  <Metrics valueDelta={view.valueDelta} pct={view.pct} size="lg" />
                </div>
              </div>

              {view.accounts.length === 0 ? (
                <p className="px-1 py-8 text-center text-sm text-muted-foreground">
                  조건에 맞는 종목이 없습니다.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {view.accounts.map((account) => (
                    <section key={account.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: ACCOUNT_COLOR[account.color] }}
                          />
                          <p className="truncate text-sm font-medium">{account.label}</p>
                        </div>
                        <Metrics valueDelta={account.valueDelta} pct={account.pct} />
                      </div>
                      <div className="mt-2 divide-y border-t">
                        {account.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm">{item.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {item.ticker}
                                <span className="mx-1.5">·</span>
                                {item.market === "kr" ? "국내" : "해외"}
                              </p>
                            </div>
                            <Metrics valueDelta={item.valueDelta} pct={item.pct} />
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t px-4 py-3 sm:px-6">
              <Button type="button" className="w-full" onClick={onClose}>
                확인
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Metrics({
  valueDelta,
  pct,
  size = "sm",
}: {
  valueDelta: number;
  pct: number;
  size?: "sm" | "lg";
}) {
  return (
    <div className="shrink-0 text-right">
      <p
        className={cn(
          "font-semibold tabular-nums",
          size === "lg" ? "text-sm" : "text-[11px]",
          pnlClass(valueDelta),
        )}
      >
        {formatSignedWon(valueDelta)}
      </p>
      <DayChange value={pct} className={size === "lg" ? "text-sm" : undefined} />
    </div>
  );
}

function formatSignedWon(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatWon(value)}`;
}
