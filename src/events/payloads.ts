import type { IResizeEvent } from "@leafer/interface";
import { GEV } from "./channels";

/** 键盘事件在应用内路由后的类型（与 {@link KeyboardSolution} 一致） */
export type KeyboardRoutedType = "hold" | "up";

/**
 * 每个 {@link GEV} 通道对应的载荷类型。
 * 值为 `undefined` 表示**无载荷**（`emit` 时不传第二参数）。
 */
export type GameEventPayloadMap = {
    [GEV.RESIZE]: { data: IResizeEvent };
    [GEV.VISIBILITY_CHANGE]: { visible: boolean };
    [GEV.KEYBOARD_EVENT]: { type: KeyboardRoutedType; code: string };
    [GEV.UI_RENDER_ELSE]: undefined;
    [GEV.GAME_PREPARED]: undefined;
    [GEV.GAME_START]: undefined;
    [GEV.GAME_PAUSE]: undefined;
    [GEV.GAME_RESUME]: undefined;
    [GEV.GAME_OVER]: { win: boolean };
    [GEV.GAME_RESTART]: undefined;
    [GEV.GAME_RESET]: { removeMask: boolean };
    [GEV.PLAYER_SCORE]: undefined;
    [GEV.MAIN_MENU_SHOW]: undefined;
    [GEV.MAIN_MENU_HIDE]: undefined;
};
