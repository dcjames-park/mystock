import Link from "next/link";
import { Header } from "@/components/header";
import { LocalPostsList } from "@/components/local-posts-list";
import { isLocalBackend } from "@/lib/data/backend";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function HomePage() {
  if (isLocalBackend()) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <h1 className="mb-4 text-xl font-semibold">글 목록</h1>
          <LocalPostsList />
        </main>
      </>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, title, author_name, created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <Header email={user?.email} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="mb-4 text-xl font-semibold">글 목록</h1>
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            글을 불러오지 못했습니다. Supabase 테이블과 RLS 정책을 확인해 주세요.
          </p>
        ) : !posts || posts.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
            아직 글이 없습니다.{" "}
            <Link href="/posts/new" className="font-medium underline">
              첫 글을 작성
            </Link>
            해 보세요.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/posts/${post.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <p className="font-medium">{post.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {post.author_name} · {formatDate(post.created_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
