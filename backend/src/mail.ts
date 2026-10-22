import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { Config } from "./config.js";
export interface Mail {
  to: string;
  subject: string;
  text: string;
  kind: "verification" | "invitation" | "password-reset";
}
export type Mailer = (mail: Mail) => Promise<void>;
export function withAppLink(mail: Mail): Mail {
  const match = /#\/(verify|invite|reset)\/([A-Za-z0-9_-]{43})/.exec(mail.text);
  return match
    ? {
        ...mail,
        text:
          mail.text +
          "\n\n已安装同频 App，可打开：together://" +
          match[1] +
          "/" +
          match[2] +
          "\n也可以在 App 的「打开邀请/验证链接」中粘贴上面的完整链接。",
      }
    : mail;
}
export function createMailer(config: Config): Mailer {
  if (config.mailTransport === "file")
    return async (mail) => {
      const dir = join(config.dataDir, "mail");
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, `${Date.now()}-${randomUUID()}.json`),
        JSON.stringify(withAppLink(mail), null, 2),
        { encoding: "utf8", mode: 0o600 },
      );
    };
  const smtp = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    requireTLS: !config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPassword },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  return async (mail) => {
    const result = await smtp.sendMail({
      from: config.mailFrom,
      to: mail.to,
      subject: mail.subject,
      text: withAppLink(mail).text,
    });
    if (!result.accepted.length) throw Error("SMTP recipient rejected");
  };
}
