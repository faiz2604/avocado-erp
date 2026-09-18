import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        avocado: {
          50: "#f2f7ed",
          100: "#e2edd6",
          200: "#c6dbae",
          300: "#a3c47e",
          400: "#82ac57",
          500: "#63903c",
          600: "#4c7230",
          700: "#3c5a28",
          800: "#324823",
          900: "#2b3d20",
          950: "#15210f"
        },
        pit: {
          500: "#8a5a3c",
          600: "#71472f"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
