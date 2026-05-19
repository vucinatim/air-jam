import { WebsiteAnalytics } from "@/components/analytics/website-analytics";
import { getSiteUrl } from "@/lib/site-url";
import { TRPCReactProvider } from "@/trpc/react";
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

const siteUrl = getSiteUrl();
const siteName = "Air Jam";
const siteTitle =
  "Air Jam — Phone-controller multiplayer games for the AI era";
const siteDescription =
  "Open-source framework for QR-code multiplayer party games. Networking, rooms, and input pipelines handled — bring the game, deploy anywhere, play on any phone.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | Air Jam",
  },
  description: siteDescription,
  applicationName: siteName,
  authors: [{ name: "Tim Vučina", url: "https://github.com/vucinatim" }],
  creator: "Tim Vučina",
  publisher: siteName,
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: siteTitle,
    description: siteDescription,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  logo: `${siteUrl}/images/airjam-logo.png`,
  sameAs: [
    "https://github.com/vucinatim/air-jam",
    "https://www.npmjs.com/package/@air-jam/sdk",
    "https://www.npmjs.com/package/@air-jam/server",
    "https://www.npmjs.com/package/create-airjam",
    "https://dev.to/zerodays",
    "https://zerodays.dev",
  ],
};

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteName,
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description: siteDescription,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Person",
    name: "Tim Vučina",
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareApplicationJsonLd),
          }}
        />
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <WebsiteAnalytics />
      </body>
    </html>
  );
}
