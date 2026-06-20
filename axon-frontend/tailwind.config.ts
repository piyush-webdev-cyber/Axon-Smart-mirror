import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// All colors resolve to CSS custom properties defined per `[data-theme]`
// in src/styles/themes.css. Swapping themes never touches component code.
const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          foreground: "hsl(var(--surface-foreground))",
          muted: "hsl(var(--surface-muted))",
        },
        // Phase 2 semantic content + state tokens
        content: {
          DEFAULT: "hsl(var(--text-primary))",
          muted: "hsl(var(--text-secondary))",
        },
        glow: "hsl(var(--glow))",
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "hsl(var(--error-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 0.5rem)",
        "2xl": "calc(var(--radius) + 1rem)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      // Fluid typography scale - one source of truth, legible from 3-4m and
      // adaptive from a 7" Pi panel to a 24"+ mirror. All sizes use clamp().
      fontSize: {
        "display-xl": [
          "clamp(3.25rem, 1.6rem + 7vw, 9.5rem)",
          { lineHeight: "0.92", letterSpacing: "-0.03em", fontWeight: "200" },
        ],
        "display-lg": [
          "clamp(2.25rem, 1.3rem + 4.4vw, 6rem)",
          { lineHeight: "0.98", letterSpacing: "-0.02em", fontWeight: "200" },
        ],
        heading: [
          "clamp(1.5rem, 1rem + 2.2vw, 3.25rem)",
          { lineHeight: "1.08", letterSpacing: "-0.01em", fontWeight: "300" },
        ],
        subheading: [
          "clamp(1.05rem, 0.85rem + 1vw, 1.875rem)",
          { lineHeight: "1.2", letterSpacing: "0", fontWeight: "300" },
        ],
        body: [
          "clamp(0.95rem, 0.85rem + 0.5vw, 1.375rem)",
          { lineHeight: "1.45", letterSpacing: "0", fontWeight: "300" },
        ],
        caption: [
          "clamp(0.72rem, 0.62rem + 0.34vw, 1rem)",
          { lineHeight: "1.3", letterSpacing: "0.16em", fontWeight: "400" },
        ],
      },
      backdropBlur: {
        xs: "2px",
      },
      // Motion system - transform/opacity only for GPU-accelerated 60 FPS on Pi.
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translate3d(0, 1.25rem, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "fade-in-down": {
          from: { opacity: "0", transform: "translate3d(0, -0.75rem, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "0.7" },
          "70%": { transform: "scale(1.4)", opacity: "0" },
          "100%": { transform: "scale(0.95)", opacity: "0" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
        // Mic: idle ambient halo
        "glow-pulse": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.08)" },
        },
        // Mic: processing orbit
        orbit: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "orbit-reverse": {
          from: { transform: "rotate(360deg)" },
          to: { transform: "rotate(0deg)" },
        },
        // Mic: speaking waveform bars
        wave: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        // Status dot soft beacon
        beacon: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        // Ambient backdrop drift
        "aurora-drift": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)", opacity: "0.55" },
          "50%": { transform: "translate3d(2%, -2%, 0) scale(1.06)", opacity: "0.8" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s var(--ease-out-expo) forwards",
        "fade-in-up": "fade-in-up 0.7s var(--ease-out-expo) forwards",
        "fade-in-down": "fade-in-down 0.5s var(--ease-out-expo) forwards",
        "fade-in-scale": "fade-in-scale 0.6s var(--ease-out-expo) forwards",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        breathe: "breathe 4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3.6s ease-in-out infinite",
        orbit: "orbit 3s linear infinite",
        "orbit-reverse": "orbit-reverse 5s linear infinite",
        wave: "wave 1s ease-in-out infinite",
        beacon: "beacon 2s ease-in-out infinite",
        "aurora-drift": "aurora-drift 18s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
