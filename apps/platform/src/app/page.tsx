"use client";

import { HeroScene } from "@/components/hero-scene/hero-scene";
import { Navbar } from "@/components/navbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import {
  AlertCircle,
  Code,
  Github,
  Loader2,
  QrCode,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Suspense } from "react";

function HomeContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const showLogin = searchParams.get("login") === "true";

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authClient.getSession();
        setIsAuthenticated(!!session?.data?.session);
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleDashboardClick = (e: React.MouseEvent) => {
    if (isAuthenticated === false) {
      e.preventDefault();
      router.push("/?login=true");
    }
  };

  const handleAuth = async (action: "signin" | "signup") => {
    setLoading(true);
    setError(null);
    try {
      if (action === "signin") {
        await authClient.signIn.email(
          {
            email,
            password,
          },
          {
            onSuccess: () => router.push("/dashboard"),
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
            onSuccess: () => router.push("/dashboard"),
            onError: (ctx) => setError(ctx.error.message),
          },
        );
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (showLogin) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex min-h-screen flex-col items-center justify-center p-4 pt-24">
          <div className="mb-8 text-center">
            <h1 className="text-foreground text-4xl font-bold tracking-tight">
              Air Jam Platform
            </h1>
            <p className="text-muted-foreground mt-2">
              Connect your game to the Air Jam Cloud
            </p>
          </div>

          <Tabs defaultValue="signin" className="w-full max-w-md">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <Card>
                <CardHeader>
                  <CardTitle>Welcome Back</CardTitle>
                  <CardDescription>
                    Enter your credentials to access your dashboard.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleAuth("signin")}
                    disabled={loading}
                  >
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Sign In
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card>
                <CardHeader>
                  <CardTitle>Create Account</CardTitle>
                  <CardDescription>
                    Get started with Air Jam Platform today.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleAuth("signup")}
                    disabled={loading}
                  >
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Sign Up
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
        {/* Three.js Background */}
        <HeroScene />

        {/* Content */}
        <div className="relative z-10 flex -translate-y-[160px] flex-col items-center justify-center space-y-8 px-4 text-center">
          <div className="flex flex-col items-center gap-1">
            <Badge
              variant="outline"
              className="border-airjam-cyan/50 bg-background/90 text-airjam-cyan hover:border-airjam-cyan px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap shadow-[0_0_10px_rgba(0,211,243,0.3)] backdrop-blur-md transition-all hover:shadow-[0_0_15px_rgba(0,211,243,0.5)] sm:text-xs"
            >
              Free & Open Source
            </Badge>
            <h1 className="text-6xl font-bold tracking-tight sm:text-7xl md:text-8xl">
              <span className="from-foreground to-foreground/70 bg-linear-to-r bg-clip-text text-transparent">
                Air Jam
              </span>
            </h1>
          </div>
          <p className="text-foreground relative z-20 max-w-2xl text-lg font-medium [text-shadow:0_2px_8px_rgba(0,0,0,0.9),0_0_20px_rgba(0,0,0,0.7),0_0_40px_rgba(0,0,0,0.5)] sm:text-xl md:text-2xl">
            Vibecode a game. Play it with friends.
          </p>
          <div className="relative z-10">
            <Button
              size="lg"
              variant="outline"
              className="neon-glow-button group border-airjam-cyan/70 bg-background/80 text-foreground hover:border-airjam-cyan relative h-14 border-2 px-8 text-lg font-semibold backdrop-blur-sm transition-all duration-300 hover:scale-105"
              onClick={() => router.push("/arcade")}
            >
              <span className="relative z-10">Enter Arcade</span>
              <span className="bg-airjam-cyan/30 absolute inset-0 rounded-md opacity-80 blur-2xl transition-opacity group-hover:opacity-100" />
              <span className="bg-airjam-cyan/20 absolute -inset-2 rounded-md opacity-60 blur-3xl transition-opacity group-hover:opacity-80" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-24">
        <div className="container mx-auto space-y-24">
          {/* Row 1: What is Air Jam */}
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="flex justify-center">
              <div className="relative">
                <div className="from-airjam-cyan/20 absolute inset-0 rounded-2xl bg-linear-to-br to-blue-500/20 blur-3xl" />
                <div className="border-border/50 bg-background/50 relative flex h-64 w-64 items-center justify-center rounded-2xl border backdrop-blur-sm">
                  <Smartphone className="text-airjam-cyan h-32 w-32" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Multiplayer Games with Smartphones as Controllers
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Air Jam enables you to build interactive multiplayer games where
                a computer or TV acts as the host display and smartphones become
                game controllers. Create engaging experiences that bring people
                together without requiring any app downloads.
              </p>
              <ul className="text-muted-foreground space-y-2 pt-4">
                <li className="flex items-start gap-2">
                  <span className="text-airjam-cyan">•</span>
                  <span>Support up to 8 players simultaneously</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-airjam-cyan">•</span>
                  <span>Real-time input with haptic feedback</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-airjam-cyan">•</span>
                  <span>Type-safe with end-to-end validation</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Row 2: How Developers Use It */}
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="order-2 space-y-4 md:order-1">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Developer Friendly SDK
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Built with modern web technologies, Air Jam makes it easy to
                integrate multiplayer controller support into your games. Wrap
                your app with the provider, define your input schema, and start
                building.
              </p>
              <ul className="text-muted-foreground space-y-2 pt-4">
                <li className="flex items-start gap-2">
                  <span className="text-airjam-cyan">•</span>
                  <span>React and TypeScript support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-airjam-cyan">•</span>
                  <span>Zod schema validation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-airjam-cyan">•</span>
                  <span>Performance optimized with input latching</span>
                </li>
              </ul>
            </div>
            <div className="order-1 flex justify-center md:order-2">
              <div className="relative">
                <div className="from-airjam-cyan/20 absolute inset-0 rounded-2xl bg-linear-to-br to-blue-500/20 blur-3xl" />
                <div className="border-border/50 bg-background/50 relative flex h-64 w-64 items-center justify-center rounded-2xl border backdrop-blur-sm">
                  <Code className="text-airjam-cyan h-32 w-32" />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: How Players Use It */}
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="flex justify-center">
              <div className="relative">
                <div className="from-airjam-cyan/20 absolute inset-0 rounded-2xl bg-linear-to-br to-blue-500/20 blur-3xl" />
                <div className="border-border/50 bg-background/50 relative flex h-64 w-64 items-center justify-center rounded-2xl border backdrop-blur-sm">
                  <QrCode className="text-airjam-cyan h-32 w-32" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Zero App Download Required
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Players join your games instantly by scanning a QR code. No app
                store downloads, no installations—just scan and play. The
                intuitive experience makes it easy for anyone to jump into your
                game.
              </p>
              <ul className="text-muted-foreground space-y-2 pt-4">
                <li className="flex items-start gap-2">
                  <span className="text-airjam-cyan">•</span>
                  <span>Instant connection via QR code</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-airjam-cyan">•</span>
                  <span>Works on any modern smartphone</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-airjam-cyan">•</span>
                  <span>No registration or sign-up needed</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-border/50 bg-background/50 border-t backdrop-blur-sm">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="text-center md:text-left">
              <p className="text-muted-foreground text-sm">
                © {new Date().getFullYear()} Air Jam. All rights reserved.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <Link
                href="/docs"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Docs
              </Link>
              <Link
                href="/dashboard/games"
                onClick={handleDashboardClick}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/arcade"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Arcade
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href="https://www.npmjs.com/package/@air-jam/sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="NPM Package"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 18 7"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M0 0h18v6H9v1H5V6H0V0zm1 5h2V2h1v3h1V1H1v4zm5-4v5h2V5h2V1H6zm2 1h1v2H8V2zm3-1v4h2V2h1v3h1V2h1v3h1V1h-6z" />
                  </svg>
                </Link>
                <Link
                  href="https://github.com/vucinatim/air-jam"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="GitHub Repository"
                >
                  <Github className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
