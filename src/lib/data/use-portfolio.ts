"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isLocalBackend, LOCAL_USER } from "@/lib/data/backend";
import * as localStore from "@/lib/data/local-store";
import * as supabaseStore from "@/lib/data/supabase-store";
import { canonicalTicker, resolveCsvMeta, type CsvLotRow } from "@/lib/data/csv";
import { applyLotSummary, hydrateHoldings } from "@/lib/data/lots";
import { holdingToKrw, nextAccountColor, FALLBACK_USD_KRW, USD_KRW_SOURCE, USD_KRW_SYMBOL } from "@/lib/money";
import { todayStamp, toBoughtAt } from "@/lib/data/trend";
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

function getLocalSnapshot() {
  return JSON.stringify({
    accounts: window.localStorage.getItem(localStore.STORAGE_KEYS.accounts),
    holdings: window.localStorage.getItem(localStore.STORAGE_KEYS.holdings),
    snapshots: window.localStorage.getItem(localStore.STORAGE_KEYS.snapshots),
    quotes: window.localStorage.getItem(localStore.STORAGE_KEYS.quotes),
  });
}

function usePortfolioState() {
  const local = isLocalBackend();
  const [localReady, setLocalReady] = useState(false);
  const [raw, setRaw] = useState("");
  const [remoteReady, setRemoteReady] = useState(false);
  const [email, setEmail] = useState(local ? LOCAL_USER.email : "");
  const [remoteAccounts, setRemoteAccounts] = useState<Account[]>([]);
  const [remoteHoldings, setRemoteHoldings] = useState<Holding[]>([]);
  const [remoteSnapshots, setRemoteSnapshots] = useState<ValuationSnapshot[]>([]);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, number>>({});
  const [prevCloses, setPrevCloses] = useState<Record<string, number>>({});
  const [quotesAsOf, setQuotesAsOf] = useState<string | null>(null);
  const [quotesRefreshing, setQuotesRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [fx, setFx] = useState<FxQuote>(FALLBACK_FX);
  const [charts, setCharts] = useState<Record<string, number[]>>({});
  const [histories, setHistories] = useState<Record<string, PricePoint[]>>({});
  const [chartPending, setChartPending] = useState(0);
  const [quotesSettled, setQuotesSettled] = useState(false);
  const historiesRef = useRef(histories);
  const inflightCharts = useRef(new Set<string>());
  const lastQuoteFetch = useRef({ key: "", at: 0 });
  historiesRef.current = histories;

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
  const dataReady = local ? localReady : remoteReady;
  const quotesReady =
    holdings.length === 0 ||
    holdings.every((item) => Number.isFinite(quotes[item.ticker]));
  const ready = dataReady && (quotesReady || quotesSettled);

  useEffect(() => {
    if (!local) {
      return;
    }
    localStore.ensureSeeded();
    const sync = () => {
      setRaw(getLocalSnapshot());
      setPrevCloses(localStore.listPrevCloses());
      setQuotesAsOf(localStore.readQuotesAt());
    };
    sync();
    const cachedQuotes = localStore.listQuoteCache();
    if (Object.keys(cachedQuotes).length > 0) {
      setLiveQuotes((prev) => ({ ...cachedQuotes, ...prev }));
    }
    const cachedFx = localStore.readFxCache();
    if (cachedFx) {
      setFx({ ...cachedFx, fallback: false });
    }
    setLocalReady(true);
    window.addEventListener("storage", sync);
    window.addEventListener(localStore.CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(localStore.CHANGE_EVENT, sync);
    };
  }, [local]);

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
      const cachedQuotes = localStore.listQuoteCache();
      if (Object.keys(cachedQuotes).length > 0) {
        setLiveQuotes((prev) => ({ ...cachedQuotes, ...prev }));
      }
      const cachedPrev = localStore.listPrevCloses();
      if (Object.keys(cachedPrev).length > 0) {
        setPrevCloses((prev) => ({ ...cachedPrev, ...prev }));
      }
      const cachedFx = localStore.readFxCache();
      if (cachedFx) {
        setFx({ ...cachedFx, fallback: false });
      }
      const quotesAt = localStore.readQuotesAt();
      if (quotesAt) {
        setQuotesAsOf(quotesAt);
      }
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
      quotes: { ticker: string; lastPrice: number; previousClose?: number | null }[];
      fx?: {
        usdKrw?: number;
        asOf?: string | null;
        symbol?: string;
        source?: string;
      } | null;
    }) => {
      const next: Record<string, number> = {};
      const nextPrev: Record<string, number> = {};
      for (const item of data.quotes) {
        next[item.ticker] = item.lastPrice;
        if (item.previousClose != null && item.previousClose > 0) {
          nextPrev[item.ticker] = item.previousClose;
        }
      }
      if (Object.keys(next).length > 0) {
        setLiveQuotes((prev) => ({ ...prev, ...next }));
        localStore.saveQuoteCache({ ...localStore.listQuoteCache(), ...next });
      }
      if (Object.keys(nextPrev).length > 0) {
        setPrevCloses((prev) => ({ ...prev, ...nextPrev }));
        localStore.savePrevCloses({
          ...localStore.listPrevCloses(),
          ...nextPrev,
        });
      }
      const asOf = new Date().toISOString();
      setQuotesAsOf(asOf);
      localStore.saveQuotesAt(asOf);
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

  const loadCharts = useCallback(
    async (tickers: string[], period: string, options?: { fresh?: boolean }) => {
      const unique = [...new Set(tickers.filter(Boolean))];
      const missing = unique.filter((ticker) => {
        const key = `${ticker}:${period}`;
        if (options?.fresh) {
          return !inflightCharts.current.has(key);
        }
        return !historiesRef.current[key] && !inflightCharts.current.has(key);
      });
      if (missing.length === 0) {
        return;
      }
      for (const ticker of missing) {
        inflightCharts.current.add(`${ticker}:${period}`);
      }
      setChartPending((count) => count + 1);
      try {
        const response = await fetch(
          `/api/market/charts?tickers=${encodeURIComponent(missing.join(","))}&period=${period}${
            options?.fresh ? "&fresh=1" : ""
          }`,
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
        setChartPending((count) => Math.max(0, count - 1));
      }
    },
    [],
  );

  const refreshQuotes = useCallback(async () => {
    setQuotesRefreshing(true);
    try {
      const response = await fetch(
        `/api/market/quotes?tickers=${encodeURIComponent(tickerKey)}&fresh=1`,
      );
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as {
        quotes: { ticker: string; lastPrice: number; previousClose?: number | null }[];
        fx?: FxQuote | null;
      };
      lastQuoteFetch.current = { key: tickerKey, at: Date.now() };
      await applySnapshot(data);
      const byPeriod = new Map<string, string[]>();
      for (const key of Object.keys(historiesRef.current)) {
        const sep = key.lastIndexOf(":");
        if (sep < 0) {
          continue;
        }
        const ticker = key.slice(0, sep);
        const period = key.slice(sep + 1);
        const list = byPeriod.get(period) ?? [];
        list.push(ticker);
        byPeriod.set(period, list);
      }
      await Promise.all(
        [...byPeriod.entries()].map(([period, tickers]) =>
          loadCharts(tickers, period, { fresh: true }),
        ),
      );
      setRefreshToken((value) => value + 1);
    } finally {
      setQuotesRefreshing(false);
    }
  }, [applySnapshot, loadCharts, tickerKey]);

  useEffect(() => {
    if (!dataReady) {
      return;
    }
    if (!tickerKey) {
      setQuotesSettled(true);
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
      setQuotesSettled(true);
      return;
    }
    let cancelled = false;
    void fetch(`/api/market/quotes?tickers=${encodeURIComponent(tickerKey)}`)
      .then(async (response) => {
        if (cancelled || !response.ok) {
          return;
        }
        const data = (await response.json()) as {
          quotes: { ticker: string; lastPrice: number; previousClose?: number | null }[];
          fx?: FxQuote | null;
        };
        if (cancelled) {
          return;
        }
        lastQuoteFetch.current = { key: tickerKey, at: Date.now() };
        await applySnapshot(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setQuotesSettled(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applySnapshot, dataReady, tickerKey]);

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

  const updateAccount = useCallback(
    async (id: string, label: string) => {
      const nextLabel = label.trim();
      const exists = accounts.some(
        (item) =>
          item.id !== id &&
          item.label.trim().toLowerCase() === nextLabel.toLowerCase(),
      );
      if (exists) {
        throw new Error("이미 등록된 계좌명입니다.");
      }
      if (local) {
        const current = localStore.listAccounts().find((item) => item.id === id);
        if (!current) {
          throw new Error("계좌를 찾을 수 없습니다.");
        }
        localStore.upsertAccount({ ...current, label: nextLabel });
        return;
      }
      await supabaseStore.patchAccount(id, { label: nextLabel });
      await reloadRemote();
    },
    [accounts, local, reloadRemote],
  );

  const importLots = useCallback(
    async (rows: CsvLotRow[]) => {
      const accountByName = new Map(
        accounts.map((item) => [item.label.trim().toLowerCase(), item]),
      );
      const holdingByKey = new Map(
        holdings.map((item) => [`${item.accountId}:${canonicalTicker(item.ticker)}`, item]),
      );
      const resolvedByTicker = new Map<string, Awaited<ReturnType<typeof resolveCsvMeta>>>();
      for (const row of rows) {
        const nameKey = row.account.trim().toLowerCase();
        let account = accountByName.get(nameKey);
        if (!account) {
          const color = nextAccountColor(
            [...accountByName.values()].map((item) => item.color),
          );
          if (local) {
            account = {
              id: crypto.randomUUID(),
              label: row.account.trim(),
              color,
              createdAt: new Date().toISOString(),
            };
            localStore.upsertAccount(account);
          } else {
            account = await supabaseStore.insertAccount({
              label: row.account.trim(),
              color,
            });
          }
          accountByName.set(nameKey, account);
        }
        const cacheKey = canonicalTicker(row.ticker);
        let meta = resolvedByTicker.get(cacheKey);
        if (!meta) {
          meta = await resolveCsvMeta(row);
          resolvedByTicker.set(cacheKey, meta);
          resolvedByTicker.set(canonicalTicker(meta.ticker), meta);
        }
        const holdingKey = `${account.id}:${canonicalTicker(meta.ticker)}`;
        const existing = holdingByKey.get(holdingKey);
        const boughtAt = toBoughtAt(row.boughtOn);
        const currency = meta.market === "kr" ? "KRW" : "USD";
        if (existing) {
          const changed =
            existing.name !== meta.name ||
            existing.market !== meta.market ||
            existing.kind !== meta.kind ||
            existing.ticker !== meta.ticker;
          if (changed) {
            if (local) {
              localStore.upsertHolding({
                ...existing,
                name: meta.name,
                ticker: meta.ticker,
                market: meta.market,
                kind: meta.kind,
                currency,
                updatedAt: new Date().toISOString(),
              });
            } else {
              await supabaseStore.patchHolding(existing.id, {
                name: meta.name,
                ticker: meta.ticker,
                market: meta.market,
                kind: meta.kind,
                currency,
              });
            }
          }
          if (local) {
            const next = localStore.addLot(existing.id, {
              buyPrice: row.buyPrice,
              qty: row.qty,
              boughtAt,
            });
            if (next) {
              holdingByKey.set(holdingKey, next);
            }
          } else {
            const next = await supabaseStore.addLot(existing.id, {
              buyPrice: row.buyPrice,
              qty: row.qty,
              boughtAt,
            });
            holdingByKey.set(holdingKey, next);
          }
          continue;
        }
        if (local) {
          const now = new Date().toISOString();
          const id = crypto.randomUUID();
          const holding = applyLotSummary({
            accountId: account.id,
            name: meta.name,
            ticker: meta.ticker,
            market: meta.market,
            kind: meta.kind,
            currency,
            id,
            lots: [
              {
                id: crypto.randomUUID(),
                holdingId: id,
                buyPrice: row.buyPrice,
                qty: row.qty,
                boughtAt,
                createdAt: now,
                updatedAt: now,
              },
            ],
            createdAt: now,
            updatedAt: now,
          });
          localStore.upsertHolding(holding);
          holdingByKey.set(holdingKey, holding);
        } else {
          const holding = await supabaseStore.insertHolding({
            accountId: account.id,
            name: meta.name,
            ticker: meta.ticker,
            market: meta.market,
            kind: meta.kind,
            buyPrice: row.buyPrice,
            qty: row.qty,
            currency,
            boughtAt,
            lots: [],
          });
          holdingByKey.set(holdingKey, holding);
        }
      }
      if (!local) {
        await reloadRemote();
      }
    },
    [accounts, holdings, local, reloadRemote],
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
      input: {
        buyPrice?: number;
        qty?: number;
        boughtAt?: string;
        name?: string;
        ticker?: string;
        market?: Holding["market"];
        kind?: Holding["kind"];
        currency?: Holding["currency"];
      },
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
    prevCloses,
    quotesAsOf,
    quotesRefreshing,
    quotesSettled,
    refreshToken,
    fx,
    charts,
    chartsLoading: chartPending > 0,
    histories,
    addAccount,
    updateAccount,
    removeAccount,
    importLots,
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

const PortfolioContext = createContext<ReturnType<typeof usePortfolioState> | null>(
  null,
);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const value = usePortfolioState();
  return createElement(PortfolioContext.Provider, { value }, children);
}

export function usePortfolio() {
  const value = useContext(PortfolioContext);
  if (!value) {
    throw new Error("usePortfolio must be used within PortfolioProvider");
  }
  return value;
}

export function useOptionalPortfolio() {
  return useContext(PortfolioContext);
}

export async function searchHoldings(query: string): Promise<SearchHit[]> {
  const response = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`);
  const data = (await response.json()) as { hits?: SearchHit[] };
  return data.hits ?? [];
}
