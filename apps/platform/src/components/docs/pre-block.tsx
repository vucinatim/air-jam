"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import {
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  useState,
  useSyncExternalStore,
} from "react";

export interface PreBlockProps extends HTMLAttributes<HTMLPreElement> {
  children?: ReactNode;
  filename?: string;
  title?: string;
}

function isReactElement(node: ReactNode): node is ReactElement {
  return typeof node === "object" && node !== null && "props" in node;
}

const emptySubscribe = () => () => {};

/**
 * Custom pre block component for docs with file title and language badge
 * Uses client-side only rendering to avoid hydration mismatches with Shiki
 */
export default function PreBlock({ ...props }: PreBlockProps) {
  const [copied, setCopied] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  let className: string | undefined = undefined;
  let codeProps: { "data-meta"?: string; filename?: string } = {};
  if (isReactElement(props.children)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    className = props.children.props.className;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    codeProps = props.children.props;
  }

  const language = className?.match(/language-(\w+)/)?.[1];

  // Extract filename from props, title, or data-meta attribute
  const fileName =
    props?.filename?.replaceAll('"', "") ||
    props?.title?.replaceAll('"', "") ||
    codeProps?.filename?.replaceAll('"', "") ||
    (() => {
      const meta = codeProps?.["data-meta"] || "";
      const filenameMatch = meta.match(/filename="([^"]+)"/);
      const fileMatch = meta.match(/file="([^"]+)"/);
      return filenameMatch ? filenameMatch[1] : fileMatch ? fileMatch[1] : null;
    })();

  /**
   * Extracts text content from the code element recursively
   */
  const extractCodeText = (node: ReactNode): string => {
    if (typeof node === "string") {
      return node;
    }
    if (typeof node === "number") {
      return String(node);
    }
    if (Array.isArray(node)) {
      return node.map(extractCodeText).join("");
    }
    if (isReactElement(node)) {
      const props = node.props as { children?: ReactNode };
      if (props?.children) {
        return extractCodeText(props.children);
      }
    }
    return "";
  };

  const handleCopy = async () => {
    const codeText = extractCodeText(props.children);
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  // Format language name for display
  const formatLanguage = (lang: string) => {
    const langMap: Record<string, string> = {
      ts: "TypeScript",
      tsx: "TSX",
      js: "JavaScript",
      jsx: "JSX",
      json: "JSON",
      css: "CSS",
      html: "HTML",
      md: "Markdown",
      py: "Python",
      rs: "Rust",
      go: "Go",
      typescript: "TypeScript",
      javascript: "JavaScript",
    };
    return (
      langMap[lang.toLowerCase()] ||
      lang.charAt(0).toUpperCase() + lang.slice(1)
    );
  };

  // Render a placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="border-border/50 my-6 overflow-hidden rounded-2xl border bg-zinc-950">
        <div className="border-border/50 flex items-center justify-between border-b bg-zinc-900/50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {language && (
              <Badge variant="outline" className="text-xs">
                {formatLanguage(language)}
              </Badge>
            )}
            {fileName && (
              <>
                <svg
                  className="text-muted-foreground h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="text-muted-foreground font-mono text-sm">
                  {fileName}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              aria-label="Copy code"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <pre
            className="m-0! overflow-x-auto rounded-none border-0 bg-[#111111] px-4 py-4 text-sm"
            style={{ backgroundColor: "#111111" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border-border/50 my-6 overflow-hidden rounded-2xl border bg-zinc-950">
      <div className="border-border/50 flex items-center justify-between border-b bg-zinc-900/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {language && (
            <Badge variant="outline" className="text-xs">
              {formatLanguage(language)}
            </Badge>
          )}
          {fileName && (
            <>
              <svg
                className="text-muted-foreground h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-muted-foreground font-mono text-sm">
                {fileName}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="relative">
        <pre
          className="m-0! overflow-x-auto rounded-none border-0 bg-[#111111] px-4 py-4 text-sm"
          style={{ backgroundColor: "#111111" }}
        >
          {props.children}
        </pre>
      </div>
    </div>
  );
}
