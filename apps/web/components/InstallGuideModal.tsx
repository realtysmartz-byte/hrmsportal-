"use client";

import { useState, useEffect } from "react";
import {
  Download,
  X,
  Share,
  PlusSquare,
  Laptop,
  Smartphone,
  Copy,
  Check,
  Apple,
  ExternalLink,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InstallGuideModal({ isOpen, onClose }: InstallGuideModalProps) {
  const [activeTab, setActiveTab] = useState<"ios" | "mac" | "desktop">("ios");
  const [copied, setCopied] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Detect OS for default tab
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent;
      if (/iPad|iPhone|iPod/.test(ua)) {
        setActiveTab("ios");
      } else if (/Macintosh/.test(ua)) {
        setActiveTab("mac");
      } else {
        setActiveTab("desktop");
      }
    }

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        onClose();
      }
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-xl bg-[#181926] border border-white/15 p-5 text-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-white/10 border border-white/15 p-2 flex items-center justify-center">
              <img src="/logo.png" alt="Realty Smartz" className="h-full w-full object-contain" />
            </div>
            <div>
              <h3 className="font-display text-sm sm:text-base font-bold text-white">
                Install Realty Smartz App
              </h3>
              <p className="text-[11px] text-neutral-400">
                Standalone App for Mobile & Desktop
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Device Switcher Tabs */}
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1 border border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("ios")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === "ios"
                ? "bg-[#5D3EBC] text-white shadow-xs"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>iPhone / iPad</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("mac")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === "mac"
                ? "bg-[#5D3EBC] text-white shadow-xs"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Laptop className="h-3.5 w-3.5" />
            <span>Mac (Desktop)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("desktop")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === "desktop"
                ? "bg-[#5D3EBC] text-white shadow-xs"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Windows / Chrome</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === "ios" && (
            <div className="space-y-3 text-xs text-neutral-300">
              <div className="rounded-xl bg-white/5 p-3 border border-white/10 flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC]/20 text-[#7B5CD6] font-bold text-xs">
                  1
                </span>
                <div className="leading-snug">
                  <span>Open this link in </span>
                  <span className="font-semibold text-white">Apple Safari</span>
                  <span>, then tap the </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-white bg-white/10 px-1.5 py-0.5 rounded">
                    <Share className="h-3 w-3 text-[#7B5CD6]" /> Share
                  </span>
                  <span> button at the bottom toolbar.</span>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 border border-white/10 flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC]/20 text-[#7B5CD6] font-bold text-xs">
                  2
                </span>
                <div className="leading-snug">
                  <span>Scroll down the menu and tap </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-white bg-white/10 px-1.5 py-0.5 rounded">
                    <PlusSquare className="h-3 w-3 text-[#7B5CD6]" /> Add to Home Screen
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 border border-white/10 flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC]/20 text-[#7B5CD6] font-bold text-xs">
                  3
                </span>
                <div className="leading-snug">
                  <span>Tap </span>
                  <span className="font-semibold text-white">Add</span>
                  <span> in the top-right corner. The Realty Smartz icon is now on your home screen!</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "mac" && (
            <div className="space-y-3 text-xs text-neutral-300">
              <div className="rounded-xl bg-white/5 p-3 border border-white/10 flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC]/20 text-[#7B5CD6] font-bold text-xs">
                  1
                </span>
                <div className="leading-snug">
                  <span>Open this page in </span>
                  <span className="font-semibold text-white">Safari on your Mac</span>
                  <span> (macOS Sonoma or later).</span>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 border border-white/10 flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC]/20 text-[#7B5CD6] font-bold text-xs">
                  2
                </span>
                <div className="leading-snug">
                  <span>In the top Mac menu bar, click </span>
                  <span className="font-semibold text-white bg-white/10 px-1.5 py-0.5 rounded">
                    File &rarr; Add to Dock…
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 border border-white/10 flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC]/20 text-[#7B5CD6] font-bold text-xs">
                  3
                </span>
                <div className="leading-snug">
                  <span>Click </span>
                  <span className="font-semibold text-white">Add</span>
                  <span>. The app will open in its own clean window directly from your Mac Dock!</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "desktop" && (
            <div className="space-y-3 text-xs text-neutral-300">
              {deferredPrompt ? (
                <div className="rounded-xl bg-white/5 p-4 border border-white/10 text-center">
                  <p className="text-white font-bold mb-2">Browser Ready to Install!</p>
                  <button
                    type="button"
                    onClick={handleNativeInstall}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#5D3EBC] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95"
                  >
                    <Download className="h-4 w-4" />
                    <span>Install App on this Computer</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-white/5 p-3 border border-white/10 flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC]/20 text-[#7B5CD6] font-bold text-xs">
                    ★
                  </span>
                  <div className="leading-snug">
                    <span>Look at the right side of your browser address bar for the </span>
                    <span className="font-semibold text-white bg-white/10 px-1.5 py-0.5 rounded">
                      Install App icon
                    </span>
                    <span> (or press Chrome menu &rarr; Save &amp; Share &rarr; Install).</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Link Copied!" : "Copy Portal Link"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
