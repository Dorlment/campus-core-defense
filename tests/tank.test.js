/* ============================================================
   坦克大战 · 单元测试（Node 内置 node:test）
   覆盖：配置/数据校验、实体与碰撞、引擎核心逻辑
   通过轻量 DOM 桩在 Node 中真实加载源码模块。
   ============================================================ */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

/* ---------------- 环境桩 ---------------- */
function makeCtx() {
  // 任意方法均为 no-op，属性可写；足够让渲染相关调用不报错
  return new Proxy({}, {
    get: (t, p) => (p in t ? t[p] : () => {}),
    set: (t, p, v) => { t[p] = v; return true; },
  });
}
const store = new Map();
global.window = global;
global.performance = { now: () => Date.now() };
global.devicePixelRatio = 1;
global.addEventListener = () => {};
global.requestAnimationFrame = () => 0; // 不自动驱动主循环
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

/* 加载源码（普通脚本，挂到全局 TB） */
require('../js/config.js');
require('../js/entities.js');
require('../js/game.js');
const TB = global.TB;

/* ---------------- 测试夹具 ---------------- */
function makeGame() {
  const canvas = { width: 0, height: 0, getContext: () => makeCtx() };
  const audio = {
    play() {}, unlock() {}, setMusic() {}, setSfx() {}, setVolume() {},
  };
  const input = {
    dir: { up: false, down: false, left: false, right: false },
    fire: false,
    reset() {},
    state: {},
  };
  return new TB.Game(canvas, audio, input);
}

/* ============================================================
   1. 配置与数据校验
   ============================================================ */
test('config: 每个关卡地图为 13x13 且恰有一个基地', () => {
  TB.LEVELS.forEach((lv, i) => {
    assert.strictEqual(lv.map.length, 13, `Level${i + 1} 行数`);
    lv.map.forEach((row, r) =>
      assert.strictEqual(row.length, 13, `Level${i + 1} 行${r} 列数`));
    const bases = lv.map.join('').split('').filter((c) => c === 'E').length;
    assert.strictEqual(bases, 1, `Level${i + 1} 基地数量`);
  });
});

test('config: FIELD 为 GRID*CELL = 520', () => {
  assert.strictEqual(TB.CONFIG.FIELD, 520);
  assert.strictEqual(TB.CONFIG.GRID * TB.CONFIG.CELL, 520);
});

test('config: solidForTank 仅砖/钢/水/基地阻挡', () => {
  const T = TB.TILE;
  assert.ok(TB.solidForTank(T.BRICK));
  assert.ok(TB.solidForTank(T.STEEL));
  assert.ok(TB.solidForTank(T.WATER));
  assert.ok(TB.solidForTank(T.BASE));
  assert.ok(!TB.solidForTank(T.EMPTY));
  assert.ok(!TB.solidForTank(T.GRASS));
  assert.ok(!TB.solidForTank(T.ICE));
});

test('config: 敌人定义分数/血量正确', () => {
  assert.strictEqual(TB.ENEMY_TYPES.basic.score, 100);
  assert.strictEqual(TB.ENEMY_TYPES.fast.score, 200);
  assert.strictEqual(TB.ENEMY_TYPES.armor.score, 300);
  assert.strictEqual(TB.ENEMY_TYPES.smart.score, 400);
  assert.strictEqual(TB.ENEMY_TYPES.armor.hp, 3);
  assert.strictEqual(TB.ENEMY_TYPES.smart.chase, 1);
});

test('config: 火力等级上限为 3 且最高级可破钢', () => {
  assert.strictEqual(TB.POWER_LEVELS.length, 4);
  assert.strictEqual(TB.POWER_LEVELS[3].breakSteel, true);
  assert.strictEqual(TB.POWER_LEVELS[0].breakSteel, false);
});

test('config: normalizeMap 映射字符并补齐/截断越界', () => {
  const g = TB.normalizeMap(['B', '..S']);
  assert.strictEqual(g.length, 13);
  g.forEach((row) => assert.strictEqual(row.length, 13));
  assert.strictEqual(g[0][0], TB.TILE.BRICK);
  assert.strictEqual(g[0][1], TB.TILE.EMPTY);
  // 第 1 行 '..S' -> 第 2 列钢，其余空
  assert.strictEqual(g[1][2], TB.TILE.STEEL);
  assert.strictEqual(g[1][0], TB.TILE.EMPTY);
  // 未知字符降级为空
  const g2 = TB.normalizeMap(['Z']);
  assert.strictEqual(g2[0][0], TB.TILE.EMPTY);
});

