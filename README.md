# Paddle Tactics

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
- TypeScript 7.x
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

## Phase 0 本地开发

要求 Node.js 24 与 pnpm。复制 `.env.example` 为 `.env`，启动 PostgreSQL：

```sh
docker compose up -d db
pnpm install
pnpm db:generate
pnpm dev
```

前端默认运行于 `http://localhost:5173`，后端健康检查为 `http://localhost:3001/health`。当前 Phase 0 仅建立服务边界和启动页面，尚未实现正式游戏 UI 或游戏规则。

然后只执行 `Phase 0`，验收通过后再进入 `Phase 1`，不要一次性把所有阶段混在一个提交里。

## 6. 设计原则

- 服务端权威；客户端永远不能拿到未揭晓的隐藏加点。
- 客户端只提交命令，不提交“计算结果”。
- 所有比赛结果必须由 `game-core` 计算。
- 同一套 `game-core` 同时服务 AI、本地沙盒、在线双人和自动平衡模拟。
- 每一次规则修改都必须同步：文档、测试、数据版本。
- 公开发布前，真实球员姓名/肖像、品牌图片与商标素材必须单独处理授权；开发期使用自制占位素材。
