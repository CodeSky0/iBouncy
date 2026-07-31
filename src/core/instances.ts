import extendUI from "../utils/UIExtensions";

extendUI();

import { Leafer } from "leafer-game";
import { GameConf, UIConf } from "../config";
import Processor from "./processor";
import Interaction from "./interaction";
import EmbeddedTimer from "../utils/EmbeddedTimer";
import E_Ball from "../elements/E_Ball";
import E_Tablet from "../elements/E_Tablet";
import E_Timing from "../elements/E_Timing";

export const leafer = new Leafer({
    view: document.querySelector("canvas")!,
    fill: UIConf.BACKGROUND_FILL,
    // 渲染帧率上限对齐物理子步（120Hz），高刷显示器上渲染不设 60FPS 限制
    maxFPS: GameConf.TARGET_FPS,
    // 限制画布像素比，避免 3x Retina 屏渲染面积放大 9 倍导致卡顿；2x 视觉几乎无差别
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    pointer: {
        preventDefaultMenu: true,
    },
});

import { setLeafer } from "../utils/UIExtensions";
setLeafer(leafer);

const defFrameInterval = 1000 / GameConf.DEFAULT_REFRESH_RATE;
/**
 * Game Processor — the central state machine.
 *
 * Owns game lifecycle (init → prepared → playing → paused → over),
 * viewport dimensions (`.bw` / `.bh`), environment config (`.ENV`),
 * and asset loading helpers (`fontInitializer`, `ImageInitializer`).
 *
 * 物理子步固定 `1000 / TARGET_FPS`（120Hz）：60Hz 显示器每渲染帧执行 2 个子步，
 * 120Hz+ 显示器每帧 1 个子步，物理精度与手感在所有刷新率设备上保持一致。
 */
export const GP = new Processor(
    {
        refreshRate: GameConf.DEFAULT_REFRESH_RATE,
        actUnitInterval: 1000 / GameConf.TARGET_FPS,
        stdUnitInterval: defFrameInterval,
        fixedStep: 1000 / GameConf.TARGET_FPS,
        maxStepPerFrame: GameConf.MAX_STEP_PER_FRAME,
        paddingTop: GameConf.PADDING.TOP,
        paddingSide: GameConf.PADDING.SIDE,
        timeLimit: GameConf.TIME_LIMIT,
    },
    leafer,
);

export const timer = new EmbeddedTimer({
    minInterval: 0,
    autoHandleFPS: true,
});

export const Ball = new E_Ball();
export const Tablet = new E_Tablet();

/** Game Interaction — collision detection and boundary enforcement. */
export const GI = new Interaction({ Ball, Tablet, timer, GP });

export const Timing = new E_Timing();