test('config: pickEnemyType 仅在权重键内且遵守零权重', () => {
  const w = TB.LEVELS[0].weights; // smart: 0
  const keys = new Set();
  for (let i = 0; i < 600; i++) {
    const k = TB.pickEnemyType(w);
    assert.ok(TB.ENEMY_TYPES[k], `返回合法类型: ${k}`);
    keys.add(k);
  }
  assert.ok(!keys.has('smart'), 'smart 权重为 0，不应被抽中');
});

/* ============================================================
   2. 实体与碰撞
   ============================================================ */
test('entities: Bullet 按方向以 speed*dt 移动', () => {
  const b = new TB.Bullet(100, 100, 1, 'player', { speed: 300 }); // 向右
  b.update(0.1);
  assert.ok(Math.abs(b.x - (100 + 300 * 0.1)) < 1e-6);
  assert.strictEqual(b.y, 100);
  const b2 = new TB.Bullet(100, 100, 0, 'enemy', { speed: 200 }); // 向上
  b2.update(0.5);
  assert.ok(Math.abs(b2.y - (100 - 200 * 0.5)) < 1e-6);
});

test('entities: EnemyTank 正确继承类型速度/分数', () => {
  const e = new TB.EnemyTank(0, 0, 'armor');
  assert.strictEqual(e.speed, TB.ENEMY_TYPES.armor.speed);
  assert.strictEqual(e.type.score, 300);
  assert.strictEqual(e.hp, 3);
  const s = new TB.EnemyTank(0, 0, 'smart');
  assert.strictEqual(s.speed, TB.ENEMY_TYPES.smart.speed);
});

test('entities: shade 解析 hex 并对越界值钳制', () => {
  assert.strictEqual(TB.shade('#c9ccd4', 0), 'rgb(201,204,212)');
  assert.strictEqual(TB.shade('#ffffff', 10), 'rgb(255,255,255)');
  assert.strictEqual(TB.shade('#000000', -10), 'rgb(0,0,0)');
  assert.strictEqual(TB.shade('#fff', 0), 'rgb(255,255,255)'); // 3 位展开
});

test('game: tileAt 越界返回 -1，正常返回地形', () => {
  const g = makeGame();
  assert.strictEqual(g.tileAt(-5, -5), -1);
  assert.strictEqual(g.tileAt(1000, 1000), -1);
  // 关卡 1 行1 列2 为砖(来自 "..B.B...") -> 像素 (80,40)
  assert.strictEqual(g.tileAt(80, 40), TB.TILE.BRICK);
  assert.strictEqual(g.tileAt(4, 4), TB.TILE.EMPTY);
});

test('game: boxHitsSolid 识别钢墙/砖墙与越界', () => {
  const g = makeGame();
  assert.strictEqual(g.boxHitsSolid(0, 0, 28), false); // 左上角空地
  assert.strictEqual(g.boxHitsSolid(-10, 0, 28), true); // 越界
  assert.strictEqual(g.boxHitsSolid(0, 1000, 28), true); // 越界
  // 砖墙在 (1,2) -> 像素 80,40
  assert.strictEqual(g.boxHitsSolid(80, 40, 28), true);
  assert.strictEqual(g.boxHitsSolid(200, 200, 28), false); // 空地
});

test('game: resolveMove 不会让坦克越出战场', () => {
  const g = makeGame();
  const p = g.player;
  p.x = 0; p.y = 0;
  g.resolveMove(p, 1000, 0, 1); // 向右猛冲，单步即判定出界 -> 整体拦截
  assert.ok(p.x + p.size <= TB.CONFIG.FIELD, '右缘不越界');
  assert.ok(p.x >= 0, '不越左界');
  assert.strictEqual(p.y, 6); // 沿格对齐到行 0 中心偏移
  // 钳制安全网：直接置于界外也应被拉回
  p.x = 9999; g.resolveMove(p, 0, 0, 1);
  assert.strictEqual(p.x, TB.CONFIG.FIELD - p.size); // 492
  p.x = -50; g.resolveMove(p, 0, 0, 1);
  assert.strictEqual(p.x, 0);
});

test('game: resolveMove 被钢墙阻挡不前移', () => {
  const g = makeGame();
  const p = g.player;
  // 在第 6 行第 1 列放钢墙，玩家置于第 0 列右边界(x=12, 右缘=40)
  g.grid[6][1] = TB.TILE.STEEL;
  p.x = 12; p.y = 6 * TB.CONFIG.CELL + (TB.CONFIG.CELL - p.size) / 2; // 246
  g.resolveMove(p, 5, 0, 1);
  assert.strictEqual(p.x, 12); // 未越过进入钢墙列
  assert.ok(p.x + p.size <= 40); // 右缘仍在第 0 列内
});

