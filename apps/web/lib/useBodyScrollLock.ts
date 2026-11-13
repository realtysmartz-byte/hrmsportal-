"use client";

import { useEffect } from "react";

/**
 * Bulletproof lock for background screen scrolling when any modal, drawer, or dialog is open.
 * Freezes both document.body and document.documentElement at the exact current scroll position
 * and restores scroll position cleanly on unmount or close.
 * Works across iOS Safari, Android Chrome, Windows browsers, and macOS.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    if (typeof window === "undefined" || typeof document === "undefined") return;

    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyOverflow = document.body.style.overflow;
    const originalDocOverflow = document.documentElement.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalDocOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}

