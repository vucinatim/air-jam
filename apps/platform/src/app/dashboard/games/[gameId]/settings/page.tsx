"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Save, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod/v4";

const gameSettingsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  description: z.string().optional(),
  url: z.string().url("Must be a valid URL"),
  thumbnailUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  videoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  coverUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  isPublished: z.boolean(),
  allowedOriginsText: z.string(),
});

type GameSettingsForm = z.infer<typeof gameSettingsSchema>;

const isValidHttpUrl = (value?: string) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const MediaPreview = ({
  label,
  url,
  type,
}: {
  label: string;
  url?: string;
  type: "image" | "video";
}) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasUrl = Boolean(url);
  const isValidUrl = isValidHttpUrl(url);
  const hasError = !!url && failedUrl === url;

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="bg-muted/20 relative aspect-video overflow-hidden rounded-md border">
        {!hasUrl && (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
            No URL set
          </div>
        )}
        {hasUrl && !isValidUrl && (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
            Invalid URL
          </div>
        )}
        {hasUrl && isValidUrl && hasError && (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
            Failed to load
          </div>
        )}
        {hasUrl && isValidUrl && !hasError && type === "image" && (
          // eslint-disable-next-line @next/next/no-img-element -- user-provided remote URLs are not known at build time
          <img
            src={url}
            alt={`${label} preview`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setFailedUrl(url ?? null)}
          />
        )}
        {hasUrl && isValidUrl && !hasError && type === "video" && (
          <video
            src={url}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            onError={() => setFailedUrl(url ?? null)}
          />
        )}
      </div>
    </div>
  );
};

export default function GameSettingsPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const utils = api.useUtils();

  // Debounced slug for availability check
  const [debouncedSlug, setDebouncedSlug] = useState("");

  const { data: game, isLoading } = api.game.get.useQuery({ id: gameId });
  const { data: appId } = api.game.getAppId.useQuery(
    { gameId },
    { enabled: !!gameId },
  );
  // Check slug availability with debounce
  const { data: slugCheck, isFetching: isCheckingSlug } =
    api.game.checkSlugAvailability.useQuery(
      { slug: debouncedSlug, excludeGameId: gameId },
      {
        enabled: debouncedSlug.length > 0 && /^[a-z0-9-]+$/.test(debouncedSlug),
      },
    );

  const updateGame = api.game.update.useMutation({
    onSuccess: () => {
      utils.game.get.invalidate({ id: gameId });
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const updateAppIdPolicy = api.game.updateAppIdPolicy.useMutation({
    onSuccess: () => {
      utils.game.getAppId.invalidate({ gameId });
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const form = useForm<GameSettingsForm>({
    resolver: zodResolver(gameSettingsSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      url: "",
      thumbnailUrl: "",
      videoUrl: "",
      coverUrl: "",
      isPublished: false,
      allowedOriginsText: "",
    },
  });

  const watchedSlug = useWatch({
    control: form.control,
    name: "slug",
  });

  // Debounce slug input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSlug(watchedSlug || "");
    }, 300);
    return () => clearTimeout(timer);
  }, [watchedSlug]);

  useEffect(() => {
    if (game) {
      form.reset({
        name: game.name,
        slug: game.slug || "",
        description: game.description || "",
        url: game.url,
        thumbnailUrl: game.thumbnailUrl || "",
        videoUrl: game.videoUrl || "",
        coverUrl: game.coverUrl || "",
        isPublished: game.isPublished,
        allowedOriginsText: (appId?.allowedOrigins ?? []).join("\n"),
      });
    }
  }, [game, appId, form]);

  const thumbnailUrl = useWatch({
    control: form.control,
    name: "thumbnailUrl",
  });
  const videoUrl = useWatch({
    control: form.control,
    name: "videoUrl",
  });
  const coverUrl = useWatch({
    control: form.control,
    name: "coverUrl",
  });

  const onSubmit = (data: GameSettingsForm) => {
    const allowedOrigins = data.allowedOriginsText
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    void Promise.all([
      updateGame.mutateAsync({
        id: gameId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        url: data.url,
        thumbnailUrl: data.thumbnailUrl,
        videoUrl: data.videoUrl,
        coverUrl: data.coverUrl,
        isPublished: data.isPublished,
      }),
      updateAppIdPolicy.mutateAsync({
        gameId,
        allowedOrigins,
      }),
    ])
      .then(() => {
        alert("Settings saved successfully!");
      })
      .catch(() => {
        // Error toasts/alerts are handled by the underlying mutations.
      });
  };

  if (isLoading) return <div>Loading settings...</div>;

  return (
    <div className="relative space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground">
          Manage your game&apos;s metadata and hosting settings.
        </p>
      </div>

      <Form {...form}>
        <form
          id="game-settings-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8"
        >
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>
                Basic information about your game.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  render={({ field }) => {
                    const isValidFormat = /^[a-z0-9-]+$/.test(field.value);
                    const showStatus =
                      field.value.length > 0 &&
                      isValidFormat &&
                      debouncedSlug === field.value;
                    const isAvailable = slugCheck?.available;

                    return (
                      <FormItem>
                        <FormLabel>Slug (URL)</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <span className="bg-muted text-muted-foreground flex items-center rounded-l-md border border-r-0 px-3 text-sm">
                              /play/
                            </span>
                            <div className="relative flex-1">
                              <Input
                                className={cn(
                                  "rounded-l-none pr-10",
                                  showStatus &&
                                    !isCheckingSlug &&
                                    isAvailable &&
                                    "border-green-500 focus-visible:ring-green-500",
                                  showStatus &&
                                    !isCheckingSlug &&
                                    !isAvailable &&
                                    "border-red-500 focus-visible:ring-red-500",
                                )}
                                {...field}
                              />
                              {/* Status indicator */}
                              {field.value.length > 0 && isValidFormat && (
                                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                  {isCheckingSlug ||
                                  debouncedSlug !== field.value ? (
                                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                                  ) : isAvailable ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <X className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </FormControl>
                        {showStatus && !isCheckingSlug && !isAvailable && (
                          <p className="text-sm text-red-500">
                            This slug is already taken
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Technical Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Hosting</CardTitle>
              <CardDescription>Where your game is hosted.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Game URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormDescription>
                      The URL where your game is hosted (iframe source).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="allowedOriginsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed Origins (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={
                          "https://my-game.vercel.app\nhttps://my-game.netlify.app"
                        }
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional static-mode bootstrap allowlist. Leave empty to
                      allow any origin using this App ID. Add one origin per
                      line to restrict production host bootstrap.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="thumbnailUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thumbnail URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://.../thumbnail.jpg"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Used as the game card image in the arcade browser.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="videoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preview Video URL (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://.../preview.mp4"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Plays on selected arcade cards when available.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="coverUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://.../cover.jpg" {...field} />
                    </FormControl>
                    <FormDescription>
                      Reserved for future larger hero/feature placements.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-3">
                <p className="text-sm font-medium">Media Preview</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <MediaPreview
                    label="Thumbnail"
                    url={thumbnailUrl}
                    type="image"
                  />
                  <MediaPreview
                    label="Preview Video"
                    url={videoUrl}
                    type="video"
                  />
                  <MediaPreview label="Cover" url={coverUrl} type="image" />
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>

      <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky bottom-0 -mx-4 border-t px-4 py-4 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex justify-end">
          <Button
            type="submit"
            form="game-settings-form"
            disabled={
              updateGame.isPending || (slugCheck && !slugCheck.available)
            }
          >
            {updateGame.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
