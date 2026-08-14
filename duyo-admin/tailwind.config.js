/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // DUYO brand. Same hex values as duyo-landing/assets/base.css and the
        // web prototype's styles/theme.css — the three surfaces share one
        // palette, so a colour picked here must be changed in all three.
        duyo: {
          blue: "#2563EB",
          dark: "#1D4ED8",
          navy: "#102033",
          yellow: "#FFC700",
          sky: "#F4F8FF",
          50: "#EFF6FF",
          100: "#DBEAFE",
        },
        // Safety palette (GREEN safe / YELLOW warning / ORANGE serious / RED urgent).
        // Deliberately NOT the brand green/yellow/red: these are darkened for
        // contrast against their own light backgrounds, because a moderator
        // reads a crisis level as small text, not as a brand accent.
        safe: { DEFAULT: "#16A34A", bg: "#ECFDF5", line: "#A7F3D0" },
        warn: { DEFAULT: "#CA8A04", bg: "#FEFCE8", line: "#FDE68A" },
        serious: { DEFAULT: "#EA580C", bg: "#FFF7ED", line: "#FED7AA" },
        urgent: { DEFAULT: "#DC2626", bg: "#FEF2F2", line: "#FECACA" },
        // Neutral surfaces — shared with the landing and the prototype.
        bg: "#F4F8FF",
        surface: "#FFFFFF",
        ink: "#102033",
        muted: "#64748B",
        line: "#E6EDF7",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: { xl: "0.875rem", "2xl": "1rem" },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15,23,42,0.04), 0 1px 3px 0 rgba(15,23,42,0.06)",
      },
    },
  },
  plugins: [],
};
