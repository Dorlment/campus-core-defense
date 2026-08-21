# 坦克大战 · 系统设计文档

基于 HTML5 Canvas 的「坦克大战（Battle City 复刻）」前端实现。本文档说明系统架构、核心模块职责与运行时数据流，每个核心模块另有独立文档（见下方链接）。

## 文档索引

| 文档 | 说明 |
| --- | --- |
| [architecture.md](./architecture.md) | 系统架构图、模块依赖关系与运行时数据流 |
| [config.md](./config.md) | 配置与数据驱动模块（`js/config.js`） |
| [entities.md](./entities.md) | 实体与碰撞对象（`js/entities.js`） |
| [game.md](./game.md) | 核心引擎 / 状态机 / 主循环（`js/game.js`） |
| [input.md](./input.md) | 输入系统：键盘 + 触屏（`js/input.js`） |
| [audio.md](./audio.md) | 音频系统：Web Audio 本地合成（`js/audio.js`） |
| [ui.md](./ui.md) | 视图与交互：页面 / 菜单 / HUD（`index.html` + `js/main.js`） |

## 技术栈与运行方式

- 纯前端：HTML + CSS + 原生 JavaScript（ES2020+），**无构建步骤、无外部依赖、无占位资源**。
- 入口：浏览器直接打开 `index.html`（经典 `<script>` 标签按依赖顺序加载）。
- 音频：Web Audio API 实时合成，无音频文件。
- 持久化：`localStorage`（最高分、设置、按键映射）。
- 测试：`tests/tank.test.js`（`node --test`，29 个用例覆盖核心逻辑）。

## 模块总览

```
index.html        页面骨架、Canvas 战场、侧边 HUD、各弹窗、触屏控制
css/styles.css     “战术街机”视觉：深墨背景、单一强调色、CRT 边框、状态动效、响应式
js/config.js      全局配置与数据（地图、敌人/道具/火力、按键、关卡）—— 所有模块的数据源
js/entities.js    坦克基类 / 玩家 / 敌方AI / 子弹 / 道具 —— 数据与绘制，碰撞由引擎统一解析
js/game.js        核心引擎：状态机、主循环、网格地图、碰撞系统、计分、道具、粒子、渲染、持久化
js/input.js       输入抽象：键盘 + 触屏 → 统一方向/射击意图 + 动作回调
js/audio.js       音频管理：射击/爆炸/道具/过关等音效 + 循环 BGM，支持开关/音量/静音降级
js/main.js        UI 编排：实例化以上对象、绑定菜单/暂停/结束/设置/帮助、HUD 实时刷新、配置读写
```

模块统一挂载在全局命名空间 `TB`（`window.TB`）下；`config` / `entities` / `game` 为纯逻辑，可在 Node 中通过 DOM 桩直接加载并单元测试。
