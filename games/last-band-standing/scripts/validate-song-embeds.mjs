#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_OPTION_COUNT,
  DEFAULT_TOTAL_ROUNDS,
} from "../src/game/constants.ts";
import {
  getRoundOptionLabel,
  hasEnoughRoundOptionLabels,
  normalizeRoundOptionLabel,
} from "../src/game/content/round-options.ts";
import {
  getSongById,
  getSongCanonicalKey,
  getSongsForBuckets,
  songBank,
  songBuckets,
} from "../src/game/content/song-bank.ts";
import { roundGuessKinds } from "../src/game/domain/types.ts";
import { extractYouTubeVideoId } from "../src/host/youtube/youtube-embed.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const DEFAULT_OUTPUT = path.resolve(
  projectRoot,
  "reports/song-embed-report.json",
);
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CONCURRENCY = 6;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

const usage = () => {
  console.log(
    `Usage: pnpm songs:validate [options]\n\nOptions:\n  --output <path>           JSON report output path (default: reports/song-embed-report.json)\n  --timeout-ms <number>     HTTP timeout per video check (default: ${DEFAULT_TIMEOUT_MS})\n  --concurrency <number>    Parallel checks (default: ${DEFAULT_CONCURRENCY})\n  --skip-embed-checks       Run deterministic catalog checks without YouTube oEmbed requests\n  --fail-on-invalid         Also fail when YouTube reports a video blocked/unavailable\n  --help                    Show this help\n`,
  );
};

const parseArgs = (argv) => {
  const args = {
    output: DEFAULT_OUTPUT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    concurrency: DEFAULT_CONCURRENCY,
    skipEmbedChecks: false,
    failOnInvalid: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      continue;
    }
    if (token === "--help") {
      usage();
      process.exit(0);
    }
    if (token === "--skip-embed-checks") {
      args.skipEmbedChecks = true;
      continue;
    }
    if (token === "--fail-on-invalid") {
      args.failOnInvalid = true;
      continue;
    }
    if (token === "--output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --output");
      }
      args.output = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (token === "--timeout-ms") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--timeout-ms must be a positive integer");
      }
      args.timeoutMs = value;
      index += 1;
      continue;
    }
    if (token === "--concurrency") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--concurrency must be a positive integer");
      }
      args.concurrency = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
};

const getBucketIds = (song) =>
  Array.isArray(song.bucketIds) ? song.bucketIds : [];

