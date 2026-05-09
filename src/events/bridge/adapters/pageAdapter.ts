import { ResizeEvent } from "leafer-game";
import { GEV } from "../../channels";
import { eventBus } from "../../bus";
import type { EventBridgeDeps } from "../deps";

/**
 * 将浏览器 / Leafer 层事件映射到应用 {@link GEV}。
 */
export function wirePageEventBridge(deps: EventBridgeDeps): void {
    const { leafer, syncViewport } = deps;

    leafer.on(ResizeEvent.RESIZE, (e) => {
        syncViewport(e.width, e.height);
        eventBus.emit(GEV.RESIZE, { data: e });
    });

    document.addEventListener("visibilitychange", () => {
        eventBus.emit(GEV.VISIBILITY_CHANGE, {
            visible: !document.hidden,
        });
    });
}
