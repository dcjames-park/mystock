import { NextRequest } from "next/server";
import { cacheGet, cacheSet } from "@/lib/market/cache";
import { naverFinanceUrl, naverFinanceUrlFromPath, naverQuery } from "@/lib/market/links";
import { isKoreanName } from "@/lib/market/naver-name";
import type { HoldingKind, Market } from "@/lib/data/types";

const NAVER_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
};

type NaverHit = {
  code?: string;
  name?: string;
  reutersCode?: string;
  url?: string;
  category?: string;
};

type NaverMeta = {
  url: string;
  name: string | null;
};

function pickHit(items: NaverHit[], query: string) {
  const needle = query.toUpperCase();
  return (
    items.find((item) => String(item.code ?? "").toUpperCase() === needle) ??
    items.find((item) => String(item.reutersCode ?? "").toUpperCase().startsWith(needle)) ??
    items[0] ??
    null
  );
}

function koreanName(raw?: string) {
  const name = raw?.trim() ?? "";
  return isKoreanName(name) ? name : null;
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker") ?? "";
  const market = (request.nextUrl.searchParams.get("market") ?? "us") as Market;
  const kind = (request.nextUrl.searchParams.get("kind") ?? "stock") as HoldingKind;
  if (!ticker) {
    return Response.json({ error: "티커가 필요합니다." }, { status: 400 });
  }

  const query = naverQuery(ticker, market);
  const cacheKey = `naver-meta:${market}:${query}`;
  const cached = cacheGet<NaverMeta>(cacheKey);
  if (cached) {
    return Response.json(cached, { headers: CACHE_HEADERS });
  }

  try {
    const response = await fetch(
      `https://ac.stock.naver.com/ac?q=${encodeURIComponent(query)}&target=stock`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new Error(`Naver 검색 실패 (${response.status})`);
    }
    const data = (await response.json()) as { items?: NaverHit[] };
    const hit = pickHit(Array.isArray(data.items) ? data.items : [], query);
    const meta: NaverMeta = {
      url: hit?.url
        ? naverFinanceUrlFromPath(hit.url)
        : naverFinanceUrl(ticker, market, kind),
      name: koreanName(hit?.name),
    };
    cacheSet(cacheKey, meta, NAVER_TTL_MS);
    return Response.json(meta, { headers: CACHE_HEADERS });
  } catch {
    return Response.json({
      url: naverFinanceUrl(ticker, market, kind),
      name: null,
    });
  }
}
