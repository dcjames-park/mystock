export type Market = "kr" | "us";
export type HoldingKind = "stock" | "etf";
export type Currency = "KRW" | "USD";
export type AccountColor = "blue" | "cyan" | "purple";
export type Period = "1m" | "6m" | "1y" | "2y";

export type Account = {
  id: string;
  label: string;
  color: AccountColor;
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
  boughtAt: string;
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

export type Quote = {
  ticker: string;
  lastPrice: number;
};

export type FxQuote = {
  usdKrw: number;
  asOf: string | null;
  symbol: string;
  source: string;
  fallback: boolean;
};

export type SearchHit = {
  name: string;
  ticker: string;
  market: Market;
  kind: HoldingKind;
};

export type PeriodPoint = {
  label: string;
  date: string;
  value: number;
  buy: number;
};

export type PricePoint = {
  date: string;
  close: number;
};
