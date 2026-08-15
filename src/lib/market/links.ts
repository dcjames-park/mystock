import type { HoldingKind, Market } from "@/lib/data/types";

export function yahooFinanceUrl(ticker: string) {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`;
}

export function naverQuery(ticker: string, market: Market) {
  if (market === "kr") {
    return ticker.replace(/\.(KS|KQ|KN)$/i, "");
  }
  return ticker;
}

export function naverFinanceUrl(
  ticker: string,
  market: Market,
  kind: HoldingKind = "stock",
) {
  if (market === "kr") {
    const code = naverQuery(ticker, market);
    return `https://m.stock.naver.com/domestic/stock/${encodeURIComponent(code)}/total`;
  }
  const reuters = `${ticker}.O`;
  if (kind === "etf") {
    return `https://m.stock.naver.com/worldstock/etf/${encodeURIComponent(reuters)}`;
  }
  return `https://m.stock.naver.com/worldstock/stock/${encodeURIComponent(reuters)}/total`;
}

export function naverFinanceUrlFromPath(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `https://m.stock.naver.com${path.startsWith("/") ? path : `/${path}`}`;
}
