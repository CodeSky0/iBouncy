/**
 * 移动端适配模块
 *
 * 功能：
 * 1. 检测设备是否为非电脑设备（Android、iOS、Harmony OS）
 * 2. 检测横竖屏状态，提示用户横屏体验更佳
 * 3. 检测键盘可用性，无键盘时提供虚拟摇杆
 * 4. 无键盘时提供虚拟操作按键（替代空格/回车/R 等）
 */

import { evBus, GEV } from "../events";
import { touchCtrl } from "./TouchController";
import { GP, leafer } from "../core/instances";
import { virtualButtons } from "./VirtualActionButtons";

export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";
export type OrientationType = "portrait" | "landscape";

export interface MobileAdapterConfig {
    /** 是否启用横屏提示 */
    enableOrientationPrompt: boolean;
    /** 是否启用虚拟摇杆 */
    enableVirtualJoystick: boolean;
    /** 横屏提示文本（支持 HTML） */
    orientationPromptMessage: string;
    /** 虚拟摇杆位置：'bottom-left' | 'bottom-right' | 'bottom-center' */
    joystickPosition: "bottom-left" | "bottom-right" | "bottom-center";
}

const DEFAULT_CONFIG: MobileAdapterConfig = {
    enableOrientationPrompt: true,
    enableVirtualJoystick: true,
    orientationPromptMessage: `
        <div class="orientation-prompt-content">
            <div class="orientation-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
                </svg>
            </div>
            <h3>横屏体验更佳</h3>
            <p>请旋转设备以获得最佳游戏体验</p>
            <button class="orientation-dismiss-btn">继续</button>
        </div>
    `,
    joystickPosition: "bottom-left",
};

export class MobileAdapter {
    /** 设备类型 */
    private deviceType: DeviceType = "unknown";

    /** 当前屏幕方向 */
    private orientation: OrientationType = "landscape";

    /** 是否有物理键盘 */
    private hasPhysicalKeyboard = false;

    /** 配置 */
    private config: MobileAdapterConfig = { ...DEFAULT_CONFIG };

    /** 横屏提示元素 */
    private orientationPromptEl: HTMLElement | null = null;

    /** 虚拟摇杆容器 */
    private joystickContainer: HTMLElement | null = null;

    /** 是否已初始化 */
    private initialized = false;

    /** 方向锁定状态 */
    private orientationLocked = false;

    /** 横屏提示被Dismiss 状态 */
    private orientationPromptDismissed = false;

    /** 键盘检测事件监听器引用，用于移除 */
    private keyboardDetectHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor() {
        this.#detectDeviceType();
        this.#detectOrientation();
        this.#detectKeyboard();
    }

    /**
     * 初始化移动端适配
     */
    mount(config?: Partial<MobileAdapterConfig>): void {
        if (this.initialized) {
            return;
        }

        if (config) {
            this.config = { ...this.config, ...config };
        }

        this.initialized = true;

        console.log(`[MobileAdapter] Initialized - Device: ${this.deviceType}, Orientation: ${this.orientation}, HasKeyboard: ${this.hasPhysicalKeyboard}`);

        if (this.deviceType !== "desktop") {
            this.#setupOrientationListener();
            this.#setupKeyboardDetection();
            this.#setupVirtualControls();

            if (this.config.enableOrientationPrompt && this.orientation === "portrait" && !this.orientationPromptDismissed) {
                this.#showOrientationPrompt();
            }
        }
    }

    /**
     * 检测设备类型
     */
    #detectDeviceType(): void {
        const ua = navigator.userAgent || navigator.vendor;
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|windows phone|harmonyos/i.test(ua);
        const isTablet =
            /iPad|Android(?!.*Mobile)/i.test(ua) ||
            (/Android/i.test(ua) && window.innerWidth > 600 && window.innerHeight > 600);

