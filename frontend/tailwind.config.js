import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          50: "#f3f0ff",
          100: "#e5deff",
          200: "#cdbfff",
          300: "#b09aff",
          400: "#9472fd",
          500: "#7c5cfc",
          600: "#6d4ef0",
          700: "#5c3ed8",
          800: "#4a30b0",
          900: "#3a258a",
        },
        violet: {
          50: "#f3f0ff",
          100: "#e5deff",
          200: "#cdbfff",
          300: "#b09aff",
          400: "#9472fd",
          500: "#7c5cfc",
          600: "#6d4ef0",
          700: "#5c3ed8",
          800: "#4a30b0",
          900: "#3a258a",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in":    "fade-in 0.25s ease-out both",
        "slide-up":   "fade-slide-up 0.3s ease-out both",
        "scale-in":   "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-subtle": "pulse-subtle 2.5s ease-in-out infinite",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-slide-up": {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.75" },
        },
      },
      boxShadow: {
        "accent-glow": "0 0 20px rgba(124, 92, 252, 0.25)",
        "card": "0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 1px rgba(0, 0, 0, 0.2)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
