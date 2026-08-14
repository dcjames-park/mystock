import { quoteUsdKrwYahoo, USD_KRW_SYMBOL } from "@/lib/market/yahoo";
import { USD_KRW_SOURCE } from "@/lib/money";

export async function GET() {
  try {
    const quote = await quoteUsdKrwYahoo();
    if (!quote) {
      return Response.json({ error: "환율을 가져오지 못했습니다." }, { status: 502 });
    }
    return Response.json(
      {
        ...quote,
        source: USD_KRW_SOURCE,
        fallback: false,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "환율을 가져오지 못했습니다.", symbol: USD_KRW_SYMBOL },
      { status: 502 },
    );
  }
}
