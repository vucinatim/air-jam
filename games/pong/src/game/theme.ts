import { defineAirJamTheme } from "@air-jam/sdk/core";

export const pongTheme = defineAirJamTheme({
  colors: {
    panelGradientStart: "rgba(255,255,255,0.08)",
    panelGradientEnd: "rgba(255,255,255,0.03)",
    controllerPanel: "rgba(12,18,33,0.92)",
    controllerBackground: "#02040a",

    background: "#050816",
    backgroundDeep: "#02030a",
    surface: "rgba(8, 12, 24, 0.82)",
    surfaceStrong: "rgba(9, 12, 23, 0.94)",
    border: "rgba(255, 255, 255, 0.14)",
    borderStrong: "rgba(255, 255, 255, 0.22)",
    text: "#f8fafc",
    textSoft: "rgba(226, 232, 240, 0.78)",
    textMuted: "rgba(148, 163, 184, 0.72)",
    team1: "#f97316",
    team2: "#38bdf8",
    statusBackground: "rgba(255, 255, 255, 0.05)",
    team1Glow: "rgba(249, 115, 22, 0.18)",
    team2Glow: "rgba(56, 189, 248, 0.18)",
    white: "#ffffff",
    panelBorder: "rgba(255,255,255,0.12)",
    controllerAccent: "#bae6fd",
    arenaMarkings: "rgba(255,255,255,0.18)",
    arenaBackground: "#09090b",
    centerLineColor: "#3f3f46",
    botAccent: "#22d3ee",
  },
  fonts: {
    canvas: "Arial",
    display: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif',
  },
});
