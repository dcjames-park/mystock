import { applyLotSummary, hydrateHoldings } from "@/lib/data/lots";
import { buildSeedSnapshots, SEED_ACCOUNTS, SEED_HOLDINGS, SEED_QUOTES } from "@/lib/data/seed";
import type { Account, Holding, HoldingLot, ValuationSnapshot } from "@/lib/data/types";

const KEYS = {
  accounts: "mystock.accounts",
  holdings: "mystock.holdings",
  snapshots: "mystock.snapshots",
  quotes: "mystock.quotes",
  fx: "mystock.fx",
  seeded: "mystock.seeded",
} as const;

export type CachedFx = {
  usdKrw: number;
  asOf: string | null;
  symbol: string;
  source: string;
};

export const STORAGE_KEYS = KEYS;
export const CHANGE_EVENT = "mystock-local-change";

function canUseStorage() {
  return typeof window !== "undefined";
}

function notifyStoreChanged() {
  if (!canUseStorage()) {
    return;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
  notifyStoreChanged();
}

export function ensureSeeded() {
  if (!canUseStorage()) {
    return;
  }
  if (window.localStorage.getItem(KEYS.seeded) === "1") {
    return;
  }
  writeJson(KEYS.accounts, SEED_ACCOUNTS);
  writeJson(KEYS.holdings, SEED_HOLDINGS);
  writeJson(KEYS.snapshots, buildSeedSnapshots());
  writeJson(KEYS.quotes, SEED_QUOTES);
  window.localStorage.setItem(KEYS.seeded, "1");
}

export function listAccounts(): Account[] {
  return readJson<Account[]>(KEYS.accounts, []);
}

export function saveAccounts(accounts: Account[]) {
  writeJson(KEYS.accounts, accounts);
}

export function listHoldings(): Holding[] {
  return hydrateHoldings(readJson<Holding[]>(KEYS.holdings, []));
}

export function saveHoldings(holdings: Holding[]) {
  writeJson(KEYS.holdings, holdings);
}

export function listSnapshots(): ValuationSnapshot[] {
  return readJson<ValuationSnapshot[]>(KEYS.snapshots, []);
}

export function saveSnapshots(snapshots: ValuationSnapshot[]) {
  writeJson(KEYS.snapshots, snapshots);
}

export function listQuoteCache(): Record<string, number> {
  return readJson<Record<string, number>>(KEYS.quotes, {});
}

export function saveQuoteCache(quotes: Record<string, number>) {
  writeJson(KEYS.quotes, quotes);
}

export function readFxCache(): CachedFx | null {
  const value = readJson<CachedFx | null>(KEYS.fx, null);
  if (!value || !Number.isFinite(value.usdKrw) || value.usdKrw <= 0) {
    return null;
  }
  return value;
}

export function saveFxCache(fx: CachedFx) {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(KEYS.fx, JSON.stringify(fx));
}

export function upsertAccount(account: Account) {
  const accounts = listAccounts();
  const index = accounts.findIndex((item) => item.id === account.id);
  if (index === -1) {
    saveAccounts([...accounts, account]);
    return;
  }
  const next = [...accounts];
  next[index] = account;
  saveAccounts(next);
}

export function deleteAccount(accountId: string) {
  saveAccounts(listAccounts().filter((item) => item.id !== accountId));
  saveHoldings(listHoldings().filter((item) => item.accountId !== accountId));
  saveSnapshots(
    listSnapshots().filter((item) => item.accountId !== accountId),
  );
}

export function upsertHolding(holding: Holding) {
  const nextHolding = applyLotSummary({
    ...holding,
    lots: holding.lots ?? [],
  });
  const holdings = listHoldings();
  const index = holdings.findIndex((item) => item.id === nextHolding.id);
  if (index === -1) {
    saveHoldings([...holdings, nextHolding]);
    return nextHolding;
  }
  const next = [...holdings];
  next[index] = nextHolding;
  saveHoldings(next);
  return nextHolding;
}

export function addLot(
  holdingId: string,
  input: { buyPrice: number; qty: number; boughtAt: string },
) {
  const current = listHoldings().find((item) => item.id === holdingId);
  if (!current) {
    return null;
  }
  const now = new Date().toISOString();
  const lot: HoldingLot = {
    id: crypto.randomUUID(),
    holdingId,
    buyPrice: input.buyPrice,
    qty: input.qty,
    boughtAt: input.boughtAt,
    createdAt: now,
    updatedAt: now,
  };
  return upsertHolding({
    ...current,
    lots: [...current.lots, lot],
    updatedAt: now,
  });
}

export function updateLot(
  holdingId: string,
  lotId: string,
  input: { buyPrice: number; qty: number; boughtAt: string },
) {
  const current = listHoldings().find((item) => item.id === holdingId);
  if (!current) {
    return null;
  }
  const now = new Date().toISOString();
  return upsertHolding({
    ...current,
    lots: current.lots.map((lot) =>
      lot.id === lotId
        ? { ...lot, ...input, updatedAt: now }
        : lot,
    ),
    updatedAt: now,
  });
}

export function deleteLot(holdingId: string, lotId: string) {
  const current = listHoldings().find((item) => item.id === holdingId);
  if (!current) {
    return { holding: null, removedHolding: false };
  }
  const lots = current.lots.filter((lot) => lot.id !== lotId);
  if (lots.length === 0) {
    deleteHolding(holdingId);
    return { holding: null, removedHolding: true };
  }
  return {
    holding: upsertHolding({
      ...current,
      lots,
      updatedAt: new Date().toISOString(),
    }),
    removedHolding: false,
  };
}

export function deleteHolding(holdingId: string) {
  saveHoldings(listHoldings().filter((item) => item.id !== holdingId));
  saveSnapshots(
    listSnapshots().filter((item) => item.holdingId !== holdingId),
  );
}

export function upsertSnapshot(snapshot: ValuationSnapshot) {
  const snapshots = listSnapshots();
  const index = snapshots.findIndex(
    (item) =>
      item.capturedAt === snapshot.capturedAt &&
      item.accountId === snapshot.accountId &&
      item.holdingId === snapshot.holdingId,
  );
  if (index === -1) {
    saveSnapshots([...snapshots, snapshot]);
    return;
  }
  const next = [...snapshots];
  next[index] = snapshot;
  saveSnapshots(next);
}
