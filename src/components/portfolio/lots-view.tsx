"use client";

import { useMemo, useState } from "react";
import {
  ACCOUNT_COLOR,
  AppShell,
  OverlayCloseButton,
  pnlClass,
  ScreenHeader,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePortfolio } from "@/lib/data/use-portfolio";
import type { Account, Currency, Holding, HoldingLot, Market } from "@/lib/data/types";
import {
  formatDateKo,
  formatPct,
  formatPrice,
  formatWon,
  toKrwAmount,
} from "@/lib/money";
import { cn } from "@/lib/utils";

function lotToKrw(
  lot: Pick<HoldingLot, "buyPrice" | "qty">,
  currency: Currency,
  lastPrice: number,
  usdKrw: number,
) {
  const buy = toKrwAmount(lot.buyPrice * lot.qty, currency, usdKrw);
  const value = toKrwAmount(lastPrice * lot.qty, currency, usdKrw);
  const pnl = value - buy;
  const rate = buy === 0 ? 0 : (pnl / buy) * 100;
  return { buy, value, pnl, rate };
}

function formatDateCompact(value: string) {
  const full = formatDateKo(value);
  return full.length >= 10 ? full.slice(2) : full;
}

type LotRow = {
  lot: HoldingLot;
  holding: Holding;
  account?: Account;
};

type MarketFilter = "all" | Market;

const MARKET_FILTERS: { id: MarketFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "kr", label: "국내" },
  { id: "us", label: "해외" },
];

export function LotsView() {
  const { ready, accounts, holdings, quotes, fx } = usePortfolio();
  const [accountId, setAccountId] = useState("all");
  const [market, setMarket] = useState<MarketFilter>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo<LotRow[]>(() => {
    const accountById = new Map(accounts.map((item) => [item.id, item]));
    const needle = query.trim().toLowerCase();
    return holdings
      .flatMap((holding) =>
        holding.lots.map((lot) => ({
          lot,
          holding,
          account: accountById.get(holding.accountId),
        })),
      )
      .filter((row) => {
        if (accountId !== "all" && row.holding.accountId !== accountId) {
          return false;
        }
        if (market !== "all" && row.holding.market !== market) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return (
          row.holding.name.toLowerCase().includes(needle) ||
          row.holding.ticker.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        const byDate = b.lot.boughtAt.localeCompare(a.lot.boughtAt);
        if (byDate !== 0) {
          return byDate;
        }
        return b.lot.createdAt.localeCompare(a.lot.createdAt);
      });
  }, [accountId, accounts, holdings, market, query]);

  const totalCount = useMemo(
    () => holdings.reduce((sum, item) => sum + item.lots.length, 0),
    [holdings],
  );

  const totalBuy = rows.reduce(
    (sum, row) =>
      sum +
      toKrwAmount(
        row.lot.buyPrice * row.lot.qty,
        row.holding.currency,
        fx.usdKrw,
      ),
    0,
  );

  const filtered = rows.length !== totalCount;

  if (!ready) {
    return <ScreenSkeleton />;
  }

  return (
    <AppShell>
      <ScreenHeader title="매수 이력" dismiss />
      <Card>
        <CardHeader>
          <CardTitle>전체 매수</CardTitle>
          <CardDescription>
            매수일 최신순 · {filtered ? `${rows.length} / ${totalCount}` : totalCount}건
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-0">
          <div className="space-y-2 px-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="종목명, 티커"
              aria-label="종목 검색"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="min-w-0 flex-1 sm:max-w-52">
                  <SelectValue placeholder="계좌" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 계좌</SelectItem>
                  {accounts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex shrink-0 gap-1">
                {MARKET_FILTERS.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={market === item.id ? "default" : "outline"}
                    className="rounded-full px-3"
                    aria-pressed={market === item.id}
                    onClick={() => setMarket(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          {totalCount === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              아직 매수 이력이 없습니다. 계좌에서 종목을 추가하면 여기에 모입니다.
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              조건에 맞는 매수 이력이 없습니다.
            </p>
          ) : (
            <>
              <Table
                className="w-full min-w-0 table-fixed text-xs sm:table-auto sm:text-sm"
                containerClassName="overflow-x-clip"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[4.5rem] pl-3 sm:w-auto sm:pl-4">
                      매수일
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">계좌</TableHead>
                    <TableHead>종목</TableHead>
                    <TableHead className="w-[4.75rem] text-right sm:hidden">
                      매수
                    </TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      매수가
                    </TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      수량
                    </TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      매수금액
                    </TableHead>
                    <TableHead className="w-[4.5rem] pr-3 text-right sm:w-auto sm:pr-4">
                      손익
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const currentPrice =
                      quotes[row.holding.ticker] ?? row.holding.buyPrice;
                    const lotKrw = lotToKrw(
                      row.lot,
                      row.holding.currency,
                      currentPrice,
                      fx.usdKrw,
                    );
                    return (
                      <TableRow key={`${row.holding.id}-${row.lot.id}`}>
                        <TableCell className="pl-3 font-medium sm:pl-4">
                          <span className="sm:hidden">
                            {formatDateCompact(row.lot.boughtAt)}
                          </span>
                          <span className="hidden sm:inline">
                            {formatDateKo(row.lot.boughtAt)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {row.account ? (
                            <span className="inline-flex max-w-[8rem] items-center gap-1.5">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{
                                  background: ACCOUNT_COLOR[row.account.color],
                                }}
                              />
                              <span className="truncate">{row.account.label}</span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="min-w-0 whitespace-normal">
                          <p className="truncate font-medium">{row.holding.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {row.holding.ticker}
                            {row.account ? (
                              <span className="sm:hidden">
                                {" · "}
                                {row.account.label}
                              </span>
                            ) : null}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-normal text-right sm:hidden">
                          <p>{formatPrice(row.lot.buyPrice, row.holding.currency)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {row.lot.qty.toLocaleString("ko-KR")}주
                          </p>
                        </TableCell>
                        <TableCell className="hidden text-right sm:table-cell">
                          {formatPrice(row.lot.buyPrice, row.holding.currency)}
                        </TableCell>
                        <TableCell className="hidden text-right sm:table-cell">
                          {row.lot.qty.toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="hidden text-right sm:table-cell">
                          {formatPrice(
                            row.lot.buyPrice * row.lot.qty,
                            row.holding.currency,
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal pr-3 text-right sm:pr-4">
                          <p className={cn("font-medium", pnlClass(lotKrw.rate))}>
                            {formatPct(lotKrw.rate)}
                          </p>
                          <p className={cn("text-[11px] sm:text-xs", pnlClass(lotKrw.pnl))}>
                            {formatWon(lotKrw.pnl)}
                          </p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  합계 {rows.length}건
                </span>
                <span className="font-medium">{formatWon(totalBuy)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <OverlayCloseButton wide className="mt-6" />
    </AppShell>
  );
}
