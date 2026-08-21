/* ============================================================
   校园核心防线 · 核心引擎（状态机 / 主循环 / 碰撞 / 渲染）
   ============================================================ */
window.TB = window.TB || {};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rectsOverlap = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
const CAMPUS_TANK_COLORS = {
  player: '#5ee7f7',
  basic: '#d5def2',
  fast: '#6fa8ff',
  armor: '#a981f7',
  smart: '#f05fae',
};

TB.Game = class {
  constructor(canvas, audio, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.input = input;
    this.dpr = 1;
    this.C = TB.CONFIG;
    this.FIELD = this.C.FIELD;

    this.state = 'menu';        // menu | playing | paused | over | win
    this._levelTransition = false;
    this._pendingNextLevel = null;
    this.grid = [];
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.items = [];
    this.particles = [];
    this.basePos = null;

    this.score = 0;
    this.kills = 0;
    this.elapsedTime = 0;
    this.energy = 0;
    this.maxEnergy = this.C.EMP.maxEnergy;
    this.lives = this.C.PLAYER.lives;
    this.levelIndex = 0;
    this.level = null;

    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.enemyFrozenUntil = 0;
    this.playerShieldUntil = 0;
    this.shovelUntil = 0;
    this._shovelCells = [];
    this.comboCount = 0;
    this.lastKillAt = 0;
    this.empEffectStartedAt = null;
    this.empEffectOrigin = null;

    this.now = performance.now();
    this.lastTs = this.now;
    this.shake = 0;
    this.quality = 'high';
    this.onEvent = null;         // (evt) => {}

    this.highScore = 0;
    this.config = { musicOn: true, sfxOn: true, volume: 70, quality: 'high', keymap: null };

    this._loadStorage();
    this.setupCanvas();
    window.addEventListener('resize', () => this.setupCanvas());

    this.prepareLevel(0);
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  /* ---------------- 存储 ---------------- */
  _storageGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  _storageSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式兜底 */ }
  }
  _loadStorage() {
    this.highScore = this._storageGet('tankbattle.highscore', 0) || 0;
    const cfg = this._storageGet('tankbattle.config', null);
    if (cfg) {
      this.config = Object.assign(this.config, cfg);
      this.config.keymap = Object.assign({}, TB.DEFAULT_KEYMAP, this.config.keymap || {});
    } else {
      this.config.keymap = TB.DEFAULT_KEYMAP;
    }
    this.quality = this.config.quality || 'high';
  }
  saveConfig() {
    this.config.quality = this.quality;
    this._storageSet('tankbattle.config', this.config);
  }
  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._storageSet('tankbattle.highscore', this.highScore);
      return true;
    }
    return false;
  }

  /* ---------------- 画布 ---------------- */
  setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.canvas.width = this.FIELD * dpr;
    this.canvas.height = this.FIELD * dpr;
  }

  /* ---------------- 关卡 ---------------- */
  prepareLevel(idx) {
    this.levelIndex = idx;
    this.level = TB.LEVELS[idx];
    this.grid = TB.normalizeMap(this.level.map);
    // 记录基地位置
    this.basePos = null;
    for (let r = 0; r < this.C.GRID; r++)
      for (let c = 0; c < this.C.GRID; c++)
        if (this.grid[r][c] === TB.TILE.BASE) this.basePos = { r, c };

    this.enemies = [];
    this.bullets = [];
    this.items = [];
    this.particles = [];
    this.toSpawn = this.level.enemyTotal;
    this.spawnTimer = 800;
    this.enemyFrozenUntil = 0;
    this.playerShieldUntil = 0;
    this.shovelUntil = 0;

    this._spawnPlayer(true);
  }

  _spawnPlayer(idle) {
    const sc = this.C.PLAYER.spawnCell;
    const x = sc.c * this.C.CELL + (this.C.CELL - 28) / 2;
    const y = sc.r * this.C.CELL + (this.C.CELL - 28) / 2;
    if (!this.player) {
      this.player = new TB.PlayerTank(x, y);
    } else {
      this.player.x = x; this.player.y = y; this.player.dir = 0;
      this.player.alive = true; this.player.powerLevel = this.player.powerLevel || 0;
    }
    this.player.color = CAMPUS_TANK_COLORS.player;
    this.player.invincibleUntil = this.now + (idle ? 0 : this.C.PLAYER.respawnInvincible);
  }

  startGame() {
    if (this.state === 'playing') return;
    this.score = 0;
    this.kills = 0;
    this.elapsedTime = 0;
    this.energy = 0;
    this.lives = this.C.PLAYER.lives;
    this.comboCount = 0;
    this.empEffectStartedAt = null;
    this.empEffectOrigin = null;
    this._levelTransition = false;
    this._pendingNextLevel = null;
    if (this.player) this.player.powerLevel = 0;
    this.prepareLevel(0);
    this.state = 'playing';
    this.audio.unlock();
    this._emit({ type: 'banner', text: this.level.name });
    this._emitState();
  }

  startLevel(idx) {
    this._levelTransition = false;
    this._pendingNextLevel = null;
    this.prepareLevel(idx);
    this.state = 'playing';
    this._emit({ type: 'banner', text: this.level.name });
    this._emitState();
  }

  /* ---------------- 主循环 ---------------- */
  _loop(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000) || 0;
    this.lastTs = ts;
    this.now = ts;
    if (this.state === 'playing') this.update(dt);
    this.render();
    this._emitHud();
    requestAnimationFrame(this._loop);
  }

  update(dt) {
    if (this.state === 'playing') this.elapsedTime += dt * 1000;

    // 道具计时
    if (this.shovelUntil && this.now > this.shovelUntil) {
      this._revertShovel();
      this.shovelUntil = 0;
    }

    // 玩家
    if (this.player && this.player.alive) this.player.update(dt, this.input, this);

    // 敌人生成
    if (this.toSpawn > 0) {
      this.spawnTimer -= dt * 1000;
      const active = this.enemies.filter((e) => e.alive).length;
      if (this.spawnTimer <= 0 && active < this.level.maxOnScreen) {
        this._spawnEnemy();
        this.spawnTimer = this.level.spawnInterval;
      }
    }

    // 敌人
    for (const e of this.enemies) e.update(dt, this, this.player);

    // 子弹
    for (const b of this.bullets) if (b.alive) this._updateBullet(b, dt);

    // 道具拾取
    for (const it of this.items) {
      if (!it.alive) continue;
      if (this.player && this.player.alive &&
          rectsOverlap(it.x, it.y, it.size, it.size, this.player.x, this.player.y, this.player.size, this.player.size)) {
        it.alive = false;
        this._applyItem(it.typeKey);
      }
    }

    // 粒子
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // 清理
    this.bullets = this.bullets.filter((b) => b.alive);
    this.enemies = this.enemies.filter((e) => e.alive);
    this.items = this.items.filter((i) => i.alive);

    // 震动衰减
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);

    // 过关判定
    const remaining = this.toSpawn + this.enemies.filter((e) => e.alive).length;
    if (remaining === 0 && this.player && this.player.alive) this._levelClear();
  }

  /* ---------------- 碰撞 / 移动 ---------------- */
  tileAt(px, py) {
    const c = Math.floor(px / this.C.CELL);
    const r = Math.floor(py / this.C.CELL);
    if (r < 0 || c < 0 || r >= this.C.GRID || c >= this.C.GRID) return -1;
    return this.grid[r][c];
  }

  boxHitsSolid(x, y, sz) {
    if (x < 0 || y < 0 || x + sz > this.FIELD || y + sz > this.FIELD) return true;
    const c0 = Math.floor(x / this.C.CELL);
    const c1 = Math.floor((x + sz - 0.001) / this.C.CELL);
    const r0 = Math.floor(y / this.C.CELL);
    const r1 = Math.floor((y + sz - 0.001) / this.C.CELL);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        if (r < 0 || c < 0 || r >= this.C.GRID || c >= this.C.GRID) return true;
        if (TB.solidForTank(this.grid[r][c])) return true;
      }
    return false;
  }

  resolveMove(ent, dx, dy, dt) {
    const sz = ent.size, C = this.C.CELL;
    if (dx !== 0) {
      const nx = ent.x + dx;
      if (!this.boxHitsSolid(nx, ent.y, sz)) ent.x = nx;
      // 沿格对齐，方便进入通道
      const targetY = Math.round((ent.y - (C - sz) / 2) / C) * C + (C - sz) / 2;
      if (!this.boxHitsSolid(ent.x, targetY, sz)) {
        const diff = targetY - ent.y;
        ent.y += Math.sign(diff) * Math.min(Math.abs(diff), ent.speed * dt);
      }
    }
    if (dy !== 0) {
      const ny = ent.y + dy;
      if (!this.boxHitsSolid(ent.x, ny, sz)) ent.y = ny;
      const targetX = Math.round((ent.x - (C - sz) / 2) / C) * C + (C - sz) / 2;
      if (!this.boxHitsSolid(targetX, ent.y, sz)) {
        const diff = targetX - ent.x;
        ent.x += Math.sign(diff) * Math.min(Math.abs(diff), ent.speed * dt);
      }
    }
    ent.x = clamp(ent.x, 0, this.FIELD - sz);
    ent.y = clamp(ent.y, 0, this.FIELD - sz);
  }

  countBullets(owner) {
    let n = 0;
    for (const b of this.bullets) if (b.alive && b.owner === owner) n++;
    return n;
  }

  spawnBullet(tank) {
    const d = TB.DIRS[tank.dir];
    const bs = this.C.BULLET.size;
    const mx = tank.cx + d.dx * (tank.size / 2);
    const my = tank.cy + d.dy * (tank.size / 2);
    let speed, power;
    if (tank.team === 'player') {
      const pl = TB.POWER_LEVELS[tank.powerLevel];
      speed = pl.bulletSpeed; power = pl.breakSteel ? 2 : 1;
    } else { speed = 260; power = 1; }
    this.bullets.push(new TB.Bullet(mx - bs / 2, my - bs / 2, tank.dir, tank.team, { speed, power }));
    if (tank.team === 'player') this.audio.play('shoot');
  }

  _updateBullet(b, dt) {
    b.update(dt);
    if (b.x < -10 || b.y < -10 || b.x > this.FIELD + 10 || b.y > this.FIELD + 10) { b.alive = false; return; }

    // 地形
    const cell = this.tileAt(b.cx, b.cy);
    if (cell === TB.TILE.BRICK) {
      this._setCellAt(b.cx, b.cy, TB.TILE.EMPTY);
      this._explode(b.cx, b.cy, '#b5562f', false);
      this.audio.play('hit'); b.alive = false; return;
    }
    if (cell === TB.TILE.STEEL) {
      if (b.owner === 'player' && b.power >= 2) this._setCellAt(b.cx, b.cy, TB.TILE.EMPTY);
      this._explode(b.cx, b.cy, '#9aa0ab', false);
      b.alive = false; return;
    }
    if (cell === TB.TILE.BASE) {
      if (b.owner === 'enemy') { this._baseDestroyed(); }
      b.alive = false; return;
    }

    // 子弹互撞
    for (const o of this.bullets) {
      if (o === b || !o.alive) continue;
      if (o.owner !== b.owner && rectsOverlap(b.x, b.y, b.size, b.size, o.x, o.y, o.size, o.size)) {
        o.alive = false; b.alive = false;
        this._explode((b.cx + o.cx) / 2, (b.cy + o.cy) / 2, '#b8f3ff', false);
        return;
      }
    }

    // 命中坦克
    if (b.owner === 'player') {
      for (const e of this.enemies) {
        if (!e.alive || e.spawnAnim > 0) continue;
        if (rectsOverlap(b.x, b.y, b.size, b.size, e.x + 2, e.y + 2, e.size - 4, e.size - 4)) {
          e.hp -= 1; b.alive = false;
          if (e.hp <= 0) this._enemyKilled(e);
          else { this._explode(b.cx, b.cy, '#b8f3ff', false); this.audio.play('hit'); }
          return;
        }
      }
    } else {
      const p = this.player;
      if (p && p.alive && rectsOverlap(b.x, b.y, b.size, b.size, p.x + 2, p.y + 2, p.size - 4, p.size - 4)) {
        b.alive = false; this._playerHit();
      }
    }
  }

  _setCellAt(px, py, val) {
    const c = Math.floor(px / this.C.CELL);
    const r = Math.floor(py / this.C.CELL);
    if (r < 0 || c < 0 || r >= this.C.GRID || c >= this.C.GRID) return;
    this.grid[r][c] = val;
  }

  /* ---------------- 敌人 ---------------- */
  _spawnEnemy() {
    const cells = TB.SPAWN_CELLS;
    // 找一个未被占据的刷新点
    let chosen = null;
    for (const cell of cells) {
      const x = cell.c * this.C.CELL + (this.C.CELL - 28) / 2;
      const y = cell.r * this.C.CELL + (this.C.CELL - 28) / 2;
      const occupied = this.enemies.some((e) => e.alive &&
        Math.abs(e.x - x) < this.C.CELL && Math.abs(e.y - y) < this.C.CELL);
      if (!occupied) { chosen = { x, y }; break; }
    }
    if (!chosen) return;
    const typeKey = TB.pickEnemyType(this.level.weights);
    const e = new TB.EnemyTank(chosen.x, chosen.y, typeKey);
    e.color = CAMPUS_TANK_COLORS[typeKey];
    this.enemies.push(e);
    this.toSpawn--;
    this._explode(chosen.x + 14, chosen.y + 14, '#67e8f9', false, 8);
    this.audio.play('spawn');
  }

  _enemyKilled(e) {
    if (!e.alive) return;
    e.alive = false;
    if (this.comboCount > 0 && this.now - this.lastKillAt > this.C.COMBO_WINDOW) {
      this.comboCount = 0;
    }
    const mult = Math.min(this.comboCount + 1, 4);
    const base = e.type.score;
    this.score += base * mult;
    this.comboCount++;
    this.lastKillAt = this.now;
    this._recordEnemyDefeat(e);
    this._explode(e.cx, e.cy, e.color, true);
    this.audio.play('explosion');
    this.shake = Math.max(this.shake, 6);
    // 掉落道具
    if (Math.random() < this.C.ITEM_DROP_CHANCE) {
      const typeKey = TB.ITEM_KEYS[Math.floor(Math.random() * TB.ITEM_KEYS.length)];
      const r = Math.floor(e.cy / this.C.CELL);
      const c = Math.floor(e.cx / this.C.CELL);
      this.items.push(new TB.Item(typeKey, r, c));
    }
  }

  _recordEnemyDefeat(e) {
    if (e._defeatRecorded) return false;
    e._defeatRecorded = true;
    this.kills++;
    this.energy = Math.min(this.maxEnergy, this.energy + this.C.EMP.energyPerKill);
    return true;
  }

  useEMP() {
    if (this.state !== 'playing' || this.energy !== this.maxEnergy) return false;
    this.energy = 0;
    this.bullets = this.bullets.filter((b) => b.owner !== 'enemy');
    this.enemyFrozenUntil = Math.max(
      this.enemyFrozenUntil,
      this.now + this.C.EMP.freezeDuration
    );
    const origin = this.player || { cx: this.FIELD / 2, cy: this.FIELD / 2 };
    this.empEffectStartedAt = this.now;
    this.empEffectOrigin = { x: origin.cx, y: origin.cy };
    this.audio.play('freeze');
    return true;
  }

  /* ---------------- 道具效果 ---------------- */
  _applyItem(typeKey) {
    const p = this.player;
    this.audio.play('powerup');
    this._explode(p.cx, p.cy, TB.ITEMS[typeKey].color, false, 10);
    switch (typeKey) {
      case 'star':
        p.powerLevel = Math.min(3, p.powerLevel + 1);
        break;
      case 'helmet':
        this.playerShieldUntil = this.now + this.C.ITEM_DURATION.helmet;
        break;
      case 'shovel':
        this._activateShovel();
        break;
      case 'timer':
        this.enemyFrozenUntil = this.now + this.C.ITEM_DURATION.timer;
        this.audio.play('freeze');
        break;
      case 'bomb':
        for (const e of this.enemies) {
          if (e.alive && e.spawnAnim <= 0) {
            e.alive = false;
            this.score += e.type.score;
            this._recordEnemyDefeat(e);
            this._explode(e.cx, e.cy, e.color, true);
          }
        }
        this.audio.play('bigExplosion');
        this.shake = Math.max(this.shake, 10);
        break;
      case 'tank':
        this.lives = Math.min(5, this.lives + 1);
        break;
    }
  }

  _activateShovel() {
    if (!this.basePos) return;
    this.shovelUntil = this.now + this.C.ITEM_DURATION.shovel;
    this._shovelCells = [];
    const offs = [{ dr: -1, dc: -1 }, { dr: -1, dc: 0 }, { dr: -1, dc: 1 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
    for (const o of offs) {
      const r = this.basePos.r + o.dr, c = this.basePos.c + o.dc;
      if (r < 0 || c < 0 || r >= this.C.GRID || c >= this.C.GRID) continue;
      this._shovelCells.push({ r, c });
      this.grid[r][c] = TB.TILE.STEEL;
    }
  }
  _revertShovel() {
    for (const { r, c } of this._shovelCells) {
      if (r >= 0 && c >= 0 && r < this.C.GRID && c < this.C.GRID) this.grid[r][c] = TB.TILE.BRICK;
    }
    this._shovelCells = [];
  }

  /* ---------------- 玩家受击 / 基地 ---------------- */
  _playerHit() {
    const p = this.player;
    if (this.now < p.invincibleUntil || this.now < this.playerShieldUntil) return;
    p.alive = false;
    this.lives--;
    this._explode(p.cx, p.cy, '#67e8f9', true);
    this.audio.play('explosion');
    this.shake = Math.max(this.shake, 12);
    if (this.lives <= 0) { this._gameOver(); }
    else { this._spawnPlayer(false); }
  }

  _baseDestroyed() {
    if (this.basePos) this.grid[this.basePos.r][this.basePos.c] = TB.TILE.EMPTY;
    this._explode(this.basePos.c * this.C.CELL + 20, this.basePos.r * this.C.CELL + 20, '#ff5ca8', true);
    this.audio.play('bigExplosion');
    this.shake = 16;
    this._gameOver();
  }

  /* ---------------- 粒子 ---------------- */
  _explode(x, y, color, big, n) {
    const counts = { high: big ? 18 : 8, medium: big ? 10 : 5, low: big ? 5 : 2 };
    const num = n || counts[this.quality] || 8;
    const max = { high: 240, medium: 130, low: 60 }[this.quality] || 130;
    for (let i = 0; i < num; i++) {
      if (this.particles.length >= max) break;
      const a = Math.random() * Math.PI * 2;
      const sp = (big ? 90 : 60) * (0.4 + Math.random());
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.4, maxLife: 0.8,
        color, size: 2 + Math.random() * 3,
      });
    }
  }

  /* ---------------- 流转 ---------------- */
  calculateGrade(score = this.score) {
    if (score >= this.C.GRADE.S) return 'S';
    if (score >= this.C.GRADE.A) return 'A';
    if (score >= this.C.GRADE.B) return 'B';
    return 'C';
  }

  _levelClear() {
    this.audio.play('levelup');
    if (this.levelIndex + 1 < TB.LEVELS.length) {
      this.state = 'paused';
      this._levelTransition = true; // 区别于用户暂停
      this._pendingNextLevel = this.levelIndex + 1;
      this._emit({ type: 'levelclear', level: this.levelIndex + 1 });
    } else {
      this.state = 'win';
      const isNew = this.saveHighScore();
      this.audio.play('win');
      this._emit({
        type: 'win', score: this.score, high: this.highScore, isNew,
        kills: this.kills, elapsedTime: this.elapsedTime, grade: this.calculateGrade(),
      });
    }
  }

  advanceLevel() {
    if (this._levelTransition === true) {
      const n = this._pendingNextLevel != null ? this._pendingNextLevel : this.levelIndex + 1;
      this._levelTransition = false;
      this._pendingNextLevel = null;
      this.startLevel(n);
    }
  }

  _gameOver() {
    this.state = 'over';
    const isNew = this.saveHighScore();
    this.comboCount = 0;
    this.audio.play('gameover');
    this._emit({
      type: 'gameover', score: this.score, high: this.highScore, isNew,
      kills: this.kills, elapsedTime: this.elapsedTime, grade: this.calculateGrade(),
    });
  }

  pause() {
    if (this.state === 'playing') { this.state = 'paused'; this.input.reset(); this._emitState(); }
  }
  resume() {
    if (this.state === 'paused' && !this._levelTransition) {
      this.state = 'playing';
      this._emitState();
    }
  }
  toMenu() {
    this.state = 'menu';
    this._levelTransition = false;
    this._pendingNextLevel = null;
    this.prepareLevel(0);
    this._emitState();
  }

  _emitState() { this._emit({ type: 'state', state: this.state }); }
  _emit(evt) { if (this.onEvent) this.onEvent(evt); }

  _emitHud() {
    const remaining = this.toSpawn + this.enemies.filter((e) => e.alive).length;
    let power = null, powerTimer = 0, powerMax = 1;
    if (this.now < this.playerShieldUntil) { power = '无敌护盾'; powerTimer = this.playerShieldUntil - this.now; powerMax = this.C.ITEM_DURATION.helmet; }
    else if (this.now < this.shovelUntil) { power = '强化核心'; powerTimer = this.shovelUntil - this.now; powerMax = this.C.ITEM_DURATION.shovel; }
    else if (this.now < this.enemyFrozenUntil) { power = '冻结敌军'; powerTimer = this.enemyFrozenUntil - this.now; powerMax = this.C.ITEM_DURATION.timer; }
    else if (this.player && this.player.powerLevel > 0) { power = '火力 Lv' + this.player.powerLevel; }
    this._emit({
      type: 'hud',
      score: this.score, high: this.highScore, lives: this.lives,
      level: this.levelIndex + 1, enemiesLeft: remaining,
      energy: this.energy, maxEnergy: this.maxEnergy, empReady: this.energy === this.maxEnergy,
      power, powerTimer, powerMax,
    });
  }

  /* ---------------- 渲染 ---------------- */
  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.FIELD, this.FIELD);

    // 背景
    ctx.fillStyle = '#040713';
    ctx.fillRect(0, 0, this.FIELD, this.FIELD);
    // 细网格
    ctx.strokeStyle = 'rgba(103,232,249,0.055)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= this.C.GRID; i++) {
      const p = i * this.C.CELL + 0.5;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, this.FIELD); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(this.FIELD, p); ctx.stroke();
    }

    // 地形（非草）
    for (let r = 0; r < this.C.GRID; r++)
      for (let c = 0; c < this.C.GRID; c++) {
        const t = this.grid[r][c];
        if (t !== TB.TILE.EMPTY && t !== TB.TILE.GRASS) this._drawTile(ctx, r, c, t);
      }

    // 道具
    for (const it of this.items) if (it.alive) it.draw(ctx);

    // 子弹
    for (const b of this.bullets) if (b.alive) b.draw(ctx);

    // 敌人
    for (const e of this.enemies) if (e.alive) {
      if (e.spawnAnim > 0) this._drawSpawn(ctx, e);
      else e.draw(ctx);
    }
    // 玩家
    if (this.player && this.player.alive) this.player.draw(ctx);

    // 草（覆盖在坦克之上，作为遮蔽）
    for (let r = 0; r < this.C.GRID; r++)
      for (let c = 0; c < this.C.GRID; c++)
        if (this.grid[r][c] === TB.TILE.GRASS) this._drawTile(ctx, r, c, TB.TILE.GRASS);

    // 粒子
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // EMP 扩散圆（纯视觉，不参与碰撞）
    this._drawEmpEffect(ctx);

    // 冻结覆盖
    if (this.now < this.enemyFrozenUntil) {
      ctx.fillStyle = 'rgba(82,126,255,0.13)';
      ctx.fillRect(0, 0, this.FIELD, this.FIELD);
    }

    // 屏幕震动
    if (this.shake > 0) {
      const dx = (Math.random() - 0.5) * this.shake;
      const dy = (Math.random() - 0.5) * this.shake;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, dx * this.dpr, dy * this.dpr);
      // 重新绘制一层边框遮挡抖动露白
      ctx.strokeStyle = '#040713'; ctx.lineWidth = this.shake * 2;
      ctx.strokeRect(0, 0, this.FIELD, this.FIELD);
    }
  }

  _drawEmpEffect(ctx) {
    if (this.empEffectStartedAt == null || !this.empEffectOrigin) return;
    const elapsed = this.now - this.empEffectStartedAt;
    const duration = this.C.EMP.effectDuration;
    if (elapsed > duration) {
      this.empEffectStartedAt = null;
      this.empEffectOrigin = null;
      return;
    }
    const progress = clamp(elapsed / duration, 0, 1);
    const radius = progress * this.FIELD * 0.9;
    const alpha = (1 - progress) * 0.8;
    ctx.save();
    ctx.strokeStyle = `rgba(103,232,249,${alpha})`;
    ctx.shadowColor = 'rgba(139,92,246,0.65)';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2 + (1 - progress) * 4;
    ctx.beginPath();
    ctx.arc(this.empEffectOrigin.x, this.empEffectOrigin.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawTile(ctx, r, c, t) {
    const C = this.C.CELL;
    const x = c * C, y = r * C;
    switch (t) {
      case TB.TILE.BRICK: {
        ctx.fillStyle = '#542741'; ctx.fillRect(x, y, C, C);
        ctx.fillStyle = '#984867';
        ctx.fillRect(x + 1, y + 1, C - 2, C / 2 - 2);
        ctx.fillRect(x + 1, y + C / 2 + 1, C - 2, C / 2 - 2);
        ctx.fillStyle = '#34172a';
        ctx.fillRect(x + C / 2 - 1, y + 1, 2, C / 2 - 2);
        ctx.fillRect(x + 1, y + C / 2 - 1, C / 2 - 2, 2);
        ctx.fillRect(x + C / 2 + 1, y + C / 2 - 1, C / 2 - 2, 2);
        break;
      }
      case TB.TILE.STEEL: {
        ctx.fillStyle = '#253352'; ctx.fillRect(x, y, C, C);
        ctx.fillStyle = '#7187ad';
        ctx.fillRect(x + 3, y + 3, C - 6, C - 6);
        ctx.fillStyle = '#41567f';
        ctx.fillRect(x + C / 2 - 1, y + 3, 2, C - 6);
        ctx.fillRect(x + 3, y + C / 2 - 1, C - 6, 2);
        break;
      }
      case TB.TILE.WATER: {
        ctx.fillStyle = '#0b3d6b'; ctx.fillRect(x, y, C, C);
        ctx.strokeStyle = 'rgba(103,232,249,0.58)'; ctx.lineWidth = 2;
        const ph = (this.now / 400) % (C / 2);
        for (let i = 0; i < 2; i++) {
          const yy = y + 8 + i * (C / 2) + Math.sin(this.now / 300 + i) * 2 + (ph % (C / 2));
          ctx.beginPath();
          ctx.moveTo(x + 4, yy);
          ctx.quadraticCurveTo(x + C / 2, yy - 4, x + C - 4, yy);
          ctx.stroke();
        }
        break;
      }
      case TB.TILE.ICE: {
        ctx.fillStyle = 'rgba(88,151,224,0.36)'; ctx.fillRect(x, y, C, C);
        ctx.strokeStyle = 'rgba(199,245,255,0.62)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + 6, y + C - 8); ctx.lineTo(x + C - 8, y + 6); ctx.stroke();
        break;
      }
      case TB.TILE.BASE: {
        ctx.fillStyle = '#07142b'; ctx.fillRect(x, y, C, C);
        // 校园数据核心标志
        ctx.save();
        ctx.translate(x + C / 2, y + C / 2);
        ctx.strokeStyle = '#67e8f9';
        ctx.shadowColor = 'rgba(103,232,249,0.65)';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        ctx.strokeRect(-C * 0.27, -C * 0.27, C * 0.54, C * 0.54);
        ctx.fillStyle = '#8b5cf6';
        ctx.fillRect(-C * 0.15, -C * 0.15, C * 0.3, C * 0.3);
        ctx.fillStyle = '#eefcff';
        ctx.fillRect(-C * 0.045, -C * 0.045, C * 0.09, C * 0.09);
        ctx.restore();
        break;
      }
      case TB.TILE.GRASS: {
        ctx.fillStyle = 'rgba(26,105,101,0.86)'; ctx.fillRect(x, y, C, C);
        ctx.fillStyle = 'rgba(72,190,168,0.68)';
        for (let i = 0; i < 5; i++) {
          const gx = x + 4 + (i * 7) % (C - 8);
          const gy = y + 4 + ((i * 11) % (C - 8));
          ctx.fillRect(gx, gy, 3, 6);
        }
        break;
      }
    }
  }

  _drawSpawn(ctx, e) {
    const k = 1 - e.spawnAnim / 600;
    ctx.save();
    ctx.translate(e.cx, e.cy);
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2;
    const s = e.size * (0.4 + k * 0.8);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
};