const validateCatalog = () => {
  const issues = [];
  const declaredBucketIds = new Set(songBuckets.map((bucket) => bucket.id));
  const songIds = new Set(songBank.map((song) => song.id));
  const songsByCanonicalKey = new Map();
  const songsByVideoId = new Map();

  songBank.forEach((song) => {
    const canonicalKey = getSongCanonicalKey(song);
    const existing = songsByCanonicalKey.get(canonicalKey);
    if (existing) {
      issues.push({
        code: "duplicate-canonical-song",
        songId: song.id,
        relatedSongId: existing.id,
        message: `"${song.artist} — ${song.title}" duplicates canonical song "${existing.id}".`,
      });
    } else {
      songsByCanonicalKey.set(canonicalKey, song);
    }

    const bucketIds = getBucketIds(song);
    if (bucketIds.length === 0) {
      issues.push({
        code: "missing-bucket-ownership",
        songId: song.id,
        message: "Every song must explicitly own at least one bucket.",
      });
    }

    const seenBucketIds = new Set();
    bucketIds.forEach((bucketId) => {
      if (seenBucketIds.has(bucketId)) {
        issues.push({
          code: "duplicate-song-bucket",
          songId: song.id,
          bucketId,
          message: `Song declares bucket "${bucketId}" more than once.`,
        });
      }
      seenBucketIds.add(bucketId);

      if (!declaredBucketIds.has(bucketId)) {
        issues.push({
          code: "unknown-song-bucket",
          songId: song.id,
          bucketId,
          message: `Song references undeclared bucket "${bucketId}".`,
        });
      }
    });

    let parsedUrl = null;
    try {
      parsedUrl = new URL(song.youtubeUrl);
    } catch {
      // Reported below as an invalid YouTube URL.
    }
    const videoId = extractYouTubeVideoId(song.youtubeUrl);
    if (
      !parsedUrl ||
      parsedUrl.protocol !== "https:" ||
      !YOUTUBE_HOSTS.has(parsedUrl.hostname) ||
      !videoId
    ) {
      issues.push({
        code: "invalid-youtube-url",
        songId: song.id,
        message:
          "youtubeUrl must be an HTTPS YouTube watch, share, shorts, or embed URL with an 11-character video id.",
      });
    } else {
      const existingVideoSong = songsByVideoId.get(videoId);
      if (existingVideoSong) {
        issues.push({
          code: "duplicate-youtube-video",
          songId: song.id,
          relatedSongId: existingVideoSong.id,
          message: `YouTube video "${videoId}" is already used by "${existingVideoSong.id}".`,
        });
      } else {
        songsByVideoId.set(videoId, song);
      }
    }

    if (!song.forcedOptionSongId) {
      return;
    }

    const forcedSong = getSongById(song.forcedOptionSongId);
    if (!forcedSong || !songIds.has(song.forcedOptionSongId)) {
      issues.push({
        code: "missing-forced-option",
        songId: song.id,
        relatedSongId: song.forcedOptionSongId,
        message: `Forced option "${song.forcedOptionSongId}" does not exist.`,
      });
      return;
    }
    if (forcedSong.id === song.id) {
      issues.push({
        code: "self-forced-option",
        songId: song.id,
        relatedSongId: forcedSong.id,
        message: "A song cannot force itself as a distractor.",
      });
    }

    const forcedBucketIds = new Set(getBucketIds(forcedSong));
    if (!bucketIds.some((bucketId) => forcedBucketIds.has(bucketId))) {
      issues.push({
        code: "forced-option-outside-category",
        songId: song.id,
        relatedSongId: forcedSong.id,
        message:
          "A forced distractor must share at least one bucket with its source song.",
      });
    }
  });

  if (getSongsForBuckets([]).length !== 0) {
    issues.push({
      code: "empty-bucket-selection-not-empty",
      message: "getSongsForBuckets([]) must return no songs.",
    });
  }

  const buckets = songBuckets.map((bucket) => {
    const songs = getSongsForBuckets([bucket.id]);
    const expectedSongIds = songBank
      .filter((song) => getBucketIds(song).includes(bucket.id))
      .map((song) => song.id)
      .sort();
    const actualSongIds = songs.map((song) => song.id).sort();

    if (actualSongIds.join("\u0000") !== expectedSongIds.join("\u0000")) {
      issues.push({
        code: "bucket-selection-mismatch",
        bucketId: bucket.id,
        message:
          "getSongsForBuckets result does not match the songs that explicitly own this bucket.",
      });
    }

    if (songs.length === 0) {
      issues.push({
        code: "empty-bucket",
        bucketId: bucket.id,
        message: `Bucket "${bucket.label}" has no songs.`,
      });
    }
    if (songs.length < DEFAULT_TOTAL_ROUNDS) {
      issues.push({
        code: "insufficient-match-length",
        bucketId: bucket.id,
        message: `Bucket "${bucket.label}" needs at least ${DEFAULT_TOTAL_ROUNDS} songs for a default match; found ${songs.length}.`,
      });
    }

    const distinctLabels = Object.fromEntries(
      roundGuessKinds.map((guessKind) => {
        const labels = new Set(
          songs.map((song) =>
            normalizeRoundOptionLabel(getRoundOptionLabel(song, guessKind)),
          ),
        );
        if (
          !hasEnoughRoundOptionLabels(songs, DEFAULT_OPTION_COUNT, guessKind)
        ) {
          issues.push({
            code: "insufficient-distinct-option-labels",
            bucketId: bucket.id,
            guessKind,
            message: `Bucket "${bucket.label}" needs at least ${DEFAULT_OPTION_COUNT} distinct visible ${guessKind} labels; found ${labels.size}.`,
          });
        }
        return [guessKind, labels.size];
      }),
    );

    return {
      id: bucket.id,
      label: bucket.label,
      songCount: songs.length,
      distinctLabels,
    };
  });

  return { issues, buckets };
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: safeConcurrency }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

