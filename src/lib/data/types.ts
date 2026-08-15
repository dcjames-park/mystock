export type Market = "kr" | "us";
export type HoldingKind = "stock" | "etf";
export type Currency = "KRW" | "USD";
export type AccountColor =
  | "blue"
  | "cyan"
  | "purple"
  | "orange"
  | "rose"
  | "green"
  | "amber"
  | "pink";
export type Period = "1m" | "6m" | "1y" | "2y" | "5y";

export type QuoteDetail = {
  ticker: string;
  lastPrice: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
  averageVolume: number | null;
  marketCap: number | null;
  pe: number | null;
  forwardPe: number | null;
  eps: number | null;
  dividendYield: number | null;
  beta: number | null;
  exchange: string | null;
  quoteType: string | null;
  currency: string | null;
  shortName: string | null;
  longName: string | null;
};

export type Account = {
  id: string;
  label: string;
  color: AccountColor;
  createdAt: string;
};

export type HoldingLot = {
  id: string;
  holdingId: string;
  buyPrice: number;
  qty: number;
  boughtAt: string;
  createdAt: string;
  updatedAt: string;
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
  lots: HoldingLot[];
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
