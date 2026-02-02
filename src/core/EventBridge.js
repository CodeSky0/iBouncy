import evBus from "./EventBus";
import { GEV } from "./EventTypes";
import { ResizeEvent, KeyEvent } from "leafer-game";
import { GP, leafer, setPrevTimeStamp, timer } from "./instances";

class EventBridge {
    setup() {
        this.#setupKeyboardEvents();
        this.#setupPageEvents();
        this.#setupTimerEvents();
        this.#setupStateEvents();
        console.log("🔌 事件桥接器已初始化");
    }

    #setupKeyboardEvents() {
        const KeyboardEventCallback = (e, t) => {
            evBus.emit(GEV.KEYBOARD_EVENT, {
                type: t,
                code: e.code,
                key: e.key,
                timestamp: performance.now(),
            });
        };
        leafer.on(KeyEvent.HOLD, e => KeyboardEventCallback(e, "hold"));
        leafer.on(KeyEvent.UP, e => KeyboardEventCallback(e, "up"));
    }

    #setupPageEvents() {
        leafer.on(ResizeEvent.RESIZE, e => {
            evBus.emit(GEV.RESIZE, {
                width: e.width,
                height: e.height,
                oldWidth: e?.old?.width || 0,
                oldHeight: e?.old?.height || 0,
            });
        });
        document.addEventListener("visibilitychange", () => {
            evBus.emit(GEV.VISIBILITY_CHANGE, {
                visible: !document.hidden,
            });
            if (document.hidden) {
                GP.pause();
            }
        });
    }

    #setupTimerEvents() {
        evBus.on(GEV.GAME_PAUSE, () => {
            timer.pauseAll();
        });
        evBus.on(GEV.GAME_RESUME, () => {
            setPrevTimeStamp(performance.now());
            timer.resumeAll();
        });
    }

    #setupStateEvents() {
        evBus.on(GEV.GAME_PREPARED, () => {
            evBus.emit(GEV.GAME_RESET, {
                removeMask: false,
            });
            evBus.emit(GEV.MAIN_MENU_SHOW);
        });
        evBus.on(GEV.GAME_START, () => {
            evBus.emit(GEV.MAIN_MENU_HIDE);
        });
        evBus.on(GEV.GAME_RESTART, () => {
            evBus.emit(GEV.GAME_RESET, {
                removeMask: true,
            });
            evBus.emit(GEV.GAME_START);
        });
    }
}

export const evBridge = new EventBridge();
export default evBridge;
