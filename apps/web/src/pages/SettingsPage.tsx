import { MUSIC_TRACKS } from "../lib/music-player.js";

type Props = {
  navigate: (path: string) => void;
  musicEnabled: boolean;
  volume: number;
  trackTitle: string;
  onMusicEnabledChange: (enabled: boolean) => void;
  onVolumeChange: (volume: number) => void;
};

export function SettingsPage({
  navigate,
  musicEnabled,
  volume,
  trackTitle,
  onMusicEnabledChange,
  onVolumeChange,
}: Props) {
  return (
    <main className="content-page settings-page">
      <button className="back-link" onClick={() => navigate("/")}>
        ← 返回首页
      </button>
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">PREFERENCES</span>
          <h1 className="page-title">设置</h1>
          <p className="page-lede">调整背景音乐。设置会保存在当前浏览器。</p>
        </div>
      </div>
      <section className="settings-card">
        <div className="settings-row">
          <div>
            <h2>背景音乐</h2>
            <p>原创程序化配乐，随菜单、选手配置和比赛切换曲目。</p>
          </div>
          <label className="switch-control">
            <span>{musicEnabled ? "开启" : "关闭"}</span>
            <input
              aria-label="背景音乐"
              type="checkbox"
              checked={musicEnabled}
              onChange={(event) => onMusicEnabledChange(event.target.checked)}
            />
          </label>
        </div>
        <label className="volume-control">
          <span>音乐音量</span>
          <input
            aria-label="音乐音量"
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(volume * 100)}
            disabled={!musicEnabled}
            onChange={(event) =>
              onVolumeChange(Number(event.target.value) / 100)
            }
          />
          <strong>{Math.round(volume * 100)}%</strong>
        </label>
        <div className="music-track-list">
          <p className="music-now-playing" aria-live="polite">
            当前曲目：<strong>{trackTitle}</strong>
          </p>
          <strong>曲目主题 · 共六首</strong>
          {Object.entries(MUSIC_TRACKS).map(([scene, tracks]) => (
            <div key={scene}>
              <span>
                {scene === "menu"
                  ? "菜单"
                  : scene === "setup"
                    ? "选手配置"
                    : "比赛"}
              </span>
              <p>{tracks.map((track) => track.title).join("　·　")}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
