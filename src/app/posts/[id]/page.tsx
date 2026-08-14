import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";

type PostDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post } = await supabase
    .from("posts")
    .select("id, title, content, author_name, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!post) {
    notFound();
  }

  return (
    <>
      <Header email={user?.email} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← 목록
        </Link>
        <article className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {post.author_name} · {formatDate(post.created_at)}
          </p>
          <div className="mt-6 whitespace-pre-wrap text-sm leading-7">
            {post.content}
          </div>
        </article>
      </main>
    </>
  );
}
