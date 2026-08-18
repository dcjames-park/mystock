"use client";

import { formatWon } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MixSlice } from "@/lib/data/dashboard";

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const from = polar(cx, cy, r, start);
  const to = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${r} ${r} 0 ${large} 1 ${to.x} ${to.y} Z`;
}

export function DonutChart({
  slices,
  total,
}: {
  slices: MixSlice[];
  total: number;
}) {
  const visible = slices.filter((item) => item.value > 0);
  const size = 148;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  let cursor = 0;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-28 shrink-0 sm:size-32">
        {visible.length === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="var(--muted)" />
        ) : visible.length === 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={visible[0].color} />
        ) : (
          visible.map((slice) => {
            const deg = (slice.value / Math.max(total, 1)) * 360;
            const start = cursor;
            const end = cursor + deg;
            cursor = end;
            return (
              <path
                key={slice.id}
                d={arcPath(cx, cy, r, start, end)}
                fill={slice.color}
              />
            );
          })
        )}
        <circle cx={cx} cy={cy} r={34} fill="var(--card)" />
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {visible.map((slice) => {
          const pct = total === 0 ? 0 : (slice.value / total) * 100;
          return (
            <li key={slice.id} className="flex items-center gap-2 text-xs">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: slice.color }}
              />
              <span className="min-w-0 flex-1 truncate">{slice.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function HBarChart({
  items,
}: {
  items: { id: string; label: string; value: number; color?: string }[];
}) {
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 1);
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const width = `${(Math.abs(item.value) / max) * 100}%`;
        const positive = item.value >= 0;
        return (
          <div key={item.id} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2">
            <p className="truncate text-xs">{item.label}</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full"
                style={{
                  width,
                  background:
                    item.color ?? (positive ? "var(--gain)" : "var(--loss)"),
                }}
              />
            </div>
            <p
              className={cn(
                "w-[5.5rem] text-right text-[11px] tabular-nums",
                item.color ? "text-foreground" : positive ? "text-gain" : "text-loss",
              )}
            >
              {formatWon(item.value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function Histogram({
  items,
}: {
  items: { id: string; label: string; count: number }[];
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="flex h-36 items-end gap-1.5">
      {items.map((item) => (
        <div key={item.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <p className="text-[10px] tabular-nums text-muted-foreground">{item.count}</p>
          <div className="flex h-24 w-full items-end rounded-sm bg-muted/60">
            <span
              className="w-full rounded-sm bg-chart-1"
              style={{ height: `${(item.count / max) * 100}%` }}
            />
          </div>
          <p className="w-full truncate text-center text-[10px] text-muted-foreground">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}
