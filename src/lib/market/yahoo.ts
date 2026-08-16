import type { Period, PricePoint, QuoteDetail, SearchHit } from "@/lib/data/types";

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

async function yahooJson(url: string) {
  const response = await fetch(url, {
    headers: YAHOO_HEADERS,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Yahoo 요청 실패 (${response.status})`);
  }
  return response.json();
}

function kindFromQuoteType(quoteType: string): SearchHit["kind"] | null {
  const value = quoteType.toUpperCase();
  if (value === "ETF") {
    return "etf";
  }
  if (value === "EQUITY" || value === "STOCK") {
    return "stock";
  }
  return null;
}

function marketFromSymbol(symbol: string, exchange?: string): SearchHit["market"] {
  const upper = `${symbol} ${exchange ?? ""}`.toUpperCase();
  if (
    symbol.endsWith(".KS") ||
    symbol.endsWith(".KQ") ||
    upper.includes("KSC") ||
    upper.includes("KOE") ||
    upper.includes("KSE") ||
    upper.includes("KOSDAQ")
  ) {
    return "kr";
  }
  return "us";
}

function foldQuery(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

async function searchYahooOnce(query: string): Promise<SearchHit[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0`;
  const data = await yahooJson(url);
  const quotes = Array.isArray(data?.quotes) ? data.quotes : [];

  const hits: SearchHit[] = [];
  for (const item of quotes) {
    const ticker = String(item.symbol ?? "");
    const kind = kindFromQuoteType(String(item.quoteType ?? ""));
    if (!ticker || !kind) {
      continue;
    }
    hits.push({
      name: String(item.shortname || item.longname || ticker),
      ticker,
      market: marketFromSymbol(ticker, String(item.exchDisp ?? item.exchange ?? "")),
      kind,
    });
  }
  return hits;
}

export async function searchYahoo(query: string): Promise<SearchHit[]> {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return [];
  }
  const compact = normalized.replace(/\s+/g, "");
  const queries = [...new Set([normalized, compact])];
  const batches = await Promise.all(queries.map((item) => searchYahooOnce(item)));
  const byTicker = new Map<string, SearchHit>();
  for (const hit of batches.flat()) {
    if (!byTicker.has(hit.ticker)) {
      byTicker.set(hit.ticker, hit);
    }
  }

  const needle = foldQuery(normalized);
  const hits = [...byTicker.values()];
  const matched = hits.filter(
    (hit) =>
      foldQuery(hit.name).includes(needle) || foldQuery(hit.ticker).includes(needle),
  );
  return matched.length > 0 ? matched : hits;
}

export const USD_KRW_SYMBOL = "KRW=X";

export async function quoteYahoo(ticker: string): Promise<number | null> {
  const encoded = encodeURIComponent(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=1m`;
  const data = await yahooJson(url);
  const meta = data?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  return Number.isFinite(price) ? price : null;
}

export async function quoteUsdKrwYahoo() {
  const encoded = encodeURIComponent(USD_KRW_SYMBOL);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=1m`;
  const data = await yahooJson(url);
  const meta = data?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!Number.isFinite(price) || price < 800 || price > 2500) {
    return null;
  }
  const time = Number(meta?.regularMarketTime);
  return {
    usdKrw: price,
    asOf: Number.isFinite(time) ? new Date(time * 1000).toISOString() : null,
    symbol: String(meta?.symbol || USD_KRW_SYMBOL),
  };
}

const SPARK_BATCH = 25;

function lastFiniteNumber(values: unknown): number | null {
  if (!Array.isArray(values)) {
    return null;
  }
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const price = Number(values[i]);
    if (Number.isFinite(price)) {
      return price;
    }
  }
  return null;
}

