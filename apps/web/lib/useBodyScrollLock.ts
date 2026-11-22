"use client";

import { useEffect, useRef } from "react";

  // Global reference counter and style store for concurrent / nested modals
  let activeLockCount = 0;
  let savedScrollY = 0;
  let originalBodyOverflow = "";
  let originalBodyPaddingRight = "";
  let originalHtmlScrollBehavior = "";

    function acquireLock() {
      if (typeof window === "undefined" || typeof document === "undefined") return;

      if (activeLockCount === 0) {
        // 1. Record the initial scroll position before any modal is shown
        savedScrollY =
          window.scrollY ||
          window.pageYOffset ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0;

        originalBodyOverflow = document.body.style.overflow;
        originalBodyPaddingRight = document.body.style.paddingRight;
        originalHtmlScrollBehavior = document.documentElement.style.scrollBehavior;

        // 2. Prevent layout jitter by compensating for scrollbar width on desktop
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollBarWidth > 0) {
          document.body.style.paddingRight = `${scrollBarWidth}px`;
        }

        // 3. Lock scrolling on body only (do not lock html root to prevent mobile touch decoupling)
        document.body.style.overflow = "hidden";
      }

        activeLockCount++;
      }

      function releaseLock() {
        if (typeof window === "undefined" || typeof document === "undefined") return;

        activeLockCount--;

        if (activeLockCount <= 0) {
          activeLockCount = 0;

          // 1. Force instant scrollBehavior so NO scroll-down animation can occur
          document.documentElement.style.scrollBehavior = "auto";

          // 2. Completely clean up all inline overflow styles to guarantee full scroll restoration
          if (originalBodyOverflow && originalBodyOverflow !== "hidden") {
            document.body.style.overflow = originalBodyOverflow;
          } else {
            document.body.style.removeProperty("overflow");
          }

          if (originalBodyPaddingRight) {
            document.body.style.paddingRight = originalBodyPaddingRight;
          } else {
            document.body.style.removeProperty("padding-right");
          }

          // Safety: ensure html element has no residual overflow or position locks
          document.documentElement.style.removeProperty("overflow");
          document.body.style.removeProperty("position");
          document.body.style.removeProperty("top");

          // 3. Restore exact scroll position rock-solid
          if (typeof savedScrollY === "number" && savedScrollY >= 0) {
            window.scrollTo({
              top: savedScrollY,
              left: 0,
              behavior: "instant" as ScrollBehavior,
            });
          }

          // 4. Restore original scroll behavior after current frame
          requestAnimationFrame(() => {
            if (originalHtmlScrollBehavior) {
              document.documentElement.style.scrollBehavior = originalHtmlScrollBehavior;
            } else {
              document.documentElement.style.removeProperty("scroll-behavior");
            }
          });
        }
      }

      /**
       * Bulletproof lock for background screen scrolling when any modal, drawer, or dialog is open.
       * - Global reference counting prevents locks from conflicting or getting stuck
       * - Preserves scroll position precisely without jumping or animating down when closed
       * - Guarantees full, natural page scroll restoration when all modals are closed
       */
      export function useBodyScrollLock(isLocked: boolean) {
        const isCurrentlyLockedRef = useRef(false);

        useEffect(() => {
          if (isLocked) {
            if (!isCurrentlyLockedRef.current) {
              acquireLock();
              isCurrentlyLockedRef.current = true;
            }
          } else {
            if (isCurrentlyLockedRef.current) {
              releaseLock();
              isCurrentlyLockedRef.current = false;
            }
          }

          return () => {
            if (isCurrentlyLockedRef.current) {
              releaseLock();
              isCurrentlyLockedRef.current = false;
            }
          };
        }, [isLocked]);
      }
