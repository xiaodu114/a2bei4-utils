/**
 * 通过动态创建 `<a>` 标签触发浏览器下载。
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
