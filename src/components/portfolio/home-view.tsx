"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Plus, Settings, Trash2 } from "lucide-react";
import {
  AppShell,
  ACCOUNT_COLOR,
  pnlClass,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { FolioLogo } from "@/components/portfolio/logo";
import { ComboChart, Sparkline } from "@/components/portfolio/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePortfolio } from "@/lib/data/use-portfolio";
import { buildTrend, toDateInput } from "@/lib/data/trend";
import { useUser } from "@/hooks/use-user";
import type { Holding, Period, PricePoint } from "@/lib/data/types";
import {
  formatCompactWon,
  formatFxAsOf,
  formatFxRate,
  formatPct,
  formatPrice,
  formatWon,
  holdingToKrw,
  PERIODS,
  USD_KRW_PAGE,
} from "@/lib/money";
import { cn } from "@/lib/utils";

function sparkFor(
  item: Holding,
  period: Period,
  quotes: Record<string, number>,
  histories: Record<string, PricePoint[]>,
) {
  const series = histories[`${item.ticker}:${period}`];
  if (series && series.length > 0) {
    return {
      values: series.map((point) => point.close),
      markRatio: buyMarkRatio(series, toDateInput(item.boughtAt)),
    };
  }
  return {
    values: [item.buyPrice, quotes[item.ticker] ?? item.buyPrice],
    markRatio: 0,
  };
}

function buyMarkRatio(series: PricePoint[], buy: string) {
  if (series.length === 0) {
    return null;
  }
  const first = series[0].date;
  const last = series[series.length - 1].date;
  if (buy < first || buy > last) {
    return null;
  }
  if (series.length === 1) {
    return 0;
  }
  const index = series.findIndex((point) => point.date >= buy);
  if (index < 0) {
    return null;
  }
  return index / (series.length - 1);
}

export function HomeView() {
  const router = useRouter();
  const portfolio = usePortfolio();
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [period, setPeriod] = useState<Period>("1y");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const {
    ready,
    local,
    accounts,
    holdings,
    quotes,
    fx,
    histories,
    loadChart,
  } = portfolio;
  const { name, ready: userReady } = useUser();
  const activeIds = selectedIds ?? accounts.map((item) => item.id);
  const selected = new Set(activeIds);
  const allSelected =
    accounts.length > 0 && accounts.every((item) => selected.has(item.id));

  const rows = holdings.filter((item) => selected.has(item.accountId));
  const usdKrw = fx.usdKrw;

  const totals = rows.reduce(
    (acc, item) => {
      const krw = holdingToKrw(item, quotes[item.ticker] ?? item.buyPrice, usdKrw);
      acc.buy += krw.buy;
      acc.value += krw.value;
      return acc;
    },
    { buy: 0, value: 0 },
  );
  const rate =
    totals.buy === 0 ? 0 : ((totals.value - totals.buy) / totals.buy) * 100;
  const pnl = totals.value - totals.buy;
  const selectedAccounts = accounts.filter((item) => selected.has(item.id));
  const accountMeta = {
    label:
      selectedAccounts.length === 0
        ? "선택 없음"
        : allSelected
          ? "전체"
          : selectedAccounts.length === 1
            ? selectedAccounts[0].label
            : selectedAccounts.map((item) => item.label).join(" · "),
  };
  const showAccountMix = selectedAccounts.length !== 1;
  const krValue = rows
    .filter((item) => item.market === "kr")
    .reduce(
      (sum, item) =>
        sum + holdingToKrw(item, quotes[item.ticker] ?? item.buyPrice, usdKrw).value,
      0,
    );
  const usValue = totals.value - krValue;
  const grouped = accounts
    .filter((item) => selected.has(item.id))
    .map((broker) => {
      const items = rows.filter((row) => row.accountId === broker.id);
      const value = items.reduce(
        (sum, item) =>
          sum + holdingToKrw(item, quotes[item.ticker] ?? item.buyPrice, usdKrw).value,
        0,
      );
      const buy = items.reduce(
        (sum, item) =>
          sum + holdingToKrw(item, quotes[item.ticker] ?? item.buyPrice, usdKrw).buy,
        0,
      );
      const nextRate = buy === 0 ? 0 : ((value - buy) / buy) * 100;
      return { ...broker, items, value, buy, rate: nextRate };
    });

  const seriesByTicker = useMemo(() => {
    const next: Record<string, (typeof histories)[string]> = {};
    for (const item of holdings) {
      if (!selected.has(item.accountId)) {
        continue;
      }
      next[item.ticker] = histories[`${item.ticker}:${period}`] ?? [];
    }
    return next;
  }, [holdings, histories, period, selectedIds, accounts]);

  const trend = useMemo(
    () =>
      buildTrend({
        period,
        accountId: null,
        holdings: holdings.filter((item) => selected.has(item.accountId)),
        seriesByTicker,
        quotes,
        usdKrw,
      }),
    [holdings, period, quotes, selectedIds, seriesByTicker, usdKrw],
  );

  const tickerKey = rows.map((item) => item.ticker).join(",");

  useEffect(() => {
    if (!tickerKey) {
      return;
    }
    for (const ticker of tickerKey.split(",")) {
      void loadChart(ticker, period);
    }
  }, [loadChart, period, tickerKey]);

  if (!ready) {
    return <ScreenSkeleton />;
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5 sm:gap-6">
        <div className="flex items-center gap-2">
          <FolioLogo
            markSize={28}
            wordmarkClassName="text-lg sm:text-xl"
          />
          {local ? <Badge variant="secondary">로컬 스토리지</Badge> : null}
          <span className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-w-[50%] gap-1.5"
            onClick={() => router.push("/settings")}
          >
            <span className="truncate">{userReady ? name : "내 계정"}</span>
            <Settings />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={allSelected ? "default" : "outline"}
            className="rounded-full"
            onClick={() => {
              if (allSelected) {
                setSelectedIds([]);
              } else {
                setSelectedIds(accounts.map((item) => item.id));
              }
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: ACCOUNT_COLOR.blue }}
            />
            전체
          </Button>
          {accounts.map((item) => {
            const on = selected.has(item.id);
            return (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={on ? "default" : "outline"}
                className="rounded-full"
                onClick={() => {
                  const current = selectedIds ?? accounts.map((row) => row.id);
                  setSelectedIds(
                    current.includes(item.id)
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id],
                  );
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: ACCOUNT_COLOR[item.color] }}
                />
                {item.label}
              </Button>
            );
          })}
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="rounded-full"
            title="계좌 추가"
            onClick={() => router.push("/accounts/new")}
          >
            <Plus />
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>{accountMeta.label}</CardDescription>
              <CardAction>
                <span className="text-xs text-muted-foreground">오늘 기준</span>
              </CardAction>
              <CardTitle className="text-xs font-normal text-muted-foreground">
                총 평가 금액
              </CardTitle>
              <div className="flex flex-wrap items-end gap-2">
                <p className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                  {formatWon(totals.value)}
                </p>
                <p className={`text-sm font-semibold ${pnlClass(rate)}`}>
                  {formatPct(rate)}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <UsageBar
                label={showAccountMix ? "계좌 구성" : "시장 구성"}
                hint={
                  showAccountMix
                    ? `${grouped.length}개 증권사`
                    : `국내 ${Math.round((krValue / Math.max(totals.value, 1)) * 100)}%`
                }
                segments={
                  showAccountMix
                    ? grouped.map((group) => ({
                        id: group.id,
                        value: group.value,
                        color: ACCOUNT_COLOR[group.color],
                      }))
                    : [
                        { id: "kr", value: krValue, color: "var(--account-blue)" },
                        { id: "us", value: usValue, color: "var(--account-cyan)" },
                      ]
                }
              />
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat label="매수 금액" value={formatWon(totals.buy)} />
                <Stat
                  label="평가 손익"
                  value={formatWon(pnl)}
                  className={pnlClass(pnl)}
                />
                <Stat label="보유 종목" value={`${rows.length}개`} />
              </div>
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatFxRate(fx.usdKrw)}</span>
              <span className="min-w-0 truncate">
                {fx.fallback ? (
                  "환율 대기"
                ) : (
                  <>
                    <a
                      href={USD_KRW_PAGE}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      {fx.source} {fx.symbol}
                    </a>
                    {fx.asOf ? ` · ${formatFxAsOf(fx.asOf)}` : null}
                  </>
                )}
              </span>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>기간별 추이</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleGroup
                type="single"
                value={period}
                onValueChange={(value) => {
                  if (value) setPeriod(value as Period);
                }}
                variant="outline"
                size="sm"
                spacing={1}
                className="flex-wrap"
              >
                {PERIODS.map((item) => (
                  <ToggleGroupItem key={item.id} value={item.id}>
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <ComboChart
                labels={trend.map((item) => item.label)}
                values={trend.map((item) => item.value)}
                buys={trend.map((item) => item.buy)}
              />
              <p className="text-xs text-muted-foreground">
                보유 수량 × 과거 종가 · 매수일 이후만 반영 · 단위 만원
              </p>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-5">
          <div className="flex items-center">
            <h2 className="font-heading text-base font-medium sm:text-lg">
              보유 종목
            </h2>
            <span className="flex-1" />
            <Button size="sm" onClick={() => router.push("/holdings/new")}>
              <Plus data-icon="inline-start" />
              추가
            </Button>
          </div>
          {grouped.map((group) => {
            const open = !collapsed[group.id];
            return (
            <div key={group.id} className="space-y-1">
              <div
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5"
                style={{
                  background: `color-mix(in oklch, ${ACCOUNT_COLOR[group.color]} 16%, var(--background))`,
                }}
                onClick={() =>
                  setCollapsed((prev) => ({
                    ...prev,
                    [group.id]: !prev[group.id],
                  }))
                }
              >
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    open ? "rotate-0" : "-rotate-90",
                  )}
                />
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: ACCOUNT_COLOR[group.color] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                    계좌
                  </p>
                  <p className="truncate font-heading text-base font-semibold sm:text-lg">
                    {group.label}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {group.items.length}종목
                </p>
                <p
                  className={`shrink-0 whitespace-nowrap text-sm font-semibold sm:text-[15px] ${pnlClass(group.rate)}`}
                >
                  {formatPct(group.rate)}{" "}
                  <span className="font-medium text-foreground">
                    {formatCompactWon(group.value)}
                  </span>
                </p>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  title="계좌 삭제"
                  onClick={(event) => {
                    event.stopPropagation();
                    router.push(`/accounts/${group.id}/delete`);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              {open ? (
                group.items.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    이 계좌에 종목이 없습니다.
                  </p>
                ) : (
                  <div
                    className="ml-2 divide-y border-l-2 pl-3"
                    style={{ borderColor: ACCOUNT_COLOR[group.color] }}
                  >
                    {group.items.map((item) => (
                      <HoldingRow
                        key={item.id}
                        item={item}
                        period={period}
                        quotes={quotes}
                        histories={histories}
                        usdKrw={usdKrw}
                      />
                    ))}
                  </div>
                )
              ) : null}
            </div>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}

function HoldingRow({
  item,
  period,
  quotes,
  histories,
  usdKrw,
}: {
  item: Holding;
  period: Period;
  quotes: Record<string, number>;
  histories: Record<string, PricePoint[]>;
  usdKrw: number;
}) {
  const router = useRouter();
  const currentPrice = quotes[item.ticker] ?? item.buyPrice;
  const krw = holdingToKrw(item, currentPrice, usdKrw);
  const spark = sparkFor(item, period, quotes, histories);

  return (
    <div className="py-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.ticker}
            <span className="mx-1.5">·</span>
            {item.market === "kr" ? "국내" : "해외"}
          </p>
        </div>
        <div className="flex shrink-0">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            title="수정"
            onClick={() => router.push(`/holdings/${item.id}/edit`)}
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            title="삭제"
            onClick={() => router.push(`/holdings/${item.id}/delete`)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="수익률"
              value={formatPct(krw.rate)}
              className={pnlClass(krw.rate)}
              size="lg"
            />
            <Stat
              label="수익금액"
              value={formatWon(krw.pnl)}
              className={pnlClass(krw.pnl)}
              size="lg"
            />
            <Stat label="평가금액" value={formatWon(krw.value)} size="lg" />
          </div>
          <p className="mt-2 truncate text-[11px] text-muted-foreground">
            매입수 {item.qty.toLocaleString("ko-KR")}주
            <span className="mx-1.5">·</span>
            매입가 {formatPrice(item.buyPrice, item.currency)}
            <span className="mx-1.5">·</span>
            현재가 {formatPrice(currentPrice, item.currency)}
          </p>
        </div>
        <div className="h-12 w-32 shrink-0 sm:w-40 md:w-48">
          <Sparkline
            values={spark.values}
            positive={krw.rate >= 0}
            height={48}
            markRatio={spark.markRatio}
            buyPrice={item.buyPrice}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
  size = "sm",
}: {
  label: string;
  value: string;
  className?: string;
  size?: "sm" | "lg";
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-semibold tracking-tight",
          size === "lg" ? "text-base sm:text-lg" : "text-xs sm:text-sm",
          className,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function UsageBar({
  label,
  hint,
  segments,
}: {
  label: string;
  hint: string;
  segments: { id: string; value: number; color: string }[];
}) {
  const total = Math.max(
    segments.reduce((sum, item) => sum + item.value, 0),
    1,
  );
  return (
    <div>
      <div className="mb-1 flex text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="flex-1" />
        <span>{hint}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {segments.map((item) => (
          <span
            key={item.id}
            style={{
              width: `${(item.value / total) * 100}%`,
              background: item.color,
            }}
          />
        ))}
      </div>
    </div>
  );
}
