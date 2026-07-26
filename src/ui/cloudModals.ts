/**
 * Modal renderers for the cloud UI overlay.
 *
 * Each function receives the shared {@link CloudUIContext} and a set of
 * callback helpers so it can react to state changes without importing
 * the main orchestration module.
 */
import * as cloud from "../cloud/client";
import { clearLocalScores, clearSynced, listLocalScores, pendingLocalScores } from "../cloud/localScores";
import {
    type CloudUIContext,
    type SyncLocalResult,
    el,
    fmtScore,
    fmtTime,
    sum,
    buildSparkline,
    createButtonWithLoader,
    addRippleEffect,
} from "./cloudUtils";

export interface ModalHelpers {
    renderFab: () => void;
    syncLocalToCloud: () => Promise<SyncLocalResult>;
    showSuccess: (message: string) => void;
    setError: (msg: string | null) => void;
    setBackdropOpen: (open: boolean) => void;
}

/** 发送验证码按钮（带 60 秒冷却） */
function createSendCodeButton(text: string, sendFn: () => Promise<void>, helpers: ModalHelpers): HTMLButtonElement {
    const btn = createButtonWithLoader(text, "btn");
    btn.type = "button";
    let cooldown = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const setCooldown = (sec: number) => {
        cooldown = sec;
        if (sec > 0) {
            btn.disabled = true;
            btn.textContent = `${sec}s 后可重发`;
            if (!timer) {
                timer = setInterval(() => {
                    cooldown--;
                    if (cooldown <= 0) {
                        btn.disabled = false;
                        btn.textContent = text;
                        if (timer) {
                            clearInterval(timer);
                            timer = null;
                        }
                    } else {
                        btn.textContent = `${cooldown}s 后可重发`;
                    }
                }, 1000);
            }
        }
    };

    btn.onclick = async (e) => {
        addRippleEffect(btn, e as MouseEvent);
        if (cooldown > 0) return;
        btn.classList.add("loading");
        try {
            await sendFn();
            helpers.showSuccess("验证码已发送");
            setCooldown(60);
        } catch (err) {
            helpers.setError(err instanceof Error ? err.message : String(err));
        } finally {
            btn.classList.remove("loading");
        }
    };

    return btn;
}

