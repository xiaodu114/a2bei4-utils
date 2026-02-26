function getLocales_TimePeriod() {
    return {
        earlyMorning: "凌晨",
        morning: "上午",
        noon: "中午",
        afternoon: "下午",
        evening: "晚上"
    };
}

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

//#region   持续时间相关

/**
 * 时间持续对象（完整版本，包含年月日时分秒毫秒）
 * @typedef {Object} DurationObject
 * @property {number} years - 年数
 * @property {number} months - 月数（0-11）
 * @property {number} days - 天数（0-29，取决于 monthDays）
 * @property {number} hours - 小时数（0-23）
 * @property {number} minutes - 分钟数（0-59）
 * @property {number} seconds - 秒数（0-59）
 * @property {number} milliseconds - 毫秒数（0-999）
 */

/**
 * 时间持续对象（最大单位为天）
 * @typedef {Object} DurationMaxDayObject
 * @property {number} days - 天数
 * @property {number} hours - 小时数（0-23）
 * @property {number} minutes - 分钟数（0-59）
 * @property {number} seconds - 秒数（0-59）
 * @property {number} milliseconds - 毫秒数（0-999）
 */

/**
 * 时间持续对象（最大单位为小时）
 * @typedef {Object} DurationMaxHourObject
 * @property {number} hours - 小时数
 * @property {number} minutes - 分钟数（0-59）
 * @property {number} seconds - 秒数（0-59）
 * @property {number} milliseconds - 毫秒数（0-999）
 */

/**
 * 将毫秒转换为时间持续对象。
 *
 * @param {number} milliseconds - 毫秒数（非负整数）
 * @param {Object} [options] - 选项对象。
 * @param {number} [options.yearDays=365] - 一年的天数。
 * @param {number} [options.monthDays=30] - 一月的天数。
 * @returns {DurationObject} 时间持续对象
 * @throws {TypeError} 当 milliseconds 不是有效数字
 * @throws {RangeError} 当 milliseconds 为负数
 * @throws {RangeError} 当 yearDays 或 monthDays 不是正整数
 *
 * @example
 * // 基本用法
 * millisecond2Duration(42070000500);
 * // 返回: { years: 1, months: 4, days: 1, hours: 22, minutes: 6, seconds: 40, milliseconds: 500 }
 */
export function millisecond2Duration(milliseconds, options = { yearDays: 365, monthDays: 30 }) {
    // 参数验证
    if (typeof milliseconds !== "number" || isNaN(milliseconds)) {
        throw new TypeError("milliseconds must be a valid number");
    }
    if (milliseconds < 0) {
        throw new RangeError("milliseconds must be a non-negative number");
    }

    // 默认选项
    const { yearDays = 365, monthDays = 30 } = options;

    // 选项验证
    if (!Number.isInteger(yearDays) || yearDays <= 0) {
        throw new RangeError("yearDays must be a positive integer");
    }
    if (!Number.isInteger(monthDays) || monthDays <= 0) {
        throw new RangeError("monthDays must be a positive integer");
    }

    const totalMilliseconds = Math.floor(milliseconds);
    const ms = totalMilliseconds % 1000;
    const diffSeconds = Math.floor(totalMilliseconds / 1000);

    const seconds = diffSeconds % 60;
    const minutes = Math.floor(diffSeconds / 60) % 60;
    const hours = Math.floor(diffSeconds / 3600) % 24;

    // 计算年、月、日
    const totalDays = Math.floor(diffSeconds / 3600 / 24);
    const years = Math.floor(totalDays / yearDays);
    const remainingDays = totalDays % yearDays;
    const months = Math.floor(remainingDays / monthDays);
    const days = remainingDays % monthDays;

    return { years, months, days, hours, minutes, seconds, milliseconds: ms };
}

/**
 * 将毫秒转换为时间持续对象（最大单位为天）。
 * @param {number} milliseconds - 毫秒数（非负整数）
 * @returns {DurationMaxDayObject} 包含天、小时、分钟、秒、毫秒的时间持续对象
 * @throws {TypeError} 当 milliseconds 不是有效数字时抛出
 * @throws {RangeError} 当 milliseconds 为负数时抛出
 * @example
 * // 返回 { days: 486, hours: 22, minutes: 6, seconds: 40, milliseconds: 500 }
 * millisecond2DurationMaxDay(42070000500);
 */
export function millisecond2DurationMaxDay(milliseconds) {
    if (typeof milliseconds !== "number" || isNaN(milliseconds)) {
        throw new TypeError("milliseconds must be a valid number");
    }
    if (milliseconds < 0) {
        throw new RangeError("milliseconds must be a non-negative number");
    }

    const totalMilliseconds = Math.floor(milliseconds);
    const ms = totalMilliseconds % 1000;
    const diffSeconds = Math.floor(totalMilliseconds / 1000);

    const seconds = diffSeconds % 60;
    const minutes = Math.floor(diffSeconds / 60) % 60;
    const hours = Math.floor(diffSeconds / 3600) % 24;
    const days = Math.floor(diffSeconds / 3600 / 24);

    return { days, hours, minutes, seconds, milliseconds: ms };
}

