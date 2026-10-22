import { buildApp } from "./app.js";
const { app } = await buildApp();
await app.listen({
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 8080),
});
console.log(`Together API: ${app.listeningOrigin}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
