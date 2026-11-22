"use client";

import { useEffect, useRef } from "react";

let activeLockCount = 0;
let savedScrollY = 0;

  function acquireLock() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

      if (activeLockCount === 0) {
        savedScrollY =
          window.scrollY ||
          window.pageYOffset ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0;

        // Turn off smooth scrolling so there is zero animation or jump
        document.documentElement.style.setProperty("scroll-behavior", "auto", "important");

        // Freeze body position at exact current scroll position
        document.body.style.position = "fixed";
        document.body.style.top = `-${savedScrollY}px`;
        document.body.style.left = "0px";
        document.body.style.right = "0px";
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";
      }

    activeLockCount++;
  }

function releaseLock() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

    activeLockCount--;

    if (activeLockCount <= 0) {
      activeLockCount = 0;

        // Enforce instant behavior so NO downward scroll animation happens
        document.documentElement.style.setProperty("scroll-behavior", "auto", "important");

        // Unfreeze body completely
        document.body.style.removeProperty("position");
        document.body.style.removeProperty("top");
        document.body.style.removeProperty("left");
        document.body.style.removeProperty("right");
        document.body.style.removeProperty("width");
        document.body.style.removeProperty("overflow");
        document.documentElement.style.removeProperty("overflow");

        // Restore exact position instantly
        window.scrollTo({
          top: savedScrollY,
          left: 0,
          behavior: "instant" as ScrollBehavior,
        });

        // Revert scroll-behavior override in next animation frame
        requestAnimationFrame(() => {
          document.documentElement.style.removeProperty("scroll-behavior");
        });
      }
    }

    /**
     * Bulletproof lock for background screen scrolling when any modal, drawer, or dialog is open:
     * 1. Background screen is 100% frozen (cannot scroll on mobile or desktop while modal is open)
     * 2. When modal closes, position restores instantly with 0 downward scrolling animation
     * 3. Page scrolling resumes naturally without getting stuck
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
