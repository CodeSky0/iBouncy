import { apiFetch } from "./http";

export type CloudUser = {
    id: number;
    email: string;
    username: string | null;
    nickname: string | null;
    displayName: string;
};

export type ScoreRecord = { id: number; score: number; createdAt: string };
export type LeaderboardEntry = { rank: number; userId: number; displayName: string; bestScore: number; bestAt: string };
export type TrendPoint = { day: string; games: number; bestScore: number; totalScore: number };
export type ScoreSummary = { games: number; bestScore: number; totalScore: number; lastScore: number; lastAt: string | null };

export async function me(): Promise<CloudUser | null> {
    const r = await apiFetch<{ user: CloudUser | null }>("/api/auth/me");
    return r.user;
}

export async function register(params: {
    username: string;
    nickname?: string;
    email: string;
    password: string;
}): Promise<CloudUser> {
    const r = await apiFetch<{ user: CloudUser }>("/api/auth/register", {
        method: "POST",
        json: {
            username: params.username,
            nickname: params.nickname || "",
            email: params.email,
            password: params.password,
        },
    });
    return r.user;
}

export async function login(identifier: string, password: string): Promise<CloudUser> {
    const r = await apiFetch<{ user: CloudUser }>("/api/auth/login", {
        method: "POST",
        json: { identifier, password },
    });
    return r.user;
}

export async function logout(): Promise<void> {
    await apiFetch<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST", json: {} });
}

/**
 * 写入成绩（整数）。本项目 UI 显示 1 位小数，因此这里建议传「score * 10」。
 */
export async function addScore(score: number, clientId?: string | null): Promise<void> {
    await apiFetch<{ saved: boolean }>("/api/scores/add", { method: "POST", json: { score, clientId: clientId || null } });
}

export async function listScores(limit = 20): Promise<ScoreRecord[]> {
    const r = await apiFetch<{ records: ScoreRecord[] }>(`/api/scores/list?limit=${encodeURIComponent(String(limit))}`);
    return r.records;
}

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const r = await apiFetch<{ entries: LeaderboardEntry[] }>(
        `/api/scores/leaderboard?limit=${encodeURIComponent(String(limit))}`,
    );
    return r.entries;
}

export async function summary(): Promise<{ summary: ScoreSummary; trend7d: TrendPoint[] }> {
    const r = await apiFetch<{ summary: ScoreSummary; trend7d: TrendPoint[] }>("/api/scores/summary");
    return { summary: r.summary, trend7d: r.trend7d };
}

/** 清空当前用户的所有云端成绩 */
export async function clearScores(): Promise<number> {
    const r = await apiFetch<{ deleted: number }>("/api/scores/clear", { method: "POST", json: {} });
    return r.deleted;
}

/** 请求密码重置令牌 */
export async function requestPasswordReset(email: string): Promise<{ message: string; token?: string }> {
    const r = await apiFetch<{ message: string; token?: string }>("/api/auth/reset", {
        method: "POST",
        json: { email, action: "request" },
    });
    return { message: r.message, token: r.token };
}

/** 确认密码重置 */
export async function confirmPasswordReset(
    email: string,
    token: string,
    newPassword: string,
): Promise<{ message: string }> {
    const r = await apiFetch<{ message: string }>("/api/auth/reset", {
        method: "POST",
        json: { email, token, newPassword, action: "confirm" },
    });
    return r;
}

/** 请求邮箱验证码 */
export async function sendVerificationCode(email: string): Promise<{ message: string; code?: string; verified?: boolean }> {
    const r = await apiFetch<{ message: string; code?: string; verified?: boolean }>("/api/auth/verify", {
        method: "POST",
        json: { email, action: "send" },
    });
    return r;
}

/** 确认邮箱验证码 */
export async function confirmVerificationCode(
    email: string,
    code: string,
): Promise<{ message: string; verified: boolean }> {
    const r = await apiFetch<{ message: string; verified: boolean }>("/api/auth/verify", {
        method: "POST",
        json: { email, code, action: "confirm" },
    });
    return r;
}
