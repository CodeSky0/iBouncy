import "./initUI";
import { createEventBridge, evBus, GEV } from "../events";
import { UIConf } from "../config";
import { leafer, GP, timer } from "../core/instances";
import { MainMenu, OptionsMenu, Settlement, Scoring } from "../ui/elements";
import ML from "../utils/MaskLayer";
import KeyboardSolution from "../utils/KeyboardSolution";
import { loading } from "./dom";
import { setPrevTimeStamp } from "./timing";

// 阻止加载图标的默认拖拽行为。
loading.addEventListener("dragstart", (e) => e.preventDefault());

// 装配外部系统与内部事件总线之间的桥接层。
createEventBridge({
    leafer,
    timer,
    setPrevTimeStamp,
    syncViewport: (w, h) => GP.syncViewport(w, h),
}).setup();

// 同步初始视口。
GP.syncViewport(document.body.clientWidth, document.body.clientHeight);

// 键盘事件路由。
export const KS = new KeyboardSolution();

// 遮罩层页面注册。
ML.$init(MainMenu, OptionsMenu, Settlement);

// 游戏进入可开始状态后淡出加载屏。
evBus.on(GEV.GAME_PREPARED, () => {
    loading
        .animate([{ opacity: 0 }], {
            duration: UIConf.LOADING_FADE_OUT_DURATION * 1000,
            fill: "both",
        })
        .finished.then(() => {
            loading.style.display = "none";
        });
});

// 注入结算分数来源，避免 Processor 直接依赖 UI 模块。
GP.setScoreSource(() => Scoring.v);

export async function initializeApp(): Promise<void> {
    await Promise.all([MainMenu.init(), Scoring.init_(), Settlement.init_()]);
    MainMenu.render_();
    GP.state("init1");
}
