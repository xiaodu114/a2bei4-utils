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
