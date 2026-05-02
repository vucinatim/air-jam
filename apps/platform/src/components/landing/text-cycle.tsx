"use client";

import {
  AnimatePresence,
  type Transition,
  motion,
  useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

/** Per-letter stagger in seconds. */
const STAGGER = 0.018;
/** Duration of each individual letter animation. */
const LETTER_DURATION = 0.35;
/** Easing curve -- smooth deceleration. */
const EASE: Transition["ease"] = [0.22, 1, 0.36, 1];

type TextCycleProps = {
  phrases: readonly string[];
  /** Milliseconds each phrase stays visible before transitioning. */
  holdDuration?: number;
  className?: string;
};

/**
 * A single phrase rendered as individually-animated letters.
 * Enter: letters fade+slide in from below, staggered left-to-right.
 * Exit: letters fade+slide out upward, staggered left-to-right (same direction).
 * The new phrase chases/replaces the old one.
 */
function WavePhrase({ text }: { text: string }) {
  const letters = [...text].map((ch) => (ch === " " ? "\u00A0" : ch));

  return (
    <motion.span
      className="col-start-1 row-start-1 inline-flex flex-wrap items-center justify-center"
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {letters.map((char, i) => (
        <motion.span
          key={i}
          className="inline-block whitespace-pre"
          variants={{
            hidden: {
              opacity: 0,
              y: 8,
              filter: "blur(4px)",
            },
            visible: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: {
                duration: LETTER_DURATION,
                ease: EASE,
                delay: i * STAGGER,
              },
            },
            exit: {
              opacity: 0,
              y: -8,
              filter: "blur(4px)",
              transition: {
                duration: LETTER_DURATION * 0.6,
                ease: EASE,
                // Same left-to-right stagger on exit
                delay: i * STAGGER * 0.5,
              },
            },
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

/**
 * Cycles through phrases with a per-letter wave animation.
 * Exit and enter overlap -- the new phrase chases the old one out.
 */
export function TextCycle({
  phrases,
  holdDuration = 3500,
  className,
}: TextCycleProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, holdDuration);
  }, [holdDuration, phrases.length]);

  useEffect(() => {
    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, scheduleNext]);

  if (reduceMotion) {
    return (
      <span
        className={`relative inline-flex items-center justify-center ${className ?? ""}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="inline-block"
          >
            {phrases[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    );
  }

  return (
    <span
      className={`inline-grid max-w-full items-center justify-center overflow-hidden ${className ?? ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence initial={false}>
        <WavePhrase key={index} text={phrases[index]!} />
      </AnimatePresence>
    </span>
  );
}
