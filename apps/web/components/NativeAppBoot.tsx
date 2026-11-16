"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Native Android WebView polish: keep login / pages clear of the system status bar.
 */
export function NativeAppBoot() {
  useEffect(() => {
    // Strictly detect native Android / iOS APK (never true in Chrome / Safari / web browsers)
    const isStrictNative =
      typeof window !== "undefined" &&
    Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() !== "web";

      if (isStrictNative) {
        document.documentElement.classList.add("is-native-app");
        document.body.classList.add("is-native-app");
      } else {
        document.documentElement.classList.remove("is-native-app");
        document.body.classList.remove("is-native-app");
        try {
        sessionStorage.removeItem("is_native_app");
      } catch { }
    }

    if (!isStrictNative) return;

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
