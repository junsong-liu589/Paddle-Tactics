# 08 — 本地环境、CI 与部署

## 本地要求
- Node.js 24 LTS
- pnpm（Corepack 管理）
- Docker Desktop / Docker Engine

## 环境变量
复制 `.env.example`，不要提交真实 secret。

## Docker
MVP Docker Compose 只强制启动 PostgreSQL。开发时 web/server 可直接 pnpm dev，便于 HMR。

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

后续多 server：
- Redis adapter 做 Socket room fanout
- sticky session / compatible connection routing
- active match state snapshot/actor ownership

## 备份
生产 DB 开启自动备份；平衡 JSON 本身由 Git 版本控制。
