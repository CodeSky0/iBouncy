import bcrypt from "bcryptjs";
import { getSql, ensureSchema } from "../_lib/db.js";
import { readJsonBody } from "../_lib/body.js";
import { ok, badRequest, methodNotAllowed, serverError } from "../_lib/response.js";
import { signToken, buildAuthCookie } from "../_lib/auth.js";

function normalizeEmail(email: unknown) {
    return String(email || "").trim().toLowerCase();
}

function normalizeUsername(u: unknown) {
    return String(u || "").trim().toLowerCase();
}

function normalizeNickname(n: unknown) {
    const s = String(n || "").trim();
    return s.length ? s.slice(0, 32) : "";
}

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
        const body = await readJsonBody(req);
        const email = normalizeEmail(body.email);
        const password = String(body.password || "");
        const username = normalizeUsername(body.username);
        const nicknameRaw = normalizeNickname(body.nickname);

        if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
            return badRequest(res, "用户名为 3–20 位小写字母、数字或下划线");
        }
        if (!email || !email.includes("@")) return badRequest(res, "邮箱格式不正确");
        if (password.length < 6) return badRequest(res, "密码至少 6 位");

        const sql = getSql();
        await ensureSchema(sql);

        const passwordHash = await bcrypt.hash(password, 10);
        const nicknameToStore = nicknameRaw || null;

        const rows = await sql`
            INSERT INTO users (email, password_hash, username, nickname)
            VALUES (${email}, ${passwordHash}, ${username}, ${nicknameToStore})
            RETURNING id, email, username, nickname, created_at
        `;

        const row = rows?.[0];
        const user = userPayload(row);
        const token = signToken({ userId: user.id, email: user.email });
        const cookie = buildAuthCookie(token);
        return ok(res, { user, tokenSet: true }, { "Set-Cookie": cookie });
    } catch (e: any) {
        const msg = String(e?.message || e).toLowerCase();
        if (msg.includes("duplicate") || msg.includes("unique")) {
            if (msg.includes("email") || msg.includes("(email)")) {
                return badRequest(res, "该邮箱已注册");
            }
            if (msg.includes("username") || msg.includes("uq_users_username")) {
                return badRequest(res, "该用户名已被占用");
            }
            return badRequest(res, "该邮箱或用户名已存在");
        }
        return serverError(res, e);
    }
}
