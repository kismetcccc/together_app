import nodemailer from "nodemailer";

const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASSWORD?.trim();
if (!user || !/^[^\s@]+@qq\.com$/i.test(user) || !pass) {
  console.error(
    "请先在 backend/.env 填写 SMTP_USER（QQ 邮箱）和 SMTP_PASSWORD（SMTP 授权码）。",
  );
  process.exit(1);
}
const smtp = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.qq.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== "false",
  requireTLS: true,
  auth: { user, pass },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});
try {
  await smtp.verify();
  console.log(
    "SMTP 连接与认证成功（未发送邮件）。注册或重发验证邮件可测试真实投递。",
  );
  if (process.env.MAIL_TRANSPORT !== "smtp")
    console.log("请将 MAIL_TRANSPORT 改为 smtp，并重启后端使配置生效。");
} catch (error) {
  const code = error?.code;
  console.error(
    code === "EAUTH"
      ? "SMTP 认证失败：请确认已开启 SMTP 服务，并使用授权码而非 QQ 密码。"
      : "SMTP 连接失败：请检查服务器、端口、网络与邮箱服务状态。",
  );
  process.exitCode = 1;
} finally {
  smtp.close();
}
