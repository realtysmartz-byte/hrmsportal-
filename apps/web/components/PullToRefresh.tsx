"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ArrowDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
}

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isPullingRef = useRef(false);

  const PULL_THRESHOLD = 65; // Distance in px to trigger refresh
  const MAX_PULL = 110;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(PULL_THRESHOLD);

    try {
      // 1. Invalidate all cached data for current screen
      await Promise.allSettled([
        utils.invalidate(),
        onRefresh ? onRefresh() : Promise.resolve(),
      ]);
      // 2. Refresh server-side components & layouts
      router.refresh();
    } catch (e) {
      console.warn("[PullToRefresh] error:", e);
    } finally {
      // Keep indicator visible briefly so user sees completion
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 500);
    }
  }, [utils, onRefresh, router]);

  useEffect(() => {
    let startY = 0;
    let isTracking = false;

    const isTop = () => {
      return (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0) <= 2;
    };

    const isModalOpen = () => {
      return Boolean(
        document.querySelector('[role="dialog"]') ||
        document.querySelector('.fixed.inset-0.z-50')
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing || isModalOpen()) return;
      if (isTop() && e.touches.length === 1) {
        startY = e.touches[0].clientY;
        startYRef.current = startY;
        isTracking = true;
        isPullingRef.current = false;
      } else {
        isTracking = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTracking || isRefreshing || isModalOpen()) return;
      const currentY = e.touches[0].clientY;
      currentYRef.current = currentY;
      const diff = currentY - startY;

      if (diff > 0 && isTop()) {
        isPullingRef.current = true;
        // Dampened pull distance
        const damped = Math.min(MAX_PULL, Math.pow(diff, 0.82));
        setPullDistance(damped);
        setCanPull(damped >= PULL_THRESHOLD);

        // Prevent native overscroll glitch when dragging
        if (e.cancelable && damped > 10) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
        setCanPull(false);
      }
    };

    const handleTouchEnd = () => {
      if (!isTracking || isRefreshing) return;
      isTracking = false;

      if (isPullingRef.current && canPull) {
        void handleRefresh();
      } else {
        setPullDistance(0);
        setCanPull(false);
      }
      isPullingRef.current = false;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isRefreshing, canPull, handleRefresh]);

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const showIndicator = pullDistance > 0 || isRefreshing;

  return (
    <div className="relative min-h-screen">
      {/* Pull Indicator Pill */}
      <div
        className={cn(
          "pointer-events-none fixed top-[max(0.75rem,env(safe-area-inset-top))] left-0 right-0 z-50 flex justify-center transition-all",
          isRefreshing || pullDistance === 0 ? "duration-300 ease-out" : "duration-75"
        )}
        style={{
          transform: showIndicator
            ? `translate3d(0, ${Math.min(pullDistance, 70)}px, 0)`
            : "translate3d(0, -100px, 0)",
          opacity: showIndicator ? Math.min(1, Math.max(0.2, progress * 1.2)) : 0,
        }}
      >
        <div
          className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--card)] px-3.5 py-1.5 shadow-lg text-xs font-semibold text-[var(--ink)]"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--line)",
            color: "var(--ink)",
          }}
        >
          {isRefreshing ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
              <span>Updating...</span>
            </>
          ) : (
            <>
              <ArrowDown
                className={cn(
                  "h-3.5 w-3.5 text-[var(--accent)] transition-transform duration-200",
                  canPull && "rotate-180 text-[var(--ok)]"
                )}
              />
              <span>{canPull ? "Release to refresh" : "Pull to refresh"}</span>
            </>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
