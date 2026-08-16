"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import {
  AppShell,
  FormPanel,
  OverlayCloseButton,
  ScreenHeader,
} from "@/components/portfolio/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUser } from "@/hooks/use-user";
import { CSV_EXAMPLE, parsePortfolioCsv, serializePortfolioCsv } from "@/lib/data/csv";
import { usePortfolio } from "@/lib/data/use-portfolio";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const { local, name, email } = useUser();
  const { theme, setTheme } = useTheme();
  const { accounts, holdings, importLots } = usePortfolio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPending, setImportPending] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const currentTheme = mounted && theme === "dark" ? "dark" : "light";

  function handleExport() {
    const csv = serializePortfolioCsv(accounts, holdings);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `folio-${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    setImportError(null);
    setImportMessage(null);
    setImportPending(true);
    try {
      const text = await file.text();
      const { rows, errors } = parsePortfolioCsv(text);
      if (errors.length > 0 && rows.length === 0) {
        setImportError(errors[0]);
        return;
      }
      if (rows.length === 0) {
        setImportError("가져올 행이 없습니다.");
        return;
      }
      await importLots(rows);
      setImportMessage(
        `${rows.length}건을 가져왔습니다.${errors.length > 0 ? ` 건너뛴 행 ${errors.length}건.` : ""}`,
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "가져오기에 실패했습니다.");
    } finally {
      setImportPending(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  return (
    <AppShell>
      <ScreenHeader title="설정" dismiss />
      <FormPanel className="flex flex-col gap-4">
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

        <Card>
          <CardHeader>
            <CardTitle>데이터 백업</CardTitle>
            <CardDescription>
              계좌와 매수 이력을 CSV로 보관하거나 다시 넣을 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleExport}>
                CSV 내보내기
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={importPending}
                onClick={() => fileRef.current?.click()}
              >
                {importPending ? "가져오는 중..." : "CSV 가져오기"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleImport(file);
                  }
                }}
              />
            </div>
            {importMessage ? (
              <p className="text-xs text-muted-foreground">{importMessage}</p>
            ) : null}
            {importError ? (
              <Alert variant="destructive">
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2 text-xs leading-5 text-muted-foreground">
              <p>첫 줄은 열 이름이어야 합니다. 시장·종류·종목명은 없어도 됩니다.</p>
              <p>필수 열은 계좌명, 티커, 매수가, 수량, 매수일입니다.</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>계좌명: 없으면 새로 만들고, 있으면 그 계좌에 넣습니다.</li>
                <li>같은 계좌·같은 티커면 매수 이력으로 추가합니다.</li>
                <li>종목명, 시장, 종류: 비워도 됩니다. 있어도 가져올 때 네이버·야후 값으로 바꿉니다.</li>
                <li>매수가, 수량: 0보다 큰 숫자. 해외는 달러, 국내는 원.</li>
                <li>매수일: YYYY-MM-DD</li>
              </ul>
              <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-[11px] text-foreground">
                {CSV_EXAMPLE}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>홈 화면에 추가</CardTitle>
            <CardDescription>
              브라우저 메뉴에서 홈 화면에 추가하면 아이콘으로 열 수 있습니다.
              주소창 없이 앱처럼 보입니다. 아이폰은 공유 → 홈 화면에 추가,
              안드로이드는 메뉴 → 앱 설치 또는 홈 화면에 추가입니다.
            </CardDescription>
          </CardHeader>
        </Card>

        {local ? null : (
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full">
              로그아웃
            </Button>
          </form>
        )}
        <OverlayCloseButton wide />
      </FormPanel>
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