export function renderAuthModal(ctx: CloudUIContext, helpers: ModalHelpers): void {
    ctx.modal = "auth";
    ctx.modalBox.className = "modal modal-auth";
    helpers.setBackdropOpen(true);
    helpers.setError(null);

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
    pwdInput.autocomplete = ctx.mode === "register" ? "new-password" : "current-password";
    fieldPwd.appendChild(pwdLabel);
    fieldPwd.appendChild(pwdInput);

    const errBox = el("div", "error");

    const actions = el("div", "row auth-actions");
    const actionsLeft = el("div");
    const actionsRight = el("div");
    actionsRight.className = "auth-actions-right";

    const closeBtn = createButtonWithLoader("关闭", "btn");
    closeBtn.onclick = () => helpers.setBackdropOpen(false);

    const submitBtn = createButtonWithLoader(ctx.mode === "register" ? "创建账号并登录" : "登录", "btn primary");

    const hint = el("div", "hint auth-hint");

    let firstFocus: HTMLInputElement;

    if (ctx.mode === "login") {
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

        // 忘记密码链接
        const forgotLink = el("a", "forgot-link");
        forgotLink.textContent = "忘记密码？";
        forgotLink.href = "#";
        forgotLink.onclick = (e) => {
            e.preventDefault();
            ctx.mode = "register";
            ctx.modal = "forgot";
            renderForgotModal(ctx, helpers);
        };

        const doSubmit = async () => {
            if (ctx.busy) return;
            helpers.setError(null);
            const raw = identifierInput.value.trim();
            const password = pwdInput.value;
            if (!raw) return helpers.setError("请输入用户名或邮箱");
            if (raw.includes("@")) {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return helpers.setError("邮箱格式不正确");
            } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(raw)) {
                return helpers.setError("用户名须为 3–20 位字母、数字或下划线");
            }
            if (!password || password.length < 6) return helpers.setError("密码至少 6 位");

            ctx.busy = true;
            submitBtn.classList.add("loading");
            try {
                ctx.user = await cloud.login(raw, password);
                helpers.renderFab();
                await helpers.syncLocalToCloud();
                helpers.showSuccess("登录成功！");
                helpers.setBackdropOpen(false);
            } catch (e) {
                helpers.setError(e instanceof Error ? e.message : String(e));
            } finally {
                ctx.busy = false;
                submitBtn.classList.remove("loading");
            }
        };

        submitBtn.onclick = doSubmit;
        identifierInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
        pwdInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());

        hint.innerHTML = `
            <strong>提示</strong><br>
            可用<strong>用户名</strong>或<strong>邮箱</strong>登录。登录后成绩会同步云端，在「历史记录」中查看。
        `;

        // 将忘记密码链接放在 hint 下方
        hint.appendChild(el("br"));
        hint.appendChild(forgotLink);
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

        // 验证码字段（邮箱验证用）
        const fieldCode = el("div", "field auth-stagger field-verify-code");
        fieldCode.style.setProperty("--i", String(stagger++));
        const codeLabel = el("label");
        codeLabel.textContent = "邮箱验证码";
        const codeRow = el("div", "code-input-row");
        const codeInput = el("input") as HTMLInputElement;
        codeInput.type = "text";
        codeInput.placeholder = "6 位数字";
        codeInput.maxLength = 6;
        codeInput.autocomplete = "one-time-code";
        codeInput.inputMode = "numeric";
        codeInput.pattern = "[0-9]*";

        const sendCodeBtn = createSendCodeButton(
            "发送验证码",
            async () => {
                const email = emailInput.value.trim();
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    throw new Error("请先输入正确的邮箱地址");
                }
                await cloud.sendVerifyCode(email, "verify");
            },
            helpers,
        );
        sendCodeBtn.classList.add("send-code-btn");
        codeRow.appendChild(codeInput);
        codeRow.appendChild(sendCodeBtn);
        fieldCode.appendChild(codeLabel);
        fieldCode.appendChild(codeRow);

        fieldPwd.style.setProperty("--i", String(stagger++));
        fieldsWrap.appendChild(fieldUser);
        fieldsWrap.appendChild(fieldNick);
        fieldsWrap.appendChild(fieldEmail);
        fieldsWrap.appendChild(fieldCode);
        fieldsWrap.appendChild(fieldPwd);
        firstFocus = usernameInput;

        const doSubmit = async () => {
            if (ctx.busy) return;
            helpers.setError(null);
            const username = usernameInput.value.trim().toLowerCase();
            const nickname = nicknameInput.value.trim();
            const email = emailInput.value.trim();
            const password = pwdInput.value;
            const verifyCode = codeInput.value.trim();
            if (!/^[a-z0-9_]{3,20}$/.test(username)) {
                return helpers.setError("用户名为 3–20 位小写字母、数字或下划线");
            }
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return helpers.setError("邮箱格式不正确");
            if (verifyCode && !/^\d{6}$/.test(verifyCode)) return helpers.setError("验证码为 6 位数字");
            if (!password || password.length < 6) return helpers.setError("密码至少 6 位");

            ctx.busy = true;
            submitBtn.classList.add("loading");
            try {
                ctx.user = await cloud.register({
                    username,
                    nickname: nickname || undefined,
                    email,
                    password,
                    verifyCode: verifyCode || undefined,
                });
                helpers.renderFab();
                await helpers.syncLocalToCloud();
                helpers.showSuccess("注册成功！");
                helpers.setBackdropOpen(false);
            } catch (e) {
                helpers.setError(e instanceof Error ? e.message : String(e));
            } finally {
                ctx.busy = false;
                submitBtn.classList.remove("loading");
            }
        };

        submitBtn.onclick = doSubmit;
        usernameInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
        nicknameInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
        emailInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
        codeInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
        pwdInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());

        hint.innerHTML = `
            <strong>注册说明</strong><br>
            用户名用于登录（小写字母、数字、下划线，3–20 位）。昵称为展示名称，可不填（将显示用户名）。<br>
            建议填写验证码以验证邮箱所有权。
        `;
    }

    tabLogin.onclick = (e) => {
        addRippleEffect(tabLogin, e as MouseEvent);
        ctx.mode = "login";
        renderAuthModal(ctx, helpers);
    };
    tabRegister.onclick = (e) => {
        addRippleEffect(tabRegister, e as MouseEvent);
        ctx.mode = "register";
        renderAuthModal(ctx, helpers);
    };

    tabLogin.classList.toggle("active", ctx.mode === "login");
    tabRegister.classList.toggle("active", ctx.mode === "register");

    actionsLeft.appendChild(closeBtn);
    actionsRight.appendChild(submitBtn);
    actions.appendChild(actionsLeft);
    actions.appendChild(actionsRight);

    ctx.modalBox.replaceChildren(head, fieldsWrap, errBox, actions, hint);
    setTimeout(() => firstFocus.focus(), 100);
}

