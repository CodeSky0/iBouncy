# 移动端适配快速开始

## 5 分钟快速上手

### 第 1 步：已自动集成（无需操作）

移动端适配模块已在 `src/app.ts` 中集成：

```typescript
// 触摸控制器初始化
touchCtrl.mount();

// 移动端适配初始化
mobileAdapter.mount();
```

### 第 2 步：运行项目

```bash
# 开发模式
npm run dev

# 或构建生产版本
npm run build
```

### 第 3 步：测试移动端功能

#### 方法 1：浏览器开发者工具

1. 按 `F12` 打开开发者工具
2. 点击"设备工具栏"图标（或按 `Ctrl+Shift+M`）
3. 选择设备（如 iPhone 12 Pro）
4. 刷新页面

#### 方法 2：真机测试

1. 确保设备和电脑在同一网络
2. 运行 `npm run dev -- --host`
3. 在手机浏览器访问显示的地址（如 `http://192.168.1.100:5173`）

## 功能预览

### ✅ 设备检测

系统会自动检测你的设备类型并在控制台输出：

```
[MobileAdapter] Device type detected: mobile
[MobileAdapter] Initial orientation: portrait
[MobileAdapter] Initialized - Device: mobile, Orientation: portrait, HasKeyboard: false
```

### ✅ 横屏提示

当设备处于竖屏模式时，会显示全屏提示：

```
┌─────────────────────────────┐
│                             │
│         [旋转图标]          │
│                             │
│       横屏体验更佳           │
│   请旋转设备以获得最佳游戏体验  │
│                             │
│      [     继续     ]       │
│                             │
└─────────────────────────────┘
```

点击"继续"按钮后不再显示。

### ✅ 虚拟摇杆

```
  ┌──────────────┐
  │              │
  │    游戏区域   │
  │              │
  │              │
  │              │  ← 虚拟摇杆
  │    ●         │     左下角
  │  (_____)     │
  │              │
  └──────────────┘
```

**操作方式**：
1. 触摸摇杆中心的圆球
2. 向任意方向拖动
3. 松开自动回中

## 自定义配置（可选）

### 修改摇杆位置

编辑 `src/app.ts`：

```typescript
mobileAdapter.mount({
    joystickPosition: 'bottom-right', // 或 'bottom-center'
});
```

### 禁用横屏提示

```typescript
mobileAdapter.mount({
    enableOrientationPrompt: false,
});
```

### 禁用虚拟摇杆

```typescript
mobileAdapter.mount({
    enableVirtualJoystick: false,
});
```

## 响应式效果

### 小屏幕手机（< 480px）
- 摇杆尺寸：100px
- 摇杆球：40px
- 位置更靠近边缘（60px）

### 平板（768px - 1024px）
- 摇杆尺寸：140px
- 摇杆球：60px
- 位置适中（100px）

### 竖屏模式
- 摇杆自动移动到屏幕底部中央
- 双手操作更方便

## 代码质量验证

已通过所有测试：
```
✓ TypeScript 类型检查
✓ 87 个单元测试
✓ ESLint 代码检查
✓ Prettier 格式化检查
✓ 生产构建
```

## 下一步

- 查看完整文档：`docs/MOBILE_ADAPTER_GUIDE.md`
- 查看代码示例：`docs/MOBILE_ADAPTER_EXAMPLES.md`
- 了解实现细节：`docs/MOBILE_ADAPTER_SUMMARY.md`

## 故障排除

### Q: 看不到虚拟摇杆？

**检查**：
1. 是否使用移动设备或平板
2. 浏览器开发者工具中是否选择了移动设备模式
3. 查看控制台日志确认设备类型

### Q: 横屏提示不出现？

**检查**：
1. 是否处于竖屏模式
2. 是否已经点击过"继续"按钮（刷新页面重置）
3. 查看控制台是否有错误

### Q: 触摸没反应？

**检查**：
1. 确保不是桌面设备（桌面使用键盘 WASD）
2. 检查浏览器是否支持触摸事件
3. 查看控制台错误日志

## 支持的设备

### 操作系统
- ✓ iOS 14+
- ✓ Android 8+
- ✓ Harmony OS 2+
- ✓ iPadOS 14+

### 浏览器
- ✓ Chrome Mobile
- ✓ Safari Mobile
- ✓ Firefox Mobile
- ✓ Samsung Internet
- ✓ Harmony OS Browser

---

就这么简单！享受你的移动端游戏体验吧！ 🎮
