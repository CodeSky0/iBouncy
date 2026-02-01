import { Group, Path, Text } from "leafer-game";
import { Ball, F, GP, timer } from "../core/instances";
import { UIConf } from "../config";

export default class E_Scoring extends Group {
    confUI = UIConf.Scoring;
    v = 0;

    constructor() {
        super({
            x: GP.bw / 2 - 120,
            y: 0,
        });
        this.Panel = new Path({
            path: "m -120 0\n" +
                "  h 10\n" +
                "  a 20 15 0 0 1 20 15\n" +
                "  v 35\n" +
                "  a 15 18 0 0 0 15 18\n" +
                "  h 150\n" +
                "  a 15 18 0 0 0 15 -18\n" +
                "  v -35\n" +
                "  a 20 15 0 0 1 20 -15\n" +
                "  h 10\n" +
                "  Z",
            x: 120,
            y: 0,
            fill: this.confUI.Panel.FILL,
        });
        this.Integer = new Text({
            x: -GP.bw,
            y: 7,
            fontSize: this.confUI.Integer.FONT_SIZE,
            fill: this.confUI.Integer.FILL,
            text: "-",
            fontFamily: this.confUI.FONT_FAMILY,
        });
        this.Decimal = new Text({
            x: -GP.bw,
            y: 15,
            fontSize: this.confUI.Decimal.FONT_SIZE,
            fill: this.confUI.Decimal.FILL,
            text: "--",
            fontFamily: this.confUI.FONT_FAMILY,
        });
        this.add([this.Panel, this.Integer, this.Decimal]);

        this.init_ = this.init_.bind(this);
    }

    reset_() {
        this.assign_(0);
    }

    relocate_(e) {
        if (e.width === e.old.width) return;
        this.cx = e.width / 2;
        this.#newScore_();
    }

    async init_() {
        await this.#loadFont_();
    }

    async #loadFont_() {
        await GP.fontInitializer("HYDiSiKe-U", "./assets/fonts/HYDiSiKe-U");
        this.#newScore_();
    }

    assign_(score) {
        this.v = Math.round(score * 10);
        this.#newScore_();
        return E_Scoring.stringify_(this.v);
    }

    delta_(x) {
        const prevV = this.v;
        this.v += Math.round(x * 10);
        this.#newScore_();
        return E_Scoring.stringify_(this.v - prevV);
    }

    tip_(delta) {
        const tipConf = this.confUI.tip;
        const aniConf = tipConf.ANIMATION;
        const [initialOffsetX, transitionX, transitionY] = this.#getTipData_();
        const tip = new Text({
            x: Ball.cx + initialOffsetX,
            y: Ball.oy,
            around: "center",
            text: "+" + delta,
            fill: tipConf.FILL,
            stroke: tipConf.STROKE,
            fontSize: tipConf.FONT_SIZE,
            fontFamily: this.confUI.FONT_FAMILY,
            opacity: tipConf.OPACITY,
            shadow: {
                x: 1,
                y: 1,
                blur: 10,
                color: tipConf.SHADOW_COLOR,
            },
            animation: {
                keyframes: [
                    {
                        style: { opacity: tipConf.OPACITY, fontSize: aniConf.FONT_SIZE1 },
                        duration: aniConf.STYLE_DURATION1,
                    },
                    {
                        style: { opacity: 0, fontSize: aniConf.FONT_SIZE2 },
                        duration: aniConf.STYLE_DURATION2,
                    },
                ],
                join: true,
            },
        });
        tip.render_();
        tip.animate([
            { offsetX: transitionX },
        ], {
            duration: aniConf.X_DURATION,
            easing: "sine-out",
            join: true,
        });
        tip.animate([
            {
                style: { offsetY: aniConf.Y_OFFSET1 },
                duration: aniConf.Y_DURATION1,
                easing: "quad-out",
            },
            {
                style: { offsetY: transitionY },
                duration: aniConf.Y_DURATION2,
                easing: "quad-in-out",
            },
        ], {
            join: true,
        });
        timer.newTimeout(function () {
            tip.destroy();
        }, tipConf.DURATION * 1000);
    }

    #getTipData_() {
        const ballSpeedAffect = 0.7 * Ball.vx * 600 / GP.ENV.actUnitInterval;
        let direction = Math.random() >= 0.5 ? 1 : -1;
        let initialOffsetX = (10 + Math.random() * 20) * direction;
        let transitionX0 = (40 + Math.random() * 20) * direction;
        let transitionY = (Math.random() - 0.4) * 24;
        const totalTranslationX = initialOffsetX + transitionX0 + ballSpeedAffect;
        if (Ball.cx + totalTranslationX <= GP.ENV.paddingSide) {
            initialOffsetX *= -1;
            transitionX0 *= -1;
        } else if (Ball.cx + totalTranslationX >= GP.bw - GP.ENV.paddingSide) {
            initialOffsetX *= -1;
            transitionX0 *= -1;
        }
        return [initialOffsetX + ballSpeedAffect / 2, transitionX0 + ballSpeedAffect / 2, transitionY];
    }

    #newScore_() {
        this.Integer.text = F(this.v / 10);
        this.Decimal.text = "." + this.v % 10;
        this.Integer.x = (240 - this.Integer.w - this.Decimal.w) / 2;
        this.Decimal.x = this.Integer.ox;
    }

    static stringify_(v) {
        return `${F(v / 10)}.${v % 10}`;
    }
}
