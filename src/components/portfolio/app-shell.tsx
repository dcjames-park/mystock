"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, LogOut, Settings, X } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { FolioLogo } from "@/components/portfolio/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalPortfolio } from "@/lib/data/use-portfolio";
import { useUser } from "@/hooks/use-user";
import { formatPct, formatQuoteAsOf } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  useOptionalOverlay,
  useOverlayFrame,
} from "@/components/portfolio/overlay-context";

export function navigateBack(
  router: { back: () => void; push: (href: string) => void },
  fallback = "/",
) {
  const idx = window.history.state?.idx;
  if (typeof idx === "number") {
    if (idx > 0) {
      router.back();
      return;
    }
    router.push(fallback);
    return;
  }
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push(fallback);
}

export function AppShell({
  children,
  layout = "page",
  header = true,
}: {
  children: ReactNode;
  layout?: "page" | "form";
  header?: boolean;
}) {
  const inOverlay = useOverlayFrame();
  if (inOverlay) {
    return <div className="min-w-0">{children}</div>;
  }
  return (
    <div className="min-h-dvh bg-background">
      <div
        className={cn(
          "mx-auto w-full min-w-0 max-w-6xl overflow-x-clip px-4 sm:px-6 lg:px-8",
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
  const overlay = useOptionalOverlay();
  const { local, name, email, ready } = useUser();
  const quotesAsOf = useOptionalPortfolio()?.quotesAsOf ?? null;

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
        <span
          className="hidden shrink-0 text-xs text-muted-foreground sm:inline whitespace-nowrap"
          suppressHydrationWarning
        >
          {formatQuoteAsOf(quotesAsOf)}
        </span>
        <div className="flex min-w-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-w-[10rem] gap-1.5 text-muted-foreground sm:max-w-[14rem]"
            onClick={() => {
              if (overlay) {
                overlay.open({ m: "settings" });
                return;
              }
              router.push("/settings");
            }}
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

export function OverlayCloseButton({
  wide = false,
  className,
}: {
  wide?: boolean;
  className?: string;
}) {
  const overlay = useOptionalOverlay();
  const inOverlay = useOverlayFrame();
  if (!inOverlay || !overlay) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="secondary"
      size={wide ? "lg" : "sm"}
      className={cn(
        "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        wide && "h-11 w-full text-base",
        className,
      )}
      onClick={() => overlay.close()}
    >
      <X data-icon="inline-start" />
      닫기
    </Button>
  );
}

export function ScreenHeader({
  title,
  fallbackHref = "/",
  dismiss = false,
}: {
  title: string;
  fallbackHref?: string;
  dismiss?: boolean;
}) {
  const router = useRouter();
  const overlay = useOptionalOverlay();
  const inOverlay = useOverlayFrame();
  const closeOverlay = inOverlay && overlay && dismiss;
  return (
    <div className="mb-5 flex items-center gap-2">
      {closeOverlay ? null : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (inOverlay && overlay) {
              overlay.close();
              return;
            }
            navigateBack(router, fallbackHref);
          }}
          className="-ml-2 shrink-0 gap-0.5 px-2 text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          뒤로
        </Button>
      )}
      <p className="min-w-0 flex-1 truncate text-base font-medium">{title}</p>
      {closeOverlay ? <OverlayCloseButton /> : null}
    </div>
  );
}

export function DayChange({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        pnlClass(value),
        className,
      )}
    >
      {Icon ? <Icon className="size-3" /> : null}
      {formatPct(value)}
    </span>
  );
}

export function ScreenSkeleton() {
  const inOverlay = useOverlayFrame();
  const body = (
    <div className="space-y-4 pt-2">
      <Skeleton className="h-6 w-28" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
  if (inOverlay) {
    return body;
  }
  return <AppShell>{body}</AppShell>;
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
