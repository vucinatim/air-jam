#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const DEFAULT_SOURCE = path.resolve(projectRoot, "src/song-bank.ts");
const DEFAULT_OUTPUT = path.resolve(projectRoot, "reports/song-embed-report.json");
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CONCURRENCY = 6;

const YOUTUBE_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

const SONG_ENTRY_REGEX =
  /\{\s*(?:"id"|id)\s*:\s*"([^"]+)"\s*,\s*(?:"title"|title)\s*:\s*"([^"]+)"\s*,\s*(?:"artist"|artist)\s*:\s*"([^"]+)"\s*,\s*(?:"youtubeUrl"|youtubeUrl)\s*:\s*"([^"]+)"([\s\S]*?)\}/g;

const usage = () => {
  console.log(`Usage: node ./scripts/validate-song-embeds.mjs [options]\n\nOptions:\n  --source <path>           Song bank source file (default: src/song-bank.ts)\n  --output <path>           JSON report output path (default: reports/song-embed-report.json)\n  --timeout-ms <number>     HTTP timeout per video check (default: ${DEFAULT_TIMEOUT_MS})\n  --concurrency <number>    Parallel checks (default: ${DEFAULT_CONCURRENCY})\n  --fail-on-invalid         Exit with code 1 when any song is blocked/invalid\n  --help                    Show this help\n`);
};

const parseArgs = (argv) => {
  const args = {
    source: DEFAULT_SOURCE,
    output: DEFAULT_OUTPUT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    concurrency: DEFAULT_CONCURRENCY,
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

    if (token === "--fail-on-invalid") {
      args.failOnInvalid = true;
      continue;
    }

    if (token === "--source") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --source");
      }
      args.source = path.resolve(process.cwd(), value);
      index += 1;
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

const extractVideoId = (youtubeUrl) => {
  const match = youtubeUrl.match(YOUTUBE_ID_REGEX);
  return match?.[1] ?? null;
};

const parseSongEntries = (sourceText) => {
  const songs = [];

  for (const match of sourceText.matchAll(SONG_ENTRY_REGEX)) {
    const [, id, title, artist, youtubeUrl] = match;
    songs.push({ id, title, artist, youtubeUrl });
  }

  if (songs.length === 0) {
    throw new Error("No songs found in source file. Expected raw song objects in src/song-bank.ts");
  }

  return songs;
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

const checkSong = async (song, timeoutMs) => {
  const videoId = extractVideoId(song.youtubeUrl);
  if (!videoId) {
    return {
      ...song,
      videoId: null,
      embeddable: false,
      status: "invalid-url",
      httpStatus: null,
      detail: "Could not extract a valid YouTube video ID.",
      fixHint: "Replace youtubeUrl with a valid YouTube watch/share URL.",
    };
  }

  const canonicalWatchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = new URL("https://www.youtube.com/oembed");
  oembedUrl.searchParams.set("url", canonicalWatchUrl);
  oembedUrl.searchParams.set("format", "json");

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(oembedUrl, {
      signal: abortController.signal,
      headers: {
        "user-agent": "air-jam-song-validator/1.0",
      },
    });

    const detail = (await response.text()).slice(0, 220);

    if (response.ok) {
      return {
        ...song,
        videoId,
        embeddable: true,
        status: "ok",
        httpStatus: response.status,
        detail: detail || "Embeddable via YouTube oEmbed.",
        fixHint: null,
      };
    }

    const blockedStatus = response.status === 401 || response.status === 403;
    const notFoundStatus = response.status === 404;

    return {
      ...song,
      videoId,
      embeddable: false,
      status: blockedStatus
        ? "embed-blocked"
        : notFoundStatus
          ? "video-not-found"
          : "oembed-error",
      httpStatus: response.status,
      detail: detail || `YouTube oEmbed returned HTTP ${response.status}.`,
      fixHint: blockedStatus
        ? "Replace this song with a video that allows embedding."
        : "Verify the video is still public and available.",
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";

    return {
      ...song,
      videoId,
      embeddable: false,
      status: isTimeout ? "timeout" : "network-error",
      httpStatus: null,
      detail: isTimeout
        ? `Timed out after ${timeoutMs}ms while checking oEmbed.`
        : error instanceof Error
          ? error.message
          : "Unknown network error.",
      fixHint: "Retry validation. If it persists, manually test this URL in /youtube-test.",
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const sourceText = await readFile(args.source, "utf8");
  const songs = parseSongEntries(sourceText);

  const duplicateIds = new Set();
  const uniqueIds = new Set();
  songs.forEach((song) => {
    if (uniqueIds.has(song.id)) {
      duplicateIds.add(song.id);
    }
    uniqueIds.add(song.id);
  });

  const checked = await mapWithConcurrency(songs, args.concurrency, (song) =>
    checkSong(song, args.timeoutMs),
  );

  const results = checked
    .map((entry) => ({
      ...entry,
      duplicateId: duplicateIds.has(entry.id),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  const embeddableCount = results.filter((entry) => entry.embeddable).length;
  const blockedCount = results.filter((entry) => !entry.embeddable).length;
  const duplicateCount = duplicateIds.size;

  const report = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(process.cwd(), args.source),
    summary: {
      totalSongs: results.length,
      embeddable: embeddableCount,
      invalidOrBlocked: blockedCount,
      duplicateSongIds: duplicateCount,
    },
    results,
  };

  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Checked ${results.length} songs from ${report.sourceFile}`);
  console.log(
    `Embeddable: ${embeddableCount} | Invalid/Blocked: ${blockedCount} | Duplicate IDs: ${duplicateCount}`,
  );

  const invalidEntries = results.filter((entry) => !entry.embeddable || entry.duplicateId);
  if (invalidEntries.length > 0) {
    console.log("\nSongs needing curation:");
    invalidEntries.slice(0, 20).forEach((entry) => {
      const issues = [
        entry.embeddable ? null : entry.status,
        entry.duplicateId ? "duplicate-id" : null,
      ].filter(Boolean);
      console.log(`- ${entry.id} (${issues.join(", ")}) -> ${entry.youtubeUrl}`);
    });
    if (invalidEntries.length > 20) {
      console.log(`...and ${invalidEntries.length - 20} more (see JSON report)`);
    }
  }

  const outputLabel = path.relative(process.cwd(), args.output);
  console.log(`\nReport written to ${outputLabel}`);

  if (args.failOnInvalid && (blockedCount > 0 || duplicateCount > 0)) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error("Song embed validation failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
