"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isLocalBackend, LOCAL_USER } from "@/lib/data/backend";
import * as localStore from "@/lib/data/local-store";
import * as supabaseStore from "@/lib/data/supabase-store";
import { holdingToKrw, ACCOUNT_COLORS } from "@/lib/money";
import { todayStamp } from "@/lib/data/trend";
import type {
  Account,
  AccountColor,
  Holding,
  PricePoint,
  SearchHit,
  ValuationSnapshot,
} from "@/lib/data/types";

function subscribe(onStoreChange: () => void) {
  localStore.ensureSeeded();
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(localStore.CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(localStore.CHANGE_EVENT, onStoreChange);
  };
}

function getLocalSnapshot() {
  return JSON.stringify({
    accounts: window.localStorage.getItem(localStore.STORAGE_KEYS.accounts),
    holdings: window.localStorage.getItem(localStore.STORAGE_KEYS.holdings),
    snapshots: window.localStorage.getItem(localStore.STORAGE_KEYS.snapshots),
    quotes: window.localStorage.getItem(localStore.STORAGE_KEYS.quotes),
  });
}

function subscribeClient() {
  return () => {};
}

export function usePortfolio() {
  const local = isLocalBackend();
  const isClient = useSyncExternalStore(subscribeClient, () => true, () => false);
  const raw = useSyncExternalStore(
    subscribe,
    getLocalSnapshot,
    () => "",
  );
  const [remoteReady, setRemoteReady] = useState(false);
  const [email, setEmail] = useState(local ? LOCAL_USER.email : "");
  const [remoteAccounts, setRemoteAccounts] = useState<Account[]>([]);
  const [remoteHoldings, setRemoteHoldings] = useState<Holding[]>([]);
  const [remoteSnapshots, setRemoteSnapshots] = useState<ValuationSnapshot[]>([]);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, number>>({});
  const [charts, setCharts] = useState<Record<string, number[]>>({});
  const [histories, setHistories] = useState<Record<string, PricePoint[]>>({});

  const parsed = useMemo(() => {
    if (!local || !raw) {
      return { accounts: [] as Account[], holdings: [] as Holding[], snapshots: [] as ValuationSnapshot[], quoteCache: {} as Record<string, number> };
    }
    try {
      const data = JSON.parse(raw) as Record<string, string | null>;
      return {
        accounts: JSON.parse(data.accounts || "[]") as Account[],
        holdings: JSON.parse(data.holdings || "[]") as Holding[],
        snapshots: JSON.parse(data.snapshots || "[]") as ValuationSnapshot[],
        quoteCache: JSON.parse(data.quotes || "{}") as Record<string, number>,
      };
    } catch {
      return { accounts: [] as Account[], holdings: [] as Holding[], snapshots: [] as ValuationSnapshot[], quoteCache: {} as Record<string, number> };
    }
  }, [local, raw]);

  const accounts = local ? parsed.accounts : remoteAccounts;
  const holdings = local ? parsed.holdings : remoteHoldings;
  const snapshots = local ? parsed.snapshots : remoteSnapshots;
  const quotes = { ...parsed.quoteCache, ...liveQuotes };
  const tickerKey = holdings.map((item) => item.ticker).join(",");
  const ready = local ? isClient : remoteReady;

  const reloadRemote = useCallback(async () => {
    if (local) {
      return;
    }
    const data = await supabaseStore.loadPortfolio();
    setRemoteAccounts(data.accounts);
    setRemoteHoldings(data.holdings);
    setRemoteSnapshots(data.snapshots);
    setEmail(data.user?.email ?? "");
  }, [local]);

  useEffect(() => {
    if (local) {
      return;
    }
    let cancelled = false;
    void supabaseStore.loadPortfolio().then((data) => {
      if (cancelled) {
        return;
      }
      setRemoteAccounts(data.accounts);
      setRemoteHoldings(data.holdings);
      setRemoteSnapshots(data.snapshots);
      setEmail(data.user?.email ?? "");
      setRemoteReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [local]);

  const persistTodaySnapshots = useCallback(
    async (nextHoldings: Holding[], nextQuotes: Record<string, number>, nextAccounts: Account[]) => {
      const capturedAt = todayStamp();
      const groups = [null, ...nextAccounts.map((item) => item.id)] as Array<string | null>;
      for (const accountId of groups) {
        const rows = nextHoldings.filter(
          (item) => accountId === null || item.accountId === accountId,
        );
        const totals = rows.reduce(
          (acc, item) => {
            const krw = holdingToKrw(item, nextQuotes[item.ticker] ?? item.buyPrice);
            acc.value += krw.value;
            acc.buy += krw.buy;
            return acc;
          },
          { value: 0, buy: 0 },
        );
        const snapshot: ValuationSnapshot = {
          id: crypto.randomUUID(),
          capturedAt,
          accountId,
          holdingId: null,
          marketValue: totals.value,
          costValue: totals.buy,
        };
        if (local) {
          localStore.upsertSnapshot(snapshot);
        } else {
          await supabaseStore.upsertDaySnapshot({
            capturedAt,
            accountId,
            marketValue: totals.value,
            costValue: totals.buy,
          });
        }
      }
    },
    [local],
  );

  const refreshQuotes = useCallback(async () => {
    if (!tickerKey) {
      return;
    }
    const response = await fetch(`/api/market/quotes?tickers=${encodeURIComponent(tickerKey)}`);
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as {
      quotes: { ticker: string; lastPrice: number }[];
    };
    const next: Record<string, number> = {};
    for (const item of data.quotes) {
      next[item.ticker] = item.lastPrice;
    }
    setLiveQuotes(next);
    if (local) {
      localStore.saveQuoteCache(next);
    }
    await persistTodaySnapshots(holdings, { ...parsed.quoteCache, ...next }, accounts);
  }, [accounts, holdings, local, parsed.quoteCache, persistTodaySnapshots, tickerKey]);

  useEffect(() => {
    if (!ready || !tickerKey) {
      return;
    }
    let cancelled = false;
    void fetch(`/api/market/quotes?tickers=${encodeURIComponent(tickerKey)}`)
      .then(async (response) => {
        if (cancelled || !response.ok) {
          return;
        }
        const data = (await response.json()) as {
          quotes: { ticker: string; lastPrice: number }[];
        };
        if (cancelled) {
          return;
        }
        const next: Record<string, number> = {};
        for (const item of data.quotes) {
          next[item.ticker] = item.lastPrice;
        }
        setLiveQuotes(next);
        if (local) {
          localStore.saveQuoteCache(next);
        }
        void persistTodaySnapshots(holdings, next, accounts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // tickerKey is the actual trigger; holdings/accounts are read from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, persistTodaySnapshots, ready, tickerKey]);

  const addAccount = useCallback(
    async (label: string) => {
      const color = ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length] as AccountColor;
      if (local) {
        const account: Account = {
          id: crypto.randomUUID(),
          label,
          color,
          createdAt: new Date().toISOString(),
        };
        localStore.upsertAccount(account);
        return account;
      }
      const account = await supabaseStore.insertAccount({ label, color });
      await reloadRemote();
      return account;
    },
    [accounts.length, local, reloadRemote],
  );

  const removeAccount = useCallback(
    async (id: string) => {
      if (local) {
        localStore.deleteAccount(id);
        return;
      }
      await supabaseStore.removeAccount(id);
      await reloadRemote();
    },
    [local, reloadRemote],
  );

  const addHolding = useCallback(
    async (input: Omit<Holding, "id" | "createdAt" | "updatedAt">) => {
      if (local) {
        const holding: Holding = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        localStore.upsertHolding(holding);
        return holding;
      }
      const holding = await supabaseStore.insertHolding(input);
      await reloadRemote();
      return holding;
    },
    [local, reloadRemote],
  );

  const updateHolding = useCallback(
    async (id: string, input: { buyPrice: number; qty: number; boughtAt: string }) => {
      if (local) {
        const current = localStore.listHoldings().find((item) => item.id === id);
        if (!current) {
          return;
        }
        localStore.upsertHolding({
          ...current,
          ...input,
          updatedAt: new Date().toISOString(),
        });
        return;
      }
      await supabaseStore.patchHolding(id, input);
      await reloadRemote();
    },
    [local, reloadRemote],
  );

  const removeHolding = useCallback(
    async (id: string) => {
      if (local) {
        localStore.deleteHolding(id);
        return;
      }
      await supabaseStore.removeHolding(id);
      await reloadRemote();
    },
    [local, reloadRemote],
  );

  const loadChart = useCallback(async (ticker: string, period: string) => {
    const key = `${ticker}:${period}`;
    const response = await fetch(
      `/api/market/chart?ticker=${encodeURIComponent(ticker)}&period=${period}`,
    );
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as {
      prices: number[];
      series?: PricePoint[];
    };
    setCharts((prev) => ({ ...prev, [key]: data.prices }));
    setHistories((prev) => ({ ...prev, [key]: data.series ?? [] }));
  }, []);

  return {
    ready,
    local,
    email,
    accounts,
    holdings,
    snapshots,
    quotes,
    charts,
    histories,
    addAccount,
    removeAccount,
    addHolding,
    updateHolding,
    removeHolding,
    refreshQuotes,
    loadChart,
  };
}

export async function searchHoldings(query: string): Promise<SearchHit[]> {
  const response = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`);
  const data = (await response.json()) as { hits?: SearchHit[] };
  return data.hits ?? [];
}
