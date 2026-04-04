"use client";

import { LoginBackdropScene } from "@/components/hero-scene/login-backdrop-scene";
import { Navbar } from "@/components/navbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import {
  DEFAULT_POST_AUTH_PATH,
  normalizePostAuthPath,
} from "@/lib/auth-redirect";
import { AlertCircle, Github, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type LoginScreenProps = {
  nextPath?: string | null;
};

export function LoginScreen({ nextPath }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingAction, setLoadingAction] = useState<
    "github" | "signin" | "signup" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmailFallback, setShowEmailFallback] = useState(false);
  const router = useRouter();

  const githubEnabled = process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED === "true";
  const safeNextPath = useMemo(
    () => normalizePostAuthPath(nextPath || DEFAULT_POST_AUTH_PATH),
    [nextPath],
  );
  const callbackURL = useMemo(() => {
    if (typeof window === "undefined") {
      return safeNextPath;
    }
    return new URL(safeNextPath, window.location.origin).toString();
  }, [safeNextPath]);

  const handleAuth = async (action: "signin" | "signup") => {
    setLoadingAction(action);
    setError(null);
    try {
      if (action === "signin") {
        await authClient.signIn.email(
          {
            email,
            password,
          },
          {
            onSuccess: () => router.push(safeNextPath),
            onError: (ctx) => setError(ctx.error.message),
          },
        );
      } else {
        await authClient.signUp.email(
          {
            email,
            password,
            name: email.split("@")[0],
          },
          {
            onSuccess: () => router.push(safeNextPath),
            onError: (ctx) => setError(ctx.error.message),
          },
        );
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGitHubSignIn = async () => {
    setLoadingAction("github");
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL,
      });
    } catch {
      setError("GitHub sign-in could not be started.");
      setLoadingAction(null);
    }
  };

  const handleShowEmailFallback = () => {
    setError(null);
    setShowEmailFallback(true);
  };

  const handleShowPrimaryOptions = () => {
    setError(null);
    setShowEmailFallback(false);
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-20 pb-10">
        <LoginBackdropScene />
        <div className="pointer-events-none absolute inset-0 z-1 bg-black/20" />
        <div className="from-airjam-cyan/12 via-airjam-cyan/4 absolute top-1/2 left-1/2 z-2 h-96 w-3xl -translate-x-1/2 -translate-y-1/2 rounded-full bg-radial to-transparent blur-3xl" />

        <Card className="relative z-10 w-full max-w-[420px] gap-0 overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/92 py-0 text-zinc-100 ring-1 ring-white/4 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="from-airjam-cyan/25 pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r via-white/40 to-transparent" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-b from-white/4 to-transparent" />

          <CardHeader className="relative px-8 pt-10 pb-2 text-center sm:px-10">
            <CardTitle className="text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
              Sign in
            </CardTitle>
            <p className="text-airjam-cyan/90 mt-2 text-[10px] font-medium tracking-[0.2em] uppercase">
              Developer dashboard
            </p>
            <CardDescription className="mt-3 text-sm leading-relaxed text-zinc-400">
              Access your games, analytics, and publishing tools.
            </CardDescription>
          </CardHeader>

          <CardContent className="relative space-y-6 px-8 pt-4 pb-10 sm:px-10">
            {error && (
              <Alert
                variant="destructive"
                className="border-red-500/25 bg-red-950/40 text-left"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">
                  Could not sign you in
                </AlertTitle>
                <AlertDescription className="text-xs opacity-90">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {!showEmailFallback ? (
                <>
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-lg border-white/12 bg-white/4 text-sm font-medium text-zinc-100 shadow-none hover:border-white/18 hover:bg-white/8"
                    onClick={() => void handleGitHubSignIn()}
                    disabled={!githubEnabled || loadingAction !== null}
                  >
                    {loadingAction === "github" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Github className="mr-2 h-[18px] w-[18px]" />
                    )}
                    Continue with GitHub
                  </Button>
                  {!githubEnabled && (
                    <p className="text-center text-xs text-zinc-500">
                      GitHub sign-in is not enabled for this environment.
                    </p>
                  )}

                  <div
                    className="flex items-center gap-4 py-1 pt-3"
                    role="separator"
                    aria-orientation="horizontal"
                  >
                    <div
                      className="min-w-0 flex-1 border-t border-white/10"
                      aria-hidden
                    />
                    <span className="shrink-0 text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
                      OR
                    </span>
                    <div
                      className="min-w-0 flex-1 border-t border-white/10"
                      aria-hidden
                    />
                  </div>

                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground w-full rounded-lg border border-transparent py-2 text-center text-sm transition-colors"
                    onClick={handleShowEmailFallback}
                  >
                    Continue with email
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs text-zinc-400">
                      Email
                    </Label>
                    <Input
                      id="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="focus-visible:border-airjam-cyan/50 focus-visible:ring-airjam-cyan/25 h-10 rounded-lg border-white/10 bg-zinc-900/80 text-sm text-white placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-xs text-zinc-400">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="focus-visible:border-airjam-cyan/50 focus-visible:ring-airjam-cyan/25 h-10 rounded-lg border-white/10 bg-zinc-900/80 text-sm text-white placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                    <Button
                      variant="outline"
                      className="h-10 rounded-lg border-white/12 bg-transparent text-sm font-medium text-zinc-200 hover:bg-white/6 hover:text-white"
                      onClick={() => void handleAuth("signin")}
                      disabled={loadingAction !== null}
                    >
                      {loadingAction === "signin" && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Sign in
                    </Button>
                    <Button
                      variant="default"
                      className="h-10 rounded-lg bg-white text-sm font-medium text-zinc-950 shadow-sm hover:bg-zinc-100"
                      onClick={() => void handleAuth("signup")}
                      disabled={loadingAction !== null}
                    >
                      {loadingAction === "signup" && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create account
                    </Button>
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground mt-3 text-sm transition-colors"
                      onClick={handleShowPrimaryOptions}
                    >
                      ← Back to other options
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
