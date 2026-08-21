# 模块：实体与碰撞对象（`js/entities.js`）

## 职责

定义游戏世界中的实体类型与它们的**向量绘制**（手绘风格，无 emoji、无外部图片），并持有各自的纯数据状态。实体的**移动与碰撞不在此模块解析**——它们通过引擎传入的 `world` 上下文（`resolveMove` / `spawnBullet` / `tileAt` 等）与引擎协作，从而保证碰撞逻辑单一可测。

挂载：`window.TB`（各类挂在 `TB.Tank` / `TB.PlayerTank` / `TB.EnemyTank` / `TB.Bullet` / `TB.Item`，以及工具 `TB.DIRS` / `TB.shade` / `TB.roundRect`）。

## 关键类与字段

### `TB.Tank`（基类）
- 字段：`x,y,size(28),dir(0上/1右/2下/3左),color,team,alive,moving,shield,_blink`。
- 只读：`cx`/`cy`（中心坐标）。
- `draw(ctx)`：车体 + 履带 + 炮塔 + 炮管 + 护盾环（纯 Canvas 矢量）。

### `TB.PlayerTank extends Tank`
- 构造函数设 `speed = TB.CONFIG.PLAYER.speed`、`powerLevel=0`、`fireCd=0`、`invincibleUntil=0`。
- `update(dt, input, world)`：
  - 依据 `input.dir` 设朝向并调用 `world.resolveMove` 移动；站在冰面(`world.tileAt===ICE`)时即便无输入也打滑移动。
  - 射击：`input.fire && fireCd<=0 && countBullets('player') < POWER_LEVELS[powerLevel].maxBullets` → `world.spawnBullet(this)`，`fireCd=280ms`。
  - 护盾由 `world.playerShieldUntil` 决定；重生无敌由 `invincibleUntil` 决定（闪烁表现）。

### `TB.EnemyTank extends Tank`
- 构造：`def = TB.ENEMY_TYPES[typeKey]`；继承 `speed=def.speed`、`type=def`、`hp=def.hp`、`spawnAnim=600`（出生动画期间不可动/不可被击）。
- `update(dt, world, player)`：
  - `spawnAnim>0` 时仅倒计时，不行动。
  - `world.now < world.enemyFrozenUntil` 时冻结（timer 道具）。
  - `aiTimer<=0`：智能型(`chase=1`)按玩家相对位置追向，否则随机选向。
  - 撞墙检测：若本帧未移动则 `aiTimer=0` 下一帧换向。
  - `shootTimer<=0`：`world.spawnBullet(this)`。

### `TB.Bullet`
- 字段：`x,y,size(8),dir,owner('player'|'enemy'),speed,power(2=可破钢),alive`。
- `update(dt)`：按 `TB.DIRS[dir]` 以 `speed*dt` 平移。
- 命中判定在 `game._updateBullet` 中完成（地形/坦克/互撞）。

### `TB.Item`
- 由 `typeKey` + 网格 `(r,c)` 构造，居中落格；`born=performance.now()` 用于闪烁。
- `draw(ctx)`：手绘矢量字形对应 6 类道具（星/盔/铲/钟/雷/十字），无 emoji。

## 工具函数
- `TB.DIRS`：四方向单位向量 `[{dx,dy}]`。
- `TB.shade(hex, amt)`：hex 颜色明暗调整，3 位简写自动展开，分量钳制到 [0,255]。
- `TB.roundRect(ctx,x,y,w,h,r)`：圆角矩形路径（供各实体复用）。

## 数据流

```
game.prepareLevel ──→ new PlayerTank(spawnCell)
game._spawnEnemy  ──→ new EnemyTank(cell, typeKey)   ← 用 config.ENEMY_TYPES
game.spawnBullet  ──→ new Bullet(muzzle, dir, owner, {speed,power})
game._enemyKilled ──→ new Item(typeKey, r, c)        ← 按 ITEM_DROP_CHANCE
        │
        ▼ 每帧
entity.update(dt, input, world)
        │  内部回调
        ├─ world.resolveMove(this, dx, dy, dt)   → 碰撞解析后的坐标
        ├─ world.tileAt(cx, cy)                 → 当前地形（冰面判定）
        ├─ world.spawnBullet(this)              → 生成子弹
        └─ world.countBullets('player')         → 火力上限判定
        │
        ▼ 绘制
entity.draw(ctx)  ←─ game.render() 统一调用
```

## 设计要点

- **数据与绘制同体、碰撞在下层**：实体不读取全局网格，碰撞权威在 `game`，便于在 Node 中对 `resolveMove`/`_updateBullet` 单独测试（测试桩只需提供 `world` 方法）。
- **出生动画 `spawnAnim`**：防止敌人刚生成即被秒杀，也避免与玩家重叠。
- **护盾/无敌状态来自 `world`**：实体自身不持有全局计时，渲染时从 `world` 读取，状态一致且易重置。
