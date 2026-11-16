"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Native Android WebView polish: keep login / pages clear of the system status bar.
 */
export function NativeAppBoot() {
  useEffect(() => {
    const isNative =
      typeof window !== "undefined" &&
      (Capacitor.isNativePlatform() ||
        Boolean((window as any).Capacitor) ||
        (window as any).Capacitor?.getPlatform?.() === "android" ||
        (window as any).Capacitor?.getPlatform?.() === "ios");

    if (isNative) {
      document.documentElement.classList.add("is-native-app");
      document.body.classList.add("is-native-app");
      try {
        sessionStorage.setItem("is_native_app", "1");
      } catch { }
    }

    if (!Capacitor.isNativePlatform()) return;

    void (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#FFFFFF" });
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch {
        // StatusBar plugin may be unavailable on web
      }
    })();
  }, []);

  return null;
}
