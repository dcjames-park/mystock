"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Currency } from "@/lib/data/types";
import { formatDateKo, formatPct, formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

const CHART_PAD = { l: 52, r: 36, t: 10, b: 22 };
const MAX_AXIS_LABELS = 8;
const DOT_LIMIT = 24;

function axisIndexes(count: number, max = MAX_AXIS_LABELS) {
  if (count <= 0) {
    return [];
  }
  if (count <= max) {
    return Array.from({ length: count }, (_, i) => i);
  }
  const out: number[] = [];
  const step = (count - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) {
    out.push(Math.round(i * step));
  }
  return [...new Set(out)];
}

function linePath(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n === 0 || n !== ys.length) {
    return "";
  }
  const pt = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
  let d = `M${pt(xs[0], ys[0])}`;
  for (let i = 1; i < n; i += 1) {
    d += ` L${pt(xs[i], ys[i])}`;
  }
  return d;
}

function dateToX(
  date: string,
  start: number,
  end: number,
  padL: number,
  innerW: number,
) {
  const time = new Date(date).getTime();
  if (!Number.isFinite(time) || end === start) {
    return padL + innerW / 2;
  }
  const ratio = Math.min(1, Math.max(0, (time - start) / (end - start)));
  return padL + ratio * innerW;
}

function firstIndexOnOrAfter(dates: string[], startDate?: string) {
  if (!startDate) {
    return 0;
  }
  const index = dates.findIndex((date) => date >= startDate);
  return index < 0 ? dates.length : index;
}

function interpolateAtDate(dates: string[], values: number[], date: string) {
  if (dates.length === 0 || dates.length !== values.length) {
    return null;
  }
  if (date <= dates[0]) {
    return values[0];
  }
  const last = dates[dates.length - 1];
  if (date >= last) {
    return values[values.length - 1];
  }
  const idx = dates.findIndex((item) => item >= date);
  if (idx <= 0) {
    return values[0];
  }
  const t0 = new Date(dates[idx - 1]).getTime();
  const t1 = new Date(dates[idx]).getTime();
  const t = new Date(date).getTime();
  const ratio = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
  return values[idx - 1] * (1 - ratio) + values[idx] * ratio;
}

function rangeTime(startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate).getTime() : Number.NaN;
  const end = endDate ? new Date(endDate).getTime() : start;
  return {
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : Number.isFinite(start) ? start : 0,
  };
}

function formatSparkAxis(value: number, currency?: Currency) {
  if (currency === "USD") {
    const abs = Math.abs(value);
    const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 1 ? 2 : 4;
    return value.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  return Math.round(value).toLocaleString("ko-KR");
}

function svgPointX(event: MouseEvent<SVGSVGElement>, viewW: number) {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0) {
    return 0;
  }
  return ((event.clientX - rect.left) / rect.width) * viewW;
}

