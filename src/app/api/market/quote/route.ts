import { NextRequest } from "next/server";
import { cachedQuoteDetail } from "@/lib/market/cached";

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker") ?? "";
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  if (!ticker) {
    return Response.json({ error: "티커가 필요합니다." }, { status: 400 });
  }

  try {
    const quote = await cachedQuoteDetail(ticker, { fresh });
    return Response.json(
      { quote },
      {
        headers: {
          "Cache-Control": fresh
            ? "no-store"
            : "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return Response.json({ error: "시세를 가져오지 못했습니다." }, { status: 502 });
  }
}
