import * as cloud from "../cloud/client";
import { clearSynced, listLocalScores, markSynced, pendingLocalScores } from "../cloud/localScores";

type Mode = "login" | "register";
type Modal = "none" | "auth" | "history";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
    const n = document.createElement(tag);
    if (className) n.className = className;
    return n;
}

function fmtScore(score10: number): string {
    const v = Math.round(score10);
    const int = Math.floor(v / 10);
    const dec = Math.abs(v % 10);
    return `${int}.${dec}`;
}

function fmtTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
}

function sum(arr: number[]) {
    return arr.reduce((a, b) => a + b, 0);
}

function buildSparkline(values: number[], stroke = "rgba(83,103,255,0.92)", fill = "rgba(83,103,255,0.18)") {
    const w = 600;
    const h = 120;
    const pad = 10;
    const max = Math.max(1, ...values);
    const min = Math.min(...values);
    const span = Math.max(1, max - min);
    const n = Math.max(2, values.length);
    const dx = (w - pad * 2) / (n - 1);

    const pts = values.map((v, i) => {
        const x = pad + dx * i;
        const t = (v - min) / span;
        const y = pad + (1 - t) * (h - pad * 2);
        return { x, y };
    });

    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const area = `${d} L ${(pad + dx * (n - 1)).toFixed(1)} ${(h - pad).toFixed(1)} L ${pad.toFixed(1)} ${(h - pad).toFixed(1)} Z`;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.width = "100%";
    svg.style.height = "100%";

    const pathArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathArea.setAttribute("d", area);
    pathArea.setAttribute("fill", fill);
    pathArea.setAttribute("stroke", "none");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", stroke);
    path.setAttribute("stroke-width", "4");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    svg.appendChild(pathArea);
    svg.appendChild(path);
    return svg;
}

