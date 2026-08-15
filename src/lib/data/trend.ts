import { qtyOnDate } from "@/lib/data/lots";
import type { Holding, Period, PeriodPoint, PricePoint } from "@/lib/data/types";
import { toKrwAmount } from "@/lib/money";

const TREND_POINTS = 8;

function formatLabel(date: string, period: Period) {
  const [year, month, day] = date.split("-").map(Number);
  const yy = (year ?? 0) % 100;
  if (period === "1m") {
    return `${month}/${day}`;
  }
  if (period === "6m") {
    return `${month}월`;
  }
  return `${yy}.${month}`;
}

function downsampleTrend(points: PeriodPoint[], count: number) {
  if (points.length <= count) {
    return points;
  }
  const out: PeriodPoint[] = [];
  const step = (points.length - 1) / (count - 1);
  for (let i = 0; i < count; i += 1) {
    const from = i === 0 ? 0 : Math.round((i - 1) * step) + 1;
    const to = Math.round(i * step);
    const last = points[to] ?? points[points.length - 1];
    const buy = points
      .slice(from, to + 1)
      .reduce((sum, point) => sum + point.buy, 0);
    out.push({ ...last, buy });
  }
  return out;
}

export function buildTrend({
  period,
  accountId,
  holdings,
  seriesByTicker,
  quotes,
  usdKrw,
}: {
  period: Period;
  accountId: string | null;
  holdings: Holding[];
  seriesByTicker: Record<string, PricePoint[]>;
  quotes: Record<string, number>;
  usdKrw: number;
}): PeriodPoint[] {
  const relevant = holdings.filter(
    (item) => accountId === null || item.accountId === accountId,
  );

  const dateSet = new Set<string>();
  for (const item of relevant) {
    for (const point of seriesByTicker[item.ticker] ?? []) {
      dateSet.add(point.date);
    }
  }
  const dates = [...dateSet].sort();

  if (dates.length === 0) {
    const today = localDateStamp();
    const value = relevant.reduce((sum, item) => {
      const price = quotes[item.ticker] ?? item.buyPrice;
      return sum + toKrwAmount(price * item.qty, item.currency, usdKrw);
    }, 0);
    const buy = relevant.reduce((sum, item) => {
      return sum + toKrwAmount(item.buyPrice * item.qty, item.currency, usdKrw);
    }, 0);
    return [
      {
        label: formatLabel(today, period),
        date: today,
        value: value / 10000,
        buy: 0,
        rate: buy === 0 ? 0 : ((value - buy) / buy) * 100,
      },
    ];
  }

  const lastClose: Record<string, number> = {};
  const byTickerDate = new Map<string, number>();
  for (const item of relevant) {
    for (const point of seriesByTicker[item.ticker] ?? []) {
      byTickerDate.set(`${item.ticker}:${point.date}`, point.close);
    }
  }

  const daily: PeriodPoint[] = [];
  for (const date of dates) {
    for (const item of relevant) {
      const close = byTickerDate.get(`${item.ticker}:${date}`);
      if (close != null) {
        lastClose[item.ticker] = close;
      }
    }

    let value = 0;
    let cost = 0;
    for (const item of relevant) {
      const qty = qtyOnDate(item, date);
      if (qty <= 0) {
        continue;
      }
      const price =
        lastClose[item.ticker] ?? quotes[item.ticker] ?? item.buyPrice;
      value += toKrwAmount(price * qty, item.currency, usdKrw);
      const lots = (item.lots ?? []).filter(
        (lot) => lot.boughtAt.slice(0, 10) <= date,
      );
      const lotCost = lots.reduce(
        (sum, lot) => sum + lot.buyPrice * lot.qty,
        0,
      );
      cost += toKrwAmount(lotCost, item.currency, usdKrw);
    }

    daily.push({
      label: formatLabel(date, period),
      date,
      value: value / 10000,
      buy: 0,
      rate: cost === 0 ? 0 : ((value - cost) / cost) * 100,
    });
  }

  return downsampleTrend(daily, TREND_POINTS);
}

export function localDateStamp(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateInput(boughtAt: string) {
  return boughtAt.slice(0, 10);
}

export function toBoughtAt(dateInput: string) {
  return `${dateInput}T00:00:00.000Z`;
}

export function todayStamp() {
  return localDateStamp();
}

export function buildBuyEvents(
  holdings: Holding[],
  usdKrw: number,
  rangeStart?: string,
  rangeEnd?: string,
) {
  return holdings
    .flatMap((item) =>
      (item.lots ?? []).map((lot) => ({
        date: toDateInput(lot.boughtAt),
        amount: toKrwAmount(lot.buyPrice * lot.qty, item.currency, usdKrw) / 10000,
      })),
    )
    .filter((item) => {
      if (item.amount <= 0) {
        return false;
      }
      if (rangeStart && item.date < rangeStart) {
        return false;
      }
      if (rangeEnd && item.date > rangeEnd) {
        return false;
      }
      return true;
    });
}
