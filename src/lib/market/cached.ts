import {
  cacheDeletePrefix,
  cacheGet,
  cacheSet,
  CHART_TTL_MS,
  DETAIL_TTL_MS,
  QUOTE_TTL_MS,
} from "@/lib/market/cache";
import {
  chartManyYahoo,
  chartYahoo,
  quoteDetailsYahoo,
  quoteSnapshotYahoo,
} from "@/lib/market/yahoo";
import type { Period, PricePoint, QuoteDetail } from "@/lib/data/types";

export type CachedChart = {
  ticker: string;
  prices: number[];
  series: PricePoint[];
  lastPrice: number | null;
};

export type QuoteSnapshotItem = {
  ticker: string;
  lastPrice: number;
  previousClose?: number | null;
};

export async function cachedQuoteSnapshot(
  tickers: string[],
  options?: { fresh?: boolean },
) {
  if (options?.fresh) {
    cacheDeletePrefix("quote:");
    cacheDeletePrefix("fx");
  }
  const unique = [...new Set(tickers.filter(Boolean))];
  const quotes: QuoteSnapshotItem[] = [];
  const missing: string[] = [];
  for (const ticker of unique) {
    const hit = cacheGet<QuoteSnapshotItem>(`quote:${ticker}`);
    if (
      hit &&
      !options?.fresh &&
      hit.previousClose != null &&
      hit.previousClose > 0
    ) {
      quotes.push(hit);
    } else {
      missing.push(ticker);
    }
  }
  const cachedFx = cacheGet<{
    usdKrw: number;
    asOf: string | null;
    symbol: string;
  }>("fx");

  if (missing.length === 0 && cachedFx) {
    return { quotes, fx: cachedFx };
  }

  const snapshot = await quoteSnapshotYahoo(missing);
  for (const item of snapshot.quotes) {
    cacheSet(`quote:${item.ticker}`, item, QUOTE_TTL_MS);
    quotes.push(item);
  }
  if (snapshot.fx) {
    cacheSet("fx", snapshot.fx, QUOTE_TTL_MS);
  }
  return { quotes, fx: snapshot.fx ?? cachedFx ?? null };
}

export async function cachedCharts(
  tickers: string[],
  period: Period,
  options?: { fresh?: boolean },
) {
  if (options?.fresh) {
    cacheDeletePrefix("chart:");
  }
  const unique = [...new Set(tickers.filter(Boolean))];
  const charts: Record<string, CachedChart> = {};
  const missing: string[] = [];
  for (const ticker of unique) {
    const hit = cacheGet<CachedChart>(`chart:v2:${ticker}:${period}`);
    if (hit && !options?.fresh) {
      charts[ticker] = hit;
    } else {
      missing.push(ticker);
    }
  }
  if (missing.length === 0) {
    return charts;
  }
  const fetched = await chartManyYahoo(missing, period);
  for (const item of fetched) {
    cacheSet(`chart:v2:${item.ticker}:${period}`, item, CHART_TTL_MS);
    charts[item.ticker] = item;
  }
  return charts;
}

export async function cachedChart(ticker: string, period: Period) {
  const charts = await cachedCharts([ticker], period);
  return charts[ticker] ?? (await chartYahoo(ticker, period));
}

export async function cachedQuoteDetail(ticker: string, options?: { fresh?: boolean }) {
  const key = `detail:${ticker}`;
  if (options?.fresh) {
    cacheDeletePrefix(key);
  }
  const hit = cacheGet<QuoteDetail>(key);
  if (hit && !options?.fresh) {
    return hit;
  }
  const quote = await quoteDetailsYahoo(ticker);
  cacheSet(key, quote, DETAIL_TTL_MS);
  return quote;
}
