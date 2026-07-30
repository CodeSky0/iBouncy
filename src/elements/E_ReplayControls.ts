import { Group, Rect, Path, Text } from "leafer-game";
import { evBus, GEV } from "../events";
import { GP, Ball, Tablet, Timing } from "../core/instances";
import { Scoring } from "../ui/elements";
import { ReplayPlayer, ReplayRecorder } from "../core/replay";
import { t } from "../i18n";

const PANEL_WIDTH = 260;
const PANEL_PADDING = 14;
const PANEL_RADIUS = 20;
const PANEL_MARGIN = 16;
const PANEL_HEIGHT = 164;

// Glass-morphism colors matching cloud FAB style
const GLASS_BG = "rgba(255, 255, 255, 0.05)";
const GLASS_BORDER = "rgba(255, 255, 255, 0.14)";
const GLASS_BTN_BG = "rgba(255, 255, 255, 0.06)";
const GLASS_BTN_BORDER = "rgba(255, 255, 255, 0.12)";
const GLASS_TEXT = "rgba(255, 255, 255, 0.92)";
const GLASS_TEXT_DIM = "rgba(255, 255, 255, 0.50)";
const ACCENT_COLOR = "rgba(94, 234, 212, 0.85)"; // prism-teal
const ACCENT_FILL = "rgba(94, 234, 212, 0.15)";
const ACCENT_STROKE = "rgba(94, 234, 212, 0.35)";

export default class E_ReplayControls extends Group {
    private background!: Rect;
    private titleText!: Text;
    private closeBtn!: Group;
    private closeIcon!: Path;
    private playPauseBtn!: Group;
    private playIcon!: Path;
    private pauseIcon!: Path;
    private progressBar!: Rect;
    private progressFill!: Rect;
    private progressHandle!: Rect;
    private timeText!: Text;
    private speedBtn!: Group;
    private speedText!: Text;
    private exportBtn!: Group;
    private exportText!: Text;
    private replayPlayer: ReplayPlayer;
    private replayRecorder: ReplayRecorder;
    private isDraggingProgress = false;
    private isReplayMode = false;
    private currentReplayId: string | null = null;

    constructor() {
        super({
            x: GP.bw - PANEL_WIDTH - PANEL_MARGIN,
            y: PANEL_MARGIN,
            width: PANEL_WIDTH,
            height: PANEL_HEIGHT,
            visible: false,
            zIndex: 1000,
        });

        this.replayPlayer = new ReplayPlayer();
        this.replayRecorder = new ReplayRecorder();
        this.#setupUI();
        this.#setupEventListeners();
        this.#setupPlayerCallbacks();
    }

    #setupUI(): void {
        const w = PANEL_WIDTH;
        const p = PANEL_PADDING;

        // Glass background
        this.background = new Rect({
            x: 0,
            y: 0,
            width: w,
            height: PANEL_HEIGHT,
            fill: GLASS_BG,
            corner: PANEL_RADIUS,
            stroke: GLASS_BORDER,
            strokeWidth: 0.5,
            shadow: {
                x: 0,
                y: 4,
                blur: 20,
                color: "rgba(0, 0, 0, 0.30)",
            },
        });
        // Inner specular highlight (top edge)
        const specHighlight = new Rect({
            x: 1,
            y: 0.5,
            width: w - 2,
            height: 1,
            fill: "rgba(255, 255, 255, 0.18)",
            corner: PANEL_RADIUS,
        });

        // Title
        this.titleText = new Text({
            x: p,
            y: p + 2,
            text: t("replayControls.title"),
            fill: GLASS_TEXT,
            fontSize: 13,
            fontWeight: "bold",
        });

        // Close (exit) button
        this.closeBtn = new Group({
            x: w - p - 20,
            y: p,
            width: 20,
            height: 20,
            cursor: "pointer",
        });
        const closeBg = new Rect({
            x: 0,
            y: 0,
            width: 20,
            height: 20,
            fill: "rgba(255, 255, 255, 0.04)",
            corner: 10,
        });
        this.closeIcon = new Path({
            path: "M5 5L15 15M15 5L5 15",
            stroke: "rgba(255, 255, 255, 0.55)",
            strokeWidth: 1.5,
        });
        this.closeBtn.add([closeBg, this.closeIcon]);

        // Play/Pause button
        this.playPauseBtn = new Group({
            x: p,
            y: 72,
            width: 38,
            height: 38,
            cursor: "pointer",
        });
        const ppBg = new Rect({
            x: 0,
            y: 0,
            width: 38,
            height: 38,
            fill: GLASS_BTN_BG,
            corner: 12,
            stroke: GLASS_BTN_BORDER,
            strokeWidth: 0.5,
        });
        this.playPauseBtn.add(ppBg);

