# 模块：视图与交互（`index.html` + `js/main.js`）

## 职责

**视图层**：把引擎暴露的数据与事件呈现给用户，并把用户的界面操作翻译成对引擎的调用。`index.html` 提供页面骨架（Canvas 战场、侧边 HUD、主菜单/暂停/结束/设置/帮助弹窗、窄屏触屏控制），`js/main.js` 负责实例化所有对象、订阅引擎事件、绑定按钮与键盘动作、实时刷新 HUD、读写配置。

> 引擎（`game`）与硬件（`audio`/`input`）的实例化都在 `main.js` 完成，是系统的**组装根（composition root）**。

## 页面结构（`index.html` + `css/styles.css`）

- `#game`：Canvas 战场（由引擎按 DPR 设定分辨率）。
- 侧边 HUD：关卡 / 剩余敌军（小圆点）/ 生命 / 分数 / 最高分 / 当前增益（含倒计时进度条）。
- 弹窗 `#menu` `#pause` `#gameover` `#settings` `#help`（`.show` 切换显隐）。
- `#banner`：关卡名 / 过关提示横幅（CSS 动画）。
- `#touch`：窄屏浮出的虚拟方向键 + 射击键（`data-dir` / `data-fire`），由 `input.bindTouch` 绑定。
- 视觉：深墨背景、单一琥珀强调色、CRT 边框、状态动效、响应式堆叠、`prefers-reduced-motion` 与 `focus-visible` 可访问性处理。

## `main.js` 关键职责

### 装配
```
const audio = new TB.AudioManager();
const input = new TB.Input(TB.DEFAULT_KEYMAP);
const game  = new TB.Game(canvas, audio, input);
// 应用已存配置
audio.musicOn/sfxOn/volume ← game.config;  input.setKeymap(game.config.keymap);
```

### 事件订阅 `game.onEvent`
| 事件 | 处理 |
| --- | --- |
| `hud` | `updateHud(d)`：分数/最高分/关卡/剩余敌军点/生命点/增益条 |
| `banner` | `showBanner(text)` |
| `state` | `menu→显示菜单`、`playing→隐藏弹窗`、`paused→显示暂停`、`over/win→结束弹窗` |
| `levelclear` | 横幅 + 1.7s 后 `game.advanceLevel()`（用 `inTransition` 防重复） |
| `gameover` / `win` | 填充分数/最高分/「新纪录」标记并弹窗 |

### 键盘动作 `input.onAction`
- `pause`：`playing→pause`，`paused→resume`（过场中忽略）。
- `confirm`：菜单/结束/胜利态 → `startGame`。
- `restart`：结束/胜利态 → `startGame`。

### 按钮
开始、帮助、设置、继续、重开、回菜单、再来一局等，全部映射到 `game` 的方法。

### 设置
- 音乐/音效开关 → `audio.setMusic/setSfx` + `game.saveConfig`。
- 音量滑杆 → `audio.setVolume` + `game.saveConfig`。
- 画质档（`high/medium/low`）→ `game.quality` + `game.saveConfig`（控粒子密度等）。
- 按键重映射：捕获下一次按键写入 `game.config.keymap` → `input.setKeymap` → `game.saveConfig`；支持「恢复默认」。

## 数据流（UI 视角）

```
用户操作（按钮/键盘/触屏）
   │
   ├─▶ input.dir/fire ──────────────▶ game.update（每帧）
   ├─▶ input.onAction ──────────────▶ main ──▶ game.pause/resume/startGame
   └─▶ 设置控件 ──▶ audio.* / game.quality + game.saveConfig ──▶ localStorage

game.onEvent(evt) ──▶ main ──▶ HUD 文本/弹窗/横幅（DOM 更新）
game.render(ctx) ──▶ Canvas（绘制，由引擎直接操作，不经过 main）
```

要点：

- **单向数据流**：`main` 不反向修改引擎内部状态，只调用引擎公开方法；引擎通过 `onEvent` 单向广播，UI 被动刷新。
- **配置闭环**：`main` 读取 `game.config`（构造时已 `_loadStorage` 载入），变更回写 `saveConfig`；下次启动自动恢复。
- **过场协调**：`levelclear` 的 1.7s 延迟与 `advanceLevel` 调用由 UI 控制，引擎只负责把状态切到带 `_levelTransition` 的 `paused`。

## 设计要点

- **组装根集中**：所有对象在这里 `new` 出来并接线，便于理解依赖与替换（如测试时注入桩）。
- **关注点分离**：DOM/样式/交互全在视图层；游戏逻辑全在引擎层。引擎不引用任何 `document`/`getElementById`。
- **可访问性**：开关用 `aria-checked`、键盘可达、`focus-visible` 高亮、窄屏触屏兜底。
