import { NextRequest } from "next/server";
import { cachedQuoteSnapshot } from "@/lib/market/cached";
import { USD_KRW_SOURCE } from "@/lib/money";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("tickers") ?? "";
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  const tickers = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  try {
    const snapshot = await cachedQuoteSnapshot(tickers, { fresh });
    return Response.json(
      {
        quotes: snapshot.quotes,
        fx: snapshot.fx
          ? { ...snapshot.fx, source: USD_KRW_SOURCE, fallback: false }
          : null,
      },
      {
        headers: {
          "Cache-Control": fresh
            ? "no-store"
            : "public, s-maxage=3600, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json({ quotes: [], fx: null, error: "시세를 가져오지 못했습니다." }, { status: 502 });
  }
}
