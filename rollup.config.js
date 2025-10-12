//#region babel 相关

//  pnpm i @babel/core  @rollup/plugin-babel
// import { babel } from "@rollup/plugin-babel";

//#endregion

import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import filesize from "rollup-plugin-filesize";
import dts from "rollup-plugin-dts";

import { jsFileNames } from "./scripts/common.js";

const name = "a2bei4Utils";
const input = "src/index.js";

const external = [];
const globals = {};

const plugins = () => [
    nodeResolve({ browser: true }),
    commonjs(),
    // babel({
    //     babelHelpers: "bundled",
    //     exclude: "node_modules/**",
    //     extensions: [".js"]
    // }),
    filesize()
];

/* 1. 主包多格式 */
const mainConfigs = [
    { format: "es", minify: false, suffix: "esm" },
    { format: "es", minify: true, suffix: "esm.min" },
    { format: "cjs", minify: false, suffix: "cjs" },
    { format: "cjs", minify: true, suffix: "cjs.min" },
    { format: "umd", minify: false, suffix: "umd", name },
    { format: "umd", minify: true, suffix: "umd.min", name }
].map(({ format, minify, suffix, name: n }) => ({
    input,
    external,
    output: {
        file: `dist/a2bei4.utils.${suffix}.js`,
        format,
        name: n,
        sourcemap: true,
        globals
    },
    plugins: [...plugins(), ...(minify ? [terser()] : [])]
}));

/* 2. 子路径出口（esm + cjs） */
const subEntries = jsFileNames;
const subConfigs = subEntries.flatMap((sub) => {
    const inp = `src/temp/${sub}-entry.js`;
    return [
        {
            input: inp,
            output: { file: `dist/${sub}.js`, format: "es", sourcemap: true },
            plugins: plugins(),
            external
        },
        {
            input: inp,
            output: { file: `dist/${sub}.cjs`, format: "cjs", sourcemap: true },
            plugins: plugins(),
            external
        }
    ];
});

/* 3. 类型声明打包 */
const typeConfigs = [
    { entry: "src/index.js", file: "types/index.d.ts" },
    ...subEntries.map((sub) => ({
        entry: `src/temp/${sub}-entry.js`,
        file: `types/${sub}.d.ts`
    }))
].map(({ entry, file }) => ({
    input: entry,
    output: { file, format: "es" },
    plugins: [dts()]
}));

export default [...mainConfigs, ...subConfigs, ...typeConfigs];
