"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  History,
  EllipsisVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  AppShell,
  ACCOUNT_COLOR,
  DayChange,
  pnlClass,
  QuoteRefreshButton,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { ChartSurface, ComboChart, Sparkline } from "@/components/portfolio/charts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PeriodPicker } from "@/components/portfolio/period-picker";
import { useOverlay } from "@/components/portfolio/overlay-context";
import { usePortfolio } from "@/lib/data/use-portfolio";
import { buildBuyEvents, buildTrend, toDateInput } from "@/lib/data/trend";
import type { Account, Holding, Period, PricePoint } from "@/lib/data/types";
import {
  formatFxAsOf,
  formatFxRate,
  formatPct,
  formatPriceShort,
  formatWon,
  formatWonNumber,
  holdingToKrw,
  USD_KRW_PAGE,
} from "@/lib/money";
import { cn } from "@/lib/utils";

function sparkFor(
  item: Holding,
  period: Period,
  quotes: Record<string, number>,
  histories: Record<string, PricePoint[]>,
) {
  const series = histories[`${item.ticker}:${period}`];
  if (series && series.length > 0) {
    return {
      values: series.map((point) => point.close),
      dates: series.map((point) => point.date),
      markRatio: buyMarkRatio(series, toDateInput(item.boughtAt)),
    };
  }
  return {
    values: [item.buyPrice, quotes[item.ticker] ?? item.buyPrice],
    dates: undefined as string[] | undefined,
    markRatio: 0,
  };
}

const DASH_SUMMARY_KEY = "mystock.dash.summaryOpen";
const DASH_TREND_KEY = "mystock.dash.trendOpen";
const HOLDING_SORT_KEY = "mystock.holdingSort";
const SELECTED_ACCOUNTS_KEY = "mystock.selectedAccounts";
const EXPANDED_ACCOUNTS_KEY = "mystock.expandedAccounts";

type HoldingSort = "value" | "rate" | "change";
type SortDir = "asc" | "desc";

const HOLDING_SORTS: { id: HoldingSort; label: string }[] = [
  { id: "rate", label: "수익률" },
  { id: "value", label: "평가금액" },
  { id: "change", label: "전일 대비" },
];

function isHoldingSort(value: string): value is HoldingSort {
  return HOLDING_SORTS.some((item) => item.id === value);
}

function parseHoldingSort(raw: string | null): { id: HoldingSort; dir: SortDir } {
  if (!raw) {
    return { id: "value", dir: "desc" };
  }
  const [id, dir] = raw.split(":");
  return {
    id: isHoldingSort(id) ? id : "value",
    dir: dir === "asc" ? "asc" : "desc",
  };
}

function parseSelectedIds(raw: string | null): string[] | null {
  if (raw == null || raw === "") {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return null;
    }
    return parsed as string[];
  } catch {
    return null;
  }
}

function persistSelectedIds(ids: string[] | null) {
  if (ids == null) {
    window.localStorage.removeItem(SELECTED_ACCOUNTS_KEY);
    return;
  }
  window.localStorage.setItem(SELECTED_ACCOUNTS_KEY, JSON.stringify(ids));
}

function parseExpanded(raw: string | null): Record<string, boolean> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const next: Record<string, boolean> = {};
    for (const [id, open] of Object.entries(parsed)) {
      if (typeof open === "boolean") {
        next[id] = open;
      }
    }
    return next;
  } catch {
    return {};
  }
}

function persistExpanded(next: Record<string, boolean>) {
  window.localStorage.setItem(EXPANDED_ACCOUNTS_KEY, JSON.stringify(next));
}

function dayChangePct(price: number, prevClose?: number) {
  if (!prevClose || prevClose <= 0) {
    return null;
  }
  return ((price - prevClose) / prevClose) * 100;
}

