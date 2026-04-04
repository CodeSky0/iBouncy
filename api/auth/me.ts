import { ok, methodNotAllowed, serverError } from "../_lib/response.js";
import { getUserFromRequest } from "../_lib/auth.js";
import { getSql, ensureSchema } from "../_lib/db.js";

function userPayload(row: { id: unknown; email: string; username: string | null; nickname: string | null }) {
    const nickname = row.nickname ? String(row.nickname).trim() : "";
    const username = row.username ? String(row.username).trim() : "";
    const displayName = nickname || username || row.email;
    return {
        id: Number(row.id),
        email: row.email,
        username: username || null,
        nickname: nickname || null,
        displayName,
    };
}

export default async function handler(req: any, res: any) {
    if (req.method !== "GET") return methodNotAllowed(res, "GET");
    try {
        const jwtUser = getUserFromRequest(req);
        if (!jwtUser) return ok(res, { user: null });

        const sql = getSql();
        await ensureSchema(sql);
        const rows = await sql`
            SELECT id, email, username, nickname FROM users WHERE id = ${jwtUser.userId} LIMIT 1
        `;
        const row = rows?.[0];
        if (!row) return ok(res, { user: null });

        return ok(res, { user: userPayload(row) });
    } catch (e) {
        return serverError(res, e);
    }
}
