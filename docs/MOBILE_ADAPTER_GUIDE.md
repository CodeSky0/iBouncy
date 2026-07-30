# 移动端适配使用指南

## 功能概述

本项目已实现完整的移动端适配功能，支持 Android、iOS 和 Harmony OS 等移动操作系统。主要功能包括：

1. **设备检测**：自动识别移动设备、平板和桌面设备
2. **横屏提示**：在竖屏模式下提示用户旋转设备以获得更好的体验
3. **虚拟摇杆**：为没有物理键盘的移动设备提供虚拟方向控制器

## 自动触发机制

### 设备检测

系统会在初始化时自动检测设备类型：

- **移动设备**：通过 User-Agent 识别 iPhone、Android、Windows Phone、HarmonyOS 等
- **平板设备**：iPad 或大屏 Android 设备
- **桌面设备**：其他设备（包括带触摸屏的桌面设备）

### 横屏提示

当设备满足以下条件时会自动显示横屏提示：

1. 设备类型为移动设备或平板
2. 当前屏幕方向为竖屏（portrait）
3. 用户尚未禁用提示

横屏提示特性：
- 半透明渐变背景
- 旋转动画图标
- 磨砂玻璃效果
- 支持自定义关闭

### 虚拟摇杆

虚拟摇杆在以下情况下自动启用：

1. 设备类型为移动设备或平板
2. 未检测到物理键盘
3. `enableVirtualJoystick` 配置为 `true`（默认值）

## 配置选项

可以通过 `mobileAdapter.mount()` 方法传入配置对象：

```typescript
import { mobileAdapter } from './utils/MobileAdapter';

mobileAdapter.mount({
    // 是否启用横屏提示（默认：true）
    enableOrientationPrompt: true,
    
    // 是否启用虚拟摇杆（默认：true）
    enableVirtualJoystick: true,
    
    // 自定义横屏提示 HTML 内容
    orientationPromptMessage: `
        <div class="orientation-prompt-content">
            <h3>横屏体验更佳</h3>
            <p>请旋转设备以获得最佳游戏体验</p>
            <button class="orientation-dismiss-btn">继续</button>
        </div>
    `,
    
    // 虚拟摇杆位置：'bottom-left' | 'bottom-right' | 'bottom-center'（默认：bottom-left）
    joystickPosition: 'bottom-left',
});
```

## 虚拟摇杆操作

### 使用方式

1. **触摸摇杆球**：手指触摸摇杆中心的圆形控制器
2. **拖动控制**：向不同方向拖动以控制移动
   - 向上拖动：向上移动
   - 向下拖动：向下移动
   - 向左拖动：向左移动
   - 向右拖动：向右移动
   - 斜向拖动：组合方向移动
3. **松开停止**：松开手指后控制器自动回中

### UI 特性

- **视觉反馈**：拖动时摇杆变色并增强阴影
- **动态脉冲**：底座有轻微脉冲动画提示可用区域
- **位置自适应**：竖屏时自动调整到屏幕底部中央
- **响应式尺寸**：根据屏幕大小自动调整摇杆尺寸

## 样式自定义

移动端适配的样式定义在 `src/styles/mobile-adapter.css` 中，支持以下自定义：

### 更改主题颜色

```css
.orientation-prompt-overlay {
    background: linear-gradient(135deg, rgba(你的主色，0.95), rgba(你的深色，0.98));
}

.joystick-stick {
    background: linear-gradient(135deg, rgba(你的颜色，0.9), rgba(你的颜色，0.7));
}
```

### 调整摇杆位置

```css
/* 默认左下角 */
.virtual-joystick.joystick-bottom-left {
    bottom: 80px;
    left: 80px;
}

/* 右下角 */
.virtual-joystick.joystick-bottom-right {
    bottom: 80px;
    right: 80px;
}

/* 底部中央 */
.virtual-joystick.joystick-bottom-center {
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
}
```

### 调整摇杆尺寸

```css
/* 默认尺寸 */
.virtual-joystick {
    width: 120px;
    height: 120px;
}

/* 小屏幕优化 */
@media (max-width: 480px) {
    .virtual-joystick {
        width: 100px;
        height: 100px;
    }
}
```

## 响应式布局

移动端适配已内置响应式设计：

### 小屏幕设备（< 480px）
- 摇杆尺寸减小到 100px
- 摇杆球尺寸减小到 40px
- 位置更靠近屏幕边缘（60px）
- 提示文字字号减小

### 平板设备（768px - 1024px）
- 摇杆尺寸增大到 140px
- 摇杆球尺寸增大到 60px
- 位置适中（100px）

### 大屏幕设备（≥ 1024px）
- 横屏提示自动禁用
- 摇杆位置更靠外（80px）

## 性能优化

### 触摸事件处理
- 使用 `{ passive: false }` 选项允许阻止默认行为
- 阻止触摸移动时的页面滚动
- 精确的死区检测（30px 半径）

