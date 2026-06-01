/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // DUYO brand
        duyo: {
          blue: "#2563EB",
          dark: "#1D4ED8",
          50: "#EFF6FF",
          100: "#DBEAFE",
        },
        // Safety palette (GREEN safe / YELLOW warning / ORANGE serious / RED urgent)
        safe: { DEFAULT: "#16A34A", bg: "#ECFDF5", line: "#A7F3D0" },
        warn: { DEFAULT: "#CA8A04", bg: "#FEFCE8", line: "#FDE68A" },
        serious: { DEFAULT: "#EA580C", bg: "#FFF7ED", line: "#FED7AA" },
        urgent: { DEFAULT: "#DC2626", bg: "#FEF2F2", line: "#FECACA" },
        // Neutral surfaces
        bg: "#F8FAFC",
        surface: "#FFFFFF",
        ink: "#0F172A",
        muted: "#64748B",
        line: "#E2E8F0",
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
