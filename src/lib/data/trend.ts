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
}: {
  period: Period;
  accountId: string | null;
  holdings: Holding[];
  seriesByTicker: Record<string, PricePoint[]>;
  quotes: Record<string, number>;
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
      return sum + toKrwAmount(price * item.qty, item.currency);
    }, 0);
    return [
      {
        label: formatLabel(today, period),
        date: today,
        value: value / 10000,
        buy: 0,
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
    let buy = 0;
    for (const item of relevant) {
      if (toDateInput(item.boughtAt) > date) {
        continue;
      }
      const price =
        lastClose[item.ticker] ?? quotes[item.ticker] ?? item.buyPrice;
      value += toKrwAmount(price * item.qty, item.currency);
      if (toDateInput(item.boughtAt) === date) {
        buy += toKrwAmount(item.buyPrice * item.qty, item.currency);
      }
    }

    daily.push({
      label: formatLabel(date, period),
      date,
      value: value / 10000,
      buy: buy / 10000,
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