function nearestIndex(xs: number[], x: number, maxDist = 18) {
  let best = -1;
  let bestDist = maxDist;
  for (let i = 0; i < xs.length; i += 1) {
    const dist = Math.abs(xs[i] - x);
    if (dist <= bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}

function ChartTip({
  x,
  y,
  width,
  title,
  lines,
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  lines: { label: string; value: string; color?: string }[];
}) {
  const pct = Math.min(88, Math.max(12, (x / Math.max(width, 1)) * 100));
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[8.5rem] -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
      style={{ left: `${pct}%`, top: Math.max(y - 10, 8) }}
    >
      <p className="text-[11px] text-muted-foreground">{title}</p>
      {lines.map((line) => (
        <p key={line.label} className="mt-0.5 flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">{line.label}</span>
          <span className="font-medium tabular-nums" style={line.color ? { color: line.color } : undefined}>
            {line.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ComboChart({
  labels,
  dates,
  values,
  rates,
  buyEvents,
  rangeStart,
  rangeEnd,
  lineStartDate,
}: {
  labels: string[];
  dates: string[];
  values: number[];
  rates?: number[];
  buyEvents: { date: string; amount: number }[];
  rangeStart?: string;
  rangeEnd?: string;
  lineStartDate?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [active, setActive] = useState<number | null>(null);
  const height = 172;
  const pad = CHART_PAD;
  const innerW = Math.max(width - pad.l - pad.r, 1);
  const innerH = height - pad.t - pad.b;
  const count = Math.max(values.length, 1);
  const { start, end } = rangeTime(
    rangeStart ?? dates[0],
    rangeEnd ?? dates[dates.length - 1],
  );
  const lineFrom = firstIndexOnOrAfter(dates, lineStartDate);
  const visibleValues = values.slice(lineFrom);
  const scaleValues = visibleValues.length > 0 ? visibleValues : values;
  const vMin = Math.min(...scaleValues) * 0.94;
  const vMax = Math.max(...scaleValues, 1) * 1.03;
  const xAtIndex = (i: number) =>
    pad.l + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW);
  const xAtDate = (date: string) => dateToX(date, start, end, pad.l, innerW);
  const xAt = (i: number) => (dates[i] ? xAtDate(dates[i]) : xAtIndex(i));
  const yValue = (v: number) =>
    pad.t + innerH - ((v - vMin) / Math.max(vMax - vMin, 1)) * innerH;
  const rateValues = rates && rates.length === values.length ? rates : [];
  const visibleRates = rateValues.slice(lineFrom);
  const scaleRates = visibleRates.length > 0 ? visibleRates : rateValues;
  const rMin = scaleRates.length > 0 ? Math.min(...scaleRates, 0) : 0;
  const rMax = scaleRates.length > 0 ? Math.max(...scaleRates, 0) : 1;
  const yRate = (v: number) =>
    pad.t + innerH - ((v - rMin) / Math.max(rMax - rMin, 1)) * innerH;
  const rTicks = [rMin, (rMin + rMax) / 2, rMax];
  const xs = values.map((_, i) => xAt(i)).slice(lineFrom);
  const valueYs = values.slice(lineFrom).map((v) => yValue(v));
  const line = linePath(xs, valueYs);
  const area =
    xs.length === 0
      ? ""
      : `${line} L${xs[xs.length - 1].toFixed(1)},${(pad.t + innerH).toFixed(1)} L${xs[0].toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`;
  const rateLine = linePath(
    xs,
    visibleRates.map((v) => yRate(v)),
  );
  const buyBars = (() => {
    const merged = new Map<string, number>();
    for (const event of buyEvents) {
      if (event.amount <= 0) {
        continue;
      }
      merged.set(event.date, (merged.get(event.date) ?? 0) + event.amount);
    }
    const items = [...merged.entries()]
      .map(([date, amount]) => ({ date, amount, x: xAtDate(date) }))
      .sort((a, b) => a.x - b.x);
    let minDist = Number.POSITIVE_INFINITY;
    for (let i = 1; i < items.length; i += 1) {
      minDist = Math.min(minDist, items[i].x - items[i - 1].x);
    }
    const gap = 3;
    const maxBarW = 14;
    const barW = Math.min(
      maxBarW,
      Math.max(4, Number.isFinite(minDist) ? minDist - gap : maxBarW),
    );
    const minLeft = pad.l + barW / 2;
    const maxRight = width - pad.r - barW / 2;
    for (let i = 1; i < items.length; i += 1) {
      const next = items[i - 1].x + barW + gap;
      if (items[i].x < next) {
        items[i] = { ...items[i], x: next };
      }
    }
    if (items.length > 0 && items[items.length - 1].x > maxRight) {
      let shift = items[items.length - 1].x - maxRight;
      for (const item of items) {
        item.x -= shift;
      }
      if (items[0].x < minLeft) {
        shift = minLeft - items[0].x;
        for (const item of items) {
          item.x += shift;
        }
      }
    }
    return { items, barW };
  })();
  const bMax = Math.max(Math.max(...buyBars.items.map((item) => item.amount), 0), 1) * 1.2;
  const yBuy = (v: number) => pad.t + innerH - (v / bMax) * innerH;
  const vTicks = [vMin, (vMin + vMax) / 2, vMax];
  const bTicks = [0, bMax / 2, bMax];
  const dateKey = dates.join("|");

  useEffect(() => {
    setActive(null);
  }, [dateKey]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) {
        setWidth(next);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="relative w-full space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-[172px] w-full cursor-pointer"
        preserveAspectRatio="none"
        role="img"
        aria-label="평가 금액·수익률 추이와 매수 시점 금액"
        onClick={(event) => {
          const next = nearestIndex(xs, svgPointX(event, width));
          setActive((prev) => {
            if (next < 0) {
              return null;
            }
            const idx = lineFrom + next;
            return prev === idx ? null : idx;
          });
        }}
      >
        {vTicks.map((tick) => (
          <line
            key={`g-${tick}`}
            x1={pad.l}
            x2={width - pad.r}
            y1={yValue(tick)}
            y2={yValue(tick)}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        {buyBars.items.map((event) => (
          <rect
            key={`b-${event.date}`}
            x={event.x - buyBars.barW / 2}
            y={yBuy(event.amount)}
            width={buyBars.barW}
            height={Math.max(pad.t + innerH - yBuy(event.amount), 2)}
            fill="var(--muted-foreground)"
            fillOpacity={0.28}
            rx={2}
          />
        ))}
        {area ? (
          <path d={area} fill="var(--primary)" fillOpacity={0.12} />
        ) : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {rateLine ? (
          <path
            d={rateLine}
            fill="none"
            stroke="var(--chart-3)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 3"
          />
        ) : null}
        {values.slice(lineFrom).length <= DOT_LIMIT
          ? values.slice(lineFrom).map((v, i) => (
              <circle
                key={`p-${dates[lineFrom + i] ?? labels[lineFrom + i]}-${lineFrom + i}`}
                cx={xAt(lineFrom + i)}
                cy={yValue(v)}
                r={active === lineFrom + i ? 4 : 2.5}
                fill="var(--primary)"
              />
            ))
          : active != null && active >= lineFrom
            ? (
              <circle
                cx={xAt(active)}
                cy={yValue(values[active] ?? 0)}
                r={4}
                fill="var(--primary)"
              />
            )
            : null}
        {visibleRates.length <= DOT_LIMIT
          ? visibleRates.map((v, i) => (
              <circle
                key={`r-${dates[lineFrom + i] ?? labels[lineFrom + i]}-${lineFrom + i}`}
                cx={xAt(lineFrom + i)}
                cy={yRate(v)}
                r={active === lineFrom + i ? 4 : 2.5}
                fill="var(--chart-3)"
              />
            ))
          : active != null && active >= lineFrom && rateValues[active] != null
            ? (
              <circle
                cx={xAt(active)}
                cy={yRate(rateValues[active])}
                r={4}
                fill="var(--chart-3)"
              />
            )
            : null}
        {values.slice(lineFrom).map((_, i) => (
          <circle
            key={`hit-${lineFrom + i}`}
            cx={xAt(lineFrom + i)}
            cy={yValue(values[lineFrom + i] ?? 0)}
            r={12}
            fill="transparent"
            className="cursor-pointer"
          />
        ))}
        {vTicks.map((tick) => (
          <text
            key={`vl-${tick}`}
            x={pad.l - 4}
            y={yValue(tick) + 3}
            textAnchor="end"
            fill="var(--primary)"
            fontSize={9}
          >
            {Math.round(tick)}
          </text>
        ))}
        {rateValues.length > 0
          ? rTicks.map((tick) => (
              <text
                key={`rr-${tick}`}
                x={width - pad.r + 4}
                y={yRate(tick) + 3}
                textAnchor="start"
                fill="var(--chart-3)"
                fontSize={9}
              >
                {`${tick > 0 ? "+" : ""}${tick.toFixed(0)}%`}
              </text>
            ))
          : bTicks.map((tick) => (
              <text
                key={`br-${tick}`}
                x={width - pad.r + 4}
                y={yBuy(tick) + 3}
                textAnchor="start"
                fill="var(--muted-foreground)"
                fontSize={9}
              >
                {Math.round(tick)}
              </text>
            ))}
        {axisIndexes(labels.length).map((i) => (
          <text
            key={`x-${labels[i]}-${i}`}
            x={xAt(i)}
            y={height - 6}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize={9}
          >
            {labels[i]}
          </text>
        ))}
      </svg>
      {active != null && values[active] != null ? (
        <ChartTip
          x={xAt(active)}
          y={yValue(values[active])}
          width={width}
          title={dates[active] ? formatDateKo(dates[active]) : labels[active] ?? ""}
          lines={[
            {
              label: "평가",
              value: `${Math.round(values[active]).toLocaleString("ko-KR")}만`,
              color: "var(--primary)",
            },
            ...(rateValues[active] != null
              ? [
                  {
                    label: "수익률",
                    value: formatPct(rateValues[active]),
                    color: "var(--chart-3)",
                  },
                ]
              : []),
          ]}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-primary" />
          평가 금액 (좌, 만)
        </span>
        {rateValues.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <span className="h-px w-3 border-t-2 border-dashed border-[var(--chart-3)]" />
            수익률 (우, %)
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-muted-foreground/30" />
          매수 금액{rateValues.length > 0 ? "" : " (우, 만)"}
        </span>
      </div>
    </div>
  );
}

export function Sparkline({
  values,
  dates,
  labels,
  labelDates,
  rangeStart,
  rangeEnd,
  lineStartDate,
  markDate,
  positive,
  height = 52,
  markRatio = null,
  buyPrice,
  showLegend = false,
  currency,
}: {
  values: number[];
  dates?: string[];
  labels?: string[];
  labelDates?: string[];
  rangeStart?: string;
  rangeEnd?: string;
  lineStartDate?: string;
  markDate?: string;
  positive: boolean;
  height?: number;
  markRatio?: number | null;
  buyPrice?: number;
  showLegend?: boolean;
  currency?: Currency;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [active, setActive] = useState<number | null>(null);
  const valueKey = values.join("|");

  useEffect(() => {
    setActive(null);
  }, [valueKey]);

  useEffect(() => {
    if (!showLegend) {
      return;
    }
    const node = hostRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) {
        setWidth(next);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [showLegend]);

  if (values.length === 0) {
    return <div style={{ height }} />;
  }
  const color = positive ? "var(--gain)" : "var(--loss)";

  if (!showLegend) {
    const min = Math.min(...values, buyPrice ?? Infinity);
    const max = Math.max(...values, buyPrice ?? -Infinity);
    const span = Math.max(max - min, 1);
    const chartW = 320;
    const xAt = (i: number) =>
      values.length === 1 ? chartW / 2 : (i / (values.length - 1)) * chartW;
    const yAt = (v: number) => height - ((v - min) / span) * (height - 6) - 3;
    const line = values
      .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
      .join(" ");
    const area = `${line} L${xAt(values.length - 1).toFixed(1)},${height} L0,${height} Z`;
    const markX =
      markRatio == null ? null : Math.min(1, Math.max(0, markRatio)) * chartW;
    const markY =
      markX == null
        ? null
        : (() => {
            const pos = markRatio! * Math.max(values.length - 1, 0);
            const from = Math.floor(pos);
            const to = Math.min(from + 1, values.length - 1);
            const t = pos - from;
            const price =
              (values[from] ?? values[0]) * (1 - t) + (values[to] ?? values[from]) * t;
            return yAt(price);
          })();
    const buyY = buyPrice == null ? null : yAt(buyPrice);
    const xs = values.map((_, i) => xAt(i));
    return (
      <div className="relative h-full w-full">
        <svg
          viewBox={`0 0 ${chartW} ${height}`}
          className="h-full w-full cursor-pointer"
          preserveAspectRatio="none"
          onClick={(event) => {
            const next = nearestIndex(xs, svgPointX(event, chartW), 24);
            setActive((prev) => (next < 0 || prev === next ? null : next));
          }}
        >
          <path d={area} fill={color} opacity={0.12} />
          <path d={line} fill="none" stroke={color} strokeWidth={1.6} />
          {buyY != null ? (
            <line
              x1={0}
              x2={chartW}
              y1={buyY}
              y2={buyY}
              stroke="var(--foreground)"
              strokeOpacity={0.55}
              strokeWidth={2}
              strokeDasharray="3 2"
            />
          ) : null}
          {markX != null && markY != null ? (
            <>
              <line
                x1={markX}
                x2={markX}
                y1={2}
                y2={height - 2}
                stroke="var(--foreground)"
                strokeOpacity={0.55}
                strokeWidth={2}
                strokeDasharray="3 2"
              />
              <circle cx={markX} cy={markY} r={5} fill="var(--foreground)" />
            </>
          ) : null}
          {active != null ? (
            <circle cx={xAt(active)} cy={yAt(values[active] ?? 0)} r={4} fill={color} />
          ) : null}
        </svg>
        {active != null && values[active] != null ? (
          <ChartTip
            x={xAt(active)}
            y={yAt(values[active])}
            width={chartW}
            title={dates?.[active] ? formatDateKo(dates[active]) : "주가"}
            lines={[
              {
                label: "주가",
                value: currency
                  ? formatPrice(values[active], currency)
                  : formatSparkAxis(values[active], currency),
                color,
              },
            ]}
          />
        ) : null}
      </div>
    );
  }

  const alignedDates =
    dates && dates.length === values.length ? dates : undefined;
  const lineFrom = firstIndexOnOrAfter(alignedDates ?? [], lineStartDate);
  const scaleValues =
    alignedDates && lineStartDate ? values.slice(lineFrom) : values;
  const min = Math.min(
    ...(scaleValues.length > 0 ? scaleValues : values),
    buyPrice ?? Infinity,
  );
  const max = Math.max(
    ...(scaleValues.length > 0 ? scaleValues : values),
    buyPrice ?? -Infinity,
  );
  const span = Math.max(max - min, 1);
  const pad = CHART_PAD;
  const innerW = Math.max(width - pad.l - pad.r, 1);
  const innerH = height - pad.t - pad.b;
  const { start, end } = rangeTime(
    rangeStart ?? alignedDates?.[0],
    rangeEnd ?? alignedDates?.[alignedDates.length - 1],
  );
  const xAtIndex = (i: number) =>
    pad.l + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
  const xAtDate = (date: string) => dateToX(date, start, end, pad.l, innerW);
  const xAt = (i: number) =>
    alignedDates?.[i] ? xAtDate(alignedDates[i]) : xAtIndex(i);
  const yAt = (v: number) => pad.t + innerH - ((v - min) / span) * innerH;
  const visXs = values.map((_, i) => xAt(i)).slice(lineFrom);
  const visYs = values.slice(lineFrom).map((v) => yAt(v));
  const line = linePath(visXs, visYs);
  const area =
    visXs.length === 0
      ? ""
      : `${line} L${visXs[visXs.length - 1].toFixed(1)},${(pad.t + innerH).toFixed(1)} L${visXs[0].toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`;
  const axisLabels = labels ?? [];
  const axisLabelDates = labelDates ?? [];
  const inRange = (date: string) => {
    const first = rangeStart ?? alignedDates?.[0];
    const last = rangeEnd ?? alignedDates?.[alignedDates.length - 1];
    if (first && date < first) {
      return false;
    }
    if (last && date > last) {
      return false;
    }
    return true;
  };
  const resolvedMarkDate = markDate && inRange(markDate) ? markDate : null;
  const markX =
    resolvedMarkDate
      ? xAtDate(resolvedMarkDate)
      : markRatio == null
        ? null
        : pad.l + Math.min(1, Math.max(0, markRatio)) * innerW;
  const markY =
    markX == null
      ? null
      : resolvedMarkDate && alignedDates
        ? yAt(
            interpolateAtDate(alignedDates, values, resolvedMarkDate) ??
              values[lineFrom] ??
              values[0],
          )
        : (() => {
            const pos = markRatio! * Math.max(values.length - 1, 0);
            const from = Math.floor(pos);
            const to = Math.min(from + 1, values.length - 1);
            const t = pos - from;
            const price =
              (values[from] ?? values[0]) * (1 - t) + (values[to] ?? values[from]) * t;
            return yAt(price);
          })();
  const buyY = buyPrice == null ? null : yAt(buyPrice);
  const ticks = min === max ? [min] : [min, (min + max) / 2, max];
  const lineStartX =
    visXs[0] ??
    (lineStartDate && inRange(lineStartDate) ? xAtDate(lineStartDate) : pad.l);
  const visValues = values.slice(lineFrom);

  return (
    <div ref={hostRef} className="relative w-full space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full cursor-pointer"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label="주가 추세와 매수평균·매수일"
        onClick={(event) => {
          const next = nearestIndex(visXs, svgPointX(event, width));
          setActive((prev) => {
            if (next < 0) {
              return null;
            }
            const idx = lineFrom + next;
            return prev === idx ? null : idx;
          });
        }}
      >
        {ticks.map((tick, i) => (
          <line
            key={`g-${i}`}
            x1={pad.l}
            x2={width - pad.r}
            y1={yAt(tick)}
            y2={yAt(tick)}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        {area ? <path d={area} fill={color} opacity={0.12} /> : null}
        {line ? (
          <path d={line} fill="none" stroke={color} strokeWidth={1.6} />
        ) : null}
        {buyY != null ? (
          <line
            x1={lineStartX}
            x2={width - pad.r}
            y1={buyY}
            y2={buyY}
            stroke="var(--foreground)"
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeDasharray="3 2"
          />
        ) : null}
        {markX != null && markY != null ? (
          <>
            <line
              x1={markX}
              x2={markX}
              y1={pad.t}
              y2={pad.t + innerH}
              stroke="var(--foreground)"
              strokeOpacity={0.55}
              strokeWidth={2}
              strokeDasharray="3 2"
            />
            <circle cx={markX} cy={markY} r={5} fill="var(--foreground)" />
          </>
        ) : null}
        {visValues.length <= DOT_LIMIT
          ? visValues.map((v, i) => (
              <circle
                key={`sp-${lineFrom + i}`}
                cx={xAt(lineFrom + i)}
                cy={yAt(v)}
                r={active === lineFrom + i ? 4 : 2.5}
                fill={color}
              />
            ))
          : active != null && active >= lineFrom
            ? (
              <circle
                cx={xAt(active)}
                cy={yAt(values[active] ?? 0)}
                r={4}
                fill={color}
              />
            )
            : null}
        {visValues.map((_, i) => (
          <circle
            key={`hit-sp-${lineFrom + i}`}
            cx={xAt(lineFrom + i)}
            cy={yAt(values[lineFrom + i] ?? 0)}
            r={12}
            fill="transparent"
            className="cursor-pointer"
          />
        ))}
        {ticks.map((tick, i) => (
          <text
            key={`vl-${i}`}
            x={pad.l - 4}
            y={yAt(tick) + 3}
            textAnchor="end"
            fill={color}
            fontSize={9}
          >
            {formatSparkAxis(tick, currency)}
          </text>
        ))}
        {axisIndexes(axisLabels.length).map((i) => (
          <text
            key={`x-${axisLabels[i]}-${i}`}
            x={axisLabelDates[i] ? xAtDate(axisLabelDates[i]) : xAtIndex(i)}
            y={height - 6}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize={9}
          >
            {axisLabels[i]}
          </text>
        ))}
      </svg>
      {active != null && values[active] != null ? (
        <ChartTip
          x={xAt(active)}
          y={yAt(values[active])}
          width={width}
          title={alignedDates?.[active] ? formatDateKo(alignedDates[active]) : axisLabels[active] ?? "주가"}
          lines={[
            {
              label: "주가",
              value: currency
                ? formatPrice(values[active], currency)
                : formatSparkAxis(values[active], currency),
              color,
            },
          ]}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3" style={{ background: color }} />
          주가
        </span>
        {buyY != null ? (
          <span className="flex items-center gap-1.5">
            <span className="h-px w-3 border-t-2 border-dashed border-foreground/55" />
            매수평균
          </span>
        ) : null}
        {markX != null ? (
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-3 w-2.5 items-center justify-center">
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 border-l-2 border-dashed border-foreground/55" />
              <span className="relative size-1.5 rounded-full bg-foreground" />
            </span>
            매수일
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ChartSurface({
  period,
  loading = false,
  className,
  children,
}: {
  period: string;
  loading?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative min-h-[172px]", className)}>
      <div key={period} className="chart-enter">
        {children}
      </div>
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/55">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
}
