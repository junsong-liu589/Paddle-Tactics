# 02 — 技术架构

## 1. 总体原则

这是一个回合制隐藏信息游戏，不需要高频物理同步，但需要 **严格的信息隔离与服务端权威状态机**。

```text
Browser A ─┐
           ├── Socket.IO ── Fastify/Socket Server ── game-core
Browser B ─┘                              │              │
                                         │              ├── game-data
                                         │              └── ai
                                         └── Prisma ── PostgreSQL
```

## 2. Monorepo

```text
apps/
  web/
    src/pages/
    src/features/loadout/
    src/features/match/
    src/features/room/
    src/features/result/
    src/lib/socket/
    src/store/
  server/
    src/http/
    src/socket/
    src/rooms/
    src/services/
    src/db/
packages/
  game-core/
    src/model/
    src/commands/
    src/reducer/
    src/scoring/
    src/loadout/
    src/views/
  game-data/
  shared-types/
  ai/
```

## 3. game-core API（建议）

```ts
createMatch(config, playerA, playerB): MatchState
calculateLoadoutStats(loadout, catalog): ConstantStats
calculateProjectBattleValues(constantStats): ProjectBattleValues
applyCommand(state, actorId, command): ApplyResult
derivePublicView(state, viewerId): PlayerMatchView
resolveComparison(...): ComparisonResult
```

`ApplyResult`：

```ts
{ state: MatchState; events: DomainEvent[] }
```

规则引擎绝不直接 emit Socket，也不写数据库。

## 4. 服务端 Room Actor

MVP 每场比赛在 `RoomManager` 中维护一个 actor/instance：

- 串行处理命令，避免同一房间并发竞态。
- 每个 state 带 `version`。
- 客户端命令带 `clientCommandId` + `expectedVersion`。
- 处理成功后 version + 1。
- 重复 commandId 返回之前 ack，做到幂等。

不要让两个 Socket handler 直接同时修改同一个普通 JS 对象。

## 5. Public View / Private State 分离

`MatchState` 包含完整隐藏分配，只存在服务端。

发给客户端前必须经过：

```ts
derivePublicView(state, viewerPlayerId);
```

客户端类型中根本不要定义 `opponent.hiddenAllocations` 字段。防止“只是 UI 不显示，但 DevTools 能看到”。

## 6. 数据层

- 平衡数据：Git 中 JSON 版本化，不依赖数据库动态编辑。
- 进行中房间：MVP 存内存；服务器重启可丢失未完成房间，这是 MVP 可接受限制。
- 断线 60 秒：同一 server process 内保留 actor，session token 重连恢复。
- 完赛：写 PostgreSQL。
- 后续横向扩展：Redis 存 room routing / presence，Socket.IO Redis adapter；再考虑 active match snapshot。

## 7. 版本策略

每场比赛创建时冻结：

- `balanceVersion`
- 双方 loadout ID
- 双方计算后的常驻快照

即使部署期间平衡数据更新，已开始比赛也不能改变。

## 8. 关键非功能要求

- P95 命令处理对回合制游戏足够低即可，正确性优先。
- 服务端不信任客户端数值。
- 所有 payload Zod 校验。
- 正常日志默认不打印 hidden allocations。
- 生产环境开启基本 rate limit、CORS allowlist、helmet。

## 9. 静态网页世界杯与表现层

世界杯签位、AI 配装、单场模拟和晋级状态由 `apps/web/src/lib/world-cup.ts` 在浏览器本地执行；仅复用 `game-core` 与 `ai`，不增加服务端 API、数据库依赖或规则层 UI 依赖。赛事存档使用浏览器 `localStorage`。球员插画、雷达图和动作/球轨迹表现属于 Web 表现层；`game-core` 与 `data/` 基准能力保持不变。
