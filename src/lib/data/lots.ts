import type { Holding, HoldingLot } from "@/lib/data/types";

export function summarizeLots(lots: HoldingLot[]) {
  const qty = lots.reduce((sum, lot) => sum + lot.qty, 0);
  const cost = lots.reduce((sum, lot) => sum + lot.buyPrice * lot.qty, 0);
  const buyPrice = qty === 0 ? 0 : cost / qty;
  const boughtAt =
    [...lots].sort((a, b) => a.boughtAt.localeCompare(b.boughtAt))[0]?.boughtAt ??
    new Date().toISOString();
  return { qty, buyPrice, boughtAt };
}

export function applyLotSummary<T extends Omit<Holding, "qty" | "buyPrice" | "boughtAt"> & { lots: HoldingLot[] }>(
  holding: T,
): Holding {
  return {
    ...holding,
    ...summarizeLots(holding.lots),
  };
}

export function sortLots(lots: HoldingLot[]) {
  return [...lots].sort((a, b) => {
    const byDate = a.boughtAt.localeCompare(b.boughtAt);
    if (byDate !== 0) {
      return byDate;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function hydrateHolding(raw: Holding): Holding {
  const lots =
    Array.isArray(raw.lots) && raw.lots.length > 0
      ? raw.lots.map((lot) => ({
          ...lot,
          holdingId: lot.holdingId || raw.id,
          buyPrice: Number(lot.buyPrice),
          qty: Number(lot.qty),
        }))
      : [
          {
            id: `${raw.id}-lot`,
            holdingId: raw.id,
            buyPrice: Number(raw.buyPrice),
            qty: Number(raw.qty),
            boughtAt: raw.boughtAt,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
          },
        ];
  return applyLotSummary({
    ...raw,
    lots: sortLots(lots),
  });
}

export function hydrateHoldings(raw: Holding[]) {
  return raw.map((item) => hydrateHolding(item));
}

export function qtyOnDate(holding: Holding, date: string) {
  return holding.lots
    .filter((lot) => lot.boughtAt.slice(0, 10) <= date)
    .reduce((sum, lot) => sum + lot.qty, 0);
}
