import { Text } from "leafer-game";
import { GP } from "../core/instances";
import { UIConf } from "../config";

export default class E_FPS extends Text {
    confUI = UIConf.FPS;

    constructor() {
        super({
            x: UIConf.FPS.LEFT,
            y: GP.bh - UIConf.FPS.BOTTOM,
            fontSize: UIConf.FPS.FONT_SIZE,
            fill: UIConf.FPS.FILL,
            text: "FPS: --",
            zIndex: 1001,
        });
    }

    relocate_(e) {
        if (e.height === e.old.height) return;
        this.y = e.height - this.confUI.BOTTOM;
    }

    assign_(fps) {
        if (isNaN(fps)) fps = "--";
        this.text = "FPS: " + fps;
    }
}
