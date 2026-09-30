# 文件说明

- `README.md`：项目总览和阅读顺序
- `AGENTS.md`：Codex 必须遵守的工程/规则约束
- `CODEX_START_PROMPT.md`：第一次直接复制给 Codex 的提示词
- `docs/01_GAME_RULES.md`：实现级游戏规则
- `docs/02_ARCHITECTURE.md`：前后端/规则引擎架构
- `docs/03_FRONTEND_UX.md`：页面和交互
- `docs/04_BACKEND_REALTIME.md`：Socket 协议、状态机、隐藏信息
- `docs/05_DATABASE.md`：数据库说明
- `docs/06_ROADMAP.md`：分阶段开发与验收
- `docs/07_TESTING_BALANCE.md`：测试与自动平衡模拟
- `docs/08_DEPLOYMENT.md`：本地/CI/部署
- `docs/09_DATA_CONTRACTS.md`：TS 类型契约建议
- `docs/10_LEGAL_ASSETS.md`：素材盘点、授权状态和公开仓库前检查
- `data/*.json`：GDD v1.1 权威数值数据
- `data/*-balance-v1.1.json`、`reports/`：版本化平衡候选和模拟报告
- `photos/`、`apps/web/public/assets/players/`：球员原始照片与网页头像（公开前须核实授权）
- `prisma/schema.prisma`：数据库初稿
- `.env.example` / `docker-compose.yml` / `.github/workflows/ci.yml`：可直接沿用的工程模板
- `docs/乒乓对决_游戏设计文档_v1.1.docx`：原始 GDD 备份

## 当前交付状态

- Phase 0–5 的代码和阶段报告已在本分支；Phase 6–7 仍在路线图中。
- 免费网页试玩版公开预览：https://feat-phase-5-online-multipla.paddle-tactics.pages.dev/
- 该预览只提供本地 AI 和同设备双人。远程在线房间服务端尚未部署。
- GitHub 仓库公开前的授权与许可证待办见 `docs/10_LEGAL_ASSETS.md`。
