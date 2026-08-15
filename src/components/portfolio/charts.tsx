"use client";

import { useEffect, useRef, useState } from "react";

export function ComboChart({
  labels,
  dates,
  values,
  buyEvents,
}: {
  labels: string[];
  dates: string[];
  values: number[];
  buyEvents: { date: string; amount: number }[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const height = 172;
  const pad = { l: 32, r: 28, t: 10, b: 22 };
  const innerW = Math.max(width - pad.l - pad.r, 1);
  const innerH = height - pad.t - pad.b;
  const count = Math.max(values.length, 1);
  const vMin = Math.min(...values, 0) * 0.94;
  const vMax = Math.max(...values, 1) * 1.03;
  const start = dates[0] ? new Date(dates[0]).getTime() : 0;
  const end = dates[dates.length - 1]
    ? new Date(dates[dates.length - 1]).getTime()
    : start;
  const xAtIndex = (i: number) =>
    pad.l + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW);
  const xAtDate = (date: string) => {
    const time = new Date(date).getTime();
    if (!Number.isFinite(time) || end === start) {
      return pad.l + innerW / 2;
    }
    const ratio = Math.min(1, Math.max(0, (time - start) / (end - start)));
    return pad.l + ratio * innerW;
  };
  const xAt = (i: number) => (dates[i] ? xAtDate(dates[i]) : xAtIndex(i));
  const yValue = (v: number) =>
    pad.t + innerH - ((v - vMin) / Math.max(vMax - vMin, 1)) * innerH;
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
  const line = values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yValue(v).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${xAt(count - 1).toFixed(1)},${pad.t + innerH} L${xAt(0).toFixed(1)},${pad.t + innerH} Z`;
  const vTicks = [vMin, (vMin + vMax) / 2, vMax];
  const bTicks = [0, bMax / 2, bMax];

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
    <div ref={hostRef} className="w-full space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-[172px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="평가 금액 추이와 매수 시점 금액"
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
        <path d={area} fill="var(--primary)" fillOpacity={0.12} />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2} />
        {values.map((v, i) => (
          <circle
            key={`p-${dates[i] ?? labels[i]}-${i}`}
            cx={xAt(i)}
            cy={yValue(v)}
            r={2.5}
            fill="var(--primary)"
          />
        ))}
        {vTicks.map((tick) => (
          <text
            key={`vl-${tick}`}
            x={pad.l - 4}
            y={yValue(tick) + 3}
            textAnchor="end"
            fill="var(--muted-foreground)"
            fontSize={9}
          >
            {Math.round(tick)}
          </text>
        ))}
        {bTicks.map((tick) => (
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
        {labels.map((label, i) => (
          <text
            key={`x-${label}-${i}`}
            x={xAt(i)}
            y={height - 6}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize={9}
          >
            {label}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-3.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-primary" />
          평가 금액 (좌, 만)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-muted-foreground/30" />
          매수 금액 (우, 만)
        </span>
      </div>
    </div>
  );
}

export function Sparkline({
  values,
  positive,
  height = 52,
  markRatio = null,
  buyPrice,
}: {
  values: number[];
  positive: boolean;
  height?: number;
  markRatio?: number | null;
  buyPrice?: number;
}) {
  if (values.length === 0) {
    return <div style={{ height }} />;
  }
  const width = 320;
  const min = Math.min(...values, buyPrice ?? Infinity);
  const max = Math.max(...values, buyPrice ?? -Infinity);
  const span = Math.max(max - min, 1);
  const xAt = (i: number) =>
    values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
  const yAt = (v: number) => height - ((v - min) / span) * (height - 6) - 3;
  const line = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${xAt(values.length - 1).toFixed(1)},${height} L0,${height} Z`;
  const color = positive ? "var(--gain)" : "var(--loss)";
  const markX =
    markRatio == null ? null : Math.min(1, Math.max(0, markRatio)) * width;
  const markY =
    markX == null
      ? null
      : (() => {
          const pos = markRatio! * Math.max(values.length - 1, 0);
          const from = Math.floor(pos);
          const to = Math.min(from + 1, values.length - 1);
          const t = pos - from;
          const price = (values[from] ?? values[0]) * (1 - t) + (values[to] ?? values[from]) * t;
          return yAt(price);
        })();
  const buyY = buyPrice == null ? null : yAt(buyPrice);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="none"
    >
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} />
      {buyY != null ? (
        <line
          x1={0}
          x2={width}
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
          <circle
            cx={markX}
            cy={markY}
            r={5}
            fill="var(--foreground)"
          />
        </>
      ) : null}
    </svg>
  );
}
