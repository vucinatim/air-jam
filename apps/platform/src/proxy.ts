import { createLoginHref } from "@/lib/auth-redirect";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
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
  matcher: ["/dashboard/:path*"],
};
