import { Badge } from "@/components/ui/badge";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";

export interface PreBlockProps extends HTMLAttributes<HTMLPreElement> {
  children?: ReactNode;
  filename?: string;
  title?: string;
}

function isReactElement(node: ReactNode): node is ReactElement {
  return typeof node === "object" && node !== null && "props" in node;
}

/**
 * Custom pre block component for docs with file title and language badge
 */
export default function PreBlock({ ...props }: PreBlockProps) {
  let className: string | undefined = undefined;
  if (isReactElement(props.children)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    className = props.children.props.className;
  }

  const language = className?.match(/language-(\w+)/)?.[1];
  const fileName =
    props?.filename?.replaceAll('"', "") || props?.title?.replaceAll('"', "");

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

  return (
    <div className="border-border/50 my-6 overflow-hidden rounded-2xl border bg-zinc-950">
      {(fileName || language) && (
        <div className="border-border/50 flex items-center justify-between border-b bg-zinc-900/50 px-4 py-2.5">
          <div className="flex items-center gap-2">
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
          {language && (
            <Badge variant="outline" className="text-xs">
              {formatLanguage(language)}
            </Badge>
          )}
        </div>
      )}

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
