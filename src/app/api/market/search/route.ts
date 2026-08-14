import { NextRequest } from "next/server";
import { searchYahoo } from "@/lib/market/yahoo";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const hits = await searchYahoo(q);
    return Response.json({ hits });
  } catch {
    return Response.json({ hits: [], error: "검색에 실패했습니다." }, { status: 502 });
  }
}
