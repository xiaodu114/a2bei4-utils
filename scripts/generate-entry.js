#!/usr/bin/env node
/**
 * 扫描 src/source/*.js 文件，自动生成 src/temp/xxx-entry.js
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from 'node:url';

import { jsFileNames } from "./common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC = path.join(__dirname, "../src");
const TEMP_FOLDER = path.join(SRC, "temp");

//  1、重新创建 temp 文件夹：如果存在，则删除在创建
if (fs.existsSync(TEMP_FOLDER)) {
    fs.rmSync(TEMP_FOLDER, { recursive: true });
}
fs.mkdirSync(TEMP_FOLDER);

//  2、生成 entry 文件
jsFileNames.forEach((fileName) => {
    fs.writeFileSync(path.join(TEMP_FOLDER, `${fileName}-entry.js`), `export * from "../source/${fileName}.js";`);
});

console.log("[generate-entry] 已自动生成 src/temp/xxx-entry.js, 文件数：", jsFileNames.length);
