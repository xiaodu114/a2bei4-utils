import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = path.join(__dirname, "../src");
const SRC_SOURCE = path.join(SRC, "source");

const jsFileNames = fs
    .readdirSync(SRC_SOURCE)
    .filter((f) => f.endsWith(".js")).map((f) => f.replace(".js", ""));
    
export { jsFileNames };