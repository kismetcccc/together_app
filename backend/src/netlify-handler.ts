import type { FastifyInstance, InjectOptions } from "fastify";

export async function proxyRequest(
  app: FastifyInstance,
  request: Request,
  ip: string,
) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/\.netlify\/functions\/api/, "");
  if (!path.startsWith("/api/v1/"))
    return new Response("Not found", { status: 404 });
  const method = request.method;
  if (
    !["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"].includes(
      method,
    )
  )
    return new Response("Method not allowed", { status: 405 });
  const payload = ["GET", "HEAD"].includes(method)
    ? undefined
    : Buffer.from(await request.arrayBuffer());
  if (payload && payload.length > 4500000)
    return Response.json(
      { message: "单次上传过大，请分开上传照片" },
      { status: 413 },
    );
  const headers = Object.fromEntries(request.headers);
  delete headers["content-length"];
  delete headers["transfer-encoding"];
  const response = await app.inject({
    method: method as InjectOptions["method"],
    url: path + url.search,
    headers,
    payload,
    remoteAddress: ip || "unknown",
  });
  const output = new Headers();
  for (const [key, value] of Object.entries(response.headers)) {
    if (
      value === undefined ||
      ["content-length", "transfer-encoding", "connection"].includes(
        key.toLowerCase(),
      )
    )
      continue;
    for (const item of Array.isArray(value) ? value : [value])
      output.append(key, String(item));
  }
  return new Response(
    method === "HEAD" || response.statusCode === 204
      ? null
      : new Uint8Array(response.rawPayload),
    { status: response.statusCode, headers: output },
  );
}
