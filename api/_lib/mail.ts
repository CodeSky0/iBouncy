/**
 * 邮件发送模块。
 * 使用 nodemailer，从环境变量读取 SMTP 配置。
 *
 * 需要的环境变量：
 *   SMTP_HOST  - SMTP 服务器地址
 *   SMTP_PORT  - SMTP 端口（默认 587）
 *   SMTP_USER  - SMTP 用户名
 *   SMTP_PASS  - SMTP 密码
 *   SMTP_FROM  - 发件人地址（可选，默认同 SMTP_USER）
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        const err: any = new Error("SMTP 未配置（缺少 SMTP_HOST / SMTP_USER / SMTP_PASS 环境变量）");
        err.code = "MISSING_SMTP_CONFIG";
        throw err;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });

    return transporter;
}

export function smtpConfigured(): boolean {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
    const t = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || "";
    await t.sendMail({ from, to, subject, html });
}

/**
 * 发送邮箱验证码。
 * @param to 收件人邮箱
 * @param code 6 位数字验证码
 */
export async function sendVerificationCode(to: string, code: string): Promise<void> {
    const subject = "iBouncy — 邮箱验证码";
    const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #20A8D7;">iBouncy 邮箱验证</h2>
            <p>您正在注册 iBouncy 账号，以下是您的验证码：</p>
            <div style="
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                color: #20A8D7;
                background: #F0F9FF;
                padding: 16px 24px;
                border-radius: 8px;
                text-align: center;
                margin: 16px 0;
            ">${code}</div>
            <p style="color: #777;">验证码 10 分钟内有效，请勿转发给他人。</p>
            <hr style="border: none; border-top: 1px solid #EEE; margin: 24px 0;">
            <p style="color: #AAA; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
        </div>
    `;
    await sendMail(to, subject, html);
}

/**
 * 发送密码重置验证码。
 * @param to 收件人邮箱
 * @param code 6 位数字验证码
 */
export async function sendPasswordResetCode(to: string, code: string): Promise<void> {
    const subject = "iBouncy — 密码重置验证码";
    const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #20A8D7;">iBouncy 密码重置</h2>
            <p>您正在请求重置 iBouncy 账号密码，以下是您的验证码：</p>
            <div style="
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                color: #E85B5B;
                background: #FFF5F5;
                padding: 16px 24px;
                border-radius: 8px;
                text-align: center;
                margin: 16px 0;
            ">${code}</div>
            <p style="color: #777;">验证码 10 分钟内有效，如非本人操作请忽略此邮件。</p>
            <hr style="border: none; border-top: 1px solid #EEE; margin: 24px 0;">
            <p style="color: #AAA; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
        </div>
    `;
    await sendMail(to, subject, html);
}
