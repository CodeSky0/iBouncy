/*
Units:
    size: pixel (px)
    time: second (s)
    velocity: pixel per frame (px/f)
    acceleration: pixel per frame^2 (px/f/f)
 */
export const GameConf = {
    TIME_LIMIT: 120,
    MAX_ACCUMULATED: 0.5, // can redisplay frames of up to 0.5s
    MAX_STEP_PER_FRAME: 10,
    DEFAULT_REFRESH_RATE: 60,
    FPS_DETECT_INTERVAL: 0.4,
    PADDING: {
        TOP: 80,
        SIDE: 40,
    },
    Ball: {
        VX_MIN: 1.6,
        VX_MAX: 3.5,
        VY: 3.5,
        AX: 4.2e-4,
        AY: 8.2e-4,
        ACCELERATION: {
            FROM: 105,
            TO: 15,
            COOLDOWN: 0.05,
            RATIO_X1: 1.5,
            RATIO_Y1: 1.2,
            RATIO_X2: 0.6,
            RATIO_Y2: 0.25,
            DECAY_DELAY: 0.2,
            DECAY_TIMES: 6,
        },
    },
    Tablet: {
        VX: 6,
        VY: 2.8,
    },
};
