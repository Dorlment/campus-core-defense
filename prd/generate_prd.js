const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageNumber, PageBreak, TableOfContents, TabStopType, TabStopPosition
} = require("docx");

// ===== 基础字体（中文兼容） =====
const FONT = { ascii: "Microsoft YaHei", hAnsi: "Microsoft YaHei", eastAsia: "微软雅黑", cs: "Microsoft YaHei" };
const FONT_TITLE = { ascii: "Microsoft YaHei", hAnsi: "Microsoft YaHei", eastAsia: "微软雅黑", cs: "Microsoft YaHei" };

// ===== 颜色 =====
const C_PRIMARY = "1F4E79";   // 深蓝
const C_SECONDARY = "2E75B6"; // 中蓝
const C_HEADER_FILL = "D9E2F3";
const C_ALT_FILL = "F2F6FC";

// ===== 内容宽度（A4，1英寸边距） =====
const CONTENT_W = 9026;

// ===== 通用工具函数 =====
function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, ...opts });
}

// 多级标题（带自动编号），使用 HeadingLevel 以便目录识别
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    numbering: { reference: "headings", level: 0 },
    children: [run(text, { bold: true })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    numbering: { reference: "headings", level: 1 },
    children: [run(text, { bold: true })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    numbering: { reference: "headings", level: 2 },
    children: [run(text, { bold: true })],
  });
}
function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 288 },
    children: Array.isArray(text) ? text : [run(text, opts.runOpts || {})],
    ...(opts.align ? { alignment: opts.align } : {}),
  });
}
function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60, line: 276 },
    children: [run(text)],
  });
}
function numItem(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { after: 60, line: 276 },
    children: [run(text)],
  });
}
function boldPara(label, text) {
  return new Paragraph({
    spacing: { after: 120, line: 288 },
    children: [run(label, { bold: true }), run(text)],
  });
}

// ===== 表格组件 =====
function makeTable(headers, rows, colWidths) {
  const headerBorder = { style: BorderStyle.SINGLE, size: 4, color: C_SECONDARY };
  const cellBorder = { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
  const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        borders: headerBorders,
        width: { size: colWidths[i], type: WidthType.DXA },
        shading: { fill: C_PRIMARY, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        verticalAlign: "center",
        children: [new Paragraph({
          spacing: { line: 276 },
          children: [run(h, { bold: true, color: "FFFFFF" })],
        })],
      })
    ),
  });

  const dataRows = rows.map((row, r) =>
    new TableRow({
      children: row.map((c, i) =>
        new TableCell({
          borders,
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { fill: r % 2 === 1 ? C_ALT_FILL : "FFFFFF", type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          verticalAlign: "center",
          children: [new Paragraph({
            spacing: { line: 276 },
            children: [run(c)],
          })],
        })
      ),
    })
  );

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

// =================================================================
// 封面
// =================================================================
function cover() {
  return [
    new Paragraph({ spacing: { before: 2400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "坦克大战", font: FONT_TITLE, size: 72, bold: true, color: C_PRIMARY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "HTML5 经典射击游戏", font: FONT_TITLE, size: 36, color: C_SECONDARY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: "产品需求文档（PRD）", font: FONT_TITLE, size: 40, bold: true, color: "000000" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C_SECONDARY, space: 1 } },
      children: [new TextRun({ text: "", font: FONT_TITLE, size: 8 })],
    }),
    new Paragraph({ spacing: { before: 600 } }),
    para([run("文档版本：", { bold: true }), run("V1.0")], { align: AlignmentType.CENTER }),
    para([run("文档状态：", { bold: true }), run("评审稿")], { align: AlignmentType.CENTER }),
    para([run("创建日期：", { bold: true }), run("2026-07-14")], { align: AlignmentType.CENTER }),
    para([run("产品负责人：", { bold: true }), run("游戏研发组")], { align: AlignmentType.CENTER }),
    new Paragraph({ spacing: { before: 400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "机密 · 仅限项目内部使用", font: FONT_TITLE, size: 18, color: "808080", italics: true })],
    }),
  ];
}

