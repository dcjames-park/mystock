export {
  getDataBackend,
  isLocalBackend,
  isSupabaseBackend,
  LOCAL_USER,
} from "./backend";
export type { DataBackend } from "./backend";
export type {
  Account,
  AccountColor,
  Currency,
  Holding,
  HoldingLot,
  HoldingKind,
  Market,
  Period,
  PeriodPoint,
  Quote,
  QuoteDetail,
  SearchHit,
  ValuationSnapshot,
} from "./types";
export * as localStore from "./local-store";
