import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { isLocalBackend, LOCAL_USER } from "@/lib/data/backend";

type HeaderProps = {
  email?: string | null;
};

export function Header({ email }: HeaderProps) {
  const local = isLocalBackend();
  const label = local ? LOCAL_USER.email : email;

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="text-base font-semibold tracking-tight">
            게시판
          </Link>
          {local ? (
            <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-500 dark:border-zinc-700">
              로컬 스토리지
            </span>
          ) : null}
        </div>
        {label ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-sm text-zinc-500 sm:inline">
              {label}
            </span>
            <Link
              href="/posts/new"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              글쓰기
            </Link>
            {local ? null : (
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                >
                  로그아웃
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
