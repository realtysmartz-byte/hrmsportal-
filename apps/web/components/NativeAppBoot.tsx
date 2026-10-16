"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Native Android WebView polish: keep login / pages clear of the system status bar.
 */
export function NativeAppBoot() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    void (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: "#5D3EBC" });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // StatusBar plugin may be unavailable on web
      }
    })();
  }, []);

  return null;
}
