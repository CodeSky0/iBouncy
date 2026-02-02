import evBridge from "./core/EventBridge";
import { GameConf } from "./config";
import {
    setPrevTimeStamp,
    F,
    D,
    prevTimeStamp,
    loading,
    leafer,
    GI,
    GP,
    timer,
    Mask,
    MainMenu,
    OptionsMenu,
    Settlement,
    FPS,
    ForbiddenZone,
    Scoring,
    Tablet,
    Ball,
} from "./core/instances";

import {
    ResizeEvent,
    KeyEvent,
} from "leafer-game";

evBridge.setup();
loading.addEventListener("dragstart", e => e.preventDefault());

let accumulated = 0;

Mask.render_();
Mask.show_("#FFF", 1, 0.7, 0.4);
GP.renderAll();
requestAnimationFrame(firstFrame);
timer.newInterval(() => FPS.assign_(timer.FPS), GameConf.FPS_DETECT_INTERVAL * 1000);
GP.initializeAll()
    .then(GP.secondRender)
    .then(() => GP.state("init1"))
    .catch(err => console.error("Initialization failed...\n", err));

function firstFrame(timeStamp) {
    setPrevTimeStamp(timeStamp);
    gameLoop(timeStamp);
}

function gameLoop(timeStamp) {
    const deltaTime = timeStamp - prevTimeStamp;
    setPrevTimeStamp(timeStamp);
    timer.timeDetect(timeStamp);

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
        Ball.timeDivisor = Math.min(F(accumulated / GP.ENV.fixedStep), GP.ENV.maxStepPerFrame);
        while (accumulated >= GP.ENV.fixedStep && steps <= GP.ENV.maxStepPerFrame) { // sub-stepping loop
            accumulated -= GP.ENV.fixedStep;
            ++steps;
            const unitProg = GP.ENV.fixedStep / GP.ENV.stdUnitInterval;
            Ball.frameLoop_(unitProg);
            Tablet.frameLoop(unitProg);
            if (GI.collisionDetect() && Ball.vy < 0) {
                const bv = Math.sqrt(Ball.vx ** 2 + Ball.vy ** 2);
                const bvP = Math.log2(bv) + 1 / Math.cos(Math.PI / 30 * bv);
                const d = D(Tablet.cx - Ball.cx);
                const dP = Math.cos(Math.PI / Tablet.w * 2 * d) + 0.5;
                Scoring.tip_(Scoring.delta_(0.4 * bvP + 0.16 * dP));
            }
        }
    }

    requestAnimationFrame(gameLoop);
}

document.addEventListener("visibilitychange", function () {
    document.hidden && GP.pause();
});
leafer.on(ResizeEvent.RESIZE, function (e) {
    Mask.relocate_(e);
    MainMenu.relocate_(e);
    OptionsMenu.relocate_(e);
    Settlement.relocate_(e);
    FPS.relocate_(e);
    ForbiddenZone.relocate_(e);
    Scoring.relocate_(e);
});
leafer.on(KeyEvent.HOLD, function (e) {
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
leafer.on(KeyEvent.UP, function (e) {
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
            if (GP.at("over")) {
                Settlement.hide_();
                GP.prepared();
            } else if (GP.at("paused")) {
                OptionsMenu.hide_();
                GP.prepared();
            }
            break;
    }
});
