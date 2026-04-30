import { copyFileSync, existsSync } from "node:fs";

const source = "dist/index.html";
const target = "dist/404.html";

if (existsSync(source)) {
  copyFileSync(source, target);
}