import bcrypt from "bcryptjs";
import { getSql, ensureSchema } from "../_lib/db.js";
import { readJsonBody } from "../_lib/body.js";
import { ok, badRequest, unauthorized, methodNotAllowed, serverError } from "../_lib/response.js";
import { signToken, buildAuthCookie } from "../_lib/auth.js";

function normalizeEmail(email: unknown) {
    return String(email || "").trim().toLowerCase();
}

export default async function handler(req: any, res: any) {
    if (req.method !== "POST") return methodNotAllowed(res, "POST");
    try {
        const body = await readJsonBody(req);
        const email = normalizeEmail(body.email);
        const password = String(body.password || "");

        if (!email || !email.includes("@")) return badRequest(res, "邮箱格式不正确");
        if (!password) return badRequest(res, "请输入密码");

        const sql = getSql();
        await ensureSchema(sql);

        const rows = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email} LIMIT 1`;
        const user = rows?.[0];
        if (!user) return unauthorized(res, "邮箱或密码不正确");

        const okPwd = await bcrypt.compare(password, user.password_hash);
        if (!okPwd) return unauthorized(res, "邮箱或密码不正确");

        const token = signToken({ userId: Number(user.id), email: user.email });
        const cookie = buildAuthCookie(token);
        return ok(res, { user: { id: Number(user.id), email: user.email }, tokenSet: true }, { "Set-Cookie": cookie });
    } catch (e) {
        return serverError(res, e);
    }
}

