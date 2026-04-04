import { getSiteUrl } from "@/lib/site-url";
import { TRPCReactProvider } from "@/trpc/react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  return (
    <html lang="en" className="dark">
      {/* <head>
        <script
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan/dist/auto.global.js"
        />
      </head> */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground min-h-dvh antialiased`}
      >
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
