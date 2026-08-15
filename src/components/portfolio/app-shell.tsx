"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, RefreshCw, Settings, X } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { FolioLogo } from "@/components/portfolio/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolio } from "@/lib/data/use-portfolio";
import { useUser } from "@/hooks/use-user";
import { formatQuoteAsOf } from "@/lib/money";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  layout = "page",
  header = true,
}: {
  children: ReactNode;
  layout?: "page" | "form";
  header?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <div
        className={cn(
          "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8",
          layout === "form" ? "py-6 sm:py-10" : "py-5 sm:py-8",
        )}
      >
        {header ? <AppHeader /> : null}
        {children}
      </div>
    </div>
  );
}

function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { local, name, email, ready } = useUser();
  const { quotesAsOf, quotesRefreshing, refreshQuotes } = usePortfolio();

  return (
    <header className="mb-5 flex h-10 items-center gap-2 sm:mb-6">
        <FolioLogo
          markSize={26}
          wordmarkClassName="text-base sm:text-lg"
          onClick={() => {
            if (pathname === "/") {
              window.location.assign("/");
              return;
            }
            router.push("/");
          }}
        />
        {local ? <Badge variant="secondary">로컬 스토리지</Badge> : null}
        <span className="flex-1" />
        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
          <span className="hidden text-xs sm:inline whitespace-nowrap">
            {formatQuoteAsOf(quotesAsOf)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            title="시세 새로고침"
            disabled={quotesRefreshing}
            onClick={() => void refreshQuotes()}
          >
            <RefreshCw className={cn(quotesRefreshing && "animate-spin")} />
          </Button>
        </div>
        <div className="flex min-w-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-w-[10rem] gap-1.5 text-muted-foreground sm:max-w-[14rem]"
            onClick={() => router.push("/settings")}
          >
            <span className="truncate">
              {ready ? (email ? email.split("@")[0] : name) || "내 계정" : "내 계정"}
            </span>
            <Settings />
          </Button>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              title="로그아웃"
            >
              <LogOut />
            </Button>
          </form>
        </div>
    </header>
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

export function FormPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("w-full max-w-xl", className)}>{children}</div>;
}

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
