import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const dir = resolve(process.env.DATA_DIR || ".data", "mail");
const email = process.argv[2];
try {
  for (const file of (await readdir(dir)).sort().slice(-30)) {
    const mail = JSON.parse(await readFile(join(dir, file), "utf8"));
    if (!email || mail.to === email)
      console.log(`\nTo: ${mail.to}\n${mail.subject}\n${mail.text}\n`);
  }
} catch (error) {
  if (error.code === "ENOENT") console.log("开发收件箱暂时为空。");
  else throw error;
}
