import { GP, timer } from "../core/instances";

let canvas;
let shaking = false;

function getCanvas() {
    if (!canvas) {
        canvas = document.querySelector("canvas");
    }
    return canvas;
}

export function shakeScreen(intensity = 8, duration = 220) {
    if (!GP.at("playing")) return;
    const el = getCanvas();
    if (!el || shaking) return;
    shaking = true;
    const baseTransform = el.style.transform || "";
    const start = performance.now();
    const interval = timer.newInterval(() => {
        const now = performance.now();
        const t = (now - start) / duration;
        if (t >= 1) {
            timer.cancelInterval(interval);
            el.style.transform = baseTransform;
            shaking = false;
            return;
        }
        const damp = 1 - t;
        const dx = (Math.random() * 2 - 1) * intensity * damp;
        const dy = (Math.random() * 2 - 1) * intensity * damp;
        el.style.transform = `translate(${dx}px, ${dy}px) ${baseTransform}`;
    }, 16);
}

