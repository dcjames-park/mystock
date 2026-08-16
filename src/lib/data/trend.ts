import { qtyOnDate } from "@/lib/data/lots";
import type { Holding, Period, PeriodPoint, PricePoint } from "@/lib/data/types";
import { toKrwAmount } from "@/lib/money";

function formatLabel(date: string, period: Period) {
  const [year, month, day] = date.split("-").map(Number);
  const yy = (year ?? 0) % 100;
  if (period === "1m" || period === "6m") {
    return `${month}/${day}`;
  }
  return `${yy}.${month}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const nextDay = Math.min(day, lastDay);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
}

function nextGridDate(date: string, period: Period) {
  if (period === "1m") {
    return addDays(date, 2);
  }
  if (period === "6m") {
    return addDays(date, 14);
  }
  if (period === "1y") {
    return addMonths(date, 1);
  }
  if (period === "2y") {
    return addMonths(date, 2);
  }
  if (period === "5y") {
    return addMonths(date, 3);
  }
  return addMonths(date, 6);
}

function buildGrid(start: string, end: string, period: Period) {
  if (start >= end) {
    return [end];
  }
  const out: string[] = [start];
  let cursor = start;
  for (let i = 0; i < 400; i += 1) {
    const next = nextGridDate(cursor, period);
    if (next <= cursor || next >= end) {
      break;
    }
    out.push(next);
    cursor = next;
  }
  if (out[out.length - 1] !== end) {
    out.push(end);
  }
  return out;
}

function pointOnOrBefore(points: PeriodPoint[], date: string) {
  let last: PeriodPoint | null = null;
  for (const point of points) {
    if (point.date > date) {
      break;
    }
    last = point;
  }
  return last;
}

function resampleTrend(points: PeriodPoint[], period: Period) {
  if (points.length <= 1) {
    return points;
  }
  const start = points[0].date;
  const end = points[points.length - 1].date;
  const out: PeriodPoint[] = [];
  const seen = new Set<string>();
  for (const date of buildGrid(start, end, period)) {
    const src = pointOnOrBefore(points, date);
    if (!src || seen.has(date)) {
      continue;
    }
    seen.add(date);
    out.push({
      ...src,
      date,
      label: formatLabel(date, period),
    });
  }
  return out;
}

function insertDates(
  sampled: PeriodPoint[],
  daily: PeriodPoint[],
  extraDates: string[],
  period: Period,
) {
  if (extraDates.length === 0 || daily.length === 0) {
    return sampled;
  }
  const start = daily[0].date;
  const end = daily[daily.length - 1].date;
  const byDate = new Map(sampled.map((point) => [point.date, point]));
  for (const date of extraDates) {
    if (date < start || date > end || byDate.has(date)) {
      continue;
    }
    const src = pointOnOrBefore(daily, date);
    if (!src) {
      continue;
    }
    byDate.set(date, {
      ...src,
      date,
      label: formatLabel(date, period),
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildTrend({
  period,
  accountId,
  holdings,
  seriesByTicker,
  quotes,
  usdKrw,
  extraDates = [],
}: {
  period: Period;
  accountId: string | null;
  holdings: Holding[];
  seriesByTicker: Record<string, PricePoint[]>;
  quotes: Record<string, number>;
  usdKrw: number;
  extraDates?: string[];
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
  const seriesDates = [...dateSet].sort();
  const rangeStart = seriesDates[0];
  const rangeEnd = seriesDates[seriesDates.length - 1];
  for (const date of extraDates) {
    if (rangeStart && rangeEnd && date >= rangeStart && date <= rangeEnd) {
      dateSet.add(date);
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

  const sampled = resampleTrend(daily, period);
  return insertDates(sampled, daily, extraDates, period);
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
