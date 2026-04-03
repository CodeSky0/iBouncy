import { apiFetch } from "./http";

export type CloudUser = { id: number; email: string };
export type ScoreRecord = { id: number; score: number; createdAt: string };
export type TrendPoint = { day: string; games: number; bestScore: number; totalScore: number };
export type ScoreSummary = { games: number; bestScore: number; totalScore: number; lastScore: number; lastAt: string | null };

export async function me(): Promise<CloudUser | null> {
    const r = await apiFetch<{ user: CloudUser | null }>("/api/auth/me");
    return r.user;
}

export async function register(email: string, password: string): Promise<CloudUser> {
    const r = await apiFetch<{ user: CloudUser }>("/api/auth/register", {
        method: "POST",
        json: { email, password },
    });
    return r.user;
}

export async function login(email: string, password: string): Promise<CloudUser> {
    const r = await apiFetch<{ user: CloudUser }>("/api/auth/login", {
        method: "POST",
        json: { email, password },
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

export async function summary(): Promise<{ summary: ScoreSummary; trend7d: TrendPoint[] }> {
    const r = await apiFetch<{ summary: ScoreSummary; trend7d: TrendPoint[] }>("/api/scores/summary");
    return { summary: r.summary, trend7d: r.trend7d };
}

