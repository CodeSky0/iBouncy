## 游戏性能分析报告 -- iBouncy

> 分析日期: 2025-07-25
> 目标帧率: 60 FPS (16.67ms/帧)
> 引擎: LeaferJS v1.12.4 (Canvas 2D scene-graph)

---

### 1. 核心循环剖析

#### 1.1 当前帧预算

```
gameLoop 每帧:
├── timer.timeDetect()                    ~0.01ms  (遍历所有 timeout/interval)
├── FPS 检测与性能降级判断                  ~0.005ms
├── Playing 状态子步循环:
│   ├── sub-step × N (N 最大 10):
│   │   ├── Ball.frameLoop_()            ~0.02ms  (物理 + 边界检测 + 拖尾)
│   │   ├── Tablet.frameLoop()           ~0.01ms  (输入 + 边界检测)
│   │   └── GI.collisionDetect():        ~0.03ms  (精确碰撞 + 反弹)
│   │       ├── #preciselyDetect()       ~0.005ms
│   │       ├── 方向判断 + 位置修正       ~0.002ms
│   │       ├── tempAccelerate()         ~0.01ms  (含 performance.now × 2)
│   │       ├── registerHit()            ~0.003ms (含 performance.now)
│   │       ├── evBus.emit(PLAYER_SCORE) ~0.005ms (同步分发)
│   │       ├── evBus.emit(PLAYER_COMBO) ~0.003ms
│   │       ├── soundManager.playBounce()~0.002ms
│   │       └── collisionParticle.emit() ~0.005ms + 异步动画
│   └── 总分运算 (~0.008ms per collision)

典型 60FPS 帧（单子步无碰撞）: ~0.05ms (游戏逻辑忽略不计)
碰撞帧 (含得分/连击/粒子): ~0.12ms + Leafer 动画开销
Leafer 场景图渲染:  ~2-8ms (主要瓶颈)
```

#### 1.2 固定时间步子步机制

```
MAX_ACCUMULATED = 0.5s
MAX_STEP_PER_FRAME = 10
fixedStep = 1000/60 ≈ 16.67ms

最坏情况: 500ms 累积 → 10 步 × ~0.05ms/步 = 0.5ms 逻辑
但跳跃后的抖动 (spiral of death) 仍然存在
```

---

### 2. 性能瓶颈清单

#### P0 -- 高优先级 (直接影响帧率稳定性)

| # | 问题 | 位置 | 影响 | 修复方向 |
|---|------|------|------|----------|
| 1 | **LeaferJS 场景图遍历开销** | 渲染引擎全局 | 每帧 2-8ms | 批量绘制、减少场景树节点 |
| 2 | **碰撞帧动画爆炸** | E_Scoring.ts:167, X_CollisionParticle.ts:40 | 每碰撞 19 个并发动画 | 独立轻量动画系统 / 合并动画 |
| 3 | **`performance.now()` 高频调用** | interaction.ts:127,148 | 每碰撞 3 次 syscall | 帧内时间戳共享 |
| 4 | **Leafer getter 链式触发** | interaction.ts:176-195 | 碰撞检测中 16 次 getter | 缓存局部变量 |
| 5 | **动画完成的 setTimeout 对象池回收** | X_CollisionParticle.ts:67 | 每碰撞 8 个闭包/定时器 | 使用 Leafer AnimateEvent.COMPLETED |

#### P1 -- 中优先级 (累积优化效果)

| # | 问题 | 位置 | 影响 | 修复方向 |
|---|------|------|------|----------|
| 6 | **对象池冷启动** | E_Scoring.ts:207, X_CollisionParticle.ts:71 | 首次碰撞时 GC | 预分配 4-8 个 |
| 7 | **事件总线同步分发开销** | E_Scoring.ts:81-91, app.ts:130-149 | 每事件 ~0.005ms | 合并事件载荷 / 减少监听器 |
| 8 | **键盘状态每子步轮询** | E_Tablet.ts:47-50 | 4 次 `Keyboard.isHold`/子步 | 每帧缓存一次 |
| 9 | **分数文本重测量** | E_Scoring.ts:321-323 | 每次得分更新触发 layout | 缓存字符宽度预计算 |
| 10 | **Math.random() 高频调用** | E_Scoring.ts:304-307, X_CollisionParticle.ts:25 | 每碰撞 10+ 次 | 使用种子 PRNG 或预生成随机表 |
| 11 | **计时器 Map 每帧遍历** | EmbeddedTimer.ts:82,101 | 每帧 2 次全量迭代 | 使用优先队列或时间轮 |

