import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const env = getSupabaseEnv();
  if (!env) {
    return Response.json({ ok: true, supabase: "skipped" });
  }

  const supabase = createClient<Database>(env.url, env.key);
  const { error } = await supabase.from("accounts").select("id").limit(1);

  if (error) {
    return Response.json(
      { ok: false, supabase: "error", message: error.message },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, supabase: "ok" });
}
