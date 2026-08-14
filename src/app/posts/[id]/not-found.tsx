import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-xl font-semibold">글을 찾을 수 없습니다</h1>
      <Link href="/" className="mt-4 text-sm underline">
        목록으로 돌아가기
      </Link>
    </main>
  );
}
