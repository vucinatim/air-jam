"use client";

import { Reveal } from "@/components/landing/landing-motion";
import { Fragment } from "react";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

/** Splits on `<br/>` / `<br />` (optional surrounding whitespace) and inserts real line breaks. */
const subtitleWithBreaks = (text: string) => {
  const parts = text.split(/\s*<br\s*\/?>\s*/i);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? <br /> : null}
    </Fragment>
  ));
};

/**
 * Centered section heading used across multiple landing sections.
 */
export const SectionHeader = ({ title, subtitle }: SectionHeaderProps) => (
  <Reveal className="mx-auto max-w-3xl text-center">
    <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
      {title}
    </h2>
    {subtitle ? (
      <p className="text-muted-foreground/90 mt-5 text-base leading-relaxed text-pretty sm:text-lg">
        {subtitleWithBreaks(subtitle)}
      </p>
    ) : null}
  </Reveal>
);
