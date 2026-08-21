# 模块：核心引擎（`js/game.js`）

## 职责

系统的中枢与状态机。负责：主循环（`requestAnimationFrame`）、网格地图构建、移动/子弹碰撞解析、敌人生成与 AI 驱动、计分与连击、道具效果、粒子与屏幕震动、Canvas 渲染（DPR 适配）、`localStorage` 持久化（最高分/配置）、以及向上层广播事件。引擎**不直接操作 DOM**，只通过 `onEvent(evt)` 回调与 UI 通信。

类：`TB.Game`。构造参数 `(canvas, audio, input)`。

## 状态机

`state ∈ { menu, playing, paused, over, win }`，由 `this.state` 驱动：

- `startGame()`：重置分数/命数/连击 → `prepareLevel(0)` → `playing`。
- `pause()` / `resume()`：仅在 `playing` ↔ `paused` 间切换（关卡过场态 `_levelTransition` 下 `resume` 无效）。
- `_levelClear()`：剩余敌人为 0 → 若还有下一关则进入带 `_levelTransition` 的 `paused` 并广播 `levelclear`；否则 `win`。
- `advanceLevel()`：由 UI 在过场后调用 → `startLevel(下一关)`。
- `_gameOver()`：基地失守或命数耗尽 → `over`。
- `toMenu()`：回主菜单并 `prepareLevel(0)`。

## 主循环 `_loop(ts)`

```
dt = min(0.05, (ts-lastTs)/1000); now = ts;
if (state==='playing') update(dt);
render();
_emitHud();
requestAnimationFrame(_loop);
```

`dt` 上限防止切后台/卡顿后的大跳变。

## 关键方法

### 地图与坐标
- `prepareLevel(idx)`：`grid = TB.normalizeMap(level.map)`；定位 `basePos`；清空实体；`toSpawn=level.enemyTotal`；`_spawnPlayer(true)`。
- `tileAt(px,py)`：像素 → 地形（越界返回 -1）。
- `boxHitsSolid(x,y,sz)`：AABB 与网格求交，判断坦克是否受阻（含越界即 solid）。
- `resolveMove(ent, dx, dy, dt)`：单步移动——先尝试主方向平移（被 solid 拦截则不动），再沿垂直方向向格中心吸附对齐；最后 `clamp` 到战场内。

### 实体驱动
- `update(dt)`：铲子计时 → 玩家更新 → 敌人生成 → 敌人更新 → 子弹更新 → 道具拾取 → 粒子推进 → 清理 → 震动衰减 → 过关判定。
- `spawnBullet(tank)`：依队伍与火力等级计算 `speed/power`，在炮口生成 `Bullet`。
- `_updateBullet(b, dt)`：移动 → 命中地形（砖碎/钢挡或破/基地失守）→ 子弹互撞 → 命中坦克（扣血、击杀计连击分、按概率掉道具）。

### 计分与连击
- `_enemyKilled(e)`：`mult = min(comboCount+1, 4)`；`score += e.type.score * mult`；`comboCount++`；爆炸、震屏、按 `ITEM_DROP_CHANCE` 掉道具。

### 道具效果 `_applyItem(typeKey)`
- `star`：玩家火力等级 +1（封顶 3）。
- `helmet`：`playerShieldUntil = now + 8000`。
- `shovel`：`_activateShovel()` 把基地周围 5 格砖转钢，`shovelUntil` 到期由 `update` 调 `_revertShovel()` 还原。
- `timer`：`enemyFrozenUntil = now + 6000`（敌人 `update` 中冻结）。
- `bomb`：清除全部存活敌人并按分计奖、震屏。
- `tank`：命数 +1（封顶 5）。

### 受击 / 基地
- `_playerHit()`：无敌或护盾期内免疫；否则玩家阵亡、命数 -1，命数 >0 则 `_spawnPlayer(false)` 立即重生（带无敌帧），否则 `_gameOver()`。
- `_baseDestroyed()`：基地格清空 + 大爆炸 + `_gameOver()`。

### 持久化
- `_storageGet/_storageSet`（try-catch 兜底隐私模式）；`_loadStorage()` 读最高分与配置；`saveHighScore()` / `saveConfig()`。

### 渲染 `render()`
背景网格 → 非草地形 → 道具 → 子弹 → 敌人（含出生动画）→ 玩家 → 草（覆盖遮蔽）→ 粒子 → 冻结/震动覆盖。坐标经 `dpr` 缩放，震屏用 `setTransform` 偏移。

## 事件广播 `_emit(evt)`
- `hud`：`{score,high,lives,level,enemiesLeft,power,powerTimer,powerMax}`
- `banner`：`{text}`（关卡名 / 过关提示）
- `state`：`{state}`
- `levelclear` / `gameover` / `win`：含分数、最高分、是否新纪录。

## 数据流

```
_input ──dir/fire──▶ update ──▶ entities.update(world)
                                        │ resolveMove / spawnBullet / tileAt
                                        ▼
                              碰撞解析 ──▶ 计分 / 道具 / 生成 / 胜负
                                        │ play(name)
                                        ▼
                                    audio
                                        │ onEvent
                                        ▼
                                      main (UI)
        持久化：saveHighScore / saveConfig ──▶ localStorage
        配置：_loadStorage ◀── localStorage
```

## 设计要点

- **碰撞权威集中**：所有网格碰撞在 `game` 内，实体只通过 `world` 回调请求移动，便于单元测试时用桩替身验证 `resolveMove`/`boxHitsSolid`/`_updateBullet`。
- **`resolveMove` 为单步移动**（非连续扫掠），越界/撞墙时整体拦截——测试断言需据此（见 `tests/tank.test.js`）。
- **可测试性**：核心方法不依赖 DOM；`Canvas` 仅在 `render` 使用，因此可在 Node 中用 Proxy 桩 `getContext` 加载并测试状态机、计分、道具、碰撞。
