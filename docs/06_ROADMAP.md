# 06 — ROADMAP

> Codex 必须按 Phase 推进。每个 Phase 验收后再进入下一个。

## Phase 0 — 工程骨架 [IN PROGRESS]
目标：建立可持续开发基础，不实现完整玩法。

- pnpm workspace monorepo
- apps/web React + Vite
- apps/server Fastify
- packages/game-core / game-data / shared-types / ai
- TypeScript strict
- ESLint + Prettier
- Vitest
- Docker Compose PostgreSQL
- Prisma 7 初始化
- `/health`
- web 首页能调用 `/health`
- GitHub Actions：lint/typecheck/test/build

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

当前实现记录（2026-09-28）：已创建 workspace、web/server 与四个 package 骨架，加入健康检查、Socket.IO `/game` namespace、Prisma 7 配置及 CI。依赖安装与自动验收仍待本地命令执行器恢复；Docker Engine 当前不可访问，因此 PostgreSQL 容器尚未验证。Phase 0 仅在所有命令通过后标记完成。

## Phase 1 — 数据与纯规则引擎 [TODO]
- 读取并 Zod 校验 `data/*.json`
- loadout 常驻值计算（1..15 clamp）
- 项目平均战斗值
- 完整 MatchState / Command / DomainEvent
- 发球、反制、相持 reducer
- 发球轮换 / deuce / BO1/3/5
- 5轮累计优势 tie-break
- `derivePublicView`
- 至少 80+ 条 game-core 单测，重点覆盖边界
- CLI/测试中可跑完一场无需 UI 的确定性比赛

验收：任意隐藏分配永远不出现在对手 public view 测试中。

## Phase 2 — 本地沙盒 + 完整前端流程 [TODO]
- 模式选择
- 选人/底板/FH/BH胶皮
- 数值实时预览
- 本地双人/开发沙盒
- 比赛加点页、锁定、揭晓、比分
- 结果页
- 响应式桌面/手机
- Playwright 完整一局 happy path

## Phase 3 — AI 单人模式 [TODO]
- packages/ai
- easy / normal / hard
- AI 只能读 public view
- AI 加点与选项策略测试
- 禁止 AI 作弊测试
- AI 完整 BO3

## Phase 4 — 在线双人 [TODO]
- guest session
- 6位房间码
- room create/join/ready
- Socket.IO 命令协议
- 服务器权威 MatchState
- version + command id 幂等
- 60秒断线重连
- 两个真实浏览器完成 BO3 E2E
- 隐藏状态泄露测试

## Phase 5 — PostgreSQL 战报与产品化 [TODO]
- Prisma Match / Participant / Event
- 完赛持久化
- 历史赛果页
- 公开逐分复盘
- 错误处理/日志/基础限流
- Docker production build

## Phase 6 — 平衡、表现与部署 [TODO]
- 3136 配装枚举分析
- 策略机器人批量模拟
- balance report
- UI 动画、音效、占位美术优化
- 正式环境部署
- 监控与备份

## 暂不做
- 3D 物理乒乓球
- 商城/抽卡
- 复杂社交系统
- Redis 横向扩展（流量需要时再做）
- 真实人物/器材官方图片抓取
