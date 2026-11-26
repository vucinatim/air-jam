import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { z } from "zod";
import { useAirJamConfig } from "../context/air-jam-context";
import { useAirJamHost } from "../hooks/use-air-jam-host";
import { embeddedRuntimeParent } from "./embedded-parent";

/**
 * An embedded game host tells the page around it once it is ready to be seen,
 * so that page can keep its own cover up until then instead of showing the
 * game assembling itself. Ready means the host has mounted, its fonts have
 * loaded, its room is connected, no `<HoldReveal />` is mounted, and that
 * state has been painted. The host says it once per document.
 */
export const AIRJAM_HOST_REVEAL = "AIRJAM_HOST_REVEAL" as const;

const hostRevealSchema = z
  .object({ type: z.literal(AIRJAM_HOST_REVEAL) })
  .strict();

/** The parent's side: whether `event` is the frame's reveal, sent by `frame` from `origin`. */
export const readHostReveal = (
  event: MessageEvent<unknown>,
  frame: Window,
  origin: string,
): boolean =>
  event.source === frame &&
  event.origin === origin &&
  hostRevealSchema.safeParse(event.data).success;

interface RevealHolds {
  count: () => number;
  hold: () => () => void;
  subscribe: (listener: () => void) => () => void;
}

const createRevealHolds = (): RevealHolds => {
  let count = 0;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    count: () => count,
    hold: () => {
      count += 1;
      notify();
      return () => {
        count -= 1;
        notify();
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const revealHoldsContext = createContext<RevealHolds | null>(null);

/**
 * Keeps the host hidden behind its page's cover while it is mounted. Render it
 * wherever the host is still loading what it needs to look right, most often
 * as a Suspense fallback: `<Suspense fallback={<HoldReveal />}>`. Once the host
 * has been revealed, holding again changes nothing. Outside a host it does
 * nothing.
 */
export const HoldReveal = (): null => {
  const holds = useContext(revealHoldsContext);
  useLayoutEffect(() => holds?.hold(), [holds]);
  return null;
};

/** Posts the reveal to `parent` once `connected`, fonts are loaded, nothing holds, and that frame has painted. */
export const RevealGate = ({
  parent,
  connected,
  children,
}: {
  parent: { window: Window; origin: string } | null;
  connected: boolean;
  children: ReactNode;
}): JSX.Element => {
  const [holds] = useState(createRevealHolds);
  const revealed = useRef(false);

  useEffect(() => {
    if (!parent || !connected || revealed.current) return;
    let active = true;
    let fontsReady = false;
    let frame = 0;
    // A hold released and another taken in the same commit must not reveal,
    // so readiness is judged on the next frame and confirmed once it paints.
    const check = () => {
      cancelAnimationFrame(frame);
      if (!active || !fontsReady || holds.count() > 0) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!active || holds.count() > 0) return;
          revealed.current = true;
          stop();
          parent.window.postMessage(
            { type: AIRJAM_HOST_REVEAL },
            parent.origin,
          );
        });
      });
    };
    const unsubscribe = holds.subscribe(check);
    function stop() {
      active = false;
      cancelAnimationFrame(frame);
      unsubscribe();
    }
    void document.fonts.ready.then(() => {
      fontsReady = true;
      check();
    });
    return stop;
  }, [connected, holds, parent]);

  return (
    <revealHoldsContext.Provider value={holds}>
      {children}
    </revealHoldsContext.Provider>
  );
};

/** The host runtime's reveal: an embedded host tells its parent when it is ready to be seen. */
export const HostReveal = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { topology } = useAirJamConfig();
  const connected = useAirJamHost(
    (state) => state.connectionStatus === "connected",
  );
  const parent = useMemo(() => embeddedRuntimeParent(topology), [topology]);
  return (
    <RevealGate parent={parent} connected={connected}>
      {children}
    </RevealGate>
  );
};
