import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  layout = "page",
}: {
  children: ReactNode;
  layout?: "page" | "form";
}) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="h-1 bg-primary" />
      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6 lg:px-8",
          layout === "form" ? "max-w-xl py-6 sm:py-10" : "max-w-6xl py-5 sm:py-8",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ScreenHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Button variant="ghost" size="sm" onClick={onClose} className="px-2">
        닫기
      </Button>
      <p className="text-base font-medium">{title}</p>
    </div>
  );
}

export function ScreenSkeleton() {
  return (
    <AppShell>
      <div className="space-y-4 pt-4">
        <Skeleton className="h-6 w-28" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </AppShell>
  );
}

export function pnlClass(value: number) {
  return value >= 0 ? "text-gain" : "text-loss";
}

export const ACCOUNT_COLOR: Record<string, string> = {
  blue: "var(--account-blue)",
  cyan: "var(--account-cyan)",
  purple: "var(--account-purple)",
};

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