// =================================================================
// 文档主体
// =================================================================
function body() {
  const children = [];

  // ---------- 1 产品背景 ----------
  children.push(h1("产品背景"));
  children.push(h2("项目概述"));
  children.push(para("坦克大战是一款基于 HTML5 Canvas 技术实现的经典俯视角坦克射击游戏。玩家操控己方坦克在迷宫式战场中移动、射击，摧毁敌方坦克并保护己方基地（老鹰图标）。游戏复刻了红白机时代 Battle City 的核心玩法，并以 Web 技术栈实现，无需下载安装，打开浏览器即可游玩。"));
  children.push(h2("目标用户"));
  children.push(para("本产品的核心目标用户群体为休闲游戏玩家，具体画像如下："));
  children.push(makeTable(
    ["用户特征", "描述"],
    [
      ["年龄分布", "8~45 岁，覆盖学生、年轻白领与怀旧玩家。"],
      ["游戏偏好", "碎片化时间消遣，偏好简单易上手、反馈即时、可反复挑战的街机式游戏。"],
      ["设备习惯", "以 PC 端键盘操作为主，移动端触屏为辅。"],
      ["付费意愿", "低；以广告或纯免费体验为主，不依赖内购。"],
    ],
    [CONTENT_W * 0.22, CONTENT_W * 0.78]
  ));
  children.push(h2("核心问题"));
  children.push(para("目标用户在日常生活与工作中存在以下核心痛点："));
  children.push(bullet("时间碎片化：通勤、午休、排队等场景需要低门槛、短时长的娱乐来消磨时间。"));
  children.push(bullet("反应力挑战需求：希望通过轻量游戏锻炼手眼协调与即时决策能力。"));
  children.push(bullet("怀旧情结：80/90 后对红白机坦克大战有情感记忆，缺少便捷的现代复刻版本。"));
  children.push(h2("产品定位"));
  children.push(para("以“经典坦克大战 HTML5 游戏”为核心定位，强调“即开即玩、易上手、耐挑战”。产品不追求 3A 级美术与复杂系统，而是以稳定的 60fps 手感、清晰的关卡递进和丰富的道具玩法，成为休闲玩家碎片化时间的第一选择。"));
  children.push(h2("产品目标与成功指标"));
  children.push(makeTable(
    ["指标", "目标值", "说明"],
    [
      ["首屏加载时间", "≤ 2 秒", "保证即开即玩的体验。"],
      ["帧率稳定性", "≥ 60fps", "保证射击手感流畅。"],
      ["单局时长", "1.5 ~ 3 分钟", "契合碎片化场景。"],
      ["次日留存", "≥ 25%", "衡量玩法粘性的核心指标。"],
      ["本地最高分留存率", "100%", "依靠浏览器本地存储持久化。"],
    ],
    [CONTENT_W * 0.28, CONTENT_W * 0.22, CONTENT_W * 0.50]
  ));

  // ---------- 2 功能需求 ----------
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h1("功能需求"));
  children.push(para("以下功能需求基于经典坦克大战 HTML5 版本的核心模块梳理，涵盖游戏生命周期的全部关键环节。"));

  children.push(h2("游戏开始与重启"));
  children.push(bullet("开始游戏：主菜单提供“开始游戏”按钮，点击后进入第一关并初始化玩家坦克、敌人、基地与 UI。"));
  children.push(bullet("暂停 / 继续：支持 Esc 或 P 键暂停，弹出暂停面板，可继续或退出到主菜单。"));
  children.push(bullet("游戏重启：玩家阵亡且生命耗尽、或通关后，提供“重新开始”按钮，重置全部状态回到第一关。"));
  children.push(bullet("主菜单返回：任何时刻可返回主菜单，清空场景与计时器，释放资源。"));

  children.push(h2("坦克移动与射击"));
  children.push(bullet("四向移动：玩家坦克可上、下、左、右移动，移动受地图砖墙、钢墙与边界约束。"));
  children.push(bullet("方向朝向：坦克面向当前移动方向，子弹沿朝向发射。"));
  children.push(bullet("射击机制：空格 / J 键发射子弹，存在最大并发子弹数（默认 1 发），子弹击中目标后销毁。"));
  children.push(bullet("子弹碰撞：子弹与砖墙、钢墙、敌方坦克、敌方子弹、基地均可发生碰撞并触发对应效果。"));
  children.push(bullet("敌方坦克行为：AI 坦克随机移动并定时射击，部分类型会主动追逐玩家或攻击基地。"));

  children.push(h2("关卡系统"));
  children.push(bullet("关卡递进：每关需摧毁全部敌方坦克方可过关，过关后加载下一关地图并提升难度。"));
  children.push(bullet("地图配置：每关拥有独立地图布局（砖墙、钢墙、河流、草丛、冰面、基地），由配置数据驱动。"));
  children.push(bullet("敌人配额：每关限定敌人总数与同屏上限，逐批生成，全部消灭即通关。"));
  children.push(bullet("难度曲线：随关卡提升敌人速度、射击频率与智能程度。"));

  children.push(h2("道具系统"));
  children.push(para("战场中敌方坦克被特定方式击毁后会掉落道具，玩家拾取后获得增益效果："));
  children.push(makeTable(
    ["道具", "效果", "说明"],
    [
      ["星形（Star）", "升级火力", "提升子弹威力/数量，可多阶升级。"],
      ["头盔（Helmet）", "无敌护盾", "限时（约 8 秒）免疫所有伤害。"],
      ["铲子（Shovel）", "强化基地", "将基地周围砖墙临时变为钢墙。"],
      ["定时器（Timer）", "冻结敌人", "限时冻结全部敌方坦克移动与射击。"],
      ["手雷（Bomb）", "全屏清除", "立即摧毁屏幕上所有敌方坦克。"],
      ["坦克（Tank）", "奖励生命", "玩家生命值 +1。"],
    ],
    [CONTENT_W * 0.22, CONTENT_W * 0.22, CONTENT_W * 0.56]
  ));

  children.push(h2("音效系统"));
  children.push(bullet("背景音乐：提供循环 BGM，可在配置中开关与调节音量。"));
  children.push(bullet("动作音效：移动、射击、爆炸、道具拾取、过关、失败等事件绑定对应音效。"));
  children.push(bullet("音频管理：统一 AudioManager 管理播放、暂停、复用，避免重复创建节点造成内存泄漏。"));
  children.push(bullet("兼容性处理：对不支持 Web Audio 的环境降级为静音，不阻断游戏运行。"));

  children.push(h2("配置系统"));
  children.push(bullet("音效开关：独立控制音乐与音效开关。" + "音量调节：提供 0~100% 音量滑杆。"));
  children.push(bullet("控制方案：支持键盘（默认）与自定义按键映射。"));
  children.push(bullet("画质选项：根据设备性能提供高/中/低画质（影响粒子与特效密度）。"));
  children.push(bullet("配置持久化：用户配置写入 localStorage，下次启动自动应用。"));

  children.push(h2("计分与生命值"));
  children.push(bullet("计分规则：不同敌人类型对应不同分值（如普通 100、快速 200、装甲 300、智能 400）。"));
  children.push(bullet("连击加成：短时间内连续击毁可触发分数倍率加成。"));
  children.push(bullet("生命系统：玩家初始 3 条命，被击毁扣 1 命并在基地重生；生命为 0 则游戏结束。"));
  children.push(bullet("最高分：本局结束后与本地历史最高分比较，刷新则写入 localStorage。"));

  children.push(h2("敌人生成系统"));
  children.push(bullet("生成点：固定从地图顶部多个刷新点分批生成敌人。"));
  children.push(bullet("类型分布：依据关卡配置按权重随机生成普通/快速/装甲/智能坦克。"));
  children.push(bullet("同屏上限：维持场上敌人不超过上限（默认 4 辆），保证性能与难度平衡。"));
  children.push(bullet("生成节奏：按时间间隔与剩余配额动态补充，避免空场或爆屏。"));

  children.push(h2("边界与碰撞"));
  children.push(bullet("边界约束：所有实体不可越过地图边界。"));
  children.push(bullet("地形交互：子弹击碎砖墙、被钢墙阻挡；坦克被河流阻挡、被草丛遮蔽、受冰面打滑影响。"));
  children.push(bullet("基地守卫：敌方子弹击中基地（老鹰）即游戏失败。"));

  // ---------- 3 非功能需求 ----------
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h1("非功能需求"));
  children.push(h2("性能需求"));
  children.push(makeTable(
    ["项目", "指标", "说明"],
    [
      ["渲染帧率", "稳定 60fps", "采用 requestAnimationFrame 驱动游戏主循环。"],
      ["单局内存", "≤ 80MB", "对象池复用子弹/粒子，避免频繁 GC。"],
      ["首屏加载", "≤ 2s（宽带）", "资源压缩、代码分包、首屏预加载。"],
      ["输入延迟", "≤ 16ms 响应", "按键即时映射，避免操作堆积。"],
    ],
    [CONTENT_W * 0.20, CONTENT_W * 0.25, CONTENT_W * 0.55]
  ));
  children.push(h2("兼容性需求"));
  children.push(bullet("浏览器：支持 Chrome、Edge、Firefox、Safari 现代版本（近两代）。"));
  children.push(bullet("分辨率：自适应 480p ~ 4K，保持 13:13 正方形战场比例。"));
  children.push(bullet("输入设备：键鼠为主，预留触屏虚拟按键接口。"));
  children.push(h2("响应式设计"));
  children.push(bullet("布局自适应：侧边栏与画布根据视口宽度伸缩，窄屏下侧边栏折叠为悬浮面板。"));
  children.push(bullet("Canvas 缩放：采用等比缩放策略（CSS + DPR 适配），避免画面拉伸变形。"));
  children.push(h2("存储需求"));
  children.push(bullet("本地最高分：使用 localStorage 持久化最高分与最近一局成绩。"));
  children.push(bullet("用户配置：音效、音量、控制方案等写入 localStorage。"));
  children.push(bullet("容量上限：单域名本地存储控制在 5MB 以内，关键数据做 JSON 序列化与异常兜底。"));
  children.push(h2("可访问性"));
  children.push(bullet("色彩对比：关键信息（生命、分数）采用高对比配色，并辅以图形图标。"));
  children.push(bullet("键位提示：界面常驻操作说明，支持按键重映射降低门槛。"));
  children.push(bullet("音效替代：提供视觉反馈（屏幕闪烁、震屏）替代纯听觉提示。"));
  children.push(h2("安全与隐私"));
  children.push(bullet("本地优先：全部数据存于本地，不上传任何玩家个人信息。"));
  children.push(bullet("存储隔离：对 localStorage 读写做 try-catch 包裹，防止隐私模式异常导致崩溃。"));

  // ---------- 4 数据需求 ----------
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h1("数据需求"));
  children.push(h2("玩家数据"));
  children.push(makeTable(
    ["字段", "类型", "说明"],
    [
      ["score", "number", "当前累计得分。"],
      ["lives", "number", "剩余生命值，初始 3。"],
      ["level", "number", "当前关卡序号，初始 1。"],
      ["highScore", "number", "本地历史最高分（localStorage）。"],
      ["isAlive", "boolean", "玩家是否处于存活状态。"],
    ],
    [CONTENT_W * 0.25, CONTENT_W * 0.20, CONTENT_W * 0.55]
  ));
  children.push(h2("配置数据"));
  children.push(makeTable(
    ["字段", "类型", "默认值", "说明"],
    [
      ["soundOn", "boolean", "true", "总音效开关。"],
      ["musicOn", "boolean", "true", "背景音乐开关。"],
      ["volume", "number", "70", "音量 0~100。"],
      ["quality", "string", "high", "画质 high/medium/low。"],
      ["keyMap", "object", "预设", "按键映射配置。"],
    ],
    [CONTENT_W * 0.22, CONTENT_W * 0.18, CONTENT_W * 0.15, CONTENT_W * 0.45]
  ));
  children.push(h2("道具状态数据"));
  children.push(bullet("activePower：当前生效的增益类型（如 shield、freeze）。"));
  children.push(bullet("powerTimer：增益剩余时间（毫秒），用于倒计时与 UI 展示。"));
  children.push(bullet("powerLevel：火力等级（星形升级次数），决定子弹数量与穿透能力。"));
  children.push(h2("关卡数据"));
  children.push(bullet("mapLayout：二维网格，元素类型包括空地、砖墙、钢墙、河流、草丛、冰面、基地。"));
  children.push(bullet("enemyConfig：本关敌人总数、同屏上限、各类型权重、生成间隔。"));
  children.push(bullet("spawnPoints：敌人刷新点坐标列表。"));
  children.push(h2("数据字典（核心对象）"));
  children.push(makeTable(
    ["对象", "关键属性", "职责"],
    [
      ["PlayerTank", "x,y,dir,lives,powerLevel", "玩家坦克状态与行为控制。"],
      ["EnemyTank", "x,y,dir,type,aiState", "敌方坦克 AI 与渲染。"],
      ["Bullet", "x,y,dir,owner,power", "子弹运动与碰撞检测。"],
      ["MapBlock", "type,hp,breakable", "地形单元属性与交互。"],
      ["Item", "type,x,y,timer", "掉落道具的拾取与效果。"],
      ["GameState", "score,level,lives,phase", "全局游戏状态机。"],
    ],
    [CONTENT_W * 0.22, CONTENT_W * 0.40, CONTENT_W * 0.38]
  ));

  // ---------- 5 交互设计 ----------
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h1("交互设计"));
  children.push(h2("键盘控制"));
  children.push(makeTable(
    ["按键", "功能"],
    [
      ["↑ / ↓ / ← / →", "坦克上 / 下 / 左 / 右移动。"],
      ["空格 / J", "发射子弹。"],
      ["P / Esc", "暂停 / 继续游戏。"],
      ["Enter", "菜单确认 / 开始游戏。"],
      ["R", "游戏结束后重新开始。"],
    ],
    [CONTENT_W * 0.35, CONTENT_W * 0.65]
  ));
  children.push(h2("按钮控制"));
  children.push(bullet("主菜单：开始游戏、操作说明、配置（音效/画质）。"));
  children.push(bullet("暂停面板：继续、重新开始、返回主菜单。"));
  children.push(bullet("游戏结束面板：显示本局得分与最高分，提供“再来一局”。"));
  children.push(h2("侧边栏信息"));
  children.push(para("游戏画面右侧（或窄屏下折叠）常驻信息区，包含："));
  children.push(bullet("玩家生命：以坦克图标数量展示剩余生命。"));
  children.push(bullet("当前得分与最高分：实时分数与本地纪录。"));
  children.push(bullet("关卡进度：当前关卡号与剩余敌人数量。" +
    "道具状态：当前生效增益与倒计时条。"));
  children.push(h2("界面布局"));
  children.push(para("采用“左战场 + 右信息栏”的经典布局：中央 Canvas 战场保持正方形比例，右侧信息栏宽度自适应；窄屏（< 768px）切换为“上战场 + 下信息条”的纵向堆叠布局，并浮出虚拟方向键与射击键以适配触屏。"));

  // ---------- 6 里程碑计划 ----------
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h1("里程碑计划"));
  children.push(para("项目分三个阶段交付，逐步从可玩原型演进至体验优化的正式版本。"));
  children.push(h2("阶段一：MVP（最小可行产品）"));
  children.push(makeTable(
    ["模块", "交付内容", "周期"],
    [
      ["核心引擎", "Canvas 渲染、主循环、输入系统。", "第 1~2 周"],
      ["基础玩法", "坦克移动/射击、砖墙碰撞、敌人生成、基地守卫。", "第 2~3 周"],
      ["基础 UI", "主菜单、得分、生命、过关/失败判定。", "第 3~4 周"],
    ],
    [CONTENT_W * 0.22, CONTENT_W * 0.58, CONTENT_W * 0.20]
  ));
  children.push(h2("阶段二：增强（功能完善）"));
  children.push(makeTable(
    ["模块", "交付内容", "周期"],
    [
      ["关卡系统", "多关卡地图配置、难度曲线、地形类型（河流/草丛/冰面）。", "第 5~6 周"],
      ["道具系统", "六类道具掉落与增益效果、道具状态管理。", "第 6~7 周"],
      ["音效系统", "BGM 与事件音效、AudioManager、配置开关。", "第 7~8 周"],
    ],
    [CONTENT_W * 0.22, CONTENT_W * 0.58, CONTENT_W * 0.20]
  ));
  children.push(h2("阶段三：优化（体验打磨）"));
  children.push(makeTable(
    ["模块", "交付内容", "周期"],
    [
      ["性能优化", "对象池、DPR 适配、首屏分包加载、60fps 调优。", "第 9~10 周"],
      ["响应式/可访问", "移动端虚拟按键、布局自适应、视觉反馈替代。", "第 10~11 周"],
      ["数据持久化", "最高分/配置 localStorage、异常兜底、隐私合规。", "第 11~12 周"],
    ],
    [CONTENT_W * 0.22, CONTENT_W * 0.58, CONTENT_W * 0.20]
  ));

  // ---------- 7 风险评估 ----------
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h1("风险评估"));
  children.push(h2("技术风险"));
  children.push(makeTable(
    ["风险", "等级", "应对措施"],
    [
      ["音效兼容：部分浏览器/Safari 对 Web Audio 自动播放有限制。", "中", "提供静音降级；首次交互后再初始化音频上下文。"],
      ["帧率波动：低配设备粒子过多导致掉帧。", "中", "对象池 + 画质档位 + 性能监控动态降级。"],
      ["移动端兼容：触屏无键盘，需虚拟按键。", "中", "阶段三补充虚拟按键与手势适配。"],
    ],
    [CONTENT_W * 0.50, CONTENT_W * 0.12, CONTENT_W * 0.38]
  ));
  children.push(h2("用户体验风险"));
  children.push(bullet("难度平衡：敌人过快/过慢都影响留存。应对：基于关卡的权重与速度曲线做灰度调参，结合留存数据迭代。"));
  children.push(bullet("学习成本：新玩家不熟悉操作。应对：首关内置操作引导与常驻键位提示。"));
  children.push(bullet("重复疲劳：关卡单一导致流失。应对：丰富地图与道具组合，增加随机性。"));
  children.push(h2("安全风险"));
  children.push(bullet("本地存储污染：localStorage 被篡改或写入异常。应对：读写全程 try-catch，数据做合法性校验与默认值兜底。"));
  children.push(bullet("隐私合规：虽不上传数据，仍需在隐私说明中告知本地存储用途。"));
  children.push(bullet("XSS 隐患：若后续接入排行榜等远程数据，需对文本做转义与白名单过滤。"));

  // ---------- 8 附录 ----------
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h1("附录"));
  children.push(h2("附录 A：代码结构（建议）"));
  children.push(para("以下为推荐的模块化目录结构（基于 HTML5 + Canvas 实现）："));
  children.push(makeTable(
    ["目录/文件", "职责"],
    [
      ["index.html", "入口页面，挂载 Canvas 与 UI 容器。"],
      ["src/core/", "游戏主循环、状态机、事件总线。"],
      ["src/entities/", "PlayerTank、EnemyTank、Bullet、MapBlock、Item 等实体。"],
      ["src/systems/", "Input、Audio、Spawn、Collision、Score 等子系统。"],
      ["src/config/", "关卡、道具、按键、画质等配置数据。"],
      ["src/ui/", "菜单、侧边栏、暂停/结束面板。"],
      ["src/utils/", "对象池、数学、存储封装等工具。"],
    ],
    [CONTENT_W * 0.35, CONTENT_W * 0.65]
  ));
  children.push(h2("附录 B：操作说明"));
  children.push(numItem("打开支持 HTML5 的现代浏览器，访问游戏页面。"));
  children.push(numItem("点击“开始游戏”进入第一关。"));
  children.push(numItem("使用方向键移动，空格射击，清除全部敌人过关。"));
  children.push(numItem("拾取掉落道具获得增益，保护基地（老鹰）不被击毁。"));
  children.push(numItem("生命耗尽或基地被毁则游戏结束，可“再来一局”并冲击更高分数。"));
  children.push(h2("附录 C：术语表"));
  children.push(makeTable(
    ["术语", "含义"],
    [
      ["BGM", "背景音乐（Background Music）。"],
      ["AI", "敌方坦克的自动行为逻辑。"],
      ["DPR", "设备像素比（Device Pixel Ratio），用于高清屏适配。"],
      ["localStorage", "浏览器本地键值存储，用于持久化最高分与配置。"],
      ["TOC", "文档自动目录（Table of Contents）。"],
    ],
    [CONTENT_W * 0.30, CONTENT_W * 0.70]
  ));

  return children;
}

