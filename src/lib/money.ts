import type { AccountColor, Currency, Holding, Period } from "@/lib/data/types";

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

export function formatWonNumber(n: number) {
  return Math.round(n).toLocaleString("ko-KR");
}

export function formatWon(n: number) {
  return `${formatWonNumber(n)}원`;
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
  return `₩${Math.round(price).toLocaleString("ko-KR")}`;
}

export function formatPriceShort(price: number, currency: Currency) {
  if (currency === "USD") {
    return `$${price.toFixed(2)}`;
  }
  return `₩${Math.round(price).toLocaleString("ko-KR")}`;
}

export function formatAsOfDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}.${month}.${day} 기준`;
}

export function formatQuoteAsOf(iso: string | null) {
  if (!iso) {
    return "시세 대기";
  }
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return "시세 대기";
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hh}:${mm} 기준`;
}

export function formatDateKo(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${year}.${month}.${day}`;
}

export function parseAmountInput(display: string, maxFraction = 6) {
  const next = display.replace(/,/g, "").replace(/[^\d.]/g, "");
  const [intPart = "", ...rest] = next.split(".");
  if (maxFraction <= 0) {
    return intPart;
  }
  const frac = rest.join("").slice(0, maxFraction);
  return next.includes(".") ? `${intPart}.${frac}` : intPart;
}

export function formatAmountInput(raw: string) {
  if (!raw) {
    return "";
  }
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const [intPart = "", frac] = body.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = negative ? "-" : "";
  return body.includes(".") ? `${sign}${grouped}.${frac ?? ""}` : `${sign}${grouped}`;
}

export function formatCompactCount(n: number | null, suffix = "") {
  if (n == null || !Number.isFinite(n)) {
    return "-";
  }
  if (Math.abs(n) >= 1_0000_0000_0000) {
    return `${(n / 1_0000_0000_0000).toFixed(2)}조${suffix}`;
  }
  if (Math.abs(n) >= 1_0000_0000) {
    return `${(n / 1_0000_0000).toFixed(2)}억${suffix}`;
  }
  return `${Math.round(n).toLocaleString("ko-KR")}${suffix}`;
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

export const PERIODS: { id: Period; label: string }[] = [
  { id: "1m", label: "1개월" },
  { id: "6m", label: "6개월" },
  { id: "1y", label: "1년" },
  { id: "2y", label: "2년" },
  { id: "5y", label: "5년" },
  { id: "10y", label: "10년" },
];

export const ACCOUNT_COLORS = [
  "blue",
  "cyan",
  "purple",
  "orange",
  "rose",
  "green",
  "amber",
  "pink",
] as const;

const ACCOUNT_HUES: Record<AccountColor, number> = {
  blue: 264,
  cyan: 195,
  purple: 292,
  orange: 55,
  rose: 18,
  green: 145,
  amber: 85,
  pink: 340,
};

function hueDistance(a: number, b: number) {
  const delta = Math.abs(a - b) % 360;
  return Math.min(delta, 360 - delta);
}

function mostDistantColor(candidates: AccountColor[], used: AccountColor[]) {
  let best = candidates[0];
  let bestScore = -1;
  for (const color of candidates) {
    const score = Math.min(
      ...used.map((item) => hueDistance(ACCOUNT_HUES[color], ACCOUNT_HUES[item])),
    );
    if (score > bestScore) {
      best = color;
      bestScore = score;
    }
  }
  return best;
}

export function nextAccountColor(used: AccountColor[]): AccountColor {
  const unused = ACCOUNT_COLORS.filter((color) => !used.includes(color));
  if (used.length === 0) {
    return unused[0] ?? ACCOUNT_COLORS[0];
  }
  if (unused.length > 0) {
    return mostDistantColor(unused, used);
  }
  const counts = new Map<AccountColor, number>(
    ACCOUNT_COLORS.map((color) => [color, 0]),
  );
  for (const color of used) {
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  const min = Math.min(...counts.values());
  const leastUsed = ACCOUNT_COLORS.filter((color) => counts.get(color) === min);
  return mostDistantColor(leastUsed, used);
}
