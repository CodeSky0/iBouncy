import bcrypt from "bcryptjs";
import { getSql, ensureSchema, firstSqlRow } from "../_lib/db.js";
import { readJsonBody } from "../_lib/body.js";
import { ok, badRequest, methodNotAllowed, serverError, tooManyRequests, unauthorized } from "../_lib/response.js";
import { isRateLimited, getClientIp } from "../_lib/ratelimit.js";
import { csrfCheck } from "../_lib/csrf.js";
import crypto from "crypto";

function normalizeEmail(email: unknown) {
    return String(email || "").trim().toLowerCase();
}

function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

type ResetRow = {
    id: unknown;
    email: string;
    password_hash: string;
};

type TokenRow = {
    email: string;
    used: boolean;
    expires_at: string;
};

export default async function handler(req: any, res: any) {
    if (req.method !== "POST") return methodNotAllowed(res, "POST");
    try {
        if (!csrfCheck(req)) {
            return unauthorized(res, "CSRF 验证失败");
        }

        const ip = getClientIp(req);
        if (isRateLimited(`reset:${ip}`, 3)) {
            return tooManyRequests(res);
        }

        const body = await readJsonBody(req);
        const action = String(body.action || "request").toLowerCase();
        const email = normalizeEmail(body.email);

        if (!email || !email.includes("@")) {
            return badRequest(res, "邮箱格式不正确");
        }

        const sql = getSql();
        await ensureSchema(sql);

        // Ensure reset_tokens table exists
        await sql`
            CREATE TABLE IF NOT EXISTS reset_tokens (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
                used BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;

        if (action === "request") {
            // Check user exists
            const rows = await sql`
                SELECT id, email FROM users WHERE email = ${email} LIMIT 1
            `;
            if (!firstSqlRow(rows)) {
                // Return ok even if email not found (don't reveal which emails exist)
                return ok(res, { message: "如果该邮箱已注册，重置令牌已生成" });
            }

            // Invalidate old tokens
            await sql`
                UPDATE reset_tokens SET used = TRUE
                WHERE email = ${email} AND used = FALSE AND expires_at > NOW()
            `;

            const token = generateToken();
            await sql`
                INSERT INTO reset_tokens (email, token)
                VALUES (${email}, ${token})
            `;

            // In production, send token via email. For development, return it directly.
            return ok(res, {
                message: "重置令牌已生成（开发环境直接返回，生产环境会通过邮件发送）",
                token,
            });
        }

        if (action === "confirm") {
            const token = String(body.token || "").trim();
            const newPassword = String(body.newPassword || "");

            if (!token) return badRequest(res, "请提供重置令牌");
            if (!newPassword || newPassword.length < 6) return badRequest(res, "新密码至少 6 位");

            // Validate token
            const tokenRows = await sql`
                SELECT email, used, expires_at FROM reset_tokens
                WHERE token = ${token} AND email = ${email}
                LIMIT 1
            `;
            const tokenRow = firstSqlRow<TokenRow>(tokenRows);
            if (!tokenRow) return badRequest(res, "重置令牌无效或已过期");
            if (tokenRow.used) return badRequest(res, "重置令牌已被使用");
            if (new Date(tokenRow.expires_at) < new Date()) {
                return badRequest(res, "重置令牌已过期，请重新申请");
            }

            // Update password
            const passwordHash = await bcrypt.hash(newPassword, 10);
            await sql`UPDATE users SET password_hash = ${passwordHash} WHERE email = ${email}`;
            await sql`UPDATE reset_tokens SET used = TRUE WHERE token = ${token}`;

            return ok(res, { message: "密码重置成功，请使用新密码登录" });
        }

        return badRequest(res, "无效的 action，支持 request 或 confirm");
    } catch (e) {
        return serverError(res, e);
    }
}
