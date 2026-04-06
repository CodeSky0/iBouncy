import * as cloud from "../cloud/client";
import { clearSynced, listLocalScores, markSynced, pendingLocalScores } from "../cloud/localScores";
import { eventBus, GEV } from "../events";

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

export type SyncLocalResult = {
    uploaded: number;
    pendingAtStart: number;
    lastError?: string;
};

export function initCloudOverlay(): {
    refresh: () => Promise<void>;
    openAuth: () => void;
    openHistory: () => void;
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
            syncLocalToCloud: async () => ({ uploaded: 0, pendingAtStart: 0 }),
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

    eventBus.on(GEV.GAME_START, () => {
        fab.classList.add("cloud-fab--game-hidden");
    });
    eventBus.on(GEV.GAME_OVER, () => {
        fab.classList.remove("cloud-fab--game-hidden");
    });

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

        badge.textContent = user.displayName;
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
        modalBox.className = "modal modal-auth";
        setBackdropOpen(true);
        setError(null);

        const head = el("div", "auth-head");
        const title = el("h2");
        title.textContent = "云端账号";

        const tabs = el("div", "tabs tabs-auth");
        const tabLogin = el("button", "tab");
        const tabRegister = el("button", "tab");
        tabLogin.type = "button";
        tabRegister.type = "button";
        tabLogin.textContent = "登录";
        tabRegister.textContent = "注册";
        tabs.appendChild(tabLogin);
        tabs.appendChild(tabRegister);
        head.appendChild(title);
        head.appendChild(tabs);

        const fieldsWrap = el("div", "auth-fields");
        let stagger = 0;

        const fieldPwd = el("div", "field auth-stagger");
        fieldPwd.style.setProperty("--i", String(stagger++));
        const pwdLabel = el("label");
        pwdLabel.textContent = "密码";
        const pwdInput = el("input") as HTMLInputElement;
        pwdInput.type = "password";
        pwdInput.placeholder = "至少 6 位";
        pwdInput.autocomplete = mode === "register" ? "new-password" : "current-password";
        fieldPwd.appendChild(pwdLabel);
        fieldPwd.appendChild(pwdInput);

        const errBox = el("div", "error");

        const actions = el("div", "row auth-actions");
        const left = el("div");
        const right = el("div");
        right.className = "auth-actions-right";

        const closeBtn = createButtonWithLoader("关闭", "btn");
        closeBtn.onclick = () => setBackdropOpen(false);

        const submitBtn = createButtonWithLoader(
            mode === "register" ? "创建账号并登录" : "登录",
            "btn primary"
        );

        const hint = el("div", "hint auth-hint");
        if (mode === "login") {
            hint.innerHTML = `
                <strong>提示</strong><br>
                可用<strong>用户名</strong>或<strong>邮箱</strong>登录。登录后成绩会同步云端，在「历史记录」中查看。
            `;
        } else {
            hint.innerHTML = `
                <strong>注册说明</strong><br>
                用户名用于登录（小写字母、数字、下划线，3–20 位）。昵称为展示名称，可不填（将显示用户名）。
            `;
        }

        let firstFocus: HTMLInputElement;

        if (mode === "login") {
            const fieldId = el("div", "field auth-stagger");
            fieldId.style.setProperty("--i", "0");
            fieldPwd.style.setProperty("--i", "1");
            const idLabel = el("label");
            idLabel.textContent = "用户名或邮箱";
            const identifierInput = el("input") as HTMLInputElement;
            identifierInput.type = "text";
            identifierInput.placeholder = "用户名 或 邮箱";
            identifierInput.autocomplete = "username";
            fieldId.appendChild(idLabel);
            fieldId.appendChild(identifierInput);
            fieldsWrap.appendChild(fieldId);
            fieldsWrap.appendChild(fieldPwd);
            firstFocus = identifierInput;

            const doSubmit = async () => {
                if (busy) return;
                setError(null);
                const raw = identifierInput.value.trim();
                const password = pwdInput.value;
                if (!raw) return setError("请输入用户名或邮箱");
                if (raw.includes("@")) {
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return setError("邮箱格式不正确");
                } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(raw)) {
                    return setError("用户名须为 3–20 位字母、数字或下划线");
                }
                if (!password || password.length < 6) return setError("密码至少 6 位");

                busy = true;
                submitBtn.classList.add("loading");
                try {
                    user = await cloud.login(raw, password);
                    renderFab();
                    await syncLocalToCloud();
                    showSuccess("登录成功！");
                    setBackdropOpen(false);
                } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                } finally {
                    busy = false;
                    submitBtn.classList.remove("loading");
                }
            };

            submitBtn.onclick = doSubmit;
            identifierInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
            pwdInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
        } else {
            stagger = 0;
            const fieldUser = el("div", "field auth-stagger");
            fieldUser.style.setProperty("--i", String(stagger++));
            const userLabel = el("label");
            userLabel.textContent = "用户名";
            const usernameInput = el("input") as HTMLInputElement;
            usernameInput.type = "text";
            usernameInput.placeholder = "例如：player_one";
            usernameInput.autocomplete = "username";
            usernameInput.spellcheck = false;
            fieldUser.appendChild(userLabel);
            fieldUser.appendChild(usernameInput);

            const fieldNick = el("div", "field auth-stagger optional-field");
            fieldNick.style.setProperty("--i", String(stagger++));
            const nickLabel = el("label");
            nickLabel.innerHTML = '昵称 <span class="optional-tag">选填</span>';
            const nicknameInput = el("input") as HTMLInputElement;
            nicknameInput.type = "text";
            nicknameInput.placeholder = "不填则使用用户名";
            nicknameInput.autocomplete = "off";
            fieldNick.appendChild(nickLabel);
            fieldNick.appendChild(nicknameInput);

            const fieldEmail = el("div", "field auth-stagger");
            fieldEmail.style.setProperty("--i", String(stagger++));
            const emailLabel = el("label");
            emailLabel.textContent = "邮箱";
            const emailInput = el("input") as HTMLInputElement;
            emailInput.type = "email";
            emailInput.placeholder = "例如：me@example.com";
            emailInput.autocomplete = "email";
            fieldEmail.appendChild(emailLabel);
            fieldEmail.appendChild(emailInput);

            fieldPwd.style.setProperty("--i", String(stagger++));
            fieldsWrap.appendChild(fieldUser);
            fieldsWrap.appendChild(fieldNick);
            fieldsWrap.appendChild(fieldEmail);
            fieldsWrap.appendChild(fieldPwd);
            firstFocus = usernameInput;

            const doSubmit = async () => {
                if (busy) return;
                setError(null);
                const username = usernameInput.value.trim().toLowerCase();
                const nickname = nicknameInput.value.trim();
                const email = emailInput.value.trim();
                const password = pwdInput.value;
                if (!/^[a-z0-9_]{3,20}$/.test(username)) {
                    return setError("用户名为 3–20 位小写字母、数字或下划线");
                }
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("邮箱格式不正确");
                if (!password || password.length < 6) return setError("密码至少 6 位");

                busy = true;
                submitBtn.classList.add("loading");
                try {
                    user = await cloud.register({
                        username,
                        nickname: nickname || undefined,
                        email,
                        password,
                    });
                    renderFab();
                    await syncLocalToCloud();
                    showSuccess("注册成功！");
                    setBackdropOpen(false);
                } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                } finally {
                    busy = false;
                    submitBtn.classList.remove("loading");
                }
            };

            submitBtn.onclick = doSubmit;
            usernameInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
            nicknameInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
            emailInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
            pwdInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
        }

        tabLogin.onclick = (e) => {
            addRippleEffect(tabLogin, e as MouseEvent);
            mode = "login";
            renderAuthModal();
        };
        tabRegister.onclick = (e) => {
            addRippleEffect(tabRegister, e as MouseEvent);
            mode = "register";
            renderAuthModal();
        };

        tabLogin.classList.toggle("active", mode === "login");
        tabRegister.classList.toggle("active", mode === "register");

        left.appendChild(closeBtn);
        right.appendChild(submitBtn);
        actions.appendChild(left);
        actions.appendChild(right);

        modalBox.replaceChildren(head, fieldsWrap, errBox, actions, hint);
        setTimeout(() => firstFocus.focus(), 100);
    }

    async function renderHistoryModal() {
        modal = "history";
        modalBox.className = "modal modal-history";
        setBackdropOpen(true);
        setError(null);

        const loadingOverlay = el("div", "modal-loading");
        const loadingRing = el("div", "modal-loading-spinner");
        loadingOverlay.appendChild(loadingRing);

        const titleRow = el("div", "row title-row history-head");
        const titleBlock = el("div", "history-title-block");
        const title = el("h2");
        title.textContent = "历史成绩";
        const titleAccent = el("div", "history-title-accent");
        titleBlock.appendChild(title);
        titleBlock.appendChild(titleAccent);
        const closeBtn = createButtonWithLoader("关闭", "btn");
        closeBtn.onclick = () => setBackdropOpen(false);
        titleRow.appendChild(titleBlock);
        titleRow.appendChild(closeBtn);

        const errBox = el("div", "error");
        const cards = el("div", "cards history-cards");
        const list = el("div", "list history-list");
        const actions = el("div", "row history-actions");
        const left = el("div");
        const right = el("div");
        right.className = "history-actions-right";

        const refreshBtn = createButtonWithLoader("刷新", "btn");
        refreshBtn.onclick = () => void load();

        const syncBtn = createButtonWithLoader("同步本地", "btn primary");
        syncBtn.onclick = () => void sync();

        actions.appendChild(left);
        right.appendChild(refreshBtn);
        right.appendChild(syncBtn);
        actions.appendChild(right);

        modalBox.replaceChildren(titleRow, errBox, cards, list, actions, loadingOverlay);

        const load = async () => {
            if (busy) return;
            busy = true;
            refreshBtn.classList.add("loading");
            const useOverlay = !!user;
            if (useOverlay) loadingOverlay.classList.add("show");
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
                if (useOverlay) loadingOverlay.classList.remove("show");
            }
        };

        const sync = async () => {
            if (!user) return setError("请先登录");
            if (busy) return;
            busy = true;
            syncBtn.classList.add("loading");
            let syncOk = false;
            try {
                const r = await syncLocalToCloud();
                if (r.uploaded > 0) {
                    clearSynced();
                }
                if (r.pendingAtStart === 0) {
                    showSuccess("所有记录已同步！");
                    syncOk = true;
                } else if (r.uploaded === r.pendingAtStart) {
                    showSuccess(r.uploaded === 1 ? "同步成功！" : `成功同步 ${r.uploaded} 条记录！`);
                    syncOk = true;
                } else if (r.uploaded > 0) {
                    showSuccess(`已同步 ${r.uploaded} 条`);
                    setError(r.lastError || "部分记录未能同步，请重试");
                    syncOk = true;
                } else {
                    setError(r.lastError || "同步失败，请检查网络或登录状态后重试");
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                busy = false;
                syncBtn.classList.remove("loading");
            }
            if (syncOk) await load();
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

    async function syncLocalToCloud(): Promise<SyncLocalResult> {
        if (!user) return { uploaded: 0, pendingAtStart: 0 };
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
        syncLocalToCloud,
        getUser: () => user,
    };
}
