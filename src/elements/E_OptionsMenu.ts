import { AnimateEvent, Group, Text } from "leafer-game";
import { evBus, GEV } from "../events";
import { GP } from "../core/instances";
import TextLine from "../utils/TextLine";
import { UIConf } from "../config";
import { soundManager } from "../audio/SoundManager";

export default class E_OptionsMenu extends Group {
    confUI = UIConf.OptionsMenu;
    audioConf = UIConf.AudioToggle;
    Title: Text;
    Hint1: TextLine;
    Hint2: TextLine;
    MuteIcon: Text;
    Hint3: TextLine;

    constructor() {
        super({
            x: 0,
            y: 0,
            width: GP.bw,
            height: GP.bh,
            visible: false,
            zIndex: 991,
        });
        this.Title = new Text({
            x: GP.bw * this.confUI.X_RATIO,
            y: GP.bh * this.confUI.Title.Y_RATIO,
            around: "center",
            text: "游戏已暂停",
            fontFamily: this.confUI.Title.FONT_FAMILY,
            fontSize: this.confUI.Title.FONT_SIZE,
        });
        this.Hint1 = new TextLine(
            GP.bw * this.confUI.X_RATIO,
            GP.bh * this.confUI.Hint1.Y_RATIO + this.confUI.Hint1.Y_OFFSET,
            "center",
            this.confUI.Hint1.FILL,
            this.confUI.Hint1.FONT_SIZE,
        )
            .$append("按")
            .$append("空格键", 3, void 0, void 0, "bold")
            .$append("继续游戏");
        this.Hint1.opacity = 0;
        this.Hint2 = new TextLine(
            GP.bw * this.confUI.X_RATIO,
            GP.bh * this.confUI.Hint2.Y_RATIO + this.confUI.Hint2.Y_OFFSET,
            "center",
            this.confUI.Hint2.FILL,
            this.confUI.Hint2.FONT_SIZE,
        )
            .$append("按")
            .$append("回车键", 3, void 0, void 0, "bold")
            .$append("结束游戏并返回开始菜单");
        this.Hint2.opacity = 0;

        this.MuteIcon = new Text({
            x: GP.bw * this.audioConf.OPTIONS_X_RATIO,
            y: GP.bh * this.audioConf.OPTIONS_Y_RATIO,
            around: "center",
            text: soundManager.muted ? "M" : "S",
            fontSize: this.audioConf.ICON_SIZE,
            fill: this.audioConf.FILL,
            opacity: 0,
        });
        this.Hint3 = new TextLine(
            GP.bw * this.confUI.X_RATIO,
            GP.bh * this.confUI.Hint2.Y_RATIO + this.confUI.Hint2.Y_OFFSET + 24,
            "center",
            this.confUI.Hint2.FILL,
            this.confUI.Hint2.FONT_SIZE,
        )
            .$append("按")
            .$append("M 键", 3, void 0, void 0, "bold")
            .$append("切换音效开关");
        this.Hint3.opacity = 0;

        this.add([this.Title, this.Hint1, this.Hint2, this.Hint3, this.MuteIcon]);
        this.#$setupEventListeners();
    }

    #$setupEventListeners(): void {
        evBus.on(GEV.UI_RENDER_ELSE, this.render_.bind(this));
        evBus.on(GEV.RESIZE, (payload) => this.relocate_(payload.data));
    }

    relocate_(e: { width: number; height: number }): void {
        this.cx = e.width * this.confUI.X_RATIO;
        this.Hint1.y = e.height * this.confUI.Hint1.Y_RATIO + this.confUI.Hint1.Y_OFFSET;
        this.Hint2.y = e.height * this.confUI.Hint2.Y_RATIO + this.confUI.Hint2.Y_OFFSET;
        this.Hint3.y = e.height * this.confUI.Hint2.Y_RATIO + this.confUI.Hint2.Y_OFFSET + 24;
        this.MuteIcon.x = e.width * this.audioConf.OPTIONS_X_RATIO;
        this.MuteIcon.y = e.height * this.audioConf.OPTIONS_Y_RATIO;
    }

    reset_(): void {
        this.opacity = 1;
        this.Title.opacity = 0;
        this.Hint1.opacity = 0;
        this.Hint2.opacity = 0;
        this.Hint3.opacity = 0;
        this.#updateMuteIcon();
        this.MuteIcon.opacity = 0;
    }

    #updateMuteIcon(): void {
        this.MuteIcon.text = soundManager.muted ? "M" : "S";
        this.MuteIcon.fill = soundManager.muted ? this.audioConf.FILL : this.audioConf.HOVER_FILL;
    }

    /** Public accessor so app.ts can refresh the icon after M-key toggle */
    $updateMuteIcon(): void {
        this.#updateMuteIcon();
    }

    show_(): void {
        this.reset_();
        this.visible = true;
        this.relocate_({ width: GP.bw, height: GP.bh });
        this.fadeIn_(0);
        this.Title.fadeIn_(0.4);
        this.Hint1.fadeIn_(0.8, 0.2);
        this.Hint2.fadeIn_(0.8, 0.4);
        this.Hint3.fadeIn_(0.8, 0.5);
        this.MuteIcon.fadeIn_(0.8, 0.6);
    }

    hide_(): void {
        this.fadeOut_(0.5).once(AnimateEvent.COMPLETED, () => (this.visible = false));
    }
}
