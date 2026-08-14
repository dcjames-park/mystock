"use client";

import { useActionState } from "react";
import { createPost } from "@/app/actions/posts";

type FormState = {
  error: string | null;
};

const initialState: FormState = { error: null };

export function PostForm() {
  async function submit(_prev: FormState, formData: FormData): Promise<FormState> {
    const result = await createPost(formData);
    if (result?.error) {
      return { error: result.error };
    }
    return { error: null };
  }

  const [state, formAction, pending] = useActionState(submit, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">제목</span>
        <input
          name="title"
          required
          maxLength={200}
          placeholder="제목을 입력하세요"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">내용</span>
        <textarea
          name="content"
          required
          rows={10}
          placeholder="내용을 입력하세요"
          className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 sm:w-auto"
      >
        {pending ? "등록 중..." : "등록"}
      </button>
    </form>
  );
}