/**
 * 将毫秒转换为时间持续对象（最大单位为小时）。
 * @param {number} milliseconds - 毫秒数（非负整数）
 * @returns {DurationMaxHourObject} 包含小时、分钟、秒、毫秒的时间持续对象
 * @throws {TypeError} 当 milliseconds 不是有效数字时抛出
 * @throws {RangeError} 当 milliseconds 为负数时抛出
 * @example
 * // 返回 { hours: 11686, minutes: 6, seconds: 40, milliseconds: 500 }
 * millisecond2DurationMaxHour(42070000500);
 */
export function millisecond2DurationMaxHour(milliseconds) {
    if (typeof milliseconds !== "number" || isNaN(milliseconds)) {
        throw new TypeError("milliseconds must be a valid number");
    }
    if (milliseconds < 0) {
        throw new RangeError("milliseconds must be a non-negative number");
    }

    const totalMilliseconds = Math.floor(milliseconds);
    const ms = totalMilliseconds % 1000;
    const diffSeconds = Math.floor(totalMilliseconds / 1000);

    const seconds = diffSeconds % 60;
    const minutes = Math.floor(diffSeconds / 60) % 60;
    const hours = Math.floor(diffSeconds / 3600);

    return { hours, minutes, seconds, milliseconds: ms };
}

/**
 * 将秒转换为时间持续对象。
 *
 * @param {number} seconds - 秒数（非负整数）
 * @param {Object} [options] - 选项对象。
 * @param {number} [options.yearDays=365] - 一年的天数。
 * @param {number} [options.monthDays=30] - 一月的天数。
 * @returns {DurationObject} 时间持续对象
 * @throws {TypeError} 当 seconds 不是有效数字
 * @throws {RangeError} 当 seconds 为负数
 * @throws {RangeError} 当 yearDays 或 monthDays 不是正整数
 *
 * @example
 * // 基本用法
 * second2Duration(42070000.5);
 * // 返回: { years: 1, months: 4, days: 1, hours: 22, minutes: 6, seconds: 40, milliseconds: 500 }
 */
export function second2Duration(seconds, options = { yearDays: 365, monthDays: 30 }) {
    if (typeof seconds !== "number" || isNaN(seconds)) {
        throw new TypeError("seconds must be a valid number");
    }
    if (seconds < 0) {
        throw new RangeError("seconds must be a non-negative number");
    }
    return millisecond2Duration(seconds * 1000, options);
}

/**
 * 将秒转换为时间持续对象（最大单位为天）。
 * @param {number} seconds - 秒数（非负整数）
 * @returns {DurationMaxDayObject} 包含天、小时、分钟、秒、毫秒的时间持续对象
 * @throws {TypeError} 当 seconds 不是有效数字时抛出
 * @throws {RangeError} 当 seconds 为负数时抛出
 * @example
 * // 返回 { days: 486, hours: 22, minutes: 6, seconds: 40, milliseconds: 500 }
 * second2DurationMaxDay(42070000.5);
 */
export function second2DurationMaxDay(seconds) {
    if (typeof seconds !== "number" || isNaN(seconds)) {
        throw new TypeError("seconds must be a valid number");
    }
    if (seconds < 0) {
        throw new RangeError("seconds must be a non-negative number");
    }
    return millisecond2DurationMaxDay(seconds * 1000);
}

/**
 * 将秒转换为时间持续对象（最大单位为小时）。
 * @param {number} seconds - 秒数（非负整数）
 * @returns {DurationMaxHourObject} 包含小时、分钟、秒、毫秒的时间持续对象
 * @throws {TypeError} 当 seconds 不是有效数字时抛出
 * @throws {RangeError} 当 seconds 为负数时抛出
 * @example
 * // 返回 { hours: 11686, minutes: 6, seconds: 40, milliseconds: 500 }
 * second2DurationMaxHour(42070000.5);
 */
export function second2DurationMaxHour(seconds) {
    if (typeof seconds !== "number" || isNaN(seconds)) {
        throw new TypeError("seconds must be a valid number");
    }
    if (seconds < 0) {
        throw new RangeError("seconds must be a non-negative number");
    }
    return millisecond2DurationMaxHour(seconds * 1000);
}

//#endregion

/**
 * 根据小时数返回对应的时间段名称。
 *
 * @param {number} hour - 24 小时制的小时（0-23）
 * @param {object} [locales] - 自定义时段文案
 * @param {string} [locales.earlyMorning="凌晨"] - 00-05
 * @param {string} [locales.morning="上午"] - 06-11
 * @param {string} [locales.noon="中午"] - 12-13
 * @param {string} [locales.afternoon="下午"] - 14-17
 * @param {string} [locales.evening="晚上"] - 18-23
 * @returns {string} 时段名称
 * @throws {RangeError} 当 hour 不在 0-23 范围时抛出
 */
