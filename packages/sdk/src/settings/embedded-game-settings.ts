import type { AirJamSettings, SettingsValues } from "../core/settings";

/** What an embedded game's host offers the platform: its declared settings, read and changed. */
export interface EmbeddedGameSettingsSource {
  readonly declaration: AirJamSettings;
  read(): { values: SettingsValues; revision: number };
  subscribe(listener: () => void): () => void;
  update(patch: SettingsValues, expectedRevision: number): unknown;
}

let source: EmbeddedGameSettingsSource | null = null;
const watchers = new Set<(source: EmbeddedGameSettingsSource | null) => void>();

/** A host in a platform frame offers its settings here; the bridge carries them. */
export const publishEmbeddedGameSettings = (
  published: EmbeddedGameSettingsSource,
): (() => void) => {
  source = published;
  for (const watcher of watchers) watcher(source);
  return () => {
    if (source !== published) return;
    source = null;
    for (const watcher of watchers) watcher(null);
  };
};

export const watchEmbeddedGameSettings = (
  watcher: (source: EmbeddedGameSettingsSource | null) => void,
): (() => void) => {
  watchers.add(watcher);
  watcher(source);
  return () => {
    watchers.delete(watcher);
  };
};
