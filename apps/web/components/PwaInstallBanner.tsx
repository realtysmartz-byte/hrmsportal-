"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Logo } from "@/components/Logo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_STORAGE_KEY = "rs_pwa_install_dismissed_at";
const SESSION_DISMISS_KEY = "rs_pwa_install_session_dismissed";
const DISMISS_DAYS = 14;
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone / installed PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setIsStandaloneMode(true);
      return;
    }

    // 2. Check if dismissed in localStorage within the last 14 days
    try {
      const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissedAt) {
        const timePassed = Date.now() - parseInt(dismissedAt, 10);
        if (timePassed < DISMISS_MS) {
          return;
        }
      }

      // Check session dismissal (show at most once per session)
      const sessionDismissed = sessionStorage.getItem(SESSION_DISMISS_KEY);
      if (sessionDismissed === "true") {
        return;
      }
    } catch {
      // Storage access blocked or restricted
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|OPiOS|mercury/i.test(userAgent);

    if (isIos && isSafari) {
      setIsIosDevice(true);
      setIsVisible(true);
      return;
    }

    // 4. Capture standard beforeinstallprompt (Chrome / Edge / Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
      try {
        localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
      } catch {
        // ignore
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      // Store 14-day persistent dismissal and session dismissal
      localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
      sessionStorage.setItem(SESSION_DISMISS_KEY, "true");
    } catch {
      // ignore
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsVisible(false);
        setDeferredPrompt(null);
      } else {
        // Dismissed prompt: mark session dismissal
        sessionStorage.setItem(SESSION_DISMISS_KEY, "true");
        setIsVisible(false);
      }
    } catch {
      setIsVisible(false);
    }
  };

  // Do not render if standalone or not visible
  if (isStandaloneMode || !isVisible) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Install Realty Smartz App"
      className="relative z-40 border-b border-teal-600/30 bg-gradient-to-r from-teal-900 via-teal-800 to-teal-900 text-white shadow-md transition-all duration-200"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 p-1.5 sm:flex">
            <Logo showText={false} className="scale-75" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-semibold tracking-wide text-white">
                Realty Smartz App
              </span>
              <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-medium text-teal-200">
                PWA
              </span>
            </div>
            <p className="truncate text-xs text-teal-100/90 sm:text-xs">
              {isIosDevice
                ? "Install on home screen: Tap Share and select 'Add to Home Screen'"
                : "Install app for instant check-in, fast loading, and offline access"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isIosDevice ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-teal-700/60 px-3 py-1.5 text-xs font-medium text-white shadow-sm ring-1 ring-white/20">
              <Share className="h-3.5 w-3.5 text-teal-200" />
              <span className="hidden sm:inline">Tap Share &rarr; Add to Home Screen</span>
              <span className="sm:hidden">Share &rarr; Add</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-maroon px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-400"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install App</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            className="rounded-lg p-1.5 text-teal-200/80 transition hover:bg-teal-700/60 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
