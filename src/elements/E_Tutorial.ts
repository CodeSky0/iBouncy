import { AnimateEvent, Group, Rect, Text } from "leafer-game";
import { evBus, GEV } from "../events";
import { GP } from "../core/instances";
import TextLine from "../utils/TextLine";
import { UIConf } from "../config";

const TUTORIAL_KEY = "ibouncy_tutorial_seen";

export default class E_Tutorial extends Group {
    confUI = UIConf.Tutorial;
    Overlay: Rect;
    Title: Text;
    Line0: TextLine;
    Line1: TextLine;
    Line2: TextLine;
    Line3: TextLine;
    Hint: Text;

    constructor() {
        super({
            x: 0, y: 0,
            width: GP.bw, height: GP.bh,
            visible: false, zIndex: 990,
        });
        this.Overlay = new Rect({
            x: 0, y: 0,
            width: GP.bw, height: GP.bh,
            fill: this.confUI.OVERLAY_FILL,
            opacity: 0,
        });
        this.Title = new Text({
            x: GP.bw * this.confUI.X_RATIO,
            y: GP.bh * this.confUI.Title.Y_RATIO,
            around: "center",
            text: "欢迎来到 iBouncy!",
            fontFamily: this.confUI.Title.FONT_FAMILY,
            fontSize: this.confUI.Title.FONT_SIZE,
            fill: this.confUI.Title.FILL,
            opacity: 0,
        });
        const insX = GP.bw * this.confUI.X_RATIO;
        const insY = GP.bh * this.confUI.Instruction.Y_RATIO;
        const lineGap = this.confUI.Instruction.LINE_GAP;
        const defFill = this.confUI.Instruction.FILL;
        const hlFill = this.confUI.Instruction.HIGHLIGHT_FILL;
        const defSize = this.confUI.Instruction.FONT_SIZE;

        this.Line0 = new TextLine(insX, insY, "center", defFill, defSize)
            .$append("目标：用挡板接住弹球，坚持到计时结束");
        this.Line0.opacity = 0;

        this.Line1 = new TextLine(insX, insY + lineGap, "center", defFill, defSize)
            .$append("控制：")
            .$append("方向键 / W/A/S/D", 3, hlFill, void 0, "bold")
            .$append("移动挡板");
        this.Line1.opacity = 0;

        this.Line2 = new TextLine(insX, insY + lineGap * 2, "center", defFill, defSize)
            .$append("空格键", 3, hlFill, void 0, "bold")
            .$append("开始 / 暂停 / 重新开始");
        this.Line2.opacity = 0;

        this.Line3 = new TextLine(insX, insY + lineGap * 3, "center", defFill, defSize)
            .$append("移动端可直接触摸左右区域控制挡板");
        this.Line3.opacity = 0;

        this.Hint = new Text({
            x: GP.bw * this.confUI.X_RATIO,
            y: GP.bh * this.confUI.Hint.Y_RATIO,
            around: "center",
            text: "按任意键开始",
            fontSize: this.confUI.Hint.FONT_SIZE,
            fill: this.confUI.Hint.FILL,
            opacity: 0,
        });

        this.add([this.Overlay, this.Title, this.Line0, this.Line1, this.Line2, this.Line3, this.Hint]);
        this.#$setupEventListeners();
    }

    #$setupEventListeners(): void {
        evBus.on(GEV.RESIZE, (payload) => this.relocate_(payload.data));
    }

    relocate_(e: { width: number; height: number }): void {
        this.Overlay.width = e.width;
        this.Overlay.height = e.height;
        this.Title.x = e.width * this.confUI.X_RATIO;
        const insX = e.width * this.confUI.X_RATIO;
        const insY = e.height * this.confUI.Instruction.Y_RATIO;
        const lineGap = this.confUI.Instruction.LINE_GAP;
        this.Line0.x = insX;
        this.Line0.y = insY;
        this.Line1.x = insX;
        this.Line1.y = insY + lineGap;
        this.Line2.x = insX;
        this.Line2.y = insY + lineGap * 2;
        this.Line3.x = insX;
        this.Line3.y = insY + lineGap * 3;
        this.Hint.x = e.width * this.confUI.X_RATIO;
        this.Hint.y = e.height * this.confUI.Hint.Y_RATIO;
    }

    show_(): void {
        if (this.#hasSeen()) return;
        this.visible = true;
        this.relocate_({ width: GP.bw, height: GP.bh });

        const dur = this.confUI.FADE_IN_DURATION;
        this.Overlay.opacity = 0;
        this.Overlay.animate([{ opacity: 1 }], { duration: dur, join: true });
        this.Title.fadeIn_(dur, 0.1);
        this.Line0.fadeIn_(dur, this.confUI.Instruction.FADE_IN_DELAY);
        this.Line1.fadeIn_(dur, this.confUI.Instruction.FADE_IN_DELAY + 0.08);
        this.Line2.fadeIn_(dur, this.confUI.Instruction.FADE_IN_DELAY + 0.16);
        this.Line3.fadeIn_(dur, this.confUI.Instruction.FADE_IN_DELAY + 0.24);
        this.Hint.fadeIn_(dur, this.confUI.Hint.FADE_IN_DELAY);
    }

    hide_(): void {
        const dur = this.confUI.FADE_OUT_DURATION;
        this.fadeOut_(dur)
            .once(AnimateEvent.COMPLETED, () => {
                this.visible = false;
                this.#markSeen();
            });
    }

    #hasSeen(): boolean {
        try {
            return localStorage.getItem(TUTORIAL_KEY) === "1";
        } catch {
            return false;
        }
    }

    #markSeen(): void {
        try {
            localStorage.setItem(TUTORIAL_KEY, "1");
        } catch {
            // ignore storage errors
        }
    }
}
