/**
 * 生成 RFC4122 版本 4 的 GUID/UUID。
 * 收集来源：《基于mvc的javascript web富应用开发》 书中介绍是Robert Kieffer写的，还留了网址 http://goo.gl/0b0hu ，但实际访问不了。
 * 格式：`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
 *
 * @returns {string} 36 位大写 GUID
 *
 * @example
 * // A2E0F340-6C3B-4D7F-B8C1-1E4F6A8B9C0D
 * console.log(getGUID())
 */
export function getGUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        let r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16).toUpperCase();
    });
}

/**
 * 分布式短 ID 生成器。
 * 格式：`${timestamp}${flag}${serial}`，其中：
 * - timestamp：毫秒级时间戳
 * - flag：客户端标识串（自定义）
 * - serial：同一毫秒内的序号，左补零到固定长度
 */
export class MyId {
    #ts = Date.now(); //	时间戳
    #sn = 0; //	序号（保证同一客户端之间的唯一项）
    #flag = ""; //	客户端标识（保证不同客户端之间的唯一项）
    #len = 5; //	序号位长度（我的电脑测试，同一时间戳内可以for循环执行了1000次左右，没有一次超过3k，所以5位应该够用了）
    //  测试代码
    //  let obj = {[Date.now()]:[]}; try { for (let i = 0; i < 100000; i++) { obj[Date.now()].push(i); } } catch { console.log(obj[Object.getOwnPropertyNames(obj)[0]].length); }

    /**
     * @param {object} [option]
     * @param {string} [option.flag] - 客户端标识，默认空串
     * @param {number} [option.len=5] - 序号位长度（位数），安全范围 ≥0
     */
    constructor(option = {}) {
        if (option) {
            if (typeof option.flag === "string") {
                this.#flag = option.flag;
            }
            if (Number.isSafeInteger(option.len) && len >= 0) {
                this.#len = option.len;
            }
        }
    }

    /**
     * 生成下一个全局唯一字符串 ID。
     * 同一毫秒序号自动递增；序号溢出时会在控制台警告。
     * @returns {string}
     */
    nextId() {
        let ts = Date.now();
        if (ts === this.#ts) {
            this.#sn++;
            if (this.#sn >= 10 ** this.#len) {
                console.log("长度不够用了！！！");
            }
        } else {
            this.#sn = 0;
            this.#ts = ts;
        }
        return ts.toString() + this.#flag + this.#sn.toString().padStart(this.#len, "0");
    }
}
