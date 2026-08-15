import { redirect } from "next/navigation";
import { overlayHref } from "@/lib/overlay";

export default function SettingsPage() {
  redirect(overlayHref({ m: "settings" }));
}
