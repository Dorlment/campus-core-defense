# 模块：输入系统（`js/input.js`）

## 职责

把**键盘事件**与**触屏/鼠标虚拟按键**统一抽象为「方向意图 + 射击意图 + 动作回调」，对上层（`game` / `main`）屏蔽输入来源差异。输出风格与引擎解耦：`game.update` 只读取 `dir`/`fire` 布尔，`main` 只消费 `onAction` 边沿事件。

类：`TB.Input`。构造参数 `(keymap)`，默认 `TB.DEFAULT_KEYMAP`。

## 对外接口

### 持续态（每帧读取）
- `dir`：`{ up, down, left, right }` 布尔。
- `fire`：布尔。

### 边沿事件
- `onAction`：回调 `(action) => {}`，`action ∈ { pause, confirm, restart }`（仅在 keydown 且 `!e.repeat` 时触发一次）。

### 方法
- `setKeymap(km)`：热替换按键映射并重建查找表。
- `bindTouch(root)`：绑定 DOM 中带 `data-dir` / `data-fire` 的虚拟按键（pointer 事件，含 `pointerleave`/`pointercancel` 兜底）。
- `reset()`：清空 `dir`/`fire`（失焦时自动调用，避免「按键卡住」）。

## 内部机制

- `_buildMap()`：把 `keymap`（action → code[]）反查为 `code → action` 的 `_codeMap`，支持一键多绑。
- `_bindKeyboard()`：
  - `keydown`：方向/射击置真并 `preventDefault`；`pause/confirm/restart` 调 `onAction`（非重复）。
  - `keyup`：对应标志复位。
  - `blur`：`reset()`。
- `bindTouch(root)`：`pointerdown` 置真、`pointerup/leave/cancel` 置假，并切换 `.active` 样式类。

## 数据流

```
键盘 keydown/keyup ─┐
                    ├─▶ TB.Input ──dir/fire──▶ game.update()
触屏 pointer* ──────┘            │
                                 └─onAction(pause/confirm/restart)──▶ main.js
                                                          │
                                                  game.pause/resume/startGame
```

- 方向/射击是**持续态**：按住即 `true`，引擎每帧轮询。
- 暂停/确认/重开是**边沿态**：仅按下瞬间触发一次，交由 `main` 翻译成对 `game` 的调用（避免在 `input` 内直接耦合引擎）。

## 设计要点

- **意图与设备解耦**：引擎与 UI 不关心输入来自键盘还是触屏，只消费统一意图。
- **可重映射**：`setKeymap` + `main` 的按键捕获 UI 实现运行时改键并持久化。
- **健壮性**：失焦清空状态，防止玩家切走窗口后回来发现坦克仍在移动。
