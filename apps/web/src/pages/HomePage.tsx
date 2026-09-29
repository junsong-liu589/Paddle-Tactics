type Props = { navigate: (path: string) => void };

export function HomePage({ navigate }: Props) {
  return (
    <main className="home-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">PINGPONG TACTICS · BALANCE V1.1</span>
          <h1>
            每一分，
            <br />
            都有选择。
          </h1>
          <p>
            读旋转、猜落点，在每次交锋之前悄悄分配你的战术优势。
            从构筑开始，打出属于你的乒乓球对决。
          </p>
          <div className="hero-actions">
            <button
              className="button button-primary"
              onClick={() => navigate("/play")}
            >
              开始一场对决 <span aria-hidden="true">↗</span>
            </button>
            <a
              className="text-link"
              href="/docs/01_GAME_RULES.md"
              target="_blank"
              rel="noreferrer"
            >
              查看比赛规则 <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="hero-meta">
            <span className="online-dot" /> 本地沙盒现已开放
            <span className="meta-divider" /> GDD v1.1
          </div>
        </div>
        <div className="hero-art" aria-label="几何风格乒乓球桌插画">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="table-shadow" />
          <div className="table-top">
            <div className="table-center-line" />
            <div className="table-net" />
          </div>
          <div className="paddle paddle-left">
            <span />
          </div>
          <div className="paddle paddle-right">
            <span />
          </div>
          <div className="table-ball" />
          <span className="art-label label-top">READ THE SPIN</span>
          <span className="art-label label-bottom">PLAY THE POINT</span>
        </div>
        <div className="hero-number" aria-hidden="true">
          01
        </div>
      </section>
      <section className="home-footer">
        <div>
          <span className="footer-index">01</span>
          <strong>构筑你的球拍</strong>
          <span>选择球员与器材，形成专属常驻能力</span>
        </div>
        <div>
          <span className="footer-index">02</span>
          <strong>秘密分配点数</strong>
          <span>每个阶段重新部署，预测对手选择</span>
        </div>
        <div>
          <span className="footer-index">03</span>
          <strong>逐分赢下比赛</strong>
          <span>发球、反制、相持，轮流掌握主动</span>
        </div>
      </section>
    </main>
  );
}
