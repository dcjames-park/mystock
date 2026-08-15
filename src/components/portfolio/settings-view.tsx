"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import {
  AppShell,
  ScreenHeader,
} from "@/components/portfolio/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";

function subscribeClient() {
  return () => {};
}

export function SettingsView() {
  const router = useRouter();
  const { local, name, email } = useUser();
  const { theme, setTheme } = useTheme();
  const isClient = useSyncExternalStore(subscribeClient, () => true, () => false);
  const currentTheme = isClient && theme === "dark" ? "dark" : "light";

  return (
    <AppShell layout="form">
      <ScreenHeader title="설정" onClose={() => router.push("/")} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>계정</CardTitle>
            <CardDescription>
              {email || name}
              {name && email && name !== email ? ` · ${name}` : ""}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>화면 테마</CardTitle>
            <CardDescription>화이트 모드가 기본입니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <ThemeOption
              active={currentTheme === "light"}
              icon={<Sun className="size-4" />}
              label="화이트 모드"
              hint="기본"
              onClick={() => setTheme("light")}
            />
            <ThemeOption
              active={currentTheme === "dark"}
              icon={<Moon className="size-4" />}
              label="다크 모드"
              onClick={() => setTheme("dark")}
            />
          </CardContent>
        </Card>

        {local ? null : (
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full">
              로그아웃
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}

function ThemeOption({
  active,
  icon,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
        active
          ? "border-primary bg-accent text-accent-foreground"
          : "hover:bg-muted/70",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="font-medium">{label}</span>
        {hint ? (
          <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      {active ? (
        <span className="text-xs font-medium text-primary">사용 중</span>
      ) : null}
    </button>
  );
}
