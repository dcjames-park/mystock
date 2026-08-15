import type { HoldingKind, Market } from "@/lib/data/types";

export function isKoreanName(name: string) {
  return /[\uAC00-\uD7A3]/.test(name);
}

export async function fetchNaverHoldingName(
  ticker: string,
  market: Market,
  kind: HoldingKind,
) {
  const response = await fetch(
    `/api/market/naver?ticker=${encodeURIComponent(ticker)}&market=${market}&kind=${kind}`,
  );
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { name?: string | null };
  const name = data.name?.trim() ?? "";
  return isKoreanName(name) ? name : null;
}
