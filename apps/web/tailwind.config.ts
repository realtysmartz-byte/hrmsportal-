import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["2.25rem", { lineHeight: "2.5rem", fontWeight: "700" }],
        "heading-lg": ["1.5rem", { lineHeight: "2rem", fontWeight: "700" }],
        "heading-md": ["1.125rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        body: ["0.9375rem", { lineHeight: "1.5rem", fontWeight: "400" }],
        caption: ["0.8125rem", { lineHeight: "1.25rem", fontWeight: "500" }],
      },
      colors: {
        indigo: {
          50: "var(--indigo-50)",
          100: "var(--indigo-100)",
          200: "var(--indigo-200)",
          300: "var(--indigo-300)",
          400: "var(--indigo-400)",
          500: "var(--indigo-500)",
          600: "var(--indigo-600)",
          700: "var(--indigo-700)",
          800: "var(--indigo-800)",
          900: "var(--indigo-900)",
          DEFAULT: "var(--indigo-700)",
        },
        teal: {
          50: "var(--teal-50)",
          100: "var(--teal-100)",
          200: "var(--teal-200)",
          300: "var(--teal-300)",
          400: "var(--teal-400)",
          500: "var(--teal-500)",
          600: "var(--teal-600)",
          700: "var(--teal-700)",
          800: "var(--teal-800)",
          900: "var(--teal-900)",
          DEFAULT: "var(--teal-600)",
        },
        maroon: {
          50: "var(--maroon-50)",
          100: "var(--maroon-100)",
          200: "var(--maroon-200)",
          300: "var(--maroon-300)",
          400: "var(--maroon-400)",
          500: "var(--maroon-500)",
          600: "var(--maroon-600)",
          700: "var(--maroon-700)",
          800: "var(--maroon-800)",
          900: "var(--maroon-900)",
          DEFAULT: "var(--maroon-600)",
        },
        neutral: {
          50: "var(--neutral-50)",
          100: "var(--neutral-100)",
          200: "var(--neutral-200)",
          300: "var(--neutral-300)",
          400: "var(--neutral-400)",
          500: "var(--neutral-500)",
          600: "var(--neutral-600)",
          700: "var(--neutral-700)",
          800: "var(--neutral-800)",
          900: "var(--neutral-900)",
        },
        success: {
          DEFAULT: "var(--success)",
          soft: "var(--success-soft)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          soft: "var(--warning-soft)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
        },
        info: {
          DEFAULT: "var(--info)",
          soft: "var(--info-soft)",
        },
        // brand & semantic aliases
        "brand-indigo": "var(--indigo-700)",
        "brand-teal": "var(--teal-600)",
        "brand-maroon": "var(--maroon-600)",
        "brand-bg": "var(--neutral-50)",
        "brand-text": "var(--neutral-900)",
        "brand-success": "var(--success)",
        "brand-warning": "var(--warning)",
        "brand-danger": "var(--danger)",
        border: "var(--neutral-200)",
        input: "var(--neutral-200)",
        ring: "#FF7A70",
        background: "var(--neutral-50)",
        foreground: "var(--neutral-900)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "var(--neutral-100)",
          foreground: "var(--neutral-800)",
        },
        destructive: {
          DEFAULT: "var(--maroon-600)",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "var(--neutral-100)",
          foreground: "var(--neutral-500)",
        },
        accent: {
          DEFAULT: "var(--indigo-50)",
          foreground: "var(--indigo-700)",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "var(--neutral-900)",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
        xl: "0.75rem",
      },
      boxShadow: {
        elevated:
          "0 10px 25px -5px rgb(28 25 23 / 0.1), 0 8px 10px -6px rgb(28 25 23 / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
