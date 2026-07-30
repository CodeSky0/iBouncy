import { Group, Rect, Path, Text } from "leafer-game";
import { evBus, GEV } from "../events";
import { GP, Ball, Tablet, Timing } from "../core/instances";
import { Scoring } from "../ui/elements";
import { ReplayPlayer, ReplayRecorder } from "../core/replay";
import { t } from "../i18n";

const PANEL_WIDTH = 240;
const PANEL_PADDING = 12;
const PANEL_RADIUS = 12;
const PANEL_MARGIN = 16;

export default class E_ReplayControls extends Group {
    private background: Rect;
    private titleText: Text;
    private closeBtn: Group;
    private closeIcon: Path;
    private playPauseBtn: Group;
    private playIcon: Path;
    private pauseIcon: Path;
    private progressBar: Rect;
    private progressFill: Rect;
    private progressHandle: Rect;
    private timeText: Text;
    private speedBtn: Group;
    private speedText: Text;
    private exportBtn: Group;
    private exportText: Text;
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
            height: 160,
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

        // Background
        this.background = new Rect({
            x: 0,
            y: 0,
            width: w,
            height: 160,
            fill: "rgba(30, 30, 30, 0.92)",
            corner: PANEL_RADIUS,
            stroke: "rgba(255, 255, 255, 0.12)",
            strokeWidth: 1,
        });

        // Title
        this.titleText = new Text({
            x: p,
            y: p + 2,
            text: t("replayControls.title"),
            fill: "rgba(255, 255, 255, 0.9)",
            fontSize: 14,
            fontWeight: "bold",
        });

        // Close (exit) button
        this.closeBtn = new Group({
            x: w - p - 18,
            y: p,
            width: 18,
            height: 18,
            cursor: "pointer",
        });
        this.closeIcon = new Path({
            path: "M4 4L14 14M14 4L4 14",
            stroke: "rgba(255, 255, 255, 0.6)",
            strokeWidth: 2,
        });
        this.closeBtn.add(this.closeIcon);

        // Play/Pause button
        this.playPauseBtn = new Group({
            x: p,
            y: 68,
            width: 36,
            height: 36,
            cursor: "pointer",
        });
        // Button background
        const ppBg = new Rect({
            x: 0,
            y: 0,
            width: 36,
            height: 36,
            fill: "rgba(255, 255, 255, 0.1)",
            corner: 8,
        });
        this.playPauseBtn.add(ppBg);

        this.playIcon = new Path({
            path: "M10 7v22l16-11z",
            fill: "#FFFFFF",
            x: 12,
            y: 7,
        });
        this.pauseIcon = new Path({
            path: "M8 7h6v22H8V7zm14 0h6v22h-6V7z",
            fill: "#FFFFFF",
            x: 10,
            y: 7,
            visible: false,
        });
        this.playPauseBtn.add([this.playIcon, this.pauseIcon]);

        // Speed button
        this.speedBtn = new Group({
            x: p + 46,
            y: 68,
            width: 52,
            height: 36,
            cursor: "pointer",
        });
        const speedBg = new Rect({
            x: 0,
            y: 0,
            width: 52,
            height: 36,
            fill: "rgba(255, 255, 255, 0.1)",
            corner: 8,
        });
        this.speedBtn.add(speedBg);
        this.speedText = new Text({
            x: 26,
            y: 18,
            text: "1.0x",
            fill: "#FFFFFF",
            fontSize: 12,
            fontWeight: "bold",
            around: "center",
            origin: "center",
        });
        this.speedBtn.add(this.speedText);

        // Export button
        this.exportBtn = new Group({
            x: p + 108,
            y: 68,
            width: w - p * 2 - 108,
            height: 36,
            cursor: "pointer",
        });
        const exportBg = new Rect({
            x: 0,
            y: 0,
            width: w - p * 2 - 108,
            height: 36,
            fill: "rgba(76, 175, 80, 0.2)",
            stroke: "rgba(76, 175, 80, 0.5)",
            strokeWidth: 1,
            corner: 8,
        });
        this.exportBtn.add(exportBg);
        this.exportText = new Text({
            text: t("replayControls.export"),
            fill: "#4CAF50",
            fontSize: 12,
            fontWeight: "bold",
            around: "center",
        });
        this.exportText.x = (w - p * 2 - 108) / 2;
        this.exportText.y = 18;
        this.exportText.origin = "center";
        this.exportBtn.add(this.exportText);

        // Progress bar
        const barY = 36;
        const barHeight = 4;
        this.progressBar = new Rect({
            x: p,
            y: barY,
            width: w - p * 2,
            height: barHeight,
            fill: "rgba(255, 255, 255, 0.15)",
            corner: 2,
        });
        this.progressFill = new Rect({
            x: p,
            y: barY,
            width: 0,
            height: barHeight,
            fill: "#4CAF50",
            corner: 2,
        });
        this.progressHandle = new Rect({
            x: p - 5,
            y: barY - 4,
            width: 10,
            height: 12,
            fill: "#FFFFFF",
            corner: 3,
            cursor: "pointer",
        });

        // Time display
        this.timeText = new Text({
            x: p,
            y: barY + barHeight + 6,
            text: "0:00 / 0:00",
            fill: "rgba(255, 255, 255, 0.5)",
            fontSize: 11,
        });

        this.add([
            this.background,
            this.titleText,
            this.closeBtn,
            this.progressBar,
            this.progressFill,
            this.progressHandle,
            this.timeText,
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
            this.#updatePlayPauseIcon(false);
            this.isReplayMode = false;
        });
    }

    #handleProgressSeek(e: any): void {
        if (!this.replayPlayer.getMetadata()) return;

        const rect = this.progressBar.getRenderBounds();
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
