"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ACCOUNT_COLOR,
  AppShell,
  OverlayCloseButton,
  pnlClass,
  ScreenHeader,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { ChartSurface, ComboChart } from "@/components/portfolio/charts";
import { DonutChart, HBarChart, Histogram } from "@/components/portfolio/dashboard-charts";
import { PeriodPicker } from "@/components/portfolio/period-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOverlay } from "@/components/portfolio/overlay-context";
import {
  buildDashboardRows,
  dashboardTotals,
  EMPTY_FILTERS,
  filterDashboardRows,
  filtersActive,
  mixByAccount,
  mixByCurrency,
  mixByKind,
  mixByMarket,
  pnlByAccount,
  rateBuckets,
  type DashboardFilters,
  type DashboardRow,
  type DashboardSort,
  type DayFilter,
  type KindFilter,
  type MarketFilter,
  type PnlFilter,
} from "@/lib/data/dashboard";
import { buildBuyEvents, buildTrend, toDateInput } from "@/lib/data/trend";
import { usePortfolio } from "@/lib/data/use-portfolio";
import type { Period } from "@/lib/data/types";
import { formatPct, formatWon } from "@/lib/money";
import { cn } from "@/lib/utils";

const MARKET_FILTERS: { id: MarketFilter; label: string }[] = [
  { id: "all", label: "시장" },
  { id: "kr", label: "국내" },
  { id: "us", label: "해외" },
];

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "유형" },
  { id: "stock", label: "주식" },
  { id: "etf", label: "ETF" },
];

const PNL_FILTERS: { id: PnlFilter; label: string }[] = [
  { id: "all", label: "손익" },
  { id: "gain", label: "수익" },
  { id: "loss", label: "손실" },
];

const DAY_FILTERS: { id: DayFilter; label: string }[] = [
  { id: "all", label: "전일" },
  { id: "up", label: "상승" },
  { id: "down", label: "하락" },
];

const SORTS: { id: DashboardSort; label: string }[] = [
  { id: "value", label: "평가액" },
  { id: "rate", label: "수익률" },
  { id: "day", label: "전일대비" },
  { id: "name", label: "이름" },
];

