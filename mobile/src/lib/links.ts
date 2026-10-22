export type MailLink = { kind: "verify" | "invite" | "reset"; token: string };
export function parseMailLink(input: string): MailLink | null {
  try {
    const url = new URL(input.trim());
    if (!["together:", "https:", "http:", "exp:"].includes(url.protocol))
      return null;
    const path =
      url.protocol === "together:"
        ? "/" + url.host + url.pathname
        : url.hash
          ? url.hash.slice(1)
          : url.pathname.replace(/^\/--/, "");
    const match = /^\/(verify|invite|reset)\/([A-Za-z0-9_-]{43})\/?$/.exec(
      path,
    );
    return match
      ? { kind: match[1] as MailLink["kind"], token: match[2] }
      : null;
  } catch {
    return null;
  }
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function daysUntil(value: string, now = new Date()) {
  const day = new Date(value + "T12:00:00");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((day.getTime() - today.getTime()) / 86400000);
}
export const categories = ["情侣", "好友", "旅行", "日常"] as const;
