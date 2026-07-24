import { getSql, ensureSchema, firstSqlRow } from "../_lib/db.js";
import { readJsonBody } from "../_lib/body.js";
import { ok, badRequest, methodNotAllowed, serverError, tooManyRequests } from "../_lib/response.js";
import { isRateLimited, getClientIp } from "../_lib/ratelimit.js";
import { csrfCheck } from "../_lib/csrf.js";
import { getUserFromRequest } from "../_lib/auth.js";
import crypto from "crypto";

function normalizeEmail(email: unknown) {
    return String(email || "").trim().toLowerCase();
}

function generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

type VerifyRow = {
    email: string;
    used: boolean;
    expires_at: string;
};

type UserVerifyRow = {
    id: unknown;
    email: string;
    email_verified: boolean;
};

export default async function handler(req: any, res: any) {
    if (req.method !== "POST") return methodNotAllowed(res, "POST");
    try {
        if (!csrfCheck(req)) {
            return ok(res, { message: "CSRF 验证失败" });
        }

        const ip = getClientIp(req);
        if (isRateLimited(`verify:${ip}`, 5)) {
            return tooManyRequests(res);
        }

        const body = await readJsonBody(req);
        const action = String(body.action || "send").toLowerCase();
        const email = normalizeEmail(body.email);

        if (!email || !email.includes("@")) {
            return badRequest(res, "邮箱格式不正确");
        }

        const sql = getSql();
        await ensureSchema(sql);

        // Ensure email_verifications table exists
        await sql`
            CREATE TABLE IF NOT EXISTS email_verifications (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
                used BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;

        // Ensure email_verified column exists on users table
        await sql`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE
        `;

        if (action === "send") {
            const rows = await sql`
                SELECT id, email, email_verified FROM users WHERE email = ${email} LIMIT 1
            `;
            const userRow = firstSqlRow<UserVerifyRow>(rows);
            if (!userRow) {
                return badRequest(res, "该邮箱未注册");
            }
            if (userRow.email_verified) {
                return ok(res, { message: "该邮箱已验证", verified: true });
            }

            // Invalidate old codes
            await sql`
                UPDATE email_verifications SET used = TRUE
                WHERE email = ${email} AND used = FALSE AND expires_at > NOW()
            `;

            const code = generateCode();
            await sql`
                INSERT INTO email_verifications (email, code)
                VALUES (${email}, ${code})
            `;

            // In production, send code via email. For development, return it directly.
            return ok(res, {
                message: "验证码已生成（开发环境直接返回，生产环境会通过邮件发送）",
                code,
            });
        }

        if (action === "confirm") {
            const code = String(body.code || "").trim();
            if (!code || code.length !== 6) return badRequest(res, "验证码为 6 位数字");

            const verifyRows = await sql`
                SELECT email, used, expires_at FROM email_verifications
                WHERE email = ${email} AND code = ${code} AND used = FALSE
                LIMIT 1
            `;
            const verifyRow = firstSqlRow<VerifyRow>(verifyRows);
            if (!verifyRow) return badRequest(res, "验证码无效或已过期");
            if (new Date(verifyRow.expires_at) < new Date()) {
                return badRequest(res, "验证码已过期，请重新获取");
            }

            await sql`
                UPDATE email_verifications SET used = TRUE
                WHERE email = ${email} AND code = ${code}
            `;
            await sql`
                UPDATE users SET email_verified = TRUE WHERE email = ${email}
            `;

            return ok(res, { message: "邮箱验证成功", verified: true });
        }

        return badRequest(res, "无效的 action，支持 send 或 confirm");
    } catch (e) {
        return serverError(res, e);
    }
}
