import { LOCAL_USER } from "@/lib/data/backend";
import type {
  Account,
  Holding,
  LocalPost,
  ValuationSnapshot,
} from "@/lib/data/types";

const KEYS = {
  accounts: "mystock.accounts",
  holdings: "mystock.holdings",
  snapshots: "mystock.snapshots",
  posts: "mystock.posts",
} as const;

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

export function listAccounts(): Account[] {
  return readJson<Account[]>(KEYS.accounts, []);
}

export function saveAccounts(accounts: Account[]) {
  writeJson(KEYS.accounts, accounts);
}

export function listHoldings(): Holding[] {
  return readJson<Holding[]>(KEYS.holdings, []);
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
  const holdings = listHoldings();
  const index = holdings.findIndex((item) => item.id === holding.id);
  if (index === -1) {
    saveHoldings([...holdings, holding]);
    return;
  }
  const next = [...holdings];
  next[index] = holding;
  saveHoldings(next);
}

export function deleteHolding(holdingId: string) {
  saveHoldings(listHoldings().filter((item) => item.id !== holdingId));
  saveSnapshots(
    listSnapshots().filter((item) => item.holdingId !== holdingId),
  );
}

export function appendSnapshot(snapshot: ValuationSnapshot) {
  saveSnapshots([...listSnapshots(), snapshot]);
}

export function listPosts(): LocalPost[] {
  return readJson<LocalPost[]>(KEYS.posts, []);
}

export function savePosts(posts: LocalPost[]) {
  writeJson(KEYS.posts, posts);
}

export function getPost(id: string): LocalPost | null {
  return listPosts().find((item) => item.id === id) ?? null;
}

export function createLocalPost(input: {
  title: string;
  content: string;
}): LocalPost {
  const post: LocalPost = {
    id: crypto.randomUUID(),
    title: input.title,
    content: input.content,
    author_name: LOCAL_USER.name,
    created_at: new Date().toISOString(),
  };
  savePosts([post, ...listPosts()]);
  return post;
}
