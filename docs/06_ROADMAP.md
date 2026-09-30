# 06 — ROADMAP

> Codex 必须按 Phase 推进。每个 Phase 验收后再进入下一个。

## Phase 0 — 工程骨架 [DONE]

目标：建立可持续开发基础，不实现完整玩法。

- [x] pnpm workspace monorepo
- [x] apps/web React + Vite
- [x] apps/server Fastify + Socket.IO `/game`
- [x] packages/game-core / game-data / shared-types / ai package boundaries
- [x] TypeScript strict
- [x] ESLint + Prettier
- [x] Vitest
- [x] Docker Compose PostgreSQL configuration retained
- [x] Prisma 7 initialization and PostgreSQL adapter
- [x] `/health` checks PostgreSQL connectivity
- [x] web homepage calls `/health`
- [x] GitHub Actions: format/lint/typecheck/test/build

Phase 0 技术验收记录（Node.js 24.19.0、pnpm 11.19.0）：

- `pnpm install --frozen-lockfile`：通过。
- `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`：通过。
- 运行态：web `GET /` 返回 200；Socket.IO `/game` namespace 可连接；`GET /health` 返回 200 并报告数据库已连接。
- 数据库：Prisma 7 客户端生成通过；`pnpm db:check` 连接成功。
- Docker：`docker compose up -d db` 成功；容器状态为 healthy，`pg_isready` 接受连接。

Phase 0 验收全部通过。本轮不进入 Phase 1。

工具链版本：Node.js 24、pnpm 11.19、React 19、Vite 8、Fastify 5、Socket.IO 4.8、Prisma 7。TypeScript 6.0 用于当前可验收配置：typescript-eslint 8.70 在本轮实际拒绝 TypeScript 7.0，因此待其支持 TS 7 后再升级。pnpm 允许 Prisma、Prisma engines 与 esbuild 安装脚本，以便安装生成客户端和原生构建工具。

验收：

```text
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker compose up -d db
pnpm dev
```

全部通过。

## Phase 1 — 数据与纯规则引擎 [DONE]

- [x] 读取并 Zod 校验 `data/*.json`，并检查跨文件引用及规则版本一致性
- [x] loadout 常驻值计算（1..15 clamp）及项目平均战斗值（保留 .5）
- [x] 完整 MatchState / Command / DomainEvent 类型边界
- [x] 发球、反制、相持 reducer；命令使用 expectedVersion
- [x] 发球轮换 / deuce / BO1/3/5
- [x] 5轮累计优势 tie-break
- [x] `derivePublicView` 仅包含本人未揭晓分配，对手分配不包含在 DTO 或事件中
- [x] 80+ 条 game-core 单测，覆盖边界和隐藏状态
- [x] CLI 可确定性跑完一场无需 UI 的比赛

验收：任意隐藏分配永远不出现在对手 public view 测试中。已通过。

Phase 1 技术验收记录（Node.js 24、pnpm 11.19、TypeScript 6.0、Vitest 3）：

- `pnpm data:validate`：检查球员、底板、胶皮、技能项目，以及平衡版本和跨文件引用。
- `pnpm test`：91 条 game-core 和 game-data 单元测试通过，覆盖全部配装组合常驻数值 clamp、规则边界、隐私视图、阶段流程及平局裁决。
- `pnpm simulate:match`：确定性模拟 BO1 完赛，并生成胜者、比分和逐分事件。
- 比较事件只揭晓本次被比较项目的最终值；内部临时分配没有放入 DomainEvent。服务层可将 `MatchState` 保留在服务器，只发送 `derivePublicView` 结果。
- `rallyTieBreak` 按数据定义依次比较累计优势、正优势轮数、最大单轮优势；全部相同则第五轮防守方获胜。最大单轮优势按 A/B 各自优势绝对值对称比较，避免按进攻方身份产生偏置。
- 本阶段不包含 UI、AI、在线房间、数据库持久化或完整 Socket 命令协议；由后续 Phase 分别实现。

## Phase 2 — 本地沙盒 + 完整前端流程 [DONE]

