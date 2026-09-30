import { afterEach, describe, expect, it, vi } from "vitest";
import { GameMusicPlayer, MUSIC_TRACKS } from "./music-player.js";

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = "suspended";
  closeCalls = 0;
  resolveResume: (() => void) | null = null;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  resume(): Promise<void> {
    return new Promise((resolve) => {
      this.resolveResume = () => {
        if (this.state !== "closed") this.state = "running";
        resolve();
      };
    });
  }

  close(): Promise<void> {
    this.closeCalls += 1;
    this.state = "closed";
    return Promise.resolve();
  }
}

describe("background music player", () => {
  afterEach(() => {
    FakeAudioContext.instances = [];
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("closes the audio context if disabling races with browser audio unlock", async () => {
    const setInterval = vi.fn(() => 1);
    vi.stubGlobal("window", {
      AudioContext: FakeAudioContext,
      setInterval,
      clearInterval: vi.fn(),
    });
    const music = new GameMusicPlayer();
    const unlock = music.unlock();

    music.setEnabled(false);
    FakeAudioContext.instances[0]!.resolveResume!();
    await unlock;

    expect(FakeAudioContext.instances[0]!.closeCalls).toBe(1);
    expect(FakeAudioContext.instances[0]!.state).toBe("closed");
    expect(setInterval).not.toHaveBeenCalled();
    await music.unlock();
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("changes the active arrangement between menu, setup, and match scenes", () => {
    const music = new GameMusicPlayer();
    const menuTrack = music.trackTitle;

    music.setScene("setup");
    const setupTrack = music.trackTitle;
    music.setScene("match");
    const matchTrack = music.trackTitle;

    expect(setupTrack).not.toBe(menuTrack);
    expect(matchTrack).not.toBe(setupTrack);
    expect(matchTrack).toBe(MUSIC_TRACKS.match[1]!.title);
    expect(music.trackTitle).toBe(matchTrack);
  });
});
