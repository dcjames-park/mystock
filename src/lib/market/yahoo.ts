import type { Period, PricePoint, SearchHit } from "@/lib/data/types";

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

export async function quoteYahoo(ticker: string): Promise<number | null> {
  const encoded = encodeURIComponent(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=1m`;
  const data = await yahooJson(url);
  const meta = data?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  return Number.isFinite(price) ? price : null;
}

export async function quoteManyYahoo(tickers: string[]) {
  const unique = [...new Set(tickers.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (ticker) => {
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

const RANGE: Record<Period, { range: string; interval: string }> = {
  "1m": { range: "1mo", interval: "1d" },
  "6m": { range: "6mo", interval: "1wk" },
  "1y": { range: "1y", interval: "1wk" },
  "2y": { range: "2y", interval: "1wk" },
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
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=${spec.range}&interval=${spec.interval}`;
  const data = await yahooJson(url);
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
  const prices = series.map((item) => item.close);
  const lastPrice = Number(result?.meta?.regularMarketPrice) || prices.at(-1) || null;
  return {
    prices: downsample(prices, 6),
    series,
    lastPrice,
  };
}