- [x] 模式选择（本地双人可用；AI/在线入口标注为后续开放）
- [x] 选人、底板、正手胶皮、反手胶皮
- [x] 配装常驻项目值即时预览和能力变化对比
- [x] 本地双人沙盒服务端（仅内存保存 MatchState）
- [x] 阶段加点、锁定、手动屏幕交接、攻防比较揭晓、记分和逐分结果
- [x] 完成比赛结果页与已公开比较事件回顾
- [x] 桌面、窄屏及手机布局
- [x] Playwright 完整 BO1 浏览器流程
- [x] Fastify API 测试覆盖目录输出、命令校验、版本冲突及隐藏分配视图

Phase 2 开发说明：

- 浏览器只接收当前操作者的 `MatchPublicView`；服务端内存沙盒持有完整 `MatchState`。本地双人模式以交接页清空画面，再允许另一位玩家显示自己的视图。
- 基础战斗值和逐项临时点数仍由 Phase 1 `game-core` 计算；临时点数只在对应能力比较发生后通过公开事件揭晓。数据目录未修改。
- 沙盒记录只存在于服务端当前进程内，不包含账号、持久化或在线房间功能。
- 启动：`pnpm dev`；完整检查：`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm e2e`。首次浏览器验收需 `pnpm exec playwright install chromium`。

Phase 2 本地双人流程完成；之后新增 Candidate V4 和 Phase 3 可玩原型，不含 AI、在线对战或持久化。

## Balance Simulator & Rules Validation [DONE]

在 Phase 2 完成后新增的独立平衡验证工具。历史 Phase 编号保持不变；Balance Lab 与后续 AI / Multiplayer 工作分开验收。

- [x] `packages/balance-simulator` workspace 包及 Quick / Standard / Full CLI
- [x] 正式 legacy 10/10/15 reducer 对照组与候选固定攻击加成 / 秘密防守布点模拟
- [x] 七种 bot policy，共用公开视图进行决策
- [x] seeded PRNG、3136 配装空间分层轮转、镜像对局、座位和首发轮换
- [x] 攻防比较、计分和相持裁决复用 `game-core` 导出；候选参数为内存 override
- [x] 单变量参数实验、阶段/玩家/器材/配装/能力/策略统计与 95% Wilson 区间
- [x] 生成 JSON、CSV、Balance Report 与只读 Balance Recommendations
- [x] 固定 seed、合法分配、官方规则 API 复用与确定性测试

开发边界：Legacy V1 和历史 Candidate V1 保持原样。Candidate V3 作为 `game-core` 中可显式选择的独立候选 ruleset，通过与正式模式相同的 reducer 运行；默认正式规则仍为 Legacy V1，Balance Simulator 基线及参数覆盖均不写入正式平衡配置。正式 `data/*.json` 未修改。

命令：`pnpm balance:quick`、`pnpm balance:run`、`pnpm balance:full`、`pnpm balance:rules`、`pnpm balance:equipment`。可用 `--seed <integer>`、`--matches <count>` 和 `--experiment-matches <count>` 复现或缩小样本。报告写入 `reports/<timestamp>/`；不会自动修改正式数据。

模拟会在 deuce 中检测长度 1–8、连续重复六次的稳定得分周期；命中时将该场记作 `deuce_censored`，不虚构胜者。作为兜底，每场最多模拟 250 分，仍未结束也记作截断平局。报告单独统计进入 deuce 的场次和周期截断数。此模拟器截断只用于避免批量样本被无限循环卡住；正式 game-core 仍保持“领先 2 分”原规则。

完整运行验收（seed `20260928`，16 个单变量候选值）：

| Preset   | Legacy 场数 | Candidate 场数 | 每项参数实验样本 |  模拟耗时 |
| -------- | ----------: | -------------: | ---------------: | --------: |
| Quick    |       1,000 |          1,000 |               30 |   9.57 秒 |
| Standard |      10,000 |         10,000 |              200 |  82.33 秒 |
| Full     |     100,000 |        100,000 |            1,000 | 731.80 秒 |

结果分别保存在 `reports/2026-09-28T19-12-40-004Z/`、`reports/2026-09-28T19-13-02-108Z/` 和 `reports/2026-09-28T19-14-32-654Z/`，包括可复算输入/汇总 JSON、玩家/器材/配装/能力/阶段/机制/策略 CSV、Balance Report 和只读建议。截断平局作为非胜场单独统计；玩家、器材和配装胜率的置信区间只使用完成场次。原始器材观测仍不进行因果或选手强度校正。

## Candidate V3 — Reducer-backed rules evaluation [DONE / REVIEW]

