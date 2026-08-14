import { createClient } from "@/lib/supabase/client";
import type { Account, AccountColor, Holding, ValuationSnapshot } from "@/lib/data/types";
import type { AccountRow, HoldingRow, SnapshotRow } from "@/lib/supabase/types";

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    createdAt: row.created_at,
  };
}

function mapHolding(row: HoldingRow): Holding {
  return {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

  const [accountsRes, holdingsRes, snapshotsRes] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("holdings").select("*").order("created_at"),
    supabase.from("valuation_snapshots").select("*").order("captured_at"),
  ]);

  return {
    user,
    accounts: (accountsRes.data ?? []).map(mapAccount),
    holdings: (holdingsRes.data ?? []).map(mapHolding),
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
  return mapHolding(data);
}

export async function patchHolding(
  id: string,
  input: { buyPrice: number; qty: number; boughtAt: string },
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("holdings")
    .update({
      buy_price: input.buyPrice,
      qty: input.qty,
      bought_at: input.boughtAt,
      updated_at: new Date().toISOString(),
    })
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