        this.playIcon = new Path({
            path: "M10 7v22l16-11z",
            fill: GLASS_TEXT,
            x: 13,
            y: 8,
        });
        this.pauseIcon = new Path({
            path: "M8 7h6v22H8V7zm14 0h6v22h-6V7z",
            fill: GLASS_TEXT,
            x: 11,
            y: 8,
            visible: false,
        });
        this.playPauseBtn.add([this.playIcon, this.pauseIcon]);

        // Speed button
        this.speedBtn = new Group({
            x: p + 48,
            y: 72,
            width: 54,
            height: 38,
            cursor: "pointer",
        });
        const speedBg = new Rect({
            x: 0,
            y: 0,
            width: 54,
            height: 38,
            fill: GLASS_BTN_BG,
            corner: 12,
            stroke: GLASS_BTN_BORDER,
            strokeWidth: 0.5,
        });
        this.speedBtn.add(speedBg);
        this.speedText = new Text({
            x: 27,
            y: 19,
            text: "1.0x",
            fill: GLASS_TEXT,
            fontSize: 12,
            fontWeight: "bold",
            around: "center",
            origin: "center",
        });
        this.speedBtn.add(this.speedText);

        // Export button
        const exportW = w - p * 2 - 112;
        this.exportBtn = new Group({
            x: p + 112,
            y: 72,
            width: exportW,
            height: 38,
            cursor: "pointer",
        });
        const exportBg = new Rect({
            x: 0,
            y: 0,
            width: exportW,
            height: 38,
            fill: ACCENT_FILL,
            stroke: ACCENT_STROKE,
            strokeWidth: 0.5,
            corner: 12,
        });
        this.exportBtn.add(exportBg);
        this.exportText = new Text({
            text: t("replayControls.export"),
            fill: ACCENT_COLOR,
            fontSize: 12,
            fontWeight: "bold",
            around: "center",
        });
        this.exportText.x = exportW / 2;
        this.exportText.y = 19;
        this.exportText.origin = "center";
        this.exportBtn.add(this.exportText);

        // Progress bar
        const barY = 38;
        const barHeight = 4;
        this.progressBar = new Rect({
            x: p,
            y: barY,
            width: w - p * 2,
            height: barHeight,
            fill: "rgba(255, 255, 255, 0.10)",
            corner: 2,
        });
        this.progressFill = new Rect({
            x: p,
            y: barY,
            width: 0,
            height: barHeight,
            fill: ACCENT_COLOR,
            corner: 2,
        });
        this.progressHandle = new Rect({
            x: p - 5,
            y: barY - 4,
            width: 10,
            height: 12,
            fill: "#FFFFFF",
            corner: 5,
            cursor: "pointer",
            shadow: {
                x: 0,
                y: 1,
                blur: 4,
                color: "rgba(0, 0, 0, 0.3)",
            },
        });

        // Time display
        this.timeText = new Text({
            x: p,
            y: barY + barHeight + 6,
            text: "0:00 / 0:00",
            fill: GLASS_TEXT_DIM,
            fontSize: 11,
        });