- [x] 保留 Legacy V1 正式默认和历史 Candidate V1；新规则通过 `candidateV3` 单独启用。
- [x] 仅进攻方达到阈值时可直接得分；防守方任何差值均为守住并进入下一阶段。
- [x] 防守方在分配前看对手该阶段基础攻击值 Top 3；Rally 双方都看到对手 Top 3。
- [x] V3 防守池默认 8，无单项上限；攻击固定加成 +4；阈值 5/5/4；Rally 最多 5 次；非 RandomBot 使用确定性 epsilon 0.05。
- [x] 加点仅在对应比较揭晓；公开视图不带对手隐藏分配。V3 bot 仅读取 viewer public view 与已揭晓记录。
- [x] 新增 Top3AwareDefenseBot、无上限集中特化 FortressBot 分配形状、Top-K 分配/攻击选择统计。
- [x] 运行 Quick、Standard、Full（seed `20260928`），包含 V3 单变量实验及 3 组各 10,000 场 focused validation。
- [x] 独立生成 V3 报告、建议和 `v3-parameter-experiments.csv`。

V3 最终输出目录：Quick `reports/2026-09-29T03-44-46-143Z/`，Standard `reports/2026-09-29T03-49-04-864Z/`，Full `reports/2026-09-29T03-57-30-502Z/`。Full 耗时 1,351.97 秒；Legacy V1、Candidate V1、Candidate V3 各 100,000 场；V3 有 16 个单变量候选（各 1,000 场）及 3 个各 10,000 场 focused validation。V3 有 10,244 场 deuce 截断（10.24%，不记作普通胜场），首轮相持进攻方赢 395,892/493,952 分（80.15%；95% Wilson CI 80.0–80.3%），首发方胜率 49.87%，相持 tie-break starter 胜率 83.41%。此为明确的相持先手/裁决偏差；V3 的截断比例亦明显高于 Legacy V1 的 2.71%，与 Candidate V1 的 11.16% 接近。因此 V3 不应提升为正式规则；需先解决奇数轮攻击机会差、Tie Break 先后手偏差和高 deuce 截断，再开展新候选复验。

正式球员/器材/技能数据与 `balance_v1.1` 配置未修改。V3 仅作为评估用 ruleset；本任务未进入数据调平或后续产品 Phase。

## Candidate V4 — Carryover resource economy [DONE / APP PROTOTYPE]

- [x] 保留 Legacy V1、历史 Candidate V1 与 Candidate V3；本地原型显式启用 V4，模拟器仍可分别选择 ruleset。
- [x] 玩家私有 `reservePoints`；Serve/Counter 按本阶段基础预算 + 自身 reserve 结算未使用点，角色变化时仍归原玩家。
- [x] Serve/Counter 攻击基础 4、攻击单项最多 +4；防守基础 10、无单项上限；可不花满并 Carry。
- [x] Rally 使用 `20 + reservePoints` 一次性混合分配到 5 攻击 + 5 防守能力；攻击单项最多 +4；点末清零。
- [x] V4 Full 模拟基线使用 Rally 最多 4 次比较（历史实验设置）；对手 reserve 和隐藏 allocation 不出现在 viewer public view；攻击只可通过阈值直接得分。当前可玩 V4 已按下方 Gameplay & UI 修正更新为 6 次。
- [x] 增加 SaveForRally / AllInEarly / MinimumNeeded / BalancedReserve / SpendAll 资源策略，seeded epsilon 可配置；V1/V3 继续使用原八种策略抽样。
- [x] 增加资源费用、Carry、Rally 预算分位、布防 HHI、能力使用、paired policy head-to-head 及参数实验报告。
- [x] Quick 与 Standard：seed `20260928`；Quick 每规则 1,000 场，Standard 每规则 10,000 场；V4 各包含 5 项 one-factor 筛选、3 组聚焦样本和 10 组策略对战。
- [x] Full：Candidate V4 100,000 场；3 组候选参数各 20,000 场聚焦复验；完成升级建议与报告。

Candidate V4 完成记录（seed 20260928）：

