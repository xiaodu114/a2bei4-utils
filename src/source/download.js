/**
 * 通过动态创建 `<a>` 标签触发浏览器下载。
 * 注意：此方法可能无法强制下载浏览器原生支持的文件（如图片、PDF），浏览器可能会选择直接打开。
 *
 * @param {string} url - 任意可下载地址（同源或允许跨域）
 * @param {string} [fileName] - 保存到本地的文件名；不传时使用时间戳
 */
export function downloadByUrl(url, fileName) {
    const a = document.createElement("a");
    a.style.display = "none";
    a.rel = "noopener";
    a.href = url;
    a.download = fileName || Date.now();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * 把 Blob 转成临时 URL 并触发下载，下载完成后立即释放内存。
 *
 * @param {Blob} blob - 待下载的 Blob（含 File）
 * @param {string} [fileName] - 保存到本地的文件名
 */
export function downloadByBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    downloadByUrl(url, fileName);
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * 将任意数据包装成 Blob 并下载。
 *
 * @param {string | ArrayBufferView | ArrayBuffer | Blob} data - 要写入文件的数据
 * @param {string} [fileName] - 保存到本地的文件名
 * @param {string} [mimeType] - MIME 类型；默认 `application/octet-stream`
 */
export function downloadByData(data, fileName, mimeType = "application/octet-stream") {
    downloadByBlob(new Blob([data], { type: mimeType }), fileName);
}

/**
 * 快捷下载 Excel 文件（MIME 已固定）。
 *
 * @param {string | ArrayBufferView | ArrayBuffer | Blob} data - Excel 二进制或字符串内容
 * @param {string} [fileName] - 保存到本地的文件名
 */
export function downloadExcel(data, fileName) {
    downloadByData(data, fileName, "application/vnd.ms-excel");
}

/**
 * 快捷下载 JSON 文件（MIME 已固定）。
 * 若传入非字符串数据，会自行 `JSON.stringify`。
 *
 * @param {any} data - 要序列化的 JSON 数据
 * @param {string} [fileName] - 保存到本地的文件名
 */
export function downloadJSON(data, fileName) {
    // downloadByData(typeof data === "string" ? data : JSON.stringify(data, null, 4), fileName, "application/json");
    downloadByData(data, fileName, "application/json");
}

/**
 * 通过 `fetch` 获取资源并强制下载，避免浏览器直接打开文件。
 * 此方法适用于下载图片、PDF 等浏览器默认会打开的文件类型。
 * 如果 `fetch` 失败（如 CORS 策略阻止），会回退到 `downloadByUrl` 方法作为备选方案。
 *
 * @param {string} url - 文件的 URL 地址
 * @param {string} [fileName] - 保存到本地的文件名。如果不提供，会尝试从 URL 中自动提取
 * @returns {Promise<void>} 返回一个 Promise，在下载开始或失败后 resolve
 */
export async function fetchOrDownloadByUrl(url, fileName) {
    // 如果未提供文件名，尝试从 URL 路径中提取
    if (!fileName) {
        try {
            const urlPathname = new URL(url).pathname;
            // 获取路径的最后一部分作为文件名，并移除可能的查询参数
            fileName = urlPathname.substring(urlPathname.lastIndexOf("/") + 1).split("?")[0];
        } catch (e) {}
        // 如果提取后文件名为空（例如 URL 以 '/' 结尾），也使用时间戳
        if (!fileName) {
            fileName = Date.now().toString();
        }
    }

    try {
        const response = await fetch(url, {
            method: "GET",
            mode: "cors",
            cache: "no-cache"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        downloadByBlob(blob, fileName);
    } catch (error) {
        downloadByUrl(url, fileName);
    }
}
