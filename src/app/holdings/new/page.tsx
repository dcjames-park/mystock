import { Suspense } from "react";
import { AddHoldingView } from "@/components/portfolio/add-holding-view";
import { ScreenSkeleton } from "@/components/portfolio/app-shell";

export default function NewHoldingPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AddHoldingView />
    </Suspense>
  );
}
