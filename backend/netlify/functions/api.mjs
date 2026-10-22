import { buildApp } from "../../dist/app.js";
import { proxyRequest } from "../../dist/netlify-handler.js";
let ready;
export default async function (request, context) {
  try {
    if (!process.env.DATABASE_URL || process.env.NODE_ENV !== "production")
      throw Error("Missing production configuration");
    if (!ready)
      ready = buildApp().catch((error) => {
        ready = undefined;
        throw error;
      });
    const { app } = await ready;
    return await proxyRequest(app, request, context.ip);
  } catch (error) {
    console.error("API startup failed", {
      name: error?.name,
      code: error?.code,
      moduleError:
        error?.code === "ERR_REQUIRE_ESM" ? error.message : undefined,
      esmCompatibility: process.env.NODE_OPTIONS?.includes(
        "--experimental-require-module",
      ),
      hasDatabase: !!process.env.DATABASE_URL,
      production: process.env.NODE_ENV === "production",
      hasOrigin: !!process.env.WEB_ORIGIN,
      hasMail: process.env.MAIL_TRANSPORT === "smtp",
    });
    return Response.json(
      { code: "SERVICE_UNAVAILABLE", message: "服务暂时不可用，请稍后重试" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