function compareHoldings(
  a: Holding,
  b: Holding,
  sort: HoldingSort,
  dir: SortDir,
  quotes: Record<string, number>,
  prevCloses: Record<string, number>,
  usdKrw: number,
) {
  const aPrice = quotes[a.ticker] ?? a.buyPrice;
  const bPrice = quotes[b.ticker] ?? b.buyPrice;
  const aKrw = holdingToKrw(a, aPrice, usdKrw);
  const bKrw = holdingToKrw(b, bPrice, usdKrw);
  let delta = 0;
  if (sort === "rate") {
    delta = aKrw.rate - bKrw.rate;
  } else if (sort === "change") {
    const aChange = dayChangePct(aPrice, prevCloses[a.ticker]);
    const bChange = dayChangePct(bPrice, prevCloses[b.ticker]);
    delta = (aChange ?? Number.NEGATIVE_INFINITY) - (bChange ?? Number.NEGATIVE_INFINITY);
  } else {
    delta = aKrw.value - bKrw.value;
  }
  return dir === "asc" ? delta : -delta;
}

function useDashOpen(key: string) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(window.localStorage.getItem(key) === "1");
  }, [key]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem(key, next ? "1" : "0");
      return next;
    });
  }

  return [open, toggle] as const;
}

function buyMarkRatio(series: PricePoint[], buy: string) {
  if (series.length === 0) {
    return null;
  }
  const first = series[0].date;
  const last = series[series.length - 1].date;
  if (buy < first || buy > last) {
    return null;
  }
  if (series.length === 1) {
    return 0;
  }
  const index = series.findIndex((point) => point.date >= buy);
  if (index < 0) {
    return null;
  }
  return index / (series.length - 1);
}

function HoldingSortBar({
  holdingSort,
  sortDir,
  onChange,
  onAddHolding,
}: {
  holdingSort: HoldingSort;
  sortDir: SortDir;
  onChange: (id: HoldingSort, dir: SortDir) => void;
  onAddHolding: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 px-1 pt-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
        {HOLDING_SORTS.map((item) => {
          const active = holdingSort === item.id;
          const SortIcon =
            active && sortDir === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow;
          return (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={active ? "secondary" : "ghost"}
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => {
                onChange(
                  item.id,
                  active ? (sortDir === "desc" ? "asc" : "desc") : "desc",
                );
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
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="ml-auto h-7 gap-1 px-2 text-xs"
        onClick={onAddHolding}
      >
        <Plus className="size-3.5" />
        신규 매수
      </Button>
    </div>
  );
}

function AccountChipBar({
  accounts,
  selected,
  allSelected,
  plusFirst,
  scroll,
  onToggleAll,
  onToggle,
  onAdd,
  className,
}: {
  accounts: Account[];
  selected: Set<string>;
  allSelected: boolean;
  plusFirst?: boolean;
  scroll?: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onAdd: () => void;
  className?: string;
}) {
  const addButton = (
    <Button
      type="button"
      size="icon-sm"
      variant="outline"
      className="size-12 shrink-0 rounded-full"
      title="계좌 추가"
      onClick={onAdd}
    >
      <Plus />
    </Button>
  );
  const chips = (
    <>
      {accounts.length > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-12 shrink-0 rounded-full px-4 text-sm"
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
      ) : null}
      {accounts.map((item) => {
        const on = selected.has(item.id);
        const color = ACCOUNT_COLOR[item.color];
        return (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant="outline"
            className="h-12 shrink-0 rounded-full px-4 text-sm"
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
              <span
                className="size-2 rounded-full"
                style={{ background: color }}
              />
            )}
            {item.label}
          </Button>
        );
      })}
    </>
  );

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {plusFirst ? addButton : null}
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5",
          scroll
            ? "flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "flex-wrap",
        )}
      >
        {chips}
        {plusFirst ? null : addButton}
      </div>
    </div>
  );
}

function accountFilterLabel(
  selectedAccounts: Account[],
  allSelected: boolean,
) {
  if (selectedAccounts.length === 0) {
    return "선택 없음";
  }
  if (allSelected) {
    return "전체";
  }
  return selectedAccounts.map((item) => item.label).join(" · ");
}

