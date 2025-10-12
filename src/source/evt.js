/**
 * 简单、高性能的通用事件总线。
 * - 支持命名空间事件
 * - 支持一次性监听器
 * - 返回唯一 flag，用于精确卸载
 * - emit 时可选自定义 this 指向
 */
export class MyEvent {
    constructor() {
        this.evtPool = new Map();
    }

    /**
     * 注册事件监听器。
     * @param {string} name - 事件名
     * @param {Function} fn - 回调函数
     * @returns {string} flag - 唯一标识，用于 off
     */
    on(name, fn) {
        let flag = Date.now() + "_" + parseInt(Math.random() * 1e8);
        const evtItem = {
            flag,
            fn
        };
        if (this.evtPool.has(name)) {
            this.evtPool.get(name).push(evtItem);
        } else {
            this.evtPool.set(name, [evtItem]);
        }
        return flag;
    }

    /**
     * 注册一次性监听器，触发后自动移除。
     * @param {string} name - 事件名
     * @param {Function} fn - 回调函数
     * @returns {string} flag - 唯一标识
     */
    once(name, fn) {
        const _this = this;
        let wrapper;
        wrapper = function (data) {
            _this.off(name, wrapper);
            fn.call(this, data);
        };
        return this.on(name, wrapper);
    }

    /**
     * 移除指定事件监听器。
     * @param {string} name - 事件名
     * @param {Function|string} fnOrFlag - 回调函数或 flag
     */
    off(name, fnOrFlag) {
        if (!this.evtPool.has(name)) return;
        const evtItems = this.evtPool.get(name);
        const filtered = evtItems.filter((item) => item.fn !== fnOrFlag && item.flag !== fnOrFlag);
        if (filtered.length === 0) {
            this.evtPool.delete(name);
        } else {
            this.evtPool.set(name, filtered);
        }
    }

    /**
     * 触发事件（同步执行）。
     * @param {string} name - 事件名
     * @param {*} [data] - 任意载荷
     * @param {*} [fnThis] - 回调内部 this 指向，默认 undefined
     */
    emit(name, data, fnThis) {
        if (!this.evtPool.has(name)) return;
        const evtItems = this.evtPool.get(name);
        evtItems.forEach((item) => {
            try {
                item.fn.call(fnThis, data);
            } catch (err) {
                console.error(`Error in event listener for "${name}":`, err);
            }
        });
    }
}

/**
 * 跨页通信插件：通过 localStorage + storage 事件将当前实例的 emit 广播到其他同源页面。
 * 支持节流、命名空间隔离。
 */
export const MyEvent_CrossPagePlugin = (() => {
    const INSTALLED = new WeakSet(); // 防止重复安装

    return {
        /**
         * 为指定 MyEvent 实例安装跨页插件。
         * @param {MyEvent} bus - 事件总线实例
         * @param {Options} [opts] - 配置项
         */
        install(bus, opts = {}) {
            if (INSTALLED.has(bus)) return;
            INSTALLED.add(bus);

            const ns = `___my-event-cross-page-${opts.namespace || "default"}___`;
            const delay = opts.throttle || 16;
            let last = 0;

            //  1、重写 emit
            const rawEmit = bus.emit;
            bus.emit = function (name, data, fnThis) {
                rawEmit.call(bus, name, data, fnThis); // 本地先执行
                const now = Date.now();
                if (now - last < delay) return;
                last = now;
                const key = ns + name;
                try {
                    localStorage.setItem(key, JSON.stringify({ name, data, ts: now }));
                    localStorage.removeItem(key); // 触发 storage 事件
                } catch (e) {}
            };

            //  2、监听其他页广播
            function onStorageHandler(e) {
                if (!e.key || !e.key.startsWith(ns)) return;
                let payload;
                try {
                    payload = JSON.parse(e.newValue || "{}");
                } catch {
                    return;
                }
                if (!payload.ts || payload.ts <= last) return;
                rawEmit.call(bus, e.key.slice(ns.length), payload.data); // 仅本地
            }
            addEventListener("storage", onStorageHandler);

            //  3、保存卸载器
            bus._uninstallCrossPage = () => {
                removeEventListener("storage", onStorageHandler);
                bus.emit = rawEmit;
                INSTALLED.delete(bus);
            };
        },

        /**
         * 卸载插件，恢复原始 emit 并停止监听。
         * @param {MyEvent} bus - 事件总线实例
         */
        uninstall(bus) {
            if (typeof bus._uninstallCrossPage === "function") bus._uninstallCrossPage();
        }
    };
})();
