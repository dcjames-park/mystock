"use client";

import { Input } from "@/components/ui/input";
import { formatAmountInput, parseAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";

export function AmountInput({
  value,
  onChange,
  maxFraction = 0,
  suffix,
  className,
}: {
  value: string;
  onChange: (raw: string) => void;
  maxFraction?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className="relative">
      <Input
        type="text"
        inputMode={maxFraction > 0 ? "decimal" : "numeric"}
        value={formatAmountInput(value)}
        onChange={(event) => onChange(parseAmountInput(event.target.value, maxFraction))}
        className={cn(suffix ? "pr-12" : null, className)}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
