import type { Page } from "playwright-core";
import {
  GAME_WATCH_HEARTBEAT_MS,
  MAXIMUM_GAME_WATCH_FRAME_BASE64,
  type GameRunWatchEvent,
} from "../../game-run-watch.js";

export function jpegDimensions(data: string) {
  const bytes = Buffer.from(data, "base64");
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8)
    throw new Error("Run watch received a non-JPEG frame.");
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error("Invalid JPEG marker.");
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) break;
      return {
        width: bytes.readUInt16BE(offset + 7),
        height: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += length + 2;
  }
  throw new Error("Run watch JPEG dimensions are unavailable.");
}

export async function startGameScreencast({
  page,
  send,
  onError,
  onReady,
}: {
  page: Page;
  send: (event: GameRunWatchEvent, sent: (error: Error | null) => void) => void;
  onError: (error: Error) => void;
  onReady: (dimensions: { width: number; height: number }) => void;
}) {
  const viewport = page.viewportSize();
  if (!viewport)
    throw new Error("Run watch requires an explicit capture viewport.");
  const scale = Math.min(1, 1280 / Math.max(viewport.width, viewport.height));
  const connection = await page.context().newCDPSession(page);
  let closed = false;
  let sending = false;
  let pending: GameRunWatchEvent | undefined;
  let heartbeat: GameRunWatchEvent | undefined;
  let sequence = 0;
  let lastFrameSeq: number | null = null;
  const acknowledgements: number[] = [];
  let acknowledgementTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let nextAcknowledgementAt = 0;
  const acknowledge = () => {
    if (closed || acknowledgementTimer || !acknowledgements.length) return;
    acknowledgementTimer = setTimeout(
      () => {
        acknowledgementTimer = undefined;
        if (closed) return;
        const sessionId = acknowledgements.shift();
        if (sessionId === undefined) return;
        nextAcknowledgementAt = performance.now() + 1000 / 15;
        void connection
          .send("Page.screencastFrameAck", { sessionId })
          .then(acknowledge, (error: Error) => {
            if (!closed) onError(error);
          });
      },
      Math.max(0, nextAcknowledgementAt - performance.now()),
    );
  };
  const flush = () => {
    if (closed || sending) return;
    const event = heartbeat ?? pending;
    if (!event) return;
    if (event.type === "frame") pending = undefined;
    else heartbeat = undefined;
    sending = true;
    send(event, (error) => {
      sending = false;
      if (closed) return;
      if (error) {
        onError(error);
        return;
      }
      flush();
    });
  };
  const pageClosed = () => {
    if (!closed) onError(new Error("Watched game surface closed."));
  };
  page.once("close", pageClosed);
  connection.on("Page.screencastFrame", (frame) => {
    if (closed) return;
    if (acknowledgements.length >= 4) {
      onError(new Error("Run watch capture flow control exceeded."));
      return;
    }
    acknowledgements.push(frame.sessionId);
    acknowledge();
    try {
      if (frame.data.length > MAXIMUM_GAME_WATCH_FRAME_BASE64)
        throw new Error("Run watch frame exceeds its transfer allowance.");
      if (frame.metadata.timestamp === undefined)
        throw new Error("Run watch frame is missing its capture timestamp.");
      if (sequence === 0) {
        onReady(jpegDimensions(frame.data));
        heartbeatTimer = setInterval(() => {
          heartbeat = { type: "heartbeat", at: Date.now(), lastFrameSeq };
          flush();
        }, GAME_WATCH_HEARTBEAT_MS);
      }
      lastFrameSeq = sequence++;
      pending = {
        type: "frame",
        seq: lastFrameSeq,
        capturedAt: frame.metadata.timestamp * 1000,
        data: frame.data,
      };
      flush();
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  });
  const close = async () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeatTimer);
    clearTimeout(acknowledgementTimer);
    acknowledgements.length = 0;
    pending = undefined;
    heartbeat = undefined;
    page.off("close", pageClosed);
    try {
      await connection.detach();
    } catch (error) {
      if (!page.isClosed()) throw error;
    }
  };
  try {
    await connection.send("Page.startScreencast", {
      format: "jpeg",
      quality: 75,
      maxWidth: Math.floor(viewport.width * scale),
      maxHeight: Math.floor(viewport.height * scale),
      everyNthFrame: 1,
    });
    return { close };
  } catch (error) {
    await close();
    throw error;
  }
}
