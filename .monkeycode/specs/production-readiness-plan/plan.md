# iBouncy 生产就绪评估与实施计划

## 概述

iBouncy 已经是一个功能相当完整的弹球游戏 -- 核心物理引擎、事件驱动架构、云端后端、精美的 UI 模态框和性能优化都已就位。但要在生产环境中实现完美的用户体验，还存在多个重要缺口。

---

## P0 - 阻塞发布的关键问题

| # | 问题 | 当前状态 | 需要做什么 | 影响范围 |
|---|------|---------|-----------|---------|
| 1 | **错误的 Leafer 依赖** | `package.json` 中同时存在 `@leafer-game/node` (Node 服务端) 和 `leafer-game` (浏览器端) | 移除 `@leafer-game/node`，这会导致浏览器运行时错误（Node API 不可用） | `package.json`, `instances.ts` |
| 2 | **缺少 Vite `allowedHosts` 配置** | `vite.config.ts` 中没有配置 `allowedHosts` | 添加 `server.allowedHosts: ['.monkeycode-ai.online']` | `vite.config.ts` |
| 3 | **loading.svg 路径错误** | `index.html` 引用 `./src/assets/svg/loading.svg`，但实际文件在 `public/svg/` | 修正为 `/svg/loading.svg` | `index.html` |
| 4 | **页面标题不完整** | `<title>iBouncy - H</title>` | 修正为有意义的标题，如 "iBouncy - LeaferJS 弹球游戏" | `index.html` |
| 5 | **缺少 favicon** | 没有任何 favicon 引用 | 添加 favicon 链接 | `index.html`, `public/` |
| 6 | **缺少 meta 标签 (SEO)** | 仅有 viewport meta，无 description/og 标签 | 添加 description, og:title, og:description, og:image | `index.html` |
| 7 | **API 缺少速率限制** | 无任何请求频率控制 | 添加简单的内存速率限制中间件 | `api/_lib/` |
| 8 | **API 缺少 CSRF 保护** | 使用 HttpOnly Cookie 但无 CSRF token | 实现 CSRF token 验证（Vercel Edge 兼容方案） | `api/_lib/`, `api/auth/` |

---

## P1 - 体验崩溃级问题

| # | 问题 | 当前状态 | 需要做什么 | 影响范围 |
|---|------|---------|-----------|---------|
| 9 | **完全没有音效** | 游戏完全静音 | 添加音效系统：反弹音、得分音、倒计时警告音、胜利/失败音。使用 Web Audio API 合成音或预加载短音频 | 新建 `src/audio/` |
| 10 | **无移动端/触摸支持** | 仅支持键盘操作 (WASD/方向键) | 添加触摸控制：屏幕左右区域虚拟摇杆，或手指拖动挡板 | `E_Tablet.ts`, `src/app.ts`, `index.html` |
| 11 | **无错误边界** | Canvas 初始化失败时显示白屏 | 捕获 Leafer 初始化异常，显示友好错误页面和重试按钮 | `bootstrap.ts`, `index.html` |
| 12 | **`@types/*` 被列为 `dependencies` 而非 `devDependencies`** | `@types/jsonwebtoken`, `@types/cookie` 在 `dependencies` 中 | 移动到 `devDependencies` | `package.json` |

---

## P2 - 用户体验完整性

| # | 问题 | 当前状态 | 需要做什么 | 影响范围 |
|---|------|---------|-----------|---------|
| 13 | **无首次使用引导** | 新玩家不知道如何操作 | 添加简洁的首次引导覆盖层（一个淡入提示动画） | `src/elements/E_Tutorial.ts` (新建) |
| 14 | **无密码重置流程** | 只有注册和登录 | 添加 "忘记密码" 功能 -- 需要邮箱发送服务，或至少 API 端点 | `api/auth/reset.ts`, `cloudOverlay.ts` |
| 15 | **无邮箱验证** | 注册时无需验证邮箱 | 添加验证码发送/验证流程（需要邮件服务） | `api/auth/verify.ts` |
| 16 | **无音效/音乐开关** | 一旦添加音效后用户无法关闭 | 在主菜单和暂停菜单添加音效/音乐开关图标 | `E_MainMenu.ts`, `E_OptionsMenu.ts` |
| 17 | **无难度选择** | 所有玩家使用相同的 120 秒时间限制 | 添加简单/普通/困难模式，调整时间限制和球速参数 | `E_MainMenu.ts`, `GameConf.ts` |
| 18 | **结算界面不显示得分** | 结算只显示 "You Win!" / "FAIL"，不显示最终得分 | 在结算界面添加得分展示和激励文案 | `E_Settlement.ts` |

