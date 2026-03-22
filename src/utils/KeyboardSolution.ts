import type { KeyboardRoutedType } from "../events";
import { evBus, GEV, leafer } from "../core/instances";
import { KeyEvent } from "leafer-game";

export type RoutedKeyboardPayload = {
    type: KeyboardRoutedType;
    code: string;
};

export default class KeyboardSolution {
    readonly HOLD = "hold" as const;
    readonly UP = "up" as const;

    constructor() {
        this.#$setupEventListeners();
    }

    #$setupEventListeners(): void {
        const KeyEventCallback = (e: { code: string }, t: KeyboardRoutedType): void => {
            evBus.emit(GEV.KEYBOARD_EVENT, {
                type: t,
                code: e.code,
            });
        };
        leafer.on(KeyEvent.HOLD, (e) => KeyEventCallback(e, this.HOLD));
        leafer.on(KeyEvent.UP, (e) => KeyEventCallback(e, this.UP));
    }

    whenHold(callback: (payload: RoutedKeyboardPayload) => void): void {
        evBus.on(GEV.KEYBOARD_EVENT, (payload) => {
            if (payload.type === this.HOLD) {
                callback(payload);
            }
        });
    }

    whenUp(callback: (payload: RoutedKeyboardPayload) => void): void {
        evBus.on(GEV.KEYBOARD_EVENT, (payload) => {
            if (payload.type === this.UP) {
                callback(payload);
            }
        });
    }
}
