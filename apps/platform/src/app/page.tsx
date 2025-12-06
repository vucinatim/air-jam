"use client";

import { HeroScene } from "@/components/hero-scene/hero-scene";
import { Navbar } from "@/components/navbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const showLogin = searchParams.get("login") === "true";

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
        <div className="relative z-10 flex -translate-y-[150px] flex-col items-center justify-center space-y-8 px-4 text-center">
          <h1 className="text-6xl font-bold tracking-tight sm:text-7xl md:text-8xl">
            <span className="from-foreground to-foreground/70 bg-linear-to-r bg-clip-text text-transparent">
              Air Jam
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg sm:text-xl md:text-2xl">
            Vibecode a game. Play it with friends.
          </p>
          <Button
            size="lg"
            variant="outline"
            className="group h-14 px-8 text-lg font-semibold shadow-[0_10px_40px_rgba(0,0,0,0.3),0_0_20px_rgba(0,255,240,0.3)] transition-all hover:scale-105 hover:shadow-[0_15px_50px_rgba(0,0,0,0.4),0_0_30px_rgba(0,255,240,0.5)]"
            onClick={() => router.push("/arcade")}
          >
            Enter Arcade
          </Button>
        </div>
      </section>
    </div>
  );
}
