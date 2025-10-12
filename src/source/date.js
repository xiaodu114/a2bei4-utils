/**
 * 将任意值安全转换为 Date 对象。
 * - 数字／数字字符串：视为时间戳
 * - 字符串：尝试按 ISO/RFC 格式解析
 * - 对象：优先 valueOf()，再 toString()
 * - null / undefined / 无效值：返回 null
 *
 * @param {*} val - 待转换值
 * @returns {Date | null} 有效 Date 或 null
 */
export function toDate(val) {
    if (val == null) return null; // null / undefined
    if (val instanceof Date) return isNaN(val) ? null : val; // 已是 Date，但需排除 Invalid Date

    // 1. 数字或数字字符串 → 时间戳
    if (typeof val === "number" || (typeof val === "string" && /^-?\d+(\.\d+)?$/.test(val.trim()))) {
        const d = new Date(+val);
        return isNaN(d) ? null : d;
    }

    // 2. 标准 ISO 8601 / RFC 2825 等合法字符串
    if (typeof val === "string") {
        const d = new Date(val);
        return isNaN(d) ? null : d; // 非法格式返回 null
    }

    // 3. 对象带 valueOf / toString
    if (typeof val === "object") {
        // 优先调用 valueOf（期望返回数字时间戳）
        const prim = val.valueOf ? val.valueOf() : Object.prototype.valueOf.call(val);
        if (typeof prim === "number" && !isNaN(prim)) {
            const d = new Date(prim);
            return isNaN(d) ? null : d;
        }
        // 兜底用字符串
        const str = val.toString ? val.toString() : String(val);
        const d = new Date(str);
        return isNaN(d) ? null : d;
    }

    // 4. 其余情况
    return null;
}

/**
 * 在闭区间 [date1, date2] 内随机生成一个日期（含首尾）。
 * 若顺序相反则自动交换。
 *
 * @param {Date} date1 - 起始日期
 * @param {Date} date2 - 结束日期
 * @returns {Date} 随机日期
 */
export function randomDateInRange(date1, date2) {
    let v1 = date1.getTime(),
        v2 = date2.getTime();
    if (v1 > v2) [v1, v2] = [v2, v1];
    return new Date(v1 + Math.floor(Math.random() * (v2 - v1 + 1)));
}

/**
 * 计算两个时间之间的剩余/已过时长（天-时-分-秒），返回带补零的展示对象。
 *
 * @param {string|number|Date} originalTime - 原始时间（可转 Date 的任意值）
 * @param {Date} [currentTime=new Date()] - 基准时间，默认当前
 * @returns {{days:number,hours:string,minutes:string,seconds:string}}
 */
export function calcTimeDifference(originalTime, currentTime = new Date()) {
    // 计算时间差（毫秒）
    const diffMs = currentTime - new Date(originalTime);

    // 转换为天、小时、分钟、秒
    const diffSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(diffSeconds / (3600 * 24));
    const hours = Math.floor((diffSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    const padZero = (num) => String(num).padStart(2, "0");

    return {
        days,
        hours: padZero(hours),
        minutes: padZero(minutes),
        seconds: padZero(seconds)
    };
}

/**
 * 将总秒数格式化成人类可读的时间段文本。
 * 固定进制：1 年=365 天，1 月=30 天。
 *
 * @param {number} totalSeconds - 非负总秒数
 * @param {object} [options] - 格式化选项
 * @param {Partial<{year:string,month:string,day:string,hour:string,minute:string,second:string}>} [options.labels] - 各单位的自定义文本
 * @param {('year'|'month'|'day'|'hour'|'minute'|'second')} [options.maxUnit] - 最大输出单位
 * @param {('year'|'month'|'day'|'hour'|'minute'|'second')} [options.minUnit] - 最小输出单位
 * @param {boolean} [options.showZero] - 是否强制显示 0 秒
 * @returns {string} 拼接后的时长文本，如“1天 02小时 30分钟”
 * @throws {TypeError} 当 totalSeconds 为非数字或负数时抛出
 */
export function formatDuration(totalSeconds, options = {}) {
    if (typeof totalSeconds !== "number" || totalSeconds < 0 || !isFinite(totalSeconds)) {
        throw new TypeError("totalSeconds 必须是非负数字");
    }

    // 1. 默认中文单位
    const DEFAULT_LABELS = {
        year: "年",
        month: "月",
        day: "天",
        hour: "小时",
        minute: "分钟",
        second: "秒"
    };

    // 2. 固定进制表（秒）
    const UNIT_TABLE = [
        { key: "year", seconds: 365 * 24 * 3600 },
        { key: "month", seconds: 30 * 24 * 3600 },
        { key: "day", seconds: 24 * 3600 },
        { key: "hour", seconds: 3600 },
        { key: "minute", seconds: 60 },
        { key: "second", seconds: 1 }
    ];

    // 3. 合并用户自定义文本
    const labels = Object.assign({}, DEFAULT_LABELS, options.labels);

    // 4. 根据 maxUnit / minUnit 截取
    let start = 0,
        end = UNIT_TABLE.length;
    if (options.maxUnit) {
        const idx = UNIT_TABLE.findIndex((u) => u.key === options.maxUnit);
        if (idx !== -1) start = idx;
    }
    if (options.minUnit) {
        const idx = UNIT_TABLE.findIndex((u) => u.key === options.minUnit);
        if (idx !== -1) end = idx + 1;
    }
    const units = UNIT_TABLE.slice(start, end);
    if (!units.length) units.push(UNIT_TABLE[UNIT_TABLE.length - 1]); // 保底秒

    // 5. 逐级计算
    let rest = Math.floor(totalSeconds);
    const parts = [];

    for (const { key, seconds } of units) {
        const val = Math.floor(rest / seconds);
        rest %= seconds;

        const shouldShow = val > 0 || (options.showZero && key === "second");
        if (shouldShow || (parts.length === 0 && rest === 0)) {
            parts.push(`${val}${labels[key]}`);
        }
    }

    // 6. 兜底
    if (parts.length === 0) {
        parts.push(`0${labels[units[units.length - 1].key]}`);
    }

    return parts.join("");
}

/**
 * 快捷调用 {@link formatDuration}，最大单位到“天”。
 *
 * @param {number} totalSeconds
 * @param {Omit<Parameters<typeof formatDuration>[1],'maxUnit'>} [options]
 * @returns {string}
 */
export function formatDurationMaxDay(totalSeconds, options = {}) {
    return formatDuration(totalSeconds, { ...options, maxUnit: "day" });
}

/**
 * 快捷调用 {@link formatDuration}，最大单位到“小时”。
 *
 * @param {number} totalSeconds
 * @param {Omit<Parameters<typeof formatDuration>[1],'maxUnit'>} [options]
 * @returns {string}
 */
export function formatDurationMaxHour(totalSeconds, options = {}) {
    return formatDuration(totalSeconds, { ...options, maxUnit: "hour" });
}
