# 04 — 后端、实时协议与状态机

## 1. REST API（MVP）
- `GET /health`：健康检查
- `GET /api/catalog`：返回 balanceVersion、球员、底板、胶皮、skill definitions（无私密信息）
- `POST /api/guest-session`：创建匿名会话，返回短期 session token
- `GET /api/matches/:id/summary`：完赛公开摘要

账户、预设配装、排行榜放在后续 Phase，不阻塞核心游戏。

## 2. Socket.IO 命名空间
使用 `/game`。

### 客户端 → 服务端命令
建议统一封装：
```ts
type CommandEnvelope<T> = {
  clientCommandId: string;
  expectedVersion: number;
  matchId?: string;
  payload: T;
}
```

事件：
- `room:create` `{ bestOf }`
- `room:join` `{ roomCode }`
- `room:set-loadout` `{ playerId, bladeId, forehandRubberId, backhandRubberId }`
- `room:ready` `{ ready: true }`
- `match:allocate` `{ stage, allocations }`
- `match:lock-allocation` `{ stage }`
- `match:choose-attack` `{ pairId }`
- `match:request-snapshot` `{}`

`allocations` 的 key 只允许当前阶段合法的 attack/defense 项，服务端校验总预算与单项上限。

### 服务端 → 客户端事件
- `room:snapshot`
- `room:player-joined`
- `room:player-ready`
- `match:started`
- `match:snapshot`（viewer-specific）
- `match:player-locked`（只告诉谁锁定）
- `match:comparison-revealed`
- `match:stage-changed`
- `match:point-ended`
- `match:game-ended`
- `match:ended`
- `match:opponent-disconnected`
- `match:opponent-reconnected`
- `command:rejected`

## 3. match:comparison-revealed 示例
```json
{
  "pairId": "service_spin",
  "attackerId": "p1",
  "defenderId": "p2",
  "attack": {"base": 9.5, "temporary": 4, "actual": 13.5},
  "defense": {"base": 10, "temporary": 1, "actual": 11},
  "delta": 2.5,
  "outcome": "continue"
}
```
只包含本次发生比较的项目。

## 4. 状态机
推荐：
```text
ROOM_SETUP
  -> SERVICE_ALLOCATING
  -> SERVICE_SELECTING
  -> [POINT_END | RECEIVE_ALLOCATING]
  -> RECEIVE_SELECTING
  -> [POINT_END | RALLY_ALLOCATING]
  -> RALLY_SELECTING (round 1..5)
  -> POINT_END
  -> [NEXT_POINT | GAME_END]
  -> [NEXT_GAME | MATCH_END]
```

两个玩家都锁定 allocation 后，才允许当前有选择权的玩家选择进攻项。

## 5. 校验规则
服务端必须拒绝：
- 非房间成员命令
- 非本人命令
- wrong expectedVersion
- 当前阶段不允许的命令
- allocation 总和不等于预算
- 单项超过 cap / 负数 / 非整数
- 非当前进攻方 choose-attack
- stage 不匹配
- unknown pairId/loadout ID
- 重复 ready/lock 导致非法状态跳转

## 6. 重连
- guest session 与 socket 分离。
- 断线后保留 player slot 60 秒。
- 重连校验 sessionToken + room/match membership。
- 返回新的 viewer-specific snapshot。
- 超过 60 秒：MVP 判负/房间关闭策略由 server config 控制；默认在线比赛判对手获胜并记录 disconnect result。

## 7. 持久化
完赛保存：
- 规则/平衡版本
- 双方配置快照
- 局分和总比分
- 每一分的公开事件
- 所有已经揭晓的 comparison

未被触发、从未揭晓的隐藏 allocation 不进入公开战报。若内部需要审计，单独加 private audit 表且永不从公开 API 返回；MVP 不做。
