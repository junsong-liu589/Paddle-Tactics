type Props = { navigate: (path: string) => void };

export function RulesPage({ navigate }: Props) {
  return (
    <main className="content-page rules-page">
      <button className="back-link" onClick={() => navigate("/")}>
        ← 返回首页
      </button>
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">HOW TO PLAY · CURRENT V4 RULESET</span>
          <h1 className="page-title">比赛规则</h1>
          <p className="page-lede">
            每分都要先秘密配置资源，再选择进攻项目。判断对手、分配资源，并把握攻守交换的时机。
          </p>
        </div>
        <span className="version-badge">当前可玩规则</span>
      </div>

      <section className="rules-grid">
        <article className="rules-card">
          <span>01 · 赛前构筑</span>
          <h2>球员 + 球拍 + 两面胶皮</h2>
          <p>
            每位选手选择一名球员、一块底板、正手胶皮和反手胶皮。底板修正两侧，胶皮只修正安装侧。每项能力的最终常驻值由这三者相加并限制在
            1–15；项目战斗值取正手与反手平均。
          </p>
        </article>
        <article className="rules-card">
          <span>02 · 秘密部署</span>
          <h2>先分配，再揭晓</h2>
          <p>
            每阶段双方秘密分配可用点数并锁定。你看不到对手尚未比较的点数。只有能力真正进入比较时，系统才公布该项的基础值、临时加点与最终值。
          </p>
        </article>
        <article className="rules-card">
          <span>03 · 发球与反制</span>
          <h2>选择进攻项目</h2>
          <p>
            发球阶段与反制阶段各自拥有攻击基础 4 点、防守基础 10
            点；未使用资源会按当前规则累积到后续阶段。攻击加点最多 4
            点并集中在一项能力，防守点数可分配在可用项目间。突破阈值为 5。
          </p>
        </article>
        <article className="rules-card">
          <span>04 · 相持</span>
          <h2>最多六次攻防比较</h2>
          <p>
            相持共享资源池为基础 20 点加上个人 Carry。五项进攻能力分别最多
            +4，五项防守能力没有单项上限；双方进攻和防守的总分不得超过自己的资源池。双方轮流进攻，阈值为
            4。
          </p>
        </article>
        <article className="rules-card">
          <span>05 · 六轮 Tie Break</span>
          <h2>逐轮累计优势</h2>
          <p>
            六次比较都未直接突破时，先比较六轮累计优势，再比较优势轮数、单轮最大优势；仍相同时按固定规则决胜。每轮的公开攻防数值和实际加点会记入赛果。
          </p>
        </article>
        <article className="rules-card">
          <span>06 · 比赛计分</span>
          <h2>先到 11 分并领先 2 分</h2>
          <p>
            每局至少 11 分且需领先 2 分。通常每两分交换发球；进入 10:10
            后每分交换。比赛可选择 BO1、BO3 或 BO5。
          </p>
        </article>
      </section>
      <div className="rules-callout">
        AI 在本机使用策略计算，不调用付费 AI
        API；在线或本地对局的正式判定由服务器完成。
      </div>
      <button
        className="button button-primary"
        onClick={() => navigate("/play")}
      >
        开始对局 ↗
      </button>
    </main>
  );
}
