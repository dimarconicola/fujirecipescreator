import { createTheme } from "@mantine/core";

export const appTheme = createTheme({
  primaryColor: "cyan",
  fontFamily:
    "'Manrope Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily: "'Space Grotesk', 'Manrope Variable', sans-serif",
    fontWeight: "600",
  },
  defaultRadius: "md",
  white: "#f4f7fb",
  black: "#070b10",
  colors: {
    graphite: [
      "#e7eef9",
      "#ced9ea",
      "#a9b7cb",
      "#8898b0",
      "#6a7d98",
      "#596c87",
      "#4e617b",
      "#43546b",
      "#39495a",
      "#2e3c4a",
    ],
  },
});

