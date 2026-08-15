import { createClient } from "@/lib/supabase/client";
import { hydrateHolding, hydrateHoldings, summarizeLots } from "@/lib/data/lots";
import type { Account, AccountColor, Holding, HoldingLot, ValuationSnapshot } from "@/lib/data/types";
import type { AccountRow, HoldingLotRow, HoldingRow, SnapshotRow } from "@/lib/supabase/types";

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    createdAt: row.created_at,
  };
}

function mapLot(row: HoldingLotRow): HoldingLot {
  return {
    id: row.id,
    holdingId: row.holding_id,
    buyPrice: Number(row.buy_price),
    qty: Number(row.qty),
    boughtAt: row.bought_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHolding(row: HoldingRow, lots: HoldingLot[] = []): Holding {
  return hydrateHolding({
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    ticker: row.ticker,
    market: row.market,
    kind: row.kind,
    buyPrice: Number(row.buy_price),
    qty: Number(row.qty),
    currency: row.currency,
    boughtAt: row.bought_at,
    lots,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapSnapshot(row: SnapshotRow): ValuationSnapshot {
  return {
    id: row.id,
    capturedAt: row.captured_at,
    accountId: row.account_id,
    holdingId: row.holding_id,
    marketValue: Number(row.market_value),
    costValue: Number(row.cost_value),
  };
}

export async function loadPortfolio() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, accounts: [], holdings: [], snapshots: [] };
  }

  const [accountsRes, holdingsRes, lotsRes, snapshotsRes] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("holdings").select("*").order("created_at"),
    supabase.from("holding_lots").select("*").order("bought_at"),
    supabase.from("valuation_snapshots").select("*").order("captured_at"),
  ]);

  const lotsByHolding = new Map<string, HoldingLot[]>();
  if (!lotsRes.error) {
    for (const row of lotsRes.data ?? []) {
      const lot = mapLot(row);
      const list = lotsByHolding.get(lot.holdingId) ?? [];
      list.push(lot);
      lotsByHolding.set(lot.holdingId, list);
    }
  }

  return {
    user,
    accounts: (accountsRes.data ?? []).map(mapAccount),
    holdings: hydrateHoldings(
      (holdingsRes.data ?? []).map((row) => mapHolding(row, lotsByHolding.get(row.id) ?? [])),
    ),
    snapshots: (snapshotsRes.data ?? []).map(mapSnapshot),
  };
}

export async function insertAccount(input: {
  label: string;
  color: AccountColor;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }
  const { data, error } = await supabase
    .from("accounts")
    .insert({ user_id: user.id, label: input.label, color: input.color })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "계좌를 추가하지 못했습니다.");
  }
  return mapAccount(data);
}

export async function removeAccount(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function patchAccount(id: string, input: { label: string }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({ label: input.label })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "계좌를 수정하지 못했습니다.");
  }
  return mapAccount(data);
}

export async function insertHolding(input: Omit<Holding, "id" | "createdAt" | "updatedAt">) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }
  const { data, error } = await supabase
    .from("holdings")
    .insert({
      user_id: user.id,
      account_id: input.accountId,
      name: input.name,
      ticker: input.ticker,
      market: input.market,
      kind: input.kind,
      buy_price: input.buyPrice,
      qty: input.qty,
      currency: input.currency,
      bought_at: input.boughtAt,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "종목을 추가하지 못했습니다.");
  }
  const lot = await insertLotRow(user.id, data.id, {
    buyPrice: input.buyPrice,
    qty: input.qty,
    boughtAt: input.boughtAt,
  });
  return mapHolding(data, lot ? [lot] : []);
}

async function insertLotRow(
  userId: string,
  holdingId: string,
  input: { buyPrice: number; qty: number; boughtAt: string },
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("holding_lots")
    .insert({
      user_id: userId,
      holding_id: holdingId,
      buy_price: input.buyPrice,
      qty: input.qty,
      bought_at: input.boughtAt,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "매수 이력을 추가하지 못했습니다.");
  }
  return mapLot(data);
}

