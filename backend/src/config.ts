import { resolve } from "node:path";
export interface Config {
  dataDir: string;
  origin: string;
  production: boolean;
  mailTransport: "file" | "smtp";
  mailFrom: string;
  smtpHost?: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  rateLimit: boolean;
}
export function loadConfig(): Config {
  const production = process.env.NODE_ENV === "production";
  const origin = process.env.WEB_ORIGIN || "http://127.0.0.1:5173";
  if (new URL(origin).origin !== origin)
    throw Error("WEB_ORIGIN must be an origin without a trailing slash");
  const mailTransport = process.env.MAIL_TRANSPORT || "file";
  if (mailTransport !== "file" && mailTransport !== "smtp")
    throw Error("MAIL_TRANSPORT must be file or smtp");
  if (
    production &&
    (new URL(origin).protocol !== "https:" || mailTransport !== "smtp")
  )
    throw Error("Production requires HTTPS WEB_ORIGIN and SMTP");
  if (
    mailTransport === "smtp" &&
    (!process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASSWORD)
  )
    throw Error("SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required");
  return {
    dataDir: resolve(process.env.DATA_DIR || ".data"),
    origin,
    production,
    mailTransport,
    mailFrom:
      process.env.MAIL_FROM ||
      (mailTransport === "smtp"
        ? `Together <${process.env.SMTP_USER}>`
        : "Together <noreply@example.com>"),
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpSecure: process.env.SMTP_SECURE === "true",
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    rateLimit: true,
  };
}
