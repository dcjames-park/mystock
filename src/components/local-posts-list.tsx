"use client";

import Link from "next/link";
import { useLocalPosts } from "@/lib/data/use-local-posts";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LocalPostsList() {
  const posts = useLocalPosts();

  if (posts.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        아직 글이 없습니다. 이 환경은 브라우저 저장소를 사용합니다.{" "}
        <Link href="/posts/new" className="font-medium underline">
          첫 글을 작성
        </Link>
        해 보세요.
      </div>
    );
  }

  return (
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
  );
}
