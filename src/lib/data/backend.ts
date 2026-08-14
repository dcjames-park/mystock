export type DataBackend = "local" | "supabase";

export function getDataBackend(): DataBackend {
  const override = process.env.NEXT_PUBLIC_DATA_BACKEND;
  if (override === "local" || override === "supabase") {
    return override;
  }

  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;

  if (vercelEnv === "production") {
    return "supabase";
  }

  return "local";
}

export function isLocalBackend() {
  return getDataBackend() === "local";
}

export function isSupabaseBackend() {
  return getDataBackend() === "supabase";
}

export const LOCAL_USER = {
  id: "local-user",
  email: "로컬",
  name: "로컬",
} as const;
