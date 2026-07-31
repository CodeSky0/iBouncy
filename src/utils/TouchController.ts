/**
 * 触摸控制器 —— 为移动端提供虚拟摇杆输入处理。
 *
 * 策略：
 * - 只响应虚拟摇杆的输入，不再监听全屏触摸事件
 * - 摇杆输出恒定速度（-1/0/1），与键盘控制行为一致
 * - 锁定挡板仅水平移动（忽略 dy），符合经典弹球玩法
 *
 * 暴露 `dx` / `dy` 归一化值（-1 ~ 1），E_Tablet 每子步读取。
 */
export class TouchController {
    /** 水平移动意图 (-1=左，1=右，0=不动) */
    dx = 0;

    /** 垂直移动意图 (-1=上，1=下，0=不动) - 移动端锁定为 0 */
    dy = 0;

    /** 是否有触摸活动 */
    active = false;

    /** 摇杆死区阈值（归一化值），小于此值视为无意图 */
    private deadZone = 0.3;

    private w = 0;
    private h = 0;

    constructor() {
        // 不再绑定全局触摸事件，只通过 updateFromJoystick 接收虚拟摇杆输入
    }

    /** 挂载触摸监听（移动端已禁用，不再监听全屏触摸） */
    mount(): void {
        // 空操作：移动端只使用虚拟摇杆，避免与 UI 元素冲突
    }

    /** 更新视口尺寸（resize 时调用） */
    syncViewport(w: number, h: number): void {
        this.w = w;
        this.h = h;
    }

    /**
     * 来自虚拟摇杆的输入更新
     * @param dx 摇杆水平偏移（-1 ~ 1，摇杆自身已归一化）
     * @param dy 摇杆垂直偏移（-1 ~ 1，移动端会被忽略）
     */
    updateFromJoystick(dx: number, _dy: number): void {
        // 应用死区过滤，将连续偏移转换为离散方向
        const absDx = Math.abs(dx);

        // 水平方向：应用死区后输出恒定速度（-1/0/1）
        if (absDx < this.deadZone) {
            this.dx = 0;
        } else {
            this.dx = dx > 0 ? 1 : -1;
        }

        // 垂直方向：移动端锁定为 0（挡板仅水平移动）
        this.dy = 0;

        // 更新活动状态
        this.active = this.dx !== 0 || this.dy !== 0;
    }

    /**
     * 直接设置移动意图（供 MobileAdapter 内部使用）
     * @param dx 水平意图（-1/0/1）
     * @param dy 垂直意图（-1/0/1）- 移动端会被忽略
     */
    setDirection(dx: number, _dy: number): void {
        this.dx = Math.max(-1, Math.min(1, dx));
        this.dy = 0; // 锁定垂直移动
        this.active = this.dx !== 0 || this.dy !== 0;
    }

    destroy(): void {
        this.active = false;
        this.dx = 0;
        this.dy = 0;
    }
}

/** 全局单例 */
export const touchCtrl = new TouchController();
