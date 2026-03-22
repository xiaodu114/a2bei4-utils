/**
 * 处理数据库菜单项，生成 UI 菜单树和路由配置。
 *
 * @param {Array<Object>} menuItems - 原始菜单项数组，树形结构
 * @param {Object} [options] - 配置选项
 * @param {string} [options.idKey='id'] - 数据源 ID 键名
 * @param {string} [options.codeKey='code'] - 数据源编码键名, 用于拼接路由名称和路由路径
 * @param {string} [options.labelKey='text'] - 数据源标签键名
 * @param {string} [options.childrenKey='children'] - 数据源子节点键名
 * @param {string} [options.extendKey='extend'] - 数据源扩展对象键名
 * @param {string} [options.menuIdKey='key'] - 输出菜单 ID 键名
 * @param {string} [options.menuLabelKey='label'] - 输出菜单标签键名
 * @param {string} [options.menuChildrenKey='children'] - 输出菜单子节点键名
 * @param {string} [options.menuExtendKey='extend'] - 输出菜单扩展对象键名
 * @param {string} [options.routeNameKey='name'] - 路由名称键名
 * @param {string} [options.routePathKey='path'] - 路由路径键名
 * @param {string} [options.routeMetaKey='meta'] - 路由元数据键名
 * @param {Function} [options.handleNodeItem] - 节点处理钩子，参数：(nodeSimple) => void
 * @param {Function} [options.handleMenuItem] - 菜单项处理钩子，参数：(uiMenuItem, nodeSimple) => void
 * @param {Function} [options.handleRouteItem] - 路由项处理钩子，参数：(routeItem, nodeSimple) => void
 *
 * @returns {Object} 处理结果
 * @returns {Array<Object>} returns.uiMenuItems - UI 菜单树形结构数组
 * @returns {Array<Object>} returns.routeItems - 扁平化路由配置数组
 * @returns {Map<string, Object>} returns.nodeMap - 节点 ID 到节点数据的映射表
 *
 * @example
 * const menuItems = [
 *   { id: '1', code: 'system', text: '系统管理', children: [
 *     { id: '1-1', code: 'user', text: '用户管理' }
 *   ]}
 * ];
 *
 * const result = handleDbMenuItems(menuItems, {
 *   handleRouteItem: (route, node) => {
 *     route.component = () => import(`./views/${node.code}.vue`);
 *   }
 * });
 *
 * // result.uiMenuItems: [{ key: '1', label: '系统管理', children: [...] }]
 * // result.routeItems: [{ name: 'system.user', path: '/system/user', meta: { id: '1-1' } }]
 * // result.nodeMap: Map { '1' => {...}, '1-1' => {...} }
 */