/* ============================================================
   3. 引擎核心逻辑
   ============================================================ */
test('engine: 构造后为菜单态且关卡数据就绪', () => {
  const g = makeGame();
  assert.strictEqual(g.state, 'menu');
  assert.ok(g.player);
  assert.strictEqual(g.basePos.r, 12);
  assert.strictEqual(g.basePos.c, 6);
  assert.strictEqual(g.toSpawn, TB.LEVELS[0].enemyTotal);
});

test('engine: 状态机 start->pause->resume', () => {
  const g = makeGame();
  g.startGame();
  assert.strictEqual(g.state, 'playing');
  assert.strictEqual(g.score, 0);
  assert.strictEqual(g.lives, TB.CONFIG.PLAYER.lives);
  g.pause();
  assert.strictEqual(g.state, 'paused');
  g.resume();
  assert.strictEqual(g.state, 'playing');
});

test('engine: 关卡过场 -> advanceLevel 进入下一关', () => {
  const g = makeGame();
  g.prepareLevel(0);
  g.toSpawn = 0; g.enemies = []; g.player.alive = true;
  g._levelClear();
  assert.strictEqual(g.state, 'paused');
  assert.strictEqual(g._levelTransition, true);
  assert.strictEqual(g._pendingNextLevel, 1);
  g.advanceLevel();
  assert.strictEqual(g.state, 'playing');
  assert.strictEqual(g.levelIndex, 1);
  assert.strictEqual(g._levelTransition, false);
});

test('engine: 最后一关清空敌人则胜利', () => {
  const g = makeGame();
  g.prepareLevel(TB.LEVELS.length - 1);
  g.toSpawn = 0; g.enemies = []; g.player.alive = true;
  g._levelClear();
  assert.strictEqual(g.state, 'win');
});

test('engine: 计分含连击倍率且封顶 x4', () => {
  const g = makeGame();
  g.score = 0; g.comboCount = 0;
  const mk = () => {
    const e = new TB.EnemyTank(0, 0, 'basic'); e.spawnAnim = 0; return e;
  };
  g._enemyKilled(mk()); // 100 * 1
  assert.strictEqual(g.score, 100);
  g._enemyKilled(mk()); // 100 * 2
  assert.strictEqual(g.score, 300);
  g._enemyKilled(mk()); // 100 * 3
  assert.strictEqual(g.score, 600);
  g._enemyKilled(mk()); // 100 * 4
  assert.strictEqual(g.score, 1000);
  g._enemyKilled(mk()); // 100 * 4 (封顶)
  assert.strictEqual(g.score, 1400);
  assert.strictEqual(g.comboCount, 5);
});

test('engine: 子弹击碎砖墙 / 钢墙依赖火力', () => {
  const g = makeGame();
  // 砖墙
  g.grid[5][5] = TB.TILE.BRICK;
  const b1 = new TB.Bullet(5 * 40, 5 * 40, 0, 'player', { power: 1 });
  g._updateBullet(b1, 0);
  assert.strictEqual(b1.alive, false);
  assert.strictEqual(g.grid[5][5], TB.TILE.EMPTY);

  // 钢墙：普通火力不破，最高火力可破
  g.grid[5][5] = TB.TILE.STEEL;
  const b2 = new TB.Bullet(5 * 40, 5 * 40, 0, 'player', { power: 1 });
  g._updateBullet(b2, 0);
  assert.strictEqual(g.grid[5][5], TB.TILE.STEEL); // 仍在
  const b3 = new TB.Bullet(5 * 40, 5 * 40, 0, 'player', { power: 2 });
  g._updateBullet(b3, 0);
  assert.strictEqual(g.grid[5][5], TB.TILE.EMPTY); // 被破
});

test('engine: 敌方子弹摧毁基地 -> 游戏结束', () => {
  const g = makeGame();
  g.prepareLevel(0); // 基地在 (12,6)
  const bp = g.basePos;
  const b = new TB.Bullet(bp.c * 40, bp.r * 40, 0, 'enemy', { power: 1 });
  g._updateBullet(b, 0);
  assert.strictEqual(g.state, 'over');
  assert.strictEqual(g.grid[bp.r][bp.c], TB.TILE.EMPTY);
});

