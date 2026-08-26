"use client";

import {
  startProductTelemetryBrowserCollection,
  trackProductPageView,
} from "@/lib/product-telemetry-client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const ProductTelemetry = () => {
  const pathname = usePathname();

  useEffect(() => startProductTelemetryBrowserCollection(), []);

  useEffect(() => {
    trackProductPageView(pathname);
  }, [pathname]);

  return null;
};
