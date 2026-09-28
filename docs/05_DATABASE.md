# 05 — 数据库设计

## MVP 原则
游戏运行态首先放在内存 Room Actor；PostgreSQL 负责长期数据，不承担每个回合的热状态锁。

## 推荐实体
### User（后期可选）
- id
- displayName
- createdAt

### GuestSession
- id
- tokenHash
- expiresAt
- createdAt

### LoadoutPreset（账户系统后加入）
- id / userId / name
- playerDataId
- bladeDataId
- forehandRubberDataId
- backhandRubberDataId

### Match
- id
- roomCode
- status
- balanceVersion
- bestOf
- winnerParticipantId
- resultReason (`normal | disconnect | forfeit`)
- startedAt / endedAt

### MatchParticipant
- id / matchId / userId? / guestSessionId?
- seat (`A | B`)
- playerDataId / bladeDataId / FH rubber / BH rubber
- loadoutSnapshot JSON
- gamesWon

### MatchEvent
- id / matchId
- seq（match 内唯一）
- type
- publicPayload JSON
- createdAt

只保存允许公开/复盘的事件。

## 为什么保留 snapshot
平衡版本以后会变化。历史战报必须能重现当时真实参赛数据，不能只通过当前 JSON 再算。

详细 Prisma 初稿见 `prisma/schema.prisma`。
