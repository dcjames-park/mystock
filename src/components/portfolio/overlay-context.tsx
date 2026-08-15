"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  overlayHref,
  overlaySize,
  parseOverlaySearch,
  type OverlayState,
} from "@/lib/overlay";
import { cn } from "@/lib/utils";

type OverlayApi = {
  state: OverlayState | null;
  open: (next: OverlayState) => void;
  close: () => void;
  closeToMain: () => void;
};

const OverlayContext = createContext<OverlayApi | null>(null);
const OverlayFrameContext = createContext(false);

function overlayHistoryState(depth: number) {
  const prev =
    typeof window.history.state === "object" && window.history.state !== null
      ? { ...window.history.state }
      : {};
  if (typeof prev.idx === "number") {
    prev.idx += 1;
  }
  return { ...prev, overlay: true, overlayDepth: depth };
}

function currentOverlayDepth() {
  const depth = window.history.state?.overlayDepth;
  return typeof depth === "number" ? depth : 0;
}

export function useOverlay() {
  const value = useContext(OverlayContext);
  if (!value) {
    throw new Error("useOverlay must be used within OverlayProvider");
  }
  return value;
}

export function useOptionalOverlay() {
  return useContext(OverlayContext);
}

export function useOverlayFrame() {
  return useContext(OverlayFrameContext);
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<OverlayState | null>(() =>
    parseOverlaySearch(searchParams.toString()),
  );
  const closingToMain = useRef(false);

  useEffect(() => {
    function onPop() {
      if (closingToMain.current) {
        closingToMain.current = false;
        if (parseOverlaySearch(window.location.search)) {
          window.history.replaceState(window.history.state, "", "/");
        }
        setState(null);
        return;
      }
      setState(parseOverlaySearch(window.location.search));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [state]);

  const open = useCallback((next: OverlayState) => {
    const depth = currentOverlayDepth() + 1;
    window.history.pushState(
      overlayHistoryState(depth),
      "",
      overlayHref(next),
    );
    setState(next);
  }, []);

  const close = useCallback(() => {
    if (currentOverlayDepth() > 0) {
      window.history.back();
      return;
    }
    window.history.replaceState(window.history.state, "", "/");
    setState(null);
  }, []);

  const closeToMain = useCallback(() => {
    const depth = currentOverlayDepth();
    if (depth > 0) {
      closingToMain.current = true;
      window.history.go(-depth);
      setState(null);
      return;
    }
    window.history.replaceState(window.history.state, "", "/");
    setState(null);
  }, []);

  const value = useMemo(
    () => ({ state, open, close, closeToMain }),
    [state, open, close, closeToMain],
  );

  return (
    <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
  );
}

export function OverlayPanel({
  size,
  children,
}: {
  size: "page" | "form";
  children: ReactNode;
}) {
  const { close } = useOverlay();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <OverlayFrameContext.Provider value={true}>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <button
          type="button"
          aria-label="닫기"
          className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[3px] overlay-backdrop dark:bg-black/60"
          onClick={close}
        />
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "overlay-panel relative z-10 flex max-h-[96dvh] w-full flex-col overflow-hidden border border-border bg-card shadow-2xl ring-1 ring-black/10 dark:ring-white/15",
            size === "page"
              ? "h-[96dvh] rounded-t-2xl sm:h-[min(96dvh,920px)] sm:max-w-6xl sm:rounded-xl"
              : "rounded-t-2xl sm:max-h-[85dvh] sm:max-w-lg sm:rounded-xl",
          )}
        >
          <div
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6",
              size === "page" && "sm:px-8 sm:py-6",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </OverlayFrameContext.Provider>,
    document.body,
  );
}

export function useRouteIds() {
  const overlay = useOptionalOverlay();
  return {
    id:
      overlay?.state && "id" in overlay.state ? overlay.state.id : undefined,
    lotId:
      overlay?.state && "lotId" in overlay.state
        ? overlay.state.lotId
        : undefined,
    accountId:
      overlay?.state && "accountId" in overlay.state
        ? overlay.state.accountId
        : undefined,
  };
}

export { overlaySize };
