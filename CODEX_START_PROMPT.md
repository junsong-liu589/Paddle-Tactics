# CODEX 启动提示词

你现在接手一个新项目：**Paddle Tactics**。

这是一个乒乓球题材的回合制隐藏信息策略游戏，不是 3D 物理游戏。项目的完整 GDD、数值数据、技术架构和 ROADMAP 已经放在当前目录。

请严格执行以下步骤：

1. 先完整阅读 `AGENTS.md`。
2. 再阅读：
   - `README.md`
   - `docs/01_GAME_RULES.md`
   - `docs/02_ARCHITECTURE.md`
   - `docs/03_FRONTEND_UX.md`
   - `docs/04_BACKEND_REALTIME.md`
   - `docs/06_ROADMAP.md`
   - `data/skills.json`
   - `data/players.json`
   - `data/blades.json`
   - `data/rubbers.json`
   - `data/balance-config.json`
3. 检查当前仓库现状，不假设任何工程文件已经存在。
4. **本次只完成 ROADMAP 的 Phase 0 — 工程骨架。不要提前实现 Phase 1~6。**
5. 使用 pnpm workspace 建立 monorepo：
   - `apps/web`: React + TypeScript + Vite
   - `apps/server`: Node + TypeScript + Fastify
   - `packages/game-core`
   - `packages/game-data`
   - `packages/shared-types`
   - `packages/ai`
6. 技术基线：Node 24 LTS、TypeScript 7.x、React 19.x、Vite 8.x、Fastify 5.x、Socket.IO 4.8.x、PostgreSQL、Prisma ORM **锁定 7.x**、Zod、Vitest、Playwright、Zustand。Prisma 8 目前不要使用。
7. 配置 TypeScript strict、ESLint、Prettier、Vitest、根级 scripts、`.env.example`、Docker Compose PostgreSQL、Prisma schema、GitHub Actions。
8. server 实现 `GET /health`；web 首页显示项目名并能够请求/展示 server health。
9. 不要把 game rules 写进 UI 组件；Phase 0 只做包骨架和接口边界。
10. 完成后必须实际运行：lint、typecheck、test、build；能运行 Docker 时再验证 PostgreSQL health。修复所有你能够修复的问题。
11. 更新 `docs/06_ROADMAP.md`，只把实际验收通过的 Phase 0 项标记完成。
12. 最终向我汇报：新增/修改文件、命令结果、工程结构、未解决问题、是否满足 Phase 0 验收标准。不要自动开始 Phase 1，等我确认。

额外硬约束：未来在线模式必须由服务端保存隐藏 allocation；客户端永远不能收到对方未揭晓的加点。`packages/game-core` 必须保持纯 TypeScript、无框架/IO 依赖。
