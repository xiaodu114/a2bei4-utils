#!/usr/bin/env node
/**
 * 自动生成 src/index.js
 * 扫描 src/temp/*-entry.js 的具名导出，拼出显式 export {} from ''
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = path.join(__dirname, "../src");
const TEMP_FOLDER = path.join(SRC, "temp");
const INDEX = path.join(SRC, "index.js");

if (fs.existsSync(INDEX)) {
    fs.rmSync(INDEX);
}

/* 1. 收集所有 *-entry.js 文件 */
const entryFiles = fs
    .readdirSync(TEMP_FOLDER)
    .filter((f) => f.endsWith("-entry.js"))
    .map((f) => path.join(TEMP_FOLDER, f));

/* 2. 正则提取 export 的名称 */
const exportRegex = /export\s+(?:const|let|var|function|class|async\s+function)\s+([\w$]+)/g;
const reExportRegex = /export\s*\*\s*from\s*['"]([^'"]+)['"]/g;
const reExportNamedRegex = /export\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"]/g;

const all = []; // [{ from: './common.js', names:['getDataType', ...] }, ...]

entryFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf-8");
    const from = "./source/" + path.basename(file).replace("-entry.js", ".js");

    const names = new Set();

    // 处理 export { a, b } from ''
    let m;
    while ((m = reExportNamedRegex.exec(content)) !== null) {
        m[1].split(",").forEach((n) => names.add(n.trim()));
    }

    // 处理 export * from ''  ——  需要再反向解析被重新导出的源文件
    while ((m = reExportRegex.exec(content)) !== null) {
        const realFile = path.join(TEMP_FOLDER, m[1]);
        if (fs.existsSync(realFile)) {
            const src = fs.readFileSync(realFile, "utf-8");
            let mm;
            while ((mm = exportRegex.exec(src)) !== null) {
                names.add(mm[1]);
            }
        }
    }

    if (names.size) all.push({ from, names: [...names].sort() });
});

/* 3. 拼出最终 index.js 内容 */
const head = `/**
 * @a2bei4/utils  ——  统一出口
 * 纯转发，零副作用，保证最佳 Tree-Shaking
 * 本文件由 scripts/generate-index.js 自动生成，请勿手动修改
 */
`;

const body = all.map(({ from, names }) => `export {\n  ${names.join(",\n  ")}\n} from "${from}";`).join("\n\n");

fs.writeFileSync(INDEX, head + body + "\n");
console.log("[generate-index] 已写入 src/index.js , 共导出模块数：", all.length);
