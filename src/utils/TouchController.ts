/**
 * 触摸控制器 —— 为移动端提供虚拟操作杆。
 *
 * 策略：
 * - 手指在屏幕左半/下半触发方向键移动（WASD 映射）
 * - 手指在屏幕右半/上半也触发方向键
 * - 更直觉的方式：以屏幕中心为原点，触摸点相对中心的偏移决定方向和力度
 *
 * 暴露 `dx` / `dy` 归一化值（-1 ~ 1），E_Tablet 每子步读取。
 */
export class TouchController {
    /** 水平移动意图 (-1=左, 1=右, 0=不动) */
    dx = 0;

    /** 垂直移动意图 (-1=上, 1=下, 0=不动) */
    dy = 0;

    /** 是否有触摸活动 */
    active = false;

    /** 死区半径（像素），小于此值的偏移视为无意图 */
    private deadZone = 30;

    /** 灵敏度系数 */
    private sensitivity = 1.8;

    private w = 0;
    private h = 0;

    private onTouchStartBound: (e: TouchEvent) => void;
    private onTouchMoveBound: (e: TouchEvent) => void;
    private onTouchEndBound: (e: TouchEvent) => void;

    constructor() {
        this.onTouchStartBound = this.#onTouchStart.bind(this);
        this.onTouchMoveBound = this.#onTouchMove.bind(this);
        this.onTouchEndBound = this.#onTouchEnd.bind(this);
    }

    /** 挂载触摸监听（首次交互时延迟初始化以兼容 AudioContext 策略） */
    mount(): void {
        document.addEventListener("touchstart", this.onTouchStartBound, { passive: false });
        document.addEventListener("touchmove", this.onTouchMoveBound, { passive: false });
        document.addEventListener("touchend", this.onTouchEndBound, { passive: false });
    }

    /** 更新视口尺寸（resize 时调用） */
    syncViewport(w: number, h: number): void {
        this.w = w;
        this.h = h;
    }

    /** 来自虚拟摇杆的输入更新 */
    updateFromJoystick(dx: number, dy: number): void {
        this.active = dx !== 0 || dy !== 0;
        this.dx = Math.max(-1, Math.min(1, dx));
        this.dy = Math.max(-1, Math.min(1, dy));
    }

    #onTouchStart(e: TouchEvent): void {
        e.preventDefault();
        this.active = true;
        this.#updateFromTouch(e.touches[0]);
    }

    #onTouchMove(e: TouchEvent): void {
        e.preventDefault();
        if (!this.active) return;
        this.#updateFromTouch(e.touches[0]);
    }

    #onTouchEnd(e: TouchEvent): void {
        // 如果没有剩余触摸点则重置
        if (e.touches.length === 0) {
            this.active = false;
            this.dx = 0;
            this.dy = 0;
        }
    }

    #updateFromTouch(touch: Touch | undefined): void {
        if (!touch) return;
        const cx = this.w / 2;
        const cy = this.h / 2;
        const rawDx = touch.clientX - cx;
        const rawDy = touch.clientY - cy;

        // 死区过滤
        const dist = Math.hypot(rawDx, rawDy);
        if (dist < this.deadZone) {
            this.dx = 0;
            this.dy = 0;
            return;
        }

        // 归一化并应用灵敏度（使用 smoothstep 让边缘更精确）
        const ndx = rawDx / cx; // -1 ~ 1
        const ndy = rawDy / (this.h * 0.4); // 映射到更窄的范围

        this.dx = Math.max(-1, Math.min(1, ndx * this.sensitivity));
        this.dy = Math.max(-1, Math.min(1, ndy * this.sensitivity));
    }

    destroy(): void {
        document.removeEventListener("touchstart", this.onTouchStartBound);
        document.removeEventListener("touchmove", this.onTouchMoveBound);
        document.removeEventListener("touchend", this.onTouchEndBound);
        this.active = false;
        this.dx = 0;
        this.dy = 0;
    }
}

/** 全局单例 */
export const touchCtrl = new TouchController();
