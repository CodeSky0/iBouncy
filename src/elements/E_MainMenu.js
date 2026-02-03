import { AnimateEvent, Group, Image } from "leafer-game";
import { evBus, GEV, GP } from "../core/instances";
import TextLine from "../utils/TextLine";
import { UIConf } from "../config";

export default class E_MainMenu extends Group {
    confUI = UIConf.MainMenu;

    constructor() {
        super({
            x: 0,
            y: 0,
            width: GP.bw,
            height: GP.bh,
            visible: false,
            zIndex: 991,
        });
        this.Brand = new Image({
            x: GP.bw * this.confUI.X_RATIO,
            y: GP.bh * this.confUI.Brand.Y_RATIO,
            around: "center",
            url: "leafer://brand.svg",
            opacity: 0,
            scale: 0,
            offsetY: this.confUI.Brand.Y_OFFSET,
            shadow: {
                x: 0,
                y: 0,
                blur: 50,
                color: this.confUI.Brand.SHADOW_COLOR,
            },
        });
        this.Hint1 = new TextLine(
            GP.bw * this.confUI.X_RATIO,
            GP.bh * this.confUI.Hint1.Y_RATIO + this.confUI.Hint1.Y_OFFSET,
            "center",
            this.confUI.Hint1.FILL,
            this.confUI.Hint1.FONT_SIZE)
            .$append("按")
            .$append("空格键", 3, void 0, void 0, "bold")
            .$append("开始游戏");
        this.Hint1.opacity = 0;
        this.Hint2 = new TextLine(
            GP.bw * this.confUI.X_RATIO,
            GP.bh * this.confUI.Hint2.Y_RATIO + this.confUI.Hint2.Y_OFFSET,
            "center",
            this.confUI.Hint2.FILL,
            this.confUI.Hint2.FONT_SIZE)
            .$append("通过")
            .$append("方向键", 3, void 0, void 0, "bold")
            .$append("或")
            .$append("W/A/S/D", 3, void 0, void 0, "bold")
            .$append("来控制平板的移动");
        this.Hint2.opacity = 0;
        this.add([this.Brand, this.Hint1, this.Hint2]);
        this.#$setupEventListeners();
    }

    #$setupEventListeners() {
        evBus.on(GEV.RESIZE, (...args) => this.relocate_(args[0].data));
    }

    async init() {
        await this.preloadImage();
    }

    async preloadImage() {
        const brandSVG = new URL("/public/svg/brand.svg", import.meta.url).href;
        await GP.ImageInitializer("brand.svg", brandSVG);
    }

    relocate_(e) {
        this.cx = e.width * this.confUI.X_RATIO;
        this.Brand.y = e.height * this.confUI.Brand.Y_RATIO;
        this.Hint1.y = e.height * this.confUI.Hint1.Y_RATIO + this.confUI.Hint1.Y_OFFSET;
        this.Hint2.y = e.height * this.confUI.Hint2.Y_RATIO + this.confUI.Hint2.Y_OFFSET;
    }

    reset_() {
        this.opacity = 1;
        this.Brand.opacity = 0;
        this.Brand.scale = 0;
        this.Brand.offsetY = this.confUI.Brand.Y_OFFSET;
        this.Hint1.opacity = 0;
        this.Hint2.opacity = 0;
    }

    show_() {
        this.reset_();
        this.visible = true;
        this.relocate_({ width: GP.bw, height: GP.bh });
        this.Brand.animate([
            { opacity: 0.9, scale: 1.1, offsetY: -5 },
            { opacity: 1, scale: 1, offsetY: 0 },
        ], {
            duration: 0.8,
            join: true,
        }).once(AnimateEvent.COMPLETED, () => {
            this.Brand.hoverStyle = {
                shadow: {
                    x: 0,
                    y: 0,
                    blur: 20,
                    color: this.confUI.Brand.HOVER_SHADOW_COLOR,
                },
            };
        });
        this.Hint1.fadeIn_(0.8, 0.2);
        this.Hint2.fadeIn_(0.8, 0.4);
    }

    hide_() {
        this.Brand.hoverStyle = false;
        this.fadeOut_(0.5).once(AnimateEvent.COMPLETED, () => this.visible = false);
    }
}
