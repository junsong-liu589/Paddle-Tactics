# AGENTS.md — Codex 开发约束

## 0. 任务目标
你正在开发“乒乓对决”，一个乒乓球题材的回合制策略数值游戏。不要把它改造成 3D 物理游戏、动作游戏或卡牌抽卡游戏。

## 1. 开发前必读
按顺序阅读：
1. `README.md`
2. `docs/01_GAME_RULES.md`
3. `docs/02_ARCHITECTURE.md`
4. `docs/03_FRONTEND_UX.md`
5. `docs/04_BACKEND_REALTIME.md`
6. `docs/06_ROADMAP.md`
7. `data/*.json`

当文档冲突时，优先级：
`用户最新明确决定 > docs/01_GAME_RULES.md > data/balance-config.json > 其他文档 > 代码现状`。

## 2. 强制架构约束
- `packages/game-core` 是纯规则引擎，不得 import React/Fastify/Socket.IO/Prisma。
- 服务端保存完整比赛状态；客户端只能收到 viewer-specific public view。
- 未揭晓临时加点不得通过 Socket payload、REST、日志、错误栈或前端状态泄露。
- 客户端不得提交最终战斗值、得分或胜负；只提交 loadout ID、加点分配、锁定和战术选择。
- 所有命令由服务端校验：身份、房间、阶段、回合、预算、单项上限、重复命令、状态版本。
- 规则必须可确定性重放。除 AI 策略外，胜负判定不使用随机数。

## 3. 数据约束
- `data/*.json` 是 balance_v1.1 的基准数据，禁止在组件里硬编码球员/装备数值。
- 常驻值封顶 15；项目基础战斗值允许 0.5；临时值允许超过 15。
- 球员基础总分必须保持：480/480/480/460/440/460/440/440。
- 修改平衡数据时先增加新版本文件或更新版本号，并补模拟/单测。

## 4. 工程质量
每个 Phase 完成前必须执行并通过：
- lint
- typecheck
- unit tests
- build
- 对涉及 UI 的 Phase：至少一条 Playwright happy-path

禁止：
- `any` 滥用
- 把核心规则散落在 React 组件或 Socket handler
- 用 setTimeout 模拟核心状态机
- 没有校验的客户端 payload
- 未经说明的大规模重构

## 5. Git/提交
- 每个 Phase 使用独立分支：`feat/phase-N-short-name`
- 小步提交，推荐 Conventional Commits：`feat:`, `fix:`, `test:`, `docs:`, `refactor:`
- 每个 Phase 结束更新 `docs/06_ROADMAP.md` 的状态，并记录验收命令。

## 6. Codex 工作方式
每次开始一个 Phase：
1. 阅读该 Phase 验收标准。
2. 先检查现状，不假设文件已经存在。
3. 给出简短实施计划。
4. 编码。
5. 自测并修复。
6. 汇报：改了什么、测试结果、仍有哪些风险、下一 Phase 建议。

不要自行改变已确认的游戏规则；遇到必须改变规则才能实现的情况，保留现有规则并在报告里提出问题。
