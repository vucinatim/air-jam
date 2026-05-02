import { CopyCodeButton } from "@/components/docs/copy-code-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type HTMLAttributes, type ReactElement, type ReactNode } from "react";

export interface PreBlockProps extends HTMLAttributes<HTMLPreElement> {
  children?: ReactNode;
  filename?: string;
  title?: string;
}

function isReactElement(node: ReactNode): node is ReactElement {
  return typeof node === "object" && node !== null && "props" in node;
}

function extractCodeText(node: ReactNode): string {
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
    if (props.children) {
      return extractCodeText(props.children);
    }
  }
  return "";
}

/**
 * Server-rendered docs pre block so crawlers and LLM agents can index code.
 * Copy behavior is delegated to a tiny client component.
 */
export default function PreBlock({
  children,
  className,
  filename,
  title,
  ...preProps
}: PreBlockProps) {
  let codeClassName: string | undefined = undefined;
  let codeProps: {
    "data-meta"?: string;
    filename?: string;
    "data-language"?: string;
  } = {};
  if (isReactElement(children)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    codeClassName = children.props.className;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    codeProps = children.props;
  }

  const language =
    codeProps["data-language"] || codeClassName?.match(/language-(\w+)/)?.[1];

  // Extract filename from props, title, or data-meta attribute
  const fileName =
    filename?.replaceAll('"', "") ||
    title?.replaceAll('"', "") ||
    codeProps?.filename?.replaceAll('"', "") ||
    (() => {
      const meta = codeProps?.["data-meta"] || "";
      const filenameMatch = meta.match(/filename="([^"]+)"/);
      const fileMatch = meta.match(/file="([^"]+)"/);
      return filenameMatch ? filenameMatch[1] : fileMatch ? fileMatch[1] : null;
    })();
  const codeText = extractCodeText(children);

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
    <div className="border-border/50 my-6 max-w-full min-w-0 overflow-hidden rounded-2xl border bg-zinc-950">
      <div className="border-border/50 bg-sidebar flex min-w-0 items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
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
              <span className="text-muted-foreground min-w-0 truncate font-mono text-sm">
                {fileName}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CopyCodeButton code={codeText} />
        </div>
      </div>

      <div className="relative min-w-0">
        <pre
          {...preProps}
          className={cn(
            "m-0! max-w-full min-w-0 overflow-x-auto rounded-none border-0 px-4 py-4 text-sm",
            className,
          )}
        >
          {children}
        </pre>
      </div>
    </div>
  );
}
