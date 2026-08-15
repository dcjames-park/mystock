import type { ReactNode } from "react";
import { X } from "lucide-react";
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
  closeVariant = "outline",
}: {
  title: string;
  onClose: () => void;
  closeVariant?: "outline" | "secondary";
}) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <p className="min-w-0 flex-1 truncate text-base font-medium">{title}</p>
      <Button
        variant={closeVariant}
        size="sm"
        onClick={onClose}
        className={cn(
          "shrink-0 gap-1 px-2.5",
          closeVariant === "secondary" && "text-muted-foreground",
        )}
      >
        <X className="size-3.5" />
        닫기
      </Button>
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
  orange: "var(--account-orange)",
  rose: "var(--account-rose)",
  green: "var(--account-green)",
  amber: "var(--account-amber)",
  pink: "var(--account-pink)",
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
