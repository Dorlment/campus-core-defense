/* ============================================================
   坦克大战 · 输入系统（键盘 + 触屏虚拟按键）
   输出统一意图：方向布尔、射击布尔、动作回调
   ============================================================ */
window.TB = window.TB || {};

TB.Input = class {
  constructor(keymap) {
    this.keymap = keymap || TB.DEFAULT_KEYMAP;
    this.dir = { up: false, down: false, left: false, right: false };
    this.fire = false;
    this.onAction = null;           // (action) => {}  action: pause/confirm/restart
    this._codeMap = {};
    this._buildMap();
    this._bindKeyboard();
  }

  setKeymap(km) {
    this.keymap = km;
    this._buildMap();
  }

  _buildMap() {
    this._codeMap = {};
    for (const action in this.keymap) {
      (this.keymap[action] || []).forEach((code) => {
        this._codeMap[code] = action;
      });
    }
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const action = this._codeMap[e.code];
      if (!action) return;
      if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
        e.preventDefault();
        this.dir[action] = true;
      } else if (action === 'fire') {
        e.preventDefault();
        this.fire = true;
      } else {
        // pause / confirm / restart：边沿触发
        if (!e.repeat && this.onAction) this.onAction(action);
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      const action = this._codeMap[e.code];
      if (!action) return;
      if (action === 'fire') this.fire = false;
      else if (this.dir[action] !== undefined) this.dir[action] = false;
    });

    // 失去焦点时清空，避免“按键卡住”
    window.addEventListener('blur', () => this.reset());
  }

  /* 绑定触屏 / 鼠标虚拟按键 */
  bindTouch(root) {
    if (!root) return;
    root.querySelectorAll('[data-dir]').forEach((btn) => {
      const d = btn.dataset.dir;
      const set = (v) => { this.dir[d] = v; };
      const down = (e) => { e.preventDefault(); set(true); btn.classList.add('active'); };
      const up = (e) => { e.preventDefault(); set(false); btn.classList.remove('active'); };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('pointercancel', up);
    });
    const fireBtn = root.querySelector('[data-fire]');
    if (fireBtn) {
      const down = (e) => { e.preventDefault(); this.fire = true; };
      const up = (e) => { e.preventDefault(); this.fire = false; };
      fireBtn.addEventListener('pointerdown', down);
      fireBtn.addEventListener('pointerup', up);
      fireBtn.addEventListener('pointerleave', up);
      fireBtn.addEventListener('pointercancel', up);
    }
  }

  reset() {
    this.dir = { up: false, down: false, left: false, right: false };
    this.fire = false;
  }
};
