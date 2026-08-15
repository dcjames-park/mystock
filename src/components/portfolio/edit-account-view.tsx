"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AppShell,
  Field,
  FormPanel,
  ScreenHeader,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/lib/data/use-portfolio";

function sameAccountName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function EditAccountView() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { ready, accounts, updateAccount } = usePortfolio();
  const account = accounts.find((item) => item.id === params.id);
  const [name, setName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) {
    return <ScreenSkeleton />;
  }

  if (!account) {
    return (
      <AppShell>
        <ScreenHeader title="계좌 수정" onClose={() => router.push("/")} />
        <p className="text-sm text-muted-foreground">계좌를 찾을 수 없습니다.</p>
      </AppShell>
    );
  }

  const accountId = account.id;
  const label = (name ?? account.label).trim();
  const duplicate = accounts.find(
    (item) => item.id !== accountId && sameAccountName(item.label, label),
  );
  const unchanged = sameAccountName(label, account.label);

  async function handleSave() {
    if (!label || unchanged) {
      return;
    }
    if (duplicate) {
      setError("이미 등록된 계좌명입니다.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await updateAccount(accountId, label);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <AppShell>
      <ScreenHeader
        title="계좌 수정"
        onClose={() => router.push("/")}
        closeVariant="secondary"
      />
      <FormPanel>
        <Field label="계좌명">
          <Input
            value={name ?? account.label}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder="삼성증권, 키움증권…"
          />
        </Field>
        <p className="mt-4 text-xs text-muted-foreground">
          이름을 바꾸면 홈, 종목 상세, 필터 칩에 바로 반영됩니다. 들어 있는
          종목은 그대로입니다.
        </p>
        {duplicate ? (
          <Alert className="mt-3">
            <AlertDescription>
              {duplicate.label}은(는) 이미 등록된 계좌입니다. 다른 계좌명을
              입력해 주세요.
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
          disabled={pending || !label || unchanged || Boolean(duplicate)}
        >
          {pending ? "저장 중..." : "저장"}
        </Button>
      </FormPanel>
    </AppShell>
  );
}
