"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, ChevronDown, Loader2 } from "lucide-react";
import { ACCOUNT_COLOR, DayChange, pnlClass } from "@/components/portfolio/app-shell";
import { Button } from "@/components/ui/button";
import {
  sortDayChangeHoldings,
  type DayChangeHolding,
  type DayChangeSort,
  type DayChangeSortDir,
  type DayChangeSummary,
} from "@/lib/data/day-change";
import { formatQuoteAsOf, formatWon } from "@/lib/money";
import { cn } from "@/lib/utils";

const SORTS: { id: DayChangeSort; label: string }[] = [
  { id: "value", label: "변동금액" },
  { id: "pct", label: "등락률" },
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
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);

  const accounts = useMemo(() => {
    if (!summary) {
      return [];
    }
    const seen = new Map<
      string,
      { id: string; label: string; color: DayChangeHolding["accountColor"] }
    >();
    for (const item of summary.items) {
      if (!seen.has(item.accountId)) {
        seen.set(item.accountId, {
          id: item.accountId,
          label: item.accountLabel,
          color: item.accountColor,
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, "ko"));
  }, [summary]);

  const selected = useMemo(() => {
    if (selectedIds == null) {
      return new Set(accounts.map((item) => item.id));
    }
    return new Set(selectedIds);
  }, [accounts, selectedIds]);
  const allSelected = accounts.length > 0 && accounts.every((item) => selected.has(item.id));

  const items = useMemo(() => {
    if (!summary) {
      return [];
    }
    const rows =
      selectedIds == null
        ? summary.items
        : summary.items.filter((item) => selected.has(item.accountId));
    return sortDayChangeHoldings(rows, sort, dir);
  }, [dir, selected, selectedIds, sort, summary]);
  const loading = !contentReady || !summary;
  const filtered = Boolean(summary && items.length !== summary.itemCount);

  function toggleAllAccounts() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(null);
    }
  }

  function toggleAccount(id: string) {
    const current = selectedIds ?? accounts.map((item) => item.id);
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    setSelectedIds(next.length === accounts.length ? null : next);
  }

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
                {formatQuoteAsOf(asOf)} · 전일 종가 기준
                {" · "}
                {filtered ? `${items.length} / ${summary.itemCount}` : summary.itemCount}종목
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                국내와 해외는 전일 종가 기준 시점이 다를 수 있습니다.
              </p>

              {accounts.length > 1 ? (
                <AccountPicker
                  accounts={accounts}
                  selected={selected}
                  allSelected={allSelected}
                  onToggleAll={toggleAllAccounts}
                  onToggle={toggleAccount}
                />
              ) : null}

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

              {items.length === 0 ? (
                <p className="px-1 py-8 text-center text-sm text-muted-foreground">
                  {summary.itemCount === 0
                    ? "전일 대비를 계산할 종목이 없습니다."
                    : "선택한 계좌에 종목이 없습니다."}
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

function AccountPicker({
  accounts,
  selected,
  allSelected,
  onToggleAll,
  onToggle,
}: {
  accounts: { id: string; label: string; color: DayChangeHolding["accountColor"] }[];
  selected: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedAccounts = accounts.filter((item) => selected.has(item.id));
  const label =
    selectedAccounts.length === 0
      ? "선택 없음"
      : allSelected
        ? "전체"
        : selectedAccounts.map((item) => item.label).join(" · ");

  return (
    <div className="mt-3">
      <div className="sm:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          className="h-9 w-full justify-between rounded-lg px-3 text-sm"
          onClick={() => setOpen((prev) => !prev)}
        >
          {selectedAccounts.length === 1 ? (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: ACCOUNT_COLOR[selectedAccounts[0].color] }}
            />
          ) : null}
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </Button>
        {open ? (
          <div className="mt-1 overflow-hidden rounded-lg border">
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
              onClick={onToggleAll}
            >
              <CheckMark on={allSelected} />
              전체
            </button>
            {accounts.map((item) => {
              const on = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="flex min-h-11 w-full items-center gap-3 border-t px-3 py-2.5 text-left text-sm"
                  onClick={() => onToggle(item.id)}
                >
                  <CheckMark on={on} />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: ACCOUNT_COLOR[item.color] }}
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 rounded-full px-3 text-xs"
          style={
            allSelected
              ? {
                  background: "var(--muted-foreground)",
                  borderColor: "var(--muted-foreground)",
                  color: "var(--background)",
                }
              : undefined
          }
          onClick={onToggleAll}
        >
          전체
        </Button>
        {accounts.map((item) => {
          const on = selected.has(item.id);
          const color = ACCOUNT_COLOR[item.color];
          return (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 rounded-full px-3 text-xs"
              style={
                on
                  ? {
                      background: color,
                      borderColor: color,
                      color: "var(--primary-foreground)",
                    }
                  : undefined
              }
              onClick={() => onToggle(item.id)}
            >
              {on ? null : (
                <span className="size-1.5 rounded-full" style={{ background: color }} />
              )}
              {item.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function CheckMark({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background",
      )}
    >
      {on ? <Check className="size-3.5" /> : null}
    </span>
  );
}

function Metrics({
  valueDelta,
  pct,
}: {
  valueDelta: number;
  pct: number;
}) {
  return (
    <div className="flex shrink-0 items-baseline gap-3">
      <p
        className={cn(
          "w-[5.75rem] text-right text-[11px] font-semibold tabular-nums",
          pnlClass(valueDelta),
        )}
      >
        {formatSignedWon(valueDelta)}
      </p>
      <DayChange value={pct} className="w-[4.25rem] justify-end" />
    </div>
  );
}

function formatSignedWon(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatWon(value)}`;
}
