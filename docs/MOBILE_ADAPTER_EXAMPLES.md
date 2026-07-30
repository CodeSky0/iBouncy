# 移动端适配代码示例

## 基础使用

### 默认配置（推荐）

```typescript
// src/app.ts
import { mobileAdapter } from './utils/MobileAdapter';

// 应用启动时初始化
mobileAdapter.mount();
```

这会启用所有默认功能：
- ✓ 横屏提示
- ✓ 虚拟摇杆（左下角）
- ✓ 自动设备检测

## 自定义配置

### 禁用横屏提示

```typescript
mobileAdapter.mount({
    enableOrientationPrompt: false,
});
```

适用场景：
- 横竖屏都能玩的游戏
- 已经自定义了方向提示

### 禁用虚拟摇杆

```typescript
mobileAdapter.mount({
    enableVirtualJoystick: false,
});
```

适用场景：
- 纯触摸手势控制的游戏
- 已有自定义虚拟控制器

### 自定义摇杆位置

```typescript
mobileAdapter.mount({
    joystickPosition: 'bottom-right',
});
```

位置选项：
- `'bottom-left'` - 左下角（默认，适合右手操作）
- `'bottom-right'` - 右下角（适合左手操作）
- `'bottom-center'` - 底部中央（双手操作）

### 完全自定义

```typescript
mobileAdapter.mount({
    enableOrientationPrompt: true,
    enableVirtualJoystick: true,
    joystickPosition: 'bottom-center',
    orientationPromptMessage: `
        <div class="orientation-prompt-content">
            <div class="orientation-icon">
                <!-- 自定义图标 -->
                <svg viewBox="0 0 24 24">...</svg>
            </div>
            <h3>建议横屏游玩</h3>
            <p>横屏模式能提供更好的游戏体验</p>
            <button class="orientation-dismiss-btn">知道了</button>
        </div>
    `,
});
```

## 高级用法

### 动态切换摇杆位置

```typescript
import { mobileAdapter } from './utils/MobileAdapter';

// 根据玩家习惯切换
const preferredHand = localStorage.getItem('preferredHand') || 'right';

mobileAdapter.mount({
    joystickPosition: preferredHand === 'right' ? 'bottom-left' : 'bottom-right',
});
```

### 仅在特定模式启用摇杆

```typescript
// 游戏模式选择后初始化
function startGameMode(mode: string) {
    if (mode === 'mobile') {
        mobileAdapter.mount({
            enableVirtualJoystick: true,
        });
    } else {
        mobileAdapter.mount({
            enableVirtualJoystick: false,
        });
    }
}
```

### 保存用户偏好

```typescript
// 用户关闭横屏提示时保存偏好
const config: MobileAdapterConfig = {
    enableOrientationPrompt: !localStorage.getItem('orientationPromptDismissed'),
    enableVirtualJoystick: true,
};

mobileAdapter.mount(config);

// 在 dismiss 按钮事件中保存
document.querySelector('.orientation-dismiss-btn')?.addEventListener('click', () => {
    localStorage.setItem('orientationPromptDismissed', 'true');
});
```

### 响应式配置

```typescript
const isSmallScreen = window.innerWidth < 600;

mobileAdapter.mount({
    enableOrientationPrompt: !isSmallScreen, // 小屏幕不提示
    enableVirtualJoystick: true,
    joystickPosition: isSmallScreen ? 'bottom-center' : 'bottom-left',
});
```

## 与游戏控制集成

### 读取虚拟摇杆输入

```typescript
// src/elements/E_Tablet.ts
import { touchCtrl } from '../utils/TouchController';

function updateMovement(prog: number) {
    this.vx = this.vy = 0;

    if (touchCtrl.active) {
        // 使用虚拟摇杆输入
        this.vx += touchCtrl.dx * this.vxMax * prog;
        this.vy += touchCtrl.dy * this.vyMax * prog;
    } else if (this.keyboardActive) {
        // 使用键盘输入
        if (this.kbState.w) this.vy -= this.vyMax * prog;
        if (this.kbState.s) this.vy += this.vyMax * prog;
        if (this.kbState.a) this.vx -= this.vxMax * prog;
        if (this.kbState.d) this.vx += this.vxMax * prog;
    }
}
```

### 检测是否需要显示控制提示

```typescript
import { mobileAdapter } from './utils/MobileAdapter';

function showControlHints() {
    if (mobileAdapter.needsVirtualController()) {
        // 显示虚拟摇杆使用教程
        showJoystickTutorial();
    } else {
        // 显示键盘操作提示
        showKeyboardHints();
    }
}
```

### 自适应 UI

