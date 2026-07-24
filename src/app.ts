import { initializeApp, KS } from "./app/bootstrap";
import { GameConf, UIConf } from "./config";
import { evBus, GEV } from "./events";
import { abs, floor } from "./utils/math";
import { effectsEnabled, setEffectsEnabled } from "./core/effects";
import { prevTimeStamp, setPrevTimeStamp } from "./app/timing";
import { GI, GP, timer, leafer, Ball, Tablet } from "./core/instances";
import { Mask, FPS } from "./ui/elements";
import { initCloudOverlay } from "./ui/cloudOverlay";
import { addScore } from "./cloud/client";
import { addLocalScore, clearSynced, markSynced } from "./cloud/localScores";
import { soundManager } from "./audio/SoundManager";
import { touchCtrl } from "./utils/TouchController";

/** 碰撞加分公式用：板宽恒定，提出循环外避免每子步除法。 */
const TABLET_2PI_OVER_W = (Math.PI * 2) / UIConf.Tablet.WIDTH;
const BV_ANGLE_SCALE = Math.PI / 30;

const cloudUI = initCloudOverlay();

let accumulated = 0;
let rafId = 0;
let lowFpsStreak = 0;

Mask.render_();
Mask.show_("#FFF", 1, 0.7, 0.4);
GP.renderElse();
rafId = requestAnimationFrame(firstFrame);
timer.newInterval(() => FPS.assign_(timer.FPS), GameConf.FPS_DETECT_INTERVAL * 1000);
initializeApp().catch((err) => {
    console.error("Initialization failed...\n", err);
    // 显示错误边界
    const loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.style.display = "none";
    const errorScreen = document.getElementById("error-screen");
    if (errorScreen) errorScreen.classList.add("show");
});

// 触摸控制器初始化
touchCtrl.mount();

// 音效系统初始化（首次用户手势后恢复 AudioContext）
let audioEnsured = false;
const ensureAudio = () => {
    if (audioEnsured) return;
    soundManager.ensure();
    audioEnsured = true;
};
document.addEventListener("pointerdown", ensureAudio, { once: true });
document.addEventListener("keydown", ensureAudio, { once: true });

window.addEventListener("unload", () => {
    if (rafId) cancelAnimationFrame(rafId);
    timer.pauseAll();
    evBus.destroy();
});

function firstFrame(timeStamp: number): void {
    const lw = leafer.width ?? 0;
    const lh = leafer.height ?? 0;
    const w = lw > 0 ? lw : document.body.clientWidth;
    const h = lh > 0 ? lh : document.body.clientHeight;
    GP.syncViewport(w, h);
    setPrevTimeStamp(timeStamp);
    gameLoop(timeStamp);
}

function gameLoop(timeStamp: number): void {
    const deltaTime = timeStamp - prevTimeStamp;
    setPrevTimeStamp(timeStamp);
    timer.timeDetect(timeStamp);

    // 卡顿恢复机制：连续低 FPS 时关闭视觉特效，保障物理计算更稳定。
    if (GP.at("playing")) {
        const fps = timer.FPS;
        if (Number.isFinite(fps) && fps < 30) {
            lowFpsStreak++;
        } else {
            lowFpsStreak = 0;
        }
        setEffectsEnabled(lowFpsStreak < 3);
    } else {
        lowFpsStreak = 0;
        setEffectsEnabled(true);
    }

    if (GP.at("init1")) {
        GP.measureRefreshRate(deltaTime / GP.ENV.stdUnitInterval);
    } else if (GP.at("init2")) {
        Ball.prepare_();
        GP.state("almost-prepared");
    } else if (GP.at("almost-prepared")) {
        GP.prepared();
    }

    let steps = 1;
    if (GP.at("playing")) {
        accumulated += Math.min(deltaTime, GameConf.MAX_ACCUMULATED * 1000);
        Ball.timeDivisor = Math.min(floor(accumulated / GP.ENV.fixedStep), GP.ENV.maxStepPerFrame);
        const unitProg = GP.ENV.fixedStep / GP.ENV.stdUnitInterval;
        while (accumulated >= GP.ENV.fixedStep && steps <= GP.ENV.maxStepPerFrame) {
            // sub-stepping loop
            accumulated -= GP.ENV.fixedStep;
            ++steps;
            Ball.frameLoop_(unitProg);
            Tablet.frameLoop(unitProg);
            if (GI.collisionDetect() && Ball.vy < 0) {
                const bv = Math.hypot(Ball.vx, Ball.vy);
                const bvP = Math.log2(bv) + 1 / Math.cos(BV_ANGLE_SCALE * bv);
                const d = abs(Tablet.cx - Ball.cx);
                const dP = Math.cos(TABLET_2PI_OVER_W * d) + 0.5;
                evBus.emit(GEV.PLAYER_SCORE, { delta: 0.4 * bvP + 0.16 * dP });
                soundManager.playBounce();
            }
        }
    }

    rafId = requestAnimationFrame(gameLoop);
}

evBus.on(GEV.VISIBILITY_CHANGE, (payload) => {
    !payload.visible && GP.pause();
});

// 游戏结束时：如果已登录则把本局成绩写入云端。
evBus.on(GEV.GAME_OVER, async (payload) => {
    // 先本地保存一份（游客也有记录；登录后可同步）
    const local = addLocalScore(payload.score);

    // 音效：胜利或失败
    if (payload.win) {
        soundManager.playWin();
    } else {
        soundManager.playLose();
    }

    if (!cloudUI.getUser()) return;
    try {
        await addScore(payload.score, local.clientId);
        markSynced(local.clientId);
        clearSynced();
    } catch (e) {
        console.error("Upload score failed:", e);
    }
});

// 音效：游戏开始
evBus.on(GEV.GAME_START, () => {
    soundManager.playStart();
});

// 触摸视口同步
evBus.on(GEV.RESIZE, (payload) => {
    touchCtrl.syncViewport(payload.data.width, payload.data.height);
});

// 初始视口同步
touchCtrl.syncViewport(document.body.clientWidth, document.body.clientHeight);
KS.whenHold((e) => {
    switch (e.code) {
        case "Semicolon":
            FPS.toggle_();
            break;
        case "Escape":
        case "KeyP":
            GP.pause();
            break;
    }
});
KS.whenUp((e) => {
    switch (e.code) {
        case "Space":
            if (GP.at("prepared")) {
                GP.start();
            } else if (GP.at("over")) {
                GP.restart();
            } else if (GP.at("paused")) {
                GP.resume();
            }
            break;
        case "Enter":
        case "NumpadEnter":
            if (GP.at("over") || GP.at("paused")) {
                GP.prepared();
            }
            break;
    }
});
