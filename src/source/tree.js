/**
 * 把嵌套树拍平成 `{ [id]: node }` 映射，同时把原 `children` 置为 `null`。
 *
 * @template T extends Record<PropertyKey, any>
 * @param {T[]} data - 嵌套树森林
 * @param {string} [idKey='id'] - 主键字段
 * @param {string} [childrenKey='children'] - 子节点字段
 * @returns {Record<string, T & { [k in typeof childrenKey]: null }>} id→节点的映射表
 */
export function nestedTree2IdMap(data, idKey = "id", childrenKey = "children") {
    const retObj = {};
    function fn(nodes) {
        if (Array.isArray(nodes) && nodes.length > 0) {
            nodes.forEach((node) => {
                retObj[node[idKey]] = { ...node };
                retObj[node[idKey]][childrenKey] = null;

                fn(node[childrenKey]);
            });
        }
    }
    fn(data);
    return retObj;
}

/**
 * 把**已包含完整父子关系**的扁平节点列表还原成嵌套树（森林）。
 *
 * @template T extends Record<PropertyKey, any>
 * @param {T[]} nodes - 扁平节点列表（必须包含 id / parentId）
 * @param {number | string} [parentId=0] - 根节点标识值
 * @param {Object} [opts] - 字段映射配置
 * @param {string} [opts.idKey='id'] - 节点主键
 * @param {string} [opts.parentKey='parentId'] - 父节点外键
 * @param {string} [opts.childrenKey='children'] - 存放子节点的字段
 * @returns {(T & { [k in typeof childrenKey]: T[] })[]} 嵌套树森林
 */
export function flatCompleteTree2NestedTree(nodes, parentId = 0, { idKey = "id", parentKey = "parentId", childrenKey = "children" } = {}) {
    const map = new Map(); // id -> node
    const items = []; // 多根森林

    // 1. 初始化：保证每个节点都有 children，并存入 map
    for (const item of nodes) {
        const node = { ...item, [childrenKey]: [] };
        map.set(item[idKey], node);
    }

    // 2. 建立父子关系
    for (const item of nodes) {
        const node = map.get(item[idKey]);
        const parentIdVal = item[parentKey];

        if (parentIdVal === parentId) {
            // 根层
            items.push(node);
        } else {
            // 非根层：找到父节点，把自己挂上去
            const parent = map.get(parentIdVal);
            if (parent) parent[childrenKey].push(node);
            // 如果 parent 不存在，说明数据不完整，可自定义处理
        }
    }

    return items;
}

/**
 * 在嵌套树中按 `id` 递归查找节点，并返回其指定属性值。
 *
 * @template T extends Record<PropertyKey, any>
 * @param {string | number} id - 要查找的 id
 * @param {T[]} arr - 嵌套树森林
 * @param {string} [resultKey='name'] - 需要返回的字段
 * @param {string} [idKey='id'] - 主键字段
 * @param {string} [childrenKey='children'] - 子节点字段
 * @returns {any} 找到的值；未找到返回 `undefined`
 */
export const findObjAttrValueById = function findObjAttrValueByIdFn(id, arr, resultKey = "name", idKey = "id", childrenKey = "children") {
    if (Array.isArray(arr) && arr.length > 0) {
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            if (item[idKey]?.toString() === id?.toString()) {
                return item[resultKey];
            } else if (Array.isArray(item[childrenKey]) && item[childrenKey].length > 0) {
                const result = findObjAttrValueByIdFn(id, item[childrenKey], resultKey, idKey, childrenKey);
                if (result) {
                    return result;
                }
            }
        }
    }
};

/**
 * 从服务端返回的已选 id 数组里，提取出
 * 1. 叶子节点
 * 2. 所有子节点都被选中的父节点
 * 其余父节点一律丢弃（由前端 Tree 自动算半选）
 *
 * @param {Array}  treeData     完整树
 * @param {Array}  selectedKeys 后端给的选中 id 数组
 * @param {String} idKey        节点唯一字段
 * @param {String} childrenKey  子节点字段
 * @returns {{checked: string[], halfChecked: string[]}}
 */
export function extractFullyCheckedKeys(treeData, selectedKeys, idKey = "id", childrenKey = "children") {
    const selectedSet = new Set(selectedKeys);
    const checked = new Set();
    const halfChecked = new Set();

    /* 返回值含义
        0 - 未选中
        1 - 半选
        2 - 全选
        */
    function dfs(node) {
        const nodeId = node[idKey];
        const children = node[childrenKey] || [];

        // 叶子
        if (!children.length) {
            if (selectedSet.has(nodeId)) {
                checked.add(nodeId);
                return 2;
            }
            return 0;
        }

        // 非叶子
        let allChecked = true;
        let someChecked = false;

        children.forEach((child) => {
            const childState = dfs(child);
            if (childState !== 2) allChecked = false;
            if (childState >= 1) someChecked = true;
        });

        // 当前节点本身在 selectedKeys 里，但子节点未全选 → 只能算半选
        if (selectedSet.has(nodeId)) {
            if (allChecked) {
                checked.add(nodeId);
                return 2;
            }
            halfChecked.add(nodeId);
            return 1;
        }

        // 当前节点不在 selectedKeys 里，看子节点
        if (allChecked) {
            checked.add(nodeId);
            return 2;
        }
        if (someChecked) {
            halfChecked.add(nodeId);
            return 1;
        }
        return 0;
    }

    treeData.forEach(dfs);
    return {
        checked: [...checked],
        halfChecked: [...halfChecked]
    };
}
