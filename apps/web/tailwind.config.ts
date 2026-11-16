import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: [
          '"Manrope"',
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        sans: [
          '"Manrope"',
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        side: "var(--side)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        field: "var(--field)",
        hover: "var(--hover)",
        active: "var(--active)",
        accent: {
          DEFAULT: "var(--accent)",
          ink: "var(--accent-ink)",
        },
        ok: "var(--ok)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        info: "var(--info)",

        // Compatibility aliases with solid token mappings
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-ink)",
        },
        secondary: {
          DEFAULT: "var(--field)",
          foreground: "var(--ink)",
        },
        destructive: {
          DEFAULT: "var(--danger)",
          foreground: "#ffffff",
        },
        border: "var(--line)",
        input: "var(--line)",
        ring: "var(--accent)",
        background: "var(--bg)",
        foreground: "var(--ink)",

        // Brand colors (fixed in both modes)
        brand: {
          blue: "#2F7FB5",
          red: "#D6283A",
          DEFAULT: "var(--accent)",
        },
      },
      borderRadius: {
        none: "0px",
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "4px",
        xl: "4px",
        "2xl": "4px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
