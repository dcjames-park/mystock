import type { Currency, Holding } from "@/lib/data/types";

export const USD_KRW = 1380;

export function toKrwAmount(value: number, currency: Currency) {
  return currency === "USD" ? value * USD_KRW : value;
}

export function holdingToKrw(holding: Holding, lastPrice: number) {
  const buy = toKrwAmount(holding.buyPrice * holding.qty, holding.currency);
  const value = toKrwAmount(lastPrice * holding.qty, holding.currency);
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
