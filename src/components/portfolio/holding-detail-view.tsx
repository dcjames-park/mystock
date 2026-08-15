"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  ACCOUNT_COLOR,
  AppShell,
  Field,
  pnlClass,
  ScreenHeader,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { ComboChart, Sparkline } from "@/components/portfolio/charts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PeriodPicker } from "@/components/portfolio/period-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { naverFinanceUrl, yahooFinanceUrl } from "@/lib/market/links";
import { sortLots } from "@/lib/data/lots";
import { usePortfolio } from "@/lib/data/use-portfolio";
import { buildBuyEvents, buildTrend, toDateInput } from "@/lib/data/trend";
import type { Currency, HoldingLot, Period, QuoteDetail } from "@/lib/data/types";
import {
  formatAsOfDate,
  formatCompactCount,
  formatDateKo,
  formatFxRate,
  formatPct,
  formatPrice,
  formatWon,
  holdingToKrw,
  toKrwAmount,
  USD_KRW_PAGE,
} from "@/lib/money";

function formatMaybeNumber(value: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatPercentValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  const ratio = value > 1 ? value : value * 100;
  return `${ratio.toFixed(2)}%`;
}

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

export function HoldingDetailView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const {
    ready,
    accounts,
    holdings,
    quotes,
    fx,
    histories,
    loadChart,
    refreshToken,
  } = usePortfolio();
  const holding = holdings.find((item) => item.id === params.id);
  const account = accounts.find((item) => item.id === holding?.accountId);
  const [period, setPeriod] = useState<Period>("1y");
  const [detail, setDetail] = useState<QuoteDetail | null>(null);
  const [naverUrl, setNaverUrl] = useState<string | null>(null);

  const currentPrice = holding
    ? (quotes[holding.ticker] ?? detail?.lastPrice ?? holding.buyPrice)
    : 0;
  const krw = holding
    ? holdingToKrw(holding, currentPrice, fx.usdKrw)
    : null;
  const series = holding ? (histories[`${holding.ticker}:${period}`] ?? []) : [];
  const daysHeld = holding
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(toDateInput(holding.boughtAt)).getTime()) /
            86_400_000,
        ),
      )
    : 0;

  const accountValue = holdings
    .filter((item) => item.accountId === holding?.accountId)
    .reduce(
      (sum, item) =>
        sum + holdingToKrw(item, quotes[item.ticker] ?? item.buyPrice, fx.usdKrw).value,
      0,
    );
  const weight =
    krw && accountValue > 0 ? (krw.value / accountValue) * 100 : 0;

  const trend = useMemo(() => {
    if (!holding) {
      return [];
    }
    return buildTrend({
      period,
      accountId: null,
      holdings: [holding],
      seriesByTicker: { [holding.ticker]: series },
      quotes,
      usdKrw: fx.usdKrw,
    });
  }, [fx.usdKrw, holding, period, quotes, series]);

  const buyEvents = useMemo(() => {
    if (!holding) {
      return [];
    }
    return buildBuyEvents(
      [holding],
      fx.usdKrw,
      trend[0]?.date,
      trend[trend.length - 1]?.date,
    );
  }, [fx.usdKrw, holding, trend]);

  useEffect(() => {
    if (!holding) {
      return;
    }
    void loadChart(holding.ticker, period);
  }, [holding, loadChart, period]);

  useEffect(() => {
    if (!holding) {
      return;
    }
    setNaverUrl(naverFinanceUrl(holding.ticker, holding.market, holding.kind));
    let cancelled = false;
    void fetch(
      `/api/market/naver?ticker=${encodeURIComponent(holding.ticker)}&market=${holding.market}&kind=${holding.kind}`,
    )
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { url?: string };
        if (!cancelled && data.url) {
          setNaverUrl(data.url);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [holding]);

  useEffect(() => {
    if (!holding) {
      return;
    }
    let cancelled = false;
    void fetch(
      `/api/market/quote?ticker=${encodeURIComponent(holding.ticker)}${
        refreshToken > 0 ? "&fresh=1" : ""
      }`,
    )
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { quote?: QuoteDetail };
        if (!cancelled && data.quote) {
          setDetail(data.quote);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [holding, refreshToken]);

  if (!ready) {
    return <ScreenSkeleton />;
  }

  if (!holding || !krw) {
    return (
      <AppShell>
        <ScreenHeader
          title="종목 상세"
          onClose={() => router.push("/")}
          closeVariant="secondary"
        />
        <p className="text-sm text-muted-foreground">종목을 찾을 수 없습니다.</p>
      </AppShell>
    );
  }

  const dayChange =
    detail?.previousClose && detail.previousClose > 0
      ? ((currentPrice - detail.previousClose) / detail.previousClose) * 100
      : null;
  const vs52High =
    detail?.week52High && detail.week52High > 0
      ? ((currentPrice / detail.week52High) * 100)
      : null;
  return (
    <AppShell>
      <ScreenHeader
        title="종목 상세"
        onClose={() => router.push("/")}
        closeVariant="secondary"
      />
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-heading text-xl font-semibold leading-7">{holding.name}</p>
              {account ? (
                <span
                  className="inline-flex max-w-full shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: `color-mix(in oklch, ${ACCOUNT_COLOR[account.color]} 18%, var(--background))`,
                    color: ACCOUNT_COLOR[account.color],
                  }}
                >
                  {account.label}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {holding.ticker}
              <span className="mx-1.5">·</span>
              {holding.market === "kr" ? "국내" : "해외"}
              <span className="mx-1.5">·</span>
              {holding.kind === "etf" ? "ETF" : "주식"}
              {detail?.exchange ? (
                <>
                  <span className="mx-1.5">·</span>
                  {detail.exchange}
                </>
              ) : null}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="border-[#03C75A]/30 bg-[#03C75A]/12 text-[#03C75A] hover:bg-[#03C75A]/20 hover:text-[#03C75A]"
                onClick={() =>
                  window.open(
                    naverUrl ?? naverFinanceUrl(holding.ticker, holding.market, holding.kind),
                    "_blank",
                    "noreferrer",
                  )
                }
              >
                네이버 증권
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="border-[#6001D2]/30 bg-[#6001D2]/12 text-[#6001D2] hover:bg-[#6001D2]/20 hover:text-[#6001D2] dark:border-[#9B6DFF]/35 dark:bg-[#9B6DFF]/15 dark:text-[#C4A6FF] dark:hover:bg-[#9B6DFF]/25 dark:hover:text-[#C4A6FF]"
                onClick={() =>
                  window.open(yahooFinanceUrl(holding.ticker), "_blank", "noreferrer")
                }
              >
                Yahoo Finance
              </Button>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="이름 수정"
              className="text-cyan-600 hover:bg-cyan-600/10 hover:text-cyan-600 dark:text-cyan-400 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-400"
              onClick={() => router.push(`/holdings/${holding.id}/edit`)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="destructive"
              title="종목 삭제"
              onClick={() => router.push(`/holdings/${holding.id}/delete`)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardDescription>{formatAsOfDate()}</CardDescription>
            <CardTitle className="text-xs font-normal text-muted-foreground">
              현재가
            </CardTitle>
            <div className="flex flex-wrap items-end gap-2">
              <p className="font-heading text-2xl font-semibold tracking-tight">
                {formatPrice(currentPrice, holding.currency)}
              </p>
              {dayChange != null ? (
                <p className={`text-sm font-semibold ${pnlClass(dayChange)}`}>
                  {formatPct(dayChange)}
                </p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="평가금액">
                <p className="font-semibold">{formatWon(krw.value)}</p>
              </Field>
              <Field label="수익금액">
                <p className={`font-semibold ${pnlClass(krw.pnl)}`}>{formatWon(krw.pnl)}</p>
              </Field>
              <Field label="수익률">
                <p className={`font-semibold ${pnlClass(krw.rate)}`}>{formatPct(krw.rate)}</p>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="계좌">
                <p className="font-medium">{account?.label ?? "-"}</p>
              </Field>
              <Field label="계좌 내 비중">
                <p className="font-medium">{weight.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  {account?.label ?? "해당 계좌"} 평가금액 대비
                </p>
              </Field>
              <Field label="첫 매수일">
                <p className="font-medium">{formatDateKo(holding.boughtAt)}</p>
              </Field>
              <Field label="보유 기간">
                <p className="font-medium">{daysHeld.toLocaleString("ko-KR")}일</p>
              </Field>
              <Field label="수량">
                <p className="font-medium">{holding.qty.toLocaleString("ko-KR")}</p>
              </Field>
              <Field label={holding.lots.length > 1 ? "평균 매수가" : "매수가"}>
                <p className="font-medium">{formatPrice(holding.buyPrice, holding.currency)}</p>
              </Field>
              <Field label="매수 금액">
                <p className="font-medium">{formatWon(krw.buy)}</p>
              </Field>
              <Field label="통화">
                <p className="font-medium">{holding.currency}</p>
              </Field>
              {holding.currency === "USD" ? (
                <Field label="적용 환율">
                  <a
                    href={USD_KRW_PAGE}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {formatFxRate(fx.usdKrw)}
                  </a>
                </Field>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>매수 이력</CardTitle>
            <CardAction>
              <Button
                type="button"
                size="sm"
                onClick={() => router.push(`/holdings/${holding.id}/buy`)}
              >
                <Plus data-icon="inline-start" />
                추가
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">매수일</TableHead>
                  <TableHead className="text-right">매수가</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead className="text-right">매수금액</TableHead>
                  <TableHead className="text-right">손익</TableHead>
                  <TableHead className="w-16 pr-3 text-right">
                    <span className="sr-only">관리</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortLots(holding.lots).map((item) => {
                  const lotKrw = lotToKrw(
                    item,
                    holding.currency,
                    currentPrice,
                    fx.usdKrw,
                  );
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="pl-4 font-medium">
                        {formatDateKo(item.boughtAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(item.buyPrice, holding.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.qty.toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(item.buyPrice * item.qty, holding.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <p className={`font-medium ${pnlClass(lotKrw.rate)}`}>
                          {formatPct(lotKrw.rate)}
                        </p>
                        <p className={`text-xs ${pnlClass(lotKrw.pnl)}`}>
                          {formatWon(lotKrw.pnl)}
                        </p>
                      </TableCell>
                      <TableCell className="pr-3">
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            title="수정"
                            className="text-cyan-600 hover:bg-cyan-600/10 hover:text-cyan-600 dark:text-cyan-400 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-400"
                            onClick={() =>
                              router.push(`/holdings/${holding.id}/lots/${item.id}/edit`)
                            }
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="destructive"
                            title="삭제"
                            onClick={() =>
                              router.push(`/holdings/${holding.id}/lots/${item.id}/delete`)
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {holding.lots.length > 1 ? (
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-4">합계</TableCell>
                    <TableCell className="text-right">
                      <span className="mr-1 text-xs font-normal text-muted-foreground">
                        평균
                      </span>
                      {formatPrice(holding.buyPrice, holding.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {holding.qty.toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPrice(holding.buyPrice * holding.qty, holding.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className={`font-medium ${pnlClass(krw.rate)}`}>
                        {formatPct(krw.rate)}
                      </p>
                      <p className={`text-xs ${pnlClass(krw.pnl)}`}>
                        {formatWon(krw.pnl)}
                      </p>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </CardContent>
        </Card>
        </div>

        <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>가격 추이</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PeriodPicker value={period} onChange={setPeriod} />
            <Sparkline
              values={series.map((item) => item.close)}
              positive={krw.rate >= 0}
              height={64}
              showLegend
              markRatio={
                series.length > 1
                  ? (() => {
                      const buy = toDateInput(holding.boughtAt);
                      const first = series[0]?.date;
                      const last = series[series.length - 1]?.date;
                      if (!first || !last || buy < first || buy > last) {
                        return null;
                      }
                      const index = series.findIndex((item) => item.date >= buy);
                      return index < 0 ? null : index / (series.length - 1);
                    })()
                  : null
              }
              buyPrice={holding.buyPrice}
            />
            <ComboChart
              labels={trend.map((item) => item.label)}
              dates={trend.map((item) => item.date)}
              values={trend.map((item) => item.value)}
              buyEvents={buyEvents}
            />
            <p className="text-xs text-muted-foreground">
              {period === "5y" ? "5년은 월봉" : period === "1m" ? "1개월은 일봉" : "주봉"}
              · 점선은 매수일/매수가 · 막대는 매수 금액(만원)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>시세 정보</CardTitle>
            <CardDescription>Yahoo Finance</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="전일 종가">
              <p className="font-medium">
                {detail?.previousClose != null
                  ? formatPrice(detail.previousClose, holding.currency)
                  : "-"}
              </p>
            </Field>
            <Field label="당일 고가">
              <p className="font-medium">
                {detail?.dayHigh != null
                  ? formatPrice(detail.dayHigh, holding.currency)
                  : "-"}
              </p>
            </Field>
            <Field label="당일 저가">
              <p className="font-medium">
                {detail?.dayLow != null
                  ? formatPrice(detail.dayLow, holding.currency)
                  : "-"}
              </p>
            </Field>
            <Field label="52주 최고">
              <p className="font-medium">
                {detail?.week52High != null
                  ? formatPrice(detail.week52High, holding.currency)
                  : "-"}
              </p>
            </Field>
            <Field label="52주 최저">
              <p className="font-medium">
                {detail?.week52Low != null
                  ? formatPrice(detail.week52Low, holding.currency)
                  : "-"}
              </p>
            </Field>
            <Field label="52주 고점 대비">
              <p className="font-medium">
                {vs52High != null ? `${vs52High.toFixed(1)}%` : "-"}
              </p>
            </Field>
            <Field label="거래량">
              <p className="font-medium">{formatCompactCount(detail?.volume ?? null)}</p>
            </Field>
            <Field label="평균 거래량">
              <p className="font-medium">
                {formatCompactCount(detail?.averageVolume ?? null)}
              </p>
            </Field>
            <Field label="시가총액">
              <p className="font-medium">
                {formatCompactCount(detail?.marketCap ?? null)}
              </p>
            </Field>
            <Field label="PER">
              <p className="font-medium">{formatMaybeNumber(detail?.pe ?? null)}</p>
            </Field>
            <Field label="Forward PER">
              <p className="font-medium">{formatMaybeNumber(detail?.forwardPe ?? null)}</p>
            </Field>
            <Field label="EPS">
              <p className="font-medium">{formatMaybeNumber(detail?.eps ?? null)}</p>
            </Field>
            <Field label="배당수익률">
              <p className="font-medium">{formatPercentValue(detail?.dividendYield ?? null)}</p>
            </Field>
            <Field label="베타">
              <p className="font-medium">{formatMaybeNumber(detail?.beta ?? null)}</p>
            </Field>
            <Field label="종목 유형">
              <p className="font-medium">{detail?.quoteType ?? holding.kind.toUpperCase()}</p>
            </Field>
          </CardContent>
        </Card>
        </div>
        </div>
      </div>
    </AppShell>
  );
}
