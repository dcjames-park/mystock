import { redirect } from "next/navigation";
import { overlayHref } from "@/lib/overlay";

export default async function NewHoldingPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const { accountId } = await searchParams;
  redirect(overlayHref({ m: "holding-new", accountId }));
}