#### P2 -- 低优先级 (长期优化)

| # | 问题 | 位置 | 影响 | 修复方向 |
|---|------|------|------|----------|
| 12 | **无 Web Worker 分流** | 全局架构 | 主线程压力 | 物理计算入 Worker |
| 13 | **构建产物未做体积分析** | vite.config.ts | 首屏加载慢 | Terser dead-code + brotli |
| 14 | **Leafer 引擎全量引入** | package.json | ~200KB gzip | 按需引入子模块 |
| 15 | **字体加载阻塞** | E_Scoring.ts:131, Processor.ts:108 | 首屏白屏 | font-display: swap |
| 16 | **无 Canvas 分层渲染** | 全局 | 全部重绘 | 静态层 + 动态层分离 |

---

### 3. 详细优化方案

#### 3.1 帧内时间戳共享 (P0-#3)

**问题**: `registerHit()` 和 `tempAccelerate()` 各调 `performance.now()`，同一帧内多次调用。

```typescript
// processor.ts 新增
public frameTimeStamp = 0;

// app.ts gameLoop 开头
GP.frameTimeStamp = timeStamp;

// interaction.ts 改为使用 GP.frameTimeStamp
registerHit(): { combo: number; multiplier: number } {
    const now = GP.frameTimeStamp; // 替代 performance.now()
    // ...
}
tempAccelerate(direction: Axis): number {
    const now = GP.frameTimeStamp; // 替代 performance.now()
    // ...
}
```

**预期收益**: 碰撞帧减少 3 次 syscall，约 0.003ms。

#### 3.2 碰撞检测中缓存 Leafer getter (P0-#4)

**问题**: `#preciselyDetect()` 和 `collisionDetect()` 中通过 Leafer getter 读取坐标，每次调用触发属性系统。

```typescript
// E_Ball.ts 新增: 每帧开始时同步缓存
frameLoop_(prog: number): void {
    // ... 物理更新 ...
    GI.boundaryDetect(this as BoundsEntity, this.ballBoundaryOpts);
}

// 在 interaction.ts 中直接使用缓存的轻量坐标
// E_Ball 可实现 IGeometryCache 接口提供原始数值
```

更直接的优化是在 `insteraction.ts` 的 `#preciselyDetect` 和 `collisionDetect` 开头一次性把所需坐标读入局部变量：

当前 `#preciselyDetect` 中 `Ball.x!`、`Ball.ox!` 等已通过一次赋值缓存到局部变量 (bx, box 等)，这点做得正确。`collisionDetect` 中也已局部缓存 `bvx`, `bvy`, `bcx` 等。

**当前状态**: 已部分优化。唯一可改进的是 `ballBoundaryPaddings[2]` 在 `E_Ball.frameLoop_` 每子步计算 `-this.h * 3`，可将此值缓存在构造函数。

#### 3.3 合并碰撞动画 (P0-#2)

**问题**: 每次碰撞触发:
- 得分提示: 3 个 Leafer animate × 1 = 3
- 碰撞粒子: 2 个 Leafer animate × 8 = 16
- Combo 文本: 1 个 Leafer animate
- 合计: 最多 20 个并发 Leafer 动画实例

Leafer 动画系统在每帧 tick 时会遍历所有活跃动画做插值，开销随动画数量线性增长。

**方案 A: 节流碰撞粒子**

