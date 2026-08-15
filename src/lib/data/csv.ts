import type { Account, Holding, HoldingKind, Market } from "@/lib/data/types";
import { sortLots } from "@/lib/data/lots";
import { fetchNaverHoldingName, isKoreanName } from "@/lib/market/naver-name";

export type CsvLotRow = {
  account: string;
  name: string;
  ticker: string;
  market: Market | null;
  kind: HoldingKind | null;
  buyPrice: number;
  qty: number;
  boughtOn: string;
};

export const CSV_HEADERS = [
  "계좌명",
  "종목명",
  "티커",
  "시장",
  "종류",
  "매수가",
  "수량",
  "매수일",
] as const;

export const CSV_REQUIRED_HEADERS = [
  "계좌명",
  "티커",
  "매수가",
  "수량",
  "매수일",
] as const;

export const CSV_EXAMPLE = [
  "계좌명,티커,매수가,수량,매수일",
  "삼성증권,005930.KS,70000,10,2024-03-15",
  "키움증권,AAPL,180.5,2,2024-06-02",
].join("\n");

const HEADER_ALIASES: Record<keyof CsvLotRow, string[]> = {
  account: ["계좌명", "계좌", "account", "account_name"],
  name: ["종목명", "이름", "name"],
  ticker: ["티커", "ticker", "symbol"],
  market: ["시장", "market"],
  kind: ["종류", "kind", "type"],
  buyPrice: ["매수가", "buy_price", "buyprice", "price"],
  qty: ["수량", "qty", "quantity"],
  boughtOn: ["매수일", "bought_on", "boughton", "date"],
};

function foldHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_]/g, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") {
        i += 1;
      }
      row.push(cell.trim());
      if (row.some((item) => item.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((item) => item.length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}

function csvCell(value: string | number) {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseMarket(value: string): Market | null {
  const next = value.trim().toLowerCase();
  if (next === "kr" || next === "국내" || next === "korea") {
    return "kr";
  }
  if (next === "us" || next === "해외" || next === "usa" || next === "미국") {
    return "us";
  }
  return null;
}

function parseKind(value: string): HoldingKind | null {
  const next = value.trim().toLowerCase();
  if (next === "stock" || next === "주식" || next === "equity") {
    return "stock";
  }
  if (next === "etf") {
    return "etf";
  }
  return null;
}

function parseBoughtOn(value: string): string | null {
  const compact = value.trim().replace(/[./]/g, "-");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(compact)) {
    return null;
  }
  return compact;
}

export function serializePortfolioCsv(accounts: Account[], holdings: Holding[]) {
  const accountById = new Map(accounts.map((item) => [item.id, item.label]));
  const lines = [CSV_HEADERS.join(",")];
  for (const holding of holdings) {
    const account = accountById.get(holding.accountId) ?? "";
    for (const lot of sortLots(holding.lots)) {
      lines.push(
        [
          csvCell(account),
          csvCell(holding.name),
          csvCell(holding.ticker),
          holding.market,
          holding.kind,
          lot.buyPrice,
          lot.qty,
          lot.boughtAt.slice(0, 10),
        ].join(","),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

export function parsePortfolioCsv(text: string): {
  rows: CsvLotRow[];
  errors: string[];
} {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], errors: ["CSV에 내용이 없습니다."] };
  }
  const header = table[0].map(foldHeader);
  const index: Partial<Record<keyof CsvLotRow, number>> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [keyof CsvLotRow, string[]]
  >) {
    const found = header.findIndex((item) =>
      aliases.some((alias) => foldHeader(alias) === item),
    );
    if (found >= 0) {
      index[field] = found;
    }
  }
  const required: Array<keyof CsvLotRow> = [
    "account",
    "ticker",
    "buyPrice",
    "qty",
    "boughtOn",
  ];
  const missing = required.filter((field) => index[field] == null);
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        `필수 열이 없습니다: ${missing
          .map((field) => HEADER_ALIASES[field][0])
          .join(", ")}`,
      ],
    };
  }

  const rows: CsvLotRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const account = cells[index.account!]?.trim() ?? "";
    const name = (index.name != null ? cells[index.name] : "")?.trim() ?? "";
    const ticker = cells[index.ticker!]?.trim() ?? "";
    const market =
      index.market != null ? parseMarket(cells[index.market] ?? "") : null;
    const kind = index.kind != null ? parseKind(cells[index.kind] ?? "") : null;
    const buyPrice = Number(String(cells[index.buyPrice!] ?? "").replace(/,/g, ""));
    const qty = Number(String(cells[index.qty!] ?? "").replace(/,/g, ""));
    const boughtOn = parseBoughtOn(cells[index.boughtOn!] ?? "");
    if (!account || !ticker) {
      errors.push(`${line}행: 계좌명과 티커는 필수입니다.`);
      return;
    }
    if (index.market != null && (cells[index.market] ?? "").trim() && !market) {
      errors.push(`${line}행: 시장은 kr 또는 us 여야 합니다.`);
      return;
    }
    if (index.kind != null && (cells[index.kind] ?? "").trim() && !kind) {
      errors.push(`${line}행: 종류는 stock 또는 etf 여야 합니다.`);
      return;
    }
    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      errors.push(`${line}행: 매수가를 확인해 주세요.`);
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push(`${line}행: 수량을 확인해 주세요.`);
      return;
    }
    if (!boughtOn) {
      errors.push(`${line}행: 매수일은 YYYY-MM-DD 형식이어야 합니다.`);
      return;
    }
    rows.push({ account, name, ticker, market, kind, buyPrice, qty, boughtOn });
  });
  return { rows, errors };
}

export function canonicalTicker(ticker: string) {
  const next = ticker.trim().toUpperCase();
  if (/^\d{6}\.(KS|KQ|KN)$/.test(next)) {
    return next.slice(0, 6);
  }
  return next;
}

export function inferMarketFromTicker(ticker: string): Market {
  const next = ticker.trim().toUpperCase();
  if (/^\d{6}(\.(KS|KQ|KN))?$/.test(next) || next.endsWith(".KS") || next.endsWith(".KQ") || next.endsWith(".KN")) {
    return "kr";
  }
  return "us";
}

export type ResolvedCsvMeta = {
  name: string;
  ticker: string;
  market: Market;
  kind: HoldingKind;
};

export async function resolveCsvMeta(row: CsvLotRow): Promise<ResolvedCsvMeta> {
  const query = row.ticker.trim();
  let hits: Array<{ name: string; ticker: string; market: Market; kind: HoldingKind }> = [];
  try {
    const response = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`);
    if (response.ok) {
      const data = (await response.json()) as { hits?: typeof hits };
      hits = data.hits ?? [];
    }
  } catch {
    hits = [];
  }

  const csvKey = canonicalTicker(row.ticker);
  const hit =
    hits.find(
      (item) =>
        canonicalTicker(item.ticker) === csvKey &&
        (row.market == null || item.market === row.market),
    ) ??
    hits.find((item) => canonicalTicker(item.ticker) === csvKey) ??
    hits[0] ??
    null;

  const market = hit?.market ?? row.market ?? inferMarketFromTicker(row.ticker);
  const kind = hit?.kind ?? row.kind ?? "stock";
  const ticker = hit?.ticker ?? row.ticker.trim();
  let name = hit?.name || row.name || ticker;
  try {
    const naverName = await fetchNaverHoldingName(ticker, market, kind);
    if (naverName && isKoreanName(naverName)) {
      name = naverName;
    }
  } catch {
    // keep yahoo/csv name
  }
  return { name, ticker, market, kind };
}
