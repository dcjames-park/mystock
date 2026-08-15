import type {
  Account,
  Holding,
  ValuationSnapshot,
} from "@/lib/data/types";

const now = "2026-08-15T00:00:00.000Z";

export const SEED_ACCOUNTS: Account[] = [
  { id: "samsung", label: "삼성증권", color: "blue", createdAt: now },
  { id: "kiwoom", label: "키움증권", color: "cyan", createdAt: now },
  { id: "mirae", label: "미래에셋", color: "purple", createdAt: now },
];

function lot(
  holdingId: string,
  id: string,
  buyPrice: number,
  qty: number,
  boughtAt: string,
) {
  return {
    id,
    holdingId,
    buyPrice,
    qty,
    boughtAt,
    createdAt: now,
    updatedAt: now,
  };
}

export const SEED_HOLDINGS: Holding[] = [
  {
    id: "005930",
    accountId: "samsung",
    name: "삼성전자",
    ticker: "005930.KS",
    market: "kr",
    kind: "stock",
    buyPrice: 74400,
    qty: 50,
    currency: "KRW",
    boughtAt: "2025-03-01T00:00:00.000Z",
    lots: [
      lot("005930", "005930-1", 72000, 30, "2025-03-01T00:00:00.000Z"),
      lot("005930", "005930-2", 78000, 20, "2025-09-01T00:00:00.000Z"),
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "360750",
    accountId: "kiwoom",
    name: "TIGER 미국S&P500",
    ticker: "360750.KS",
    market: "kr",
    kind: "etf",
    buyPrice: 18200,
    qty: 100,
    currency: "KRW",
    boughtAt: "2025-11-15T00:00:00.000Z",
    lots: [lot("360750", "360750-1", 18200, 100, "2025-11-15T00:00:00.000Z")],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "aapl",
    accountId: "mirae",
    name: "Apple",
    ticker: "AAPL",
    market: "us",
    kind: "stock",
    buyPrice: 180,
    qty: 20,
    currency: "USD",
    boughtAt: "2025-03-20T00:00:00.000Z",
    lots: [lot("aapl", "aapl-1", 180, 20, "2025-03-20T00:00:00.000Z")],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "qqq",
    accountId: "samsung",
    name: "Invesco QQQ",
    ticker: "QQQ",
    market: "us",
    kind: "etf",
    buyPrice: 420,
    qty: 10,
    currency: "USD",
    boughtAt: "2026-07-25T00:00:00.000Z",
    lots: [lot("qqq", "qqq-1", 420, 10, "2026-07-25T00:00:00.000Z")],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "nvda",
    accountId: "kiwoom",
    name: "NVIDIA",
    ticker: "NVDA",
    market: "us",
    kind: "stock",
    buyPrice: 95,
    qty: 30,
    currency: "USD",
    boughtAt: "2026-02-01T00:00:00.000Z",
    lots: [lot("nvda", "nvda-1", 95, 30, "2026-02-01T00:00:00.000Z")],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "035720",
    accountId: "kiwoom",
    name: "카카오",
    ticker: "035720.KS",
    market: "kr",
    kind: "stock",
    buyPrice: 48000,
    qty: 40,
    currency: "KRW",
    boughtAt: "2024-08-01T00:00:00.000Z",
    lots: [lot("035720", "035720-1", 48000, 40, "2024-08-01T00:00:00.000Z")],
    createdAt: now,
    updatedAt: now,
  },
];

const SERIES: Record<string, Record<string, { dates: string[]; values: number[] }>> = {
  all: {
    "1m": {
      dates: ["2026-07-18", "2026-07-25", "2026-08-01", "2026-08-08", "2026-08-15"],
      values: [24800000, 25100000, 25550000, 26100000, 26580000],
    },
    "6m": {
      dates: ["2026-03-15", "2026-04-15", "2026-05-15", "2026-06-15", "2026-07-15", "2026-08-15"],
      values: [19800000, 21100000, 22400000, 23900000, 25200000, 26580000],
    },
    "1y": {
      dates: ["2025-09-15", "2025-11-15", "2026-01-15", "2026-03-15", "2026-05-15", "2026-08-15"],
      values: [16200000, 17800000, 19600000, 21800000, 24100000, 26580000],
    },
    "2y": {
      dates: ["2024-08-15", "2025-02-15", "2025-08-15", "2026-02-15", "2026-08-15"],
      values: [12800000, 15100000, 17800000, 21400000, 26580000],
    },
  },
  samsung: {
    "1m": {
      dates: ["2026-07-18", "2026-07-25", "2026-08-01", "2026-08-08", "2026-08-15"],
      values: [9800000, 10050000, 10280000, 10480000, 10650000],
    },
    "6m": {
      dates: ["2026-03-15", "2026-04-15", "2026-05-15", "2026-06-15", "2026-07-15", "2026-08-15"],
      values: [8200000, 8700000, 9200000, 9700000, 10200000, 10650000],
    },
    "1y": {
      dates: ["2025-09-15", "2025-11-15", "2026-01-15", "2026-03-15", "2026-05-15", "2026-08-15"],
      values: [6800000, 7500000, 8200000, 9000000, 9800000, 10650000],
    },
    "2y": {
      dates: ["2024-08-15", "2025-02-15", "2025-08-15", "2026-02-15", "2026-08-15"],
      values: [5200000, 6400000, 7600000, 9000000, 10650000],
    },
  },
  kiwoom: {
    "1m": {
      dates: ["2026-07-18", "2026-07-25", "2026-08-01", "2026-08-08", "2026-08-15"],
      values: [8600000, 8900000, 9150000, 9420000, 9630000],
    },
    "6m": {
      dates: ["2026-03-15", "2026-04-15", "2026-05-15", "2026-06-15", "2026-07-15", "2026-08-15"],
      values: [6400000, 7100000, 7800000, 8400000, 9000000, 9630000],
    },
    "1y": {
      dates: ["2025-09-15", "2025-11-15", "2026-01-15", "2026-03-15", "2026-05-15", "2026-08-15"],
      values: [4800000, 5600000, 6500000, 7400000, 8500000, 9630000],
    },
    "2y": {
      dates: ["2024-08-15", "2025-02-15", "2025-08-15", "2026-02-15", "2026-08-15"],
      values: [3600000, 4700000, 5900000, 7600000, 9630000],
    },
  },
  mirae: {
    "1m": {
      dates: ["2026-07-18", "2026-07-25", "2026-08-01", "2026-08-08", "2026-08-15"],
      values: [5800000, 5900000, 6050000, 6180000, 6290000],
    },
    "6m": {
      dates: ["2026-03-15", "2026-04-15", "2026-05-15", "2026-06-15", "2026-07-15", "2026-08-15"],
      values: [4700000, 5000000, 5300000, 5650000, 5980000, 6290000],
    },
    "1y": {
      dates: ["2025-09-15", "2025-11-15", "2026-01-15", "2026-03-15", "2026-05-15", "2026-08-15"],
      values: [3900000, 4300000, 4800000, 5300000, 5800000, 6290000],
    },
    "2y": {
      dates: ["2024-08-15", "2025-02-15", "2025-08-15", "2026-02-15", "2026-08-15"],
      values: [3100000, 3600000, 4300000, 5200000, 6290000],
    },
  },
};

export const SEED_QUOTES: Record<string, number> = {
  "005930.KS": 78400,
  "360750.KS": 21050,
  AAPL: 228,
  QQQ: 488,
  NVDA: 142,
  "035720.KS": 41200,
};

export function buildSeedSnapshots(): ValuationSnapshot[] {
  const rows: ValuationSnapshot[] = [];
  for (const [accountId, periods] of Object.entries(SERIES)) {
    for (const series of Object.values(periods)) {
      series.dates.forEach((date, index) => {
        rows.push({
          id: `${accountId}-${date}-${index}`,
          capturedAt: date,
          accountId: accountId === "all" ? null : accountId,
          holdingId: null,
          marketValue: series.values[index] ?? 0,
          costValue: 0,
        });
      });
    }
  }
  return rows;
}
