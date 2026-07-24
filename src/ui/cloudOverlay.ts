/**
 * Cloud UI overlay initialization and state management.
 *
 * Orchestrates the FAB, auth/history/leaderboard modals, keyboard
 * shortcuts, and background sync.  Rendering is delegated to
 * {@link ./cloudModals} while utilities live in {@link ./cloudUtils}.
 */
import * as cloud from "../cloud/client";
import { clearSynced, markSynced, pendingLocalScores } from "../cloud/localScores";
import { eventBus, GEV } from "../events";
import {
    type SyncLocalResult,
    type CloudUIContext,
    el,
    addRippleEffect,
    addRippleStyle,
} from "./cloudUtils";
import {
    type ModalHelpers,
    renderAuthModal,
    renderHistoryModal,
    renderLeaderboardModal,
} from "./cloudModals";

export type { SyncLocalResult } from "./cloudUtils";

export function initCloudOverlay(): {
    refresh: () => Promise<void>;
    openAuth: () => void;
    openHistory: () => void;
    openLeaderboard: () => void;
    syncLocalToCloud: () => Promise<SyncLocalResult>;
    getUser: () => cloud.CloudUser | null;
} {
    addRippleStyle();

    const root = document.querySelector("#cloud-ui-root") as HTMLDivElement | null;
    if (!root) {
        return {
            refresh: async () => void 0,
            openAuth: () => void 0,
            openHistory: () => void 0,
            openLeaderboard: () => void 0,
            syncLocalToCloud: async () => ({ uploaded: 0, pendingAtStart: 0 }),
            getUser: () => null,
        };
    }

    // ---- Mutable state ----
    const ctx: CloudUIContext = {
        user: null,
        mode: "login",
        modal: "none",
        busy: false,
        fab: el("div", "cloud-fab"),
        badge: el("span", "badge"),
        btnAuth: el("button", "btn primary"),
        btnLeaderboard: el("button", "btn"),
        btnHistory: el("button", "btn"),
        btnLogout: el("button", "btn danger"),
        backdrop: el("div", "modal-backdrop"),
        modalBox: el("div", "modal"),
        successToast: el("div", "success-toast"),
    };

    ctx.btnAuth.type = "button";
    ctx.btnLeaderboard.type = "button";
    ctx.btnHistory.type = "button";
    ctx.btnLogout.type = "button";
    ctx.backdrop.appendChild(ctx.modalBox);
    ctx.successToast.textContent = "操作成功！";
    root.appendChild(ctx.successToast);
    root.appendChild(ctx.fab);
    root.appendChild(ctx.backdrop);

    // ---- Helpers exposed to modal renderers ----
    const helpers: ModalHelpers = {
        renderFab,
        syncLocalToCloud,
        showSuccess,
        setError,
        setBackdropOpen,
    };

    // ---- Game-state FAB visibility ----
    eventBus.on(GEV.GAME_START, () => {
        ctx.fab.classList.add("cloud-fab--game-hidden");
    });
    eventBus.on(GEV.GAME_OVER, () => {
        ctx.fab.classList.remove("cloud-fab--game-hidden");
    });

    // ---- Toast & error ----
    function showSuccess(message: string): void {
        ctx.successToast.textContent = message;
        ctx.successToast.classList.add("show");
        setTimeout(() => ctx.successToast.classList.remove("show"), 2500);
    }

    function setError(msg: string | null): void {
        const n = ctx.modalBox.querySelector(".error") as HTMLDivElement | null;
        if (!n) return;
        if (!msg) {
            n.textContent = "";
            n.classList.remove("show");
            return;
        }
        n.textContent = msg;
        n.classList.add("show");
        setTimeout(() => {
            if (n.textContent === msg) {
                n.textContent = "";
                n.classList.remove("show");
            }
        }, 5000);
    }

    function setBackdropOpen(open: boolean): void {
        if (open) {
            ctx.backdrop.classList.add("open");
            ctx.backdrop.classList.remove("closing");
            document.body.style.overflow = "hidden";
        } else {
            ctx.backdrop.classList.add("closing");
            setTimeout(() => {
                ctx.backdrop.classList.remove("open", "closing");
                ctx.modal = "none";
                setError(null);
            }, 300);
            document.body.style.overflow = "";
        }
    }

    // ---- FAB rendering ----
    function renderFab(): void {
        ctx.fab.replaceChildren();
        const pill = el("div", "pill");
        pill.replaceChildren();

        if (!ctx.user) {
            ctx.badge.textContent = "未登录";
            ctx.btnLeaderboard.textContent = "排行榜";
            ctx.btnLeaderboard.onclick = (e) => {
                addRippleEffect(ctx.btnLeaderboard, e as MouseEvent);
                openLeaderboard();
            };
            ctx.btnAuth.textContent = "登录 / 注册";
            ctx.btnAuth.onclick = (e) => {
                addRippleEffect(ctx.btnAuth, e as MouseEvent);
                openAuth();
            };
            pill.appendChild(ctx.badge);
            pill.appendChild(ctx.btnLeaderboard);
            pill.appendChild(ctx.btnAuth);
            ctx.fab.appendChild(pill);
            return;
        }

        ctx.badge.textContent = ctx.user.displayName;
        ctx.btnLeaderboard.textContent = "排行榜";
        ctx.btnLeaderboard.onclick = (e) => {
            addRippleEffect(ctx.btnLeaderboard, e as MouseEvent);
            openLeaderboard();
        };
        ctx.btnHistory.textContent = "历史记录";
        ctx.btnLogout.textContent = "退出";
        ctx.btnAuth.textContent = "切换账号";

        ctx.btnHistory.onclick = (e) => {
            addRippleEffect(ctx.btnHistory, e as MouseEvent);
            openHistory();
        };
        ctx.btnLogout.onclick = async (e) => {
            addRippleEffect(ctx.btnLogout, e as MouseEvent);
            if (ctx.busy) return;
            ctx.busy = true;
            ctx.btnLogout.classList.add("loading");
            try {
                await cloud.logout();
                ctx.user = null;
                showSuccess("已退出登录");
                renderFab();
            } catch (e) {
                console.error(e);
            } finally {
                ctx.busy = false;
                ctx.btnLogout.classList.remove("loading");
            }
        };
        ctx.btnAuth.onclick = (e) => {
            addRippleEffect(ctx.btnAuth, e as MouseEvent);
            openAuth();
        };

        pill.appendChild(ctx.badge);
        pill.appendChild(ctx.btnLeaderboard);
        pill.appendChild(ctx.btnHistory);
        pill.appendChild(ctx.btnAuth);
        pill.appendChild(ctx.btnLogout);
        ctx.fab.appendChild(pill);
    }

    // ---- Modal open helpers ----
    function openAuth(): void {
        ctx.mode = "login";
        renderAuthModal(ctx, helpers);
    }

    function openHistory(): void {
        void renderHistoryModal(ctx, helpers);
    }

    function openLeaderboard(): void {
        void renderLeaderboardModal(ctx, helpers);
    }

    // ---- Backdrop click & keyboard shortcuts ----
    ctx.backdrop.addEventListener("click", (e) => {
        if (e.target === ctx.backdrop) setBackdropOpen(false);
    });

    document.addEventListener("keydown", (e) => {
        const target = e.target as HTMLElement | null;
        const inInput = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
        if (inInput) return;
        if (e.key === "Escape" && ctx.modal !== "none") setBackdropOpen(false);
        if ((e.key === "l" || e.key === "L") && ctx.modal === "none") openAuth();
        if ((e.key === "h" || e.key === "H") && ctx.modal === "none") openHistory();
        if ((e.key === "b" || e.key === "B") && ctx.modal === "none") openLeaderboard();
    });

    // ---- Background sync ----
    async function refresh(): Promise<void> {
        try {
            ctx.user = await cloud.me();
        } catch {
            ctx.user = null;
        }
        renderFab();
    }

    async function syncLocalToCloud(): Promise<SyncLocalResult> {
        if (!ctx.user) return { uploaded: 0, pendingAtStart: 0 };
        const pending = pendingLocalScores();
        if (pending.length === 0) return { uploaded: 0, pendingAtStart: 0 };

        let uploaded = 0;
        let lastError: string | undefined;
        for (const r of pending) {
            try {
                await cloud.addScore(r.score, r.clientId);
                markSynced(r.clientId);
                uploaded++;
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error("sync score failed:", e);
                lastError = msg;
            }
        }
        return { uploaded, pendingAtStart: pending.length, lastError };
    }

    void refresh();
    renderFab();

    return {
        refresh,
        openAuth,
        openHistory,
        openLeaderboard,
        syncLocalToCloud,
        getUser: () => ctx.user,
    };
}