- Full 输出：reports/2026-09-29T06-06-47-665Z/；Legacy V1、Candidate V1、Candidate V3、Candidate V4 各 100,000 场，耗时 1,848.02 秒。V4 另完成 5 组各 1,000 场参数筛选、3 组各 20,000 场聚焦复验、10 组各 5,000 场 paired policy 对战。Quick 和 Standard 结果分别在 reports/2026-09-29T05-56-00-373Z/、reports/2026-09-29T06-00-34-237Z/。
- V4 100,000 场中完成 99,040 场，deuce-cycle 截断 960 场（0.96%）；Legacy V1 截断 2.71%，V3 截断 10.24%。V4 每场平均 16.958 分、20.470 次 Rally 比较，Rally tie-break 占 Rally 开始数 44.59%。
- Rally 第一进攻方赢点率 52.13%（Wilson 95% CI 52.02–52.24%），相较 V3 的 80.15% 大幅改善，但仍高于 50%。
- Serve/Counter 平均攻击支出 2.13/2.26；平均防守支出 8.60/9.86；Counter/Rally 进入时平均 reserve 为 1.51/2.27。Rally 预算中 30 点及以上占 5.36%。
- 10 组策略对战中有 8 组越过 65% 胜率筛查线；例如 AllInEarly 对 MinimumNeeded 胜率 95.73%，SpendAll 对 SaveForRally 为 99.80%。因此不建议把 V4 提升为正式规则。它显著缓解 V3 先手偏差与截断问题，但目前仍有明显资源策略支配性，参数筛选的 carry 率与 Rally 池规模调整也没有解决该问题。
- V4_BALANCE_REPORT.md、V4_RECOMMENDATIONS.md、resource-economy.csv、carry-distribution.csv、v4-parameter-experiments.csv 是 V4 复核入口。建议下一轮只实验性比较攻击 cap 3/2 和 Serve/Counter 阈值 6，再做策略配对验证；尚未运行这些方案。

V4 是当前本地可玩原型采用的规则配置，尚未宣告为最终平衡版本；参数仍由 game-core 的 Candidate V4 runtime defaults 提供。旧版 Legacy V1 数据和规则保留为对照历史。

## Phase 2.5 — Candidate V4 球员能力设计 [DONE]

- [x] 保持八名球员总分：480 / 460 / 440 档位原值，设计不同正反手、阶段和攻防专长与短板。
- [x] 更新球员风格描述及 30 个攻防能力常驻值；每阶段、每只手最多一个 10 和一个 9，其余不超过 8。
- [x] 将原 `balance_v1.1` 球员、技能、平衡配置和校验报告快照保存在 `data/*-balance-v1.1.json`。
- [x] 固定装备和五种 V4 资源策略，用相同可复现 seed 对 8×8 球员组合模拟 20,000 场。
- [x] 输出逐项能力高低、球员总体胜率和完整 8×8 matchup 矩阵及 Wilson 95% CI。

报告：`reports/candidate-v4-player-refresh/CANDIDATE_V4_PLAYER_REPORT.md`。固定 seed `20260929` 完成 20,000 场，4 场因 simulator deuce guard 截断；玩家总体胜率区间为 18.71%–82.56%。这是固定规则、装备与 Bot 组合下的强度 sanity check，不以所有球员胜率相等为目标，也不代表最终装备平衡报告。结果呈现显著强弱差异，因此本数据适合作为可玩原型迭代基线，尚不能视为球员平衡验收通过。

## Phase 3 — 可玩原型 [DONE]

- [x] 赛前选择球员、底板、正手胶皮、反手胶皮，并展示常驻能力预览。
- [x] 默认完整运行 Candidate V4 规则；`game-core` 是唯一规则计算来源。
- [x] 阶段预算按本人私有 reserve 展示；允许少花点并 Carry，攻击支出限制符合 V4 cap。
- [x] 保留双方秘密分配、按当前玩家切换视图、攻防揭晓、比分和完整赛果页。
- [x] 更新 HTTP 和 Playwright 流程测试，覆盖一场完整 BO1。
- [x] 不实现 AI、在线对战、排行榜或复杂决策系统。

### Gameplay & UI Feedback Update [DONE]

