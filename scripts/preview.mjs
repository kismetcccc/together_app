import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("mobile/dist");
http
  .createServer(async (req, res) => {
    try {
      const path = resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
      );
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403);
        return res.end();
      }
      const file = extname(path) ? path : resolve(root, "index.html");
      const body = await readFile(file);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript",
          ".json": "application/json",
          ".png": "image/png",
          ".svg": "image/svg+xml",
        }[extname(file)] || "application/octet-stream",
      );
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(8082, "127.0.0.1", () =>
    console.log("Local RN Web QA preview: http://localhost:8082"),
  );
