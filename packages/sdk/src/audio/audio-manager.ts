import { Howl, Howler } from "howler";
import type { ConnectionRole } from "../protocol";
import type { AirJamRealtimeClient } from "../runtime/realtime-client";
import {
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformAudioSettings,
  getEffectiveAudioVolume,
} from "../settings/platform-settings";

export type SoundCategory = "music" | "sfx";

export interface SoundConfig {
  src: string[];
  volume?: number;
  loop?: boolean;
  html5?: boolean;
  sprite?: {
    [key: string]: [number, number];
  };
  category?: SoundCategory;
}

export type SoundManifest = Record<string, SoundConfig>;

export function detectSoundCategory(config: SoundConfig): SoundCategory {
  if (config.category) {
    return config.category;
  }

  if (config.loop && config.html5) {
    return "music";
  }

  return "sfx";
}

export interface PlayOptions {
  remote?: boolean;
  target?: string;
  volume?: number;
  loop?: boolean;
  sprite?: string;
  pitch?: number;
}

export interface AudioHandle<T extends string = string> {
  init(): Promise<boolean>;
  isReady(): boolean;
  play(id: T, options?: PlayOptions): number | null;
  stop(id?: T, soundId?: number): void;
  mute(muted: boolean, id?: T, soundId?: number): void;
  isMuted(): boolean;
}

export class AudioManager<T extends string = string> implements AudioHandle<T> {
  private sounds: Map<string, Howl> = new Map();
  private categories: Map<string, SoundCategory> = new Map();
  private manifest: SoundManifest = {};
  private _muted = false;
  private socket: AirJamRealtimeClient | null = null;
  private roomId: string | null = null;
  private role: ConnectionRole | null = null;
  private activeSoundIds: Map<
    number,
    { soundId: string; category: SoundCategory }
  > = new Map();
  private audioSettings: PlatformAudioSettings =
    DEFAULT_PLATFORM_SETTINGS.audio;

  constructor(manifest?: SoundManifest) {
    if (manifest) {
      this.load(manifest);
    }
  }

  public destroy() {
    // No-op for now; retained for cleanup symmetry with other runtime owners.
  }

  public getCategory(soundId: string): SoundCategory {
    return this.categories.get(soundId) ?? "sfx";
  }

  public setSocket(
    socket: AirJamRealtimeClient | null,
    roomId?: string,
    role?: ConnectionRole,
  ) {
    this.socket = socket;
    if (roomId) this.roomId = roomId;
    if (role) this.role = role;
  }

  public async init(): Promise<boolean> {
    if (!Howler.ctx) {
      return false;
    }

    if (Howler.ctx.state === "suspended") {
      try {
        await Howler.ctx.resume();
      } catch {
        return false;
      }
    }

    return Howler.ctx.state === "running";
  }

  public isReady(): boolean {
    return Howler.ctx !== null && Howler.ctx.state === "running";
  }

  public load(manifest: SoundManifest) {
    this.manifest = { ...this.manifest, ...manifest };

    Object.entries(manifest).forEach(([key, config]) => {
      if (this.sounds.has(key)) return;

      const category = detectSoundCategory(config);
      this.categories.set(key, category);

      const baseVolume = config.volume ?? 1;
      const effectiveVolume = getEffectiveAudioVolume(
        this.audioSettings,
        category,
      );

      const sound = new Howl({
        src: config.src,
        volume: baseVolume * effectiveVolume,
        loop: config.loop ?? false,
        html5: config.html5 ?? false,
        sprite: config.sprite,
        preload: true,
      });

      this.sounds.set(key, sound);
    });
  }

  public applyPlatformAudioSettings(settings: PlatformAudioSettings) {
    this.audioSettings = settings;

    this.activeSoundIds.forEach((info, howlSoundId) => {
      const sound = this.sounds.get(info.soundId);
      if (!sound) {
        return;
      }

      const config = this.manifest[info.soundId];
      const baseVolume = config?.volume ?? 1;
      const effectiveVolume = getEffectiveAudioVolume(settings, info.category);
      sound.volume(baseVolume * effectiveVolume, howlSoundId);
    });

    this.sounds.forEach((sound, soundId) => {
      const category = this.categories.get(soundId) ?? "sfx";
      const config = this.manifest[soundId];
      const baseVolume = config?.volume ?? 1;
      const effectiveVolume = getEffectiveAudioVolume(settings, category);
      sound.volume(baseVolume * effectiveVolume);
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

    void this.init();

    if (remote) {
      this.playRemote(id, target, volume, loop);
      return null;
    }

    return this.playLocal(id, volume, loop, sprite, pitch);
  }

  private playLocal(
    id: string,
    volume?: number,
    loop?: boolean,
    sprite?: string,
    pitch?: number,
  ): number | null {
    if (!this.isReady()) {
      return null;
    }

    const sound = this.sounds.get(id);
    if (!sound) {
      console.warn(`Sound "${id}" not found`);
      return null;
    }

    const category = this.getCategory(id);
    const config = this.manifest[id];
    const baseVolume = config?.volume ?? 1;
    const effectiveVolume = getEffectiveAudioVolume(
      this.audioSettings,
      category,
    );
    const finalVolume =
      volume !== undefined
        ? volume * effectiveVolume
        : baseVolume * effectiveVolume;

    const soundId = sound.play(sprite);
    this.activeSoundIds.set(soundId, { soundId: id, category });

    sound.once("end", () => {
      this.activeSoundIds.delete(soundId);
    });

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
      this.socket.emit("host:play_sound", {
        roomId: this.roomId,
        targetControllerId: target,
        soundId: id,
        volume,
        loop,
      });
      return;
    }

    this.socket.emit("controller:play_sound", {
      roomId: this.roomId,
      soundId: id,
      volume,
      loop,
    });
  }

  private isHost(): boolean {
    return this.role === "host";
  }

  public playSpatial(
    id: T,
    pos: { x: number; y: number; z: number },
    sprite?: string,
  ): number | null {
    void this.init();

    const soundId = this.playLocal(id, undefined, undefined, sprite);
    if (soundId !== null) {
      const sound = this.sounds.get(id);
      if (sound) {
        sound.pos(pos.x, pos.y, pos.z, soundId);
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
      if (soundId !== undefined) {
        this.activeSoundIds.delete(soundId);
      } else {
        this.activeSoundIds.forEach((info, howlSoundId) => {
          if (info.soundId === id) {
            this.activeSoundIds.delete(howlSoundId);
          }
        });
      }
      return;
    }

    Howler.stop();
    this.activeSoundIds.clear();
  }

  public volume(vol: number, id?: T, soundId?: number) {
    if (id) {
      const sound = this.sounds.get(id);
      if (!sound) {
        return;
      }
      if (soundId !== undefined) {
        sound.volume(vol, soundId);
      } else {
        sound.volume(vol);
      }
      return;
    }

    Howler.volume(vol);
  }

  public mute(muted: boolean, id?: T, soundId?: number) {
    if (id) {
      const sound = this.sounds.get(id);
      sound?.mute(muted, soundId);
      return;
    }

    this._muted = muted;
    Howler.mute(muted);
  }

  public isMuted(): boolean {
    return this._muted;
  }

  public setListenerPos(x: number, y: number, z: number) {
    Howler.pos(x, y, z);
  }

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