function previousCloseFromSpark(item: unknown): number | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const row = item as {
    meta?: {
      previousClose?: unknown;
      chartPreviousClose?: unknown;
      regularMarketPreviousClose?: unknown;
    };
    response?: Array<{
      meta?: {
        previousClose?: unknown;
        chartPreviousClose?: unknown;
        regularMarketPreviousClose?: unknown;
      };
    }>;
  };
  const meta = row.response?.[0]?.meta ?? row.meta;
  const candidates = [
    meta?.previousClose,
    meta?.chartPreviousClose,
    meta?.regularMarketPreviousClose,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

async function previousCloseFromChart(ticker: string): Promise<number | null> {
  const encoded = encodeURIComponent(ticker);
  const data = await yahooJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=1d`,
  );
  const meta = data?.chart?.result?.[0]?.meta as
    | {
        previousClose?: unknown;
        chartPreviousClose?: unknown;
        regularMarketPreviousClose?: unknown;
      }
    | undefined;
  const candidates = [
    meta?.previousClose,
    meta?.chartPreviousClose,
    meta?.regularMarketPreviousClose,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

function priceFromSpark(item: unknown): number | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const row = item as {
    close?: unknown;
    response?: Array<{
      meta?: { regularMarketPrice?: unknown };
      indicators?: { quote?: Array<{ close?: unknown }> };
    }>;
  };
  const fromClose = lastFiniteNumber(row.close);
  if (fromClose != null) {
    return fromClose;
  }
  const fromMeta = Number(row.response?.[0]?.meta?.regularMarketPrice);
  if (Number.isFinite(fromMeta)) {
    return fromMeta;
  }
  return lastFiniteNumber(row.response?.[0]?.indicators?.quote?.[0]?.close);
}

function sparkRowByTicker(data: unknown, ticker: string): unknown {
  if (!data || typeof data !== "object") {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (record[ticker]) {
    return record[ticker];
  }
  const rows = (record.spark as { result?: unknown[] } | undefined)?.result;
  if (!Array.isArray(rows)) {
    return null;
  }
  return (
    rows.find((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      return String((item as { symbol?: unknown }).symbol ?? "") === ticker;
    }) ?? null
  );
}

function sparkAsOf(item: unknown) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const time = lastFiniteNumber((item as { timestamp?: unknown }).timestamp);
  return time == null ? null : new Date(time * 1000).toISOString();
}

function seriesFromSpark(item: unknown): PricePoint[] {
  if (!item || typeof item !== "object") {
    return [];
  }
  const timestamps = (item as { timestamp?: unknown }).timestamp;
  const closes = (item as { close?: unknown }).close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) {
    return [];
  }
  const series: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = Number(closes[i]);
    const time = Number(timestamps[i]);
    if (!Number.isFinite(close) || !Number.isFinite(time)) {
      continue;
    }
    series.push({
      date: new Date(time * 1000).toISOString().slice(0, 10),
      close,
    });
  }
  return series;
}

async function quoteManyYahooSpark(tickers: string[]) {
  const batches: string[][] = [];
  for (let i = 0; i < tickers.length; i += SPARK_BATCH) {
    batches.push(tickers.slice(i, i + SPARK_BATCH));
  }

  const parts = await Promise.all(
    batches.map(async (batch) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(batch.join(","))}&range=1d&interval=1m`;
      const data = await yahooJson(url);
      const quotes: {
        ticker: string;
        lastPrice: number;
        previousClose: number | null;
        asOf: string | null;
      }[] = [];
      for (const ticker of batch) {
        const row = sparkRowByTicker(data, ticker);
        const lastPrice = priceFromSpark(row);
        if (lastPrice != null) {
          quotes.push({
            ticker,
            lastPrice,
            previousClose: previousCloseFromSpark(row),
            asOf: sparkAsOf(row),
          });
        }
      }
      return quotes;
    }),
  );
  return parts.flat();
}

async function quoteManyYahooEach(tickers: string[]) {
  const entries = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const lastPrice = await quoteYahoo(ticker);
        return lastPrice == null ? null : { ticker, lastPrice };
      } catch {
        return null;
      }
    }),
  );
  return entries.filter(
    (item): item is { ticker: string; lastPrice: number } => item !== null,
  );
}

export async function quoteManyYahoo(tickers: string[]) {
  const snapshot = await quoteSnapshotYahoo(tickers);
  return snapshot.quotes;
}

