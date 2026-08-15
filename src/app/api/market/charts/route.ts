import { NextRequest } from "next/server";
import { cachedCharts } from "@/lib/market/cached";
import type { Period } from "@/lib/data/types";

const PERIODS: Period[] = ["1m", "6m", "1y", "2y", "5y"];

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("tickers") ?? "";
  const period = request.nextUrl.searchParams.get("period") ?? "1y";
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  const tickers = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (tickers.length === 0 || !PERIODS.includes(period as Period)) {
    return Response.json({ charts: {} }, { status: 400 });
  }

  try {
    const charts = await cachedCharts(tickers, period as Period, { fresh });
    return Response.json(
      { charts },
      {
        headers: {
          "Cache-Control": fresh
            ? "no-store"
            : "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return Response.json({ charts: {}, error: "차트를 가져오지 못했습니다." }, { status: 502 });
  }
}
