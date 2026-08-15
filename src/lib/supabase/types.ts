export type AccountColor =
  | "blue"
  | "cyan"
  | "purple"
  | "orange"
  | "rose"
  | "green"
  | "amber"
  | "pink";
export type Market = "kr" | "us";
export type HoldingKind = "stock" | "etf";
export type Currency = "KRW" | "USD";

export type AccountRow = {
  id: string;
  user_id: string;
  label: string;
  color: AccountColor;
  created_at: string;
};

export type HoldingRow = {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  ticker: string;
  market: Market;
  kind: HoldingKind;
  buy_price: number;
  qty: number;
  currency: Currency;
  bought_at: string;
  created_at: string;
  updated_at: string;
};

export type HoldingLotRow = {
  id: string;
  user_id: string;
  holding_id: string;
  buy_price: number;
  qty: number;
  bought_at: string;
  created_at: string;
  updated_at: string;
};

export type SnapshotRow = {
  id: string;
  user_id: string;
  captured_at: string;
  account_id: string | null;
  holding_id: string | null;
  market_value: number;
  cost_value: number;
};

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: AccountRow;
        Insert: Omit<AccountRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AccountRow>;
        Relationships: [];
      };
      holdings: {
        Row: HoldingRow;
        Insert: Omit<HoldingRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<HoldingRow>;
        Relationships: [];
      };
      holding_lots: {
        Row: HoldingLotRow;
        Insert: Omit<HoldingLotRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<HoldingLotRow>;
        Relationships: [];
      };
      valuation_snapshots: {
        Row: SnapshotRow;
        Insert: Omit<SnapshotRow, "id"> & { id?: string };
        Update: Partial<SnapshotRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
