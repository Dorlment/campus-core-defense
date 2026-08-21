/* ============================================================
   坦克大战 · UI 与菜单交互
   ============================================================ */
(function () {
  const $ = (id) => document.getElementById(id);
  const pad = (n, len) => String(n).padStart(len, '0');
  const formatTime = (ms) => {
    const total = Math.floor(ms / 1000);
    return pad(Math.floor(total / 60), 2) + ':' + pad(total % 60, 2);
  };

  const canvas = $('game');
  const audio = new TB.AudioManager();
  const input = new TB.Input(TB.DEFAULT_KEYMAP);
  const game = new TB.Game(canvas, audio, input);

  // 应用已存储配置
  audio.musicOn = game.config.musicOn;
  audio.sfxOn = game.config.sfxOn;
  audio.setVolume(game.config.volume);
  input.setKeymap(game.config.keymap);
  game.quality = game.config.quality;

  input.bindTouch($('touch'));
  let inTransition = false;

  /* ---------------- 弹窗控制 ---------------- */
  const MODALS = ['menu', 'pause', 'gameover', 'settings', 'help'];
  function hideAllModals() { MODALS.forEach((m) => $(m).classList.remove('show')); }
  function showModal(id) {
    hideAllModals();
    $(id).classList.add('show');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  /* ---------------- 横幅 ---------------- */
  const bannerEl = $('banner');
  function showBanner(text) {
    bannerEl.innerHTML = '<span>' + text + '</span>';
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth; // 重绘以重播动画
    bannerEl.classList.add('show');
  }

  /* ---------------- HUD ---------------- */
  const hud = {
    level: $('hud-level'), enemies: $('hud-enemies'), lives: $('hud-lives'),
    score: $('hud-score'), high: $('hud-high'),
    power: $('hud-power'), powerFill: $('hud-power-fill'), powerCard: $('hud-power-card'),
    energy: $('hud-energy'), energyFill: $('hud-energy-fill'), energyReady: $('hud-energy-ready'),
  };
  let lastEnemies = -1, lastLives = -1;
  function updateHud(d) {
    hud.score.textContent = pad(d.score, 6);
    hud.high.textContent = pad(d.high, 6);
    hud.level.textContent = pad(d.level, 2);
    if (d.enemiesLeft !== lastEnemies) {
      lastEnemies = d.enemiesLeft;
      hud.enemies.innerHTML = '';
      const n = Math.min(d.enemiesLeft, 26);
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.className = 'pip enemy';
        hud.enemies.appendChild(s);
      }
    }
    if (d.lives !== lastLives) {
      lastLives = d.lives;
      hud.lives.innerHTML = '';
      for (let i = 0; i < d.lives; i++) {
        const s = document.createElement('span');
        s.className = 'pip';
        s.style.background = 'var(--accent)';
        hud.lives.appendChild(s);
      }
    }
    if (d.power) { hud.power.textContent = d.power; hud.powerCard.classList.remove('inactive'); }
    else { hud.power.textContent = '—'; hud.powerCard.classList.add('inactive'); }
    if (d.powerTimer > 0) hud.powerFill.style.transform = 'scaleX(' + (d.powerTimer / d.powerMax) + ')';
    else hud.powerFill.style.transform = 'scaleX(1)';
    hud.energy.textContent = d.energy + ' / ' + d.maxEnergy;
    hud.energyFill.style.transform = 'scaleX(' + (d.energy / d.maxEnergy) + ')';
    const empReady = d.energy >= d.maxEnergy;
    hud.energyReady.textContent = empReady ? 'EMP READY · K' : '';
    hud.energyReady.hidden = !empReady;
  }

  /* ---------------- 事件 ---------------- */
  game.onEvent = (evt) => {
    switch (evt.type) {
      case 'hud': updateHud(evt); break;
      case 'banner': showBanner(evt.text); break;
      case 'state':
        if (evt.state === 'menu') showModal('menu');
        else if (evt.state === 'playing') hideAllModals();
        else if (evt.state === 'paused' && !inTransition) showModal('pause');
        else if (evt.state === 'over') showGameOver(evt);
        else if (evt.state === 'win') showWin(evt);
        break;
      case 'levelclear':
        inTransition = true;
        showBanner('STAGE ' + pad(evt.level, 2) + ' CLEAR');
        setTimeout(() => { inTransition = false; game.advanceLevel(); }, 1700);
        break;
      case 'gameover': showGameOver(evt); break;
      case 'win': showWin(evt); break;
    }
  };

  function showGameOver(evt) {
    $('over-score').textContent = pad(evt.score, 6);
    $('over-kills').textContent = String(evt.kills);
    $('over-time').textContent = formatTime(evt.elapsedTime);
    $('over-grade').textContent = evt.grade;
    $('over-title').textContent = '游戏结束';
    showModal('gameover');
  }
  function showWin(evt) {
    $('over-score').textContent = pad(evt.score, 6);
    $('over-kills').textContent = String(evt.kills);
    $('over-time').textContent = formatTime(evt.elapsedTime);
    $('over-grade').textContent = evt.grade;
    $('over-title').textContent = '通关胜利';
    showModal('gameover');
  }

  /* ---------------- 动作（键盘） ---------------- */
  input.onAction = (action) => {
    if (action === 'skill') {
      game.useEMP();
    } else if (action === 'pause') {
      if (game.state === 'playing') game.pause();
      else if (game.state === 'paused' && !inTransition) game.resume();
    } else if (action === 'confirm') {
      if (game.state === 'menu' || game.state === 'over' || game.state === 'win') game.startGame();
    } else if (action === 'restart') {
      if (game.state === 'over' || game.state === 'win') game.startGame();
    }
  };

  /* ---------------- 按钮 ---------------- */
  $('btn-start').onclick = () => game.startGame();
  $('btn-menu-help').onclick = () => showModal('help');
  $('btn-menu-settings').onclick = () => { syncSettingsUI(); showModal('settings'); };
  $('btn-help').onclick = () => showModal('help');
  $('btn-help-close').onclick = () => { if (game.state === 'menu') showModal('menu'); else hideAllModals(); };
  $('btn-settings').onclick = () => { syncSettingsUI(); showModal('settings'); };

  $('btn-resume').onclick = () => game.resume();
  $('btn-pause-restart').onclick = () => game.startGame();
  $('btn-pause-menu').onclick = () => game.toMenu();

  $('btn-again').onclick = () => game.startGame();
  $('btn-over-menu').onclick = () => game.toMenu();

  /* ---------------- 设置 ---------------- */
  function syncSettingsUI() {
    $('sw-music').setAttribute('aria-checked', String(game.config.musicOn));
    $('sw-sfx').setAttribute('aria-checked', String(game.config.sfxOn));
    $('vol').value = game.config.volume;
    $('vol-label').textContent = game.config.volume + '%';
    document.querySelectorAll('#seg-quality button').forEach((b) => {
      b.classList.toggle('active', b.dataset.q === game.config.quality);
    });
    renderKeymap();
  }

  $('sw-music').onclick = () => {
    game.config.musicOn = !game.config.musicOn;
    audio.setMusic(game.config.musicOn);
    $('sw-music').setAttribute('aria-checked', String(game.config.musicOn));
    game.saveConfig();
  };
  $('sw-sfx').onclick = () => {
    game.config.sfxOn = !game.config.sfxOn;
    audio.setSfx(game.config.sfxOn);
    $('sw-sfx').setAttribute('aria-checked', String(game.config.sfxOn));
    game.saveConfig();
  };
  $('vol').oninput = (e) => {
    const v = parseInt(e.target.value, 10);
    game.config.volume = v;
    audio.setVolume(v);
    $('vol-label').textContent = v + '%';
  };
  $('vol').onchange = () => game.saveConfig();
  document.querySelectorAll('#seg-quality button').forEach((b) => {
    b.onclick = () => {
      game.config.quality = b.dataset.q;
      game.quality = b.dataset.q;
      document.querySelectorAll('#seg-quality button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      game.saveConfig();
    };
  });

  /* ---------------- 按键重映射 ---------------- */
  let capturing = null;
  function renderKeymap() {
    const wrap = $('keymap');
    wrap.innerHTML = '';
    const km = game.config.keymap;
    Object.keys(TB.KEYMAP_LABELS).forEach((action) => {
      const item = document.createElement('div');
      item.className = 'keymap-item';
      const label = document.createElement('span');
      label.textContent = TB.KEYMAP_LABELS[action];
      const btn = document.createElement('button');
      btn.textContent = prettyKey(km[action] && km[action][0]);
      btn.onclick = () => startCapture(action, btn);
      item.appendChild(label); item.appendChild(btn);
      wrap.appendChild(item);
    });
  }
  function prettyKey(code) {
    if (!code) return '—';
    const map = {
      Space: '空格', ArrowUp: '↑', ArrowDown: '↓',
      ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Escape: 'Esc',
    };
    if (map[code]) return map[code];
    return code.replace('Key', '');
  }
  function startCapture(action, btn) {
    capturing = action;
    document.querySelectorAll('#keymap button').forEach((b) => b.classList.remove('listening'));
    btn.classList.add('listening');
    btn.textContent = '按键…';
  }
  window.addEventListener('keydown', (e) => {
    if (!capturing) return;
    e.preventDefault();
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    game.config.keymap[capturing] = [e.code];
    input.setKeymap(game.config.keymap);
    game.saveConfig();
    capturing = null;
    renderKeymap();
  }, true);
  $('btn-keymap-reset').onclick = () => {
    game.config.keymap = JSON.parse(JSON.stringify(TB.DEFAULT_KEYMAP));
    input.setKeymap(game.config.keymap);
    game.saveConfig();
    renderKeymap();
  };
  $('btn-settings-close').onclick = () => {
    if (game.state === 'menu') showModal('menu');
    else if (game.state === 'paused' && !inTransition) showModal('pause');
    else hideAllModals();
  };

  // 初始化 UI
  syncSettingsUI();
})();
