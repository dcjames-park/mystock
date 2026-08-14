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
  HoldingKind,
  Market,
  Period,
  PeriodPoint,
  Quote,
  SearchHit,
  ValuationSnapshot,
} from "./types";
export * as localStore from "./local-store";
