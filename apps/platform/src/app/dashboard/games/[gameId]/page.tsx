"use client";

import {
  GameAnalyticsActivityCard,
  type GameAnalyticsDailyPoint,
  type GameAnalyticsTotals,
} from "@/components/game-analytics/game-analytics-panels";
import { ReleaseStatusBadge } from "@/components/releases/release-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getArcadeVisibilityLabel } from "@/lib/games/arcade-visibility";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Gamepad2,
  Globe,
  ImageIcon,
  Key,
  Loader2,
  Package,
  Save,
  Shield,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const overviewSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  description: z.string().optional(),
  previewUrl: z.union([z.literal(""), z.string().url("Must be a valid URL")]),
});

type OverviewForm = z.infer<typeof overviewSchema>;

type DistributionStep = {
  label: string;
  complete: boolean;
  href: string;
  cta: string;
};

export default function GameOverviewPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [debouncedSlug, setDebouncedSlug] = useState("");
  const utils = api.useUtils();

  const { data: game, isLoading } = api.game.get.useQuery({ id: gameId });
  const { data: appId } = api.game.getAppId.useQuery(
    { gameId },
    { enabled: !!gameId },
  );
  const { data: analyticsOverview } = api.analytics.getGameOverview.useQuery(
    { gameId, days: 14 },
    { enabled: !!gameId },
  );
  const { data: releases } = api.release.listByGame.useQuery(
    { gameId },
    { enabled: !!gameId },
  );
  const { data: slugCheck, isFetching: isCheckingSlug } =
    api.game.checkSlugAvailability.useQuery(
      { slug: debouncedSlug, excludeGameId: gameId },
      {
        enabled: debouncedSlug.length > 0 && /^[a-z0-9-]+$/.test(debouncedSlug),
      },
    );

  const form = useForm<OverviewForm>({
    resolver: zodResolver(overviewSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      previewUrl: "",
    },
  });

  const watchedSlug = useWatch({
    control: form.control,
    name: "slug",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSlug(watchedSlug || "");
    }, 300);
    return () => clearTimeout(timer);
  }, [watchedSlug]);

  useEffect(() => {
    if (!game) return;
    form.reset({
      name: game.name,
      slug: game.slug || "",
      description: game.description || "",
      previewUrl: game.url ?? "",
    });
  }, [form, game]);

  const updateGameDetails = api.game.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.game.get.invalidate({ id: gameId }),
        utils.game.list.invalidate(),
        utils.game.getAllPublic.invalidate(),
      ]);
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const updateArcadeVisibility = api.game.update.useMutation({
    onMutate: async (newData) => {
      await utils.game.get.cancel({ id: gameId });
      const previousGame = utils.game.get.getData({ id: gameId });
      utils.game.get.setData({ id: gameId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          arcadeVisibility: newData.arcadeVisibility ?? old.arcadeVisibility,
        };
      });
      return { previousGame };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousGame) {
        utils.game.get.setData({ id: gameId }, context.previousGame);
      }
    },
    onSettled: () => {
      void Promise.all([
        utils.game.get.invalidate({ id: gameId }),
        utils.game.getAllPublic.invalidate(),
        utils.game.list.invalidate(),
      ]);
    },
  });

  const onSubmit = (data: OverviewForm) => {
    void updateGameDetails
      .mutateAsync({
        id: gameId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        url: data.previewUrl.trim() ? data.previewUrl.trim() : null,
      })
      .then(() => {
        alert("Overview saved successfully.");
      })
      .catch(() => {});
  };

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  if (!game) {
    return <div>Game not found</div>;
  }

  const dailyAnalytics: GameAnalyticsDailyPoint[] =
    analyticsOverview?.daily ?? [];
  const analyticsTotals: GameAnalyticsTotals = analyticsOverview?.totals ?? {
    sessionCount: 0,
    totalGameActiveSeconds: 0,
    totalControllerSeconds: 0,
    totalRawEligiblePlaytimeSeconds: 0,
    totalEligiblePlaytimeSeconds: 0,
    guardedSessionCount: 0,
    peakConcurrentControllers: 0,
    lastActivityAt: null,
  };
  const liveRelease =
    releases?.find((release) => release.status === "live") ?? null;
  const readyRelease =
    releases?.find((release) => release.status === "ready") ?? null;
  const canListInArcade = Boolean(liveRelease);
  const hasPlayableSource = Boolean(game.url || liveRelease);
  const playHref = `/play/${game.slug || game.id}`;
  const shareablePlayPath = `/play/${game.slug || game.id}`;

  const steps: DistributionStep[] = [
    {
      label: "Upload Release",
      complete: Boolean(releases && releases.length > 0),
      href: `/dashboard/games/${gameId}/releases`,
      cta: "Open Releases",
    },
    {
      label: "Make Live",
      complete: Boolean(liveRelease),
      href: `/dashboard/games/${gameId}/releases`,
      cta: readyRelease ? "Make A Release Live" : "Manage Releases",
    },
    {
      label: "List In Arcade",
      complete: game.arcadeVisibility === "listed" && canListInArcade,
      href: `/dashboard/games/${gameId}#distribution`,
      cta:
        game.arcadeVisibility === "listed" && canListInArcade
          ? "Unlist From Arcade"
          : canListInArcade
            ? "List In Arcade"
            : "Make A Release Live First",
    },
  ];

  const nextIncompleteStep = steps.find((step) => !step.complete) ?? null;
  const isSlugFormatValid = /^[a-z0-9-]+$/.test(watchedSlug || "");
  const showSlugStatus =
    (watchedSlug?.length ?? 0) > 0 &&
    isSlugFormatValid &&
    debouncedSlug === watchedSlug;
  const isSlugAvailable = slugCheck?.available ?? false;
  const previewStatusLabel = game.url ? "Configured" : "Optional";

  return (
    <div className="relative space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{game.name}</h1>
          <p className="text-muted-foreground max-w-3xl">
            Identity, distribution state, and the optional creator preview URL
            all live here. Public Arcade always runs hosted releases, not the
            preview URL.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasPlayableSource ? (
            <Link href={playHref}>
              <Button
                variant="outline"
                className="border-airjam-cyan text-airjam-cyan hover:bg-airjam-cyan/10"
              >
                <Gamepad2 className="mr-2 h-4 w-4" />
                Test Play
              </Button>
            </Link>
          ) : (
            <Button variant="outline" disabled>
              <Gamepad2 className="mr-2 h-4 w-4" />
              Add Preview URL Or Release
            </Button>
          )}
          <Link href={`/dashboard/games/${gameId}/releases`}>
            <Button variant="outline">Arcade Releases</Button>
          </Link>
          <Link href={`/dashboard/games/${gameId}/media`}>
            <Button variant="outline">
              <ImageIcon className="mr-2 h-4 w-4" />
              Media
            </Button>
          </Link>
          <Link href={`/dashboard/games/${gameId}/security`}>
            <Button variant="outline">
              <Shield className="mr-2 h-4 w-4" />
              Security
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arcade Path</CardTitle>
          <CardDescription>
            The public Arcade path is simple: upload a release, make it live,
            then list it. The preview URL below is only for private creator
            testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.label} className="rounded-lg border p-4">
                <div className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                  Step {index + 1}
                </div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium">{step.label}</div>
                  <span
                    className={
                      step.complete
                        ? "inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"
                        : "bg-muted-foreground/40 inline-flex h-2.5 w-2.5 rounded-full"
                    }
                  />
                </div>
                <div className="text-muted-foreground text-sm">
                  {step.complete ? "Complete" : "Needs attention"}
                </div>
              </div>
            ))}
          </div>
          {nextIncompleteStep ? (
            <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
              <div>
                <div className="font-medium">Next recommended step</div>
                <div className="text-muted-foreground text-sm">
                  {nextIncompleteStep.label}
                </div>
              </div>
              <Link href={nextIncompleteStep.href}>
                <Button>{nextIncompleteStep.cta}</Button>
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Form {...form}>
        <form
          id="game-overview-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Game Profile</CardTitle>
                <CardDescription>
                  Catalog identity and the shareable play URL for this game.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Game Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shareable Slug</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <span className="bg-muted text-muted-foreground flex items-center rounded-l-md border border-r-0 px-3 text-sm">
                              /play/
                            </span>
                            <div className="relative flex-1">
                              <Input
                                className={cn(
                                  "rounded-l-none pr-10",
                                  showSlugStatus &&
                                    !isCheckingSlug &&
                                    isSlugAvailable &&
                                    "border-green-500 focus-visible:ring-green-500",
                                  showSlugStatus &&
                                    !isCheckingSlug &&
                                    !isSlugAvailable &&
                                    "border-red-500 focus-visible:ring-red-500",
                                )}
                                {...field}
                              />
                              {field.value.length > 0 && isSlugFormatValid ? (
                                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                  {isCheckingSlug ||
                                  debouncedSlug !== field.value ? (
                                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                                  ) : isSlugAvailable ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <X className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </FormControl>
                        {showSlugStatus &&
                        !isCheckingSlug &&
                        !isSlugAvailable ? (
                          <p className="text-sm text-red-500">
                            This slug is already taken.
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={5}
                          placeholder="A short public description for the Arcade and dashboard."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card id="distribution">
              <CardHeader>
                <CardTitle>Distribution</CardTitle>
                <CardDescription>
                  Preview is optional. Hosted releases control public Arcade.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">Preview URL</div>
                      <div className="text-muted-foreground text-sm">
                        {game.url || "No preview URL configured"}
                      </div>
                    </div>
                    <div className="text-sm font-medium">
                      {previewStatusLabel}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div>
                    <div className="font-medium">Live Arcade release</div>
                    <div className="text-muted-foreground text-sm">
                      {liveRelease ? (
                        <>
                          <span className="mr-2 inline-flex align-middle">
                            <ReleaseStatusBadge status={liveRelease.status} />
                          </span>
                          {liveRelease.versionLabel?.trim() || liveRelease.id}
                        </>
                      ) : readyRelease ? (
                        "Ready release available but not live yet"
                      ) : (
                        "No live Arcade release"
                      )}
                    </div>
                  </div>
                  <Link href={`/dashboard/games/${gameId}/releases`}>
                    <Button variant="outline">Manage Releases</Button>
                  </Link>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div>
                    <div className="font-medium">Arcade visibility</div>
                    <div className="text-muted-foreground text-sm">
                      {canListInArcade
                        ? getArcadeVisibilityLabel(game.arcadeVisibility)
                        : "Requires a live Arcade release before it can appear in the public catalog"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">
                      {game.arcadeVisibility === "listed" && canListInArcade
                        ? "Listed in Arcade"
                        : "Hidden"}
                    </div>
                    <Switch
                      checked={game.arcadeVisibility === "listed"}
                      onCheckedChange={(checked) =>
                        updateArcadeVisibility.mutate({
                          id: gameId,
                          arcadeVisibility: checked ? "listed" : "hidden",
                        })
                      }
                      disabled={
                        updateArcadeVisibility.isPending || !canListInArcade
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card id="development-preview">
            <CardHeader>
              <CardTitle>Development Preview</CardTitle>
              <CardDescription>
                Optional creator-only URL for localhost, staging, or your own
                deployment when you want Air Jam to iframe an external build for
                private preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="previewUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preview URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="http://localhost:5173 or https://your-site.com"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Never used for the public Arcade catalog. Leave this blank
                      if you only use hosted releases.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </form>
      </Form>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Security Snapshot</CardTitle>
            <CardDescription>
              Runtime identity and bootstrap policy for this game.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">App ID</span>
                <span>{appId?.isActive ? "Active" : "Unavailable"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Allowed origins</span>
                <span>
                  {appId?.allowedOrigins?.length
                    ? `${appId.allowedOrigins.length} configured`
                    : "Any origin allowed"}
                </span>
              </div>
            </div>
            <Link href={`/dashboard/games/${gameId}/security`}>
              <Button variant="outline" className="w-full">
                <Shield className="mr-2 h-4 w-4" />
                Open Security
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Media Snapshot</CardTitle>
            <CardDescription>
              Public catalog visuals now live in managed media.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Thumbnail</span>
                <span>{game.thumbnailUrl ? "Configured" : "Missing"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Cover</span>
                <span>{game.coverUrl ? "Configured" : "Missing"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Preview video</span>
                <span>{game.videoUrl ? "Configured" : "Missing"}</span>
              </div>
            </div>
            <Link href={`/dashboard/games/${gameId}/media`}>
              <Button variant="outline" className="w-full">
                <ImageIcon className="mr-2 h-4 w-4" />
                Manage Media
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visibility</CardTitle>
            <Globe className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {game.arcadeVisibility === "listed" ? "Listed" : "Hidden"}
            </div>
            <p className="text-muted-foreground text-xs">
              {game.arcadeVisibility === "listed"
                ? "Visible in the public Arcade catalog"
                : "Not shown in the public Arcade catalog"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Play Path</CardTitle>
            <Globe className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div
              className="truncate text-2xl font-bold"
              title={game.slug || game.id}
            >
              {game.slug || (
                <span className="text-muted-foreground text-sm">Using ID</span>
              )}
            </div>
            <p className="text-muted-foreground text-xs">{shareablePlayPath}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Hosted Release
            </CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {liveRelease ? "Live" : "None"}
            </div>
            <p className="text-muted-foreground text-xs">
              {liveRelease
                ? liveRelease.versionLabel?.trim() || "Hosted release active"
                : "No live Arcade release yet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">App ID</CardTitle>
            <Key className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {appId?.isActive ? "Active" : "Inactive"}
            </div>
            <p className="text-muted-foreground text-xs">
              {appId?.isActive ? "Ready to use" : "Not available"}
            </p>
          </CardContent>
        </Card>
      </div>

      <GameAnalyticsActivityCard
        daily={dailyAnalytics}
        totals={analyticsTotals}
      />

      <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky bottom-0 -mx-4 border-t px-4 py-4 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex justify-end">
          <Button
            type="submit"
            form="game-overview-form"
            disabled={
              updateGameDetails.isPending ||
              (slugCheck ? !slugCheck.available : false)
            }
          >
            {updateGameDetails.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Overview
          </Button>
        </div>
      </div>
    </div>
  );
}