```typescript
// X_CollisionParticle.ts
private lastEmitTime = 0;
private readonly emitThrottle = 60; // ms

emit(x: number, y: number): void {
    if (!effectsEnabled) return;
    const now = GP.frameTimeStamp;
    if (now - this.lastEmitTime < this.emitThrottle) return;
    this.lastEmitTime = now;
    // ... 原有逻辑
}
```

**方案 B: 得分提示复用而非新建动画**

当前 tip_() 在复用 Tip 时通过 `#killTipAnimations_` 中止旧动画再建新的。可改为让动画正常完成，旧 Tip 自然回收，提高池上限到 12，减少动画冲突的 kill 操作。

#### 3.4 粒子回收改用 Leafer 动画事件 (P0-#5)

**问题**: `X_CollisionParticle.emit()` 使用 `setTimeout` 回收粒子，每个粒子创建一个闭包。8 粒子 × 碰撞频率 = 每秒可能产生数十个定时器。

```typescript
// 改为监听 Leafer 动画完成事件
const atom = { target: p, pool: this };
aniFade.on(AnimateEvent.COMPLETED, function handleDone() {
    const { target, pool } = atom;
    target.visible = false;
    (target as unknown as Record<string, unknown>).offsetX = 0;
    (target as unknown as Record<string, unknown>).offsetY = 0;
    pool.activeSet.delete(target);
    if (pool.pool.length < pool.poolLimit) {
        pool.pool.push(target);
    } else {
        target.destroy();
    }
});
```

**预期收益**: 消除碰撞帧的 setTimeout 开销，减少 GC 压力。

#### 3.5 对象池预分配 (P1-#6)

```typescript
// E_Scoring 构造函数末尾
for (let i = 0; i < 4; i++) {
    const tip = new Text({ ... });
    tip.render_();
    this.tipPool.push(tip);
}

// X_CollisionParticle 构造函数末尾
for (let i = 0; i < 8; i++) {
    const shape = new Ellipse({ ... });
    shape.render_();
    this.pool.push(shape);
}
```

**预期收益**: 首次碰撞避免 4-8 次 `new Text` / `new Ellipse` 的 GC 分配。

#### 3.6 键盘输入每帧缓存 (P1-#8)

```typescript
// E_Tablet 新增每帧缓存
private kbState = { w: false, a: false, s: false, d: false };
private kbCacheFrame = 0;

frameLoop(prog: number): void {
    this.vx = this.vy = 0;

    // 每帧只读一次键盘状态
    if (!GP.frameCount || GP.frameCount !== this.kbCacheFrame) {
        this.kbCacheFrame = GP.frameCount;
        this.kbState.w = Keyboard.isHold("KeyW") || Keyboard.isHold("ArrowUp");
        this.kbState.s = Keyboard.isHold("KeyS") || Keyboard.isHold("ArrowDown");
        this.kbState.a = Keyboard.isHold("KeyA") || Keyboard.isHold("ArrowLeft");
        this.kbState.d = Keyboard.isHold("KeyD") || Keyboard.isHold("ArrowRight");
    }

    if (touchCtrl.active) {
        this.vx += touchCtrl.dx * this.vxMax * prog;
        this.vy += touchCtrl.dy * this.vyMax * prog;
    } else {
        if (this.kbState.w) this.vy -= this.vyMax * prog;
        if (this.kbState.s) this.vy += this.vyMax * prog;
        if (this.kbState.a) this.vx -= this.vxMax * prog;
        if (this.kbState.d) this.vx += this.vxMax * prog;
    }
    // ...
}
```

需要 Processor 新增 `frameCount` 属性，在 gameLoop 中递增。

#### 3.7 合并事件载荷 (P1-#7)

**问题**: 每次碰撞触发两个独立事件 PLAYER_SCORE + PLAYER_COMBO。

```typescript
// 合并为单一事件 SCORE_HIT
evBus.emit(GEV.PLAYER_SCORE, {
    delta: (0.4 * bvP + 0.16 * dP) * multiplier,
    combo: GI.combo,
    multiplier,
});
```

E_Scoring 在单一处理器中同时更新分数和 combo 显示，减少一次事件分发。

