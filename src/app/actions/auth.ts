"use server";

import { redirect } from "next/navigation";
import { isLocalBackend } from "@/lib/data/backend";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  if (isLocalBackend()) {
    redirect("/");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
