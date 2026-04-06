import { Check, Copy, Maximize2, Minimize2, RefreshCw, RotateCcw } from "lucide-react";
import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ErrorInfo, JSX, ReactNode } from "react";
import { emitAirJamDiagnostic } from "../diagnostics";
import { AIRJAM_DEV_LOG_EVENTS } from "../protocol";
import { emitAirJamDevRuntimeEvent } from "./dev-runtime-events";

export type AirJamRuntimeRole = "host" | "controller";

interface AirJamRuntimeErrorContext {
  role: AirJamRuntimeRole;
  roomId?: string;
  appId?: string;
}

export interface AirJamErrorFallbackRenderProps extends AirJamRuntimeErrorContext {
  error: Error;
  reset: () => void;
  reload: () => void;
  isEmbedded: boolean;
}

export type AirJamErrorFallbackRenderer = (
  props: AirJamErrorFallbackRenderProps,
) => JSX.Element;

export interface AirJamErrorBoundaryProps extends AirJamRuntimeErrorContext {
  children: ReactNode;
  renderFallback?: AirJamErrorFallbackRenderer;
  onError?: (
    error: Error,
    errorInfo: ErrorInfo,
    context: AirJamRuntimeErrorContext,
  ) => void;
}

interface AirJamErrorBoundaryState {
  error: Error | null;
}

const toError = (value: unknown): Error => {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === "string") {
    return new Error(value);
  }
  return new Error("Unknown runtime error");
};

const isEmbeddedRuntime = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.parent !== "undefined" &&
  window.parent !== window;

const roleLabel = (role: AirJamRuntimeRole): string =>
  role === "host" ? "Host runtime" : "Controller runtime";

const mono =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace";

const errorSurface = {
  bg: "#0a0a0a",
  panel: "#141414",
  panelBorder: "rgba(255, 255, 255, 0.08)",
  inset: "#0c0c0c",
  insetBorder: "rgba(255, 255, 255, 0.06)",
  text: "#fafafa",
  muted: "#a3a3a3",
  dim: "#737373",
  zOverlay: 2147483000,
} as const;

const iconSize = 16;

