# 🎮 iBouncy - LeaferJS 弹球游戏

> 一个优雅、高性能的 Canvas 弹球游戏，基于 LeaferJS 构建

> 品牌字体：[Akaya Telivigala](https://fonts.google.com/specimen/Akaya+Telivigala)

[![GitHub license](https://img.shields.io/github/license/Horean0574/iBouncy)](https://github.com/Horean0574/iBouncy/blob/main/LICENSE)
[![Vite](https://img.shields.io/badge/built%20with-Vite-646CFF?logo=vite)](https://vite.dev/)
[![LeaferJS](https://img.shields.io/badge/powered%20by-LeaferJS-20A8D7)](https://leaferjs.com/)

## ✨ 特性亮点

- 🚀 **高性能渲染**：基于 LeaferJS Canvas 引擎，60fps 流畅体验
- 🎨 **精美视觉**：平滑动画、粒子拖尾、渐变遮罩
- 🎯 **物理碰撞**：精确的 AABB 碰撞检测与反弹物理
- ⚡ **现代架构**：TypeScript + ES Module + Vite，模块化与类型安全
- 📡 **事件通信**：集中式通道定义、载荷映射、桥接适配，便于扩展与阅读
- 📱 **响应式适配**：自动适应不同屏幕尺寸
- 🎮 **沉浸操控**：键盘 WASD/方向键控制，即时反馈

## 🎮 在线试玩

**[点击这里立即体验](https://www.ibouncy.one)**

> 💡 提示：使用 **WASD** 或 **方向键** 移动挡板，**空格键** 开始/重新游戏

## 🛠️ 本地运行

### 前置要求
- Node.js 16+
- npm 或 yarn

### 安装步骤
```bash
# 克隆项目
git clone https://github.com/Horean0574/iBouncy.git
cd iBouncy

# 安装依赖
npm install
# 或使用 yarn
yarn install
```

### 开发模式
```bash
npm run dev
```
访问 [http://localhost:5173](http://localhost:5173)

### 生产构建
```bash
npm run build
npm run preview  # 预览构建结果
```

### 类型检查
```bash
npm run typecheck
```

## 📁 项目结构

```text
iBouncy/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/                    # 构建时按 Vite 规则拷贝的静态资源（字体、图片等）
├── src/
│   ├── app.ts                 # 入口：装配事件桥、启动主循环
│   ├── config/                # 游戏与 UI 数值配置（GameConf / UIConf）
│   ├── core/
│   │   ├── instances.ts       # Leafer、Processor、各元素单例与工具聚合导出
│   │   ├── processor.ts     # 状态机、资源加载、生命周期 emit
│   │   └── interaction.ts   # 碰撞与边界检测
│   ├── events/                # 全局事件通信（通道、载荷、总线、桥接）
│   │   ├── channels.ts        # GEV 通道名与命名约定说明
│   │   ├── payloads.ts        # 各通道载荷类型（GameEventPayloadMap）
│   │   ├── bus.ts             # GameEventBus 实现与单例 eventBus
│   │   ├── catalog.ts         # GAME_EVENT_CATALOG 人类可读说明
│   │   ├── index.ts           # 对外统一导出
│   │   └── bridge/
│   │       ├── EventBridge.ts # createEventBridge：组装适配器
│   │       ├── deps.ts        # 桥接依赖（leafer / timer / setPrevTimeStamp）
│   │       └── adapters/      # 按职责拆分：页面、计时器同步、状态链
│   ├── elements/              # 游戏与 UI 节点（E_*）
│   ├── elements_extensions/   # 元素扩展（如拖尾）
│   ├── utils/                 # 计时器、遮罩层、键盘路由、UI 原型扩展等
│   ├── types/                 # 全局类型补充（如 Leafer UI 扩展）
│   └── vite-env.d.ts
└── README.md
```

## 📡 事件通信（概要）

- **通道**：`src/events/channels.ts` 中的 **`GEV`**，按 `system` / `ui` / `game` 等域命名，与 **`GameEventPayloadMap`** 一一对应。
- **总线**：`GameEventBus` 单例 **`eventBus`**（`instances` 中亦导出为 **`evBus`**，便于与游戏对象同文件导入）。
- **桥接**：`createEventBridge({ leafer, timer, setPrevTimeStamp })` 在 **`app.ts`** 启动时调用，将 Leafer/DOM 与玩法状态链映射到内部事件，**不反向依赖** `instances`，避免环状引用。
- **速查表**：`GAME_EVENT_CATALOG`（`src/events/catalog.ts`）为每个通道提供简短说明，便于新人阅读与检索。

扩展新事件时：在 **`channels.ts`** 增加常量 → 在 **`payloads.ts`** 补全载荷 → 在 **`catalog.ts`** 写一句说明 → 在订阅/发布处使用类型安全的 **`eventBus.emit` / `eventBus.on`**。

## 🎯 游戏机制

### 核心玩法
- **目标**：在 2 分钟内防止弹球掉落
- **控制**：移动挡板反弹弹球
- **计分**：根据碰撞速度和位置获得分数

### 物理系统
反弹加分公式：

$$
\Delta s=\frac{7}{10}(log_{2}v+\sec\frac{\pi v}{30})+\frac{3}{10}(\cos\frac{2\pi|x_2-x_1|}{w}+\frac{1}{2})
$$

其中：
- 本次总加分为 $\Delta s$
- 反弹时球速为 $v$
- 反弹时球中心横坐标为 $x_1$
- 反弹时挡板中心横坐标为 $x_2$
- 挡板宽度为 $w$

### 难度曲线
- 🟢 0-15 秒：基础速度
- 🟡 15-105 秒：速度逐渐增加
- 🔴 最后 15 秒：紧张倒计时动画

## 🔧 技术栈
| 技术                             | 用途         | 版本     |
|--------------------------------|----------|----------|
| [LeaferJS](https://leaferjs.com) | Canvas 渲染引擎 | 1.12.x |
| [Vite](https://vite.dev)       | 构建工具与开发服务器 | 7.x |
| [TypeScript](https://www.typescriptlang.org) | 类型与模块 | 5.x |

## 🤝 贡献指南
欢迎提交 Issue 和 Pull Request！
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 开源协议
本项目基于 MIT License 开源 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢
- 感谢 [LeaferJS](https://leaferjs.com) 团队提供的优秀 Canvas 引擎
- 灵感来源于经典弹球游戏
- 所有贡献者和问题反馈者

## 📞 联系与支持
- 🐛 问题反馈：[GitHub Issues](https://github.com/Horean0574/iBouncy/issues)
- 💡 功能建议：欢迎提交 Feature Request
- ⭐ 喜欢这个项目？ 点个 Star 支持一下！

> 由 LeaferJS 驱动，用 ❤️ 编码
