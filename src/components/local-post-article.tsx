"use client";

import Link from "next/link";
import { useLocalPost } from "@/lib/data/use-local-posts";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LocalPostArticle({ id }: { id: string }) {
  const post = useLocalPost(id);

  if (!post) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        글을 찾을 수 없습니다.{" "}
        <Link href="/" className="font-medium underline">
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <article>
      <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {post.author_name} · {formatDate(post.created_at)}
      </p>
      <div className="mt-6 whitespace-pre-wrap text-sm leading-7">
        {post.content}
      </div>
    </article>
  );
}
