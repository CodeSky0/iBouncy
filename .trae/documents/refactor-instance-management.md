# 重构实例管理 - 减少 instances.ts 的职责

## Context

`src/core/instances.ts` 目前是一个“全能模块”，集中了过多不相关的职责：

- 转发事件总线 (`evBus` / `GEV`)
- 定义数学辅助函数 (`D` / `C` / `F`)
- 管理 `prevTimeStamp` 状态
- 查询 DOM (`#loading`)
- 调用 `extendUI()` 副作用
- 创建核心运行时实例 (`leafer`、`GP`、`GI`、`timer`)
- 管理性能降级开关 (`effectsEnabled`)
- 创建所有 UI / 游戏元素单例
- 初始化 `MaskLayer`
- 创建 `KeyboardSolution`

这导致大量模块反向依赖 `instances.ts`，实例初始化顺序和职责边界混乱。本次重构目标是：把非实例管理职责拆出去，让 `instances.ts` 只保留“游戏运行时单例注册表”。

## Recommended Approach

### 1. 抽取通用辅助模块

| 新文件 | 内容 |
| --- | --- |
| `src/utils/math.ts` | `D = Math.abs`、`C = Math.ceil`、`F = Math.floor` |
| `src/core/effects.ts` | `effectsEnabled` 状态与 `setEffectsEnabled` |
| `src/app/dom.ts` | `loading = document.querySelector("#loading")` |
| `src/app/timing.ts` | `prevTimeStamp` 与 `setPrevTimeStamp` |
| `src/app/initUI.ts` | 仅执行 `extendUI()` 的副作用模块 |

### 2. 解耦 `Processor`

修改 `src/core/processor.ts`：

- 构造器接收 `leafer: Leafer`，内部使用 `this.#leafer` 替代导入的 `leafer`
- 新增 `setScoreSource(source: () => number)`，让 `gameOver` 不再直接依赖 `Scoring`
- 删除 `initializeAll()`、`secondRender()`、`loadingFadeOut()`
- 删除对 `MainMenu`、`Scoring`、`Settlement`、`loading` 的导入
- 修复 `measureRefreshRate()` 中 `GP.ENV = ...` 为 `this.ENV = ...`

### 3. 解耦 `Interaction`

修改 `src/core/interaction.ts`：

- 构造器接收 `{ Ball, Tablet, timer }`，存储为私有字段
- 删除从 `instances.ts` 导入 `Ball`、`Tablet`、`timer`

### 4. 拆分 UI 遮罩/菜单单例

新建 `src/ui/elements.ts`，包含：

- `Mask`、`MainMenu`、`OptionsMenu`、`Settlement`、`FPS`、`ForbiddenZone`、`Scoring`

`Timing` 仍保留在 `instances.ts`，因为 `E_Ball` 直接依赖它，移出会引入循环依赖。

### 5. 精简 `src/core/instances.ts`

保留为“游戏运行时注册表”，仅包含：

```text
leafer、GP、GI、timer、Ball、Tablet、Timing
```

变更：

- 顶部 `import "../app/initUI"` 确保 UI 扩展先执行
- 创建 `GI` 时注入 `Ball`、`Tablet`、`timer`
- 移除 `evBus`/`GEV` 重导出、`D`/`C`/`F`、`effectsEnabled`、`loading`、`prevTimeStamp`、`KS` 创建、`ML.$init`

### 6. 新建启动装配层 `src/app/bootstrap.ts`

职责：

- 首先 `import "./initUI"`
- 从 `instances.ts` 和 `ui/elements.ts` 引入单例
- 创建 `KeyboardSolution` 并导出 `KS`
- 调用 `ML.$init(MainMenu, OptionsMenu, Settlement)`
- 装配 `createEventBridge`
- 同步初始视口
- 注册 `#loading` 淡出监听器（监听 `GEV.GAME_PREPARED`）
- 注入 `GP.setScoreSource(() => Scoring.v)`
- 导出 `initializeApp()`：执行 `MainMenu.init()`、`Scoring.init_()`、`Settlement.init_()`、`MainMenu.render_()`、`GP.state("init1")`

### 7. 更新 `src/app.ts`

- 从 `bootstrap.ts` 引入 `KS` 和 `initializeApp`
- 从 `instances.ts` 引入 `leafer`、`GP`、`GI`、`timer`、`Ball`、`Tablet`
- 从 `ui/elements.ts` 引入 `Mask`、`FPS`
- 从 `effects.ts` 引入 `effectsEnabled` / `setEffectsEnabled`
- 从 `events` 直接引入 `evBus` / `GEV`
- 从 `timing.ts` 引入 `prevTimeStamp` / `setPrevTimeStamp`
- 用 `initializeApp()` 替换原来的 `GP.initializeAll().then(GP.secondRender).then(...)`

### 8. 更新所有消费者

需要修改导入路径的文件：

- `src/utils/MaskLayer.ts` → 从 `ui/elements.ts` 引入 `Mask`
- `src/utils/KeyboardSolution.ts` → 从 `instances.ts` 引入 `leafer`，从 `events` 引入 `evBus`/`GEV`
- `src/utils/UIExtensions.ts` → 从 `instances.ts` 引入 `leafer`
- `src/elements/E_Ball.ts` → `effectsEnabled` 来自 `effects.ts`，`evBus`/`GEV` 来自 `events`，`GI`/`GP`/`leafer` 来自 `instances.ts`，`Timing` 来自 `instances.ts`
- `src/elements/E_Tablet.ts`、`E_Mask.ts`、`E_MainMenu.ts`、`E_OptionsMenu.ts`、`E_Settlement.ts`、`E_FPS.ts`、`E_ForbiddenZone.ts` → 类似更新
- `src/elements/E_Scoring.ts` → `Ball` 来自 `instances.ts`，`effectsEnabled` 来自 `effects.ts`，`F` 来自 `math.ts`，`evBus`/`GEV` 来自 `events`，`GP`/`leafer`/`timer` 来自 `instances.ts`
- `src/elements/E_Timing.ts` → `F` 来自 `math.ts`，`evBus`/`GEV` 来自 `events`，`GP`/`timer` 来自 `instances.ts`
- `src/elements_extensions/X_BallTrailing.ts` → `Ball` 来自 `instances.ts`，`C`/`F` 来自 `math.ts`，`GP`/`leafer` 来自 `instances.ts`

## Implementation Order

1. 创建 `math.ts`、`effects.ts`、`dom.ts`、`timing.ts`、`initUI.ts`
2. 重构 `Processor` 和 `Interaction`
3. 精简 `instances.ts`
4. 创建 `ui/elements.ts`
5. 创建 `bootstrap.ts`
6. 更新 `app.ts`
7. 批量更新消费者导入
8. 运行 `npm run typecheck`，修复类型错误
9. 运行 `npm run build`，确保构建通过

## Verification

- `npm run typecheck`：无 TypeScript 错误
- `npm run build`：Vite 构建成功
- （可选）`npm run dev` 手动验证游戏启动、菜单、暂停、结束流程正常
