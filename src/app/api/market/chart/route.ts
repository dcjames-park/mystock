import { NextRequest } from "next/server";
import { chartYahoo } from "@/lib/market/yahoo";
import type { Period } from "@/lib/data/types";

const PERIODS: Period[] = ["1m", "6m", "1y", "2y"];

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker") ?? "";
  const period = request.nextUrl.searchParams.get("period") ?? "1y";
  if (!ticker || !PERIODS.includes(period as Period)) {
    return Response.json({ prices: [], series: [], lastPrice: null }, { status: 400 });
  }

  try {
    const result = await chartYahoo(ticker, period as Period);
    return Response.json(result);
  } catch {
    return Response.json(
      { prices: [], series: [], lastPrice: null, error: "차트를 가져오지 못했습니다." },
      { status: 502 },
    );
  }
}
