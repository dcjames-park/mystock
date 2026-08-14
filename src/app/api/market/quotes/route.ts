import { NextRequest } from "next/server";
import { quoteManyYahoo } from "@/lib/market/yahoo";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  try {
    const quotes = await quoteManyYahoo(tickers);
    return Response.json({ quotes });
  } catch {
    return Response.json({ quotes: [], error: "시세를 가져오지 못했습니다." }, { status: 502 });
  }
}
