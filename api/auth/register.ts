import bcrypt from "bcryptjs";
import { getSql, ensureSchema } from "../_lib/db";
import { readJsonBody } from "../_lib/body";
import { ok, badRequest, methodNotAllowed, serverError } from "../_lib/response";
import { signToken, buildAuthCookie } from "../_lib/auth";

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
        if (password.length < 6) return badRequest(res, "密码至少 6 位");

        const sql = getSql();
        await ensureSchema(sql);

        const passwordHash = await bcrypt.hash(password, 10);
        const rows = await sql`
            INSERT INTO users (email, password_hash)
            VALUES (${email}, ${passwordHash})
            RETURNING id, email, created_at
        `;

        const user = rows?.[0];
        const token = signToken({ userId: Number(user.id), email: user.email });
        const cookie = buildAuthCookie(token);
        return ok(res, { user: { id: Number(user.id), email: user.email }, tokenSet: true }, { "Set-Cookie": cookie });
    } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
            return badRequest(res, "该邮箱已注册");
        }
        return serverError(res, e);
    }
}

