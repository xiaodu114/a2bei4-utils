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
 * 在嵌套树中按 `id` 递归查找节点
 *
 * @template T extends Record<PropertyKey, any>
 * @param {string | number} id - 要查找的 id
 * @param {T[]} arr - 嵌套树森林
 * @param {string} [idKey='id'] - 主键字段
 * @param {string} [childrenKey='children'] - 子节点字段
 * @returns {T | undefined} 找到的节点；未找到返回 `undefined`
 */
export function findTreeNodeById(id, arr, idKey = "id", childrenKey = "children") {
    if (Array.isArray(arr) && arr.length > 0) {
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            if (item[idKey]?.toString() === id?.toString()) {
                return item;
            } else if (Array.isArray(item[childrenKey]) && item[childrenKey].length > 0) {
                const result = findTreeNodeById(id, item[childrenKey], idKey, childrenKey);
                if (result) {
                    return result;
                }
            }
        }
    }
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
export function findObjAttrValueById(id, arr, resultKey = "name", idKey = "id", childrenKey = "children") {
    return findTreeNodeById(id, arr, idKey, childrenKey)?.[resultKey];
}

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

/**
 * 在树形结构中查找目标节点的完整路径（从根节点到目标节点，含目标节点自身）。
 *
 * @template T extends Record<PropertyKey, any>
 * @param {T[]} nodes - 树形结构森林（支持多根）
 * @param {any} targetValue - 目标节点的 key 值
 * @param {string} [key='id'] - 节点唯一标识字段
 * @param {string} [parentKey='pid'] - 父节点标识字段（指向父节点的 key 值）
 * @param {string} [childrenKey='children'] - 子节点数组字段
 * @returns {T[]} 从根到目标节点的路径数组；未找到返回空数组
 *
 * @example
 * const tree = [
 *   { id: 1, pid: null, children: [
 *     { id: 2, pid: 1, children: [
 *       { id: 3, pid: 2 }
 *     ]}
 *   ]}
 * ];
 * findTreeNodePath(tree, 3); // [{id:1, ...}, {id:2, ...}, {id:3, ...}]
 */
export function findTreeNodePath(nodes, targetValue, key = "id", parentKey = "pid", childrenKey = "children") {
    if (!Array.isArray(nodes) || nodes.length === 0 || targetValue == null) {
        return [];
    }

    // 1. 建立节点索引
    const index = new Map();
    const stack = [...nodes];

    while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;

        index.set(node[key], node);

        const children = node[childrenKey];
        if (Array.isArray(children)) {
            stack.push(...children);
        }
    }

    // 2. 回溯路径（防循环引用）
    const path = [];
    const visited = new Set();
    let cur = index.get(targetValue);

    while (cur && !visited.has(cur[key])) {
        visited.add(cur[key]);
        path.push(cur);

        const parentValue = cur[parentKey];
        cur = parentValue != null ? index.get(parentValue) : undefined;
    }

    return path.reverse();
}

/**
 * 处理函数的返回值类型，用于控制节点是否添加。
 * @typedef {Object} TransformTreeDataWithExtra_HandlerResult
 * @property {boolean} [isAdd] - 是否将该节点添加到树中。如果为 false，则过滤掉该节点。
 */

/**
 * 最终输出的树形结构的字段配置。
 * @typedef {Object} TransformTreeDataWithExtra_TreeDataOption
 * @property {string} [idKey="key"] - 最终树节点的唯一标识字段名。
 * @property {string} [titleKey="title"] - 最终树节点的标题显示字段名。
 * @property {string} [childrenKey="children"] - 最终树节点的子节点列表字段名。
 */

