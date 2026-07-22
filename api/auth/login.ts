import bcrypt from "bcryptjs";
import { getSql, ensureSchema, firstSqlRow } from "../_lib/db.js";
import { readJsonBody } from "../_lib/body.js";
import { ok, badRequest, unauthorized, methodNotAllowed, serverError, tooManyRequests, forbidden } from "../_lib/response.js";
import { signToken, buildAuthCookie } from "../_lib/auth.js";
import { isRateLimited, getClientIp } from "../_lib/ratelimit.js";
import { csrfCheck } from "../_lib/csrf.js";

function normalizeEmail(email: unknown) {
    return String(email || "").trim().toLowerCase();
}

type LoginUserRow = {
    id: unknown;
    email: string;
    username: string | null;
    nickname: string | null;
    password_hash: string;
};

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
    if (req.method !== "POST") return methodNotAllowed(res, "POST");
    try {
        // CSRF
        if (!csrfCheck(req)) return forbidden(res, "CSRF 验证失败");

        // 速率限制：同 IP 每分钟最多 10 次登录尝试
        const ip = getClientIp(req);
        if (isRateLimited(`login:${ip}`, 10)) {
            return tooManyRequests(res);
        }

        const body = await readJsonBody(req);
        const raw = String(body.identifier ?? body.email ?? "").trim();
        const password = String(body.password || "");

        if (!raw) return badRequest(res, "请输入用户名或邮箱");
        if (!password) return badRequest(res, "请输入密码");

        const sql = getSql();
        await ensureSchema(sql);

        let rows;
        if (raw.includes("@")) {
            const email = normalizeEmail(raw);
            if (!email || !email.includes("@")) return badRequest(res, "邮箱格式不正确");
            rows = await sql`
                SELECT id, email, username, nickname, password_hash
                FROM users WHERE email = ${email} LIMIT 1
            `;
        } else {
            const uname = raw.toLowerCase();
            if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
                return badRequest(res, "用户名须为 3–20 位小写字母、数字或下划线，或使用邮箱登录");
            }
            rows = await sql`
                SELECT id, email, username, nickname, password_hash
                FROM users WHERE LOWER(username) = ${uname} LIMIT 1
            `;
        }

        const row = firstSqlRow<LoginUserRow>(rows);
        if (!row) return unauthorized(res, "用户名/邮箱或密码不正确");

        const okPwd = await bcrypt.compare(password, row.password_hash);
        if (!okPwd) return unauthorized(res, "用户名/邮箱或密码不正确");

        const user = userPayload(row);
        const token = signToken({ userId: user.id, email: user.email });
        const cookie = buildAuthCookie(token);
        return ok(res, { user, tokenSet: true }, { "Set-Cookie": cookie });
    } catch (e) {
        return serverError(res, e);
    }
}