function AccountSheetDock({
  accounts,
  selected,
  selectedAccounts,
  allSelected,
  onToggleAll,
  onToggle,
  onAdd,
}: {
  accounts: Account[];
  selected: Set<string>;
  selectedAccounts: Account[];
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = accountFilterLabel(selectedAccounts, allSelected);

  return createPortal(
    <div className="sm:hidden">
      {open ? (
        <button
          type="button"
          aria-label="닫기"
          className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-[2px] dark:bg-black/50"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="fixed inset-x-0 bottom-0 z-40">
        {open ? (
          <div className="rounded-t-2xl border-t bg-card shadow-[0_-12px_32px_-12px_rgb(0_0_0/0.28)]">
            <div className="flex justify-center pt-2">
              <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
              <p className="text-base font-medium">계좌 선택</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                닫기
              </Button>
            </div>
            <div className="max-h-[50dvh] overflow-y-auto px-2 pb-1">
              {accounts.length > 0 ? (
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-3.5 text-left text-base"
                  onClick={onToggleAll}
                >
                  <CheckMark on={allSelected} />
                  전체
                </button>
              ) : null}
              {accounts.map((item) => {
                const on = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-3.5 text-left text-base"
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
          </div>
        ) : null}
        <div className="border-t bg-background/95 pt-2 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.15)] backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-4">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="size-12 shrink-0 rounded-full"
              title="계좌 추가"
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
            >
              <Plus />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-expanded={open}
              className="h-12 min-w-0 flex-1 justify-between rounded-full px-4 text-sm"
              onClick={() => setOpen((prev) => !prev)}
            >
              {selectedAccounts.length === 1 ? (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background: ACCOUNT_COLOR[selectedAccounts[0].color],
                  }}
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
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CheckMark({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md border",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background",
      )}
    >
      {on ? <Check className="size-4" /> : null}
    </span>
  );
}

export function HomeView() {
  const overlay = useOverlay();
  const portfolio = usePortfolio();
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [period, setPeriod] = useState<Period>("1y");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [summaryOpen, toggleSummary] = useDashOpen(DASH_SUMMARY_KEY);
  const [trendOpen, toggleTrend] = useDashOpen(DASH_TREND_KEY);
  const [holdingSort, setHoldingSort] = useState<HoldingSort>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    const saved = parseHoldingSort(window.localStorage.getItem(HOLDING_SORT_KEY));
    setHoldingSort(saved.id);
    setSortDir(saved.dir);
    setSelectedIds(parseSelectedIds(window.localStorage.getItem(SELECTED_ACCOUNTS_KEY)));
    setExpanded(parseExpanded(window.localStorage.getItem(EXPANDED_ACCOUNTS_KEY)));
  }, []);

  const {
    ready,
    accounts,
    holdings,
    quotes,
    prevCloses,
    fx,
    histories,
    chartsLoading,
    loadCharts,
  } = portfolio;
  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.label.localeCompare(b.label, "ko")),
    [accounts],
  );
  const knownIds = new Set(sortedAccounts.map((item) => item.id));
  const activeIds =
    selectedIds == null
      ? sortedAccounts.map((item) => item.id)
      : selectedIds.filter((id) => knownIds.has(id));
  const selected = new Set(activeIds);
  const allSelected =
    accounts.length > 0 && accounts.every((item) => selected.has(item.id));

  const rows = holdings.filter((item) => selected.has(item.accountId));
  const usdKrw = fx.usdKrw;

  const totals = rows.reduce(
    (acc, item) => {
      const krw = holdingToKrw(item, quotes[item.ticker] ?? item.buyPrice, usdKrw);
      acc.buy += krw.buy;
      acc.value += krw.value;
      return acc;
    },
    { buy: 0, value: 0 },
  );
  const rate =
    totals.buy === 0 ? 0 : ((totals.value - totals.buy) / totals.buy) * 100;
  const pnl = totals.value - totals.buy;
  const selectedAccounts = sortedAccounts.filter((item) => selected.has(item.id));
  const showAccountMix = selectedAccounts.length !== 1;
  const krValue = rows
    .filter((item) => item.market === "kr")
    .reduce(
      (sum, item) =>
        sum + holdingToKrw(item, quotes[item.ticker] ?? item.buyPrice, usdKrw).value,
      0,
    );
  const usValue = totals.value - krValue;
  const grouped = sortedAccounts
    .filter((item) => selected.has(item.id))
    .map((broker) => {
      const items = rows
        .filter((row) => row.accountId === broker.id)
        .sort((a, b) =>
          compareHoldings(a, b, holdingSort, sortDir, quotes, prevCloses, usdKrw),
        );
      const value = items.reduce(
        (sum, item) =>
          sum + holdingToKrw(item, quotes[item.ticker] ?? item.buyPrice, usdKrw).value,
        0,
      );
      const buy = items.reduce(
        (sum, item) =>
          sum + holdingToKrw(item, quotes[item.ticker] ?? item.buyPrice, usdKrw).buy,
        0,
      );
      const nextRate = buy === 0 ? 0 : ((value - buy) / buy) * 100;
      return { ...broker, items, value, buy, rate: nextRate };
    });

  const seriesByTicker = useMemo(() => {
    const next: Record<string, (typeof histories)[string]> = {};
    for (const item of holdings) {
      if (!selected.has(item.accountId)) {
        continue;
      }
      next[item.ticker] = histories[`${item.ticker}:${period}`] ?? [];
    }
    return next;
  }, [holdings, histories, period, selectedIds, accounts]);

  const visibleHoldings = holdings.filter((item) => selected.has(item.accountId));
  const trend = useMemo(
    () =>
      buildTrend({
        period,
        accountId: null,
        holdings: visibleHoldings,
        seriesByTicker,
        quotes,
        usdKrw,
      }),
    [period, quotes, seriesByTicker, usdKrw, visibleHoldings],
  );
  const buyEvents = useMemo(() => {
    const start = trend[0]?.date;
    const end = trend[trend.length - 1]?.date;
    return buildBuyEvents(visibleHoldings, usdKrw, start, end);
  }, [trend, usdKrw, visibleHoldings]);

  const tickerKey = [...new Set(rows.map((item) => item.ticker))].join(",");

  useEffect(() => {
    if (!tickerKey) {
      return;
    }
    void loadCharts(tickerKey.split(","), period);
  }, [loadCharts, period, tickerKey]);

  if (!ready) {
    return <ScreenSkeleton />;
  }

  function toggleAllAccounts() {
    if (allSelected) {
      setSelectedIds([]);
      persistSelectedIds([]);
    } else {
      setSelectedIds(null);
      persistSelectedIds(null);
    }
  }

  function toggleAccount(id: string) {
    const current = selectedIds ?? sortedAccounts.map((row) => row.id);
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    const stored = next.length === sortedAccounts.length ? null : next;
    setSelectedIds(stored);
    persistSelectedIds(stored);
  }

  return (
    <AppShell
      dock={
        <AccountSheetDock
          accounts={sortedAccounts}
          selected={selected}
          selectedAccounts={selectedAccounts}
          allSelected={allSelected}
          onToggleAll={toggleAllAccounts}
          onToggle={toggleAccount}
          onAdd={() => overlay.open({ m: "account-new" })}
        />
      }
    >
      <div className="flex flex-col gap-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:gap-6 sm:pb-0">
        <AccountChipBar
          className="hidden sm:flex"
          accounts={sortedAccounts}
          selected={selected}
          allSelected={allSelected}
          onToggleAll={toggleAllAccounts}
          onToggle={toggleAccount}
          onAdd={() => overlay.open({ m: "account-new" })}
        />

        {accounts.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              className="cursor-pointer select-none"
              role="button"
              tabIndex={0}
              aria-expanded={summaryOpen}
              onClick={toggleSummary}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleSummary();
                }
              }}
            >
              <CardTitle>자산 현황</CardTitle>
              <CardAction className="row-span-1 flex items-center gap-2 self-center">
                <QuoteRefreshButton className="justify-end" />
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    summaryOpen ? "rotate-0" : "-rotate-90",
                  )}
                />
              </CardAction>
              {summaryOpen ? (
                <>
                  <CardDescription>총 평가 금액</CardDescription>
                  <div className="flex flex-wrap items-end gap-4">
                    <p className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                      {formatWon(totals.value)}
                    </p>
                    <p className={`text-sm font-semibold ${pnlClass(rate)}`}>
                      {formatPct(rate)}
                    </p>
                  </div>
                </>
              ) : null}
            </CardHeader>
            {summaryOpen ? (
              <>
                <CardContent className="pb-5">
                  <UsageBar
                    label={showAccountMix ? "계좌 구성" : "시장 구성"}
                    hint={
                      showAccountMix
                        ? `${grouped.length}개 증권사`
                        : `국내 ${Math.round((krValue / Math.max(totals.value, 1)) * 100)}%`
                    }
                    segments={
                      showAccountMix
                        ? grouped.map((group) => ({
                            id: group.id,
                            value: group.value,
                            color: ACCOUNT_COLOR[group.color],
                          }))
                        : [
                            { id: "kr", value: krValue, color: "var(--account-blue)" },
                            { id: "us", value: usValue, color: "var(--account-cyan)" },
                          ]
                    }
                  />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Stat label="매수 금액" value={formatWon(totals.buy)} />
                    <Stat
                      label="평가 손익"
                      value={formatWon(pnl)}
                      className={pnlClass(pnl)}
                    />
                    <Stat label="보유 종목" value={`${rows.length}개`} />
                  </div>
                </CardContent>
                <CardFooter className="mt-2 flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatFxRate(fx.usdKrw)}</span>
                  <span className="min-w-0 truncate">
                    {fx.fallback ? (
                      "환율 대기"
                    ) : (
                      <>
                        <a
                          href={USD_KRW_PAGE}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-2 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {fx.source} {fx.symbol}
                        </a>
                        {fx.asOf ? ` · ${formatFxAsOf(fx.asOf)}` : null}
                      </>
                    )}
                  </span>
                </CardFooter>
              </>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              className="cursor-pointer select-none"
              role="button"
              tabIndex={0}
              aria-expanded={trendOpen}
              onClick={toggleTrend}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleTrend();
                }
              }}
            >
              <CardTitle>평가 추이</CardTitle>
              <CardAction className="row-span-1 flex items-center gap-2 self-center">
                {trendOpen ? null : (
                  <span className="text-xs text-muted-foreground">펼침</span>
                )}
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    trendOpen ? "rotate-0" : "-rotate-90",
                  )}
                />
              </CardAction>
            </CardHeader>
            {trendOpen ? (
              <CardContent className="space-y-3">
                <PeriodPicker value={period} onChange={setPeriod} />
                <ChartSurface period={period} loading={chartsLoading}>
                  <ComboChart
                    labels={trend.map((item) => item.label)}
                    dates={trend.map((item) => item.date)}
                    values={trend.map((item) => item.value)}
                    rates={trend.map((item) => item.rate)}
                    buyEvents={buyEvents}
                    lineStartDate={
                      visibleHoldings
                        .map((item) => toDateInput(item.boughtAt))
                        .sort()[0]
                    }
                  />
                </ChartSurface>
                <p className="text-xs text-muted-foreground">
                  보유 수량 × 과거 종가 · 점선은 수익률 · 막대는 매수일 원화 금액 · 단위 만원
                </p>
              </CardContent>
            ) : null}
          </Card>
        </div>
        ) : null}

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 font-heading text-base font-medium sm:text-lg">
              보유 종목
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => overlay.open({ m: "lots" })}
            >
              <History data-icon="inline-start" />
              매수 이력
            </Button>
            {grouped.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const allOpen = grouped.every((group) => expanded[group.id] !== false);
                  setExpanded((prev) => {
                    const next: Record<string, boolean> = { ...prev };
                    for (const group of grouped) {
                      next[group.id] = !allOpen;
                    }
                    persistExpanded(next);
                    return next;
                  });
                }}
              >
                {grouped.every((group) => expanded[group.id] !== false) ? (
                  <>
                    <ChevronsUp data-icon="inline-start" />
                    종목 숨김
                  </>
                ) : (
                  <>
                    <ChevronsDown data-icon="inline-start" />
                    종목 펼침
                  </>
                )}
              </Button>
            ) : null}
          </div>
          {accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center">
              <p className="font-heading text-base font-medium">아직 계좌가 없습니다</p>
              <p className="mt-2 text-sm text-muted-foreground">
                계좌를 추가한 뒤 종목을 넣으면 평가와 추이를 볼 수 있습니다.
              </p>
              <ol className="mx-auto mt-4 max-w-xs space-y-1 text-left text-sm text-muted-foreground">
                <li>1. 계좌 추가</li>
                <li>2. 신규 매수</li>
              </ol>
              <Button
                type="button"
                className="mt-5"
                onClick={() => overlay.open({ m: "account-new" })}
              >
                계좌 추가
              </Button>
            </div>
          ) : null}
          {accounts.length > 0 && holdings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              계좌를 펼친 뒤 신규 매수로 넣으세요.
            </p>
          ) : null}
          {grouped.map((group) => {
            const open = expanded[group.id] !== false;
            return (
            <div key={group.id}>
              <div
                className="cursor-pointer rounded-lg border bg-muted/30 px-3 py-2.5 hover:bg-muted/45"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = {
                      ...prev,
                      [group.id]: prev[group.id] === false,
                    };
                    persistExpanded(next);
                    return next;
                  })
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      open ? "rotate-0" : "-rotate-90",
                    )}
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: ACCOUNT_COLOR[group.color] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                      계좌
                    </p>
                    <p className="truncate font-heading text-base font-semibold sm:text-lg">
                      {group.label}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        title="계좌 관리"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <EllipsisVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="z-[80] w-auto min-w-32"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DropdownMenuItem
                        onClick={() =>
                          overlay.open({ m: "account-edit", id: group.id })
                        }
                      >
                        <Pencil />
                        계좌명 수정
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() =>
                          overlay.open({ m: "account-delete", id: group.id })
                        }
                      >
                        <Trash2 />
                        계좌 삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3 pl-10">
                  <div>
                    <p className="text-[11px] text-muted-foreground">종목</p>
                    <p className="text-sm font-medium">{group.items.length}개</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">수익률</p>
                    <p className={`text-sm font-semibold ${pnlClass(group.rate)}`}>
                      {formatPct(group.rate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">평가금액</p>
                    <p className="truncate text-sm font-medium">
                      {formatWon(group.value)}
                    </p>
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
                aria-hidden={!open}
              >
                <div className="min-h-0 overflow-hidden" inert={!open || undefined}>
                  <HoldingSortBar
                    holdingSort={holdingSort}
                    sortDir={sortDir}
                    onAddHolding={() =>
                      overlay.open({ m: "holding-new", accountId: group.id })
                    }
                    onChange={(id, dir) => {
                      setHoldingSort(id);
                      setSortDir(dir);
                      window.localStorage.setItem(
                        HOLDING_SORT_KEY,
                        `${id}:${dir}`,
                      );
                    }}
                  />
                  {group.items.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      이 계좌에 종목이 없습니다. 신규 매수로 넣으세요.
                    </p>
                  ) : (
                    <div
                      className="ml-2 divide-y border-l-2 pl-3 [&>*:last-child]:border-b"
                      style={{ borderColor: ACCOUNT_COLOR[group.color] }}
                    >
                      {group.items.map((item) => (
                        <HoldingRow
                          key={item.id}
                          item={item}
                          period={period}
                          quotes={quotes}
                          prevClose={prevCloses[item.ticker]}
                          histories={histories}
                          usdKrw={usdKrw}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </section>

        <p className="pt-2 text-center text-[11px] leading-5 text-muted-foreground">
          Developed with Cursor Grok by dcjames.park. Stock information is sourced from Yahoo Finance.
        </p>
      </div>
    </AppShell>
  );
}

function HoldingRow({
  item,
  period,
  quotes,
  prevClose,
  histories,
  usdKrw,
}: {
  item: Holding;
  period: Period;
  quotes: Record<string, number>;
  prevClose?: number;
  histories: Record<string, PricePoint[]>;
  usdKrw: number;
}) {
  const overlay = useOverlay();
  const currentPrice = quotes[item.ticker] ?? item.buyPrice;
  const krw = holdingToKrw(item, currentPrice, usdKrw);
  const spark = sparkFor(item, period, quotes, histories);
  const dayChange = dayChangePct(currentPrice, prevClose);

  return (
    <div
      className="-mx-1 cursor-pointer rounded-lg px-1 py-4 hover:bg-muted/40"
      role="link"
      tabIndex={0}
      onClick={() => overlay.open({ m: "holding", id: item.id })}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          overlay.open({ m: "holding", id: item.id });
        }
      }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.ticker}
            <span className="mx-1.5">·</span>
            {item.market === "kr" ? "국내" : "해외"}
            {(item.lots?.length ?? 0) > 1 ? (
              <>
                <span className="mx-1.5">·</span>
                {item.lots.length}회 매수
              </>
            ) : null}
          </p>
        </div>
        <DayChange value={dayChange} className="shrink-0 pt-0.5" />
      </div>

      <div className="mt-3 flex items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat
              label="수익률"
              value={formatPct(krw.rate)}
              className={pnlClass(krw.rate)}
              size="lg"
            />
            <Stat
              label="수익금액"
              value={formatWonNumber(krw.pnl)}
              className={pnlClass(krw.pnl)}
              size="lg"
            />
            <Stat label="평가금액" value={formatWonNumber(krw.value)} size="lg" />
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            보유수 {item.qty.toLocaleString("ko-KR")}
            <span className="mx-1.5">·</span>
            {(item.lots?.length ?? 0) > 1 ? "평균 매수가" : "매수가"}{" "}
            {formatPriceShort(item.buyPrice, item.currency)}
            <span className="mx-1.5">·</span>
            현재가 {formatPriceShort(currentPrice, item.currency)}
          </p>
        </div>
        <div className="relative h-12 w-20 shrink-0 overflow-visible sm:w-32 md:w-44">
          <Sparkline
            values={spark.values}
            dates={spark.dates}
            positive={krw.rate >= 0}
            height={48}
            markRatio={spark.markRatio}
            buyPrice={item.buyPrice}
            currency={item.currency}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
  size = "sm",
}: {
  label: string;
  value: string;
  className?: string;
  size?: "sm" | "lg";
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-semibold tracking-tight",
          size === "lg" ? "text-base sm:text-lg" : "text-xs sm:text-sm",
          className,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function UsageBar({
  label,
  hint,
  segments,
}: {
  label: string;
  hint: string;
  segments: { id: string; value: number; color: string }[];
}) {
  const total = Math.max(
    segments.reduce((sum, item) => sum + item.value, 0),
    1,
  );
  return (
    <div>
      <div className="mb-1 flex text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="flex-1" />
        <span>{hint}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {segments.map((item) => (
          <span
            key={item.id}
            style={{
              width: `${(item.value / total) * 100}%`,
              background: item.color,
            }}
          />
        ))}
      </div>
    </div>
  );
}
