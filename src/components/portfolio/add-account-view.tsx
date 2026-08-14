"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppShell,
  Field,
  ScreenHeader,
  ScreenSkeleton,
} from "@/components/portfolio/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortfolio } from "@/lib/data/use-portfolio";
import { ACCOUNT_SUGGESTIONS } from "@/lib/money";

export function AddAccountView() {
  const router = useRouter();
  const { ready, addAccount } = usePortfolio();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const label = name.trim();
    if (!label) {
      return;
    }
    setPending(true);
    try {
      await addAccount(label);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가에 실패했습니다.");
      setPending(false);
    }
  }

  if (!ready) {
    return <ScreenSkeleton />;
  }

  return (
    <AppShell layout="form">
      <ScreenHeader title="계좌 추가" onClose={() => router.push("/")} />
      <Field label="증권사">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="삼성증권, 키움증권…"
        />
      </Field>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ACCOUNT_SUGGESTIONS.map((item) => (
          <Badge
            key={item}
            variant={name === item ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setName(item)}
          >
            {item}
          </Badge>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        추가한 계좌에 종목을 넣을 수 있습니다.
      </p>
      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        className="mt-5 w-full"
        onClick={() => void handleSave()}
        disabled={pending || !name.trim()}
      >
        {pending ? "추가 중..." : "추가"}
      </Button>
    </AppShell>
  );
}
