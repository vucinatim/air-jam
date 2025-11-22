export class SoundEngine {
  private ctx: AudioContext | null = null;

  constructor() {
    // We don't initialize immediately to avoid warnings about AudioContext
    // being created before user interaction.
  }

  private getContext() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    return this.ctx;
  }

  /**
   * Must be called on first user interaction to unlock audio on iOS/Chrome
   */
  public init() {
    const ctx = this.getContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  public playClick(frequency = 1200, type: OscillatorType = "triangle") {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Short, sharp envelope
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  public playHighClick() {
    this.playClick(1800, "sine");
  }
}

export const soundEngine = new SoundEngine();