        if (isTablet) {
            this.deviceType = "tablet";
        } else if (isMobile) {
            this.deviceType = "mobile";
        } else {
            const isTouchDevice =
                "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.maxTouchPoints === 0;
            this.deviceType = isTouchDevice ? "tablet" : "desktop";
        }

        console.log(`[MobileAdapter] Device type detected: ${this.deviceType}`);
    }

    /**
     * 检测屏幕方向
     */
    #detectOrientation(): void {
        const isPortrait = window.matchMedia("(orientation: portrait)").matches;
        this.orientation = isPortrait ? "portrait" : "landscape";

        console.log(`[MobileAdapter] Initial orientation: ${this.orientation}`);
    }

    /**
     * 初始检测物理键盘
     */
    #detectKeyboard(): void {
        if (this.deviceType === "mobile" || this.deviceType === "tablet") {
            this.hasPhysicalKeyboard = false;
        } else {
            this.hasPhysicalKeyboard = true;
        }
    }

    /**
     * 运行时检测物理键盘：监听全局 keydown 事件。
     * 当在移动/平板设备上检测到按键时，说明连接了物理键盘，
     * 此时隐藏虚拟摇杆和虚拟操作按键。
     */
    #setupKeyboardDetection(): void {
        this.keyboardDetectHandler = (_e: KeyboardEvent) => {
            if (!this.hasPhysicalKeyboard) {
                this.hasPhysicalKeyboard = true;
                console.log("[MobileAdapter] Physical keyboard detected, hiding virtual controls");
                this.#hideVirtualControls();
            }
        };
        document.addEventListener("keydown", this.keyboardDetectHandler);
    }

    /**
     * 设置虚拟控制器（摇杆 + 操作按键）
     */
    #setupVirtualControls(): void {
        if (!this.needsVirtualController()) return;

        if (this.config.enableVirtualJoystick) {
            this.#setupVirtualJoystick();
        }

        // 挂载虚拟操作按键
        virtualButtons.mount();
        virtualButtons.show();

        console.log("[MobileAdapter] Virtual controls enabled");
    }

    /**
     * 隐藏所有虚拟控制器（检测到物理键盘时调用）
     */
    #hideVirtualControls(): void {
        // 隐藏虚拟摇杆
        if (this.joystickContainer) {
            this.joystickContainer.remove();
            this.joystickContainer = null;
            console.log("[MobileAdapter] Virtual joystick removed");
        }

        // 隐藏虚拟操作按键
        virtualButtons.hide();
    }

    /**
     * 设置屏幕方向监听
     */
    #setupOrientationListener(): void {
        const mediaQuery = window.matchMedia("(orientation: portrait)");

        const handleChange = (e: MediaQueryListEvent) => {
            const newOrientation = e.matches ? "portrait" : "landscape";
            if (newOrientation !== this.orientation) {
                this.orientation = newOrientation;
                console.log(`[MobileAdapter] Orientation changed to: ${this.orientation}`);

                if (this.config.enableOrientationPrompt && this.orientation === "portrait" && !this.orientationPromptDismissed) {
                    this.#showOrientationPrompt();
                }
            }
        };

        mediaQuery.addEventListener("change", handleChange);
    }

    /**
     * 显示横屏提示
     */
    #showOrientationPrompt(): void {
        if (this.orientationPromptEl || this.orientation === "landscape") {
            return;
        }

        const overlay = document.createElement("div");
        overlay.className = "orientation-prompt-overlay";
        overlay.innerHTML = this.config.orientationPromptMessage;

        const dismissBtn = overlay.querySelector(".orientation-dismiss-btn") as HTMLButtonElement;
        if (dismissBtn) {
            dismissBtn.addEventListener("click", () => {
                this.orientationPromptDismissed = true;
                this.#hideOrientationPrompt();
            });
        }

        document.body.appendChild(overlay);
        this.orientationPromptEl = overlay;

        document.body.style.overflow = "hidden";

        console.log("[MobileAdapter] Orientation prompt shown");
    }

    /**
     * 隐藏横屏提示
     */
    #hideOrientationPrompt(): void {
        if (!this.orientationPromptEl) {
            return;
        }

        this.orientationPromptEl.remove();
        this.orientationPromptEl = null;
        document.body.style.overflow = "";

        console.log("[MobileAdapter] Orientation prompt dismissed");
    }

    /**
     * 设置虚拟摇杆
     */
    #setupVirtualJoystick(): void {
        const joystick = document.createElement("div");
        joystick.className = `virtual-joystick joystick-${this.config.joystickPosition}`;
        joystick.innerHTML = `
            <div class="joystick-base">
                <div class="joystick-stick"></div>
            </div>
        `;

        document.body.appendChild(joystick);
        this.joystickContainer = joystick;

        this.#bindJoystickEvents(joystick);

        console.log("[MobileAdapter] Virtual joystick enabled");
    }

    /**
     * 绑定摇杆触摸事件
     */
    #bindJoystickEvents(joystick: HTMLElement): void {
        const stick = joystick.querySelector(".joystick-stick") as HTMLElement;
        const base = joystick.querySelector(".joystick-base") as HTMLElement;
        if (!stick || !base) return;

        let active = false;
        let startX = 0;
        let startY = 0;
        const maxRadius = 50;

        const handleStart = (e: TouchEvent | MouseEvent) => {
            e.preventDefault();
            active = true;
            const rect = base.getBoundingClientRect();
            startX = rect.left + rect.width / 2;
            startY = rect.top + rect.height / 2;
            stick.classList.add("active");
        };

        const handleMove = (e: TouchEvent | MouseEvent) => {
            if (!active) return;
            e.preventDefault();

            const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

            const deltaX = clientX - startX;
            const deltaY = clientY - startY;
            const distance = Math.min(Math.hypot(deltaX, deltaY), maxRadius);
            const angle = Math.atan2(deltaY, deltaX);

            const stickX = Math.cos(angle) * distance;
            const stickY = Math.sin(angle) * distance;

            stick.style.transform = `translate(${stickX}px, ${stickY}px)`;

            touchCtrl.updateFromJoystick(stickX / maxRadius, stickY / maxRadius);
        };

        const handleEnd = (e: TouchEvent | MouseEvent) => {
            e.preventDefault();
            active = false;
            stick.classList.remove("active");
            stick.style.transform = "translate(0, 0)";
            touchCtrl.updateFromJoystick(0, 0);
        };

        joystick.addEventListener("touchstart", handleStart, { passive: false });
        joystick.addEventListener("touchmove", handleMove, { passive: false });
        joystick.addEventListener("touchend", handleEnd, { passive: false });

        joystick.addEventListener("mousedown", handleStart);
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleEnd);
    }

    /**
     * 获取设备类型
     */
    getDeviceType(): DeviceType {
        return this.deviceType;
    }

    /**
     * 获取当前方向
     */
    getOrientation(): OrientationType {
        return this.orientation;
    }

    /**
     * 是否有物理键盘
     */
    hasKeyboard(): boolean {
        return this.hasPhysicalKeyboard;
    }

    /**
     * 是否需要虚拟控制器
     */
    needsVirtualController(): boolean {
        return (this.deviceType === "mobile" || this.deviceType === "tablet") && !this.hasPhysicalKeyboard;
    }

    /**
     * 销毁
     */
    destroy(): void {
        if (this.orientationPromptEl) {
            this.#hideOrientationPrompt();
        }
        if (this.joystickContainer) {
            this.joystickContainer.remove();
            this.joystickContainer = null;
        }
        if (this.keyboardDetectHandler) {
            document.removeEventListener("keydown", this.keyboardDetectHandler);
            this.keyboardDetectHandler = null;
        }
        virtualButtons.destroy();
        this.initialized = false;
    }
}

/** 全局单例 */
export const mobileAdapter = new MobileAdapter();
