import { Howl, Howler } from "howler";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../protocol";
import { useVolumeStore } from "./volume-store";

export type SoundCategory = "music" | "sfx";

export interface SoundConfig {
  src: string[];
  volume?: number;
  loop?: boolean;
  html5?: boolean; // Force HTML5 Audio (good for large files/music)
  sprite?: {
    [key: string]: [number, number];
  };
  category?: SoundCategory; // Optional category for volume control grouping
}

export type SoundManifest = Record<string, SoundConfig>;

/**
 * Auto-detect sound category based on config heuristics
 * - If explicitly set, use it
 * - If loop=true and html5=true, likely music
 * - Otherwise, default to sfx
 */
export function detectSoundCategory(config: SoundConfig): SoundCategory {
  if (config.category) {
    return config.category;
  }

  // Heuristic: loop + html5 typically indicates music
  if (config.loop && config.html5) {
    return "music";
  }

  return "sfx";
}

export interface PlayOptions {
  remote?: boolean; // If true, send to network (Host->Controller or Controller->Host)
  target?: string; // Optional: Specific controller ID (only used if Host sending to Controller)
  volume?: number;
  loop?: boolean;
  sprite?: string;
  pitch?: number;
}

export class AudioManager<T extends string = string> {
  private sounds: Map<string, Howl> = new Map();
  private categories: Map<string, SoundCategory> = new Map();
  private manifest: SoundManifest = {};
  private _muted: boolean = false;
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
    null;
  private roomId: string | null = null;
  private activeSoundIds: Map<
    number,
    { soundId: string; category: SoundCategory }
  > = new Map();
  private volumeUnsubscribe: (() => void) | null = null;

  constructor(manifest?: SoundManifest) {
    // Initialize volume store FIRST to ensure values are loaded from localStorage
    // This must happen before loading sounds so they can use the stored volumes
    const initialState = useVolumeStore.getState();

    // Set up volume change subscription
    const updateAllSounds = (
      state: ReturnType<typeof useVolumeStore.getState>,
    ) => {
      // Update all currently playing sounds
      this.activeSoundIds.forEach((info, howlSoundId) => {
        const sound = this.sounds.get(info.soundId);
        if (sound) {
          const config = this.manifest[info.soundId];
          const baseVolume = config?.volume ?? 1.0;
          const effectiveVolume = state.getEffectiveVolume(info.category);
          const finalVolume = baseVolume * effectiveVolume;
          sound.volume(finalVolume, howlSoundId);
        }
      });

      // Also update the default volume for all loaded sounds (for future plays)
      this.sounds.forEach((sound, soundId) => {
        const category = this.categories.get(soundId) ?? "sfx";
        const config = this.manifest[soundId];
        const baseVolume = config?.volume ?? 1.0;
        const effectiveVolume = state.getEffectiveVolume(category);
        const newVolume = baseVolume * effectiveVolume;
        // Update default volume for the sound
        sound.volume(newVolume);
      });
    };

    // Subscribe to future changes
    this.volumeUnsubscribe = useVolumeStore.subscribe(updateAllSounds);

    // Now load sounds - they will use the stored volumes from the start
    if (manifest) {
      this.load(manifest);
      // Apply initial volumes to all loaded sounds immediately
      updateAllSounds(initialState);
    }
  }

  /**
   * Cleanup method to unsubscribe from volume changes
   */
  public destroy() {
    if (this.volumeUnsubscribe) {
      this.volumeUnsubscribe();
      this.volumeUnsubscribe = null;
    }
  }

  /**
   * Get the category for a sound (with auto-detection)
   */
  public getCategory(soundId: string): SoundCategory {
    return this.categories.get(soundId) ?? "sfx";
  }

  public setSocket(
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null,
    roomId?: string,
  ) {
    this.socket = socket;
    if (roomId) this.roomId = roomId;
  }

  /**
   * Initialize audio context (must be called on user interaction)
   */
  public init() {
    if (Howler.ctx && Howler.ctx.state === "suspended") {
      Howler.ctx.resume();
    }
  }

  /**
   * Check if audio context is ready to play sounds
   */
  public isReady(): boolean {
    return Howler.ctx !== null && Howler.ctx.state === "running";
  }

  public load(manifest: SoundManifest) {
    this.manifest = { ...this.manifest, ...manifest };

    // Get current volume store state to apply to new sounds
    const volumeStore = useVolumeStore.getState();

    Object.entries(manifest).forEach(([key, config]) => {
      if (this.sounds.has(key)) return;

      // Detect and store category
      const category = detectSoundCategory(config);
      this.categories.set(key, category);

      // Calculate effective volume for this sound
      const baseVolume = config.volume ?? 1.0;
      const effectiveVolume = volumeStore.getEffectiveVolume(category);
      const initialVolume = baseVolume * effectiveVolume;

      const sound = new Howl({
        src: config.src,
        volume: initialVolume, // Use effective volume from the start
        loop: config.loop ?? false,
        html5: config.html5 ?? false,
        sprite: config.sprite,
        preload: true,
      });

      this.sounds.set(key, sound);
    });
  }

