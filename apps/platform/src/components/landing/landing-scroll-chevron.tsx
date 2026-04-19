"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const AT_TOP_THRESHOLD_PX = 48;

export const LandingScrollChevron = () => {
  const [atTop, setAtTop] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => {
      setAtTop(window.scrollY <= AT_TOP_THRESHOLD_PX);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {atTop ? (
        <motion.div
          key="scroll-chevron"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2"
          aria-hidden="true"
        >
          <motion.div
            animate={
              reduceMotion
                ? {}
                : {
                    y: [0, 8, 0],
                  }
            }
            transition={{
              repeat: Infinity,
              duration: 1.6,
              ease: [0.45, 0, 0.55, 1],
            }}
          >
            <ChevronDown
              className="text-foreground/45 h-8 w-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
              strokeWidth={2.25}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