export function getTimePeriodName(hour, locales = getLocales_TimePeriod()) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        throw new RangeError("hour 必须是 0-23 的整数");
    }
    if (hour >= 0 && hour < 6) return locales.earlyMorning;
    if (hour < 12) return locales.morning;
    if (hour < 14) return locales.noon;
    if (hour < 18) return locales.afternoon;
    return locales.evening;
}

/**
 * 格式化时间戳为本地化的时间字符串。
 *
 * @param {number} timestamp - 要格式化的时间戳（毫秒）。
 * @param {Object} [locales] - 本地化配置对象，包含时间相关的本地化字符串。
 * @param {string} [locales.justNow='刚刚'] - 表示刚刚过去的时间。
 * @param {string} [locales.today='今天'] - 表示今天。
 * @param {string} [locales.yesterday='昨天'] - 表示昨天。
 * @param {string} [locales.beforeYesterday='前天'] - 表示前天。
 * @param {string} [locales.year='年'] - 年的单位。
 * @param {string} [locales.month='月'] - 月的单位。
 * @param {string} [locales.day='日'] - 日的单位。
 * @param {Object} [locales.timePeriod] - 一天中不同时间段的本地化字符串。
 * @param {string} [locales.timePeriod.earlyMorning='凌晨'] - 凌晨。
 * @param {string} [locales.timePeriod.morning='上午'] - 上午。
 * @param {string} [locales.timePeriod.noon='中午'] - 中午。
 * @param {string} [locales.timePeriod.afternoon='下午'] - 下午。
 * @param {string} [locales.timePeriod.evening='晚上'] - 晚上。
 * @param {Array<string>} [locales.weekDays=['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']] - 星期几的本地化字符串数组。
 *
 * @returns {string} - 格式化后的时间字符串。
 */
export function formatTimeForLocale(
    timestamp,
    locales = {
        justNow: "刚刚",
        today: "今天",
        yesterday: "昨天",
        beforeYesterday: "前天",
        year: "年",
        month: "月",
        day: "日",
        timePeriod: getLocales_TimePeriod(),
        weekDays: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
    }
) {
    const now = new Date();
    const messageDate = new Date(timestamp);

    const nowTime = now.getTime();
    const msgTime = messageDate.getTime();
    const diff = nowTime - msgTime;
    const diffMinutes = Math.floor(diff / (1000 * 60));

    const year = messageDate.getFullYear();
    const month = messageDate.getMonth() + 1;
    const day = messageDate.getDate();
    const hour = messageDate.getHours();
    const minute = messageDate.getMinutes().toString().padStart(2, "0");

    // 刚刚：1分钟内
    if (diffMinutes < 1) {
        return locales.justNow;
    }

    // 计算自然天数差（按日期而非时间差）
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(year, month - 1, day);
    const diffDays = Math.floor((nowDate.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

    const period = getTimePeriodName(hour, locales.timePeriod);
    const timeStr = `${hour}:${minute}`;

    // 今天
    if (diffDays === 0) {
        return `${locales.today} ${period}${timeStr}`;
    }

    // 昨天
    if (diffDays === 1) {
        return `${locales.yesterday} ${period}${timeStr}`;
    }

    // 前天
    if (diffDays === 2) {
        return `${locales.beforeYesterday} ${period}${timeStr}`;
    }

    // 本周内（周一到周日，且不是今天/昨天/前天）
    // 获取本周一的日期
    const nowDay = now.getDay() || 7; // 周日转为7
    const msgDay = messageDate.getDay() || 7;
    const mondayOfThisWeek = new Date(nowDate.getTime() - (nowDay - 1) * 24 * 60 * 60 * 1000);
    const mondayOfThatWeek = new Date(msgDate.getTime() - (msgDay - 1) * 24 * 60 * 60 * 1000);

    if (mondayOfThisWeek.getTime() === mondayOfThatWeek.getTime() && diffDays < 7) {
        const weekDayName = locales.weekDays[messageDate.getDay()];
        return `${weekDayName}${period} ${timeStr}`;
    }

    // 本月内（非本周）
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    if (year === nowYear && messageDate.getMonth() === nowMonth) {
        return `${month}${locales.month}${day}${locales.day} ${period}${timeStr}`;
    }

    // 本年内（非本月）
    if (year === nowYear) {
        return `${month}${locales.month}${day}${locales.day} ${period}${timeStr}`;
    }

    // 其他（非本年）
    return `${year}${locales.year}${month}${locales.month}${day}${locales.day} ${period}${timeStr}`;
}