- [x] Rally 分配修正为 5 项攻击各自最多 +4、5 项防守无单项上限，共享总支出不超过 `20 + Carry`；移除前端错误的 Rally 攻击总计 4 点限制，保留 Serve/Counter 单一攻击能力最多 4 点。
- [x] 当前 V4 最多比较 6 次，按 A/B/A/B/A/B 轮流进攻；第 6 次未直接决胜时进入既有 V4 Tie Break。Legacy V1、Candidate V3 和历史模拟数据仍保留原轮数。
- [x] 加入对抗状态人物卡、头像、阶段事件与分步能力揭晓；全局动画时长配置并提供快速显示和跳过。
- [x] 照片映射到八名球员 ID，原图保存在 `photos/`；Pillow 流程输出 512×512 WebP，头像加载失败时显示首字 fallback。
- [x] Game-core 回归测试覆盖五项攻击各 +4、单项 +5 拒绝、攻击与防守合计超预算拒绝、六次比较/双方各三次攻击/第六次 Tie Break。
- [x] Playwright 覆盖头像缺图 fallback 与对局事件动画跳过；完整格式、lint、typecheck、unit test、build、E2E 验收记录在本次变更报告。

头像生成：`python -m pip install -r scripts/requirements-player-photos.txt` 后执行 `python scripts/process-player-photos.py`。头像裁切焦点集中配置于该脚本，不修改原图。

### Gameplay & UI Feedback Follow-up [DONE]

- [x] 首页规则入口导航到站内整理后的 Candidate V4 规则页。
- [x] 选人页去掉球员总分展示，完整列出 15 组攻防能力的正反手 `球员 + 底板 + 胶皮 = 常驻值` 公式和项目平均战斗值。
- [x] 加入六首原创程序化循环配乐，按菜单、选手配置、比赛切换；设置页支持持久化静音和音量调整。配乐方向参考及许可核查记录在 `docs/AUDIO_ATTRIBUTION.md`。
- [x] Tie Break 文案更正为六轮；赛后逐轮列出双方实际加点与攻防值。
- [x] 每分胜负展示节奏延长一倍；对局页底部增加双方同步可见的公开比赛信息与逐次攻防日志。

## Phase 4 — AI 单人模式 [DONE]

- [x] `packages/ai` 实现 Easy / Normal / Hard 三档纯 TypeScript 策略，seeded 决策可复现；不接入外部模型或付费 AI API。
- [x] AI 接收自己的 `derivePublicView` 视图和公开技能目录；不接收完整 `MatchState`，不能读取真人未揭晓分配。
- [x] 服务端 `/api/ai/matches` 创建单人对局，并在玩家操作后自动执行 AI 的分配、锁定和进攻命令；所有命令继续经过 `game-core`。
- [x] AI 对局只允许真人使用 A 视图和提交 A 命令；B 视图和 B 命令返回 403。AI 加点在真人 DTO 中不包含。
- [x] 前端可配置双方球员/器材、BO1/3/5 与 AI 难度；单人对局不出现本地双人屏幕交接。
- [x] AI 单元测试覆盖合法分配、固定 seed 可复现、攻方约束和 viewer-specific 数据边界。
- [x] 难度 sanity check 以不同球员、镜像座位和轮换首发进行 60 场/策略配对；Hard > Normal、Normal > Easy、Hard > Easy，均高于 50%。这是策略级回归检查，不代表全面平衡报告。
- [x] 后端 API 测试验证三种难度均完成 BO1，并验证禁止读取或冒充 AI 玩家。
- [x] Playwright Edge happy path：从选择 AI 难度开始，实际操作发球阶段，再完成 BO1 并查看赛果。

开发边界：AI 仅在服务器内用本地 CPU 运行，没有 LLM 推理或 API 调用。对局仍保存在当前服务进程内存；本阶段不实现在线房间、持久化或公网部署。Candidate V4 和 `data/` 基准数据未因 AI 阶段调整。

验收命令：`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm e2e`。其中 E2E 使用系统 Microsoft Edge。

## Phase 5 — 在线双人 [DONE · 免费网页试玩版已发布]

- [x] guest session（7 天令牌；数据库只保留 token SHA-256 摘要）
- [x] 6 位房间码、创建/加入/准备
- [x] Socket.IO `/game` namespace 认证和命令协议
- [x] 单进程 Room service 保存完整权威 MatchState，按 viewer 单播 `derivePublicView`
- [x] expectedVersion 检查、同步隐藏分配并发处理、clientCommandId 幂等
- [x] 60 秒断线重连；超时后告知对手获胜
- [x] 隐藏分配隔离、重放和版本冲突单元测试
- [x] 两个真实浏览器创建/加入房间、完成在线 BO1，并确认双方收到相同的最终比分
- [x] 生产 Docker Compose、静态前端、Fastify/Socket.IO、PostgreSQL、Caddy 自动 HTTPS 与 WebSocket 反代配置
- [x] PostgreSQL 访客会话迁移、服务健康检查与连接验证
- [ ] 在线房间服务端公网部署（需配置公网主机、域名 DNS、HTTPS 与数据库；免费静态试玩版不包含在线房间）