export async function quoteSnapshotYahoo(tickers: string[]) {
  const unique = [...new Set(tickers.filter(Boolean))];
  const symbols = unique.includes(USD_KRW_SYMBOL)
    ? unique
    : [...unique, USD_KRW_SYMBOL];
  const byTicker = new Map<
    string,
    { ticker: string; lastPrice: number; previousClose: number | null; asOf: string | null }
  >();
  try {
    for (const item of await quoteManyYahooSpark(symbols)) {
      byTicker.set(item.ticker, item);
    }
  } catch {
    byTicker.clear();
  }

  const missing = unique.filter((ticker) => !byTicker.has(ticker));
  if (missing.length > 0) {
    for (const item of await quoteManyYahooEach(missing)) {
      byTicker.set(item.ticker, { ...item, previousClose: null, asOf: null });
    }
  }

  const needPrev = [...byTicker.values()].filter(
    (item) => item.ticker !== USD_KRW_SYMBOL && (item.previousClose == null || item.previousClose <= 0),
  );
  if (needPrev.length > 0) {
    const filled = await Promise.all(
      needPrev.map(async (item) => {
        const previousClose = await previousCloseFromChart(item.ticker);
        return { ticker: item.ticker, previousClose };
      }),
    );
    for (const item of filled) {
      const current = byTicker.get(item.ticker);
      if (current && item.previousClose != null) {
        byTicker.set(item.ticker, { ...current, previousClose: item.previousClose });
      }
    }
  }

  const fxRow = byTicker.get(USD_KRW_SYMBOL);
  const fx =
    fxRow && fxRow.lastPrice >= 800 && fxRow.lastPrice <= 2500
      ? {
          usdKrw: fxRow.lastPrice,
          asOf: fxRow.asOf,
          symbol: USD_KRW_SYMBOL,
        }
      : await quoteUsdKrwYahoo();

  return {
    quotes: unique
      .map((ticker) => byTicker.get(ticker))
      .filter(
        (
          item,
        ): item is {
          ticker: string;
          lastPrice: number;
          previousClose: number | null;
          asOf: string | null;
        } => item != null && item.ticker !== USD_KRW_SYMBOL,
      )
      .map(({ ticker, lastPrice, previousClose }) => ({
        ticker,
        lastPrice,
        previousClose,
      })),
    fx,
  };
}

function wantsMonthly(period: Period) {
  return period === "5y" || period === "10y";
}

function yearMonths(startYm: string, endYm: string) {
  const out: string[] = [];
  let year = Number(startYm.slice(0, 4));
  let month = Number(startYm.slice(5, 7));
  const endYear = Number(endYm.slice(0, 4));
  const endMonth = Number(endYm.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

function fillMonthlyPrices(series: PricePoint[]): PricePoint[] {
  if (series.length === 0) {
    return series;
  }
  const byMonth = new Map<string, PricePoint>();
  for (const point of series) {
    byMonth.set(point.date.slice(0, 7), point);
  }
  const months = yearMonths(
    series[0].date.slice(0, 7),
    series[series.length - 1].date.slice(0, 7),
  );
  const out: PricePoint[] = [];
  let lastClose = series[0].close;
  for (const month of months) {
    const hit = byMonth.get(month);
    if (hit) {
      lastClose = hit.close;
      out.push(hit);
    } else {
      out.push({ date: `${month}-01`, close: lastClose });
    }
  }
  return out;
}

function withPeriodSeries(series: PricePoint[], period: Period) {
  return wantsMonthly(period) ? fillMonthlyPrices(series) : series;
}

export async function chartManyYahoo(tickers: string[], period: Period) {
  const unique = [...new Set(tickers.filter(Boolean))];
  if (unique.length === 0) {
    return [];
  }
  const spec = RANGE[period];
  const found = new Map<
    string,
    { ticker: string; prices: number[]; series: PricePoint[]; lastPrice: number | null }
  >();
  if (!wantsMonthly(period)) {
    try {
      for (let i = 0; i < unique.length; i += SPARK_BATCH) {
        const batch = unique.slice(i, i + SPARK_BATCH);
        const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(batch.join(","))}&range=${spec.range}&interval=${spec.interval}`;
        const data = await yahooJson(url);
        for (const ticker of batch) {
          const series = withPeriodSeries(
            seriesFromSpark(sparkRowByTicker(data, ticker)),
            period,
          );
          if (series.length === 0) {
            continue;
          }
          const prices = series.map((item) => item.close);
          found.set(ticker, {
            ticker,
            prices: downsample(prices, 6),
            series,
            lastPrice: prices.at(-1) ?? null,
          });
        }
      }
    } catch {
      found.clear();
    }
  }

  const missing = unique.filter((ticker) => !found.has(ticker));
  if (missing.length > 0) {
    const extras = await Promise.all(
      missing.map(async (ticker) => {
        try {
          const result = await chartYahoo(ticker, period);
          return { ticker, ...result };
        } catch {
          return null;
        }
      }),
    );
    for (const item of extras) {
      if (item) {
        found.set(item.ticker, item);
      }
    }
  }
  return unique
    .map((ticker) => found.get(ticker))
    .filter(
      (
        item,
      ): item is {
        ticker: string;
        prices: number[];
        series: PricePoint[];
        lastPrice: number | null;
      } => item != null,
    );
}

const RANGE: Record<Period, { range: string; interval: string }> = {
  "1m": { range: "1mo", interval: "1d" },
  "6m": { range: "6mo", interval: "1wk" },
  "1y": { range: "1y", interval: "1wk" },
  "2y": { range: "2y", interval: "1wk" },
  "5y": { range: "5y", interval: "1mo" },
  "10y": { range: "10y", interval: "1mo" },
};

function downsample(values: number[], count: number) {
  if (values.length <= count) {
    return values;
  }
  const out: number[] = [];
  const step = (values.length - 1) / (count - 1);
  for (let i = 0; i < count; i += 1) {
    out.push(values[Math.round(i * step)] ?? values[values.length - 1]);
  }
  return out;
}

export async function chartYahoo(ticker: string, period: Period) {
  const spec = RANGE[period];
  const encoded = encodeURIComponent(ticker);
  const data = await yahooJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=${spec.range}&interval=${spec.interval}`,
  );
  const result = data?.chart?.result?.[0];
  const timestamps: number[] = Array.isArray(result?.timestamp)
    ? result.timestamp
    : [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
  const series: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (typeof close !== "number" || !Number.isFinite(close)) {
      continue;
    }
    series.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      close,
    });
  }
  const filled = withPeriodSeries(series, period);
  const prices = filled.map((item) => item.close);
  const lastPrice = Number(result?.meta?.regularMarketPrice) || prices.at(-1) || null;
  return {
    prices: downsample(prices, 6),
    series: filled,
    lastPrice,
  };
}

function rawNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === "object" && "raw" in value) {
    const raw = Number((value as { raw?: unknown }).raw);
    return Number.isFinite(raw) ? raw : null;
  }
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function rawText(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (value && typeof value === "object" && "fmt" in value) {
    const fmt = (value as { fmt?: unknown }).fmt;
    if (typeof fmt === "string" && fmt.trim()) {
      return fmt;
    }
  }
  return null;
}

