import { redirect } from "next/navigation";
import { overlayHref } from "@/lib/overlay";

export default function DashboardPage() {
  redirect(overlayHref({ m: "dashboard" }));
}