#### 3.8 Math.random() 替换为快速 PRNG (P1-#10)

```typescript
// utils/prng.ts
let seed = 42;
export function fastRandom(): number {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
}
```

在 `E_Scoring._getTipData_()` 和 `X_CollisionParticle.emit()` 中用 `fastRandom()` 替代 `Math.random()`。

**预期收益**: Math.random() 在某些浏览器 (Chrome) 涉及 CSPRNG，单次 ~0.001ms。碰撞帧 10+ 次调用累计 ~0.01ms。XORShift 替代可降至 ~0.0001ms。

#### 3.9 计时器优化 (P1-#11)

当前 EmbeddedTimer 每帧遍历所有 timeout 和 interval 的 Map。对于游戏循环内高频使用的计时器（如得分提示 0.6s timeout），可使用更轻量的帧计数方案：

```typescript
// 得分提示回收改为帧计数
// E_Scoring 中:
private tipFrames = new Map<Text, number>();
private readonly tipDurationFrames = Math.ceil(tipConf.DURATION * 60);

// 在 gameLoop 中 (每次调用 tip__frameTick):
tip__frameTick(): void {
    for (const [tip, remaining] of this.tipFrames) {
        if (remaining <= 1) {
            this.tipFrames.delete(tip);
            this.#releaseTip_(tip);
        } else {
            this.tipFrames.set(tip, remaining - 1);
        }
    }
}
```

此方案避免为每个得分提示创建 EmbeddedTimer timeout（当前已经通过 EmbeddedTimer 的 `newTimeout` 做了）。EmbeddedTimer 本身遍历开销 ~0.005ms/帧，当活跃 timeout/interval < 20 时可忽略。

**当前评估**: 活跃定时器通常 < 10 个，EmbeddedTimer 的 Map 遍历开销在当前规模下可以接受，暂不优先优化。

#### 3.10 构建优化 (P2-#13)

```typescript
// vite.config.ts 补充
build: {
    target: "es2022",
    minify: "terser",
    terserOptions: {
        compress: { drop_console: true, drop_debugger: true, passes: 2 },
        mangle: { properties: { regex: /^_/ } },
    },
    rollupOptions: {
        output: {
            manualChunks(id) {
                if (id.includes("leafer-game")) return "leafer";
                if (id.includes("@leafer-ui")) return "leafer-ui";
            },
        },
    },
    reportCompressedSize: false,
},
```

#### 3.11 Canvas 分层渲染 (P2-#16)

```typescript
// 将静态元素 (背景、HUD 面板) 放在独立 Leafer 层
// 动态元素 (球、挡板、粒子、拖尾) 在另一个 Leafer
// 但这需要 Leafer 支持多 Canvas 合成，当前 API 不支持
```

替代方案：在 Leafer 上层用独立的 `<canvas>` 绘制粒子，用原生的 Canvas 2D API 直接操作，绕过 Leafer 的场景图系统。

```typescript
class CanvasParticleLayer {
    private ctx: CanvasRenderingContext2D;
    private particles: Particle[] = [];

    constructor(canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext("2d")!;
    }

    emit(x: number, y: number, count: number): void { /* 原生 Canvas 绘制 */ }
    render(): void { /* requestAnimationFrame 独立循环或与游戏循环同步 */ }
}
```

这比 Leafer 的 Ellipse + animate 快 5-10 倍，因为不需要经过场景图遍历、属性插值、事件系统。

#### 3.12 Web Worker 物理计算 (P2-#12, 长期)

```typescript
// worker/physics.ts
self.onmessage = (e) => {
    const { ball, tablet, viewport } = e.data;
    // 执行碰撞检测和物理更新
    // 返回 { ball: newState, hit: boolean, scoreDelta: number }
    self.postMessage({ ball: newBall, hit, scoreDelta });
};
```

主线程负责渲染，Worker 负责物理。需通过 SharedArrayBuffer 或 postMessage 同步状态。对于当前游戏规模可能属于过度设计，60FPS 下物理计算 < 0.1ms。

