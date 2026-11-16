import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "in.realtysmartz.hrms",
  appName: "HRMS",
  webDir: "www",
  server: {
    url: "https://rshrms.in",
    cleartext: false,
    allowNavigation: ["rshrms.in", "*.rshrms.in", "accounts.google.com", "*.google.com", "*.googleapis.com"],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#2B2FD1",
    // Helps Google Sign-In work inside the app WebView
    overrideUserAgent:
      "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#2B2FD1",
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#0c0d14",
    },
    Geolocation: {
      permissions: ["location"],
    },
  },
};

export default config;