// =================================================================
// 构建文档
// =================================================================
const doc = new Document({
  creator: "游戏研发组",
  title: "坦克大战 HTML5 游戏产品需求文档",
  description: "坦克大战 HTML5 游戏 PRD",
  styles: {
    default: {
      document: { run: { font: FONT, size: 22 } }, // 11pt
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: C_PRIMARY, font: FONT },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C_SECONDARY, space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, color: C_SECONDARY, font: FONT },
        paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, color: "404040", font: FONT },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      {
        reference: "headings",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 360 } } },
            run: { font: FONT, bold: true, color: C_PRIMARY } },
          { level: 1, format: LevelFormat.DECIMAL, text: "%1.%2.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            run: { font: FONT, bold: true, color: C_SECONDARY } },
          { level: 2, format: LevelFormat.DECIMAL, text: "%1.%2.%3.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
            run: { font: FONT, bold: true, color: "404040" } },
        ],
      },
      {
        reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      },
      {
        reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      },
    ],
  },
  sections: [
    // 封面（独立 section，无页眉页脚）
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: cover(),
    },
    // 正文
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C_SECONDARY, space: 2 } },
            children: [run("坦克大战 HTML5 游戏 · 产品需求文档", { size: 18, color: "808080" })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C_SECONDARY, space: 2 } },
            children: [
              run("第 ", { size: 18, color: "808080" }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "808080" }),
              run(" 页 / 共 ", { size: 18, color: "808080" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: "808080" }),
              run(" 页", { size: 18, color: "808080" }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({ spacing: { before: 200, after: 240 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "目  录", font: FONT_TITLE, size: 36, bold: true, color: C_PRIMARY })] }),
        new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ children: [new PageBreak()] }),
        ...body(),
      ],
    },
  ],
});

const OUT = "/Users/junjian/工作/2026/WorkBuddy实战-0716/代码开发/坦克大战需求文档.docx";
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT, buffer);
  console.log("已生成：" + OUT + "  (" + buffer.length + " bytes)");
}).catch((e) => {
  console.error("生成失败：", e);
  process.exit(1);
});