/**
 * 主数据（父节点）的相关配置选项。
 * @typedef {Object} TransformTreeDataWithExtra_NodeOption
 * @property {string} [idPrefix] - 节点 ID 的前缀。
 * @property {string} [idKey="id"] - 原始数据中作为唯一标识的字段名。
 * @property {string} [titleKey="name"] - 原始数据中作为标题的字段名。
 * @property {string} [childrenKey="children"] - 原始数据中子节点列表的字段名。
 * @property {Record<string, any>} [assignData] - 需要额外合并到每个树节点上的静态属性。
 * @property {string} [rawDataKey] - 如果提供，会将原始节点数据对象挂载到树节点的此字段下。
 * @property {Object<string, any>} [nodeDataId2Obj] - (副作用) 引用传递的对象，用于建立 id -> 原始数据的映射。
 * @property {function(object, object): TransformTreeDataWithExtra_HandlerResult | void} [nodeDataHandler] - 对每个主节点进行处理的回调函数。
 */

/**
 * 额外数据（子节点）的相关配置选项。
 * @typedef {Object} TransformTreeDataWithExtra_ExtraOption
 * @property {string} [idPrefix] - 额外节点 ID 的前缀。
 * @property {string} [idKey="id"] - 额外数据中作为唯一标识的字段名。
 * @property {string} [titleKey="name"] - 额外数据中作为标题的字段名。
 * @property {string} [childrenKey="extraChildren"] - 在主节点上查找额外数据列表的字段名。
 * @property {Record<string, any>} [assignData] - 需要额外合并到每个额外树节点上的静态属性。
 * @property {string} [rawDataKey] - 如果提供，会将原始额外数据对象挂载到树节点的此字段下。
 * @property {Object<string, any>} [extraDataId2Obj] - (副作用) 引用传递的对象，用于建立 id -> 额外数据的映射。
 * @property {function(object, object, object): TransformTreeDataWithExtra_HandlerResult | void} [extraDataHandler] - 对每个额外节点进行处理的回调函数。
 */

/**
 * 将平铺或嵌套的原始数据转换为标准树形结构。
 * 支持将外部“额外数据”节点作为子节点插入到主节点层级中。
 * 支持自定义字段映射、ID 前缀、数据挂载以及通过回调函数过滤节点。
 *
 * @template T
 * @param {Array<T>} data - 原始数据数组。
 * @param {TransformTreeDataWithExtra_ExtraOption} [extraOption] - 额外数据（子节点）的相关配置选项。
 * @param {TransformTreeDataWithExtra_NodeOption} [nodeOption] - 主数据（父节点）的相关配置选项。
 * @param {TransformTreeDataWithExtra_TreeDataOption} [treeDataOption] - 最终输出的树形结构的字段配置选项。
 * @returns {Array<object>} 转换后的树形数据数组。
 */
export function transformTreeDataWithExtra(data, extraOption = {}, nodeOption = {}, treeDataOption = {}) {
    const { idPrefix: nodeIdPrefix, idKey: nodeIdKey = "id", titleKey: nodeTitleKey = "name", childrenKey: nodeChildrenKey = "children", assignData: nodeAssignData = {}, rawDataKey: nodeRawDataKey, nodeDataId2Obj, nodeDataHandler } = nodeOption;
    const { idPrefix: extraIdPrefix, idKey: extraIdKey = "id", titleKey: extraTitleKey = "name", childrenKey: extraChildrenKey = "extraChildren", assignData: extraAssignData = {}, rawDataKey: extraRawDataKey, extraDataId2Obj, extraDataHandler } = extraOption;

    const { idKey: treeIdKey = "key", titleKey: treeTitleKey = "title", childrenKey: treeChildrenKey = "children" } = treeDataOption;

    const transformNode = (node) => {
        const treeNode = {
            [treeIdKey]: isNonEmptyString(nodeIdPrefix) ? nodeIdPrefix + node[nodeIdKey] : node[nodeIdKey],
            [treeTitleKey]: node[nodeTitleKey],
            [treeChildrenKey]: [],
            ...nodeAssignData
        };
        if (isNonEmptyString(nodeRawDataKey)) {
            treeNode[nodeRawDataKey] = node;
        }

        if (Array.isArray(node[nodeChildrenKey]) && node[nodeChildrenKey].length > 0) {
            treeNode[treeChildrenKey] = node[nodeChildrenKey].map((child) => transformNode(child)).filter((child) => child !== null);
        }

        if (Array.isArray(node[extraChildrenKey]) && node[extraChildrenKey].length > 0) {
            const isValidExtraDataId2Obj = typeof extraDataId2Obj === "object" && extraDataId2Obj !== null;
            const extraNodes = [];
            for (const extraItem of node[extraChildrenKey]) {
                if (isValidExtraDataId2Obj) {
                    extraDataId2Obj[extraItem[extraIdKey]] = extraItem;
                }
                const extraNode = {
                    [treeIdKey]: isNonEmptyString(extraIdPrefix) ? extraIdPrefix + extraItem[extraIdKey] : extraItem[extraIdKey],
                    [treeTitleKey]: extraItem[extraTitleKey],
                    [treeChildrenKey]: [],
                    ...extraAssignData
                };
                if (isNonEmptyString(extraRawDataKey)) {
                    extraNode[extraRawDataKey] = extraItem;
                }
                if (typeof extraDataHandler === "function") {
                    const result = extraDataHandler(extraNode, extraItem, node);
                    if (result?.isAdd === false) continue;
                }
                extraNodes.push(extraNode);
            }
            treeNode[treeChildrenKey] = [...treeNode[treeChildrenKey], ...extraNodes];
        }

        if (typeof nodeDataId2Obj === "object" && nodeDataId2Obj !== null) {
            nodeDataId2Obj[node[nodeIdKey]] = node;
        }

        if (typeof nodeDataHandler === "function") {
            const result = nodeDataHandler(treeNode, node);
            if (result?.isAdd === false) {
                return null;
            }
        }

        return treeNode;
    };

    return data.map((item) => transformNode(item)).filter((item) => item !== null);
}

