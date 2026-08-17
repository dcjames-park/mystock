import { toKrwAmount } from "@/lib/money";
import type { Account, AccountColor, Holding, Market } from "@/lib/data/types";

export const DAY_CHANGE_POPUP_SHOWN_KEY = "mystock.dayChangePopupShown";

export type DayChangeSort = "pct" | "value";
export type DayChangeSortDir = "asc" | "desc";
export type DayChangeMarketFilter = "all" | Market;

export type DayChangeHolding = {
  id: string;
  name: string;
  ticker: string;
  market: Market;
  pct: number;
  valueDelta: number;
  prevValue: number;
};

export type DayChangeAccountSummary = {
  id: string;
  label: string;
  color: AccountColor;
  pct: number;
  valueDelta: number;
  prevValue: number;
  items: DayChangeHolding[];
};

export type DayChangeSummary = {
  pct: number;
  valueDelta: number;
  prevValue: number;
  itemCount: number;
  accounts: DayChangeAccountSummary[];
};

function summarizeAccounts(accounts: DayChangeAccountSummary[]): DayChangeSummary {
  const prevValue = accounts.reduce((sum, item) => sum + item.prevValue, 0);
  const valueDelta = accounts.reduce((sum, item) => sum + item.valueDelta, 0);
  return {
    prevValue,
    valueDelta,
    pct: prevValue === 0 ? 0 : (valueDelta / prevValue) * 100,
    itemCount: accounts.reduce((sum, item) => sum + item.items.length, 0),
    accounts,
  };
}

function sortHoldings(
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
  const byAccount = new Map<string, DayChangeHolding[]>();

  for (const holding of holdings) {
    const prevClose = prevCloses[holding.ticker];
    const current = quotes[holding.ticker];
    if (
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
    const row: DayChangeHolding = {
      id: holding.id,
      name: holding.name,
      ticker: holding.ticker,
      market: holding.market,
      pct: ((current - prevClose) / prevClose) * 100,
      valueDelta: currentValue - prevValue,
      prevValue,
    };
    const list = byAccount.get(holding.accountId) ?? [];
    list.push(row);
    byAccount.set(holding.accountId, list);
  }

  const accountSummaries = [...accounts]
    .sort((a, b) => a.label.localeCompare(b.label, "ko"))
    .flatMap((account) => {
      const items = byAccount.get(account.id);
      if (!items?.length) {
        return [];
      }
      const prevValue = items.reduce((sum, item) => sum + item.prevValue, 0);
      const valueDelta = items.reduce((sum, item) => sum + item.valueDelta, 0);
      return [
        {
          id: account.id,
          label: account.label,
          color: account.color,
          prevValue,
          valueDelta,
          pct: prevValue === 0 ? 0 : (valueDelta / prevValue) * 100,
          items,
        },
      ];
    });

  return summarizeAccounts(accountSummaries);
}

export function applyDayChangeView(
  summary: DayChangeSummary,
  options: {
    accountId: string;
    market: DayChangeMarketFilter;
    query: string;
    sort: DayChangeSort;
    dir: DayChangeSortDir;
  },
): DayChangeSummary {
  const needle = options.query.trim().toLowerCase();
  const accounts = summary.accounts.flatMap((account) => {
    if (options.accountId !== "all" && account.id !== options.accountId) {
      return [];
    }
    const items = sortHoldings(
      account.items.filter((item) => {
        if (options.market !== "all" && item.market !== options.market) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return (
          item.name.toLowerCase().includes(needle) ||
          item.ticker.toLowerCase().includes(needle)
        );
      }),
      options.sort,
      options.dir,
    );
    if (!items.length) {
      return [];
    }
    const prevValue = items.reduce((sum, item) => sum + item.prevValue, 0);
    const valueDelta = items.reduce((sum, item) => sum + item.valueDelta, 0);
    return [
      {
        ...account,
        items,
        prevValue,
        valueDelta,
        pct: prevValue === 0 ? 0 : (valueDelta / prevValue) * 100,
      },
    ];
  });

  accounts.sort((a, b) => {
    const delta = options.sort === "pct" ? a.pct - b.pct : a.valueDelta - b.valueDelta;
    return options.dir === "asc" ? delta : -delta;
  });

  return summarizeAccounts(accounts);
}
