"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createPost(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!title || !content) {
    return { error: "제목과 내용을 입력해 주세요." };
  }

  if (title.length > 200) {
    return { error: "제목은 200자 이하로 입력해 주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const metadata = user.user_metadata as Record<string, unknown>;
  const authorName =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    user.email ||
    "익명";

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      title,
      content,
      author_name: authorName,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "글을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/");
  redirect(`/posts/${data.id}`);
}