Phase 5 验收边界：本地双浏览器在线对局、私有分配、重连策略、数据库会话和单实例生产部署模板均已实现并验收。在线房间服务端仍需部署到公网主机，并配置域名 DNS 与 HTTPS；房间与对局状态仍在单进程内存，server 重启会丢失未完成房间。完整战报持久化、自动备份配置与多节点扩展留待后续 Phase。

### 免费网页试玩版部署状态

- [x] 网页目录页只暴露本地 AI 与同屏双人，不依赖游戏后端入口
- [x] 浏览器直接打包校验后的 `data/*.json`，复用 `game-core` 与 `ai`
- [x] 独立 `web:dev` / `web:build`，静态构建不生成 Prisma Client、不连接 PostgreSQL
- [x] 配置静态 SPA 路由回退并记录免费发布说明
- [x] 发布到 Cloudflare Pages，并在浏览器中验证公开试玩页可加载

当前分支预览网址：https://feat-phase-5-online-multipla.paddle-tactics.pages.dev/。该静态网页只支持本地 AI 与同屏双人；Cloudflare Pages 预览部署不包含在线房间服务端。

该网页试玩版本地比赛只保存在标签页内存；刷新即丢失。桌面远程联机与房主网络穿透安排在真人试玩反馈之后。

## Phase 6 — PostgreSQL 战报与产品化 [TODO]

- Prisma Match / Participant / Event
- 完赛持久化
- 历史赛果页
- 公开逐分复盘
- 错误处理/日志/基础限流
- Docker production build

## Phase 7 — 平衡、表现与部署 [TODO]

- 3136 配装枚举分析
- 策略机器人批量模拟
- balance report
- UI 动画、音效、占位美术优化
- 正式环境部署
- 监控与备份

## 游戏体验版本更新 — 世界杯与球员表现 [实现完成，待产品验收]

- [x] 八人随机单败签位、BO7 CPU 对决、BO3 玩家对 AI、局比分逐局演示与最终冠军
- [x] 抽签前选择观战/参赛，参赛前选球员与装备；AI 按球员能力风格选装
- [x] 本地支持者高亮、淘汰后继续观战或离开、浏览器赛事进度保存
- [x] 八位球员的 2D 卡通角色、选手打法与配装展示、六维能力雷达
- [x] 比赛视图复用角色动作和球路特效；既有玩法入口保留
- [x] 纯浏览器、本地 AI、静态网页部署，不新增常驻服务或付费 API
- [ ] 真实球员参考照片和生成插画的公开再分发/肖像权复核（见 `docs/10_LEGAL_ASSETS.md`）

验收说明：本更新不调整 `data/` 基准值、Candidate V4 单局判定、既有 AI/同屏双人玩法、服务端在线房间实现或数据库 schema。产品 owner 在测试后决定是否发布静态构建。

## 暂不做

- 3D 物理乒乓球
- 商城/抽卡
- 复杂社交系统
- Redis 横向扩展（流量需要时再做）
- 真实人物/器材官方图片抓取

## 产品版本 v4.3 — 赛事平衡与支持机制 [实现完成，待产品验收]

- [x] 世界杯张本智和比赛内追分及系列赛 0–2/0–3 单局追分；`data/players.json` 和 Candidate V4 单分规则保持原样。
- [x] 奥运会独立 v4.3 名册仅调整张本智和、马琳；抽签档位不动。
- [x] 奥运会支持对象仅用于签表高亮；曾试验每场随机 15 项能力 +1，用户决定在发布前移除。实验保留在历史报告，不进入现行玩法。
- [x] 王皓人物展示图更新；原图保留。
- [x] 固定种子、交换站位与首发的针对性模拟及回归检查，见 `reports/world-cup-v4.3/V4_3_BALANCE_REPORT.md`。
- [x] 历次产品问题、规则和数值演变归档于 `docs/13_PROJECT_EVOLUTION_V1_TO_V4_3.md`。

本项是赛事产品更新，不代表 Candidate V4 规则正式定稿，也不代表奥运会全部同档平衡目标已达成。用户试玩验收和静态网页重新发布仍待进行。