const checkYouTubeEmbed = async (videoId, timeoutMs) => {
  const canonicalWatchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = new URL("https://www.youtube.com/oembed");
  oembedUrl.searchParams.set("url", canonicalWatchUrl);
  oembedUrl.searchParams.set("format", "json");

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(oembedUrl, {
      signal: abortController.signal,
      headers: { "user-agent": "air-jam-song-validator/2.0" },
    });
    const detail = (await response.text()).slice(0, 220);
    if (response.ok) {
      return {
        videoId,
        embeddable: true,
        status: "ok",
        httpStatus: response.status,
        detail: detail || "Embeddable via YouTube oEmbed.",
      };
    }

    return {
      videoId,
      embeddable: false,
      status:
        response.status === 401 || response.status === 403
          ? "embed-blocked"
          : response.status === 404
            ? "video-not-found"
            : "oembed-error",
      httpStatus: response.status,
      detail: detail || `YouTube oEmbed returned HTTP ${response.status}.`,
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return {
      videoId,
      embeddable: false,
      status: isTimeout ? "timeout" : "network-error",
      httpStatus: null,
      detail: isTimeout
        ? `Timed out after ${timeoutMs}ms while checking oEmbed.`
        : error instanceof Error
          ? error.message
          : "Unknown network error.",
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const catalog = validateCatalog();
  const songsWithVideoIds = songBank.map((song) => ({
    ...song,
    videoId: extractYouTubeVideoId(song.youtubeUrl),
  }));
  const uniqueVideoIds = [
    ...new Set(
      songsWithVideoIds
        .map((song) => song.videoId)
        .filter((videoId) => videoId !== null),
    ),
  ];
  const embedResults = args.skipEmbedChecks
    ? []
    : await mapWithConcurrency(uniqueVideoIds, args.concurrency, (videoId) =>
        checkYouTubeEmbed(videoId, args.timeoutMs),
      );
  const embedByVideoId = new Map(
    embedResults.map((result) => [result.videoId, result]),
  );
  const results = songsWithVideoIds
    .map((song) => ({
      ...song,
      canonicalKey: getSongCanonicalKey(song),
      embed: song.videoId ? (embedByVideoId.get(song.videoId) ?? null) : null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const invalidEmbedCount = embedResults.filter(
    (result) => !result.embeddable,
  ).length;

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSongs: songBank.length,
      totalBuckets: songBuckets.length,
      catalogIssues: catalog.issues.length,
      checkedUniqueVideos: embedResults.length,
      invalidOrBlockedVideos: invalidEmbedCount,
    },
    catalogIssues: catalog.issues,
    buckets: catalog.buckets,
    results,
  };

  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    `Catalog: ${songBank.length} songs across ${songBuckets.length} buckets`,
  );
  console.log(`Deterministic catalog issues: ${catalog.issues.length}`);
  if (!args.skipEmbedChecks) {
    console.log(
      `YouTube: ${embedResults.length - invalidEmbedCount}/${embedResults.length} unique videos embeddable`,
    );
  }

  if (catalog.issues.length > 0) {
    console.log("\nCatalog issues:");
    catalog.issues.slice(0, 30).forEach((issue) => {
      const scope = [issue.bucketId, issue.songId].filter(Boolean).join("/");
      console.log(
        `- ${issue.code}${scope ? ` [${scope}]` : ""}: ${issue.message}`,
      );
    });
    if (catalog.issues.length > 30) {
      console.log(
        `...and ${catalog.issues.length - 30} more (see JSON report)`,
      );
    }
  }

  if (invalidEmbedCount > 0) {
    console.log("\nVideos needing curation:");
    embedResults
      .filter((result) => !result.embeddable)
      .slice(0, 20)
      .forEach((result) => {
        console.log(`- ${result.videoId}: ${result.status}`);
      });
  }

  console.log(
    `\nReport written to ${path.relative(process.cwd(), args.output)}`,
  );

  if (
    catalog.issues.length > 0 ||
    (args.failOnInvalid && invalidEmbedCount > 0)
  ) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error("Song catalog validation failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
