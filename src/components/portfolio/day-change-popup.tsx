"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Loader2 } from "lucide-react";
import { ACCOUNT_COLOR, DayChange, pnlClass } from "@/components/portfolio/app-shell";
import { Button } from "@/components/ui/button";
import {
  sortDayChangeHoldings,
  type DayChangeSort,
  type DayChangeSortDir,
  type DayChangeSummary,
} from "@/lib/data/day-change";
import { formatQuoteAsOf, formatWon } from "@/lib/money";
import { cn } from "@/lib/utils";

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
  const [sort, setSort] = useState<DayChangeSort>("pct");
  const [dir, setDir] = useState<DayChangeSortDir>("desc");

  const items = useMemo(
    () => (summary ? sortDayChangeHoldings(summary.items, sort, dir) : []),
    [dir, sort, summary],
  );
  const loading = !contentReady || !summary;

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
        {loading || !summary ? (
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
                {formatQuoteAsOf(asOf)} · 전일 종가 기준 · {summary.itemCount}종목
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                국내와 해외는 전일 종가 기준 시점이 다를 수 있습니다.
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-0.5">
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

              <div className="mt-4 rounded-xl border px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-muted-foreground">전체</p>
                  <Metrics valueDelta={summary.valueDelta} pct={summary.pct} size="lg" />
                </div>
              </div>

              {items.length === 0 ? (
                <p className="px-1 py-8 text-center text-sm text-muted-foreground">
                  전일 대비를 계산할 종목이 없습니다.
                </p>
              ) : (
                <div className="mt-2 divide-y">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{item.name}</p>
                        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: ACCOUNT_COLOR[item.accountColor] }}
                          />
                          <span className="truncate">{item.accountLabel}</span>
                        </p>
                      </div>
                      <Metrics valueDelta={item.valueDelta} pct={item.pct} />
                    </div>
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
