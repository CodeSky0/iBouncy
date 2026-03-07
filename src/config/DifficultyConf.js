/**
 * 多难度关卡配置
 * - ballSpeedScale: 球速系数（相对默认速度）
 * - tabletWidthScale: 挡板宽度系数（相对默认宽度）
 */
export const DIFFICULTY_LEVELS = {
    EASY: {
        id: "easy",
        name: "简单",
        ballSpeedScale: 0.75,
        tabletWidthScale: 1.35,
    },
    NORMAL: {
        id: "normal",
        name: "普通",
        ballSpeedScale: 1,
        tabletWidthScale: 1,
    },
    HARD: {
        id: "hard",
        name: "困难",
        ballSpeedScale: 1.35,
        tabletWidthScale: 0.7,
    },
};

export const DEFAULT_DIFFICULTY = "NORMAL";
