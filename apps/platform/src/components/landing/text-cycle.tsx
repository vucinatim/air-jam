"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

const STAGGER_MS = 18;
const ENTER_DURATION_MS = 350;
const EXIT_DURATION_MS = 210;
const EXIT_STAGGER_FACTOR = 0.5;
const ENTER_Y_PX = 8;
const EXIT_Y_PX = -8;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

type TextCycleProps = {
  phrases: readonly string[];
  holdDuration?: number;
  className?: string;
};

type PhraseLayerKind = "enter" | "steady" | "exit";

const splitLetters = (text: string): string[] =>
  [...text].map((char) => (char === " " ? "\u00A0" : char));

const createPhraseLayer = (
  text: string,
  kind: PhraseLayerKind,
): HTMLSpanElement => {
  const layer = document.createElement("span");
  layer.className = "airjam-text-cycle-layer";
  layer.dataset.kind = kind;

  for (const [index, char] of splitLetters(text).entries()) {
    const letter = document.createElement("span");
    letter.className = "airjam-text-cycle-letter";
    letter.textContent = char;
    letter.style.setProperty("--airjam-letter-index", String(index));
    layer.append(letter);
  }

  return layer;
};

const enterDurationForText = (text: string): number =>
  Math.max(ENTER_DURATION_MS, ENTER_DURATION_MS + (text.length - 1) * STAGGER_MS);

const exitDurationForText = (text: string): number =>
  Math.max(
    EXIT_DURATION_MS,
    EXIT_DURATION_MS + (text.length - 1) * STAGGER_MS * EXIT_STAGGER_FACTOR,
  );

export function TextCycle({
  phrases,
  holdDuration = 3500,
  className,
}: TextCycleProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const liveRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const live = liveRef.current;
    const normalizedPhrases = phrases.filter(Boolean);

    if (!root || !live || normalizedPhrases.length === 0) {
      return;
    }

    let disposed = false;
    let currentIndex = 0;
    let currentLayer: HTMLSpanElement | null = null;
    const timeouts = new Set<number>();

    const clearTimers = () => {
      for (const timeout of timeouts) {
        window.clearTimeout(timeout);
      }
      timeouts.clear();
    };

    const schedule = (callback: () => void, delay: number) => {
      const timeout = window.setTimeout(() => {
        timeouts.delete(timeout);
        if (!disposed) {
          callback();
        }
      }, delay);
      timeouts.add(timeout);
    };

    const setLiveText = (text: string) => {
      live.textContent = text;
    };

    const setCurrentLayer = (layer: HTMLSpanElement) => {
      root.replaceChildren(layer);
      currentLayer = layer;
    };

    const showStaticPhrase = (text: string) => {
      const layer = createPhraseLayer(text, "steady");
      setCurrentLayer(layer);
      setLiveText(text);
    };

    const runAnimatedCycle = () => {
      const nextIndex = (currentIndex + 1) % normalizedPhrases.length;
      const nextText = normalizedPhrases[nextIndex]!;
      const incomingLayer = createPhraseLayer(nextText, "enter");
      const outgoingLayer = currentLayer;

      setLiveText(nextText);

      if (outgoingLayer) {
        outgoingLayer.dataset.kind = "exit";
      }

      root.append(incomingLayer);
      currentLayer = incomingLayer;

      const cleanupDelay = Math.max(
        exitDurationForText(outgoingLayer?.textContent ?? ""),
        enterDurationForText(nextText),
      );

      schedule(() => {
        if (outgoingLayer?.isConnected) {
          outgoingLayer.remove();
        }
        incomingLayer.dataset.kind = "steady";
      }, cleanupDelay);

      currentIndex = nextIndex;
      schedule(runAnimatedCycle, holdDuration);
    };

    showStaticPhrase(normalizedPhrases[0]!);
    currentIndex = 0;

    if (normalizedPhrases.length === 1) {
      return () => {
        disposed = true;
        clearTimers();
      };
    }

    if (reduceMotion) {
      const tick = () => {
        currentIndex = (currentIndex + 1) % normalizedPhrases.length;
        showStaticPhrase(normalizedPhrases[currentIndex]!);
        setLiveText(normalizedPhrases[currentIndex]!);
        schedule(tick, holdDuration);
      };

      schedule(tick, holdDuration);
      return () => {
        disposed = true;
        clearTimers();
      };
    }

    schedule(runAnimatedCycle, holdDuration);

    return () => {
      disposed = true;
      clearTimers();
    };
  }, [holdDuration, phrases, reduceMotion]);

  return (
    <>
      <style jsx global>{`
        .airjam-text-cycle-root {
          display: inline-grid;
          max-width: 100%;
          align-items: center;
          justify-items: center;
          overflow: hidden;
        }

        .airjam-text-cycle-layer {
          grid-area: 1 / 1;
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          will-change: opacity, transform;
        }

        .airjam-text-cycle-letter {
          display: inline-block;
          white-space: pre;
          opacity: 0;
          transform: translateY(${ENTER_Y_PX}px);
          animation-duration: ${ENTER_DURATION_MS}ms;
          animation-timing-function: ${EASE};
          animation-fill-mode: forwards;
          animation-delay: calc(var(--airjam-letter-index) * ${STAGGER_MS}ms);
          will-change: opacity, transform;
        }

        .airjam-text-cycle-layer[data-kind="enter"] .airjam-text-cycle-letter {
          animation-name: airjam-text-cycle-enter;
        }

        .airjam-text-cycle-layer[data-kind="steady"] .airjam-text-cycle-letter {
          opacity: 1;
          transform: translateY(0);
          animation: none;
        }

        .airjam-text-cycle-layer[data-kind="exit"] .airjam-text-cycle-letter {
          opacity: 1;
          transform: translateY(0);
          animation-name: airjam-text-cycle-exit;
          animation-duration: ${EXIT_DURATION_MS}ms;
          animation-delay: calc(
            var(--airjam-letter-index) * ${STAGGER_MS * EXIT_STAGGER_FACTOR}ms
          );
        }

        @keyframes airjam-text-cycle-enter {
          from {
            opacity: 0;
            transform: translateY(${ENTER_Y_PX}px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes airjam-text-cycle-exit {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(${EXIT_Y_PX}px);
          }
        }

        .airjam-text-cycle-live {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
      <span className={`relative ${className ?? ""}`} aria-live="polite" aria-atomic="true">
        <span ref={liveRef} className="airjam-text-cycle-live" />
        <span
          ref={rootRef}
          className="airjam-text-cycle-root"
          aria-hidden="true"
        />
      </span>
    </>
  );
}