```typescript
function updateUIForDevice() {
    const deviceType = mobileAdapter.getDeviceType();
    const orientation = mobileAdapter.getOrientation();
    
    if (deviceType === 'mobile') {
        // 移动端 UI
        showMobileUI();
        
        if (orientation === 'portrait') {
            // 竖屏布局
            showPortraitLayout();
        } else {
            // 横屏布局
            showLandscapeLayout();
        }
    } else {
        // 桌面端 UI
        showDesktopUI();
    }
}
```

## 样式自定义

### 修改摇杆颜色（在项目 CSS 中）

```css
/* 摇杆底座 */
.joystick-base {
    background: radial-gradient(circle, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05));
    border: 2px solid rgba(255, 255, 255, 0.3);
}

/* 摇杆球 */
.joystick-stick {
    background: linear-gradient(135deg, rgba(你的颜色，0.9), rgba(你的颜色，0.7));
}

/* 激活状态 */
.joystick-stick.active {
    background: linear-gradient(135deg, #fff, rgba(255, 255, 255, 0.85));
    box-shadow: 0 6px 20px rgba(你的颜色，0.4);
}
```

### 修改横屏提示主题

```css
.orientation-prompt-overlay {
    background: linear-gradient(135deg, 
        rgba(你的主色，0.95), 
        rgba(你的深色，0.98)
    );
}

.orientation-icon {
    background: rgba(255, 255, 255, 0.2);
}

.orientation-dismiss-btn {
    background: #fff;
    color: 你的主色;
}
```

## 调试技巧

### 启用详细日志

```typescript
// src/utils/MobileAdapter.ts 已内置日志
// 在控制台可以看到：
// [MobileAdapter] Device type detected: mobile
// [MobileAdapter] Initial orientation: portrait
// [MobileAdapter] Initialized - Device: mobile, Orientation: portrait, HasKeyboard: false
```

### 检查设备信息

```typescript
console.log('Device type:', mobileAdapter.getDeviceType());
console.log('Orientation:', mobileAdapter.getOrientation());
console.log('Has keyboard:', mobileAdapter.hasKeyboard());
console.log('Needs controller:', mobileAdapter.needsVirtualController());
```

### 桌面浏览器测试移动设备

```javascript
// 在浏览器控制台执行，模拟移动设备
Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    configurable: true
});

// 刷新页面
location.reload();
```

## 常见问题解决

### Q: 摇杆不显示？

```typescript
// 检查 1: 设备类型
console.log(mobileAdapter.getDeviceType());
// 应该是 'mobile' 或 'tablet'

// 检查 2: 配置
mobileAdapter.mount({
    enableVirtualJoystick: true, // 确保为 true
});

// 检查 3: 是否已有键盘
console.log(mobileAdapter.hasKeyboard());
// 如果为 true，摇杆可能不显示
```

### Q: 横屏提示不显示？

```typescript
// 检查 1: 当前方向
console.log(mobileAdapter.getOrientation());
// 应该是 'portrait' 才会显示

// 检查 2: 配置
mobileAdapter.mount({
    enableOrientationPrompt: true, // 确保为 true
});

// 检查 3: 用户是否已关闭
// 刷新页面或清除 localStorage
localStorage.clear();
location.reload();
```

### Q: 触摸控制不工作？

```typescript
// 检查 1: TouchController 是否挂载
touchCtrl.mount();

// 检查 2: 触摸事件是否被拦截
// 确保没有其他元素阻止触摸

// 检查 3: CSS z-index
// 确保 .virtual-joystick 的 z-index 足够高（默认 1000）
```

## 完整示例项目

一个完整的移动适配集成示例：

```typescript
// src/app.ts
import { initializeApp, KS } from "./app/bootstrap";
import { mobileAdapter } from "./utils/MobileAdapter";
import { touchCtrl } from "./utils/TouchController";

// 初始化
initializeApp().catch(console.error);

// 触摸控制器
touchCtrl.mount();

// 移动端适配
mobileAdapter.mount({
    enableOrientationPrompt: true,
    enableVirtualJoystick: true,
    joystickPosition: 'bottom-left',
});

// 响应设备变化
window.addEventListener('resize', () => {
    // 可以在这里处理额外的响应式逻辑
    console.log('Window resized:', window.innerWidth, window.innerHeight);
});

// 响应方向变化
const orientationQuery = window.matchMedia("(orientation: portrait)");
orientationQuery.addEventListener('change', (e) => {
    const newOrientation = e.matches ? 'portrait' : 'landscape';
    console.log('Orientation changed to:', newOrientation);
    
    // 可以在这里执行额外的方向变化逻辑
});
```

## 更多信息

- 完整 API 文档：`MOBILE_ADAPTER_GUIDE.md`
- 实现总结：`MOBILE_ADAPTER_SUMMARY.md`

