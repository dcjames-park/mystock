import type { HoldingKind, Market, SearchHit } from "@/lib/data/types";

type NaverSearchItem = {
  code?: string;
  name?: string;
  typeCode?: string;
  url?: string;
  reutersCode?: string;
  nationCode?: string;
  category?: string;
};

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

function marketFromNation(nationCode?: string): Market | null {
  if (nationCode === "KOR") {
    return "kr";
  }
  if (nationCode === "USA") {
    return "us";
  }
  return null;
}

function yahooTicker(item: NaverSearchItem, market: Market) {
  const code = String(item.code ?? "").trim();
  if (!code) {
    return "";
  }
  if (market === "kr") {
    const exchange = String(item.typeCode ?? "").toUpperCase();
    if (exchange === "KOSDAQ") {
      return `${code}.KQ`;
    }
    if (exchange === "KONEX") {
      return `${code}.KN`;
    }
    return `${code}.KS`;
  }
  return code;
}

function kindFromItem(item: NaverSearchItem): HoldingKind {
  const url = String(item.url ?? "");
  const name = String(item.name ?? "");
  if (url.includes("/etf/") || /ETF|ETN/i.test(name)) {
    return "etf";
  }
  return "stock";
}

function foldQuery(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function containsQuery(hit: SearchHit, needle: string) {
  return foldQuery(hit.name).includes(needle) || foldQuery(hit.ticker).includes(needle);
}

export async function searchNaver(query: string): Promise<SearchHit[]> {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const response = await fetch(
    `https://stock.naver.com/api/autocomplete/search?q=${encodeURIComponent(normalized)}&target=stock&size=30&page=1`,
    { headers: NAVER_HEADERS, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Naver 검색 실패 (${response.status})`);
  }

  const data = (await response.json()) as {
    result?: { items?: NaverSearchItem[] };
    items?: NaverSearchItem[];
  };
  const items = data.result?.items ?? data.items ?? [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const market = marketFromNation(item.nationCode);
    const name = String(item.name ?? "").trim();
    const ticker = market ? yahooTicker(item, market) : "";
    if (!market || !name || !ticker || seen.has(ticker)) {
      continue;
    }
    seen.add(ticker);
    hits.push({
      name,
      ticker,
      market,
      kind: kindFromItem(item),
    });
  }

  const needle = foldQuery(normalized);
  const matched = hits.filter((hit) => containsQuery(hit, needle));
  return matched.length > 0 ? matched : hits;
}