        this.add([
            this.background,
            specHighlight,
            this.progressBar,
            this.progressFill,
            this.progressHandle,
            this.timeText,
            this.titleText,
            this.closeBtn,
            this.playPauseBtn,
            this.speedBtn,
            this.exportBtn,
        ]);
    }

    #setupEventListeners(): void {
        // Play/Pause button
        this.playPauseBtn.on("pointerdown", () => {
            if (this.replayPlayer.isPlayingReplay()) {
                if (this.replayPlayer.isReplayPaused()) {
                    this.replayPlayer.resume();
                    this.#updatePlayPauseIcon(true);
                } else {
                    this.replayPlayer.pause();
                    this.#updatePlayPauseIcon(false);
                }
            }
        });

        // Close (exit) button
        this.closeBtn.on("pointerdown", () => {
            window.dispatchEvent(new CustomEvent("ibouncy:replay-end"));
            this.replayPlayer.stop();
            this.isReplayMode = false;
            this.#updatePlayPauseIcon(false);
            this.hide();
            GP.prepared();
        });

        // Progress bar interaction
        this.progressBar.on("pointerdown", (e: any) => this.#handleProgressSeek(e));
        this.progressHandle.on("pointerdown", (e: any) => {
            this.isDraggingProgress = true;
            this.#handleProgressSeek(e);
        });

        // Speed control
        this.speedBtn.on("pointerdown", () => {
            const speeds = [0.5, 1, 1.5, 2];
            const currentSpeed = this.replayPlayer["playbackSpeed"];
            const currentIndex = speeds.indexOf(currentSpeed);
            const nextIndex = (currentIndex + 1) % speeds.length;
            this.replayPlayer.setPlaybackSpeed(speeds[nextIndex]);
            this.speedText.text = `${speeds[nextIndex].toFixed(1)}x`;
        });

        // Export button
        this.exportBtn.on("pointerdown", () => {
            if (this.currentReplayId) {
                this.replayRecorder.exportReplay(this.currentReplayId);
            }
        });

        // Global drag events for progress handle
        window.addEventListener("pointermove", (e) => {
            if (this.isDraggingProgress) {
                this.#handleProgressSeek(e);
            }
        });
        window.addEventListener("pointerup", () => {
            this.isDraggingProgress = false;
        });

        // Resize handling
        evBus.on(GEV.RESIZE, (payload) => this.#handleResize(payload.data));
    }

    #setupPlayerCallbacks(): void {
        this.replayPlayer.setFrameUpdateCallback((state) => {
            this.#applyFrameState(state);
            this.#updateProgressUI();
        });
        this.replayPlayer.setPlaybackEndCallback(() => {
            window.dispatchEvent(new CustomEvent("ibouncy:replay-end"));
            this.#updatePlayPauseIcon(false);
            this.isReplayMode = false;
        });
    }

    #handleProgressSeek(e: any): void {
        if (!this.replayPlayer.getMetadata()) return;

        const rect = this.progressBar.renderBounds;
        const x = e.x - rect.x;
        const progress = Math.max(0, Math.min(1, x / rect.width));
        this.replayPlayer.seekToProgress(progress);
        this.#updateProgressUI();
    }

    #handleResize(data: { width: number; height: number }): void {
        this.x = data.width - PANEL_WIDTH - PANEL_MARGIN;
    }

    #updatePlayPauseIcon(isPlaying: boolean): void {
        this.playIcon.visible = !isPlaying;
        this.pauseIcon.visible = isPlaying;
    }

    #updateProgressUI(): void {
        const progress = this.replayPlayer.getProgress();
        const metadata = this.replayPlayer.getMetadata();
        if (!metadata) return;

        const barWidth = this.progressBar.width!;
        this.progressFill.width = barWidth * progress;
        this.progressHandle.x = PANEL_PADDING + barWidth * progress - 5;

        const currentTime = Math.floor(progress * metadata.duration);
        const totalTime = Math.floor(metadata.duration);
        this.timeText.text = `${this.#formatTime(currentTime)} / ${this.#formatTime(totalTime)}`;
    }

    #formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    #applyFrameState(state: any): void {
        (Ball as any).cx = state.ball.x;
        (Ball as any).cy = state.ball.y;
        Ball.vx = state.ball.vx;
        Ball.vy = state.ball.vy;

        (Tablet as any).cx = state.tablet.x;
        (Tablet as any).y = state.tablet.y;
        Tablet.vx = state.tablet.vx;
        Tablet.vy = state.tablet.vy;

        (Scoring as any).assign_(state.score);
        (Scoring as any).updateCombo_(state.combo, state.multiplier);

        Timing.remaining = state.remaining;
    }

    show(): void {
        this.visible = true;
        // Reposition after show
        this.x = GP.bw - PANEL_WIDTH - PANEL_MARGIN;
    }

    hide(): void {
        this.visible = false;
    }

    loadReplay(replayId: string): boolean {
        const success = this.replayPlayer.loadReplay(replayId);
        if (success) {
            this.currentReplayId = replayId;
            this.isReplayMode = true;
            this.#updateProgressUI();
            const metadata = this.replayPlayer.getMetadata();
            if (metadata) {
                this.timeText.text = `0:00 / ${this.#formatTime(Math.floor(metadata.duration))}`;
            }
        }
        return success;
    }

    startPlayback(): void {
        if (this.isReplayMode) {
            this.replayPlayer.start();
            this.#updatePlayPauseIcon(true);
        }
    }

    stopPlayback(): void {
        this.replayPlayer.stop();
        this.isReplayMode = false;
        this.#updatePlayPauseIcon(false);
    }

    update(): void {
        if (this.isReplayMode) {
            this.replayPlayer.update();
        }
    }

    isPlaying(): boolean {
        return this.isReplayMode && this.replayPlayer.isPlayingReplay();
    }
}
