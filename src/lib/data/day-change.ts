import { toKrwAmount } from "@/lib/money";
import type { Account, AccountColor, Holding, Market } from "@/lib/data/types";

export type DayChangeSort = "pct" | "value";
export type DayChangeSortDir = "asc" | "desc";

export type DayChangeHolding = {
  id: string;
  name: string;
  ticker: string;
  market: Market;
  accountLabel: string;
  accountColor: AccountColor;
  pct: number;
  valueDelta: number;
  prevValue: number;
};

export type DayChangeSummary = {
  pct: number;
  valueDelta: number;
  prevValue: number;
  itemCount: number;
  items: DayChangeHolding[];
};

function summarizeItems(items: DayChangeHolding[]): DayChangeSummary {
  const prevValue = items.reduce((sum, item) => sum + item.prevValue, 0);
  const valueDelta = items.reduce((sum, item) => sum + item.valueDelta, 0);
  return {
    prevValue,
    valueDelta,
    pct: prevValue === 0 ? 0 : (valueDelta / prevValue) * 100,
    itemCount: items.length,
    items,
  };
}

export function sortDayChangeHoldings(
  items: DayChangeHolding[],
  sort: DayChangeSort,
  dir: DayChangeSortDir,
) {
  return [...items].sort((a, b) => {
    const delta = sort === "pct" ? a.pct - b.pct : a.valueDelta - b.valueDelta;
    return dir === "asc" ? delta : -delta;
  });
}

export function buildDayChangeSummary(
  accounts: Account[],
  holdings: Holding[],
  quotes: Record<string, number>,
  prevCloses: Record<string, number>,
  usdKrw: number,
): DayChangeSummary {
  const accountById = new Map(accounts.map((item) => [item.id, item]));
  const items: DayChangeHolding[] = [];

  for (const holding of holdings) {
    const account = accountById.get(holding.accountId);
    const prevClose = prevCloses[holding.ticker];
    const current = quotes[holding.ticker];
    if (
      !account ||
      !Number.isFinite(prevClose) ||
      !prevClose ||
      prevClose <= 0 ||
      !Number.isFinite(current) ||
      current <= 0
    ) {
      continue;
    }
    const prevValue = toKrwAmount(prevClose * holding.qty, holding.currency, usdKrw);
    const currentValue = toKrwAmount(current * holding.qty, holding.currency, usdKrw);
    items.push({
      id: holding.id,
      name: holding.name,
      ticker: holding.ticker,
      market: holding.market,
      accountLabel: account.label,
      accountColor: account.color,
      pct: ((current - prevClose) / prevClose) * 100,
      valueDelta: currentValue - prevValue,
      prevValue,
    });
  }

  return summarizeItems(items);
}
