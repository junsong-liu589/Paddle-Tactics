type Scene = "menu" | "setup" | "match";

type Arrangement = {
  title: string;
  bpm: number;
  lead: (number | null)[];
  roots: number[];
};

export const MUSIC_TRACKS: Record<Scene, readonly Arrangement[]> = {
  menu: [
    {
      title: "开球之前",
      bpm: 92,
      lead: [
        72,
        null,
        76,
        79,
        null,
        76,
        74,
        null,
        69,
        null,
        72,
        76,
        null,
        72,
        71,
        null,
      ],
      roots: [48, 53, 45, 50],
    },
    {
      title: "球馆晨光",
      bpm: 84,
      lead: [
        67,
        71,
        null,
        74,
        72,
        null,
        71,
        null,
        67,
        null,
        69,
        72,
        null,
        76,
        74,
        null,
      ],
      roots: [43, 48, 50, 45],
    },
  ],
  setup: [
    {
      title: "赛前热身",
      bpm: 104,
      lead: [
        72,
        74,
        79,
        null,
        76,
        79,
        83,
        null,
        81,
        79,
        76,
        null,
        74,
        76,
        79,
        null,
      ],
      roots: [48, 55, 53, 50],
    },
    {
      title: "选择你的打法",
      bpm: 98,
      lead: [
        69,
        null,
        72,
        76,
        null,
        77,
        76,
        72,
        69,
        null,
        72,
        74,
        null,
        76,
        72,
        null,
      ],
      roots: [45, 50, 48, 53],
    },
  ],
  match: [
    {
      title: "赛点拉锯",
      bpm: 116,
      lead: [
        76,
        79,
        null,
        83,
        81,
        79,
        null,
        76,
        74,
        77,
        null,
        81,
        79,
        77,
        74,
        null,
      ],
      roots: [48, 53, 50, 45],
    },
    {
      title: "最后一板",
      bpm: 122,
      lead: [
        72,
        76,
        79,
        null,
        83,
        79,
        76,
        null,
        81,
        84,
        83,
        null,
        79,
        76,
        74,
        null,
      ],
      roots: [45, 48, 53, 50],
    },
  ],
};

export class GameMusicPlayer {
  private context: AudioContext | null = null;
  private timer: number | null = null;
  private enabled = true;
  private volume = 0.25;
  private scene: Scene = "menu";
  private sceneEntryCount: Record<Scene, number> = {
    menu: 0,
    setup: 0,
    match: 0,
  };
  private step = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      void this.context?.suspend();
      return;
    }
    if (this.context?.state === "suspended") void this.context.resume();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setScene(scene: Scene): void {
    if (this.scene === scene) return;
    this.scene = scene;
    this.sceneEntryCount[scene] += 1;
    this.step = 0;
  }

  async unlock(): Promise<void> {
    if (!this.enabled) return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    this.context ??= new AudioContextClass();
    await this.context.resume();
    if (this.timer === null)
      this.timer = window.setInterval(() => this.tick(), 250);
  }

  dispose(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    void this.context?.close();
    this.context = null;
  }

  private get arrangement(): Arrangement {
    const tracks = MUSIC_TRACKS[this.scene];
    return tracks[this.sceneEntryCount[this.scene] % tracks.length]!;
  }

  private tick(): void {
    const context = this.context;
    if (!context || !this.enabled || context.state !== "running") return;
    const arrangement = this.arrangement;
    const beatSeconds = 60 / arrangement.bpm / 2;
    if (this.step % 8 === 0) {
      const root =
        arrangement.roots[(this.step / 8) % arrangement.roots.length]!;
      this.note(root - 12, "sine", 0.17, 0.28, beatSeconds * 3.6);
      for (const offset of [0, 7, 12, 16]) {
        this.note(root + offset, "triangle", 0.035, 0.8, beatSeconds * 7.2);
      }
    } else if (this.step % 4 === 0) {
      const root =
        arrangement.roots[
          Math.floor(this.step / 8) % arrangement.roots.length
        ]!;
      this.note(root - 12, "sine", 0.13, 0.22, beatSeconds * 1.8);
    }
    const melodyNote = arrangement.lead[this.step % arrangement.lead.length];
    if (melodyNote != null) {
      this.note(melodyNote, "sine", 0.075, 0.13, beatSeconds * 1.7);
    }
    this.step += 1;
  }

  private note(
    midi: number,
    waveform: OscillatorType,
    loudness: number,
    duration: number,
    seconds: number,
  ): void {
    const context = this.context;
    if (!context) return;
    const start = context.currentTime + 0.02;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(loudness * this.volume, start + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.04);
  }
}
