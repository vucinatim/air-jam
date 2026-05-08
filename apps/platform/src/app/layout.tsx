import { WebsiteAnalytics } from "@/components/analytics/website-analytics";
import { getSiteUrl } from "@/lib/site-url";
import { TRPCReactProvider } from "@/trpc/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const REACT_SCAN_ENABLED = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Air Jam Platform",
    template: "%s | Air Jam",
  },
  description:
    "Air Jam docs and platform for QR-code multiplayer controllers and SDK integration.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const enableReactScan =
    process.env.NODE_ENV !== "production" && REACT_SCAN_ENABLED;

  return (
    <html lang="en" className="dark">
      {enableReactScan ? (
        <head>
          <Script
            id="react-scan"
            crossOrigin="anonymous"
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            strategy="afterInteractive"
          />
        </head>
      ) : null}
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground min-h-dvh antialiased`}
      >
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <WebsiteAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
