# 09 — TypeScript 数据契约建议

```ts
export type Side = 'forehand' | 'backhand';
export type Role = 'attack' | 'defense';
export type Stage = 'service' | 'receive' | 'rally';
export type PlayerSeat = 'A' | 'B';

export type SideValues = { forehand: number; backhand: number };
export type SkillPairStats = {
  attack: SideValues;
  defense: SideValues;
};

export type Loadout = {
  playerId: string;
  bladeId: string;
  forehandRubberId: string;
  backhandRubberId: string;
};

export type Allocation = Record<string, number>;

export type MatchPhase =
  | 'ROOM_SETUP'
  | 'SERVICE_ALLOCATING'
  | 'SERVICE_SELECTING'
  | 'RECEIVE_ALLOCATING'
  | 'RECEIVE_SELECTING'
  | 'RALLY_ALLOCATING'
  | 'RALLY_SELECTING'
  | 'POINT_END'
  | 'GAME_END'
  | 'MATCH_END';
```

命令推荐 discriminated union：
```ts
type GameCommand =
 | { type:'ALLOCATE'; stage:Stage; allocations:Allocation }
 | { type:'LOCK_ALLOCATION'; stage:Stage }
 | { type:'CHOOSE_ATTACK'; pairId:string };
```

不要把 Zod schema 和 TS interface 分开手写两份导致漂移；优先 schema -> infer type。
