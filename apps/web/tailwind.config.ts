import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:    { DEFAULT: "#080808", 2: "#0f0f0f", 3: "#161616", 4: "#1e1e1e", 5: "#262626" },
        line:   "rgba(255,255,255,0.07)",
        t1:     "#f0f0f0",
        t2:     "#a0a0a0",
        t3:     "#555555",
        purple: { DEFAULT: "#8b5cf6", dim: "rgba(139,92,246,0.15)", glow: "rgba(139,92,246,0.25)", light: "#c084fc" },
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display-2xl": ["clamp(3rem,8vw,7rem)", { lineHeight: "0.92", letterSpacing: "-0.04em" }],
        "display-xl":  ["clamp(2.2rem,5vw,4.5rem)", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
        "display-lg":  ["clamp(1.8rem,4vw,3rem)", { lineHeight: "1", letterSpacing: "-0.025em" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        "purple-sm":  "0 0 16px rgba(139,92,246,0.25)",
        "purple-md":  "0 0 40px rgba(139,92,246,0.2), 0 0 80px rgba(139,92,246,0.1)",
        "purple-lg":  "0 0 60px rgba(139,92,246,0.3), 0 0 120px rgba(139,92,246,0.15)",
        "inset-line": "inset 0 1px 0 rgba(255,255,255,0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