export function handleDbMenuItems(menuItems, options = {}) {
    // 1. 统一配置项，简化调用
    const {
        // 数据源键名
        idKey = "id",
        codeKey = "code",
        labelKey = "text",
        childrenKey = "children",
        extendKey = "extend",

        // 输出目标键名
        menuIdKey = "key",
        menuLabelKey = "label",
        menuChildrenKey = "children",
        menuExtendKey = "extend",

        routeNameKey = "name",
        routePathKey = "path",
        routeMetaKey = "meta",

        // 钩子函数
        handleNodeItem,
        handleMenuItem,
        handleRouteItem
    } = options;

    const uiMenuItems = [];
    const routeItems = [];
    const nodeMap = new Map(); // id -> node (纯净的节点数据)
    const nodePathMap = new Map(); // id -> [{ code, id }] (仅存储路径计算所需的轻量数据)

    /* ---------- 1. 建立索引：扁平化节点 & 构建路径索引 ---------- */
    // 使用栈进行深度优先遍历，记录路径
    const stack = [];
    if (Array.isArray(menuItems)) {
        menuItems.forEach((n) => stack.push({ node: n, parentPath: [] }));
    }

    while (stack.length) {
        const { node, parentPath } = stack.pop();
        const idValue = node[idKey];

        // 构建当前节点的路径片段
        const currentPathSegment = { [idKey]: idValue };
        const fullPath = [...parentPath, currentPathSegment];

        // 存储路径信息用于后续路由生成
        nodePathMap.set(idValue, fullPath);

        // 创建轻量级的节点对象存入 nodeMap
        // 注意：这里先创建基础结构，路由信息在第二步补充
        const nodeSimple = {
            ...node,
            [extendKey]: {}, // 初始化扩展对象
            [childrenKey]: null // 去除原始 children，避免引用污染
        };
        nodeMap.set(idValue, nodeSimple);

        // 处理子节点
        const childrenNodes = node[childrenKey];
        if (Array.isArray(childrenNodes)) {
            // 逆序压栈，保持原序
            for (let i = childrenNodes.length - 1; i >= 0; i--) {
                stack.push({ node: childrenNodes[i], parentPath: fullPath });
            }
        }
    }

    /* ---------- 2. 构建树形结构 & 生成路由 ---------- */
    const buildStack = [];
    if (Array.isArray(menuItems)) {
        for (let i = menuItems.length - 1; i >= 0; i--) {
            buildStack.push({ node: menuItems[i], parentUi: undefined });
        }
    }

    while (buildStack.length) {
        const { node, parentUi } = buildStack.pop();
        const idValue = node[idKey];

        // 从 Map 中取出之前创建好的节点对象
        const nodeSimple = nodeMap.get(idValue);

        // 2.1 构建 UI 菜单项
        const uiMenuItem = {
            [menuIdKey]: idValue,
            [menuLabelKey]: node[labelKey],
            [menuExtendKey]: {} // UI 菜单专用扩展
        };

        // 处理子节点
        const childrenNodes = node[childrenKey];
        const hasChildren = Array.isArray(childrenNodes) && childrenNodes.length > 0;

        if (hasChildren) {
            // 有子节点 -> 继续压栈，传递当前 uiMenuItem 作为父级
            for (let i = childrenNodes.length - 1; i >= 0; i--) {
                buildStack.push({ node: childrenNodes[i], parentUi: uiMenuItem });
            }
        } else {
            // 2.2 无子节点 -> 生成路由配置

            // 提取 code 和 id 数组
            const codePaths = [],
                keyPaths = [];
            nodePathMap.get(idValue).forEach((item) => {
                const idValue = item[idKey];
                const nodeSimple = nodeMap.get(idValue);
                keyPaths.push(idValue);
                codePaths.push(nodeSimple[codeKey]);
            });

            const routeName = codePaths.join(".");
            const routePath = "/" + codePaths.join("/");

            const routeItem = {
                [routeNameKey]: routeName,
                [routePathKey]: routePath,
                [routeMetaKey]: { [idKey]: idValue }
            };

            // 执行路由钩子
            if (typeof handleRouteItem === "function") {
                handleRouteItem(routeItem, nodeSimple);
            }
            routeItems.push(routeItem);

            // 补充扩展信息
            uiMenuItem[menuExtendKey].routeName = routeName;
            uiMenuItem[menuExtendKey].keyPaths = keyPaths;

            nodeSimple[extendKey].routeName = routeName;
            nodeSimple[extendKey].keyPaths = keyPaths;
        }

        // 2.3 挂载到父级 UI 或根数组
        if (parentUi) {
            // 逻辑赋值，确保 children 数组存在
            (parentUi[menuChildrenKey] || (parentUi[menuChildrenKey] = [])).push(uiMenuItem);
        } else {
            if (typeof handleMenuItem === "function") {
                handleMenuItem(uiMenuItem, nodeSimple);
            }
            uiMenuItems.push(uiMenuItem);
        }

        // 执行节点钩子
        if (typeof handleNodeItem === "function") {
            handleNodeItem(nodeSimple);
        }
    }

    return { uiMenuItems, routeItems, nodeMap };
}
