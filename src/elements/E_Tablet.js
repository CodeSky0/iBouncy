import { Rect, Keyboard } from "leafer-game";
import { evBus, GEV, GI, GP, Tablet } from "../core/instances";
import { GameConf, UIConf } from "../config";

export default class E_Tablet extends Rect {
    confUI = UIConf.Tablet;
    confGm = GameConf.Tablet;
    vxMax;
    vyMax;
    vx;
    vy;
    availZone = [80, 40, 0, 40]; // Top, Right, Bottom, Left

    constructor() {
        super({
            width: UIConf.Tablet.WIDTH,
            height: UIConf.Tablet.HEIGHT,
            fill: UIConf.Tablet.FILL,
        });
        this.#$setupEventListeners();
        this.reset_();
    }

    #$setupEventListeners() {
        evBus.on(GEV.UI_RENDER_ELSE, this.render_.bind(this));
        evBus.on(GEV.GAME_RESET, this.reset_.bind(this));
    }

    reset_() {
        this.vxMax = this.confGm.VX;
        this.vyMax = this.confGm.VY;
        this.vx = 0;
        this.vy = 0;
        this.cx = GP.bw * this.confUI.X_RATIO;
        this.y = GP.bh * this.confUI.Y_RATIO + this.confUI.Y_OFFSET;
    }

    frameLoop(prog) {
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
        this.x += this.vx;
        this.y += this.vy;
        GI.boundaryDetect(Tablet, {
            paddings: this.availZone,
        });
    }
}
