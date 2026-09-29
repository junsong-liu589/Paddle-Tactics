# 乒乓对决 / PingPong Duel

一个以真实乒乓球战术为题材的 **回合制、隐藏加点、数值构筑** 对战游戏。

> 当前权威规则版本：`GDD v1.1 / balance_v1.1`。本仓库开发必须以 `docs/01_GAME_RULES.md` 与 `data/*.json` 为准。

## 1. 核心玩法

赛前：`球员 + 底板 + 正手胶皮 + 反手胶皮` 形成常驻数值。

每一分依次经历：

1. **发球阶段**：发球方 10 点进攻加点，接球方 10 点防守加点；差值绝对值达到 5 直接得分。
2. **反制阶段**：原接球方 10 点进攻加点，原发球方 10 点防守加点；差值绝对值达到 5 直接得分。
3. **相持阶段**：双方各 15 点，在 5 个相持进攻 + 5 个相持防守项目中秘密分配；轮流选择进攻项目，差值绝对值达到 4 直接得分，最多 5 轮，否则按累计优势决胜。

隐藏规则：对手只看到 **加点前项目战斗值**；临时加点在分配和锁定后仍保持隐藏，只有能力实际发生比较时才揭晓该项最终值。

## 2. 数值公式

- 单侧常驻值 = `clamp(球员基础 + 底板修正 + 对应侧胶皮修正, 1, 15)`
- 项目基础战斗值 = `(正手常驻值 + 反手常驻值) / 2`
- 实际比较值 = `项目基础战斗值 + 本阶段该项目临时点`
- 临时值允许超过 15。

## 3. 推荐技术基线（2026-09）

- Node.js 24 LTS
- TypeScript 6.0.x（typescript-eslint 支持 TS 7 后升级）
- React 19.x + Vite 8.x
- React Router + Zustand + Tailwind CSS
- Fastify 5.x
- Socket.IO 4.8.x
- PostgreSQL + Prisma ORM 7.x（锁定 7.x；不要误装 Prisma 8 RC）
- Zod：网络命令/事件/环境变量/JSON 数据校验
- Vitest + Playwright
- pnpm workspace
- Docker Compose
- GitHub Actions

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

前端地址为 `http://localhost:5173`，后端地址为 `http://localhost:3002`。后端 `/health` 检查 PostgreSQL；Socket.IO 已挂载在 `/game` namespace，在线比赛协议尚未开放。

Prisma ORM 使用 7.x 的 `prisma-client` generator 和 `prisma.config.ts`。`corepack pnpm db:generate` 生成 server 使用的客户端，`corepack pnpm db:check` 执行实际数据库连接检查。根级 `build` 和 `typecheck` 会先生成客户端。

Phase 1 增加数据校验和纯规则引擎：`pnpm data:validate` 检查 `data/*.json` 及跨文件规则一致性，`pnpm simulate:match` 运行一场确定性的无 UI 比赛。`packages/game-core` 维护比赛状态，通过 `derivePublicView` 生成按玩家隔离的公开视图。

Phase 2 提供模式选择、球员/器材配置与常驻值预览、本地双人沙盒、逐分比赛和战报。沙盒 `MatchState` 仅在服务端当前进程内保存；每次 API 请求只返回当前操作者的公开视图，屏幕交接后才显示另一位玩家的视图。沙盒不持久化比赛，不包含 AI 或在线房间。

Balance Lab 是独立的命令行模拟包，读取正式 `game-data`，通过 `game-core` 计算攻防、计分和相持裁决，不经过 Web、Socket.IO、HTTP 或 PostgreSQL。它保留 Legacy V1、历史 Candidate V1、Candidate V3，并新增 reducer-backed Candidate V4：玩家级跨阶段 Carry、Serve/Counter 4 点攻击与 10 点防守、Rally 20 点混合资源池、最多 4 次相持比较。V4 的 Carry/预算只保存在规则状态中，公开视图只向本人返回 reserve；未揭晓项目仍保持隐藏。Candidate V3/V4 与实验参数只能在模拟器显式启用，不会改变默认正式规则或写入正式 `data/*.json`。默认固定 seed 为 `20260928`。

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

Phase 0、Phase 1、Phase 2、Balance Lab 与 Candidate V3/V4 规则评估已完成。Phase 2 的浏览器验收使用 Playwright，完整一局从模式选择和配装开始，到赛果与逐分记录结束。Candidate V3/V4 均未成为默认比赛规则。V4 Full 结果显示 0.96% deuce 截断和 52.13% Rally 首进攻方胜率有所改善，但 8/10 个策略配对超过 65% 支配筛查线，因此不建议升级；详见 reports/2026-09-29T06-06-47-665Z/V4_BALANCE_REPORT.md。AI 与在线房间属于后续 Phase。进度与检查记录见 `docs/06_ROADMAP.md`。

按 `docs/06_ROADMAP.md` 的顺序推进，每个 Phase 验收后再进入下一个，不要一次性把多个阶段混在一起。

## 6. 设计原则

- 服务端权威；客户端永远不能拿到未揭晓的隐藏加点。
- 客户端只提交命令，不提交“计算结果”。
- 所有比赛结果必须由 `game-core` 计算。
- 同一套 `game-core` 同时服务 AI、本地沙盒、在线双人和自动平衡模拟。
- 每一次规则修改都必须同步：文档、测试、数据版本。
- 公开发布前，真实球员姓名/肖像、品牌图片与商标素材必须单独处理授权；开发期使用自制占位素材。