const createErrorDigest = (error: Error): string => {
  const input = `${error.name}:${error.message}:${error.stack ?? ""}`;
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

const copyTextToClipboard = async (text: string): Promise<void> => {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is unavailable");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const succeeded = typeof document.execCommand === "function"
    ? document.execCommand("copy")
    : false;

  document.body.removeChild(textarea);

  if (!succeeded) {
    throw new Error("Copy command failed");
  }
};

const createCopyPayload = ({
  role,
  roomId,
  appId,
  error,
  digest,
  isEmbedded,
}: {
  role: AirJamRuntimeRole;
  roomId?: string;
  appId?: string;
  error: Error;
  digest: string;
  isEmbedded: boolean;
}): string => {
  const lines = [
    "AirJam Runtime Error",
    `Role: ${role}`,
    `Digest: ${digest}`,
    `Embedded: ${isEmbedded ? "yes" : "no"}`,
    roomId ? `Room: ${roomId}` : null,
    appId ? `App ID: ${appId}` : null,
    `Error: ${error.message || "Unknown error"}`,
    "",
    "Stack:",
    error.stack ?? "(no stack)",
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
};

const btnRow: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.35rem",
  borderRadius: "0.5rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.8125rem",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
};

const DefaultFallback = ({
  role,
  roomId,
  appId,
  error,
  reset,
  reload,
  isEmbedded,
}: AirJamErrorFallbackRenderProps): JSX.Element => {
  const digest = createErrorDigest(error);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copyResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const scheduleCopyStatusReset = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopyState("idle");
      copyResetTimeoutRef.current = null;
    }, 1800);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await copyTextToClipboard(
        createCopyPayload({
          role,
          roomId,
          appId,
          error,
          isEmbedded,
          digest,
        }),
      );
      setCopyState("copied");
      scheduleCopyStatusReset();
    } catch {
      setCopyState("failed");
      scheduleCopyStatusReset();
    }
  }, [appId, digest, error, isEmbedded, role, roomId, scheduleCopyStatusReset]);

  const copyButtonLabel =
    copyState === "copied"
      ? "Copied"
      : copyState === "failed"
        ? "Copy failed"
        : "Copy details";

  const CopyGlyph =
    copyState === "copied" ? (
      <Check size={iconSize} strokeWidth={2} aria-hidden />
    ) : (
      <Copy size={iconSize} strokeWidth={2} aria-hidden />
    );

  if (isMinimized) {
    return (
      <>
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: errorSurface.zOverlay,
            background: "rgba(10, 10, 10, 0.72)",
          }}
        />
        <div
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1rem",
            zIndex: errorSurface.zOverlay + 1,
            maxWidth: "min(22rem, calc(100vw - 2rem))",
            borderRadius: "0.625rem",
            border: `1px solid ${errorSurface.panelBorder}`,
            background: errorSurface.panel,
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.55)",
            padding: "0.75rem 0.85rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  color: errorSurface.dim,
                  textTransform: "uppercase",
                }}
              >
                AirJam · runtime error
              </div>
              <div
                style={{
                  marginTop: "0.25rem",
                  fontSize: "0.75rem",
                  color: errorSurface.muted,
                  fontFamily: mono,
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                }}
              >
                {role} · {digest}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              aria-label="Expand error panel"
              title="Expand error panel"
              style={{
                ...btnRow,
                flexShrink: 0,
                border: `1px solid ${errorSurface.panelBorder}`,
                background: errorSurface.inset,
                color: errorSurface.text,
                padding: "0.4rem",
              }}
            >
              <Maximize2 size={iconSize} strokeWidth={2} aria-hidden />
            </button>
          </div>
          <div
            style={{
              marginTop: "0.65rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem",
            }}
          >
            <button
              type="button"
              onClick={() => {
                void handleCopy();
              }}
              style={{
                ...btnRow,
                border: `1px solid ${errorSurface.panelBorder}`,
                background: "transparent",
                color: errorSurface.muted,
              }}
            >
              {CopyGlyph}
              {copyButtonLabel}
            </button>
            <button
              type="button"
              onClick={reload}
              style={{
                ...btnRow,
                border: "none",
                background: errorSurface.text,
                color: errorSurface.bg,
              }}
            >
              <RefreshCw size={iconSize} strokeWidth={2} aria-hidden />
              Reload
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: errorSurface.bg,
        padding: "1.5rem 1rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "42rem",
          borderRadius: "0.625rem",
          border: `1px solid ${errorSurface.panelBorder}`,
          background: errorSurface.panel,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
          padding: "1.25rem 1.35rem",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          aria-label="Minimize error panel"
          title="Minimize error panel"
          style={{
            ...btnRow,
            position: "absolute",
            top: "0.85rem",
            right: "0.85rem",
            padding: "0.4rem",
            border: `1px solid ${errorSurface.panelBorder}`,
            background: errorSurface.inset,
            color: errorSurface.muted,
          }}
        >
          <Minimize2 size={iconSize} strokeWidth={2} aria-hidden />
        </button>

        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.04em",
            color: errorSurface.dim,
            textTransform: "uppercase",
            paddingRight: "2.5rem",
          }}
        >
          AirJam · runtime error · {role}
        </div>

        <h1
          style={{
            marginTop: "0.65rem",
            marginBottom: 0,
            fontSize: "1.25rem",
            lineHeight: 1.25,
            fontWeight: 600,
            color: errorSurface.text,
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            marginTop: "0.45rem",
            marginBottom: 0,
            fontSize: "0.8125rem",
            color: errorSurface.muted,
            lineHeight: 1.45,
          }}
        >
          {roleLabel(role)} hit an error. Details below.
        </p>

        <div
          style={{
            marginTop: "1rem",
            border: `1px solid ${errorSurface.insetBorder}`,
            borderRadius: "0.5rem",
            background: errorSurface.inset,
            padding: "0.75rem 0.85rem",
            fontSize: "0.75rem",
            color: errorSurface.muted,
            fontFamily: mono,
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          <div>
            <span style={{ color: errorSurface.dim }}>Digest </span>
            {digest}
          </div>
          {roomId ? (
            <div style={{ marginTop: "0.35rem" }}>
              <span style={{ color: errorSurface.dim }}>Room </span>
              {roomId}
            </div>
          ) : null}
          <div style={{ marginTop: "0.35rem" }}>
            <span style={{ color: errorSurface.dim }}>Error </span>
            {error.message || "Unknown error"}
          </div>
        </div>

        <details
          style={{
            marginTop: "0.75rem",
            fontSize: "0.75rem",
            color: errorSurface.muted,
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 500,
              color: errorSurface.muted,
              listStyle: "none",
            }}
          >
            Stack trace
          </summary>
          <pre
            style={{
              marginTop: "0.5rem",
              marginBottom: 0,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              border: `1px solid ${errorSurface.insetBorder}`,
              borderRadius: "0.45rem",
              background: errorSurface.inset,
              padding: "0.65rem 0.75rem",
              color: errorSurface.muted,
              fontFamily: mono,
              fontSize: "0.6875rem",
              lineHeight: 1.45,
            }}
          >
            {error.stack ?? error.message}
          </pre>
        </details>

        <div
          style={{
            marginTop: "1.1rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.45rem",
          }}
        >
          <button
            type="button"
            onClick={reload}
            style={{
              ...btnRow,
              border: "none",
              background: errorSurface.text,
              color: errorSurface.bg,
            }}
          >
            <RefreshCw size={iconSize} strokeWidth={2} aria-hidden />
            Reload
          </button>
          <button
            type="button"
            onClick={reset}
            style={{
              ...btnRow,
              border: `1px solid ${errorSurface.panelBorder}`,
              background: "transparent",
              color: errorSurface.text,
            }}
          >
            <RotateCcw size={iconSize} strokeWidth={2} aria-hidden />
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              void handleCopy();
            }}
            style={{
              ...btnRow,
              border: `1px solid ${errorSurface.panelBorder}`,
              background: "transparent",
              color: errorSurface.muted,
            }}
          >
            {CopyGlyph}
            {copyButtonLabel}
          </button>
        </div>

        {isEmbedded ? (
          <p
            style={{
              marginTop: "0.85rem",
              marginBottom: 0,
              fontSize: "0.6875rem",
              color: errorSurface.dim,
              lineHeight: 1.4,
              fontFamily: mono,
            }}
          >
            Embedded: if reload loops, exit and relaunch from the Arcade shell.
          </p>
        ) : null}
      </div>
    </div>
  );
};

