/**
 * 全局事件通道名（跨模块发布/订阅）。
 *
 * 命名约定：`域:动作` 或 `域:子系统:动作`，便于在日志与调试中一眼识别来源。
 *
 * - **system**：浏览器 / Leafer 画布与页面生命周期
 * - **ui**：与「非主玩法 UI」渲染、布局相关
 * - **game**：玩法状态机（准备 / 进行中 / 暂停 / 结束等）
 * - **player**：玩家侧交互（预留扩展，如统一计分入口）
 * - **main:menu**：主菜单显隐（预留）
 */
export const GEV = {
    // --- system ---
    /** Leafer {@link ResizeEvent}，载荷为 `{ data: IResizeEvent }` */
    RESIZE: "system:resize",
    /** `document.visibilityState` 变化，载荷 `{ visible: boolean }` */
    VISIBILITY_CHANGE: "system:visibility:change",
    /** 键盘经 Leafer 路由后的统一事件，载荷含 `hold` | `up` 与 `code` */
    KEYBOARD_EVENT: "system:keyboard:event",

    // --- ui ---
    /** 首屏加载完成后，除主菜单外的 HUD / 装饰一次性渲染 */
    UI_RENDER_ELSE: "ui:render:else",

    // --- game lifecycle ---
    GAME_PREPARED: "game:prepared",
    GAME_START: "game:start",
    GAME_PAUSE: "game:pause",
    GAME_RESUME: "game:resume",
    GAME_OVER: "game:over",
    GAME_RESTART: "game:restart",
    /** 回到可玩/菜单前的一次性重置（如遮罩与 HUD） */
    GAME_RESET: "game:reset",

    // --- player (reserved) ---
    PLAYER_SCORE: "player:score",

    // --- main menu (reserved) ---
    MAIN_MENU_SHOW: "main:menu:show",
    MAIN_MENU_HIDE: "main:menu:hide",
} as const;

export type GameEventName = (typeof GEV)[keyof typeof GEV];
