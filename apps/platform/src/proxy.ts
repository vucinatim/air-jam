import { createLoginHref } from "@/lib/auth-redirect";
import { isInactiveFullStackPreviewRequest } from "@/lib/full-stack-preview-guard";
import { type NextRequest, NextResponse } from "next/server";

const INACTIVE_PREVIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Preview Not Active</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0d0f14;
        --card: #151923;
        --border: #242b38;
        --text: #eef2f7;
        --muted: #98a2b3;
        --accent: #79c0ff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(121, 192, 255, 0.18), transparent 36%),
          linear-gradient(180deg, #0f1320 0%, var(--bg) 52%);
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(100%, 560px);
        padding: 28px;
        border: 1px solid var(--border);
        border-radius: 20px;
        background: color-mix(in srgb, var(--card) 92%, transparent);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(28px, 5vw, 40px);
        line-height: 1;
      }
      p {
        margin: 0;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.6;
      }
      strong { color: var(--text); }
      code {
        color: var(--accent);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 0.94em;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Preview Not Active</h1>
      <p>
        This <strong>full-stack preview</strong> host is not currently attached to a live preview environment.
        Trigger a new preview deployment for this pull request if you need to inspect it again.
      </p>
    </main>
  </body>
</html>`;

export async function proxy(request: NextRequest) {
  if (
    isInactiveFullStackPreviewRequest({
      requestHost: request.headers.get("host"),
      activePreviewHost: process.env.AIRJAM_FULL_STACK_PREVIEW_HOST,
    })
  ) {
    return new NextResponse(INACTIVE_PREVIEW_HTML, {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-airjam-preview-state": "inactive",
      },
    });
  }

  if (!request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("better-auth.session_token");
  const secureSessionCookie = request.cookies.get(
    "__Secure-better-auth.session_token",
  );

  if (!sessionCookie && !secureSessionCookie) {
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(
      new URL(createLoginHref(nextPath), request.url),
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
