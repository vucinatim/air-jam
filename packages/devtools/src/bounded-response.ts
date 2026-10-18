/** A response body exceeded its caller's transfer budget and was cancelled. */
export class BodyLimitError extends Error {}

/** Read a body as UTF-8 text, cancelling it on failure or beyond `maxBytes`. */
export async function readBoundedText(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes)
        throw new BodyLimitError(`Response exceeded ${maxBytes} bytes.`);
      chunks.push(next.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, bytes).toString("utf8");
}