/**
 * 自定义过滤函数的类型定义。
 * @callback FilterTreeData_FilterFn
 * @param {object} node - 当前遍历到的树节点对象。
 * @param {string | number} filterValue - 当前用于过滤的值。
 * @param {Array<object>} [children] - 当前节点的子节点数组（原始数据）。
 * @returns {boolean} 返回 true 表示保留该节点，false 表示过滤掉。
 */

/**
 * 递归过滤树形数据。
 *
 * 该函数会保留符合条件的节点。特别地，**即使当前节点本身不匹配条件，只要其子孙节点中有匹配项，该节点也会被保留**，
 * 从而保证过滤后的树结构能展示出匹配节点的完整路径。
 *
 * @template T
 * @param {Array<T>} treeData - 源树形数据数组。
 * @param {string | number} filterValue - 用于过滤的关键字。
 * @param {string} [filterKey="name"] - 节点对象中用于匹配的字段名。默认为 "name"。如果提供了 filterFn 则此项无效。
 * @param {string} [childrenKey="children"] - 节点对象中存储子数组的字段名。默认为 "children"。
 * @param {FilterTreeData_FilterFn} [filterFn] - 自定义过滤函数。如果提供，将忽略 filterKey，使用此函数的返回值判断是否匹配。
 * @returns {Array<T>} 过滤后的新树形数据数组。注意：返回的是节点对象的浅拷贝。
 */
export function filterTreeData(treeData, filterValue, filterKey = "name", childrenKey = "children", filterFn) {
    if (!Array.isArray(treeData) || treeData.length === 0) {
        return [];
    }

    if (filterValue == null || filterValue === "") {
        return treeData.map((node) => ({ ...node }));
    }

    const result = [];

    for (const node of treeData) {
        const newNode = { ...node };
        const children = node[childrenKey];

        //  后代节点
        let isDescendantMatch = false;
        if (Array.isArray(children)) {
            const newChildren = filterTreeData(children, filterValue, filterKey, childrenKey, filterFn);
            newNode[childrenKey] = newChildren;
            isDescendantMatch = newChildren.length > 0;
        }

        if (isDescendantMatch) {
            result.push(newNode);
        } else {
            // 当前节点
            const isMatch = typeof filterFn === "function" ? filterFn(node, filterValue, children) : node[filterKey]?.toString().includes(filterValue);

            if (isMatch) {
                result.push(newNode);
            }
        }
    }
    return result;
}
