import type { Currency, Holding } from "@/lib/data/types";

export const FALLBACK_USD_KRW = 1380;
export const USD_KRW_SYMBOL = "KRW=X";
export const USD_KRW_SOURCE = "Yahoo Finance";
export const USD_KRW_PAGE = `https://finance.yahoo.com/quote/${encodeURIComponent(USD_KRW_SYMBOL)}`;

function usableUsdKrw(usdKrw: number) {
  return Number.isFinite(usdKrw) && usdKrw > 0 ? usdKrw : FALLBACK_USD_KRW;
}

export function toKrwAmount(value: number, currency: Currency, usdKrw: number) {
  return currency === "USD" ? value * usableUsdKrw(usdKrw) : value;
}

export function holdingToKrw(holding: Holding, lastPrice: number, usdKrw: number) {
  const buy = toKrwAmount(holding.buyPrice * holding.qty, holding.currency, usdKrw);
  const value = toKrwAmount(lastPrice * holding.qty, holding.currency, usdKrw);
  const pnl = value - buy;
  const rate = buy === 0 ? 0 : (pnl / buy) * 100;
  return { buy, value, pnl, rate };
}

export function formatWon(n: number) {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export function formatCompactWon(n: number) {
  const man = n / 10000;
  if (Math.abs(man) >= 1) {
    return `${Math.round(man).toLocaleString("ko-KR")}만`;
  }
  return formatWon(n);
}

export function formatPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function formatPrice(price: number, currency: Currency) {
  if (currency === "USD") {
    return `$${price.toFixed(2)}`;
  }
  return `${Math.round(price).toLocaleString("ko-KR")}원`;
}

export function formatFxRate(usdKrw: number) {
  return `1달러 = ${usableUsdKrw(usdKrw).toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}원`;
}

export function formatFxAsOf(iso: string | null) {
  if (!iso) {
    return "";
  }
  return `${new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} 기준`;
}

export const PERIODS: { id: "1m" | "6m" | "1y" | "2y"; label: string }[] = [
  { id: "1m", label: "1개월" },
  { id: "6m", label: "6개월" },
  { id: "1y", label: "1년" },
  { id: "2y", label: "2년" },
];

export const ACCOUNT_COLORS = ["blue", "cyan", "purple"] as const;
export const ACCOUNT_SUGGESTIONS = [
  "NH투자증권",
  "한국투자증권",
  "신한투자증권",
];
