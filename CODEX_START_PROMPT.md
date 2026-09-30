# 项目继续开发提示词

你正在继续开发 **乒乓对决（Paddle Tactics）**。这是一个乒乓球题材的回合制策略游戏。开始工作前，请先检查当前 Git 分支与工作区状态，并阅读 `AGENTS.md`、`README.md`、`docs/` 中相关设计文档、`data/` 当前基准数据、Prisma schema 和部署配置。

## 当前项目状态

- Phase 0–5 的开发阶段已完成；Phase 6（赛果持久化与产品化）及 Phase 7（完整平衡、表现与正式部署）仍在 `docs/06_ROADMAP.md` 中待办。不要因为使用本提示词就自动开始下一阶段，按用户本轮目标执行。
- 当前可玩规则使用 Candidate V4。未经用户明确要求，不要改变已确认规则、V4 Carry 核心机制或 `data/` 中的已定数值。
- 免费网页试玩版已部署：[Cloudflare Pages 预览](https://feat-phase-5-online-multipla.paddle-tactics.pages.dev/)。它只支持浏览器本地 AI 和同设备双人，不需要后端或付费 AI API。
- Fastify、Socket.IO、PostgreSQL 在线房间实现与生产 Docker/Caddy 模板已在仓库；在线房间服务端尚未部署到公网。不要把静态网页试玩链接描述成远程联机服务。
- 当前分支/PR 与 Git 状态可能变化；每次开始任务都重新检查，不要依赖这段提示词中的旧分支名或 PR 编号。

## 关键架构与规则边界

- `packages/game-core` 是纯 TypeScript 规则引擎，不得依赖 React、Fastify、Socket.IO、Prisma 或浏览器 API。
- 在线模式由服务端保存完整状态；客户端只可收到 viewer-specific public view，不能获得对手未揭晓的加点。
- 本地 AI 是纯 TypeScript 策略，不调用外部 LLM 或付费 API。
- 球员、底板、胶皮与规则数值以 `data/` 和其版本化文件为准，不在 React 组件中硬编码。
- 规则修改必须同步文档、测试和数据版本；具体规则以 `docs/01_GAME_RULES.md` 与当前 V4 实现为准。

## 公开仓库前注意

仓库目前没有 `LICENSE`；`photos/` 和网页 WebP 头像包含真实球员照片，授权来源尚未完整记录。用户准备将仓库设为 Public 前，先按 `docs/10_LEGAL_ASSETS.md` 解决许可证选择和图片授权；不要擅自替用户选择代码许可证，也不要自行删除或替换已接入的素材。

所有改动遵循 `AGENTS.md`。先检查现状，再按本轮用户要求修改；运行相应的 format、lint、typecheck、tests、build 和 UI 验收；修复可确认的代码问题，并如实报告环境阻塞。
