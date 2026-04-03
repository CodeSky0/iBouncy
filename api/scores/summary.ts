import { getSql, ensureSchema } from "../_lib/db.js";
import { ok, unauthorized, methodNotAllowed, serverError } from "../_lib/response.js";
import { getUserFromRequest } from "../_lib/auth.js";

type TrendPoint = { day: string; games: number; bestScore: number; totalScore: number };

function isoDay(d: Date): string {
    // YYYY-MM-DD
    return d.toISOString().slice(0, 10);
}

export default async function handler(req: any, res: any) {
    if (req.method !== "GET") return methodNotAllowed(res, "GET");
    try {
        const user = getUserFromRequest(req);
        if (!user) return unauthorized(res, "请先登录");

        const sql = getSql();
        await ensureSchema(sql);

        const aggRows = await sql`
            SELECT
                COUNT(*)::int AS games,
                COALESCE(MAX(score), 0)::int AS best_score,
                COALESCE(SUM(score), 0)::bigint AS total_score
            FROM scores
            WHERE user_id = ${user.userId}
        `;
        const agg = aggRows?.[0] || { games: 0, best_score: 0, total_score: 0 };

        const lastRows = await sql`
            SELECT score, created_at
            FROM scores
            WHERE user_id = ${user.userId}
            ORDER BY created_at DESC
            LIMIT 1
        `;
        const last = lastRows?.[0] || null;

        // 近 7 天趋势：按 UTC day 聚合（serverless 环境更稳定）
        const trendRows = await sql`
            SELECT
                to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS games,
                COALESCE(MAX(score), 0)::int AS best_score,
                COALESCE(SUM(score), 0)::bigint AS total_score
            FROM scores
            WHERE user_id = ${user.userId}
              AND created_at >= (NOW() AT TIME ZONE 'utc') - INTERVAL '7 days'
            GROUP BY 1
            ORDER BY 1 ASC
        `;

        const map = new Map<string, TrendPoint>();
        for (const r of trendRows || []) {
            map.set(String((r as any).day), {
                day: String((r as any).day),
                games: Number((r as any).games),
                bestScore: Number((r as any).best_score),
                totalScore: Number((r as any).total_score),
            });
        }

        const today = new Date();
        const days: TrendPoint[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
            d.setUTCDate(d.getUTCDate() - i);
            const day = isoDay(d);
            days.push(map.get(day) || { day, games: 0, bestScore: 0, totalScore: 0 });
        }

        return ok(res, {
            summary: {
                games: Number(agg.games),
                bestScore: Number(agg.best_score),
                totalScore: Number(agg.total_score),
                lastScore: last ? Number((last as any).score) : 0,
                lastAt: last ? (last as any).created_at : null,
            },
            trend7d: days,
        });
    } catch (e) {
        return serverError(res, e);
    }
}

