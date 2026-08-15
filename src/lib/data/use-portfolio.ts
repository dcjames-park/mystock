"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { isLocalBackend, LOCAL_USER } from "@/lib/data/backend";
import * as localStore from "@/lib/data/local-store";
import * as supabaseStore from "@/lib/data/supabase-store";
import { applyLotSummary, hydrateHoldings } from "@/lib/data/lots";
import { holdingToKrw, nextAccountColor, FALLBACK_USD_KRW, USD_KRW_SOURCE, USD_KRW_SYMBOL } from "@/lib/money";
import { todayStamp } from "@/lib/data/trend";
import type {
  Account,
  FxQuote,
  Holding,
  PricePoint,
  SearchHit,
  ValuationSnapshot,
} from "@/lib/data/types";

const QUOTE_TTL_MS = 60 * 60_000;

const FALLBACK_FX: FxQuote = {
  usdKrw: FALLBACK_USD_KRW,
  asOf: null,
  symbol: USD_KRW_SYMBOL,
  source: USD_KRW_SOURCE,
  fallback: true,
};

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
  const [fx, setFx] = useState<FxQuote>(FALLBACK_FX);
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
        holdings: hydrateHoldings(JSON.parse(data.holdings || "[]") as Holding[]),
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
  const tickerKey = [...new Set(holdings.map((item) => item.ticker).filter(Boolean))].join(",");
  const ready = local ? isClient : remoteReady;
  const historiesRef = useRef(histories);
  const inflightCharts = useRef(new Set<string>());
  const lastQuoteFetch = useRef({ key: "", at: 0 });
  historiesRef.current = histories;

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
    async (
      nextHoldings: Holding[],
      nextQuotes: Record<string, number>,
      nextAccounts: Account[],
      usdKrw: number,
    ) => {
      const capturedAt = todayStamp();
      const groups = [null, ...nextAccounts.map((item) => item.id)] as Array<string | null>;
      for (const accountId of groups) {
        const rows = nextHoldings.filter(
          (item) => accountId === null || item.accountId === accountId,
        );
        const totals = rows.reduce(
          (acc, item) => {
            const krw = holdingToKrw(
              item,
              nextQuotes[item.ticker] ?? item.buyPrice,
              usdKrw,
            );
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

  const applySnapshot = useCallback(
    async (data: {
      quotes: { ticker: string; lastPrice: number }[];
      fx?: {
        usdKrw?: number;
        asOf?: string | null;
        symbol?: string;
        source?: string;
      } | null;
    }) => {
      const next: Record<string, number> = {};
      for (const item of data.quotes) {
        next[item.ticker] = item.lastPrice;
      }
      if (Object.keys(next).length > 0) {
        setLiveQuotes((prev) => ({ ...prev, ...next }));
        if (local) {
          localStore.saveQuoteCache({ ...parsed.quoteCache, ...next });
        }
      }
      let usdKrw = fx.usdKrw;
      if (data.fx && Number.isFinite(data.fx.usdKrw) && (data.fx.usdKrw ?? 0) > 0) {
        const nextFx: FxQuote = {
          usdKrw: data.fx.usdKrw as number,
          asOf: data.fx.asOf ?? null,
          symbol: data.fx.symbol ?? USD_KRW_SYMBOL,
          source: data.fx.source ?? USD_KRW_SOURCE,
          fallback: false,
        };
        usdKrw = nextFx.usdKrw;
        setFx(nextFx);
        localStore.saveFxCache(nextFx);
      }
      if (Object.keys(next).length > 0) {
        await persistTodaySnapshots(
          holdings,
          { ...parsed.quoteCache, ...next },
          accounts,
          usdKrw,
        );
      }
    },
    [accounts, fx.usdKrw, holdings, local, parsed.quoteCache, persistTodaySnapshots],
  );

  const refreshQuotes = useCallback(async () => {
    const response = await fetch(`/api/market/quotes?tickers=${encodeURIComponent(tickerKey)}`);
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as {
      quotes: { ticker: string; lastPrice: number }[];
      fx?: FxQuote | null;
    };
    lastQuoteFetch.current = { key: tickerKey, at: Date.now() };
    await applySnapshot(data);
  }, [applySnapshot, tickerKey]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const cached = localStore.readFxCache();
    if (cached) {
      setFx({ ...cached, fallback: false });
    }
    const fresh =
      lastQuoteFetch.current.key === tickerKey &&
      Date.now() - lastQuoteFetch.current.at < QUOTE_TTL_MS;
    if (fresh) {
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
          fx?: FxQuote | null;
        };
        if (cancelled) {
          return;
        }
        lastQuoteFetch.current = { key: tickerKey, at: Date.now() };
        await applySnapshot(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [applySnapshot, ready, tickerKey]);

  const addAccount = useCallback(
    async (label: string) => {
      const exists = accounts.some(
        (item) => item.label.trim().toLowerCase() === label.trim().toLowerCase(),
      );
      if (exists) {
        throw new Error("이미 등록된 계좌명입니다.");
      }
      const color = nextAccountColor(accounts.map((item) => item.color));
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
    [accounts, local, reloadRemote],
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

  const addLot = useCallback(
    async (
      holdingId: string,
      input: { buyPrice: number; qty: number; boughtAt: string },
    ) => {
      if (local) {
        return localStore.addLot(holdingId, input);
      }
      const holding = await supabaseStore.addLot(holdingId, input);
      await reloadRemote();
      return holding;
    },
    [local, reloadRemote],
  );

  const updateLot = useCallback(
    async (
      holdingId: string,
      lotId: string,
      input: { buyPrice: number; qty: number; boughtAt: string },
    ) => {
      if (local) {
        return localStore.updateLot(holdingId, lotId, input);
      }
      const holding = await supabaseStore.updateLot(holdingId, lotId, input);
      await reloadRemote();
      return holding;
    },
    [local, reloadRemote],
  );

  const removeLot = useCallback(
    async (holdingId: string, lotId: string) => {
      if (local) {
        return localStore.deleteLot(holdingId, lotId);
      }
      const result = await supabaseStore.removeLot(holdingId, lotId);
      await reloadRemote();
      return result;
    },
    [local, reloadRemote],
  );

  const addHolding = useCallback(
    async (input: Omit<Holding, "id" | "createdAt" | "updatedAt" | "lots">) => {
      const existing = holdings.find(
        (item) => item.accountId === input.accountId && item.ticker === input.ticker,
      );
      if (existing) {
        throw new Error("이미 보유 중인 종목입니다. 종목 상세에서 매수를 추가해 주세요.");
      }
      if (local) {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const holding = applyLotSummary({
          ...input,
          id,
          lots: [
            {
              id: crypto.randomUUID(),
              holdingId: id,
              buyPrice: input.buyPrice,
              qty: input.qty,
              boughtAt: input.boughtAt,
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        });
        localStore.upsertHolding(holding);
        return holding;
      }
      const holding = await supabaseStore.insertHolding({ ...input, lots: [] });
      await reloadRemote();
      return holding;
    },
    [holdings, local, reloadRemote],
  );

  const updateHolding = useCallback(
    async (
      id: string,
      input: { buyPrice?: number; qty?: number; boughtAt?: string; name?: string },
    ) => {
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

  const loadCharts = useCallback(async (tickers: string[], period: string) => {
    const unique = [...new Set(tickers.filter(Boolean))];
    const missing = unique.filter((ticker) => {
      const key = `${ticker}:${period}`;
      return !historiesRef.current[key] && !inflightCharts.current.has(key);
    });
    if (missing.length === 0) {
      return;
    }
    for (const ticker of missing) {
      inflightCharts.current.add(`${ticker}:${period}`);
    }
    try {
      const response = await fetch(
        `/api/market/charts?tickers=${encodeURIComponent(missing.join(","))}&period=${period}`,
      );
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as {
        charts?: Record<string, { prices?: number[]; series?: PricePoint[] }>;
      };
      const nextCharts: Record<string, number[]> = {};
      const nextHistories: Record<string, PricePoint[]> = {};
      for (const ticker of missing) {
        const item = data.charts?.[ticker];
        if (!item) {
          continue;
        }
        const key = `${ticker}:${period}`;
        nextCharts[key] = item.prices ?? [];
        nextHistories[key] = item.series ?? [];
      }
      if (Object.keys(nextHistories).length > 0) {
        setCharts((prev) => ({ ...prev, ...nextCharts }));
        setHistories((prev) => ({ ...prev, ...nextHistories }));
      }
    } finally {
      for (const ticker of missing) {
        inflightCharts.current.delete(`${ticker}:${period}`);
      }
    }
  }, []);

  const loadChart = useCallback(
    async (ticker: string, period: string) => {
      await loadCharts([ticker], period);
    },
    [loadCharts],
  );

  return {
    ready,
    local,
    email,
    accounts,
    holdings,
    snapshots,
    quotes,
    fx,
    charts,
    histories,
    addAccount,
    removeAccount,
    addHolding,
    addLot,
    updateLot,
    removeLot,
    updateHolding,
    removeHolding,
    refreshQuotes,
    loadChart,
    loadCharts,
  };
}

export async function searchHoldings(query: string): Promise<SearchHit[]> {
  const response = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`);
  const data = (await response.json()) as { hits?: SearchHit[] };
  return data.hits ?? [];
}
