import { Text } from "leafer-game";
import { evBus, GEV, GP } from "../core/instances";
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
        this.#$setupEventListeners();
    }

    #$setupEventListeners() {
        evBus.on(GEV.UI_RENDER_ELSE, this.render_.bind(this));
        evBus.on(GEV.RESIZE, (...args) => this.relocate_(args[0].data));
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