test('engine: 玩家子弹命中坦克按血量削减（装甲需 3 击）', () => {
  const g = makeGame();
  g.score = 0;
  const armor = new TB.EnemyTank(200, 200, 'armor');
  armor.spawnAnim = 0;
  g.enemies = [armor];
  const hit = () => {
    const b = new TB.Bullet(armor.x, armor.y, 0, 'player', { power: 1 });
    g._updateBullet(b, 0);
  };
  hit();
  assert.strictEqual(armor.hp, 2);
  assert.strictEqual(armor.alive, true);
  hit();
  assert.strictEqual(armor.hp, 1);
  hit();
  assert.strictEqual(armor.alive, false);
  assert.strictEqual(g.score, 300); // 击杀计分
});

test('engine: 道具效果 - 星形火力升级并封顶', () => {
  const g = makeGame();
  g.player.powerLevel = 0;
  g._applyItem('star'); assert.strictEqual(g.player.powerLevel, 1);
  g._applyItem('star'); assert.strictEqual(g.player.powerLevel, 2);
  g._applyItem('star'); assert.strictEqual(g.player.powerLevel, 3);
  g._applyItem('star'); assert.strictEqual(g.player.powerLevel, 3); // 封顶
});

test('engine: 道具效果 - 头盔/定时器/加命', () => {
  const g = makeGame();
  g._applyItem('helmet');
  assert.ok(g.playerShieldUntil > g.now);
  g._applyItem('timer');
  assert.ok(g.enemyFrozenUntil > g.now);
  g.lives = 3; g._applyItem('tank');
  assert.strictEqual(g.lives, 4);
  g.lives = 5; g._applyItem('tank');
  assert.strictEqual(g.lives, 5); // 封顶
});

test('engine: 道具效果 - 铲子把基地砖转钢，超时还原', () => {
  const g = makeGame();
  g.prepareLevel(0);
  g._activateShovel();
  // 基地上方一格应为钢
  const b = g.basePos;
  assert.strictEqual(g.grid[b.r - 1][b.c], TB.TILE.STEEL);
  assert.strictEqual(g._shovelCells.length, 5);
  assert.ok(g.shovelUntil > g.now);
  // 直接验证还原逻辑
  g._revertShovel();
  assert.strictEqual(g.grid[b.r - 1][b.c], TB.TILE.BRICK);
  assert.strictEqual(g._shovelCells.length, 0);
});

test('engine: 道具效果 - 手雷清场并按分计奖', () => {
  const g = makeGame();
  g.score = 0;
  const e1 = new TB.EnemyTank(100, 100, 'basic'); e1.spawnAnim = 0;
  const e2 = new TB.EnemyTank(200, 200, 'fast'); e2.spawnAnim = 0;
  g.enemies = [e1, e2];
  g._applyItem('bomb');
  assert.ok(!e1.alive && !e2.alive);
  assert.strictEqual(g.score, 100 + 200);
});

test('engine: 玩家受击 - 无敌/护盾免疫，命数耗尽则结束', () => {
  const g = makeGame();
  // 普通受击（仍有命数 -> 立即重生且带无敌）
  g.player.invincibleUntil = 0; g.playerShieldUntil = 0;
  g.lives = 3;
  g._playerHit();
  assert.strictEqual(g.lives, 2);
  assert.strictEqual(g.player.alive, true); // 重生
  assert.ok(g.player.invincibleUntil > g.now, '重生后短暂无敌');
  // 护盾免疫
  g.player.invincibleUntil = 0;
  g.playerShieldUntil = g.now + 1000;
  const before = g.lives;
  g._playerHit();
  assert.strictEqual(g.lives, before);
  assert.strictEqual(g.player.alive, true);
  // 命数耗尽 -> over（不再重生）
  g.playerShieldUntil = 0; g.lives = 1;
  g._playerHit();
  assert.strictEqual(g.state, 'over');
  assert.strictEqual(g.player.alive, false);
});

test('engine: 敌人生成递减 toSpawn 并受同屏上限外的逻辑', () => {
  const g = makeGame();
  g.prepareLevel(0);
  g.toSpawn = 3; g.enemies = [];
  g._spawnEnemy();
  assert.strictEqual(g.toSpawn, 2);
  assert.strictEqual(g.enemies.length, 1);
  assert.strictEqual(g.enemies[0].alive, true);
  g._spawnEnemy();
  assert.strictEqual(g.toSpawn, 1);
  assert.strictEqual(g.enemies.length, 2);
});

test('engine: saveHighScore 仅在新纪录时更新并返回布尔', () => {
  const g = makeGame();
  g.highScore = 0; g.score = 150;
  assert.strictEqual(g.saveHighScore(), true);
  assert.strictEqual(g.highScore, 150);
  g.score = 100;
  assert.strictEqual(g.saveHighScore(), false);
  assert.strictEqual(g.highScore, 150);
});
