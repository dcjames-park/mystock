"use client";

import { Button } from "@/components/ui/button";
import type { Period } from "@/lib/data/types";
import { PERIODS } from "@/lib/money";

export function PeriodPicker({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PERIODS.map((item) => {
        const on = value === item.id;
        return (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={on ? "default" : "outline"}
            className="rounded-full px-3"
            aria-pressed={on}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}
