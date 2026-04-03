import { getSql, ensureSchema } from "../_lib/db";
import { ok, unauthorized, methodNotAllowed, serverError } from "../_lib/response";
import { getUserFromRequest } from "../_lib/auth";

export default async function handler(req: any, res: any) {
    if (req.method !== "GET") return methodNotAllowed(res, "GET");
    try {
        const user = getUserFromRequest(req);
        if (!user) return unauthorized(res, "请先登录");

        const url = new URL(req.url, "http://localhost");
        const limitRaw = url.searchParams.get("limit");
        const limit = Math.max(1, Math.min(50, Number(limitRaw || 20) || 20));

        const sql = getSql();
        await ensureSchema(sql);

        const rows = await sql`
            SELECT id, score, created_at
            FROM scores
            WHERE user_id = ${user.userId}
            ORDER BY created_at DESC
            LIMIT ${limit}
        `;

        const records = (rows || []).map((r: any) => ({
            id: Number(r.id),
            score: Number(r.score),
            createdAt: r.created_at,
        }));
        return ok(res, { records });
    } catch (e) {
        return serverError(res, e);
    }
}

