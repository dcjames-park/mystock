import { Header } from "@/components/header";
import { PostForm } from "@/components/post-form";
import { isLocalBackend } from "@/lib/data/backend";
import { createClient } from "@/lib/supabase/server";

export default async function NewPostPage() {
  if (isLocalBackend()) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <h1 className="mb-4 text-xl font-semibold">글쓰기</h1>
          <PostForm />
        </main>
      </>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Header email={user?.email} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="mb-4 text-xl font-semibold">글쓰기</h1>
        <PostForm />
      </main>
    </>
  );
}
