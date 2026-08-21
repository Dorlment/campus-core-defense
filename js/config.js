/* ============================================================
   坦克大战 · 全局配置与数据（数据驱动）
   ============================================================ */
window.TB = window.TB || {};

TB.CONFIG = {
  GRID: 13,            // 战场格子数（13 x 13，正方形）
  CELL: 40,            // 每格逻辑像素
  get FIELD() { return this.GRID * this.CELL; }, // 520

  // 玩家参数
  PLAYER: {
    speed: 96,         // px/s
    lives: 3,
    respawnInvincible: 1600, // 重生无敌 ms
    spawnCell: { r: 12, c: 4 },
  },

  // 子弹参数
  BULLET: {
    speed: 300,
    size: 8,
  },

  // 连击窗口
  COMBO_WINDOW: 2000,

  // 道具掉落概率（每次击毁）
  ITEM_DROP_CHANCE: 0.22,
  ITEM_DURATION: { helmet: 8000, shovel: 12000, timer: 6000 },
};

/* 地形类型 */
TB.TILE = {
  EMPTY: 0,
  BRICK: 1,   // 可破坏砖墙
  STEEL: 2,   // 钢墙（需最高火力）
  WATER: 3,   // 阻挡坦克，不挡子弹
  GRASS: 4,   // 仅视觉遮蔽
  ICE:   5,   // 打滑
  BASE:  6,   // 基地（老鹰）
};

/* 地形阻挡坦克移动？ */
TB.solidForTank = function (t) {
  return t === TB.TILE.BRICK || t === TB.TILE.STEEL ||
         t === TB.TILE.WATER || t === TB.TILE.BASE;
};

/* 敌人类型定义 */
TB.ENEMY_TYPES = {
  basic: { key: 'basic', name: '普通', score: 100, speed: 70,  hp: 1, shoot: 1600, color: '#c9ccd4', chase: 0 },
  fast:  { key: 'fast',  name: '快速', score: 200, speed: 122, hp: 1, shoot: 2000, color: '#7fc6d9', chase: 0 },
  armor: { key: 'armor', name: '装甲', score: 300, speed: 52,  hp: 3, shoot: 1400, color: '#b07a45', chase: 0 },
  smart: { key: 'smart', name: '智能', score: 400, speed: 88,  hp: 1, shoot: 1100, color: '#e2554b', chase: 1 },
};

/* 道具定义 */
TB.ITEMS = {
  star:   { key: 'star',   name: '火力升级', color: '#f0a83c' },
  helmet: { key: 'helmet', name: '无敌护盾', color: '#cdd2db' },
  shovel: { key: 'shovel', name: '强化基地', color: '#b07a45' },
  timer:  { key: 'timer',  name: '冻结敌军', color: '#d9b24a' },
  bomb:   { key: 'bomb',   name: '全屏清除', color: '#e2554b' },
  tank:   { key: 'tank',   name: '奖励生命', color: '#6fcf6f' },
};
TB.ITEM_KEYS = ['star', 'helmet', 'shovel', 'timer', 'bomb', 'tank'];

/* 玩家火力等级效果（star 拾取累加，上限 3） */
TB.POWER_LEVELS = [
  { maxBullets: 1, bulletSpeed: 300, breakSteel: false },
  { maxBullets: 1, bulletSpeed: 360, breakSteel: false },
  { maxBullets: 2, bulletSpeed: 360, breakSteel: false },
  { maxBullets: 2, bulletSpeed: 420, breakSteel: true  },
];

/* 默认按键映射 */
TB.DEFAULT_KEYMAP = {
  up:     ['ArrowUp'],
  down:   ['ArrowDown'],
  left:   ['ArrowLeft'],
  right:  ['ArrowRight'],
  fire:   ['Space', 'KeyJ'],
  pause:  ['KeyP', 'Escape'],
  confirm:['Enter'],
  restart:['KeyR'],
};
TB.KEYMAP_LABELS = {
  up: '上移', down: '下移', left: '左移', right: '右移',
  fire: '射击', pause: '暂停', confirm: '确认', restart: '重开',
};

