import type { Account, Holding, HoldingKind, Market } from "@/lib/data/types";
import { holdingToKrw } from "@/lib/money";

export type MarketFilter = "all" | Market;
export type KindFilter = "all" | HoldingKind;
export type PnlFilter = "all" | "gain" | "loss";
export type DayFilter = "all" | "up" | "down";
export type DashboardSort = "value" | "rate" | "day" | "name";

export type DashboardFilters = {
  query: string;
  accountId: string;
  market: MarketFilter;
  kind: KindFilter;
  pnl: PnlFilter;
  day: DayFilter;
  sort: DashboardSort;
};

export type DashboardRow = {
  id: string;
  name: string;
  ticker: string;
  market: Market;
  kind: HoldingKind;
  accountId: string;
  accountLabel: string;
  accountColor: Account["color"];
  qty: number;
  buy: number;
  value: number;
  pnl: number;
  rate: number;
  weight: number;
  dayPct: number | null;
  dayDelta: number | null;
};

export type MixSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type RateBucket = {
  id: string;
  label: string;
  count: number;
};

const RATE_BUCKETS: { id: string; label: string; test: (rate: number) => boolean }[] =
  [
    { id: "le-20", label: "-20%↓", test: (rate) => rate <= -20 },
    { id: "le-10", label: "-20~-10", test: (rate) => rate > -20 && rate <= -10 },
    { id: "le-0", label: "-10~0", test: (rate) => rate > -10 && rate < 0 },
    { id: "eq-0", label: "0%", test: (rate) => rate === 0 },
    { id: "lt-10", label: "0~10", test: (rate) => rate > 0 && rate < 10 },
    { id: "lt-20", label: "10~20", test: (rate) => rate >= 10 && rate < 20 },
    { id: "ge-20", label: "20%↑", test: (rate) => rate >= 20 },
  ];

export const EMPTY_FILTERS: DashboardFilters = {
  query: "",
  accountId: "all",
  market: "all",
  kind: "all",
  pnl: "all",
  day: "all",
  sort: "value",
};

function dayChangePct(price: number, prevClose?: number) {
  if (!prevClose || prevClose <= 0) {
    return null;
  }
  return ((price - prevClose) / prevClose) * 100;
}

export function buildDashboardRows(
  accounts: Account[],
  holdings: Holding[],
  quotes: Record<string, number>,
  prevCloses: Record<string, number>,
  usdKrw: number,
): DashboardRow[] {
  const accountById = new Map(accounts.map((item) => [item.id, item]));
  const built = holdings.flatMap((holding) => {
    const account = accountById.get(holding.accountId);
    if (!account) {
      return [];
    }
    const price = quotes[holding.ticker] ?? holding.buyPrice;
    const krw = holdingToKrw(holding, price, usdKrw);
    const prev = prevCloses[holding.ticker];
    const dayPct = dayChangePct(price, prev);
    const prevValue =
      prev && prev > 0
        ? holdingToKrw(holding, prev, usdKrw).value
        : null;
    return [
      {
        id: holding.id,
        name: holding.name,
        ticker: holding.ticker,
        market: holding.market,
        kind: holding.kind,
        accountId: account.id,
        accountLabel: account.label,
        accountColor: account.color,
        qty: holding.qty,
        buy: krw.buy,
        value: krw.value,
        pnl: krw.pnl,
        rate: krw.rate,
        weight: 0,
        dayPct,
        dayDelta: prevValue == null ? null : krw.value - prevValue,
      },
    ];
  });
  const total = built.reduce((sum, item) => sum + item.value, 0);
  return built.map((item) => ({
    ...item,
    weight: total === 0 ? 0 : (item.value / total) * 100,
  }));
}

export function filterDashboardRows(
  rows: DashboardRow[],
  filters: DashboardFilters,
) {
  const needle = filters.query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (filters.accountId !== "all" && row.accountId !== filters.accountId) {
      return false;
    }
    if (filters.market !== "all" && row.market !== filters.market) {
      return false;
    }
    if (filters.kind !== "all" && row.kind !== filters.kind) {
      return false;
    }
    if (filters.pnl === "gain" && row.pnl < 0) {
      return false;
    }
    if (filters.pnl === "loss" && row.pnl >= 0) {
      return false;
    }
    if (filters.day === "up" && (row.dayPct == null || row.dayPct <= 0)) {
      return false;
    }
    if (filters.day === "down" && (row.dayPct == null || row.dayPct >= 0)) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return (
      row.name.toLowerCase().includes(needle) ||
      row.ticker.toLowerCase().includes(needle) ||
      row.accountLabel.toLowerCase().includes(needle)
    );
  });
  const total = filtered.reduce((sum, item) => sum + item.value, 0);
  const weighted = filtered.map((item) => ({
    ...item,
    weight: total === 0 ? 0 : (item.value / total) * 100,
  }));
  return [...weighted].sort((a, b) => {
    if (filters.sort === "name") {
      return a.name.localeCompare(b.name, "ko");
    }
    if (filters.sort === "rate") {
      return b.rate - a.rate;
    }
    if (filters.sort === "day") {
      return (b.dayPct ?? Number.NEGATIVE_INFINITY) - (a.dayPct ?? Number.NEGATIVE_INFINITY);
    }
    return b.value - a.value;
  });
}