function signedWon(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatWon(value)}`;
}

export function DashboardView() {
  const overlay = useOverlay();
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
  } = usePortfolio();
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [period, setPeriod] = useState<Period>("1y");
  const usdKrw = fx.usdKrw;

  const allRows = useMemo(
    () => buildDashboardRows(accounts, holdings, quotes, prevCloses, usdKrw),
    [accounts, holdings, quotes, prevCloses, usdKrw],
  );
  const rows = useMemo(
    () => filterDashboardRows(allRows, filters),
    [allRows, filters],
  );
  const totals = useMemo(() => dashboardTotals(rows), [rows]);
  const filtered = filtersActive(filters) || rows.length !== allRows.length;
  const visibleIds = useMemo(() => new Set(rows.map((item) => item.id)), [rows]);
  const visibleHoldings = useMemo(
    () => holdings.filter((item) => visibleIds.has(item.id)),
    [holdings, visibleIds],
  );

  const seriesByTicker = useMemo(() => {
    const next: Record<string, (typeof histories)[string]> = {};
    for (const item of visibleHoldings) {
      next[item.ticker] = histories[`${item.ticker}:${period}`] ?? [];
    }
    return next;
  }, [histories, period, visibleHoldings]);

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

  const tickerKey = [...new Set(visibleHoldings.map((item) => item.ticker))].join(",");
  useEffect(() => {
    if (!tickerKey) {
      return;
    }
    void loadCharts(tickerKey.split(","), period);
  }, [loadCharts, period, tickerKey]);

  const accountMix = mixByAccount(rows, ACCOUNT_COLOR);
  const marketMix = mixByMarket(rows);
  const kindMix = mixByKind(rows);
  const currencyMix = mixByCurrency(rows, holdings);
  const accountPnl = pnlByAccount(rows);
  const buckets = rateBuckets(rows);
  const topValue = rows.slice(0, 8);
  const topRate = [...rows].sort((a, b) => b.rate - a.rate).slice(0, 6);
  const bottomRate = [...rows].sort((a, b) => a.rate - b.rate).slice(0, 6);
  const dayLeaders = [...rows]
    .filter((item) => item.dayDelta != null)
    .sort((a, b) => Math.abs(b.dayDelta ?? 0) - Math.abs(a.dayDelta ?? 0))
    .slice(0, 8);

  function patch(next: Partial<DashboardFilters>) {
    setFilters((prev) => ({ ...prev, ...next }));
  }

  if (!ready) {
    return <ScreenSkeleton />;
  }

  return (
    <AppShell>
      <ScreenHeader title="대시보드" dismiss />
      <div className="flex flex-col gap-4 pb-2">
        <Card>
          <CardHeader>
            <CardTitle>조건 검색</CardTitle>
            <CardDescription>
              {filtered ? `${rows.length} / ${allRows.length}` : allRows.length}종목
              {" · "}
              {formatWon(totals.value)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={filters.query}
              onChange={(event) => patch({ query: event.target.value })}
              placeholder="종목명, 티커, 계좌"
              aria-label="종목 검색"
            />
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                on={filters.accountId === "all"}
                onClick={() => patch({ accountId: "all" })}
              >
                전체 계좌
              </FilterChip>
              {accounts.map((item) => (
                <FilterChip
                  key={item.id}
                  on={filters.accountId === item.id}
                  onClick={() => patch({ accountId: item.id })}
                >
                  {item.label}
                </FilterChip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MARKET_FILTERS.map((item) => (
                <FilterChip
                  key={item.id}
                  on={filters.market === item.id}
                  onClick={() => patch({ market: item.id })}
                >
                  {item.label}
                </FilterChip>
              ))}
              {KIND_FILTERS.map((item) => (
                <FilterChip
                  key={item.id}
                  on={filters.kind === item.id}
                  onClick={() => patch({ kind: item.id })}
                >
                  {item.label}
                </FilterChip>
              ))}
              {PNL_FILTERS.map((item) => (
                <FilterChip
                  key={item.id}
                  on={filters.pnl === item.id}
                  onClick={() => patch({ pnl: item.id })}
                >
                  {item.label}
                </FilterChip>
              ))}
              {DAY_FILTERS.map((item) => (
                <FilterChip
                  key={item.id}
                  on={filters.day === item.id}
                  onClick={() => patch({ day: item.id })}
                >
                  {item.label}
                </FilterChip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {SORTS.map((item) => (
                <FilterChip
                  key={item.id}
                  on={filters.sort === item.id}
                  onClick={() => patch({ sort: item.id })}
                >
                  {item.label}순
                </FilterChip>
              ))}
              {filtersActive(filters) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}
                >
                  조건 초기화
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {allRows.length === 0
                ? "표시할 보유 종목이 없습니다."
                : "조건에 맞는 종목이 없습니다."}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi label="총 평가" value={formatWon(totals.value)} />
              <Kpi
                label="평가 손익"
                value={signedWon(totals.pnl)}
                className={pnlClass(totals.pnl)}
              />
              <Kpi
                label="수익률"
                value={formatPct(totals.rate)}
                className={pnlClass(totals.rate)}
              />
              <Kpi
                label="전일 대비"
                value={signedWon(totals.dayDelta)}
                className={pnlClass(totals.dayDelta)}
              />
              <Kpi label="매수 금액" value={formatWon(totals.buy)} />
              <Kpi label="승률" value={`${totals.winners}/${totals.count} · ${totals.winRate.toFixed(1)}%`} />
              <Kpi label="평균 수익률" value={formatPct(totals.avgRate)} className={pnlClass(totals.avgRate)} />
              <Kpi label="최대 비중" value={`${totals.topName} ${totals.topWeight.toFixed(1)}%`} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>평가 추이</CardTitle>
                <CardDescription>조건에 맞는 종목 합산 · 단위 만원</CardDescription>
              </CardHeader>
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
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {accountMix.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>계좌 구성</CardTitle>
                    <CardDescription>평가금액 비중</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DonutChart slices={accountMix} total={totals.value} />
                  </CardContent>
                </Card>
              ) : null}
              {marketMix.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>시장 구성</CardTitle>
                    <CardDescription>국내 / 해외</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DonutChart slices={marketMix} total={totals.value} />
                  </CardContent>
                </Card>
              ) : null}
              {kindMix.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>유형 구성</CardTitle>
                    <CardDescription>주식 / ETF</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DonutChart slices={kindMix} total={totals.value} />
                  </CardContent>
                </Card>
              ) : null}
              {currencyMix.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>통화 구성</CardTitle>
                    <CardDescription>원화 환산 평가액</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DonutChart slices={currencyMix} total={totals.value} />
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {accountPnl.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>계좌별 손익</CardTitle>
                    <CardDescription>평가손익 합계</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HBarChart
                      items={accountPnl.map((item) => ({
                        id: item.id,
                        label: item.label,
                        value: item.pnl,
                      }))}
                    />
                  </CardContent>
                </Card>
              ) : null}
              {topValue.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>보유 비중</CardTitle>
                    <CardDescription>평가액 상위</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HBarChart
                      items={topValue.map((item) => ({
                        id: item.id,
                        label: item.name,
                        value: item.value,
                        color: ACCOUNT_COLOR[item.accountColor],
                      }))}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>수익률 분포</CardTitle>
                <CardDescription>종목 수 기준</CardDescription>
              </CardHeader>
              <CardContent>
                <Histogram items={buckets} />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>수익률 상위</CardTitle>
                  <CardDescription>매수 대비</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={topRate}
                    value={(item) => formatPct(item.rate)}
                    tone={(item) => item.rate}
                    onOpen={(id) => overlay.open({ m: "holding", id })}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>수익률 하위</CardTitle>
                  <CardDescription>매수 대비</CardDescription>
                </CardHeader>
                <CardContent>
                  <RankList
                    rows={bottomRate}
                    value={(item) => formatPct(item.rate)}
                    tone={(item) => item.rate}
                    onOpen={(id) => overlay.open({ m: "holding", id })}
                  />
                </CardContent>
              </Card>
            </div>

            {dayLeaders.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>전일 대비 변동</CardTitle>
                  <CardDescription>평가금액 변동 큰 순</CardDescription>
                </CardHeader>
                <CardContent>
                  <HBarChart
                    items={dayLeaders.map((item) => ({
                      id: item.id,
                      label: item.name,
                      value: item.dayDelta ?? 0,
                    }))}
                  />
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
      <OverlayCloseButton wide className="mt-6" />
    </AppShell>
  );
}

function FilterChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={on ? "default" : "outline"}
      className="h-7 rounded-full px-3 text-xs"
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Kpi({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card size="sm" className="py-3">
      <CardContent className="px-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={cn("mt-1 truncate text-sm font-semibold tabular-nums", className)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function RankList({
  rows,
  value,
  tone,
  onOpen,
}: {
  rows: DashboardRow[];
  value: (row: DashboardRow) => string;
  tone: (row: DashboardRow) => number;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">데이터가 없습니다.</p>
    );
  }
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 py-2 text-left"
            onClick={() => onOpen(row.id)}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm">{row.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {row.ticker} · {row.accountLabel}
              </span>
            </span>
            <span className={cn("shrink-0 text-sm font-semibold tabular-nums", pnlClass(tone(row)))}>
              {value(row)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
