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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
  coverUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  minPlayers: z.number().min(1),
  maxPlayers: z.number().min(1).nullable().optional(),
  orientation: z.enum(["landscape", "portrait", "any"]),
  isPublished: z.boolean(),
});

type GameSettingsForm = z.infer<typeof gameSettingsSchema>;

export default function GameSettingsPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const utils = api.useUtils();

  const { data: game, isLoading } = api.game.get.useQuery({ id: gameId });
  const updateGame = api.game.update.useMutation({
    onSuccess: () => {
      utils.game.get.invalidate({ id: gameId });
      alert("Settings saved successfully!");
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
      coverUrl: "",
      minPlayers: 1,
      maxPlayers: null,
      orientation: "landscape",
      isPublished: false,
    },
  });

  useEffect(() => {
    if (game) {
      form.reset({
        name: game.name,
        slug: game.slug || "",
        description: game.description || "",
        url: game.url,
        thumbnailUrl: game.thumbnailUrl || "",
        coverUrl: game.coverUrl || "",
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        orientation:
          (game.orientation as "landscape" | "portrait" | "any") || "landscape",
        isPublished: game.isPublished,
      });
    }
  }, [game, form]);

  const onSubmit = (data: GameSettingsForm) => {
    updateGame.mutate({
      id: gameId,
      ...data,
    });
  };

  if (isLoading) return <div>Loading settings...</div>;

  return (
    <div className="relative space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground">
          Manage your game&apos;s metadata and gameplay settings.
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug (URL)</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <span className="bg-muted text-muted-foreground flex items-center rounded-l-md border border-r-0 px-3 text-sm">
                            /play/
                          </span>
                          <Input className="rounded-l-none" {...field} />
                        </div>
                      </FormControl>
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
            </CardContent>
          </Card>

          {/* Gameplay Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Gameplay</CardTitle>
              <CardDescription>How the game is played.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minPlayers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Players</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value, 10))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxPlayers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Players</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Leave empty for infinite"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(
                              value === "" ? null : parseInt(value, 10),
                            );
                          }}
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="orientation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Screen Orientation</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select orientation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="landscape">Landscape</SelectItem>
                        <SelectItem value="portrait">Portrait</SelectItem>
                        <SelectItem value="any">Any</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Publishing */}
          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
              <CardDescription>
                Control visibility in the arcade.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Publish to Arcade</FormLabel>
                <FormDescription>
                  When enabled, the game will be visible in the public library.
                </FormDescription>
              </div>
              <FormField
                control={form.control}
                name="isPublished"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </form>
      </Form>

      <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky bottom-0 -mx-4 border-t px-4 py-4 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex justify-end">
          <Button
            type="submit"
            form="game-settings-form"
            disabled={updateGame.isPending}
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
