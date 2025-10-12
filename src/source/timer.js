/**
 * 基于 `setTimeout` 的“间隔循环”定时器。
 * 每次任务执行完成后才计算下一次间隔，避免任务堆积。
 */
export class IntervalTimer {
    
    /**
     * 创建定时器实例。
     * @param {() => void} fn - 每次间隔要执行的业务函数
     * @param {number} [ms=1000] - 间隔时间（毫秒）
     * @throws {TypeError} 当 `fn` 不是函数时抛出
     */
    constructor(fn, ms = 1000) {
        if (typeof fn !== "function") {
            throw new TypeError("IntervalTimer: 必须传入一个函数");
        }
        this._fn = fn;
        this._ms = ms;
        this._timerId = null;
    }

    /**
     * 启动定时器；若已启动则先停止再重新启动。
     * 首次执行会立即触发。
     */
    start() {
        this.stop();
        const loop = () => {
            this._fn(); // 执行业务
            this._timerId = setTimeout(loop, this._ms);
        };
        loop(); // 立即执行第一次
    }

    /**
     * 停止定时器。
     */
    stop() {
        if (this._timerId !== null) {
            clearTimeout(this._timerId);
            this._timerId = null;
        }
    }

    /**
     * 查询定时器是否正在运行。
     * @returns {boolean}
     */
    isRunning() {
        return this._timerId !== null;
    }
}