export class AirJamErrorBoundary extends Component<
  AirJamErrorBoundaryProps,
  AirJamErrorBoundaryState
> {
  public state: AirJamErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: unknown): AirJamErrorBoundaryState {
    return {
      error: toError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { role, roomId, appId, onError } = this.props;
    const details = {
      role,
      roomId,
      appId,
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    };

    emitAirJamDiagnostic({
      code: "AJ_RUNTIME_RENDER_CRASH",
      severity: "error",
      message: `[AirJam] ${role} runtime crashed during render.`,
      details,
    });

    emitAirJamDevRuntimeEvent({
      event: AIRJAM_DEV_LOG_EVENTS.browser.runtime,
      level: "error",
      message: `AirJam ${role} runtime crashed during render`,
      role,
      roomId,
      code: "AJ_RUNTIME_RENDER_CRASH",
      data: details,
    });

    onError?.(error, errorInfo, {
      role,
      roomId,
      appId,
    });
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  private handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render(): JSX.Element {
    const { error } = this.state;
    const { children, role, roomId, appId, renderFallback } = this.props;

    if (!error) {
      return <>{children}</>;
    }

    const fallbackProps: AirJamErrorFallbackRenderProps = {
      role,
      roomId,
      appId,
      error,
      reset: this.handleReset,
      reload: this.handleReload,
      isEmbedded: isEmbeddedRuntime(),
    };

    if (renderFallback) {
      return renderFallback(fallbackProps);
    }

    return <DefaultFallback {...fallbackProps} />;
  }
}