// ---- 忘记密码模态框 ----
export function renderForgotModal(ctx: CloudUIContext, helpers: ModalHelpers): void {
    ctx.modal = "forgot";
    ctx.modalBox.className = "modal modal-auth";
    helpers.setBackdropOpen(true);
    helpers.setError(null);

    const head = el("div", "auth-head");
    const title = el("h2");
    title.textContent = "忘记密码";
    head.appendChild(title);

    // 返回登录链接
    const backLink = el("a", "forgot-link");
    backLink.textContent = "返回登录";
    backLink.href = "#";
    backLink.onclick = (e) => {
        e.preventDefault();
        ctx.mode = "login";
        renderAuthModal(ctx, helpers);
    };

    const fieldsWrap = el("div", "auth-fields");

    const fieldEmail = el("div", "field auth-stagger");
    fieldEmail.style.setProperty("--i", "0");
    const emailLabel = el("label");
    emailLabel.textContent = "注册邮箱";
    const emailInput = el("input") as HTMLInputElement;
    emailInput.type = "email";
    emailInput.placeholder = "请输入注册时使用的邮箱";
    emailInput.autocomplete = "email";
    fieldEmail.appendChild(emailLabel);
    fieldEmail.appendChild(emailInput);

    const fieldCode = el("div", "field auth-stagger");
    fieldCode.style.setProperty("--i", "1");
    const codeLabel = el("label");
    codeLabel.textContent = "验证码";
    const codeRow = el("div", "code-input-row");
    const codeInput = el("input") as HTMLInputElement;
    codeInput.type = "text";
    codeInput.placeholder = "6 位数字";
    codeInput.maxLength = 6;
    codeInput.autocomplete = "one-time-code";
    codeInput.inputMode = "numeric";
    codeInput.pattern = "[0-9]*";

    const sendCodeBtn = createSendCodeButton(
        "发送验证码",
        async () => {
            const email = emailInput.value.trim();
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new Error("请先输入正确的邮箱地址");
            }
            await cloud.forgotPassword(email);
        },
        helpers,
    );
    sendCodeBtn.classList.add("send-code-btn");
    codeRow.appendChild(codeInput);
    codeRow.appendChild(sendCodeBtn);
    fieldCode.appendChild(codeLabel);
    fieldCode.appendChild(codeRow);

    const fieldNewPwd = el("div", "field auth-stagger");
    fieldNewPwd.style.setProperty("--i", "2");
    const newPwdLabel = el("label");
    newPwdLabel.textContent = "新密码";
    const newPwdInput = el("input") as HTMLInputElement;
    newPwdInput.type = "password";
    newPwdInput.placeholder = "至少 6 位";
    newPwdInput.autocomplete = "new-password";
    fieldNewPwd.appendChild(newPwdLabel);
    fieldNewPwd.appendChild(newPwdInput);

    fieldsWrap.appendChild(fieldEmail);
    fieldsWrap.appendChild(fieldCode);
    fieldsWrap.appendChild(fieldNewPwd);

    const errBox = el("div", "error");

    const actions = el("div", "row auth-actions");
    const actionsLeft = el("div");
    const actionsRight = el("div");
    actionsRight.className = "auth-actions-right";

    const closeBtn = createButtonWithLoader("关闭", "btn");
    closeBtn.onclick = () => helpers.setBackdropOpen(false);

    const submitBtn = createButtonWithLoader("重置密码", "btn primary");

    const doSubmit = async () => {
        if (ctx.busy) return;
        helpers.setError(null);
        const email = emailInput.value.trim();
        const code = codeInput.value.trim();
        const password = newPwdInput.value;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return helpers.setError("邮箱格式不正确");
        if (!/^\d{6}$/.test(code)) return helpers.setError("验证码为 6 位数字");
        if (!password || password.length < 6) return helpers.setError("密码至少 6 位");

        ctx.busy = true;
        submitBtn.classList.add("loading");
        try {
            await cloud.resetPassword(email, code, password);
            helpers.showSuccess("密码已重置，请登录");
            ctx.mode = "login";
            renderAuthModal(ctx, helpers);
        } catch (e) {
            helpers.setError(e instanceof Error ? e.message : String(e));
        } finally {
            ctx.busy = false;
            submitBtn.classList.remove("loading");
        }
    };

    submitBtn.onclick = doSubmit;
    emailInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
    codeInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());
    newPwdInput.addEventListener("keydown", (e) => e.key === "Enter" && doSubmit());

    const hint = el("div", "hint auth-hint");
    hint.innerHTML = `
        <strong>密码重置</strong><br>
        输入注册邮箱后点击「发送验证码」，收到验证码后输入新密码即可重置。
    `;
    hint.appendChild(el("br"));
    hint.appendChild(backLink);

    actionsLeft.appendChild(closeBtn);
    actionsRight.appendChild(submitBtn);
    actions.appendChild(actionsLeft);
    actions.appendChild(actionsRight);

    ctx.modalBox.replaceChildren(head, fieldsWrap, errBox, actions, hint);
    setTimeout(() => emailInput.focus(), 100);
}