  public play(id: T, options?: PlayOptions): number | null {
    const {
      remote = false,
      target,
      volume,
      loop,
      sprite,
      pitch,
    } = options || {};

    if (remote) {
      this.playRemote(id, target, volume, loop);
      return null; // Remote play doesn't return a local sound ID
    } else {
      return this.playLocal(id, volume, loop, sprite, pitch);
    }
  }

  private playLocal(
    id: string,
    volume?: number,
    loop?: boolean,
    sprite?: string,
    pitch?: number,
  ): number | null {
    const sound = this.sounds.get(id);
    if (!sound) {
      console.warn(`Sound "${id}" not found`);
      return null;
    }

    const category = this.getCategory(id);
    const config = this.manifest[id];
    const baseVolume = config?.volume ?? 1.0;

    // Get effective volume from volume store (always get fresh state)
    const volumeStore = useVolumeStore.getState();
    const effectiveVolume = volumeStore.getEffectiveVolume(category);

    // Calculate final volume BEFORE playing
    const finalVolume =
      volume !== undefined
        ? volume * effectiveVolume
        : baseVolume * effectiveVolume;

    // Play the sound
    const soundId = sound.play(sprite);

    // Store active sound ID for volume updates (do this before setting volume)
    this.activeSoundIds.set(soundId, { soundId: id, category });

    // Clean up when sound ends
    sound.once("end", () => {
      this.activeSoundIds.delete(soundId);
    });

    // Apply volume immediately after play (this overrides any default volume)
    sound.volume(finalVolume, soundId);

    if (loop !== undefined) sound.loop(loop, soundId);
    if (pitch !== undefined) sound.rate(pitch, soundId);

    return soundId;
  }

  private playRemote(
    id: string,
    target?: string,
    volume?: number,
    loop?: boolean,
  ) {
    if (!this.socket || !this.roomId) return;

    if (this.isHost()) {
      // Host -> Controller(s)
      this.socket.emit("host:play_sound", {
        roomId: this.roomId,
        targetControllerId: target, // If undefined, broadcasts to all
        soundId: id,
        volume,
        loop,
      });
    } else {
      // Controller -> Host
      this.socket.emit("controller:play_sound", {
        roomId: this.roomId,
        soundId: id,
        volume,
        loop,
      });
    }
  }

  private isHost(): boolean {
    // Heuristic: If we have a socket and it's connected as host...
    // Or we can just check if we are running in a browser environment that looks like host?
    // Better: The socket instance usually has query params or we can pass a flag.
    // For now, let's assume if we are calling playRemote with a target, we are likely host.
    // Actually, we can just rely on the fact that `host:play_sound` is only available on Host socket type?
    // No, both share types.

    // Let's add a role property to AudioManager or infer from socket.
    const query = this.socket?.io?.opts?.query;
    return (
      (query &&
        typeof query === "object" &&
        "role" in query &&
        query.role === "host") ||
      false
    );
  }

  /**
   * Play a sound at a specific 3D position
   */
  public playSpatial(
    id: T,
    pos: { x: number; y: number; z: number },
    sprite?: string,
  ): number | null {
    const soundId = this.playLocal(id, undefined, undefined, sprite);
    if (soundId !== null) {
      const sound = this.sounds.get(id);
      if (sound) {
        sound.pos(pos.x, pos.y, pos.z, soundId);
        // Enable 3D spatialization for this sound instance
        sound.pannerAttr(
          {
            panningModel: "HRTF",
            refDistance: 1,
            maxDistance: 1000,
            rolloffFactor: 1,
            distanceModel: "inverse",
          },
          soundId,
        );
      }
    }
    return soundId;
  }

  public stop(id?: T, soundId?: number) {
    if (id) {
      const sound = this.sounds.get(id);
      sound?.stop(soundId);
      // Clean up active sound tracking
      if (soundId !== undefined) {
        this.activeSoundIds.delete(soundId);
      } else {
        // Remove all instances of this sound
        this.activeSoundIds.forEach((info, howlSoundId) => {
          if (info.soundId === id) {
            this.activeSoundIds.delete(howlSoundId);
          }
        });
      }
    } else {
      // Stop all
      Howler.stop();
      this.activeSoundIds.clear();
    }
  }

  public volume(vol: number, id?: T, soundId?: number) {
    if (id) {
      const sound = this.sounds.get(id);
      if (sound) {
        if (soundId !== undefined) {
          sound.volume(vol, soundId);
        } else {
          sound.volume(vol);
        }
      }
    } else {
      Howler.volume(vol);
    }
  }

  public mute(muted: boolean, id?: T, soundId?: number) {
    if (id) {
      const sound = this.sounds.get(id);
      sound?.mute(muted, soundId);
    } else {
      this._muted = muted;
      Howler.mute(muted);
    }
  }

  public isMuted(): boolean {
    return this._muted;
  }

  /**
   * Update the listener position for spatial audio
   */
  public setListenerPos(x: number, y: number, z: number) {
    Howler.pos(x, y, z);
  }

  /**
   * Update the listener orientation for spatial audio
   */
  public setListenerOrientation(
    x: number,
    y: number,
    z: number,
    xUp: number,
    yUp: number,
    zUp: number,
  ) {
    Howler.orientation(x, y, z, xUp, yUp, zUp);
  }
}

export const createAudioManager = <T extends string = string>(
  manifest?: SoundManifest,
) => new AudioManager<T>(manifest);