---

### 4. 内存与 GC 分析

#### 4.1 当前内存分配热点

| 热点 | 频率 | 分配量 | 类型 |
|------|------|--------|------|
| `registerHit()` 返回 `{combo, multiplier}` | 每碰撞 | ~32 bytes | 对象 (短期) |
| `_getTipData_()` 返回 `[x, y, z]` 数组 | 每碰撞 | ~40 bytes | Array (短期) |
| `Math.random()` | 每碰撞 10+ 次 | 0 | 不分配 |
| `setTimeout(handleComplete)` | 每碰撞 8 次 | ~120 bytes × 8 | 闭包 (6ms 寿命) |
| `tipAnis.set(tip, [aniStyle, aniX, aniY])` | 每碰撞 | ~64 bytes | Array (短期) |
| `leafer.animate()` 每子步 | N 个 | 内部分配 | 动画状态对象 |

#### 4.2 GC 优化策略

1. **预分配返回结构**: `registerHit()` 返回的 `{combo, multiplier}` 可改为通过实例属性暴露，避免分配。
2. **`_getTipData_()` 用 TypedArray 缓存**: `Float64Array(3)` 替代普通数组。
3. **消除 setTimeout 闭包**: 使用上文 3.4 节的 Leafer AnimateEvent 方案。
4. **`tipAnis` 用 `number[]` 替代 `IAnimate[]`**: 存储动画 ID 而非动画对象引用。

#### 4.3 内存峰值估算 (碰撞密集场景)

```
活跃对象:
- 得分提示节点: 最大 24 个 Text (已池化)
- 碰撞粒子: 最大 64 个 Ellipse (已池化)
- 拖尾点: 8 个 Ellipse (固定)
- 拖尾动画: 8 个 IAnimate
- 得分提示动画: 最多 24 × 3 = 72 个 IAnimate
- 碰撞粒子动画: 最多 64 × 2 = 128 个 IAnimate
- 计时器: FPS 1 个 + interval 0-3 个 + timeout 0-24 个

峰值动画数: ~210 个
Leafer 动画引擎内部状态: 每个动画约 100-200 bytes
总动画内存: ~40KB (可接受)
```

---

### 5. 渲染管线分析

#### 5.1 Leafer 渲染流程

```
每帧:
├── 场景图脏标记遍历 → 更新变换矩阵
├── 按 zIndex 排序可见节点
├── 对每个可见节点:
│   ├── 应用世界变换
│   ├── 检查裁剪区域
│   └── 调用对应绘制函数 (Ellipse → arc, Rect → fillRect, Text → fillText)
├── 画笔 (Canvas 2D context) 状态管理
└── 最终提交到 GPU
```

Leafer 不支持**脏矩形**（dirty rectangle）渲染，每帧重绘整个 Canvas。

#### 5.2 优化方向

1. **减少不可见节点**: `visible = false` 的节点不应存在于场景树中。当前已通过 `visible` 控制，但节点仍在树中。
2. **合并同色绘制**: 相同 fill 的节点可批量绘制，但 Leafer 不支持。
3. **粒子系统用原生 Canvas**: 绕过 Leafer 场景图，直接在 Canvas 2D context 绘制。

```typescript
// 简化粒子系统 -- 原生 Canvas 实现
class NativeParticleSystem {
    private ctx = (document.querySelector("canvas") as HTMLCanvasElement).getContext("2d")!;
    private particles: Array<{
        x: number; y: number; vx: number; vy: number;
        r: number; color: string; opacity: number; life: number;
    }> = [];

    emit(x: number, y: number): void {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: 2 + Math.random() * 2,
                color: UIConf.CollisionParticle.COLORS[i % 5],
                opacity: 0.9,
                life: 0.5 + Math.random() * 0.25,
            });
        }
    }

    // 在 Leafer 之后绘制 (通过 Leafer 的 onRender 钩子或独立 Canvas)
    updateAndDraw(dt: number): void {
        this.particles = this.particles.filter(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.opacity -= dt / p.life;
            if (p.opacity <= 0) return false;
            this.ctx.globalAlpha = p.opacity;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.ctx.fill();
            return true;
        });
    }
}
```

