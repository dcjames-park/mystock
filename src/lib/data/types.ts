export type Market = "kr" | "us";
export type HoldingKind = "stock" | "etf";
export type Currency = "KRW" | "USD";

export type Account = {
  id: string;
  label: string;
  color: string;
  createdAt: string;
};

export type Holding = {
  id: string;
  accountId: string;
  name: string;
  ticker: string;
  market: Market;
  kind: HoldingKind;
  buyPrice: number;
  qty: number;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
};

export type ValuationSnapshot = {
  id: string;
  capturedAt: string;
  accountId: string | null;
  holdingId: string | null;
  marketValue: number;
  costValue: number;
};

export type LocalPost = {
  id: string;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
};
