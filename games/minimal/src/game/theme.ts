import { defineAirJamTheme } from "@air-jam/sdk/core";

export const minimalTheme = defineAirJamTheme({
  colors: {
    background: "#0a0a0a",
    foreground: "#fafafa",
  },
  fonts: {
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
});
