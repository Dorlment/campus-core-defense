# 模块：配置与数据（`js/config.js`）

## 职责

全局唯一数据源（data-driven）。集中定义网格尺寸、地形类型、敌人类型、道具、玩家火力等级、默认按键、关卡地图与刷新规则。所有其它模块只读取此处常量，不在逻辑中硬编码数值，从而支持「改数据即改玩法」。

挂载命名空间：`window.TB`（以下记为 `TB`）。

## 关键数据

### 尺寸与字段
- `TB.CONFIG.GRID = 13`，`CELL = 40`，`FIELD = GRID * CELL = 520`（战场逻辑像素）。
- `TB.CONFIG.PLAYER`：`speed`(96)、`lives`(3)、`respawnInvincible`(1600ms)、`spawnCell`({r:12,c:4})。
- `TB.CONFIG.BULLET`：`speed`(300)、`size`(8)。
- `TB.CONFIG.COMBO_WINDOW`、`ITEM_DROP_CHANCE`(0.22)、`ITEM_DURATION`(helmet 8000 / shovel 12000 / timer 6000)。

### 地形 `TB.TILE`
`EMPTY / BRICK / STEEL / WATER / GRASS / ICE / BASE`。
- `TB.solidForTank(t)`：砖/钢/水/基地阻挡坦克；空/草/冰不阻挡（草仅视觉遮蔽，冰用于打滑）。
- 子弹规则另见 `game`：砖可碎、钢需最高火力、水不挡子弹、草不挡、基地被敌弹击毁即败。

### 敌人 `TB.ENEMY_TYPES`
`basic`(100/70/1血)、`fast`(200/122/1)、`armor`(300/52/3)、`smart`(400/88/1, chase=1)。字段：`score` / `speed` / `hp` / `shoot`(射击间隔) / `color` / `chase`。

### 道具 `TB.ITEMS` + `TB.ITEM_KEYS`
`star`(火力) / `helmet`(护盾) / `shovel`(强化基地) / `timer`(冻结敌军) / `bomb`(全屏清除) / `tank`(加命)。

### 玩家火力等级 `TB.POWER_LEVELS`
长度 4（索引 0–3，对应火力等级 0–3）：`maxBullets`(1/1/2/2)、`bulletSpeed`(300/360/360/420)、`breakSteel`(false/false/false/true)。等级 3 子弹可破钢墙。

### 按键 `TB.DEFAULT_KEYMAP` + `TB.KEYMAP_LABELS`
上/下/左/右/射击/暂停/确认/重开 的 `KeyboardEvent.code` 列表与中文标签。

### 关卡 `TB.LEVELS`
3 关，每关含 `name / enemyTotal / maxOnScreen / spawnInterval / speedMul / weights / map`：
- `map`：13×13 字符数组，字符经 `TB.MAP_CHARS` 映射为地形（`B/S/W/G/I/E/.`）。
- `weights`：按敌人类型抽取的概率（和为 1）。

### 刷新点 `TB.SPAWN_CELLS`
顶部 3 个刷新坐标 `{r:0,c:0/6/12}`。

## 关键函数

- `TB.normalizeMap(rows)`：把字符地图规范化为 13×13 数字网格，缺失行/列补空、未知字符降级为 `EMPTY`，防止越界崩溃。
- `TB.pickEnemyType(weights)`：按权重随机返回敌人类型 key（零权重类型永不被抽中）。

## 数据流

```
config.js (静态常量)
   │ 被读取
   ├─→ game.prepareLevel()  : TB.LEVELS + normalizeMap → 网格 grid
   ├─→ game._spawnEnemy()   : TB.SPAWN_CELLS + pickEnemyType(weights)
   ├─→ entities.PlayerTank  : TB.CONFIG.PLAYER / TB.POWER_LEVELS
   ├─→ entities.EnemyTank   : TB.ENEMY_TYPES
   ├─→ game._applyItem()    : TB.ITEMS / TB.POWER_LEVELS / TB.ITEM_DURATION
   └─→ input / main         : TB.DEFAULT_KEYMAP / TB.KEYMAP_LABELS
```

本模块**无副作用**，不依赖任何其它模块，可在 Node 中独立 `require` 并测试（见 `tests/tank.test.js`）。

## 设计要点

- 所有「数值」与「关卡内容」外置为数据，便于平衡性与扩展（加关卡只需追加 `TB.LEVELS` 项）。
- `normalizeMap` 提供容错，保证即便地图字符串书写不全也不会导致运行期越界。
