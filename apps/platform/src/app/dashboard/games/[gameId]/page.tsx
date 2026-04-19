"use client";

import {
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { buildCreateAirJamTemplateCommand } from "@/lib/create-airjam-template-command";
import { getArcadeVisibilityLabel } from "@/lib/games/arcade-visibility";
import {
  gameConfigSourceUrlSchema,
  gameConfigTemplateIdSchema,
} from "@/lib/games/game-config-contract";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Gamepad2,
  Github,
  Globe,
  ImageIcon,
  Key,
  LineChart,
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

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

const overviewSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  description: z.string().optional(),
  previewUrl: z.union([z.literal(""), z.string().url("Must be a valid URL")]),
  sourceUrl: z.union([z.literal(""), gameConfigSourceUrlSchema]),
  templateId: z.union([z.literal(""), gameConfigTemplateIdSchema]),
});

type OverviewForm = z.infer<typeof overviewSchema>;

type DistributionStep = {
  label: string;
  complete: boolean;
  href: string;
  cta: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCompactDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatCompactTimestamp(value?: Date | null): string {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GameOverviewPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [debouncedSlug, setDebouncedSlug] = useState("");
  const [appIdCopied, setAppIdCopied] = useState(false);
  const [showAppIdKey, setShowAppIdKey] = useState(false);
  const utils = api.useUtils();

  /* ---- queries --------------------------------------------------- */

  const { data: game, isLoading } = api.game.get.useQuery({ id: gameId });
  const { data: appId } = api.game.getAppId.useQuery(
    { gameId },
    { enabled: !!gameId },
  );
  const { data: analyticsOverview } = api.analytics.getGameOverview.useQuery(
    { gameId, days: 30 },
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

  /* ---- form ------------------------------------------------------ */

  const form = useForm<OverviewForm>({
    resolver: zodResolver(overviewSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      previewUrl: "",
      sourceUrl: "",
      templateId: "",
    },
  });

  const watchedSlug = useWatch({ control: form.control, name: "slug" });
  const watchedTemplateId = useWatch({
    control: form.control,
    name: "templateId",
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(watchedSlug || ""), 300);
    return () => clearTimeout(timer);
  }, [watchedSlug]);

  useEffect(() => {
    if (!game) return;
    form.reset({
      name: game.name,
      slug: game.slug || "",
      description: game.description || "",
      previewUrl: game.url ?? "",
      sourceUrl: game.config?.sourceUrl ?? "",
      templateId: game.config?.templateId ?? "",
    });
  }, [form, game]);

  /* ---- mutations ------------------------------------------------- */

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
        sourceUrl: data.sourceUrl.trim() ? data.sourceUrl.trim() : null,
        templateId: data.templateId.trim() ? data.templateId.trim() : null,
      })
      .then(() => alert("Overview saved successfully."))
      .catch(() => {});
  };

  const handleCopyAppId = async () => {
    if (!appId?.key) return;
    await navigator.clipboard.writeText(appId.key);
    setAppIdCopied(true);
    setTimeout(() => setAppIdCopied(false), 2000);
  };

  /* ---- loading / not-found --------------------------------------- */

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;
  if (!game) return <div>Game not found</div>;

  /* ---- derived state --------------------------------------------- */

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

  const liveRelease = releases?.find((r) => r.status === "live") ?? null;
  const readyRelease = releases?.find((r) => r.status === "ready") ?? null;
  const canListInArcade = Boolean(liveRelease);
  const hasPlayableSource = Boolean(game.url || liveRelease);
  const playHref = `/play/${game.slug || game.id}`;

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

  const allStepsComplete = steps.every((s) => s.complete);
  const nextIncompleteStep = steps.find((s) => !s.complete) ?? null;
  const isSlugFormatValid = /^[a-z0-9-]+$/.test(watchedSlug || "");
  const showSlugStatus =
    (watchedSlug?.length ?? 0) > 0 &&
    isSlugFormatValid &&
    debouncedSlug === watchedSlug;
  const isSlugAvailable = slugCheck?.available ?? false;
  const scaffoldCommand = buildCreateAirJamTemplateCommand(watchedTemplateId);

  const mediaConfigured = [
    game.thumbnailUrl,
    game.coverUrl,
    game.videoUrl,
  ].filter(Boolean).length;

  const hasActivity = dailyAnalytics.some(
    (d) => d.sessionCount > 0 || d.totalEligiblePlaytimeSeconds > 0,
  );

  const peakEligible = Math.max(
    1,
    ...dailyAnalytics.map((d) => d.totalEligiblePlaytimeSeconds),
  );

  /* ---- render ---------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ */}
      {/*  Header                                                       */}
      {/* ------------------------------------------------------------ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{game.name}</h1>
          <p className="text-muted-foreground">
            Configure your game and track its launch progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
          {canListInArcade ? (
            <div className="border-border/60 bg-muted/30 flex h-9 items-center gap-2 rounded-md border px-3">
              <Globe
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden
              />
              <span className="text-sm font-medium whitespace-nowrap">
                Public in Arcade
              </span>
              <span className="text-muted-foreground hidden text-xs sm:inline">
                {game.arcadeVisibility === "listed" ? "Listed" : "Hidden"}
              </span>
              <Switch
                checked={game.arcadeVisibility === "listed"}
                onCheckedChange={(checked) =>
                  updateArcadeVisibility.mutate({
                    id: gameId,
                    arcadeVisibility: checked ? "listed" : "hidden",
                  })
                }
                disabled={updateArcadeVisibility.isPending}
                aria-label={
                  game.arcadeVisibility === "listed"
                    ? "Listed in public Arcade — tap to hide"
                    : "Hidden from public Arcade — tap to list"
                }
              />
            </div>
          ) : null}
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
              No Playable Source
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  Launch Checklist                                              */}
      {/* ------------------------------------------------------------ */}
      <Collapsible defaultOpen={!allStepsComplete}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer select-none">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Launch Checklist
                    {allStepsComplete && (
                      <span className="inline-flex h-5 items-center rounded-full bg-emerald-500/10 px-2 text-xs font-medium text-emerald-600">
                        Complete
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Upload a release, make it live, then list in the Arcade.
                  </CardDescription>
                </div>
                <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition-transform in-data-[state=open]:rotate-180" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-3 md:grid-cols-3">
                {steps.map((step, i) => (
                  <div
                    key={step.label}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3",
                      step.complete && "border-emerald-500/30 bg-emerald-500/5",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                        step.complete
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {step.complete ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{step.label}</div>
                      <div className="text-muted-foreground text-xs">
                        {step.complete ? "Done" : "Pending"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {nextIncompleteStep && (
                <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
                  <div>
                    <div className="text-sm font-medium">Next step</div>
                    <div className="text-muted-foreground text-sm">
                      {nextIncompleteStep.label}
                    </div>
                  </div>
                  <Link href={nextIncompleteStep.href}>
                    <Button size="sm">{nextIncompleteStep.cta}</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ------------------------------------------------------------ */}
      {/*  Game Profile + App ID                                          */}
      {/* ------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Game Profile</CardTitle>
                <CardDescription>
                  Identity, shareable URL, and the optional development preview.
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
                          rows={3}
                          placeholder="A short public description for the Arcade catalog."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                        Optional. For private creator testing only -- never used
                        for the public Arcade catalog.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg border border-dashed p-4">
                  <div className="mb-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Github className="h-4 w-4" />
                      Developer Links
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Optional public Arcade actions for source code and
                      create-airjam templates.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="sourceUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source Repository URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://github.com/vucinatim/air-jam/tree/main/games/pong"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Shows the GitHub icon on the Arcade card when set.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="templateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Create-AirJam Template ID</FormLabel>
                          <FormControl>
                            <Input placeholder="pong" {...field} />
                          </FormControl>
                          <FormDescription>
                            Shows the code icon and copies the generated npx
                            command.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {scaffoldCommand ? (
                    <div className="bg-muted/50 mt-4 flex items-start gap-2 rounded-md border p-3 text-xs">
                      <Code2 className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <code className="break-all">{scaffoldCommand}</code>
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
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
                    Save Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>

        {/* App ID */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              App ID
            </CardTitle>
            <CardDescription>
              Pass this to the SDK when your game connects to Air Jam.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div>
              <div className="bg-muted relative rounded-lg p-3 pr-10 font-mono text-xs break-all">
                {appId?.key
                  ? showAppIdKey
                    ? appId.key
                    : "\u2022".repeat(Math.min(appId.key.length, 32))
                  : "No App ID found"}
                <button
                  type="button"
                  onClick={() => setShowAppIdKey((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
                >
                  {showAppIdKey ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={handleCopyAppId}
                disabled={!appId?.key}
              >
                {appIdCopied ? (
                  <Check className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-2 h-3.5 w-3.5" />
                )}
                {appIdCopied ? "Copied" : "Copy App ID"}
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg border border-dashed p-3">
              <div className="text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wider uppercase">
                Usage
              </div>
              <code className="text-[11px] leading-relaxed">
                <span className="text-muted-foreground">AIR_JAM_APP_ID</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-foreground/70">
                  {appId?.key
                    ? `"${showAppIdKey ? appId.key : appId.key.slice(0, 8) + "..."}"`
                    : '"your-app-id"'}
                </span>
              </code>
            </div>

            <div className="mt-auto">
              <Link href={`/dashboard/games/${gameId}/security`}>
                <Button variant="ghost" size="sm" className="w-full">
                  <Shield className="mr-2 h-3.5 w-3.5" />
                  Security Settings
                </Button>
              </Link>
              <p className="text-muted-foreground mt-1 text-center text-[11px]">
                Regenerate key or configure allowed origins
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  Status & Distribution                                         */}
      {/* ------------------------------------------------------------ */}
      <div
        id="distribution"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* Arcade Visibility */}
        <Card className="gap-0 py-0">
          <div className="flex h-full flex-col justify-between p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                <Globe className="h-3.5 w-3.5" />
                Arcade
              </div>
              <Switch
                checked={game.arcadeVisibility === "listed"}
                onCheckedChange={(checked) =>
                  updateArcadeVisibility.mutate({
                    id: gameId,
                    arcadeVisibility: checked ? "listed" : "hidden",
                  })
                }
                disabled={updateArcadeVisibility.isPending || !canListInArcade}
              />
            </div>
            <div className="mt-3">
              <div className="text-lg font-semibold">
                {game.arcadeVisibility === "listed" && canListInArcade
                  ? "Listed"
                  : "Hidden"}
              </div>
              <div className="text-muted-foreground text-xs">
                {canListInArcade
                  ? getArcadeVisibilityLabel(game.arcadeVisibility)
                  : "Needs a live release"}
              </div>
            </div>
          </div>
        </Card>

        {/* Live Release */}
        <Link
          href={`/dashboard/games/${gameId}/releases`}
          className="group block"
        >
          <Card className="group-hover:border-foreground/20 h-full gap-0 py-0 transition-colors">
            <div className="flex h-full flex-col justify-between p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                <Package className="h-3.5 w-3.5" />
                Release
              </div>
              <div className="mt-3">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  {liveRelease ? (
                    <>
                      <ReleaseStatusBadge status={liveRelease.status} />
                      <span className="truncate">
                        {liveRelease.versionLabel?.trim() || "Live"}
                      </span>
                    </>
                  ) : (
                    "None"
                  )}
                </div>
                <div className="text-muted-foreground text-xs">
                  {liveRelease
                    ? "Hosted release active"
                    : readyRelease
                      ? "Ready release waiting"
                      : "No release uploaded"}
                </div>
              </div>
            </div>
          </Card>
        </Link>

        {/* Media */}
        <Link href={`/dashboard/games/${gameId}/media`} className="group block">
          <Card className="group-hover:border-foreground/20 h-full gap-0 py-0 transition-colors">
            <div className="flex h-full flex-col justify-between p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                <ImageIcon className="h-3.5 w-3.5" />
                Media
              </div>
              <div className="mt-3">
                <div className="text-lg font-semibold">{mediaConfigured}/3</div>
                <div className="text-muted-foreground text-xs">
                  {mediaConfigured === 3
                    ? "All assets configured"
                    : `Missing: ${[
                        !game.thumbnailUrl && "thumbnail",
                        !game.coverUrl && "cover",
                        !game.videoUrl && "video",
                      ]
                        .filter(Boolean)
                        .join(", ")}`}
                </div>
              </div>
            </div>
          </Card>
        </Link>

        {/* Security */}
        <Link
          href={`/dashboard/games/${gameId}/security`}
          className="group block"
        >
          <Card className="group-hover:border-foreground/20 h-full gap-0 py-0 transition-colors">
            <div className="flex h-full flex-col justify-between p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                <Shield className="h-3.5 w-3.5" />
                Security
              </div>
              <div className="mt-3">
                <div className="text-lg font-semibold">
                  {appId?.isActive ? "Active" : "Inactive"}
                </div>
                <div className="text-muted-foreground text-xs">
                  {appId?.allowedOrigins?.length
                    ? `${appId.allowedOrigins.length} origin${appId.allowedOrigins.length === 1 ? "" : "s"} allowed`
                    : "Any origin"}
                </div>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  Recent Activity                                               */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription className="mt-1">
                Last 30 days of eligible playtime.
              </CardDescription>
            </div>
            <Link href={`/dashboard/games/${gameId}/analytics`}>
              <Button variant="ghost" size="sm">
                <LineChart className="mr-2 h-4 w-4" />
                Full Analytics
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {hasActivity ? (
            <div className="space-y-4">
              <div className="flex items-end gap-1">
                {dailyAnalytics.map((day) => {
                  const height = Math.max(
                    8,
                    Math.round(
                      (day.totalEligiblePlaytimeSeconds / peakEligible) * 100,
                    ),
                  );
                  return (
                    <div
                      key={day.bucketDate}
                      className="flex min-w-0 flex-1 flex-col items-center gap-1"
                    >
                      <div className="bg-airjam-cyan/15 flex h-16 w-full items-end rounded-sm">
                        <div
                          className="bg-airjam-cyan w-full rounded-sm transition-all"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground text-[9px]">
                        {day.bucketDate.slice(8)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">Sessions</div>
                  <div className="mt-1 text-lg font-semibold">
                    {analyticsTotals.sessionCount}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">
                    Active Time
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {formatCompactDuration(
                      analyticsTotals.totalGameActiveSeconds,
                    )}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">
                    Last Activity
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatCompactTimestamp(analyticsTotals.lastActivityAt)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground flex h-24 items-center justify-center rounded-lg border border-dashed text-sm">
              No activity yet. Start a session to see analytics here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
