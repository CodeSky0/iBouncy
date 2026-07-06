import { evBus, GEV, loading, GP, leafer, MainMenu, Scoring, Settlement } from "./instances";
import { Platform, Resource } from "leafer-game";
import { UIConf } from "../config";

export type GameState =
    | "init"
    | "init1"
    | "init2"
    | "almost-prepared"
    | "prepared"
    | "playing"
    | "paused"
    | "over";

/** Runtime timing environment; `actUnitInterval` may become a string from `toFixed` after refresh-rate probing. */
export type ProcessorEnvironment = {
    refreshRate: number;
    actUnitInterval: number | string;
    stdUnitInterval: number;
    fixedStep: number;
    maxStepPerFrame: number;
    paddingTop: number;
    paddingSide: number;
    timeLimit: number;
};

export default class Processor {
    #SM: GameState | string = "init";
    measured = 0;
    refreshRateBucket = new Map<number, number>();
    ENV: ProcessorEnvironment;
    /** 与 Leafer 画布一致，避免子步物理循环反复读 `document.body` 触发布局。 */
    #viewportW = 0;
    #viewportH = 0;

    constructor(ENV: Partial<ProcessorEnvironment> & Record<string, unknown>) {
        this.ENV = ENV as ProcessorEnvironment;
        this.gameOver = this.gameOver.bind(this);
        evBus.on(GEV.GAME_BALL_LOST, () => this.gameOver(false));
        evBus.on(GEV.GAME_TIME_UP, () => this.gameOver(true));
    }

    syncViewport(width: number, height: number): void {
        if (width > 0 && height > 0) {
            this.#viewportW = width;
            this.#viewportH = height;
        }
    }

    get bw(): number {
        return this.#viewportW > 0 ? this.#viewportW : document.body.clientWidth;
    }

    get bh(): number {
        return this.#viewportH > 0 ? this.#viewportH : document.body.clientHeight;
    }

    state(newState: GameState | string): void {
        this.#SM = newState;
    }

    at(...states: (GameState | string)[]): boolean {
        for (const s of states) if (this.#SM === s) return true;
        return false;
    }

    async initializeAll(): Promise<void> {
        await Promise.all([MainMenu.init(), Scoring.init_(), Settlement.init_()]);
    }

    renderElse(): void {
        evBus.emit(GEV.UI_RENDER_ELSE);
    }

    secondRender(): void {
        MainMenu.render_();
    }

    measureRefreshRate(prog: number): void {
        if (this.measured >= 20) return;
        const rrKey = Math.round(60 / prog);
        const curValue = this.refreshRateBucket.get(rrKey);
        if (curValue === undefined) {
            this.refreshRateBucket.set(rrKey, 1);
        } else {
            this.refreshRateBucket.set(rrKey, curValue + 1);
        }
        if (++this.measured >= 20) {
            let maxV = 0;
            let k4maxV = 0;
            for (const [k, v] of this.refreshRateBucket.entries()) {
                if (v >= maxV) {
                    maxV = v;
                    k4maxV = k;
                }
            }
            this.refreshRateBucket.clear();
            GP.ENV.refreshRate = k4maxV;
            GP.ENV.fixedStep = 1000 / k4maxV;
            GP.ENV.actUnitInterval = (1000 / k4maxV).toFixed(1);
            GP.state("init2");
        }
    }

    async fontInitializer(name: string, src: string): Promise<void> {
        src = src.replace(".woff2", "").replace(".woff", "");
        const font = new FontFace(name, `url(${src}.woff2)`);
        try {
            await font.load();
            document.fonts.add(font);
            leafer.forceRender();
        } catch {
            const font2 = new FontFace(name, `url(${src}.woff)`);
            try {
                await font2.load();
                document.fonts.add(font2);
                leafer.forceRender();
            } catch (e) {
                console.error(`An error has occurred while initializing font ${name}:`, e);
            }
        }
    }

    async ImageInitializer(name: string, src: string): Promise<void> {
        try {
            const img = await Platform.origin!.loadImage(src);
            Resource.setImage(`leafer://${name}`, img);
        } catch (e) {
            // 资源加载失败不应阻断游戏初始化（避免首屏空白）。
            console.error(`An error has occurred while initializing image "${name}":`, e);
        }
    }

    prepared(): void {
        GP.state("prepared");
        evBus.emit(GEV.GAME_PREPARED);
        GP.loadingFadeOut();
    }

    start(): void {
        GP.state("playing");
        evBus.emit(GEV.GAME_START);
    }

    restart(): void {
        GP.state("playing");
        evBus.emit(GEV.GAME_RESTART);
    }

    pause(): void {
        if (this.at("paused", "prepared", "over") || this.#SM.startsWith("init")) return;
        this.state("paused");
        evBus.emit(GEV.GAME_PAUSE);
    }

    resume(): void {
        if (this.at("playing", "prepared", "over") || this.#SM.startsWith("init")) return;
        this.state("playing");
        evBus.emit(GEV.GAME_RESUME);
    }

    gameOver(win = false): boolean {
        if (this.at("over")) return true;
        this.state("over");
        evBus.emit(GEV.GAME_OVER, {
            win: win,
            score: Scoring.v,
        });
        return true;
    }

    loadingFadeOut(): void {
        loading
            .animate([{ opacity: 0 }], {
                duration: UIConf.LOADING_FADE_OUT_DURATION * 1000,
                fill: "both",
            })
            .finished.then(function () {
                loading.style.display = "none";
            });
    }
}
