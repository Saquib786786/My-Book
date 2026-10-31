import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { gold: "#b98a4a", cream: "#f0e2c6", wine: "#6e1f2a" } } },
  plugins: [],
};
export default config;
