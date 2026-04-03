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

export function initCloudOverlay(): {
    refresh: () => Promise<void>;
    openAuth: () => void;
    openHistory: () => void;
    syncLocalToCloud: () => Promise<{ uploaded: number }>;
    getUser: () => cloud.CloudUser | null;
} {
    const root = document.querySelector("#cloud-ui-root") as HTMLDivElement | null;
    if (!root) {
        // 不阻断游戏；只是无法显示云端 UI
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

    root.appendChild(fab);
    root.appendChild(backdrop);

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
    }

    function setBackdropOpen(open: boolean) {
        backdrop.classList.toggle("open", open);
        if (!open) {
            modal = "none";
            setError(null);
        }
    }

    function renderFab() {
        fab.replaceChildren();
        pill.replaceChildren();

        if (!user) {
            badge.textContent = "未登录";
            btnAuth.textContent = "登录 / 注册";
            btnAuth.onclick = () => openAuth();
            pill.appendChild(badge);
            pill.appendChild(btnAuth);
            fab.appendChild(pill);
            return;
        }

        badge.textContent = user.email;
        btnHistory.textContent = "历史记录";
        btnLogout.textContent = "退出";
        btnAuth.textContent = "切换账号";

        btnHistory.onclick = () => openHistory();
        btnLogout.onclick = async () => {
            if (busy) return;
            busy = true;
            try {
                await cloud.logout();
                user = null;
                renderFab();
            } catch (e) {
                // 不弹 modal，只做 console
                console.error(e);
            } finally {
                busy = false;
            }
        };
        btnAuth.onclick = () => openAuth();

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

        const titleRow = el("div", "row");
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

        const closeBtn = el("button", "btn");
        closeBtn.type = "button";
        closeBtn.textContent = "关闭";
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
        const left = el("div");
        const right = el("div");
        right.style.display = "flex";
        right.style.gap = "10px";

        const submitBtn = el("button", "btn primary");
        submitBtn.type = "button";
        submitBtn.textContent = mode === "register" ? "创建账号并登录" : "登录";

        const hint = el("div", "hint");
        hint.textContent =
            "提示：登录后你每局的最终成绩会自动保存到云端，并可在「历史记录」里查看。";

        const doSubmit = async () => {
            if (busy) return;
            setError(null);
            const email = emailInput.value.trim();
            const password = pwdInput.value;
            if (!email || !email.includes("@")) return setError("邮箱格式不正确");
            if (!password || password.length < 6) return setError("密码至少 6 位");

            busy = true;
            submitBtn.textContent = "处理中...";
            try {
                user = mode === "register" ? await cloud.register(email, password) : await cloud.login(email, password);
                renderFab();
                await syncLocalToCloud();
                setBackdropOpen(false);
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                busy = false;
                submitBtn.textContent = mode === "register" ? "创建账号并登录" : "登录";
            }
        };

        submitBtn.onclick = doSubmit;
        emailInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
        pwdInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());

        tabLogin.onclick = () => {
            mode = "login";
            renderAuthModal();
            emailInput.focus();
        };
        tabRegister.onclick = () => {
            mode = "register";
            renderAuthModal();
            emailInput.focus();
        };

        tabLogin.classList.toggle("active", mode === "login");
        tabRegister.classList.toggle("active", mode === "register");

        left.appendChild(closeBtn);
        right.appendChild(submitBtn);
        actions.appendChild(left);
        actions.appendChild(right);

        modalBox.replaceChildren(titleRow, fieldEmail, fieldPwd, errBox, actions, hint);
        emailInput.focus();
    }

    async function renderHistoryModal() {
        modal = "history";
        setBackdropOpen(true);
        setError(null);

        const titleRow = el("div", "row");
        const title = el("h2");
        title.textContent = "历史成绩";
        const closeBtn = el("button", "btn");
        closeBtn.type = "button";
        closeBtn.textContent = "关闭";
        closeBtn.onclick = () => setBackdropOpen(false);
        titleRow.appendChild(title);
        titleRow.appendChild(closeBtn);

        const errBox = el("div", "error");
        const cards = el("div", "cards");
        const list = el("div", "list");
        const actions = el("div", "row");
        const left = el("div");
        const right = el("div");
        right.style.display = "flex";
        right.style.gap = "10px";

        const refreshBtn = el("button", "btn");
        refreshBtn.type = "button";
        refreshBtn.textContent = "刷新";
        refreshBtn.onclick = () => void load();

        const syncBtn = el("button", "btn primary");
        syncBtn.type = "button";
        syncBtn.textContent = "同步本地";
        syncBtn.onclick = () => void sync();

        actions.appendChild(left);
        right.appendChild(refreshBtn);
        right.appendChild(syncBtn);
        actions.appendChild(right);

        modalBox.replaceChildren(titleRow, errBox, cards, list, actions);

        const load = async () => {
            if (busy) return;
            busy = true;
            refreshBtn.textContent = "加载中...";
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
                    const c3v = el("div", "v"); c3v.textContent = `最近一次：${fmtScore(last)} · 累计：${fmtScore(total)}`;
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
                        empty.textContent = "你还没登录，当前只有本地记录（目前为空）。按 L 登录后可云端保存。";
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
                    hint.textContent = `本地有 ${localPending.length} 条未同步成绩，点“同步本地”即可上传到云端（已做去重）。`;
                    list.appendChild(hint);
                }

                if (records.length === 0 && localPending.length === 0) {
                    const empty = el("div", "hint");
                    empty.textContent = "还没有历史成绩，去玩一局吧。";
                    list.appendChild(empty);
                } else {
                    // 先展示本地未同步（更“新鲜”），并打个标签
                    for (const r of localPending) {
                        const item = el("div", "item");
                        const leftCol = el("div");
                        const score = el("div", "score");
                        score.textContent = fmtScore(r.score);
                        const time = el("div", "time");
                        time.textContent = `${fmtTime(r.createdAt)} · 本地未同步`;
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
                refreshBtn.textContent = "刷新";
            }
        };

        const sync = async () => {
            if (!user) return setError("请先登录");
            if (busy) return;
            busy = true;
            syncBtn.textContent = "同步中...";
            try {
                const r = await syncLocalToCloud();
                if (r.uploaded > 0) {
                    // 清理已同步的本地记录，避免列表里一直显示
                    clearSynced();
                }
                await load();
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                busy = false;
                syncBtn.textContent = "同步本地";
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
                // 上传成功就标记，留给 clearSynced() 清除
                // 这样即使中途失败也不会丢失未同步数据
                markSynced(r.clientId);
                uploaded++;
            } catch (e) {
                // 单条失败不阻断后续；比如偶发网络错误
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

