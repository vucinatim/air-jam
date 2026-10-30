import type { HostRuntimeFault } from "./contracts/observation";

/** Keep the original exception bounded and independent of browser Error objects. */
export function hostRuntimeFault(error: unknown): HostRuntimeFault {
  const detail = error instanceof Error ? error : null;
  const stack = detail?.stack?.slice(0, 8192) ?? "";
  let source: HostRuntimeFault["source"] = null;
  for (const frame of stack.split("\n")) {
    // V8's `at fn (file:line:column)` and Firefox/Safari's `fn@file:line:column`.
    const match = frame.match(
      /^(?:\s*at\s+(?:.*?\s+\()?|[^@]*@)(.+?):(\d+):(\d+)\)?\s*$/,
    );
    if (!match) continue;
    let file = match[1];
    if (
      /(?:node_modules|packages\/sdk\/|@air-jam\/sdk|@air-jam_sdk|node:|<anonymous>)/.test(
        file,
      )
    )
      continue;
    try {
      file = new URL(file).pathname;
    } catch {
      file = file.split(/[?#]/)[0];
    }
    const src = file.indexOf("/src/");
    if (src >= 0) file = file.slice(src + 1);
    const line = Number(match[2]);
    const column = Number(match[3]);
    if (
      !Number.isSafeInteger(line) ||
      !Number.isSafeInteger(column) ||
      line < 1 ||
      column < 1
    )
      continue;
    source = { file: file.slice(0, 2048), line, column };
    break;
  }
  return {
    name: (detail?.name || "Error").slice(0, 128),
    message: (detail?.message ?? String(error)).slice(0, 2048),
    source,
    stack,
  };
}

export function describeHostRuntimeFault(fault: HostRuntimeFault): string {
  const location = fault.source;
  return `${fault.name}: ${fault.message}${location ? ` at ${location.file}:${location.line}:${location.column}` : ""}`;
}
