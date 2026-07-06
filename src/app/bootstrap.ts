import { createEventBridge, evBus, GEV } from "../events";
import { UIConf } from "../config";
import { leafer, GP, timer } from "../core/instances";
import { MainMenu, OptionsMenu, Settlement, Scoring } from "../ui/elements";
import ML from "../utils/MaskLayer";
import KeyboardSolution from "../utils/KeyboardSolution";
import { loading } from "./dom";
import { setPrevTimeStamp } from "./timing";

loading.addEventListener("dragstart", (e) => e.preventDefault());

createEventBridge({
    leafer,
    timer,
    setPrevTimeStamp,
    syncViewport: (w, h) => GP.syncViewport(w, h),
}).setup();

GP.syncViewport(document.body.clientWidth, document.body.clientHeight);

export const KS = new KeyboardSolution();

ML.$init(MainMenu, OptionsMenu, Settlement);

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

GP.setScoreSource(() => Scoring.v);

export async function initializeApp(): Promise<void> {
    await Promise.all([MainMenu.init(), Scoring.init_(), Settlement.init_()]);
    MainMenu.render_();
    GP.state("init1");
}
