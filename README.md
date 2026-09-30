# 乒乓对决 / PingPong Duel

一个以真实乒乓球战术为题材的 **回合制、隐藏加点、数值构筑** 对战游戏。

> 当前可玩原型使用 `Candidate V4`（Carry 资源规则）；旧版 `balance_v1.1` 与 Candidate V3 作为历史/模拟规则保留。V4 runtime 参数由 `packages/game-core` 提供，实验数据不会自动成为新正式平衡版本。

## 当前发布状态

- 免费网页试玩版已部署到 [Cloudflare Pages](https://feat-phase-5-online-multipla.paddle-tactics.pages.dev/)，可玩浏览器内 AI 和同设备双人。
- 当前网址是开发分支的预览部署；在线房间服务端尚未部署到公网，因此该网页不支持远程玩家互联。
- 本次版本更新新增乒乓世界杯本地模拟、球员展示与比赛表现；构建仍输出静态站点，可按原流程上传 `apps/web/dist`。
- v4.3 赛事平衡及历史决策记录见 [`docs/13_PROJECT_EVOLUTION_V1_TO_V4_3.md`](docs/13_PROJECT_EVOLUTION_V1_TO_V4_3.md) 和 [`v4.3 实验报告`](reports/world-cup-v4.3/V4_3_BALANCE_REPORT.md)。奥运会支持者只高亮签表，不增加数值。
- 计划将 GitHub 仓库设为 Public 前，先完成 [`docs/10_LEGAL_ASSETS.md`](docs/10_LEGAL_ASSETS.md) 中的许可证和肖像素材检查。仓库目前没有 `LICENSE`，球员照片授权记录也不完整。

## 1. 核心玩法

赛前：`球员 + 底板 + 正手胶皮 + 反手胶皮` 形成常驻数值。

每一分依次经历：

1. **发球阶段**：进攻方有 4 点攻击预算，防守方有 10 点防守预算；未花点数可 Carry。攻击差值达到 V4 阈值直接得分。
2. **反制阶段**：双方分别有 4 点攻击预算和 10 点防守预算，并带入各自 reserve；未花点数继续 Carry。
3. **相持阶段**：每人获得 20 点加自身 reserve，可在 5 个进攻与 5 个防守项目间秘密分配；每项进攻单独最多 +4，防守单项不限，总支出不超过共享资源池。最多比较 6 次（双方各进攻 3 次），仍未直接决胜则按 Candidate V4 Tie Break 判定。

隐藏规则：对手只看到 **加点前项目战斗值**；临时加点在分配和锁定后仍保持隐藏，只有能力实际发生比较时才揭晓该项最终值。

## 2. 数值公式

- 单侧常驻值 = `clamp(球员基础 + 底板修正 + 对应侧胶皮修正, 1, 15)`
- 项目基础战斗值 = `(正手常驻值 + 反手常驻值) / 2`
- 实际比较值 = `项目基础战斗值 + 本阶段该项目临时点`
- 临时值允许超过 15。

## 3. 当前技术栈

- Node.js 24+
- pnpm 11.19 workspace + TypeScript 6.x
- React 19.1 + Vite 8.3
- Fastify 5.x
- Socket.IO 4.8.x
- PostgreSQL + Prisma ORM 7.x（锁定 7.x；不要误装 Prisma 8 RC）
- Zod 4：数据与命令校验
- Vitest 3 + Playwright 1.63
- ESLint 10 + Prettier 3
- Docker Compose + GitHub Actions

## 4. Monorepo 目标结构

```text
apps/
  web/                 React 前端
  server/              Fastify + Socket.IO 权威服务器
packages/
  game-core/           纯 TypeScript 规则引擎（最高优先级）
  game-data/           data/*.json 的类型化加载与校验
  shared-types/        命令/事件/API DTO 与 Zod schema
  ai/                  AI 决策策略
  balance-simulator/   确定性规则与策略平衡模拟

data/                  当前平衡数据源
prisma/                 数据库 schema
```

`game-core` 必须是纯函数层：**不能依赖 React、Fastify、Socket.IO、Prisma、浏览器 API 或数据库。**

## 5. 从哪里开始

Codex 第一次进入仓库时按顺序读：

1. `AGENTS.md`
2. `docs/01_GAME_RULES.md`
3. `docs/02_ARCHITECTURE.md`
4. `docs/06_ROADMAP.md`
5. `data/*.json`
6. `CODEX_START_PROMPT.md`

## 6. 本地开发

工程骨架位于 `apps/` 与 `packages/`。在仓库根目录执行：

```sh
corepack pnpm install
Copy-Item .env.example .env
docker compose up -d db
corepack pnpm dev
```

全栈开发地址为 `http://localhost:5173`（web）和 `http://localhost:3002`（server）。后端 `/health` 检查 PostgreSQL；Socket.IO `/game` namespace 和权威在线房间服务仍保留在 server 中，供后续桌面房主联机复用。

网页试玩版可单独运行，不需要 Docker、后端或 PostgreSQL：`corepack pnpm web:dev`。它只提供本地 AI 与同屏双人，对局和 AI 决策均在浏览器内运行；静态构建用 `corepack pnpm web:build`，输出目录为 `apps/web/dist`；浏览器验收用 `corepack pnpm web:e2e`。

首次开发/运行服务端在线房间时执行 `pnpm db:migrate:deploy` 创建访客会话表。当前免费网页试玩版不提供在线房间入口；前端只开放本地 AI 与同屏双人，避免依赖常驻服务。在线房间服务端仍保留在 `apps/server`，未来桌面联机阶段可复用权威规则、Socket.IO 协议与 `game-core`。

Prisma ORM 使用 7.x 的 `prisma-client` generator 和 `prisma.config.ts`。`corepack pnpm db:generate` 生成 server 使用的客户端，`corepack pnpm db:check` 执行实际数据库连接检查。根级 `build` 和 `typecheck` 会先生成客户端。

Phase 1 增加数据校验和纯规则引擎：`pnpm data:validate` 检查 `data/*.json` 及跨文件规则一致性，`pnpm simulate:match` 运行一场确定性的无 UI 比赛。`packages/game-core` 维护比赛状态，通过 `derivePublicView` 生成按玩家隔离的公开视图。

Phase 2 提供模式选择、球员/器材配置与常驻值预览、本地双人沙盒、逐分比赛和战报。Phase 3 原型默认使用 Candidate V4。Phase 4 增加服务器本地运行的分级策略 AI，不调用付费模型 API；AI 和真人都使用相同的服务器权威规则与 viewer-specific 视图。在线房间和进行中的 MatchState 保存在单个 server 进程内存中，GuestSession 令牌摘要存于 PostgreSQL；单实例重启会中断进行中的房间。

### Phase 5 在线对战与部署

服务器在线房间原型使用 `.env`、PostgreSQL、`pnpm db:migrate:deploy` 与 `pnpm dev`。浏览器免费试玩版不会调用该联机服务；桌面联机开发可复用现有房间与比赛服务端实现。常驻 WebSocket 公网部署模板仍需 HTTPS 与服务器，详见 `docs/08_DEPLOYMENT.md`。

生产部署模板：复制 `.env.production.example` 为 `.env.production`，设置指向本机公网地址的 `PUBLIC_DOMAIN` / `WEB_ORIGIN` 和随机 URL-safe `POSTGRES_PASSWORD`，确认服务器防火墙开放 TCP 80/443 及域名 A/AAAA 记录后运行：

```sh
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Caddy 自动申请和续期 HTTPS 证书；Nginx 提供静态前端并代理 REST 与 Socket.IO WebSocket。数据库不暴露公网端口。房间状态采用单服务器内存 actor；目前不支持多实例水平扩展，也不持久化中途比赛或完整战报（赛后持久化属于 Phase 6）。详见 `docs/08_DEPLOYMENT.md`。

### 免费网页试玩版

网页版本地 AI 与同屏双人可纯静态托管。Cloudflare Pages 等静态站点平台可提供平台子域名，不需要自有域名、常驻 Fastify、Socket.IO 或 PostgreSQL。Cloudflare Pages 的纯静态资源当前免费且不限请求；若以后加入动态 Functions，请重新评估其免费额度与限制。发布目录为 `apps/web/dist`，构建命令为 `corepack pnpm web:build`。网页对局运行在玩家浏览器中，刷新页面会结束尚未完成的本地对局；它不提供远程房间。

后续桌面版可让开房玩家的电脑担任该局权威服务端，避免你维护常驻游戏主机；朋友跨互联网加入仍取决于房主网络是否允许入站连接，无法直连时才需要中转服务。

Balance Lab 是独立命令行模拟包，读取 `game-data` 并复用 `game-core`。它保留 Legacy V1、Candidate V3、Candidate V4。V4 的 Carry/预算只保存在规则状态中，公开视图只向本人返回 reserve；未揭晓项目仍保持隐藏。当前本地可玩原型显式启用 Candidate V4；模拟器里的其他规则和参数仍须显式启用，且不会自动晋升为正式版本。

球员头像来源于 `photos/`，原图保持不变。用 `python -m pip install -r scripts/requirements-player-photos.txt` 安装图像处理依赖，再运行 `python scripts/process-player-photos.py` 可按映射及可调焦点生成 512×512 WebP 到 `apps/web/public/assets/players/`。前端头像组件带有缺图回退。

```sh
pnpm balance:quick     # 1,000 场/机制，快速验证
pnpm balance:run       # Standard：10,000 场/机制及单变量参数实验
pnpm balance:full      # Full：每种机制 100,000 场及单变量实验
pnpm balance:rules     # 运行规则参数实验
pnpm balance:equipment # 运行基准装备分析
```

报告写入 `reports/<timestamp>/`，包括汇总、球员/底板/胶皮/配装/能力/阶段/机制/策略 CSV，以及 V3/V4 专项报告、建议和参数实验 CSV。V4 另含 `resource-economy.csv` 与 `carry-distribution.csv`，记录支出、reserve 分布、Rally 预算、策略对战和布防集中度。低样本比较应按样本量解读；胜率区间使用 Wilson 95% CI。Candidate V3/V4 均保持候选状态，不自动提升正式规则；V4 的 Full 评估结果见 `docs/06_ROADMAP.md` 与对应报告目录。

常用检查：

```sh
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm exec playwright install chromium
corepack pnpm e2e
```

阶段状态与验收记录见 [`docs/06_ROADMAP.md`](docs/06_ROADMAP.md)。当前球员能力数据及 V4 模拟报告见 `reports/candidate-v4-player-refresh/`；网页试玩与公网发布边界见 [`docs/08_DEPLOYMENT.md`](docs/08_DEPLOYMENT.md)。

按 `docs/06_ROADMAP.md` 的顺序推进，每个 Phase 验收后再进入下一个，不要一次性把多个阶段混在一起。

## 6. 设计原则

- 服务端权威；客户端永远不能拿到未揭晓的隐藏加点。
- 客户端只提交命令，不提交“计算结果”。
- 所有比赛结果必须由 `game-core` 计算。
- 同一套 `game-core` 同时服务 AI、本地沙盒、在线双人和自动平衡模拟。
- 每一次规则修改都必须同步：文档、测试、数据版本。
- 公开发布前，真实球员姓名/肖像、品牌图片与商标素材必须先完成授权核查；当前清单和未解决事项见 [`docs/10_LEGAL_ASSETS.md`](docs/10_LEGAL_ASSETS.md)。
