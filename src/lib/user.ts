type AuthUserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null;

export function displayNameFromUser(user: AuthUserLike) {
  if (!user) {
    return "사용자";
  }
  const meta = user.user_metadata ?? {};
  const candidates = [meta.full_name, meta.name, meta.given_name];
  const name = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  if (typeof name === "string") {
    return name.trim();
  }
  if (user.email) {
    return user.email.split("@")[0] ?? "사용자";
  }
  return "사용자";
}
