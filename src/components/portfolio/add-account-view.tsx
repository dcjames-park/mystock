"use client";

import { useState } from "react";
import {
  ACCOUNT_COLOR,
  AppShell,
  Field,
  ScreenHeader,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/lib/data/use-portfolio";
import {
  useOverlay,
  useOverlayFrame,
} from "@/components/portfolio/overlay-context";
import { cn } from "@/lib/utils";

function sameAccountName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function AddAccountView() {
  const overlay = useOverlay();
  const inOverlay = useOverlayFrame();
  const { ready, accounts, addAccount } = usePortfolio();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = name.trim();
  const duplicate = accounts.find((item) => sameAccountName(item.label, label));

  async function handleSave() {
    if (!label) {
      return;
    }
    if (duplicate) {
      setError("이미 등록된 계좌명입니다.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await addAccount(label);
      overlay.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가에 실패했습니다.");
      setPending(false);
    }
  }

  if (!ready) {
    return <ScreenSkeleton />;
  }

  return (
    <AppShell>
      <ScreenHeader title="계좌 추가" dismiss />
      <div
        className={cn(
          "grid gap-8",
          !inOverlay && "lg:grid-cols-2 lg:items-start",
        )}
      >
      <div>
      <Field label="계좌명">
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          placeholder="삼성증권, 키움증권…"
        />
      </Field>
      <p className="mt-4 text-xs text-muted-foreground">
        추가한 계좌에 종목을 넣을 수 있습니다.
      </p>
      {duplicate ? (
        <Alert className="mt-3">
          <AlertDescription>
            {duplicate.label}은(는) 이미 등록된 계좌입니다. 다른 계좌명을 입력해
            주세요.
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        className="mt-5 w-full lg:w-auto"
        onClick={() => void handleSave()}
        disabled={pending || !label || Boolean(duplicate)}
      >
        {pending ? "추가 중..." : "추가"}
      </Button>
      </div>
      {accounts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">등록된 계좌</p>
          <div className="space-y-1.5">
            {accounts.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{
                  background: `color-mix(in oklch, ${ACCOUNT_COLOR[item.color]} 16%, var(--background))`,
                }}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: ACCOUNT_COLOR[item.color] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                    계좌
                  </p>
                  <p className="truncate font-heading text-base font-semibold">
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      </div>
    </AppShell>
  );
}
