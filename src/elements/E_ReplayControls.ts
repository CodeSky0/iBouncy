import { Group, Rect, Path, Text } from "leafer-game";
import { evBus, GEV } from "../events";
import { GP, Ball, Tablet, Timing } from "../core/instances";
import { Scoring } from "../ui/elements";
import { ReplayPlayer, ReplayRecorder, type ReplayMetadata } from "../core/replay";
import { UIConf } from "../config";

export default class E_ReplayControls extends Group {
    private background: Rect;
    private playPauseBtn: Group;
    private playIcon: Path;
    private pauseIcon: Path;
    private progressBar: Rect;
    private progressFill: Rect;
    private progressHandle: Rect;
    private speedText: Text;
    private timeText: Text;
    private exportBtn: Group;
    private exportText: Text;
    private replayPlayer: ReplayPlayer;
    private replayRecorder: ReplayRecorder;
    private isDraggingProgress = false;
    private isReplayMode = false;
    private currentReplayId: string | null = null;

    constructor() {
        super({
            x: 0,
            y: 0,
            width: GP.bw,
            height: 80,
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
        // Background
        this.background = new Rect({
            x: 0,
            y: 0,
            width: GP.bw,
            height: 80,
            fill: "rgba(0, 0, 0, 0.8)",
            corner: [0, 0, 16, 16],
        });

        // Play/Pause button
        this.playPauseBtn = new Group({
            x: 40,
            y: 40,
            origin: "center",
            cursor: "pointer",
        });

        this.playIcon = new Path({
            path: "M8 5v14l11-7z",
            fill: "#FFFFFF",
            scale: 2,
        });

        this.pauseIcon = new Path({
            path: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
            fill: "#FFFFFF",
            scale: 2,
            visible: false,
        });

        this.playPauseBtn.add([this.playIcon, this.pauseIcon]);

        // Progress bar
        this.progressBar = new Rect({
            x: 100,
            y: 38,
            width: GP.bw - 200,
            height: 4,
            fill: "rgba(255, 255, 255, 0.3)",
            corner: 2,
        });

        this.progressFill = new Rect({
            x: 100,
            y: 38,
            width: 0,
            height: 4,
            fill: "#4CAF50",
            corner: 2,
        });

        this.progressHandle = new Rect({
            x: 100,
            y: 34,
            width: 12,
            height: 12,
            fill: "#FFFFFF",
            corner: 6,
            cursor: "pointer",
        });

        // Speed indicator
        this.speedText = new Text({
            x: GP.bw - 80,
            y: 25,
            text: "1.0x",
            fill: "#FFFFFF",
            fontSize: 14,
            around: "center",
            cursor: "pointer",
        });

        // Time display
        this.timeText = new Text({
            x: GP.bw - 80,
            y: 50,
            text: "0:00 / 0:00",
            fill: "#FFFFFF",
            fontSize: 12,
            around: "center",
        });

        // Export button
        this.exportBtn = new Group({
            x: GP.bw - 150,
            y: 40,
            origin: "center",
            cursor: "pointer",
        });

        this.exportText = new Text({
            text: "导出",
            fill: "#FFFFFF",
            fontSize: 14,
            around: "center",
        });

        this.exportBtn.add(this.exportText);

        this.add([
            this.background,
            this.playPauseBtn,
            this.progressBar,
            this.progressFill,
            this.progressHandle,
            this.speedText,
            this.timeText,
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

        // Progress bar interaction
        this.progressBar.on("pointerdown", (e: any) => this.#handleProgressSeek(e));
        this.progressHandle.on("pointerdown", (e: any) => {
            this.isDraggingProgress = true;
            this.#handleProgressSeek(e);
        });

        // Speed control
        this.speedText.on("pointerdown", () => {
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
        this.width = data.width;
        this.background.width = data.width;
        this.progressBar.width = data.width - 200;
        this.speedText.x = data.width - 80;
        this.timeText.x = data.width - 80;
        this.exportBtn.x = data.width - 150;
    }

    #updatePlayPauseIcon(isPlaying: boolean): void {
        this.playIcon.visible = !isPlaying;
        this.pauseIcon.visible = isPlaying;
    }

    #updateProgressUI(): void {
        const progress = this.replayPlayer.getProgress();
        const metadata = this.replayPlayer.getMetadata();

        if (metadata) {
            const barWidth = this.progressBar.width;
            this.progressFill.width = barWidth * progress;
            this.progressHandle.x = 100 + barWidth * progress - 6;

            const currentTime = Math.floor(progress * metadata.duration);
            const totalTime = Math.floor(metadata.duration);
            this.timeText.text = `${this.#formatTime(currentTime)} / ${this.#formatTime(totalTime)}`;
        }
    }

    #formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    #applyFrameState(state: any): void {
        // Apply replay state to game entities
        // Update ball position and velocity
        (Ball as any).cx = state.ball.x;
        (Ball as any).cy = state.ball.y;
        Ball.vx = state.ball.vx;
        Ball.vy = state.ball.vy;

        // Update tablet position and velocity
        (Tablet as any).cx = state.tablet.x;
        (Tablet as any).y = state.tablet.y;
        Tablet.vx = state.tablet.vx;
        Tablet.vy = state.tablet.vy;

        // Update score
        (Scoring as any).assign_(state.score);

        // Update combo
        (Scoring as any).updateCombo_(state.combo, state.multiplier);

        // Update timing
        Timing.remaining = state.remaining;
    }

    show(): void {
        this.visible = true;
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
