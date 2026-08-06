/**
 * 视口尺寸对象。
 * @typedef {Object} ViewportDimensions
 * @property {number} w 视口宽度，单位像素。
 * @property {number} h 视口高度，单位像素。
 */

/**
 * 获取当前视口（viewport）的宽高。
 *
 * 兼容策略：
 * 1. 优先使用 `window.innerWidth/innerHeight`（现代浏览器）。
 * 2. 降级到 `document.documentElement.clientWidth/clientHeight`（IE9+ 及怪异模式）。
 * 3. 最后降级到 `document.body.clientWidth/clientHeight`（IE6-8 怪异模式）。
 *
 * @returns {ViewportDimensions} 包含 `w`（宽度）和 `h`（高度）的对象，单位为像素。
 *
 * @example
 * const { w, h } = getViewportSize();
 * console.log(`视口尺寸：${w} × ${h}`);
 */
export function getViewportSize() {
    const d = document,
        root = d.documentElement,
        body = d.body;

    return {
        w: window.innerWidth || root.clientWidth || body.clientWidth,
        h: window.innerHeight || root.clientHeight || body.clientHeight
    };
}

/**
 * 将当前页面 URL 的 query 部分解析成键值对对象。
 *
 * @returns {Record<string, string>} 所有查询参数组成的平凡对象
 *                                   （同名 key 仅保留最后一项）
 */
export function getAllSearchParams() {
    const urlSearchParams = new URLSearchParams(location.search);
    return Object.fromEntries(urlSearchParams.entries());
}

/**
 * 根据 key 获取当前页面 URL 中的单个查询参数。
 *
 * @param {string} key - 要提取的参数名
 * @returns {string | undefined} 对应参数值；不存在时返回 `undefined`
 */
export function getSearchParam(key) {
    const params = getAllSearchParams();
    return params[key];
}

/**
 * 全屏操作辅助工具对象
 * @namespace fullscreenHelper
 */
export const fullscreenHelper = {
    /**
     * 请求进入全屏模式
     * @param {Element} element - 要全屏显示的元素
     * @returns {Promise<void> | undefined} 全屏请求 Promise（如支持）
     */
    requestFullscreen: (element) => {
        if (!element) {
            console.warn("未提供有效的 DOM 元素");
            return;
        }
        if (element.requestFullscreen) {
            return element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
            return element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
            return element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            return element.msRequestFullscreen();
        } else {
            console.warn("当前浏览器不支持全屏 API");
        }
    },

    /**
     * 退出全屏模式
     * @returns {Promise<void> | undefined} 退出全屏请求 Promise（如支持）
     */
    exitFullscreen: () => {
        if (document.exitFullscreen) {
            return document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            return document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            return document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            return document.msExitFullscreen();
        }
    },

    /**
     * 获取当前全屏元素
     * @returns {Element | null} 当前处于全屏模式的元素，无则返回 null
     */
    getFullscreenElement: () => {
        return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
    },

    /**
     * 检测当前是否处于全屏模式
     * @returns {boolean} 是否全屏中
     */
    isFullscreen: () => {
        return !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    },

    /**
     * 检测浏览器是否支持全屏 API
     * @returns {boolean} 是否支持全屏
     */
    isFullscreenEnabled: () => {
        return !!(document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled);
    },

    /**
     * 切换指定元素的全屏状态
     * @param {Element} element - 要切换全屏的元素
     * @returns {Promise<void> | undefined} 全屏操作 Promise
     */
    toggleFullscreen: (element) => {
        if (fullscreenHelper.isFullscreen()) {
            return fullscreenHelper.exitFullscreen();
        } else {
            return fullscreenHelper.requestFullscreen(element);
        }
    },

    /**
     * 监听全屏变化事件
     * @param {Function} callback - 全屏状态变化时的回调函数，参数为 isFullscreen: boolean
     * @returns {Function} 取消监听的函数
     */
    onFullscreenChange: (callback) => {
        const handler = () => {
            callback(fullscreenHelper.isFullscreen());
        };
        document.addEventListener("fullscreenchange", handler);
        document.addEventListener("webkitfullscreenchange", handler);
        document.addEventListener("mozfullscreenchange", handler);
        document.addEventListener("msfullscreenchange", handler);

        return () => {
            document.removeEventListener("fullscreenchange", handler);
            document.removeEventListener("webkitfullscreenchange", handler);
            document.removeEventListener("mozfullscreenchange", handler);
            document.removeEventListener("msfullscreenchange", handler);
        };
    }
};

/**
 * 复制文本到剪贴板
 * @param {String} text
 * @returns {Promise<void>}
 */
export async function copyTextToClipboard(text) {
    if (window.navigator.clipboard) {
        await window.navigator.clipboard.writeText(text);
        return;
    }

    return new Promise((resolve, reject) => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed"; // 防止滚动
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();

        try {
            document.execCommand("copy") ? resolve() : reject(new Error("execCommand failed"));
        } catch (err) {
            reject(err);
        } finally {
            document.body.removeChild(ta);
        }
    });
}
