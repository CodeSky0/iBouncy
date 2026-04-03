import jwt from "jsonwebtoken";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";

const COOKIE_NAME = "ibouncy_token";

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        const err: any = new Error("Missing env JWT_SECRET");
        err.code = "MISSING_JWT_SECRET";
        throw err;
    }
    return secret;
}

export function signToken(payload: { userId: number; email: string }): string {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: "30d" });
}

function readTokenFromRequest(req: any): string | null {
    const header = req.headers && (req.headers.cookie || req.headers.Cookie);
    if (!header) return null;
    const cookies = parseCookie(Array.isArray(header) ? header.join(";") : header);
    return cookies[COOKIE_NAME] || null;
}

function verifyToken(token: string): any | null {
    try {
        return jwt.verify(token, getJwtSecret());
    } catch {
        return null;
    }
}

export function getUserFromRequest(req: any): { userId: number; email: string } | null {
    const token = readTokenFromRequest(req);
    if (!token) return null;
    const decoded = verifyToken(token);
    if (!decoded || typeof decoded !== "object") return null;
    const userId = (decoded as any).userId;
    const email = (decoded as any).email;
    if (!userId || !email) return null;
    return { userId: Number(userId), email: String(email) };
}

export function buildAuthCookie(token: string): string {
    const isProd = process.env.NODE_ENV === "production";
    return serializeCookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
    });
}

export function buildLogoutCookie(): string {
    const isProd = process.env.NODE_ENV === "production";
    return serializeCookie(COOKIE_NAME, "", {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
}