export async function renderHistoryModal(ctx: CloudUIContext, helpers: ModalHelpers): Promise<void> {
    ctx.modal = "history";
    ctx.modalBox.className = "modal modal-history";
    helpers.setBackdropOpen(true);
    helpers.setError(null);

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
    closeBtn.onclick = () => helpers.setBackdropOpen(false);
    titleRow.appendChild(titleBlock);
    titleRow.appendChild(closeBtn);

    const errBox = el("div", "error");
    const cards = el("div", "cards history-cards");
    const list = el("div", "list history-list");
    const actions = el("div", "row history-actions");
    const actionsLeft = el("div");
    const actionsRight = el("div");
    actionsRight.className = "history-actions-right";

    const refreshBtn = createButtonWithLoader("刷新", "btn");
    refreshBtn.onclick = () => void load();

    const syncBtn = createButtonWithLoader("同步本地", "btn primary");
    syncBtn.onclick = () => void doSync();

    let clearPending = false;
    const clearBtn = createButtonWithLoader("清空记录", "btn danger clear-btn");
    clearBtn.onclick = () => {
        if (!clearPending) {
            clearPending = true;
            clearBtn.textContent = "确认清空？";
            clearBtn.style.background = "linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.75))";
            clearBtn.style.borderBottomColor = "rgba(220, 38, 38, 0.5)";
            setTimeout(() => {
                clearPending = false;
                clearBtn.textContent = "清空记录";
                clearBtn.removeAttribute("style");
            }, 4000);
            return;
        }
        void (async () => {
            if (ctx.busy) return;
            ctx.busy = true;
            clearBtn.classList.add("loading");
            clearBtn.textContent = "清空中...";
            try {
                if (ctx.user) {
                    await cloud.clearScores();
                    clearLocalScores();
                    helpers.showSuccess("云端成绩已清空");
                } else {
                    clearLocalScores();
                    helpers.showSuccess("本地记录已清空");
                }
                clearPending = false;
                clearBtn.removeAttribute("style");
                await load();
            } catch (e) {
                helpers.setError(e instanceof Error ? e.message : String(e));
                clearBtn.textContent = "清空记录";
                ctx.busy = false;
                clearBtn.classList.remove("loading");
            }
        })();
    };

    actions.appendChild(actionsLeft);
    actionsLeft.appendChild(clearBtn);
    actionsRight.appendChild(refreshBtn);
    actionsRight.appendChild(syncBtn);
    actions.appendChild(actionsRight);
    ctx.modalBox.replaceChildren(titleRow, errBox, cards, list, actions, loadingOverlay);

    const load = async () => {
        if (ctx.busy) return;
        ctx.busy = true;
        refreshBtn.classList.add("loading");
        const useOverlay = !!ctx.user;
        if (useOverlay) loadingOverlay.classList.add("show");
        cards.replaceChildren();
        list.replaceChildren();
        try {
            if (!ctx.user) {
                const local = listLocalScores();
                const games = local.length;
                const best = games ? Math.max(...local.map((r) => r.score)) : 0;
                const total = sum(local.map((r) => r.score));
                const last = games ? local[0].score : 0;

                const c1 = el("div", "card");
                const c1k = el("div", "k");
                c1k.textContent = "游客 · 总局数";
                const c1v = el("div", "v");
                c1v.textContent = String(games);
                c1.appendChild(c1k);
                c1.appendChild(c1v);

                const c2 = el("div", "card");
                const c2k = el("div", "k");
                c2k.textContent = "游客 · 最高分";
                const c2v = el("div", "v");
                c2v.textContent = fmtScore(best);
                c2.appendChild(c2k);
                c2.appendChild(c2v);

                const c3 = el("div", "card wide");
                const c3k = el("div", "k");
                c3k.textContent = "游客 · 近7天（每日最高分）";
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
                c3.appendChild(c3k);
                c3.appendChild(c3v);
                c3.appendChild(sparkWrap);
                cards.appendChild(c1);
                cards.appendChild(c2);
                cards.appendChild(c3);

                if (local.length === 0) {
                    const empty = el("div", "hint");
                    empty.innerHTML = `
                        <strong>暂无记录</strong><br>
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
            const c1k = el("div", "k");
            c1k.textContent = "云端 · 总局数";
            const c1v = el("div", "v");
            c1v.textContent = String(s.games);
            c1.appendChild(c1k);
            c1.appendChild(c1v);

            const c2 = el("div", "card");
            const c2k = el("div", "k");
            c2k.textContent = "云端 · 最高分";
            const c2v = el("div", "v");
            c2v.textContent = fmtScore(s.bestScore);
            c2.appendChild(c2k);
            c2.appendChild(c2v);

            const c3 = el("div", "card wide");
            const c3k = el("div", "k");
            c3k.textContent = "云端 · 近7天（每日最高分）";
            const c3v = el("div", "v");
            c3v.textContent = `最近一次：${fmtScore(s.lastScore)} · 累计：${fmtScore(s.totalScore)}`;
            const sparkWrap = el("div", "spark");
            sparkWrap.appendChild(buildSparkline(summary.trend7d.map((p) => p.bestScore)));
            c3.appendChild(c3k);
            c3.appendChild(c3v);
            c3.appendChild(sparkWrap);
            cards.appendChild(c1);
            cards.appendChild(c2);
            cards.appendChild(c3);

            if (localPending.length > 0) {
                const hint = el("div", "hint");
                hint.innerHTML = `
                    <strong>待同步</strong><br>
                    本地有 ${localPending.length} 条未同步成绩，点击「同步本地」即可上传到云端（已做去重）。
                `;
                list.appendChild(hint);
            }

            if (records.length === 0 && localPending.length === 0) {
                const empty = el("div", "hint");
                empty.innerHTML = `
                    <strong>开始游戏</strong><br>
                    还没有历史成绩，去玩一局吧！
                `;
                list.appendChild(empty);
            } else {
                // Show local pending first with a sync badge
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
            helpers.setError(e instanceof Error ? e.message : String(e));
        } finally {
            ctx.busy = false;
            refreshBtn.classList.remove("loading");
            if (useOverlay) loadingOverlay.classList.remove("show");
        }
    };

    const doSync = async () => {
        if (!ctx.user) return helpers.setError("请先登录");
        if (ctx.busy) return;
        ctx.busy = true;
        syncBtn.classList.add("loading");
        let syncOk = false;
        try {
            const r = await helpers.syncLocalToCloud();
            if (r.uploaded > 0) {
                clearSynced();
            }
            if (r.pendingAtStart === 0) {
                helpers.showSuccess("所有记录已同步！");
                syncOk = true;
            } else if (r.uploaded === r.pendingAtStart) {
                helpers.showSuccess(r.uploaded === 1 ? "同步成功！" : `成功同步 ${r.uploaded} 条记录！`);
                syncOk = true;
            } else if (r.uploaded > 0) {
                helpers.showSuccess(`已同步 ${r.uploaded} 条`);
                helpers.setError(r.lastError || "部分记录未能同步，请重试");
                syncOk = true;
            } else {
                helpers.setError(r.lastError || "同步失败，请检查网络或登录状态后重试");
            }
        } catch (e) {
            helpers.setError(e instanceof Error ? e.message : String(e));
        } finally {
            ctx.busy = false;
            syncBtn.classList.remove("loading");
        }
        if (syncOk) await load();
    };

    await load();
}

export async function renderLeaderboardModal(ctx: CloudUIContext, helpers: ModalHelpers): Promise<void> {
    ctx.modal = "leaderboard";
    ctx.modalBox.className = "modal modal-history modal-leaderboard";
    helpers.setBackdropOpen(true);
    helpers.setError(null);

    let currentPeriod = "all";

    const loadingOverlay = el("div", "modal-loading");
    const loadingRing = el("div", "modal-loading-spinner");
    loadingOverlay.appendChild(loadingRing);

    const titleRow = el("div", "row title-row history-head");
    const titleBlock = el("div", "history-title-block");
    const title = el("h2");
    title.textContent = "排行榜";
    const titleAccent = el("div", "history-title-accent");
    titleBlock.appendChild(title);
    titleBlock.appendChild(titleAccent);
    const closeBtn = createButtonWithLoader("关闭", "btn");
    closeBtn.onclick = () => helpers.setBackdropOpen(false);
    titleRow.appendChild(titleBlock);
    titleRow.appendChild(closeBtn);

    const periodTabs = el("div", "period-tabs");
    const periods: { key: string; label: string }[] = [
        { key: "all", label: "全部" },
        { key: "day", label: "日榜" },
        { key: "week", label: "周榜" },
        { key: "month", label: "月榜" },
    ];
    for (const p of periods) {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "period-tab" + (p.key === currentPeriod ? " active" : "");
        tab.textContent = p.label;
        tab.dataset.period = p.key;
        tab.onclick = (e) => {
            addRippleEffect(tab, e as MouseEvent);
            if (p.key === currentPeriod || ctx.busy) return;
            currentPeriod = p.key;
            periodTabs.querySelectorAll(".period-tab").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            void load();
        };
        periodTabs.appendChild(tab);
    }

    const errBox = el("div", "error");
    const list = el("div", "list history-list leaderboard-list");
    const footer = el("div", "leaderboard-footer");
    const actions = el("div", "row history-actions");
    const actionsLeft = el("div");
    const actionsRight = el("div");
    actionsRight.className = "history-actions-right";
    const refreshBtn = createButtonWithLoader("刷新", "btn");
    refreshBtn.onclick = () => void load();
    actions.appendChild(actionsLeft);
    actionsRight.appendChild(refreshBtn);
    actions.appendChild(actionsRight);
    ctx.modalBox.replaceChildren(titleRow, periodTabs, errBox, list, footer, actions, loadingOverlay);

    const load = async () => {
        if (ctx.busy) return;
        ctx.busy = true;
        refreshBtn.classList.add("loading");
        loadingOverlay.classList.add("show");
        list.replaceChildren();
        footer.replaceChildren();
        footer.style.display = "none";
        try {
            const entries = await cloud.fetchLeaderboard(50, currentPeriod);
            if (ctx.user) {
                try {
                    const { summary: s } = await cloud.summary();
                    const hint = el("div", "hint leaderboard-my-best");
                    hint.textContent = `我的最佳：${fmtScore(s.bestScore)}`;
                    footer.appendChild(hint);
                    footer.style.display = "";
                } catch {
                    /* Ignore summary failure; show leaderboard anyway */
                }
            }

            if (entries.length === 0) {
                const empty = el("div", "hint");
                empty.innerHTML = "<strong>暂无数据</strong><br>还没有玩家上传成绩。";
                list.appendChild(empty);
                return;
            }

            const selfId = ctx.user?.id;
            for (const ent of entries) {
                const item = el("div", "item item--leaderboard");
                if (selfId !== undefined && ent.userId === selfId) item.classList.add("item--self");

                const rankEl = el("div", "lb-rank");
                rankEl.textContent = String(ent.rank);

                const main = el("div", "lb-main");
                const nameEl = el("div", "lb-name");
                nameEl.textContent = ent.displayName;
                const timeEl = el("div", "time");
                timeEl.textContent = fmtTime(ent.bestAt);
                main.appendChild(nameEl);
                main.appendChild(timeEl);

                const scoreEl = el("div", "score");
                scoreEl.textContent = fmtScore(ent.bestScore);

                item.appendChild(rankEl);
                item.appendChild(main);
                item.appendChild(scoreEl);
                list.appendChild(item);
            }
        } catch (e) {
            helpers.setError(e instanceof Error ? e.message : String(e));
        } finally {
            ctx.busy = false;
            refreshBtn.classList.remove("loading");
            loadingOverlay.classList.remove("show");
        }
    };

    await load();
}
