/* ============================================================
   坦克大战 · 实体（坦克 / 子弹 / 道具）与绘制
   坐标：逻辑像素，左上原点。物理碰撞由 game 统一解析。
   ============================================================ */
window.TB = window.TB || {};

TB.DIRS = [
  { dx: 0, dy: -1 }, // 0 上
  { dx: 1, dy: 0 },  // 1 右
  { dx: 0, dy: 1 },  // 2 下
  { dx: -1, dy: 0 }, // 3 左
];

/* 颜色明暗调整（hex） */
TB.shade = function (hex, amt) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  let r = parseInt(h.substring(0, 2), 16);
  let g = parseInt(h.substring(2, 4), 16);
  let b = parseInt(h.substring(4, 6), 16);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `rgb(${r},${g},${b})`;
};

TB.roundRect = function (ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

/* -------------------- 坦克基类 -------------------- */
TB.Tank = class {
  constructor(x, y, dir, color, team) {
    this.x = x; this.y = y;
    this.size = 28;
    this.dir = dir;
    this.color = color;
    this.team = team;
    this.alive = true;
    this.moving = false;
    this.shield = false;
    this._blink = false;
  }
  get cx() { return this.x + this.size / 2; }
  get cy() { return this.y + this.size / 2; }

  draw(ctx) {
    const s = this.size;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    if (this._blink) ctx.globalAlpha = 0.35;
    if (!this.alive) { ctx.restore(); return; }

    // 车身
    TB.roundRect(ctx, -s / 2, -s / 2, s, s, 5);
    ctx.fillStyle = this.color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = TB.shade(this.color, -40); ctx.stroke();

    // 履带（两侧深色条）
    ctx.fillStyle = TB.shade(this.color, -55);
    const tr = s * 0.16;
    if (this.dir === 0 || this.dir === 2) {
      ctx.fillRect(-s / 2, -s / 2, tr, s);
      ctx.fillRect(s / 2 - tr, -s / 2, tr, s);
    } else {
      ctx.fillRect(-s / 2, -s / 2, s, tr);
      ctx.fillRect(-s / 2, s / 2 - tr, s, tr);
    }

    // 炮塔
    const t = s * 0.42;
    TB.roundRect(ctx, -t / 2, -t / 2, t, t, 3);
    ctx.fillStyle = TB.shade(this.color, -18); ctx.fill();

    // 炮管
    ctx.fillStyle = '#2a2d36';
    const bl = s * 0.52, bw = s * 0.16;
    if (this.dir === 0) ctx.fillRect(-bw / 2, -s / 2 - bl * 0.2, bw, s / 2 + bl * 0.2);
    else if (this.dir === 2) ctx.fillRect(-bw / 2, s / 2 - bl * 0.2, bw, s / 2 + bl * 0.2);
    else if (this.dir === 3) ctx.fillRect(-s / 2 - bl * 0.2, -bw / 2, s / 2 + bl * 0.2, bw);
    else ctx.fillRect(s / 2 - bl * 0.2, -bw / 2, s / 2 + bl * 0.2, bw);

    ctx.restore();

    // 护盾环
    if (this.shield) {
      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.strokeStyle = 'rgba(127,198,217,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
};

/* -------------------- 玩家坦克 -------------------- */
TB.PlayerTank = class extends TB.Tank {
  constructor(x, y) {
    super(x, y, 0, '#e8c170', 'player');
    this.speed = TB.CONFIG.PLAYER.speed;
    this.powerLevel = 0;
    this.fireCd = 0;
    this.invincibleUntil = 0;
  }

  update(dt, input, world) {
    if (!this.alive) return;
    this._blink = world.now < this.invincibleUntil &&
                  Math.floor(world.now / 90) % 2 === 0;
    this.shield = world.now < world.playerShieldUntil;

    let moved = false;
    if (input.dir.up) { this.dir = 0; moved = true; }
    else if (input.dir.down) { this.dir = 2; moved = true; }
    else if (input.dir.left) { this.dir = 3; moved = true; }
    else if (input.dir.right) { this.dir = 1; moved = true; }

    const d = TB.DIRS[this.dir];
    if (moved) {
      world.resolveMove(this, d.dx * this.speed * dt, d.dy * this.speed * dt, dt);
    } else {
      // 冰面打滑
      if (world.tileAt(this.cx, this.cy) === TB.TILE.ICE) {
        world.resolveMove(this, d.dx * this.speed * 0.42 * dt, d.dy * this.speed * 0.42 * dt, dt);
      }
    }

    this.fireCd -= dt * 1000;
    if (input.fire && this.fireCd <= 0) {
      const max = TB.POWER_LEVELS[this.powerLevel].maxBullets;
      if (world.countBullets('player') < max) {
        world.spawnBullet(this);
        this.fireCd = 280;
      }
    }
  }
};

/* -------------------- 敌方坦克 -------------------- */
TB.EnemyTank = class extends TB.Tank {
  constructor(x, y, typeKey) {
    const def = TB.ENEMY_TYPES[typeKey];
    super(x, y, 2, def.color, 'enemy');
    this.speed = def.speed;
    this.typeKey = typeKey;
    this.type = def;
    this.hp = def.hp;
    this.aiTimer = Math.random() * 600;
    this.shootTimer = def.shoot * (0.5 + Math.random() * 0.5);
    this.spawnAnim = 600; // 出生动画
  }

  update(dt, world, player) {
    if (!this.alive) return;
    if (this.spawnAnim > 0) { this.spawnAnim -= dt * 1000; return; }
    if (world.now < world.enemyFrozenUntil) return; // 被冻结

    this.aiTimer -= dt * 1000;
    this.shootTimer -= dt * 1000;

    if (this.aiTimer <= 0) {
      this.aiTimer = 500 + Math.random() * 900;
      if (this.type.chase && player && player.alive && Math.random() < 0.75) {
        const dx = player.cx - this.cx, dy = player.cy - this.cy;
        if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 1 : 3;
        else this.dir = dy > 0 ? 2 : 0;
      } else {
        this.dir = Math.floor(Math.random() * 4);
      }
    }

    const sp = this.type.speed * world.level.speedMul;
    const d = TB.DIRS[this.dir];
    const bx = this.x, by = this.y;
    world.resolveMove(this, d.dx * sp * dt, d.dy * sp * dt, dt);
    if (Math.abs(this.x - bx) < 0.05 && Math.abs(this.y - by) < 0.05) {
      this.aiTimer = 0; // 撞墙，下一帧换方向
    }

    if (this.shootTimer <= 0) {
      this.shootTimer = this.type.shoot * (0.7 + Math.random() * 0.6);
      world.spawnBullet(this);
    }
  }
};

/* -------------------- 子弹 -------------------- */
TB.Bullet = class {
  constructor(x, y, dir, owner, opts) {
    this.x = x; this.y = y;
    this.size = TB.CONFIG.BULLET.size;
    this.dir = dir;
    this.owner = owner; // 'player' | 'enemy'
    this.speed = opts.speed || TB.CONFIG.BULLET.speed;
    this.power = opts.power || 1; // 2 = 可破钢
    this.alive = true;
  }
  get cx() { return this.x + this.size / 2; }
  get cy() { return this.y + this.size / 2; }

  update(dt) {
    const d = TB.DIRS[this.dir];
    this.x += d.dx * this.speed * dt;
    this.y += d.dy * this.speed * dt;
  }

  draw(ctx) {
    const s = this.size;
    ctx.save();
    ctx.fillStyle = this.owner === 'player' ? '#fff0c8' : '#ff8a72';
    ctx.shadowColor = this.owner === 'player' ? 'rgba(240,168,60,0.7)' : 'rgba(226,85,75,0.7)';
    ctx.shadowBlur = 6;
    TB.roundRect(ctx, this.x, this.y, s, s, 2);
    ctx.fill();
    ctx.restore();
  }
};

/* -------------------- 道具 -------------------- */
TB.Item = class {
  constructor(typeKey, r, c) {
    this.typeKey = typeKey;
    this.x = c * TB.CONFIG.CELL + (TB.CONFIG.CELL - 26) / 2;
    this.y = r * TB.CONFIG.CELL + (TB.CONFIG.CELL - 26) / 2;
    this.size = 26;
    this.alive = true;
    this.born = performance.now();
  }
  draw(ctx) {
    const s = this.size;
    const blink = Math.floor((performance.now() - this.born) / 250) % 2 === 0;
    const def = TB.ITEMS[this.typeKey];
    const cx = this.x + s / 2, cy = this.y + s / 2;
    ctx.save();
    ctx.globalAlpha = blink ? 1 : 0.5;
    TB.roundRect(ctx, this.x, this.y, s, s, 6);
    ctx.fillStyle = TB.shade(def.color, -12);
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = def.color; ctx.stroke();

    // 手绘矢量字形（无 emoji，跨平台稳定）
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#10121a';
    ctx.fillStyle = '#10121a';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const r = s * 0.3;
    switch (this.typeKey) {
      case 'star':
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
          const a2 = a + Math.PI / 5;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
        }
        ctx.closePath(); ctx.fill();
        break;
      case 'helmet':
        ctx.beginPath();
        ctx.arc(0, r * 0.2, r, Math.PI, 0);
        ctx.lineTo(r, r * 0.5); ctx.lineTo(-r, r * 0.5); ctx.closePath();
        ctx.stroke();
        break;
      case 'shovel':
        ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r);
        ctx.moveTo(r * 0.55, -r * 0.55); ctx.lineTo(r, -r);
        ctx.moveTo(-r, -r); ctx.lineTo(-r * 0.55, -r * 0.55);
        ctx.stroke();
        break;
      case 'timer':
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.6);
        ctx.moveTo(0, 0); ctx.lineTo(r * 0.45, 0); ctx.stroke();
        break;
      case 'bomb':
        ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.5); ctx.lineTo(r * 0.75, -r * 0.8); ctx.stroke();
        break;
      case 'tank':
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
        ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
        break;
    }
    ctx.restore();
  }
};
