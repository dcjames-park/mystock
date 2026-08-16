import { redirect } from "next/navigation";
import { overlayHref } from "@/lib/overlay";

export default function LotsPage() {
  redirect(overlayHref({ m: "lots" }));
}
