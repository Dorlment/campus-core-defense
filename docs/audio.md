# 模块：音频系统（`js/audio.js`）

## 职责

用 **Web Audio API 实时合成**全部音效与循环 BGM，**不加载任何音频文件**（契合「无外部资源」的设计准则）。提供开关、音量、以及不支持 Web Audio 时的**静音降级**。由引擎在关键时刻以事件名字符串调用 `play(name)`。

类：`TB.AudioManager`。

## 对外接口

- `unlock()`：首次用户交互后调用——创建/恢复 `AudioContext` 并启动 BGM（浏览器自动播放策略要求用户手势）。
- `play(name)`：播放指定事件音效（`shoot/hit/explosion/bigExplosion/powerup/spawn/levelup/freeze/shield/gameover/win`）。
- `setMusic(on)` / `setSfx(on)` / `setVolume(v)`：开关与音量（音量按 0–100 → 0–1 归一化）。
- `startBGM()` / `stopBGM()`：步进音序循环（A 小调低音 + 主旋律）。

## 内部机制

### 节点图
```
Oscillator/BufferSource ──▶ Gain ──▶ sfxGain ──┐
                                   (musicGain) ─┤──▶ master(Gain) ──▶ destination
```
- `sfxGain`(0.85)、`musicGain`(0.32) 分别混音到 `master`，`master.gain = volume`。

### 合成原语
- `_tone(freq, dur, type, gain, when, dest)`：振荡器 + 指数包络（起音/衰减），支持错拍叠加形成和弦。
- `_noise(dur, gain, cutoff)`：白噪声 buffer + 低通滤波，用于爆炸冲击。

### BGM
- `startBGM()`：以 `setInterval(stepMs=230)` 步进 8 步音序；低音每拍、主旋律隔拍；`musicOn` 关闭或上下文丢失即停止。

### 降级
- `_init()` 用 `window.AudioContext || webkitAudioContext`；缺失或抛错则 `enabled=false`，所有 `play` 直接返回。

## 数据流

```
game.update / 状态切换
      │ play('explosion') 等字符串事件
      ▼
AudioManager.play(name) ──▶ _tone / _noise ──▶ Web Audio 节点 ──▶ 扬声器
      │
      └─ unlock() ──▶ startBGM() ── setInterval ──▶ _bgmNote ──▶ 扬声器

main.js ── setMusic/setSfx/setVolume ──▶ AudioManager（并写 localStorage）
```

- 引擎只发出语义事件名，**不关心音色实现**；音色/混音全在 `audio` 模块内。
- 配置来源：`main` 在启动时把 `game.config.musicOn/sfxOn/volume` 同步给 `AudioManager`，变更时回写 `localStorage`。

## 设计要点

- **零资源依赖**：音效由振荡器/噪声实时合成，部署无需附带音频文件，契合单文件/无占位资源原则。
- **首次手势解锁**：`AudioContext` 需在用户交互后 `resume()`，故 `game.startGame()` 调 `audio.unlock()`。
- **失败安全**：任何不支持/被拦截的场景都静默降级为静音，不影响游戏逻辑。
