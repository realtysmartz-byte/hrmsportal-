import type { CapacitorConfig } from "@capacitor/cli";

const APP_URL = process.env.HRMS_APP_URL;
if (!APP_URL || !APP_URL.startsWith("https://")) {
  throw new Error("Set HRMS_APP_URL to the live HTTPS URL of the HRMS portal");
}

const config: CapacitorConfig = {
  appId: "in.realtysmartz.hrms",
  appName: "Realty Smartz HRMS",
  webDir: "www",
  server: {
    url: APP_URL,
    allowNavigation: ["accounts.google.com", "*.google.com"],
  },
  android: {
    useLegacyBridge: true,
    overrideUserAgent:
      "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  },
};

export default config;
