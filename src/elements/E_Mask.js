import { AnimateEvent, Rect } from "leafer-game";
import { GP } from "../core/instances";
import { UIConf } from "../config";

export default class E_Mask extends Rect {
    confUI = UIConf.Mask;

    constructor() {
        super({
            x: 0,
            y: 0,
            width: GP.bw,
            height: GP.bh,
            fill: UIConf.Mask.FILL,
            visible: false,
            zIndex: 990,
        });
        this.animation = {
            style: { opacity: this.confUI.OPACITY },
            duration: this.confUI.FADE_IN_DURATION,
            join: true,
        };
    }

    relocate_(e) {
        this.w = e.width;
        this.h = e.height;
    }

    show_(fill = this.confUI.FILL, fromOpacity = 0, toOpacity = this.confUI.OPACITY, duration = this.confUI.FADE_IN_DURATION) {
        this.visible = true;
        this.relocate_({ width: GP.bw, height: GP.bh });
        this.fill = fill;
        this.fade_(fromOpacity, toOpacity, duration);
    }

    hide_() {
        this.fadeOut_(0.5).once(AnimateEvent.COMPLETED, () => this.visible = false);
    }
}
