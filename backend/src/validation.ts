import { z } from "zod";
export const qqEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(100)
  .email()
  .regex(/^[a-z0-9._-]+@qq\.com$/, "请使用 @qq.com QQ 邮箱");
export const password = z
  .string()
  .min(10, "密码至少 10 位")
  .max(128, "密码最多 128 位");
export const tokenBody = z
  .object({ token: z.string().regex(/^[\w-]{43}$/) })
  .strict();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "日期无效",
  );
export const draft = z.object({
  title: z.string().trim().min(1).max(40),
  description: z.string().max(120),
  category: z.enum(["情侣", "好友", "旅行", "日常"]),
});
export const version = z.number().int().positive();
