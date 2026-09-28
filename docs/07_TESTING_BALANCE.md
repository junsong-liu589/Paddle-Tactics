# 07 — 测试与数值平衡

## 1. game-core 单测必须覆盖
- 所有 8×8×7×7 配装常驻值都在 1..15。
- 两侧平均可产生 .5，计算不丢精度。
- 临时点可让 actual > 15。
- 发球/反制 ±5 边界。
- 相持 ±4 边界。
- 5轮累计优势和四级 tie-break。
- 11分、win-by-2、deuce 发球轮换。
- BO1/BO3/BO5。
- 非法 allocation 全部拒绝。
- 非当前行动者命令拒绝。
- derivePublicView 不泄露对手隐藏点。

## 2. Property / invariant tests
推荐用 fast-check（可选）：
- 任意合法 loadout -> 所有 constant stats ∈ [1,15]
- 任意合法 allocation -> sum == budget && each <= cap
- 每一分一定有限结束（相持最多5轮）
- 每次 point end 恰好只有一名 winner
- 比赛结束后再提交命令不改变 state

## 3. 自动平衡模拟
共有 `8 × 8 × 7 × 7 = 3136` 种配装。
写 `packages/game-core/scripts/balance-sim.ts`：
- 枚举配装常驻数据
- 统计触顶 15 的频率
- 统计每个技能平均项目值和极值
- 用策略机器人跑大量对局：均匀、偏攻、偏防、针对弱点、随机
- 输出 CSV/JSON 报告

注意：模拟胜率只帮助发现异常，不自动决定削弱/加强。

## 4. E2E
Playwright：
- 完成本地一分/一局
- 创建在线房间，第二浏览器加入
- 双方秘密加点，确认对手页面不出现隐藏数字
- 比较发生后，恰好揭晓被使用的两项
- 断线重连恢复