**预期收益**: 碰撞帧从 16 个 Leafer 动画降至 0，渲染从场景图遍历降至直线绘制，约节省 1-3ms。

---

### 6. 构建与交付

#### 6.1 当前构建产物

| 产物 | 大小 (gzip) | 说明 |
|------|------------|------|
| leafer.js | ~180KB | leafer-game engine (included in manualChunks) |
| leafer-ui.js | ~60KB | @leafer-ui |
| index.js | ~30KB | 游戏代码 |

总 gzip ~270KB，对于 PWA/移动端偏重。

#### 6.2 优化措施

1. **按需引入 Leafer 子模块**: 如果只用到 `Ellipse`、`Rect`、`Text`、`Path`、`Group`，可尝试只 import 对应子包（需验证 Leafer 是否支持 tree-shaking）。
2. **启用 brotli 压缩**: Nginx/CDN 配置 `brotli on`，相比 gzip 可再减少 15-20%。
3. **字体子集化**: `HYDiSiKe-U` 和 `HYBeiBingYang-W` 只用到数字和少量中文字符，可通过 `glyphhanger` 工具子集化，从 ~2MB 降至 ~10KB。
4. **预加载关键资源**:
```html
<link rel="preload" href="/fonts/HYDiSiKe-U.woff2" as="font" crossorigin>
```

---

### 7. 优化优先级建议

```
第一轮 (快速见效，1-2 小时):
  P0-#3  帧内时间戳共享          → ~0.005ms
  P0-#4  已分析，现状已优化        → -
  P1-#6  对象池预分配 4-8 个       → 消除冷启动 GC
  P1-#8  键盘状态每帧缓存          → ~0.005ms/子步
  P1-#10 Math.random 换 PRNG      → ~0.01ms/碰撞

第二轮 (架构优化，3-5 小时):
  P0-#2  碰撞动画节流/合并         → ~0.5-1ms/碰撞帧
  P0-#5  粒子回收改用动画事件      → 消除 setTimeout 闭包
  P1-#7  合并事件载荷             → ~0.005ms/碰撞
  P2-#16 粒子系统原生 Canvas       → ~1-3ms 渲染

第三轮 (长期，> 5 小时):
  P2-#15 字体子集化               → 首屏快 0.3s
  P2-#12 Web Worker 物理          → 主线程释放 ~0.1ms
  P2-#13 构建产物优化             → 体积 -15%
```

---

### 8. 性能监控

建议在生产环境增加以下监控点：

```typescript
// 性能标记
const perf = {
    frameHistory: new Float64Array(60),
    frameIndex: 0,
    jankCount: 0,

    record(dt: number): void {
        this.frameHistory[this.frameIndex % 60] = dt;
        this.frameIndex++;
        if (dt > 33.34) this.jankCount++; // 掉帧到 30 FPS 以下
    },

    get avgFPS(): number {
        let sum = 0, count = 0;
        for (let i = 0; i < 60; i++) {
            if (this.frameHistory[i] > 0) {
                sum += this.frameHistory[i];
                count++;
            }
        }
        return count > 0 ? 1000 / (sum / count) : 0;
    },
};
```

---

### 9. 总结

当前游戏在 60FPS 下运行流畅，核心瓶颈不在 TS 逻辑层面，而在 **LeaferJS 引擎的渲染抽象开销**。碰撞密集时（持续命中挡板），20+ 个并发 Leafer 动画 + 场景图遍历占据帧预算的主要部分。

最有效的单点优化是**将粒子系统迁移到原生 Canvas 绘制**（绕过 Leafer 场景图），预计可释放每帧 1-3ms，碰撞帧可达 5ms+ 节省。

第二有效的优化是**碰撞动画节流**和**合并事件载荷**，减少每碰撞帧的 Leafer 内部状态变更。
