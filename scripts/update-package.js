import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { jsFileNames } from "./common.js";

const pkgPath = resolve(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
delete pkg.exports;

// 构造 exports 字段
const exportsMap = {
    ".": {
        types: "./types/index.d.ts",
        import: "./dist/a2bei4.utils.esm.js",
        require: "./dist/a2bei4.utils.cjs.js"
    }
};
jsFileNames.forEach((name) => {
    exportsMap[`./${name}`] = {
        types: `./types/${name}.d.ts`,
        import: `./dist/${name}.js`,
        require: `./dist/${name}.cjs`
    };
});

// 2. 构造新对象，按你想要的顺序手动拼
const ordered = {};
for (const key in pkg) {
    if (!Object.hasOwn(pkg, key)) continue;
    if (key === "types") {
        ordered[key] = pkg[key];
        ordered.exports = exportsMap;
    } else {
        ordered[key] = pkg[key];
    }
}
writeFileSync(pkgPath, JSON.stringify(ordered, null, 4) + "\n");