### 渲染优化
- 虚拟摇杆使用 CSS transform 而非改变位置属性
- 动画使用 GPU 加速（backdrop-filter: blur）
- 横屏提示显示时阻止背景滚动

## 与游戏控制的集成

移动端适配已与游戏控制系统无缝集成：

```typescript
// src/elements/E_Tablet.ts

// 触摸优先：有触摸活动时使用触摸方向，否则用键盘（仅当检测到键盘活动时）
if (touchCtrl.active) {
    this.vx += touchCtrl.dx * this.vxMax * prog;
    this.vy += touchCtrl.dy * this.vyMax * prog;
} else if (this.keyboardActive) {
    // 仅当检测到键盘活动时才使用键盘控制
    if (this.kbState.w) this.vy -= this.vyMax * prog;
    // ...
}
```

### 控制优先级

1. **触摸/虚拟摇杆**（最高优先级）
2. **物理键盘**（仅当检测到键盘活动后）

这种设计确保：
- 移动设备优先使用触摸控制
- 蓝牙键盘连接到移动设备时也能工作
- 桌面设备使用键盘控制

## 设备兼容性

### 已测试平台
- iOS 14+（iPhone, iPad）
- Android 8+（各种品牌）
- Harmony OS 2+
- iPadOS 14+

### 浏览器支持
- Chrome Mobile
- Safari Mobile
- Firefox Mobile
- Samsung Internet
- Harmony OS Browser

## 调试技巧

### 检测日志

移动端适配会在控制台输出诊断信息：

```
[MobileAdapter] Device type detected: mobile
[MobileAdapter] Initial orientation: portrait
[MobileAdapter] Initialized - Device: mobile, Orientation: portrait, HasKeyboard: false
[MobileAdapter] Orientation prompt shown
[MobileAdapter] Virtual joystick enabled
```

### 桌面调试

在桌面浏览器中测试移动端功能：

1. 打开开发者工具（F12）
2. 点击"设备工具栏"图标（Ctrl+Shift+M）
3. 选择目标设备（如 iPhone 12 Pro）
4. 刷新页面
5. 使用鼠标模拟触摸操作

### 横屏测试

1. 在开发者工具中切换到竖屏模式
2. 刷新页面查看横屏提示
3. 旋转设备或切换到横屏模式查看自动适配

## 故障排除

### 虚拟摇杆不显示

**可能原因：**
1. 设备被识别为桌面设备
2. 检测到物理键盘
3. 配置中禁用了摇杆

**解决方案：**
- 检查控制台日志中的设备类型
- 确认配置项 `enableVirtualJoystick: true`

### 横屏提示不显示

**可能原因：**
1. 已在横屏模式
2. 用户已关闭提示
3. 配置中禁用了提示

**解决方案：**
- 刷新页面重置状态
- 检查屏幕方向
- 确认配置项 `enableOrientationPrompt: true`

### 触摸屏控制不工作

**可能原因：**
1. 触摸事件被其他元素拦截
2. CSS z-index 层级问题
3. `touch-action` 设置问题

**解决方案：**
- 检查控制台是否有触摸事件错误
- 确保 `.virtual-joystick` 的 z-index 足够高（默认 1000）
- 验证 `touch-action: none` 已应用

## API 参考

### 类型定义

```typescript
type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";
type OrientationType = "portrait" | "landscape";

interface MobileAdapterConfig {
    enableOrientationPrompt: boolean;
    enableVirtualJoystick: boolean;
    orientationPromptMessage: string;
    joystickPosition: "bottom-left" | "bottom-right" | "bottom-center";
}
```

### 方法

```typescript
// 初始化移动端适配
mobileAdapter.mount(config?: Partial<MobileAdapterConfig>): void

// 获取设备类型
mobileAdapter.getDeviceType(): DeviceType

// 获取当前方向
mobileAdapter.getOrientation(): OrientationType

// 是否有物理键盘
mobileAdapter.hasKeyboard(): boolean

// 是否需要虚拟控制器
mobileAdapter.needsVirtualController(): boolean

// 销毁（清理资源）
mobileAdapter.destroy(): void
```

### TouchController API

```typescript
// 来自虚拟摇杆的输入更新
touchCtrl.updateFromJoystick(dx: number, dy: number): void

// 获取触摸输入值（-1 ~ 1）
touchCtrl.dx: number  // 水平移动意图
touchCtrl.dy: number  // 垂直移动意图
touchCtrl.active: boolean  // 是否有触摸活动
```

## 最佳实践

1. **不要在初始化时立即显示提示**：等待设备检测和方向检测完成
2. **允许用户关闭提示**：提供 dismiss 按钮并不再显示
3. **为桌面用户隐藏摇杆**：检测键盘后不显示虚拟摇杆
4. **使用响应式设计**：支持不同屏幕尺寸和方向
5. **测试真机**：模拟器不能完全代表真实设备的行为

## 更新日志

### v1.0.0
- 初始版本
- 设备检测功能
- 横屏提示系统
- 虚拟摇杆控制器
- 响应式样式系统
- 配置选项支持