---

## P3 - 游戏深度与留存

| # | 问题 | 当前状态 | 需要做什么 | 影响范围 |
|---|------|---------|-----------|---------|
| 19 | **无连击/Combo 系统** | 每次命中得分独立，无连击加成 | 添加连击计数器，连续命中获得递增倍率加成 | `core/interaction.ts`, `E_Scoring.ts` |
| 20 | **无道具/能力系统** | 纯反弹，无变化 | 添加道具系统：扩大挡板、减速球、磁铁效果、额外生命 | 新建 `src/elements/E_PowerUp.ts`, `src/core/powerups.ts` |
| 21 | **排行榜功能有限** | 只有全局前 50，无时间筛选 | 添加日榜/周榜/月榜切换 | `api/scores/leaderboard.ts`, `cloudOverlay.ts` |
| 22 | **无成就系统** | 无里程碑奖励 | 添加本地成就：首次游戏、100分、500分、1000分、完美结束等 | 新建 `src/cloud/achievements.ts` |
| 23 | **碰撞粒子特效缺失** | 碰撞点无视觉反馈（仅有得分提示浮动） | 添加碰撞火花粒子效果 | 新建 `src/elements_extensions/X_CollisionParticle.ts` |

---

## P4 - 工程质量与可靠性

| # | 问题 | 当前状态 | 需要做什么 | 影响范围 |
|---|------|---------|-----------|---------|
| 24 | **零自动化测试** | 项目中没有任何测试文件或测试框架 | 添加 Vitest + 单元测试覆盖核心逻辑（碰撞检测、计分公式、状态机） | `package.json`, 新建 `tests/` |
| 25 | **无代码检查/格式化工具** | 无 ESLint/Prettier 配置 | 添加 ESLint + Prettier 配置，并修复所有问题 | 新建 `eslint.config.js`, `.prettierrc` |
| 26 | **无 CI/CD** | 无 GitHub Actions | 添加 CI 流程：lint → typecheck → test → build | 新建 `.github/workflows/ci.yml` |
| 27 | **无 PWA 支持** | 不支持离线或安装 | 添加 `manifest.json` + Service Worker 实现 PWA | `public/manifest.json`, `public/sw.js` |
| 28 | **无性能分析/监控** | 游戏性能无数据反馈 | 添加基础的 FPS/帧时间统计日志（开发模式）或集成简单的 analytics | `src/app.ts` |
| 29 | **TypeScript 严格程度不足** | 使用 `as` 类型断言绕过了类型检查 | 审查并修复危险类型断言，添加更安全的类型守卫 | `E_Scoring.ts`, `E_Ball.ts`, `MaskLayer.ts` |
| 30 | **API 缺少输入校验增强** | 部分 API 依赖前端校验 | 在服务端添加更严格的输入校验和限制（邮箱长度、分数范围） | `api/scores/add.ts`, `api/auth/register.ts` |

---

## P5 - 长期优化

| # | 问题 | 当前状态 | 需要做什么 | 影响范围 |
|---|------|---------|-----------|---------|
| 31 | **多语言/国际化** | 所有 UI 文本硬编码为中文 | 添加 i18n 框架基础（中/英），所有 UI 文本从配置读取 | 新建 `src/i18n/` |
| 32 | **无障碍 (A11y)** | 无 ARIA 标签、无焦点管理、无键盘导航 | 添加基本无障碍支持：角色声明、替代文本、焦点陷阱 | `index.html`, `cloudOverlay.ts` |
| 33 | **Canvas 大小适配问题** | Leafer 画布使用视口大小，但缺少 DPR 处理 | 在高 DPI 屏幕上添加 `devicePixelRatio` 适配 | `instances.ts`, `Leafer` 配置 |
| 34 | **社交分享功能** | 无法分享成绩 | 添加 "分享成绩" 按钮，生成带分数的分享图片 | `E_Settlement.ts`, 新建工具函数 |
| 35 | **赛后回放** | 无法查看历史对局回放 | 记录每帧状态数据，支持回放模式 | 需要大量架构改动，标记为探索性 |

---

## 推荐执行顺序

```
第1轮 (P0): #1-#8    → 项目可运行、可部署
第2轮 (P1): #9-#12   → 核心体验完整（音效+移动端）
第3轮 (P2): #13-#18  → 用户体验打磨
第4轮 (P3): #19-#23  → 游戏深度提升
第5轮 (P4): #24-#30  → 工程质量达标
第6轮 (P5): #31-#35  → 持续优化迭代
```

预计完成 P0-P2 后（约 18 项任务），项目即可达到生产就绪状态，提供令人满意的用户体验。
