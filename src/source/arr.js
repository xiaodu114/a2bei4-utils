/**
 * 使用 Fisher-Yates 算法对数组 **原地** 随机乱序。
 * @template T
 * @param {T[]} arr - 要乱序的数组
 * @returns {T[]} 返回传入的同一数组实例（已乱序）
 */
export function shuffle(arr) {
    //  方式一：
    // arr.sort(() => Math.random() - 0.5);
    //  方式二：
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * 将数组中的元素从 `fromIndex` 移动到 `toIndex`，**原地** 修改并返回该数组。
 * @template T
 * @param {T[]} arr - 要操作的数组
 * @param {number} fromIndex - 原始下标
 * @param {number} toIndex - 目标下标
 * @returns {T[]} 返回传入的同一数组实例
 */
export function moveItem(arr, fromIndex, toIndex) {
    arr.splice(toIndex, 0, arr.splice(fromIndex, 1)[0]);
}
