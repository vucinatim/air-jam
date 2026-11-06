import {
  archivePlatformGameMediaAsset,
  assignPlatformGameMediaAsset,
  inspectPlatformGameMedia,
  uploadPlatformGameMediaFile,
} from "@air-jam/devtools/platform-game-media";
import { Command } from "commander";
import kleur from "kleur";

const GAME_MEDIA_KIND_LABEL: Record<
  "thumbnail" | "cover" | "preview_video",
  string
> = {
  thumbnail: "Thumbnail",
  cover: "Cover",
  preview_video: "Preview Video",
};

const formatBytes = (value: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const normalizeGameMediaKind = (
  value: string,
): "thumbnail" | "cover" | "preview_video" => {
  const normalized = value.trim();
  if (normalized === "thumbnail" || normalized === "cover") {
    return normalized;
  }
  if (normalized === "preview_video" || normalized === "preview-video") {
    return "preview_video";
  }

  throw new Error(
    `Unsupported media kind "${value}". Use thumbnail, cover, or preview_video.`,
  );
};

const printHostedGameMedia = ({
  result,
  heading,
}: {
  result: Awaited<ReturnType<typeof inspectPlatformGameMedia>>;
  heading: string;
}) => {
  console.log(kleur.green(`\n✓ ${heading}\n`));
  console.log(`Game: ${kleur.cyan(result.game.name)}`);
  console.log(`ID: ${kleur.cyan(result.game.id)}`);
  console.log(`Slug: ${kleur.cyan(result.game.slug ?? "(none)")}`);

  for (const kind of ["thumbnail", "cover", "preview_video"] as const) {
    const assets = result.assets.filter((asset) => asset.kind === kind);
    const activeAsset = assets.find((asset) => asset.isActive) ?? null;

    console.log("");
    console.log(kleur.bold(GAME_MEDIA_KIND_LABEL[kind]));
    console.log(
      `Active: ${kleur.cyan(activeAsset?.id ?? "(none)")}${activeAsset?.publicUrl ? `  ${kleur.dim(activeAsset.publicUrl)}` : ""}`,
    );

    if (assets.length === 0) {
      console.log(kleur.dim("  No uploaded assets."));
      continue;
    }

    for (const asset of assets) {
      console.log(
        `  ${asset.isActive ? kleur.green("●") : kleur.dim("○")} ${kleur.cyan(asset.id)}  ${kleur.yellow(asset.status)}  ${asset.originalFilename}  ${kleur.dim(formatBytes(asset.sizeBytes))}`,
      );
    }
  }
};

const runGameMediaInspectCommand = async ({
  platformUrl,
  game,
  json,
}: {
  platformUrl?: string;
  game: string;
  json?: boolean;
}) => {
  const result = await inspectPlatformGameMedia({
    platformUrl,
    slugOrId: game,
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  printHostedGameMedia({
    result,
    heading: "Hosted game media",
  });
};

const runGameMediaUploadCommand = async ({
  platformUrl,
  game,
  thumbnail,
  cover,
  previewVideo,
}: {
  platformUrl?: string;
  game: string;
  thumbnail?: string;
  cover?: string;
  previewVideo?: string;
}) => {
  const uploads = [
    ...(thumbnail ? [{ kind: "thumbnail" as const, filePath: thumbnail }] : []),
    ...(cover ? [{ kind: "cover" as const, filePath: cover }] : []),
    ...(previewVideo
      ? [{ kind: "preview_video" as const, filePath: previewVideo }]
      : []),
  ];

  if (uploads.length === 0) {
    throw new Error(
      "No media files were provided. Pass at least one of --thumbnail, --cover, or --preview-video.",
    );
  }

  console.log(kleur.green("\n✓ Uploading hosted game media\n"));

  for (const upload of uploads) {
    const result = await uploadPlatformGameMediaFile({
      platformUrl,
      slugOrId: game,
      kind: upload.kind,
      filePath: upload.filePath,
    });
    console.log(
      `${kleur.cyan(GAME_MEDIA_KIND_LABEL[upload.kind])}: ${kleur.cyan(result.assigned.asset.id)}  ${kleur.dim(result.filePath)}`,
    );
  }

  const inspected = await inspectPlatformGameMedia({
    platformUrl,
    slugOrId: game,
  });
  printHostedGameMedia({
    result: inspected,
    heading: "Hosted game media updated",
  });
};

const runGameMediaClearCommand = async ({
  platformUrl,
  game,
  kind,
}: {
  platformUrl?: string;
  game: string;
  kind: "thumbnail" | "cover" | "preview_video";
}) => {
  const current = await inspectPlatformGameMedia({
    platformUrl,
    slugOrId: game,
  });
  const activeAsset = current.assets.find(
    (asset) => asset.kind === kind && asset.isActive,
  );

  if (!activeAsset) {
    console.log(
      kleur.yellow(
        `\nNo active ${GAME_MEDIA_KIND_LABEL[kind].toLowerCase()} to clear.\n`,
      ),
    );
    return;
  }

  await archivePlatformGameMediaAsset({
    platformUrl,
    slugOrId: game,
    assetId: activeAsset.id,
  });

  const inspected = await inspectPlatformGameMedia({
    platformUrl,
    slugOrId: game,
  });
  printHostedGameMedia({
    result: inspected,
    heading: `${GAME_MEDIA_KIND_LABEL[kind]} cleared`,
  });
};

export const registerGameMediaCommands = (gameCommand: Command) => {
  const gameMediaCommand = gameCommand
    .command("media")
    .description("Manage hosted game media assets");

  gameMediaCommand
    .command("inspect")
    .alias("list")
    .description(
      "List hosted media assets, their IDs, kinds, status and active selection",
    )
    .requiredOption("--game <slug-or-id>", "Owned hosted game slug or ID")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--json", "Print one machine-readable JSON document", false)
    .action(async (options: unknown) => {
      const resolved = options as {
        platformUrl?: string;
        game: string;
        json: boolean;
      };

      await runGameMediaInspectCommand({
        platformUrl: resolved.platformUrl,
        game: resolved.game,
        json: resolved.json,
      });
    });

  gameMediaCommand
    .command("upload")
    .description("Upload and assign hosted media for one owned game")
    .requiredOption("--game <slug-or-id>", "Owned hosted game slug or ID")
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .option("--thumbnail <path>", "Thumbnail image file")
    .option("--cover <path>", "Cover image file")
    .option("--preview-video <path>", "Preview video file")
    .action(async (options: unknown) => {
      const resolved = options as {
        platformUrl?: string;
        game: string;
        thumbnail?: string;
        cover?: string;
        previewVideo?: string;
      };

      await runGameMediaUploadCommand({
        platformUrl: resolved.platformUrl,
        game: resolved.game,
        thumbnail: resolved.thumbnail,
        cover: resolved.cover,
        previewVideo: resolved.previewVideo,
      });
    });

  gameMediaCommand
    .command("clear")
    .description("Archive the currently active hosted media asset for one slot")
    .requiredOption("--game <slug-or-id>", "Owned hosted game slug or ID")
    .requiredOption(
      "--kind <kind>",
      "Media slot to clear (thumbnail, cover, or preview_video)",
    )
    .option("--platform-url <url>", "Hosted Air Jam platform base URL")
    .action(async (options: unknown) => {
      const resolved = options as {
        platformUrl?: string;
        game: string;
        kind: string;
      };

      await runGameMediaClearCommand({
        platformUrl: resolved.platformUrl,
        game: resolved.game,
        kind: normalizeGameMediaKind(resolved.kind),
      });
    });

  for (const action of ["assign", "archive"] as const) {
    gameMediaCommand
      .command(action)
      .description(
        action === "assign"
          ? "Make an existing media asset current for its kind"
          : "Archive a media asset by ID, clearing its slot if active",
      )
      .requiredOption("--game <slug-or-id>", "Owned hosted game slug or ID")
      .requiredOption(
        "--asset-id <id>",
        "Existing media asset ID from media list",
      )
      .option("--platform-url <url>", "Hosted Air Jam platform base URL")
      .option("--json", "Print one machine-readable JSON document", false)
      .action(
        async (options: {
          platformUrl?: string;
          game: string;
          assetId: string;
          json: boolean;
        }) => {
          const mutate =
            action === "assign"
              ? assignPlatformGameMediaAsset
              : archivePlatformGameMediaAsset;
          const result = await mutate({
            platformUrl: options.platformUrl,
            slugOrId: options.game,
            assetId: options.assetId,
          });
          if (options.json) {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
            return;
          }
          console.log(
            `${action === "assign" ? "Assigned" : "Archived"} ${GAME_MEDIA_KIND_LABEL[result.asset.kind]} ${result.asset.id} for ${result.game.name}.`,
          );
        },
      );
  }

  gameMediaCommand.action(() => {
    gameMediaCommand.outputHelp();
  });
};
