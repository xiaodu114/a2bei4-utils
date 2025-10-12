//#region 数据类型判断

/**
 * 返回任意值的运行时类型字符串（小写形式）。
 * 
 * @param {*} obj 待检测的值
 * @returns {keyof globalThis|"blob"|"file"|"formdata"|string} 小写类型名
 */
export function getDataType(obj) {
    return Object.prototype.toString
        .call(obj)
        .replace(/^\[object\s(\w+)\]$/, "$1")
        .toLowerCase();
}

/**
 * 判断值是否为原生 Blob（含 File）。
 * 
 * @param {*} obj - 待检测的值
 * @returns {obj is Blob}
 */
export function isBlob(obj) {
    return getDataType(obj) === "blob";
}

/**
 * 判断值是否为**纯粹**的 Object（即 `{}` 或 `new Object()`，不含数组、null、自定义类等）。
 * 
 * @param {*} obj - 待检测的值
 * @returns {obj is Record<PropertyKey, any>}
 */
export function isPlainObject(obj) {
    return getDataType(obj) === "object";
}

/**
 * 判断值是否为 Promise（含 Promise 子类）。
 * 
 * @param {*} obj - 待检测的值
 * @returns {obj is Promise<any>}
 */
export function isPromise(obj) {
    return getDataType(obj) === "promise";
}

/**
 * 判断值是否为合法 Date 对象（含 Invalid Date 返回 false）。
 *
 * @param {*} t - 待检测值
 * @returns {t is Date}
 */
export function isDate(t) {
    return getDataType(t) === "date";
}

/**
 * 判断值是否为函数（含异步函数、生成器函数、类）。
 * 
 * @param {*} obj - 待检测的值
 * @returns {obj is Function}
 */
export function isFunction(obj) {
    return typeof obj === "function";
}

/**
 * 判断值是否为**非空**字符串。
 * 
 * @param {*} obj - 待检测的值
 * @returns {obj is string}
 */
export function isNonEmptyString(obj) {
    return getDataType(obj) === "string" && obj.length > 0;
}

//#endregion

//#region 随机数据

/**
 * 在闭区间 [min, max] 内生成一个均匀分布的随机整数。
 * 若 min > max 则自动交换。
 *
 * @param {number} min - 整数下界（包含）
 * @param {number} max - 整数上界（包含）
 * @returns {number}
 * @throws {TypeError} 当 min 或 max 不是整数时抛出
 */
export function randomIntInRange(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
        throw new TypeError("Arguments must be integers");
    }
    if (min > max) [min, max] = [max, min];
    // 注意加 1，否则 max 永远取不到；Math.floor 保证均匀
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 随机生成一个汉字（可控制范围）。
 *
 * @param {boolean} [base=true]  - 是否启用基本区（0x4E00-0x9FA5）
 * @param {boolean} [extA=false] - 是否启用扩展 A 区（0x3400-0x4DBF）
 * @param {boolean} [extBH=false] - 是否启用扩展 B~H 区（0x20000-0x2EBEF，代理对）
 * @returns {string} 单个汉字字符
 * @throws {RangeError} 未启用任何区段时抛出
 */
export function randomHan(base = true, extA = false, extBH = false) {
    // 1. 收集已启用的“区段”
    const ranges = [];
    if (base) ranges.push({ min: 0x4e00, max: 0x9fa5, surrogate: false });
    if (extA) ranges.push({ min: 0x3400, max: 0x4dbf, surrogate: false });
    if (extBH) ranges.push({ min: 0x20000, max: 0x2ebef, surrogate: true });

    if (ranges.length === 0) {
        throw new RangeError("At least one range must be enabled");
    }

    // 2. 按总码位数抽号
    const total = ranges.reduce((sum, r) => sum + (r.max - r.min + 1), 0);
    let n = randomIntInRange(0, total - 1);

    // 3. 定位落在哪个区段
    for (const { min, max, surrogate } of ranges) {
        const size = max - min + 1;
        if (n < size) {
            const code = min + n;
            if (!surrogate) return String.fromCharCode(code);
            // 代理对
            const offset = code - 0x10000;
            const hi = (offset >> 10) + 0xd800;
            const lo = (offset & 0x3ff) + 0xdc00;
            return String.fromCharCode(hi, lo);
        }
        n -= size;
    }
}

