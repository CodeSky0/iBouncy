import { Rect, Keyboard } from "leafer-game";
import type { BoundsEntity } from "../core/interaction";
import { evBus, GEV, GI, GP } from "../core/instances";
import { GameConf, UIConf } from "../config";

export default class E_Tablet extends Rect {
    confUI = UIConf.Tablet;
    confGm = GameConf.Tablet;
    vxMax!: number;
    vyMax!: number;
    vx!: number;
    vy!: number;
    availZone: [number, number, number, number] = [80, 40, 0, 40]; // Top, Right, Bottom, Left

    /** 复用 `{ paddings }`，避免每子步分配新对象 */
    private readonly tabletBoundaryOpts: { paddings: [number, number, number, number] };

    constructor() {
        super({
            width: UIConf.Tablet.WIDTH,
            height: UIConf.Tablet.HEIGHT,
            fill: UIConf.Tablet.FILL,
        });
        this.tabletBoundaryOpts = { paddings: this.availZone };
        this.#$setupEventListeners();
        this.reset_();
    }

    #$setupEventListeners(): void {
        evBus.on(GEV.UI_RENDER_ELSE, this.render_.bind(this));
        evBus.on(GEV.GAME_RESET, this.reset_.bind(this));
    }

    reset_(): void {
        this.vxMax = this.confGm.VX;
        this.vyMax = this.confGm.VY;
        this.vx = 0;
        this.vy = 0;
        this.cx = GP.bw * this.confUI.X_RATIO;
        this.y = GP.bh * this.confUI.Y_RATIO + this.confUI.Y_OFFSET;
    }

    frameLoop(prog: number): void {
        this.vx = this.vy = 0;
        if (Keyboard.isHold("KeyW") || Keyboard.isHold("ArrowUp")) {
            this.vy -= this.vyMax * prog;
        }
        if (Keyboard.isHold("KeyS") || Keyboard.isHold("ArrowDown")) {
            this.vy += this.vyMax * prog;
        }
        if (Keyboard.isHold("KeyA") || Keyboard.isHold("ArrowLeft")) {
            this.vx -= this.vxMax * prog;
        }
        if (Keyboard.isHold("KeyD") || Keyboard.isHold("ArrowRight")) {
            this.vx += this.vxMax * prog;
        }
        this.x! += this.vx;
        this.y! += this.vy;
        GI.boundaryDetect(this as BoundsEntity, this.tabletBoundaryOpts);
    }
}