async function syncHoldingAggregates(holdingId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("holding_lots")
    .select("*")
    .eq("holding_id", holdingId);
  if (error) {
    throw new Error(error.message);
  }
  const lots = (data ?? []).map(mapLot);
  const summary = summarizeLots(lots);
  const { data: holding, error: patchError } = await supabase
    .from("holdings")
    .update({
      buy_price: summary.buyPrice,
      qty: summary.qty,
      bought_at: summary.boughtAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holdingId)
    .select("*")
    .single();
  if (patchError || !holding) {
    throw new Error(patchError?.message ?? "종목 합계를 갱신하지 못했습니다.");
  }
  return mapHolding(holding, lots);
}

export async function addLot(
  holdingId: string,
  input: { buyPrice: number; qty: number; boughtAt: string },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }
  await insertLotRow(user.id, holdingId, input);
  return syncHoldingAggregates(holdingId);
}

export async function updateLot(
  holdingId: string,
  lotId: string,
  input: { buyPrice: number; qty: number; boughtAt: string },
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("holding_lots")
    .update({
      buy_price: input.buyPrice,
      qty: input.qty,
      bought_at: input.boughtAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lotId)
    .eq("holding_id", holdingId);
  if (error) {
    throw new Error(error.message);
  }
  return syncHoldingAggregates(holdingId);
}

export async function removeLot(holdingId: string, lotId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("holding_lots").delete().eq("id", lotId).eq("holding_id", holdingId);
  if (error) {
    throw new Error(error.message);
  }
  const { data: remaining, error: remainingError } = await supabase
    .from("holding_lots")
    .select("id")
    .eq("holding_id", holdingId);
  if (remainingError) {
    throw new Error(remainingError.message);
  }
  if ((remaining ?? []).length === 0) {
    await removeHolding(holdingId);
    return { holding: null, removedHolding: true };
  }
  return { holding: await syncHoldingAggregates(holdingId), removedHolding: false };
}

export async function patchHolding(
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
) {
  const supabase = createClient();
  const payload: {
    buy_price?: number;
    qty?: number;
    bought_at?: string;
    name?: string;
    ticker?: string;
    market?: Holding["market"];
    kind?: Holding["kind"];
    currency?: Holding["currency"];
    updated_at: string;
  } = { updated_at: new Date().toISOString() };
  if (input.buyPrice !== undefined) {
    payload.buy_price = input.buyPrice;
  }
  if (input.qty !== undefined) {
    payload.qty = input.qty;
  }
  if (input.boughtAt !== undefined) {
    payload.bought_at = input.boughtAt;
  }
  if (input.name !== undefined) {
    payload.name = input.name;
  }
  if (input.ticker !== undefined) {
    payload.ticker = input.ticker;
  }
  if (input.market !== undefined) {
    payload.market = input.market;
  }
  if (input.kind !== undefined) {
    payload.kind = input.kind;
  }
  if (input.currency !== undefined) {
    payload.currency = input.currency;
  }
  const { data, error } = await supabase
    .from("holdings")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "종목을 수정하지 못했습니다.");
  }
  return mapHolding(data);
}

export async function removeHolding(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("holdings").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertDaySnapshot(input: {
  capturedAt: string;
  accountId: string | null;
  marketValue: number;
  costValue: number;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  let existing: { id: string } | null = null;
  if (input.accountId) {
    const { data } = await supabase
      .from("valuation_snapshots")
      .select("id")
      .eq("user_id", user.id)
      .eq("captured_at", input.capturedAt)
      .eq("account_id", input.accountId)
      .is("holding_id", null)
      .maybeSingle();
    existing = data;
  } else {
    const { data } = await supabase
      .from("valuation_snapshots")
      .select("id")
      .eq("user_id", user.id)
      .eq("captured_at", input.capturedAt)
      .is("account_id", null)
      .is("holding_id", null)
      .maybeSingle();
    existing = data;
  }

  if (existing?.id) {
    await supabase
      .from("valuation_snapshots")
      .update({
        market_value: input.marketValue,
        cost_value: input.costValue,
      })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("valuation_snapshots").insert({
    user_id: user.id,
    captured_at: input.capturedAt,
    account_id: input.accountId,
    holding_id: null,
    market_value: input.marketValue,
    cost_value: input.costValue,
  });
}
