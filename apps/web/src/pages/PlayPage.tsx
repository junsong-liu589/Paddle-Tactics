type Props = {
  navigate: (path: string) => void;
  unsupportedOnline?: boolean;
};

export function PlayPage({ navigate, unsupportedOnline = false }: Props) {
  return (
    <main className="content-page narrow-page">
      <button className="back-link" onClick={() => navigate("/")}>
        ← 返回首页
      </button>
      <span className="eyebrow">CHOOSE YOUR COURT</span>
      <h1 className="page-title">选择对局方式</h1>
      <p className="page-lede">
        网页试玩版无需账号或服务器：AI 在本机运行，也可以两人共用一台设备。
      </p>
      {unsupportedOnline && (
        <div className="notice notice-error" role="status">
          网页试玩版暂不提供在线房间，请选择 AI 对战或同屏本地双人。
        </div>
      )}
      <div className="mode-list">
        <button
          className="mode-card mode-active"
          onClick={() => navigate("/setup")}
        >
          <span className="mode-icon">↔</span>
          <span className="mode-copy">
            <strong>同屏本地双人</strong>
            <small>两位玩家共用一台设备，轮流秘密分配并交接</small>
          </span>
          <span className="mode-state">现在开始 ↗</span>
        </button>
        <button
          className="mode-card mode-active"
          onClick={() => navigate("/setup/ai")}
        >
          <span className="mode-icon">◉</span>
          <span className="mode-copy">
            <strong>单人 AI 对战</strong>
            <small>免费本地策略 AI · 简单、普通、困难</small>
          </span>
          <span className="mode-state">开始挑战 ↗</span>
        </button>
      </div>
      <p className="mode-footnote">
        对局完全在当前浏览器运行，不创建账号、不连接游戏服务器。真人远程联机计划在后续桌面版中提供。
      </p>
    </main>
  );
}
