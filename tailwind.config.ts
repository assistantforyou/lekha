import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FAF7F2",
          100: "#F3EDE4",
          200: "#EDE5DA",
          300: "#DDD0C3",
          400: "#C4B5A6",
          500: "#A89688",
        },
        terra: {
          50: "#FAF0EA",
          100: "#F5DFD0",
          200: "#E8B89B",
          300: "#D99070",
          400: "#C5714B",
          500: "#A85C38",
          600: "#8C4A2A",
          700: "#6E3A20",
        },
        charcoal: {
          100: "#E0D6CE",
          200: "#C8BAB0",
          400: "#9E8E82",
          500: "#6B5E52",
          700: "#3D3528",
          900: "#1F1B16",
        },
        sage: {
          400: "#7EA68A",
          500: "#5E8B73",
          600: "#4A7060",
          bg: "#EDF5F1",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 8px rgba(197,113,75,0.08), 0 1px 3px rgba(31,27,22,0.05)",
        "card-hover": "0 6px 20px rgba(197,113,75,0.12), 0 2px 6px rgba(31,27,22,0.06)",
        accent: "0 1px 4px rgba(197,113,75,0.28)",
        "accent-hover": "0 3px 12px rgba(197,113,75,0.40)",
      },
      maxWidth: {
        "content-base": "680px",
        "content-wide": "1100px",
      },
    },
  },
};

export default config;