/* 地图字符 -> 地形 */
TB.MAP_CHARS = {
  '.': TB.TILE.EMPTY,
  'B': TB.TILE.BRICK,
  'S': TB.TILE.STEEL,
  'W': TB.TILE.WATER,
  'G': TB.TILE.GRASS,
  'I': TB.TILE.ICE,
  'E': TB.TILE.BASE,
};

/* 关卡地图（13 x 13 字符，'E' 为基地老鹰）
   基地固定位于底部中央，四周由砖墙保护。 */
TB.LEVELS = [
  {
    name: 'STAGE 1',
    enemyTotal: 12,
    maxOnScreen: 4,
    spawnInterval: 2500,
    speedMul: 1.0,
    weights: { basic: 0.7, fast: 0.2, armor: 0.1, smart: 0 },
    map: [
      ".............",
      "..B.B...B.B..",
      "..B.B...B.B..",
      ".............",
      ".SS.......SS.",
      "....B.B.B....",
      ".....B.B.....",
      "....B.B.B....",
      ".BB.......BB.",
      ".............",
      "..B.......B..",
      ".....BBB.....",
      ".....BEB.....",
    ],
  },
  {
    name: 'STAGE 2',
    enemyTotal: 16,
    maxOnScreen: 4,
    spawnInterval: 2000,
    speedMul: 1.15,
    weights: { basic: 0.45, fast: 0.3, armor: 0.15, smart: 0.1 },
    map: [
      "..G.G.G.G.G..",
      ".B.B.B.B.B.B.",
      "..S.....S....",
      ".B.B.B.B.B.B.",
      "....W.W.W....",
      "BB.B.I.I.B.BB",
      "....W.W.W....",
      "S.B.B.B.B.B.S",
      "....I.I.I....",
      ".B.B.B.B.B.B.",
      "..S.....S....",
      ".....BBB.....",
      ".....BEB.....",
    ],
  },
  {
    name: 'STAGE 3',
    enemyTotal: 20,
    maxOnScreen: 5,
    spawnInterval: 1500,
    speedMul: 1.3,
    weights: { basic: 0.3, fast: 0.3, armor: 0.2, smart: 0.2 },
    map: [
      "..S.S...S.S..",
      ".B.W.B.W.B.W.",
      "S.S.S.S.S.S.S",
      ".W.B.G.B.W.B.",
      "S.S.S.S.S.S.S",
      ".B.W.B.W.B.W.",
      "GG.B.I.I.B.GG",
      ".W.B.B.B.W.B.",
      "S.S.S.S.S.S.S",
      ".B.W.B.W.B.W.",
      "S.S.S.S.S.S.S",
      ".....BBB.....",
      ".....BEB.....",
    ],
  },
];

/* 敌人刷新点（顶部行，列坐标） */
TB.SPAWN_CELLS = [ { r: 0, c: 0 }, { r: 0, c: 6 }, { r: 0, c: 12 } ];

/* 把字符地图规范化为 13x13 数字网格（自动补空/截断，防止越界崩溃） */
TB.normalizeMap = function (rows) {
  const G = TB.CONFIG.GRID;
  const grid = [];
  for (let r = 0; r < G; r++) {
    const line = rows[r] || '';
    const row = [];
    for (let c = 0; c < G; c++) {
      const ch = line[c] || '.';
      row.push(TB.MAP_CHARS[ch] !== undefined ? TB.MAP_CHARS[ch] : TB.TILE.EMPTY);
    }
    grid.push(row);
  }
  return grid;
};

/* 工具：按权重抽取敌人类型 */
TB.pickEnemyType = function (weights) {
  const r = Math.random();
  let acc = 0;
  for (const k in weights) {
    acc += weights[k];
    if (r <= acc) return k;
  }
  return 'basic';
};
