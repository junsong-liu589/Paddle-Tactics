# 08 — 本地环境、CI 与部署

## 本地要求

- Node.js 24 LTS
- pnpm（Corepack 管理）
- Docker Desktop / Docker Engine

## 环境变量

复制 `.env.example`，不要提交真实 secret。

## Docker

MVP Docker Compose 只强制启动 PostgreSQL。开发时 web/server 可直接 pnpm dev，便于 HMR。

## Phase 5 本地联机与生产部署

首次本地启动需要应用访客会话迁移：

```powershell
docker compose up -d db
pnpm db:migrate:deploy
pnpm dev
```

生产模板由 `docker-compose.production.yml`、`apps/server/Dockerfile`、`apps/web/Dockerfile`、`apps/web/nginx.conf` 与 `Caddyfile` 组成。它包括 PostgreSQL、常驻 Fastify/Socket.IO server、静态 React 前端及 Caddy TLS 反代；数据库仅接入 Compose 私网，Caddy 自动签发/续期 HTTPS，并透传 WebSocket。

上线步骤：

1. 准备一台可运行 Docker Compose 的公网主机，并将自有域名 A/AAAA 记录指向该主机。
2. 复制 `.env.production.example` 为 `.env.production`，设置真实域名和随机 URL-safe 数据库密码；`WEB_ORIGIN` 必须与公开 HTTPS origin 完全一致。
3. 在主机上执行 `docker compose --env-file .env.production -f docker-compose.production.yml up -d --build`。
4. 验证 `https://<域名>/health` 返回 `database: connected`，创建房间并从另一浏览器加入，完成一次在线对局。
5. 持续运行 PostgreSQL 自动备份，并保护 `.env.production` 与 Docker volume。

当前部署拓扑限定为单个 server 实例。在线 GuestSession 写入 PostgreSQL；房间、隐藏 MatchState 与幂等缓存仅保存在 server 内存，容器/主机重启会中断未完成的比赛。多实例、Redis、自动故障转移和完整比赛战报留待后续阶段。云主机、域名和 DNS 由部署者提供；本仓库不包含任何云服务密钥。

## CI

PR 必须跑：

1. pnpm install --frozen-lockfile
2. pnpm lint
3. pnpm typecheck
4. pnpm test
5. pnpm build

涉及数据库测试时使用 CI service container 或独立 integration job。

## 生产建议

- 前端：静态构建部署 CDN/静态站点。
- Server：常驻 Node 容器/VM；Socket.IO 不适合纯短生命周期 serverless handler。
- PostgreSQL：托管数据库或自建容器（正式环境优先托管）。
- 单实例 MVP 不需要 Redis。

## 免费网页试玩版（纯静态）

网页试玩版只包含本地 AI 对战和同屏双人；浏览器内复用 `game-core` 与 `ai`，不请求 `/api`、不连接 Socket.IO，也不要求 PostgreSQL。单独开发时运行 `corepack pnpm web:dev`；发布构建运行 `corepack pnpm web:build`，上传 `apps/web/dist`。根目录 `apps/web/public/_redirects` 提供前端 history 路由回退。

世界杯模拟同样完全在浏览器运行；签位和赛果保存在本机 `localStorage`，不需要账号、常驻服务或按用户计费的 API。人物 WebP 作为静态文件随站点构建。静态版本不提供跨设备同步或实时远程联机；部署平台免费额度和条款以服务商当期政策为准。

v4.3 已手动上传到同一 Cloudflare Pages 项目：正式网址 https://paddle-tactics.pages.dev/；原试玩网址 https://feat-phase-5-online-multipla.paddle-tactics.pages.dev/ 也已按原 Preview 分支名重新发布。两个地址的首页均返回 200，且引用同一 v4.3 构建文件。该项目没有 Git 连接，合并 GitHub PR 后仍需手动运行 `pnpm web:build` 并发布 `apps/web/dist`。两个静态网页都不能用于远程房间联机；在线房间服务端仍需要独立的常驻主机和数据库部署。

Cloudflare Pages 等静态站点托管服务可提供平台子域名；部署前应查看服务商当期免费额度和使用条款。自定义域名、动态函数或新增在线功能可能产生额外要求/费用。网页试玩版的进行中比赛只存在当前标签页的内存中，刷新或关闭后无法恢复。

本网页版本有意不包含在线双人入口。后续桌面联机可将创建房间一方的桌面进程用作权威游戏服务端；房主网络的 NAT/防火墙可能阻止外部直连，届时需要路由器端口映射或 NAT 穿透/中转。无需维护你的常驻云服务器并不等于任何家庭网络都能免配置直连。

后续多 server：

- Redis adapter 做 Socket room fanout
- sticky session / compatible connection routing
- active match state snapshot/actor ownership

## 备份

生产 DB 开启自动备份；平衡 JSON 本身由 Git 版本控制。
