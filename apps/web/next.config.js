const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  transpilePackages: [
    "@realty-smartz/api",
    "@realty-smartz/db",
    "@realty-smartz/shared",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development" && process.env.ENABLE_PWA_DEV !== "true",
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static-resources",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      {
        urlPattern: /^https?:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "image-cache",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 14 * 24 * 60 * 60, // 14 days
          },
        },
      },
      {
        urlPattern: /^https?:\/\/.*\.(?:woff|woff2|ttf|eot)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "font-cache",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          },
        },
      },
      {
        // Network-first strategy for data-heavy pages (dashboard, attendance, leave, performance, etc.)
        urlPattern: /^https?:\/\/.*(?:\/employee-portal|\/admin-portal|\/api\/trpc\/attendance|\/api\/trpc\/leave|\/api\/trpc\/performance)/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "app-pages-data-cache",
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 60,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
        },
      },
      {
        // Other navigation routes
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "general-pages-cache",
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 40,
            maxAgeSeconds: 24 * 60 * 60,
          },
        },
      },
    ],
  },
});

module.exports = withPWA(nextConfig);
