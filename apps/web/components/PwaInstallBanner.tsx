"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare, Smartphone } from "lucide-react";
import { InstallGuideModal } from "@/components/InstallGuideModal";

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
  const [showGuide, setShowGuide] = useState(false);
  const [guideTab, setGuideTab] = useState<"android" | "ios">("android");

  useEffect(() => {
    // 1. Comprehensive standalone detection across iOS WebClip and modern Chromium
    const isStandalone =
      (typeof window !== "undefined" && (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://") ||
        window.location.search.includes("source=pwa") ||
        sessionStorage.getItem("rs_is_pwa_standalone") === "true"
      ));

    if (isStandalone) {
      try {
        sessionStorage.setItem("rs_is_pwa_standalone", "true");
      } catch {
        // ignore
      }
      setIsStandaloneMode(true);
      return;
    }

    // 2. Check if dismissed recently
    try {
      const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissedAt) {
        const timePassed = Date.now() - parseInt(dismissedAt, 10);
        if (timePassed < DISMISS_MS) {
          return;
        }
      }

      if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "true") {
        return;
      }
    } catch {
      // Storage access blocked or restricted
    }

    // 3. Detect iOS (iPhone, iPad, iPod, or iPadOS on Mac)
    const userAgent = window.navigator.userAgent;
    const isIos =
      (/iPad|iPhone|iPod/.test(userAgent) ||
        (Boolean(window.navigator.maxTouchPoints && window.navigator.maxTouchPoints > 2) &&
          /Macintosh/.test(userAgent))) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;

    if (isIos) {
      setIsIosDevice(true);
      setIsVisible(true);
      return;
    }

    // 4. Always show banner on Android/desktop so users without Install prompt
    //    can open the manual "Add to Home screen" guide.
    setIsVisible(true);

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
        sessionStorage.setItem("rs_is_pwa_standalone", "true");
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
    setShowGuide(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
      sessionStorage.setItem(SESSION_DISMISS_KEY, "true");
    } catch {
      // ignore
    }
  };

  const handleInstallClick = async () => {
    if (isIosDevice) {
      setGuideTab("ios");
      setShowGuide(true);
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setIsVisible(false);
          setDeferredPrompt(null);
        } else {
          setGuideTab("android");
          setShowGuide(true);
        }
      } catch {
        setGuideTab("android");
        setShowGuide(true);
      }
      return;
    }

    // No browser Install prompt (common on many Android phones) — show manual steps
    setGuideTab("android");
    setShowGuide(true);
  };

  // Do not render if app is running in standalone mode or not visible
  if (isStandaloneMode || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Top Banner (Responsive, never overflows on mobile) */}
      <div
        role="region"
        aria-label="Install Realty Smartz Private Limited App"
        className="relative z-40 w-full overflow-hidden border-b border-white/10 bg-gradient-to-r from-[#181926] via-[#232638] to-[#181926] text-white"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-2.5">
          {/* Left: App Logo & Details */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 p-1 sm:h-9 sm:w-9 sm:rounded-xl border border-white/10 flex">
              <img
                src="/logo.png"
                alt="Realty Smartz"
                className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-display text-xs sm:text-sm font-bold tracking-tight text-white">
                  Realty Smartz
                </span>
                <span className="shrink-0 rounded-full bg-[#5D3EBC]/30 border border-[#5D3EBC]/40 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-[#7B5CD6]">
                  PWA
                </span>
              </div>
              <p className="truncate text-[11px] sm:text-xs text-neutral-300">
                {isIosDevice
                  ? "Install for instant check-in & offline access"
                  : "Install app for instant check-in & offline access"}
              </p>
            </div>
          </div>

          {/* Right: Install & Dismiss Actions */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#5D3EBC] px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 text-xs font-bold text-white transition hover:opacity-95 active:scale-95 focus:outline-none"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss install banner"
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Installation Instructions Modal */}
      <InstallGuideModal
        isOpen={showGuide}
        initialTab={guideTab}
        onClose={() => setShowGuide(false)}
      />
    </>
  );
}