/**
 * 随机生成一个英文字母。
 *
 * @param {'lower'|'upper'} [type] - 指定大小写；留空则随机
 * @returns {string} 单个字母
 */
export function randomEnLetter(type) {
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomNum = randomIntInRange(0, 25);

    switch (type) {
        case "lower":
            return lower[randomNum];
        case "upper":
            return upper[randomNum];
        default:
            return (Math.random() < 0.5 ? lower : upper)[randomNum];
    }
}

/**
 * 生成指定长度的随机“中英混合”字符串。
 *
 * @param {number} [len=1] - 目标长度（≥1，自动取整）
 * @param {number} [zhProb=0.5] - 每个位置选择汉字的概率，默认 0.5
 * @returns {string}
 */
export function randomHanOrEn(len, zhProb = 0.5) {
    len = Math.max(1, Math.floor(len));
    const buf = [];
    for (let i = 0; i < len; i++) {
        buf.push(Math.random() < zhProb ? randomHan() : randomEnLetter());
    }
    return buf.join("");
}

//#endregion

//#region 防抖节流

/**
 * 创建 debounced（防抖）函数。
 * - 默认 trailing 触发；当 `leading=true` 时，首次调用或超过等待间隔会立即执行。
 * - 支持手动取消。
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn - 要防抖的原始函数
 * @param {number} wait - 防抖等待时间（毫秒）
 * @param {boolean} [leading=false] - 是否启用立即执行（leading edge）
 * @returns {T & { cancel(): void }} 返回经过防抖包装的函数，并附带 `cancel` 方法
 * @throws {TypeError} 当 `fn` 不是函数时抛出
 */
export function debounce(fn, wait, leading = false) {
    if (typeof fn !== "function") throw new TypeError("fn must be function");
    wait = Math.max(0, Number(wait) || 0);
    let timeoutId;
    let lastCall = 0; // 0 表示从未调用过

    function debounced(...args) {
        const isFirst = lastCall === 0;
        const isOverWait = Date.now() - lastCall >= wait;

        clearTimeout(timeoutId);

        // 首次调用 || 已达到等待间隔
        if (leading && (isFirst || isOverWait)) {
            lastCall = Date.now();
            return fn.apply(this, args);
        }

        timeoutId = setTimeout(() => {
            lastCall = Date.now();
            fn.apply(this, args);
        }, wait);
    }

    debounced.cancel = () => {
        clearTimeout(timeoutId);
        lastCall = 0; // 恢复初始状态
    };

    return debounced;
}

/**
 * 创建 throttled（节流）函数。
 * 支持 leading/trailing 边缘触发，可手动取消。
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn - 要节流的原始函数
 * @param {number} wait - 节流间隔（毫秒）
 * @param {object} [options] - 配置项
 * @param {boolean} [options.leading=true] - 是否在 leading 边缘执行
 * @param {boolean} [options.trailing=true] - 是否在 trailing 边缘执行
 * @returns {T & { cancel(): void }} 返回经过节流包装的函数，并附带 `cancel` 方法
 * @throws {TypeError} 当 `fn` 不是函数时抛出
 */
export function throttle(fn, wait, { leading = true, trailing = true } = {}) {
    if (typeof fn !== "function") throw new TypeError("fn must be function");
    wait = Math.max(0, Number(wait) || 0);

    let timeoutId = null,
        lastCall = 0;

    function throttled(...args) {
        const remaining = wait - (Date.now() - lastCall);

        if (leading && (lastCall === 0 || remaining <= 0)) {
            lastCall = Date.now();
            fn.apply(this, args);
        } else if (trailing && !timeoutId) {
            timeoutId = setTimeout(
                () => {
                    timeoutId = null;
                    lastCall = Date.now();
                    fn.apply(this, args);
                },
                remaining > 0 ? remaining : wait
            );
        }
    }

    throttled.cancel = () => {
        clearTimeout(timeoutId);
        timeoutId = null;
        lastCall = 0;
    };

    return throttled;
}

