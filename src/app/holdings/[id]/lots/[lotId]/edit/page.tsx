import { redirect } from "next/navigation";
import { overlayHref } from "@/lib/overlay";

export default async function EditLotPage({
  params,
}: {
  params: Promise<{ id: string; lotId: string }>;
}) {
  const { id, lotId } = await params;
  redirect(overlayHref({ m: "lot-edit", id, lotId }));
}
