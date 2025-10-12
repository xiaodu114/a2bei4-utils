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