export function dashboardTotals(rows: DashboardRow[]) {
  const buy = rows.reduce((sum, item) => sum + item.buy, 0);
  const value = rows.reduce((sum, item) => sum + item.value, 0);
  const pnl = value - buy;
  const dayDelta = rows.reduce((sum, item) => sum + (item.dayDelta ?? 0), 0);
  const prevValue = value - dayDelta;
  const winners = rows.filter((item) => item.pnl > 0).length;
  const losers = rows.filter((item) => item.pnl < 0).length;
  const top = rows.reduce<DashboardRow | null>(
    (best, item) => (best == null || item.value > best.value ? item : best),
    null,
  );
  return {
    buy,
    value,
    pnl,
    rate: buy === 0 ? 0 : (pnl / buy) * 100,
    dayDelta,
    dayPct: prevValue === 0 ? 0 : (dayDelta / prevValue) * 100,
    count: rows.length,
    winners,
    losers,
    winRate: rows.length === 0 ? 0 : (winners / rows.length) * 100,
    avgRate:
      rows.length === 0
        ? 0
        : rows.reduce((sum, item) => sum + item.rate, 0) / rows.length,
    topWeight: top?.weight ?? 0,
    topName: top?.name ?? "-",
  };
}

export function mixByAccount(
  rows: DashboardRow[],
  colors: Record<string, string>,
): MixSlice[] {
  const byId = new Map<string, MixSlice>();
  for (const row of rows) {
    const current = byId.get(row.accountId);
    if (current) {
      current.value += row.value;
      continue;
    }
    byId.set(row.accountId, {
      id: row.accountId,
      label: row.accountLabel,
      value: row.value,
      color: colors[row.accountColor] ?? "var(--chart-1)",
    });
  }
  return [...byId.values()].sort((a, b) => b.value - a.value);
}

export function mixByMarket(rows: DashboardRow[]): MixSlice[] {
  const kr = rows.filter((item) => item.market === "kr").reduce((sum, item) => sum + item.value, 0);
  const us = rows.filter((item) => item.market === "us").reduce((sum, item) => sum + item.value, 0);
  return [
    { id: "kr", label: "국내", value: kr, color: "var(--account-blue)" },
    { id: "us", label: "해외", value: us, color: "var(--account-cyan)" },
  ].filter((item) => item.value > 0);
}

export function mixByKind(rows: DashboardRow[]): MixSlice[] {
  const stock = rows
    .filter((item) => item.kind === "stock")
    .reduce((sum, item) => sum + item.value, 0);
  const etf = rows
    .filter((item) => item.kind === "etf")
    .reduce((sum, item) => sum + item.value, 0);
  return [
    { id: "stock", label: "주식", value: stock, color: "var(--chart-1)" },
    { id: "etf", label: "ETF", value: etf, color: "var(--chart-3)" },
  ].filter((item) => item.value > 0);
}

export function mixByCurrency(rows: DashboardRow[], holdings: Holding[]): MixSlice[] {
  const byId = new Map(holdings.map((item) => [item.id, item.currency]));
  let krw = 0;
  let usd = 0;
  for (const row of rows) {
    if (byId.get(row.id) === "USD") {
      usd += row.value;
    } else {
      krw += row.value;
    }
  }
  return [
    { id: "KRW", label: "원화", value: krw, color: "var(--chart-5)" },
    { id: "USD", label: "달러", value: usd, color: "var(--chart-4)" },
  ].filter((item) => item.value > 0);
}

export function pnlByAccount(rows: DashboardRow[]) {
  const byId = new Map<string, { id: string; label: string; pnl: number }>();
  for (const row of rows) {
    const current = byId.get(row.accountId);
    if (current) {
      current.pnl += row.pnl;
      continue;
    }
    byId.set(row.accountId, {
      id: row.accountId,
      label: row.accountLabel,
      pnl: row.pnl,
    });
  }
  return [...byId.values()].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
}

export function rateBuckets(rows: DashboardRow[]): RateBucket[] {
  return RATE_BUCKETS.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    count: rows.filter((row) => bucket.test(row.rate)).length,
  }));
}

export function filtersActive(filters: DashboardFilters) {
  return (
    filters.query.trim() !== "" ||
    filters.accountId !== "all" ||
    filters.market !== "all" ||
    filters.kind !== "all" ||
    filters.pnl !== "all" ||
    filters.day !== "all"
  );
}
