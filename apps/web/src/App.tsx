import { useEffect, useRef, useState } from "react";
import { useNavigation } from "./lib/navigation.js";
import { GameMusicPlayer } from "./lib/music-player.js";
import { HomePage } from "./pages/HomePage.js";
import { MatchPage } from "./pages/MatchPage.js";
import { PlayPage } from "./pages/PlayPage.js";
import { ResultPage } from "./pages/ResultPage.js";
import { SetupPage } from "./pages/SetupPage.js";
import { RulesPage } from "./pages/RulesPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { WorldCupPage } from "./pages/WorldCupPage.js";

function readBooleanPreference(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function sceneForPath(path: string): "menu" | "setup" | "match" {
  if (path.startsWith("/setup")) return "setup";
  if (
    path.startsWith("/match") ||
    path.startsWith("/result") ||
    path.startsWith("/world-cup") ||
    path.startsWith("/olympics")
  )
    return "match";
  return "menu";
}

export default function App() {
  const { path, search, navigate } = useNavigation();
  const musicRef = useRef<GameMusicPlayer | null>(null);
  if (musicRef.current === null) musicRef.current = new GameMusicPlayer();
  const music = musicRef.current;
  const [trackTitle, setTrackTitle] = useState(music.trackTitle);
  const [musicEnabled, setMusicEnabled] = useState(() =>
    readBooleanPreference("paddle-tactics-music-enabled", true),
  );
  const [volume, setVolume] = useState(() => {
    try {
      const stored = window.localStorage.getItem("paddle-tactics-music-volume");
      return stored === null ? 0.25 : Math.max(0, Math.min(1, Number(stored)));
    } catch {
      return 0.25;
    }
  });

  useEffect(() => {
    music.setEnabled(musicEnabled);
    music.setVolume(volume);
    music.setScene(sceneForPath(path));
    setTrackTitle(music.trackTitle);
    try {
      window.localStorage.setItem(
        "paddle-tactics-music-enabled",
        String(musicEnabled),
      );
      window.localStorage.setItem(
        "paddle-tactics-music-volume",
        String(volume),
      );
    } catch {
      // Audio still works for this session when persistent storage is unavailable.
    }
  }, [music, musicEnabled, path, volume]);

  useEffect(() => {
    const unlockMusic = () => void music.unlock();
    document.addEventListener("pointerdown", unlockMusic, { passive: true });
    document.addEventListener("keydown", unlockMusic);
    return () => {
      document.removeEventListener("pointerdown", unlockMusic);
      document.removeEventListener("keydown", unlockMusic);
      music.dispose();
    };
  }, [music]);
  const matchRoute = path.match(/^\/match\/([^/]+)(\/ai)?$/);
  const resultRoute = path.match(/^\/result\/([^/]+)(\/ai)?$/);
  const cupId = new URLSearchParams(search).get("cup") ?? undefined;
  const isOlympics = new URLSearchParams(search).get("event") === "olympics";

  return (
    <>
      <header className="site-header">
        <button
          className="brand-mark"
          onClick={() => navigate("/")}
          aria-label="乒乓对决首页"
        >
          <img
            className="brand-photo"
            src="/assets/brand/paddle-tactics-logo.png"
            alt=""
          />
          <span>
            乒乓对决<small>PADDLE TACTICS</small>
          </span>
        </button>
        <nav aria-label="主导航">
          <button onClick={() => navigate("/play")}>开始对局</button>
          <button
            className="world-cup-nav-link"
            onClick={() => navigate("/world-cup")}
          >
            世界杯
          </button>
          <button onClick={() => navigate("/olympics")}>奥运会</button>
          <button onClick={() => navigate("/settings")}>设置</button>
          <span className="header-status">
            <i /> 本地 AI · 同屏双人
          </span>
        </nav>
      </header>
      {matchRoute ? (
        <MatchPage
          key={matchRoute[1]}
          matchId={decodeURIComponent(matchRoute[1]!)}
          isAi={Boolean(matchRoute[2])}
          navigate={navigate}
          cupId={cupId}
          isOlympics={isOlympics}
        />
      ) : resultRoute ? (
        <ResultPage
          key={resultRoute[1]}
          matchId={decodeURIComponent(resultRoute[1]!)}
          isAi={Boolean(resultRoute[2])}
          navigate={navigate}
          cupId={cupId}
          isOlympics={isOlympics}
        />
      ) : path === "/world-cup" ? (
        <WorldCupPage navigate={navigate} />
      ) : path === "/olympics" ? (
        <WorldCupPage navigate={navigate} mode="olympics" />
      ) : path === "/play" ? (
        <PlayPage navigate={navigate} />
      ) : path.startsWith("/online") ? (
        <PlayPage navigate={navigate} unsupportedOnline />
      ) : path === "/setup" || path === "/setup/ai" ? (
        <SetupPage isAi={path === "/setup/ai"} navigate={navigate} />
      ) : path === "/rules" ? (
        <RulesPage navigate={navigate} />
      ) : path === "/settings" ? (
        <SettingsPage
          navigate={navigate}
          musicEnabled={musicEnabled}
          volume={volume}
          trackTitle={trackTitle}
          onMusicEnabledChange={(enabled) => {
            setMusicEnabled(enabled);
            music.setEnabled(enabled);
            if (enabled) void music.unlock();
          }}
          onVolumeChange={(nextVolume) => {
            setVolume(nextVolume);
            music.setVolume(nextVolume);
          }}
        />
      ) : (
        <HomePage navigate={navigate} />
      )}
    </>
  );
}
