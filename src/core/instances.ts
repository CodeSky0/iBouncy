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
    pointer: {
        preventDefaultMenu: true,
    },
});

const defFrameInterval = 1000 / GameConf.DEFAULT_REFRESH_RATE;
export const GP = new Processor(
    {
        refreshRate: GameConf.DEFAULT_REFRESH_RATE,
        actUnitInterval: defFrameInterval,
        stdUnitInterval: defFrameInterval,
        fixedStep: defFrameInterval,
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

export const GI = new Interaction({ Ball, Tablet, timer, GP });

export const Timing = new E_Timing();