export async function quoteDetailsYahoo(ticker: string): Promise<QuoteDetail> {
  const encoded = encodeURIComponent(ticker);
  const empty: QuoteDetail = {
    ticker,
    lastPrice: null,
    previousClose: null,
    dayHigh: null,
    dayLow: null,
    week52High: null,
    week52Low: null,
    volume: null,
    averageVolume: null,
    marketCap: null,
    pe: null,
    forwardPe: null,
    eps: null,
    dividendYield: null,
    beta: null,
    exchange: null,
    quoteType: null,
    currency: null,
    shortName: null,
    longName: null,
  };

  const chart = await yahooJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=1d`,
  );
  const meta = chart?.chart?.result?.[0]?.meta;
  const price: Record<string, unknown> = {};
  const detail: Record<string, unknown> = {};
  const stats: Record<string, unknown> = {};

  return {
    ticker,
    lastPrice:
      rawNumber(price.regularMarketPrice) ?? rawNumber(meta?.regularMarketPrice),
    previousClose:
      rawNumber(price.regularMarketPreviousClose) ??
      rawNumber(meta?.previousClose) ??
      rawNumber(meta?.chartPreviousClose),
    dayHigh:
      rawNumber(price.regularMarketDayHigh) ??
      rawNumber(detail.regularMarketDayHigh) ??
      rawNumber(meta?.regularMarketDayHigh),
    dayLow:
      rawNumber(price.regularMarketDayLow) ??
      rawNumber(detail.regularMarketDayLow) ??
      rawNumber(meta?.regularMarketDayLow),
    week52High:
      rawNumber(detail.fiftyTwoWeekHigh) ?? rawNumber(meta?.fiftyTwoWeekHigh),
    week52Low:
      rawNumber(detail.fiftyTwoWeekLow) ?? rawNumber(meta?.fiftyTwoWeekLow),
    volume:
      rawNumber(price.regularMarketVolume) ??
      rawNumber(detail.volume) ??
      rawNumber(meta?.regularMarketVolume),
    averageVolume: rawNumber(detail.averageVolume),
    marketCap: rawNumber(price.marketCap) ?? rawNumber(detail.marketCap),
    pe: rawNumber(detail.trailingPE) ?? rawNumber(stats.trailingPE),
    forwardPe: rawNumber(stats.forwardPE) ?? rawNumber(detail.forwardPE),
    eps: rawNumber(stats.trailingEps),
    dividendYield: rawNumber(detail.dividendYield) ?? rawNumber(detail.yield),
    beta: rawNumber(detail.beta) ?? rawNumber(stats.beta),
    exchange: rawText(price.exchangeName) ?? rawText(meta?.exchangeName),
    quoteType: rawText(price.quoteType) ?? rawText(meta?.instrumentType),
    currency: rawText(price.currency) ?? rawText(meta?.currency),
    shortName: rawText(price.shortName) ?? rawText(meta?.shortName),
    longName: rawText(price.longName) ?? rawText(meta?.longName),
  };
}
