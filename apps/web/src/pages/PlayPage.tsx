type Props = { navigate: (path: string) => void };

export function PlayPage({ navigate }: Props) {
  return (
    <main className="content-page narrow-page">
      <button className="back-link" onClick={() => navigate("/")}>
        ← 返回首页
      </button>
      <span className="eyebrow">CHOOSE YOUR COURT</span>
      <h1 className="page-title">选择对局方式</h1>
      <p className="page-lede">
        先从本地沙盒开始。AI 对战与在线房间将在后续阶段开放。
      </p>
      <div className="mode-list">
        <button
          className="mode-card mode-active"
          onClick={() => navigate("/setup")}
        >
          <span className="mode-icon">↔</span>
          <span className="mode-copy">
            <strong>本地双人沙盒</strong>
            <small>两位玩家共用一台设备，轮流秘密分配</small>
          </span>
          <span className="mode-state">现在开始 ↗</span>
        </button>
        <div className="mode-card mode-disabled" aria-disabled="true">
          <span className="mode-icon">◉</span>
          <span className="mode-copy">
            <strong>单人 AI 对战</strong>
            <small>在不同难度下挑战战术对手</small>
          </span>
          <span className="mode-state">后续开放</span>
        </div>
        <div className="mode-card mode-disabled" aria-disabled="true">
          <span className="mode-icon">⌁</span>
          <span className="mode-copy">
            <strong>在线双人</strong>
            <small>创建房间，与朋友实时对战</small>
          </span>
          <span className="mode-state">后续开放</span>
        </div>
      </div>
      <p className="mode-footnote">
        本地沙盒仅用于当前浏览器会话，不会创建账号或保存赛果。
      </p>
    </main>
  );
}
