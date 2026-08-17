import { toKrwAmount } from "@/lib/money";
import type { Account, AccountColor, Holding } from "@/lib/data/types";

export const DAY_CHANGE_POPUP_SHOWN_KEY = "mystock.dayChangePopupShown";

export type DayChangeHolding = {
  id: string;
  name: string;
  ticker: string;
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
  accounts: DayChangeAccountSummary[];
};

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
      items.sort((a, b) => Math.abs(b.valueDelta) - Math.abs(a.valueDelta));
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

  const prevValue = accountSummaries.reduce((sum, item) => sum + item.prevValue, 0);
  const valueDelta = accountSummaries.reduce((sum, item) => sum + item.valueDelta, 0);

  return {
    prevValue,
    valueDelta,
    pct: prevValue === 0 ? 0 : (valueDelta / prevValue) * 100,
    accounts: accountSummaries,
  };
}
