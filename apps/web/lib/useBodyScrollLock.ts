"use client";

import { useEffect, useRef } from "react";

/**
 * Bulletproof lock for background screen scrolling when any modal, drawer, or dialog is open.
 * - Prevents background scrolling without disrupting document flow
 * - Preserves scroll position precisely without jumping or animating down when closed
 * - Disables smooth-scroll animations during restore so the page stays rock-solid
 */
export function useBodyScrollLock(isLocked: boolean) {
  const scrollYRef = useRef<number>(0);

  useEffect(() => {
    if (!isLocked) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Capture the exact scroll position at the moment of opening
    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    scrollYRef.current = scrollY;

    const originalDocOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalScrollBehavior = document.documentElement.style.scrollBehavior;

    // Lock scrolling on document and body
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      // Temporarily set scrollBehavior to instant so NO downward scrolling animation occurs
      document.documentElement.style.scrollBehavior = "auto";
      document.documentElement.style.overflow = originalDocOverflow;
      document.body.style.overflow = originalBodyOverflow;

      // Keep position rock solid
      window.scrollTo({
        top: scrollYRef.current,
        left: 0,
        behavior: "instant" as ScrollBehavior,
      });

      // Restore scroll behavior in next frame
      requestAnimationFrame(() => {
        document.documentElement.style.scrollBehavior = originalScrollBehavior;
      });
    };
  }, [isLocked]);
}
