"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

type RevealProps = {
  children: ReactNode;
  /** Extra delay in seconds (useful for staggered lists). */
  delay?: number;
  /** Viewport margin for triggering. */
  margin?: string;
  className?: string;
};

/**
 * Shared scroll-reveal wrapper. Reduces the repeated motion boilerplate
 * across landing sections to a single `motion.div`.
 */
export const Reveal = ({
  children,
  delay = 0,
  margin = "-80px",
  className,
}: RevealProps) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin }}
      transition={{
        duration: 0.45,
        delay: reduceMotion ? 0 : delay,
        ease: EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
