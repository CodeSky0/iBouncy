import type { Leafer } from "leafer-game";
import type EmbeddedTimer from "../../utils/EmbeddedTimer";

/**
 * 桥接层依赖：由 {@link createEventBridge} 在应用启动时注入，避免 `events` 反向依赖 `instances`。
 */
export type EventBridgeDeps = {
    leafer: Leafer;
    timer: EmbeddedTimer;
    setPrevTimeStamp: (timestamp: number) => void;
};
