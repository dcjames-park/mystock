import { redirect } from "next/navigation";
import { overlayHref } from "@/lib/overlay";

export default async function DeleteHoldingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(overlayHref({ m: "holding-delete", id }));
}
