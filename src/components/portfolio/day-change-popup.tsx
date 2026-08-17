"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ACCOUNT_COLOR, DayChange, pnlClass } from "@/components/portfolio/app-shell";
import { Button } from "@/components/ui/button";
import type { DayChangeSummary } from "@/lib/data/day-change";
import { formatQuoteAsOf, formatWon } from "@/lib/money";

export function DayChangePopup({
  summary,
  asOf,
  onClose,
}: {
  summary: DayChangeSummary;
  asOf: string | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        className="overlay-panel relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl ring-1 ring-black/10 sm:max-h-[85dvh] sm:max-w-lg sm:rounded-xl dark:ring-white/15"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <p id="day-change-popup-title" className="text-base font-medium">
            전일 대비
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatQuoteAsOf(asOf)} · 전일 종가 기준
          </p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            국내와 해외는 전일 종가 기준 시점이 다를 수 있습니다.
          </p>

          <div className="mt-4 rounded-xl border px-3 py-3">
            <p className="text-xs text-muted-foreground">전체</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <DayChange value={summary.pct} className="text-base" />
              <p className={`text-sm font-semibold tabular-nums ${pnlClass(summary.valueDelta)}`}>
                {formatSignedWon(summary.valueDelta)}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {summary.accounts.map((account) => (
              <section key={account.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: ACCOUNT_COLOR[account.color] }}
                    />
                    <p className="truncate text-sm font-medium">{account.label}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <DayChange value={account.pct} />
                    <p className={`text-[11px] tabular-nums ${pnlClass(account.valueDelta)}`}>
                      {formatSignedWon(account.valueDelta)}
                    </p>
                  </div>
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
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <DayChange value={item.pct} />
                        <p className={`text-[11px] tabular-nums ${pnlClass(item.valueDelta)}`}>
                          {formatSignedWon(item.valueDelta)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        <div className="border-t px-4 py-3 sm:px-6">
          <Button type="button" className="w-full" onClick={onClose}>
            확인
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatSignedWon(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatWon(value)}`;
}
