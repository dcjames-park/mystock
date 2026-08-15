import { redirect } from "next/navigation";
import { overlayHref } from "@/lib/overlay";

export default function NewAccountPage() {
  redirect(overlayHref({ m: "account-new" }));
}
