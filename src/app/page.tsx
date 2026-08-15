import { Suspense } from "react";
import { HomeView } from "@/components/portfolio/home-view";
import { OverlayHost } from "@/components/portfolio/overlay-host";
import { OverlayProvider } from "@/components/portfolio/overlay-context";
import { ScreenSkeleton } from "@/components/portfolio/app-shell";
import { PortfolioProvider } from "@/lib/data/use-portfolio";

export default function HomePage() {
  return (
    <PortfolioProvider>
      <Suspense fallback={<ScreenSkeleton />}>
        <OverlayProvider>
          <HomeView />
          <OverlayHost />
        </OverlayProvider>
      </Suspense>
    </PortfolioProvider>
  );
}