//#endregion

/**
 * 利用 JSON 序列化/反序列化实现**深拷贝**。
 * 注意：会丢失 `undefined`、函数、循环引用、特殊包装对象等。
 *
 * @template T
 * @param {T} obj - 待拷贝的 JSON 兼容值
 * @returns {T} 深拷贝后的值
 */
export function deepCloneByJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * **安全**地将源对象中**已存在**的属性赋值到目标对象。
 * 不会新增键，也不会复制原型链上的属性。
 *
 * @template {Record<PropertyKey, any>} T
 * @param {T} target - 目标对象（将被就地修改）
 * @param {...Partial<T>} sources - 一个或多个源对象
 * @returns {T} 修改后的目标对象（即第一个参数本身）
 *
 * @example
 * const defaults = { a: 1, b: 2 };
 * assignExisting(defaults, { a: 9, c: 99 }); // defaults 变为 { a: 9, b: 2 }
 */
export function assignExisting(target, ...sources) {
    sources.forEach((source) => {
        Object.keys(source).forEach((key) => {
            if (target.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        });
    });
    return target;
}

/**
 * 提取任意函数（含箭头函数、普通函数、async、class 构造器）的形参名称列表。
 * 通过源码正则解析，不支持解构参数、默认参数、剩余参数等复杂语法；
 * 若出现上述场景将返回空数组或部分名称。
 *
 * @param {Function} fn - 目标函数
 * @returns {string[]} 按声明顺序排列的参数名数组；解析失败时返回空数组
 *
 * @example
 * getFunctionArgNames(function (a, b) {})        // ["a", "b"]
 * getFunctionArgNames((foo, bar) => {})          // ["foo", "bar"]
 * getFunctionArgNames(async function x({a} = {}) {}) // [] （解构无法识别）
 */
export function getFunctionArgNames(fn) {
    const FN_ARG_SPLIT = /,/,
        FN_ARG = /^\s*(_?)(\S+?)\1\s*$/,
        FN_ARGS = /^[^(]*\(\s*([^)]*)\)/m,
        ARROW_ARG = /^([^(]+?)=>/,
        STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;

    const fnText = Function.prototype.toString.call(fn).replace(STRIP_COMMENTS, "");
    const argDecl = fnText.match(ARROW_ARG) || fnText.match(FN_ARGS);
    const retArgNames = [];
    [].forEach.call(argDecl[1].split(FN_ARG_SPLIT), function (arg) {
        arg.replace(FN_ARG, function (all, underscore, name) {
            retArgNames.push(name);
        });
    });
    return retArgNames;
}

/**
 * 将 Blob（或 File）读取为文本，并可选择自动执行 `JSON.parse`。
 * 当 `isParse=true` 且内容非法 JSON 时，会回退为返回原始文本。
 *
 * @param {Blob} blob - 待读取的 Blob/File 对象
 * @param {boolean} [isParse=true] - 是否尝试将结果按 JSON 解析
 * @returns {Promise<string | any>} 解析后的 JSON 对象或原始文本
 *
 * @example
 * const json = await readBlobAsText(blob);        // 自动 JSON.parse
 * const text = await readBlobAsText(blob, false); // 仅返回文本
 */
export function readBlobAsText(blob, isParse = true) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const result = evt.target.result;
            if (isParse) {
                try {
                    resolve(JSON.parse(result));
                } catch (error) {
                    console.error(error);
                    resolve(result);
                }
            } else {
                resolve(result);
            }
        };
        reader.onerror = reject;
        reader.readAsText(blob);
    });
}
