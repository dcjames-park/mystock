export type OverlayState =
  | { m: "holding"; id: string }
  | { m: "holding-new"; accountId?: string }
  | { m: "holding-edit"; id: string }
  | { m: "holding-delete"; id: string }
  | { m: "lot-add"; id: string }
  | { m: "lot-edit"; id: string; lotId: string }
  | { m: "lot-delete"; id: string; lotId: string }
  | { m: "account-new" }
  | { m: "account-edit"; id: string }
  | { m: "account-delete"; id: string }
  | { m: "settings" };

const MODES = new Set<OverlayState["m"]>([
  "holding",
  "holding-new",
  "holding-edit",
  "holding-delete",
  "lot-add",
  "lot-edit",
  "lot-delete",
  "account-new",
  "account-edit",
  "account-delete",
  "settings",
]);

export function overlayHref(state: OverlayState | null) {
  if (!state) {
    return "/";
  }
  const params = new URLSearchParams();
  params.set("m", state.m);
  if ("id" in state && state.id) {
    params.set("id", state.id);
  }
  if ("lotId" in state && state.lotId) {
    params.set("lotId", state.lotId);
  }
  if ("accountId" in state && state.accountId) {
    params.set("accountId", state.accountId);
  }
  return `/?${params.toString()}`;
}

export function parseOverlaySearch(search: string): OverlayState | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const m = params.get("m");
  if (!m || !MODES.has(m as OverlayState["m"])) {
    return null;
  }
  const id = params.get("id") ?? "";
  const lotId = params.get("lotId") ?? "";
  const accountId = params.get("accountId") ?? undefined;
  switch (m as OverlayState["m"]) {
    case "holding":
    case "holding-edit":
    case "holding-delete":
    case "lot-add":
    case "account-edit":
    case "account-delete":
      return id ? ({ m, id } as OverlayState) : null;
    case "lot-edit":
    case "lot-delete":
      return id && lotId ? ({ m, id, lotId } as OverlayState) : null;
    case "holding-new":
      return { m: "holding-new", accountId };
    case "account-new":
      return { m: "account-new" };
    case "settings":
      return { m: "settings" };
    default:
      return null;
  }
}

export function overlaySize(state: OverlayState | null): "page" | "form" {
  return state?.m === "holding" ? "page" : "form";
}
