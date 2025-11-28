import { Howl, Howler } from "howler";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../protocol";

export interface SoundConfig {
  src: string[];
  volume?: number;
  loop?: boolean;
  html5?: boolean; // Force HTML5 Audio (good for large files/music)
  sprite?: {
    [key: string]: [number, number];
  };
}

export type SoundManifest = Record<string, SoundConfig>;

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
  private manifest: SoundManifest = {};
  private _muted: boolean = false;
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private roomId: string | null = null;

  constructor(manifest?: SoundManifest) {
    if (manifest) {
      this.load(manifest);
    }
  }

  public setSocket(socket: Socket<ServerToClientEvents, ClientToServerEvents> | null, roomId?: string) {
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

  public load(manifest: SoundManifest) {
    this.manifest = { ...this.manifest, ...manifest };
    
    Object.entries(manifest).forEach(([key, config]) => {
      if (this.sounds.has(key)) return;

      const sound = new Howl({
        src: config.src,
        volume: config.volume ?? 1.0,
        loop: config.loop ?? false,
        html5: config.html5 ?? false,
        sprite: config.sprite,
        preload: true,
      });

      this.sounds.set(key, sound);
    });
  }

  public play(id: T, options?: PlayOptions): number | null {
    const { remote = false, target, volume, loop, sprite, pitch } = options || {};

    if (remote) {
      this.playRemote(id, target, volume, loop);
      return null; // Remote play doesn't return a local sound ID
    } else {
      return this.playLocal(id, volume, loop, sprite, pitch);
    }
  }

  private playLocal(id: string, volume?: number, loop?: boolean, sprite?: string, pitch?: number): number | null {
    const sound = this.sounds.get(id);
    if (!sound) {
      console.warn(`Sound "${id}" not found`);
      return null;
    }
    
    const soundId = sound.play(sprite);
    
    if (volume !== undefined) sound.volume(volume, soundId);
    if (loop !== undefined) sound.loop(loop, soundId);
    if (pitch !== undefined) sound.rate(pitch, soundId);
    
    return soundId;
  }

  private playRemote(id: string, target?: string, volume?: number, loop?: boolean) {
    if (!this.socket || !this.roomId) return;

    if (this.isHost()) {
        // Host -> Controller(s)
        this.socket.emit("host:play_sound", {
             roomId: this.roomId,
             targetControllerId: target, // If undefined, broadcasts to all
             soundId: id,
             volume,
             loop
        });
    } else {
        // Controller -> Host
        this.socket.emit("controller:play_sound", {
            roomId: this.roomId,
            soundId: id,
            volume,
            loop
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
      return (this.socket?.io?.opts?.query && (this.socket.io.opts.query as any).role === 'host') || false;
  }

  /**
   * Play a sound at a specific 3D position
   */
  public playSpatial(
    id: T,
    pos: { x: number; y: number; z: number },
    sprite?: string
  ): number | null {
    const soundId = this.playLocal(id, undefined, undefined, sprite);
    if (soundId !== null) {
      const sound = this.sounds.get(id);
      sound?.pos(pos.x, pos.y, pos.z, soundId);
      // Enable 3D spatialization for this sound instance
      sound?.pannerAttr(
        {
          panningModel: "HRTF",
          refDistance: 1,
          maxDistance: 1000,
          rolloffFactor: 1,
          distanceModel: "inverse",
        },
        soundId
      );
    }
    return soundId;
  }

  public stop(id?: T, soundId?: number) {
    if (id) {
      const sound = this.sounds.get(id);
      sound?.stop(soundId);
    } else {
      // Stop all
      Howler.stop();
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
    zUp: number
  ) {
    Howler.orientation(x, y, z, xUp, yUp, zUp);
  }
}

export const createAudioManager = <T extends string = string>(manifest?: SoundManifest) =>
  new AudioManager<T>(manifest);