// Create ripple effect on button click
function addRippleEffect(button: HTMLElement, e?: MouseEvent) {
    const ripple = document.createElement("span");
    ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.4);
        transform: scale(0);
        animation: ripple 0.5s ease-out;
        pointer-events: none;
    `;
    
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    
    if (e) {
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    } else {
        ripple.style.left = `${rect.width / 2 - size / 2}px`;
        ripple.style.top = `${rect.height / 2 - size / 2}px`;
    }
    
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
}

// Add ripple animation to document
function addRippleStyle() {
    if (document.getElementById("ripple-style")) return;
    const style = document.createElement("style");
    style.id = "ripple-style";
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(2.5);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

export function initCloudOverlay(): {
    refresh: () => Promise<void>;
    openAuth: () => void;
    openHistory: () => void;
    syncLocalToCloud: () => Promise<{ uploaded: number }>;
    getUser: () => cloud.CloudUser | null;
} {
    addRippleStyle();
    
    const root = document.querySelector("#cloud-ui-root") as HTMLDivElement | null;
    if (!root) {
        return {
            refresh: async () => void 0,
            openAuth: () => void 0,
            openHistory: () => void 0,
            syncLocalToCloud: async () => ({ uploaded: 0 }),
            getUser: () => null,
        };
    }

    let user: cloud.CloudUser | null = null;
    let mode: Mode = "login";
    let modal: Modal = "none";
    let busy = false;

    const fab = el("div", "cloud-fab");
    const pill = el("div", "pill");
    const badge = el("span", "badge");
    const btnAuth = el("button", "btn primary");
    const btnHistory = el("button", "btn");
    const btnLogout = el("button", "btn danger");
    btnAuth.type = "button";
    btnHistory.type = "button";
    btnLogout.type = "button";

    const backdrop = el("div", "modal-backdrop");
    const modalBox = el("div", "modal");
    backdrop.appendChild(modalBox);

    // Success toast
    const successToast = el("div", "success-toast");
    successToast.textContent = "操作成功！";
    root.appendChild(successToast);

    root.appendChild(fab);
    root.appendChild(backdrop);

    function showSuccess(message: string) {
        successToast.textContent = message;
        successToast.classList.add("show");
        setTimeout(() => successToast.classList.remove("show"), 2500);
    }

    function setError(msg: string | null) {
        const n = modalBox.querySelector(".error") as HTMLDivElement | null;
        if (!n) return;
        if (!msg) {
            n.textContent = "";
            n.classList.remove("show");
            return;
        }
        n.textContent = msg;
        n.classList.add("show");
        // Auto hide error after 5 seconds
        setTimeout(() => {
            if (n.textContent === msg) {
                n.textContent = "";
                n.classList.remove("show");
            }
        }, 5000);
    }

    function setBackdropOpen(open: boolean) {
        if (open) {
            backdrop.classList.add("open");
            backdrop.classList.remove("closing");
            document.body.style.overflow = "hidden";
        } else {
            backdrop.classList.add("closing");
            setTimeout(() => {
                backdrop.classList.remove("open", "closing");
                modal = "none";
                setError(null);
            }, 300);
            document.body.style.overflow = "";
        }
    }

    function createButtonWithLoader(text: string, className: string): HTMLButtonElement {
        const btn = el("button", className);
        btn.type = "button";
        
        const textSpan = el("span", "btn-text");
        textSpan.textContent = text;
        
        const loader = el("span", "btn-loader");
        
        btn.appendChild(textSpan);
        btn.appendChild(loader);
        
        // Add ripple effect
        btn.addEventListener("click", (e) => addRippleEffect(btn, e));
        
        return btn;
    }

    function renderFab() {
        fab.replaceChildren();
        pill.replaceChildren();

        if (!user) {
            badge.textContent = "未登录";
            btnAuth.textContent = "登录 / 注册";
            btnAuth.onclick = (e) => {
                addRippleEffect(btnAuth, e as MouseEvent);
                openAuth();
            };
            pill.appendChild(badge);
            pill.appendChild(btnAuth);
            fab.appendChild(pill);
            return;
        }

        badge.textContent = user.email;
        btnHistory.textContent = "历史记录";
        btnLogout.textContent = "退出";
        btnAuth.textContent = "切换账号";

        btnHistory.onclick = (e) => {
            addRippleEffect(btnHistory, e as MouseEvent);
            openHistory();
        };
        btnLogout.onclick = async (e) => {
            addRippleEffect(btnLogout, e as MouseEvent);
            if (busy) return;
            busy = true;
            btnLogout.classList.add("loading");
            try {
                await cloud.logout();
                user = null;
                showSuccess("已退出登录");
                renderFab();
            } catch (e) {
                console.error(e);
            } finally {
                busy = false;
                btnLogout.classList.remove("loading");
            }
        };
        btnAuth.onclick = (e) => {
            addRippleEffect(btnAuth, e as MouseEvent);
            openAuth();
        };

        pill.appendChild(badge);
        pill.appendChild(btnHistory);
        pill.appendChild(btnAuth);
        pill.appendChild(btnLogout);
        fab.appendChild(pill);
    }

    function renderAuthModal() {
        modal = "auth";
        setBackdropOpen(true);
        setError(null);

        const titleRow = el("div", "row title-row");
        const title = el("h2");
        title.textContent = "云端账号";

        const tabs = el("div", "tabs");
        const tabLogin = el("button", "tab");
        const tabRegister = el("button", "tab");
        tabLogin.type = "button";
        tabRegister.type = "button";
        tabLogin.textContent = "登录";
        tabRegister.textContent = "注册";
        tabs.appendChild(tabLogin);
        tabs.appendChild(tabRegister);

        const closeBtn = createButtonWithLoader("关闭", "btn");
        closeBtn.onclick = () => setBackdropOpen(false);

        titleRow.appendChild(title);
        titleRow.appendChild(tabs);

        const fieldEmail = el("div", "field");
        const emailLabel = el("label");
        emailLabel.textContent = "邮箱";
        const emailInput = el("input") as HTMLInputElement;
        emailInput.type = "email";
        emailInput.placeholder = "例如：me@example.com";
        emailInput.autocomplete = "email";
        fieldEmail.appendChild(emailLabel);
        fieldEmail.appendChild(emailInput);

        const fieldPwd = el("div", "field");
        const pwdLabel = el("label");
        pwdLabel.textContent = "密码";
        const pwdInput = el("input") as HTMLInputElement;
        pwdInput.type = "password";
        pwdInput.placeholder = "至少 6 位";
        pwdInput.autocomplete = mode === "register" ? "new-password" : "current-password";
        fieldPwd.appendChild(pwdLabel);
        fieldPwd.appendChild(pwdInput);

        const errBox = el("div", "error");

        const actions = el("div", "row");
        actions.style.marginTop = "20px";
        const left = el("div");
        const right = el("div");
        right.style.display = "flex";
        right.style.gap = "10px";

        const submitBtn = createButtonWithLoader(
            mode === "register" ? "创建账号并登录" : "登录", 
            "btn primary"
        );

        const hint = el("div", "hint");
        hint.innerHTML = `
            <strong>💡 提示</strong><br>
            登录后你每局的最终成绩会自动保存到云端，并可在「历史记录」里查看。
        `;

        const doSubmit = async () => {
            if (busy) return;
            setError(null);
            const email = emailInput.value.trim();
            const password = pwdInput.value;
            if (!email || !email.includes("@")) return setError("邮箱格式不正确");
            if (!password || password.length < 6) return setError("密码至少 6 位");

            busy = true;
            submitBtn.classList.add("loading");
            try {
                user = mode === "register" 
                    ? await cloud.register(email, password) 
                    : await cloud.login(email, password);
                renderFab();
                await syncLocalToCloud();
                showSuccess(mode === "register" ? "注册成功！" : "登录成功！");
                setBackdropOpen(false);
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                busy = false;
                submitBtn.classList.remove("loading");
            }
        };

        submitBtn.onclick = doSubmit;
        emailInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
        pwdInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());

        tabLogin.onclick = (e) => {
            addRippleEffect(tabLogin, e as MouseEvent);
            mode = "login";
            renderAuthModal();
            setTimeout(() => emailInput.focus(), 50);
        };
        tabRegister.onclick = (e) => {
            addRippleEffect(tabRegister, e as MouseEvent);
            mode = "register";
            renderAuthModal();
            setTimeout(() => emailInput.focus(), 50);
        };

        tabLogin.classList.toggle("active", mode === "login");
        tabRegister.classList.toggle("active", mode === "register");

        left.appendChild(closeBtn);
        right.appendChild(submitBtn);
        actions.appendChild(left);
        actions.appendChild(right);

        modalBox.replaceChildren(titleRow, fieldEmail, fieldPwd, errBox, actions, hint);
        
        // Focus email input with animation delay
        setTimeout(() => emailInput.focus(), 100);
    }

    async function renderHistoryModal() {
        modal = "history";
        setBackdropOpen(true);
        setError(null);

        const titleRow = el("div", "row title-row");
        const title = el("h2");
        title.textContent = "历史成绩";
        const closeBtn = createButtonWithLoader("关闭", "btn");
        closeBtn.onclick = () => setBackdropOpen(false);
        titleRow.appendChild(title);
        titleRow.appendChild(closeBtn);

        const errBox = el("div", "error");
        const cards = el("div", "cards");
        const list = el("div", "list");
        const actions = el("div", "row");
        actions.style.marginTop = "16px";
        const left = el("div");
        const right = el("div");
        right.style.display = "flex";
        right.style.gap = "10px";

        const refreshBtn = createButtonWithLoader("刷新", "btn");
        refreshBtn.onclick = () => void load();

        const syncBtn = createButtonWithLoader("同步本地", "btn primary");
        syncBtn.onclick = () => void sync();

        actions.appendChild(left);
        right.appendChild(refreshBtn);
        right.appendChild(syncBtn);
        actions.appendChild(right);

        modalBox.replaceChildren(titleRow, errBox, cards, list, actions);

        const load = async () => {
            if (busy) return;
            busy = true;
            refreshBtn.classList.add("loading");
            cards.replaceChildren();
            list.replaceChildren();
            try {
                if (!user) {
                    const local = listLocalScores();
                    const games = local.length;
                    const best = games ? Math.max(...local.map((r) => r.score)) : 0;
                    const total = sum(local.map((r) => r.score));
                    const last = games ? local[0].score : 0;

                    const c1 = el("div", "card");
                    const c1k = el("div", "k"); c1k.textContent = "游客 · 总局数";
                    const c1v = el("div", "v"); c1v.textContent = String(games);
                    c1.appendChild(c1k); c1.appendChild(c1v);

                    const c2 = el("div", "card");
                    const c2k = el("div", "k"); c2k.textContent = "游客 · 最高分";
                    const c2v = el("div", "v"); c2v.textContent = fmtScore(best);
                    c2.appendChild(c2k); c2.appendChild(c2v);

                    const c3 = el("div", "card wide");
                    const c3k = el("div", "k"); c3k.textContent = "游客 · 近7天（每日最高分）";
                    const c3v = el("div", "v"); 
                    c3v.textContent = `最近一次：${fmtScore(last)} · 累计：${fmtScore(total)}`;
                    const sparkWrap = el("div", "spark");
                    const values = (() => {
                        const m = new Map<string, number>();
                        for (const r of local) {
                            const day = r.createdAt.slice(0, 10);
                            const prev = m.get(day) ?? 0;
                            if (r.score > prev) m.set(day, r.score);
                        }
                        const today = new Date();
                        const out: number[] = [];
                        for (let i = 6; i >= 0; i--) {
                            const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
                            d.setUTCDate(d.getUTCDate() - i);
                            const key = d.toISOString().slice(0, 10);
                            out.push(m.get(key) ?? 0);
                        }
                        return out;
                    })();
                    sparkWrap.appendChild(buildSparkline(values));
                    c3.appendChild(c3k); c3.appendChild(c3v); c3.appendChild(sparkWrap);

                    cards.appendChild(c1);
                    cards.appendChild(c2);
                    cards.appendChild(c3);

                    if (local.length === 0) {
                        const empty = el("div", "hint");
                        empty.innerHTML = `
                            <strong>📋 暂无记录</strong><br>
                            你还没登录，当前只有本地记录（目前为空）。按 <kbd style="background:rgba(83,103,255,0.3);padding:2px 8px;border-radius:4px;">L</kbd> 登录后可云端保存。
                        `;
                        list.appendChild(empty);
                    } else {
                        for (const r of local) {
                            const item = el("div", "item");
                            const leftCol = el("div");
                            const score = el("div", "score");
                            score.textContent = fmtScore(r.score);
                            const time = el("div", "time");
                            time.textContent = fmtTime(r.createdAt);
                            leftCol.appendChild(score);
                            leftCol.appendChild(time);
                            item.appendChild(leftCol);
                            list.appendChild(item);
                        }
                    }
                    return;
                }

                const [records, localPending, summary] = await Promise.all([
                    cloud.listScores(20),
                    Promise.resolve(pendingLocalScores()),
                    cloud.summary(),
                ]);

                const s = summary.summary;
                const c1 = el("div", "card");
                const c1k = el("div", "k"); c1k.textContent = "云端 · 总局数";
                const c1v = el("div", "v"); c1v.textContent = String(s.games);
                c1.appendChild(c1k); c1.appendChild(c1v);

                const c2 = el("div", "card");
                const c2k = el("div", "k"); c2k.textContent = "云端 · 最高分";
                const c2v = el("div", "v"); c2v.textContent = fmtScore(s.bestScore);
                c2.appendChild(c2k); c2.appendChild(c2v);

                const c3 = el("div", "card wide");
                const c3k = el("div", "k"); c3k.textContent = "云端 · 近7天（每日最高分）";
                const c3v = el("div", "v");
                c3v.textContent = `最近一次：${fmtScore(s.lastScore)} · 累计：${fmtScore(s.totalScore)}`;
                const sparkWrap = el("div", "spark");
                sparkWrap.appendChild(buildSparkline(summary.trend7d.map((p) => p.bestScore)));
                c3.appendChild(c3k); c3.appendChild(c3v); c3.appendChild(sparkWrap);

                cards.appendChild(c1);
                cards.appendChild(c2);
                cards.appendChild(c3);

                if (localPending.length > 0) {
                    const hint = el("div", "hint");
                    hint.innerHTML = `
                        <strong>🔄 待同步</strong><br>
                        本地有 ${localPending.length} 条未同步成绩，点击「同步本地」即可上传到云端（已做去重）。
                    `;
                    list.appendChild(hint);
                }

                if (records.length === 0 && localPending.length === 0) {
                    const empty = el("div", "hint");
                    empty.innerHTML = `
                        <strong>🎮 开始游戏</strong><br>
                        还没有历史成绩，去玩一局吧！
                    `;
                    list.appendChild(empty);
                } else {
                    // 先展示本地未同步（更"新鲜"），并打个标签
                    for (const r of localPending) {
                        const item = el("div", "item");
                        const leftCol = el("div");
                        const score = el("div", "score");
                        score.textContent = fmtScore(r.score);
                        const time = el("div", "time");
                        time.innerHTML = `${fmtTime(r.createdAt)} <span class="sync-badge">本地未同步</span>`;
                        leftCol.appendChild(score);
                        leftCol.appendChild(time);
                        item.appendChild(leftCol);
                        list.appendChild(item);
                    }
                    for (const r of records) {
                        const item = el("div", "item");
                        const leftCol = el("div");
                        const score = el("div", "score");
                        score.textContent = fmtScore(r.score);
                        const time = el("div", "time");
                        time.textContent = fmtTime(r.createdAt);
                        leftCol.appendChild(score);
                        leftCol.appendChild(time);
                        item.appendChild(leftCol);
                        list.appendChild(item);
                    }
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                busy = false;
                refreshBtn.classList.remove("loading");
            }
        };

        const sync = async () => {
            if (!user) return setError("请先登录");
            if (busy) return;
            busy = true;
            syncBtn.classList.add("loading");
            try {
                const r = await syncLocalToCloud();
                if (r.uploaded > 0) {
                    clearSynced();
                    showSuccess(`成功同步 ${r.uploaded} 条记录！`);
                } else {
                    showSuccess("所有记录已同步！");
                }
                await load();
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                busy = false;
                syncBtn.classList.remove("loading");
            }
        };

        await load();
    }

    function openAuth() {
        mode = "login";
        renderAuthModal();
    }

    function openHistory() {
        void renderHistoryModal();
    }

    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) setBackdropOpen(false);
    });

    document.addEventListener("keydown", (e) => {
        const target = e.target as HTMLElement | null;
        const inInput = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
        if (inInput) return;
        if (e.key === "Escape" && modal !== "none") setBackdropOpen(false);
        if ((e.key === "l" || e.key === "L") && modal === "none") openAuth();
        if ((e.key === "h" || e.key === "H") && modal === "none") openHistory();
    });

    async function refresh() {
        try {
            user = await cloud.me();
        } catch {
            user = null;
        }
        renderFab();
    }

    async function syncLocalToCloud(): Promise<{ uploaded: number }> {
        if (!user) return { uploaded: 0 };
        const pending = pendingLocalScores();
        if (pending.length === 0) return { uploaded: 0 };

        let uploaded = 0;
        for (const r of pending) {
            try {
                await cloud.addScore(r.score, r.clientId);
                markSynced(r.clientId);
                uploaded++;
            } catch (e) {
                console.error("sync score failed:", e);
            }
        }
        return { uploaded };
    }

    void refresh();
    renderFab();

    return {
        refresh,
        openAuth,
        openHistory,
        syncLocalToCloud,
        getUser: () => user,
    };
}
