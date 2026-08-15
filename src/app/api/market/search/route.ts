import { NextRequest } from "next/server";
import { searchNaver } from "@/lib/market/naver-search";
import { searchYahoo } from "@/lib/market/yahoo";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const naverHits = await searchNaver(q).catch(() => []);
    if (naverHits.length > 0) {
      return Response.json({ hits: naverHits, source: "naver" });
    }
    const hits = await searchYahoo(q);
    return Response.json({ hits, source: "yahoo" });
  } catch {
    return Response.json({ hits: [], error: "검색에 실패했습니다." }, { status: 502 });
  }
}
